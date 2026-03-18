import db from '../db/database';
import { EventEmitter } from 'events';
import { workflowEngine } from './WorkflowEngine';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

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
    // console.log(`[JobScheduler] Started polling every ${intervalMs}ms`);
    this.intervalId = setInterval(() => this.poll(), intervalMs);
    this.poll(); // Initial poll
  }

  public stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // console.log('[JobScheduler] Stopped polling');
  }

  private async poll() {
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return; // Max capacity reached
    }

    try {
      // Find a pending job
      const stmt = db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC LIMIT 1');
      const job = stmt.get('PENDING') as Job | undefined;

      if (job) {
        this.executeJob(job);
      }
    } catch (error) {
      console.error('[JobScheduler] Error polling jobs:', error);
    }
  }

  private async executeJob(job: Job) {
    // console.log(`[JobScheduler] Starting job ${job.id} (${job.task_type})`);
    
    // Mark as running
    this.updateJobStatus(job.id, 'RUNNING', 0, 'Job started');

    const jobPromise = this.processTask(job)
      .then(() => {
        // console.log(`[JobScheduler] Job ${job.id} completed successfully`);
        // Don't overwrite logs if processTask already set them to COMPLETED
        const currentJob = db.prepare('SELECT status, logs FROM jobs WHERE id = ?').get(job.id) as Job;
        if (currentJob && currentJob.status !== 'COMPLETED' && currentJob.status !== 'FAILED') {
          this.updateJobStatus(job.id, 'COMPLETED', 100, currentJob.logs + '\nJob completed successfully');
        }
      })
      .catch((error) => {
        console.error(`[JobScheduler] Job ${job.id} failed:`, error);
        const currentJob = db.prepare('SELECT logs FROM jobs WHERE id = ?').get(job.id) as Job;
        const logs = currentJob ? currentJob.logs + `\nError: ${error.message}` : `Error: ${error.message}`;
        this.updateJobStatus(job.id, 'FAILED', job.progress, logs);
      })
      .finally(() => {
        this.activeJobs.delete(job.id);
        this.poll(); // Check for more jobs immediately after one finishes
      });

    this.activeJobs.set(job.id, jobPromise);
  }

  private async processTask(job: Job): Promise<void> {
    // Parse payload
    let payload: any = {};
    try {
      if (job.payload) {
        payload = JSON.parse(job.payload);
      }
    } catch (e) {
      console.error(`[JobScheduler] Failed to parse payload for job ${job.id}`);
    }

    // Simulate task processing based on type
    switch (job.task_type) {
      case 'WORKFLOW':
        if (payload.workflow_id) {
          await this.processWorkflow(payload.workflow_id, job.id);
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
        await this.simulateLongTask(job.id, 15000, 'Evaluating model performance...');
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

  private async processWorkflow(workflowId: string, jobId: string) {
    let hasMoreSteps = true;
    let currentLogs = `Starting workflow ${workflowId}...\n`;
    this.updateJobStatus(jobId, 'RUNNING', 0, currentLogs);

    while (hasMoreSteps) {
      try {
        hasMoreSteps = await workflowEngine.processNextStep(workflowId);
        if (hasMoreSteps) {
          currentLogs += `Step completed. Checking for next step...\n`;
          this.updateJobStatus(jobId, 'RUNNING', 50, currentLogs); // Update progress based on steps completed
        }
      } catch (error: any) {
        currentLogs += `Workflow failed: ${error.message}\n`;
        this.updateJobStatus(jobId, 'FAILED', 100, currentLogs);
        throw error; // Re-throw to mark job as failed
      }
    }
    
    // Check if workflow actually failed (e.g. all retries exhausted)
    const workflow = db.prepare('SELECT status FROM workflows WHERE id = ?').get(workflowId) as { status: string };
    if (workflow && workflow.status === 'FAILED') {
      currentLogs += `Workflow ${workflowId} finished with FAILED status.\n`;
      this.updateJobStatus(jobId, 'FAILED', 100, currentLogs);
      throw new Error(`Workflow ${workflowId} failed`);
    } else {
      currentLogs += `Workflow ${workflowId} finished successfully.\n`;
      this.updateJobStatus(jobId, 'COMPLETED', 100, currentLogs);
    }
  }

  private async simulateLongTask(jobId: string, durationMs: number, initialLog: string) {
    const steps = 10;
    const stepDuration = durationMs / steps;
    
    let currentLogs = initialLog + '\n';
    this.updateJobStatus(jobId, 'RUNNING', 0, currentLogs);

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      const progress = Math.floor((i / steps) * 100);
      currentLogs += `Step ${i}/${steps} completed (${progress}%)\n`;
      this.updateJobStatus(jobId, 'RUNNING', progress, currentLogs);
    }
  }

  private updateJobStatus(id: string, status: JobStatus, progress: number, newLogs: string) {
    try {
      const stmt = db.prepare('UPDATE jobs SET status = ?, progress = ?, logs = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(status, progress, newLogs, id);
      this.emit('jobUpdated', { id, status, progress });
    } catch (error) {
      console.error(`[JobScheduler] Failed to update job ${id}:`, error);
    }
  }
}

// Export a singleton instance
export const jobScheduler = new JobScheduler();
