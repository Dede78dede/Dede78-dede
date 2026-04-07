import { EventEmitter } from 'events';
import { workflowEngine } from './WorkflowEngine';
import { JobStatus, WorkflowStatus } from '../core/enums';
import { firestoreDb } from '../db/firestore';
import admin from 'firebase-admin';

export interface Job {
  id: string;
  agent_id: string | null;
  task_type: string;
  status: JobStatus;
  progress: number;
  logs: string;
  payload: string | null;
  created_at: string;
  updated_at: string;
}

class JobScheduler extends EventEmitter {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private activeJobs: Map<string, Promise<void>> = new Map();
  private maxConcurrentJobs = 2; // Limit concurrent jobs

  constructor() {
    super();
  }

  public start(intervalMs = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.poll(), intervalMs);
    this.poll(); // Initial poll
  }

  public stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll() {
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return; // Max capacity reached
    }

    try {
      // Find a pending job
      const snapshot = await firestoreDb.collection('jobs')
        .where('status', '==', JobStatus.PENDING)
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const job = { id: doc.id, ...doc.data() } as any;
        // Map Firestore fields to internal Job interface
        const mappedJob: Job = {
          id: job.id,
          agent_id: job.agentId || null,
          task_type: job.taskType,
          status: job.status,
          progress: job.progress || 0,
          logs: job.logs || '',
          payload: job.payload || null,
          created_at: job.createdAt,
          updated_at: job.updatedAt
        };
        this.executeJob(mappedJob);
      }
    } catch (error) {
      console.error('[JobScheduler] Error polling jobs:', error);
    }
  }

  private async executeJob(job: Job) {
    // Mark as running
    await this.updateJobStatus(job.id, JobStatus.RUNNING, 0, 'Job started');

    const jobPromise = this.processTask(job)
      .then(async () => {
        const doc = await firestoreDb.collection('jobs').doc(job.id).get();
        if (doc.exists) {
          const currentJob = doc.data() as any;
          if (currentJob.status !== JobStatus.COMPLETED && currentJob.status !== JobStatus.FAILED && currentJob.status !== JobStatus.PENDING_FRONTEND && currentJob.status !== JobStatus.WAITING_FRONTEND) {
            await this.updateJobStatus(job.id, JobStatus.COMPLETED, 100, (currentJob.logs || '') + '\nJob completed successfully');
          }
        }
      })
      .catch(async (error) => {
        console.error(`[JobScheduler] Job ${job.id} failed:`, error);
        const doc = await firestoreDb.collection('jobs').doc(job.id).get();
        const logs = doc.exists ? (doc.data()?.logs || '') + `\nError: ${error.message}` : `Error: ${error.message}`;
        await this.updateJobStatus(job.id, JobStatus.FAILED, job.progress, logs);
      })
      .finally(() => {
        this.activeJobs.delete(job.id);
        this.poll(); // Check for more jobs immediately after one finishes
      });

    this.activeJobs.set(job.id, jobPromise);
  }

  private async processTask(job: Job): Promise<void> {
    // Parse payload
    let payload: Record<string, unknown> = {};
    try {
      if (job.payload) {
        payload = JSON.parse(job.payload) as Record<string, unknown>;
      }
    } catch (e) {
      console.error(`[JobScheduler] Failed to parse payload for job ${job.id}`);
    }

    // Simulate task processing based on type
    switch (job.task_type) {
      case 'WORKFLOW':
        if (payload.workflow_id) {
          await this.processWorkflow(payload.workflow_id as string, job.id);
        } else {
          throw new Error('Missing workflow_id in payload');
        }
        break;
      case 'TRAINING':
        await this.simulateLongTask(job.id, 30000, 'Training model...');
        break;
      case 'MERGING':
        await this.simulateLongTask(job.id, 20000, 'Merging models...');
        break;
      case 'EVALUATION':
      case 'complex_research':
        await this.executeGeminiTask(job.id, job.task_type, payload);
        break;
      case 'RESEARCH':
        await this.simulateLongTask(job.id, 10000, 'Gathering research data...');
        break;
      default:
        // Generic task
        await this.simulateLongTask(job.id, 5000, `Executing ${job.task_type}...`);
        break;
    }
  }

  private async executeGeminiTask(jobId: string, task_type: string, payload: Record<string, unknown>) {
    let currentLogs = `Delegating ${task_type} task to frontend worker...\n`;
    await this.updateJobStatus(jobId, JobStatus.PENDING_FRONTEND, 10, currentLogs);
    this.emit('pending_frontend');
  }

  private async processWorkflow(workflowId: string, jobId: string) {
    let hasMoreSteps = true;
    let currentLogs = `Starting workflow ${workflowId}...\n`;
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 0, currentLogs);

    while (hasMoreSteps) {
      try {
        hasMoreSteps = await workflowEngine.processNextStep(workflowId);
        if (hasMoreSteps) {
          currentLogs += `Step completed. Checking for next step...\n`;
          await this.updateJobStatus(jobId, JobStatus.RUNNING, 50, currentLogs); // Update progress based on steps completed
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        currentLogs += `Workflow failed: ${errorMessage}\n`;
        await this.updateJobStatus(jobId, JobStatus.FAILED, 100, currentLogs);
        throw error; // Re-throw to mark job as failed
      }
    }
    
    // Check if workflow actually failed (e.g. all retries exhausted)
    const workflowDoc = await firestoreDb.collection('workflows').doc(workflowId).get();
    const workflow = workflowDoc.exists ? workflowDoc.data() : null;
    if (workflow && workflow.status === WorkflowStatus.FAILED) {
      currentLogs += `Workflow ${workflowId} finished with FAILED status.\n`;
      await this.updateJobStatus(jobId, JobStatus.FAILED, 100, currentLogs);
      throw new Error(`Workflow ${workflowId} failed`);
    } else if (workflow && workflow.status === WorkflowStatus.COMPLETED) {
      currentLogs += `Workflow ${workflowId} finished successfully.\n`;
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, 100, currentLogs);
    } else {
      currentLogs += `Workflow ${workflowId} paused, waiting for frontend worker.\n`;
      await this.updateJobStatus(jobId, JobStatus.WAITING_FRONTEND, 50, currentLogs);
    }
  }

  private async simulateLongTask(jobId: string, durationMs: number, initialLog: string) {
    const steps = 10;
    const stepDuration = durationMs / steps;
    
    let currentLogs = initialLog + '\n';
    await this.updateJobStatus(jobId, JobStatus.RUNNING, 0, currentLogs);

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      const progress = Math.floor((i / steps) * 100);
      currentLogs += `Step ${i}/${steps} completed (${progress}%)\n`;
      await this.updateJobStatus(jobId, JobStatus.RUNNING, progress, currentLogs);
    }
  }

  private async updateJobStatus(id: string, status: JobStatus, progress: number, newLogs: string) {
    try {
      await firestoreDb.collection('jobs').doc(id).update({
        status,
        progress,
        logs: newLogs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      this.emit('jobUpdated', { id, status, progress });
    } catch (error) {
      console.error(`[JobScheduler] Failed to update job ${id}:`, error);
    }
  }
}

// Export a singleton instance
export const jobScheduler = new JobScheduler();
