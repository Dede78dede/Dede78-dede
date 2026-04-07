import { StrategyFactory, ModelConfig, WorkflowContext } from './ModelStrategies';
import { EventEmitter } from 'events';
import { WorkflowStatus, WorkflowStepStatus, ModelProvider } from '../core/enums';
import { firestoreDb } from '../db/firestore';
import admin from 'firebase-admin';

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  name: string;
  model_config: string;
  input_prompt_template: string;
  status: WorkflowStepStatus;
  output_result: string | null;
  retry_count: number;
}

export interface Workflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  global_context: string;
}

export class WorkflowEngine extends EventEmitter {
  private interpolatePrompt(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return context[trimmedKey] !== undefined ? String(context[trimmedKey]) : match;
    });
  }

  public async executeStep(stepId: string): Promise<void> {
    const stepSnapshot = await firestoreDb.collectionGroup('steps').where('id', '==', stepId).limit(1).get();
    if (stepSnapshot.empty) throw new Error(`Step ${stepId} not found`);
    const stepDoc = stepSnapshot.docs[0];
    const step = { id: stepDoc.id, ...stepDoc.data() } as any as WorkflowStep;

    const workflowDoc = await firestoreDb.collection('workflows').doc(step.workflow_id).get();
    if (!workflowDoc.exists) throw new Error(`Workflow ${step.workflow_id} not found`);
    const workflow = { id: workflowDoc.id, ...workflowDoc.data() } as any as Workflow;

    await stepDoc.ref.update({
      status: WorkflowStepStatus.RUNNING,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await workflowDoc.ref.update({
      status: WorkflowStatus.RUNNING,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    try {
      const context: WorkflowContext = JSON.parse(workflow.global_context || '{}');
      const config: ModelConfig = JSON.parse(step.model_config);

      const prompt = this.interpolatePrompt(step.input_prompt_template, context);
      const strategy = StrategyFactory.getStrategy(config.provider);
      
      if (config.provider === ModelProvider.GOOGLE) {
        await stepDoc.ref.update({
          status: WorkflowStepStatus.PENDING_FRONTEND,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        this.emit('pending_frontend');
        return;
      }

      if (config.provider === ModelProvider.OPENAI) config.apiKey = process.env.OPENAI_API_KEY;
      if (config.provider === ModelProvider.ANTHROPIC) config.apiKey = process.env.ANTHROPIC_API_KEY;
      if (config.provider === ModelProvider.GROQ) config.apiKey = process.env.GROQ_API_KEY;
      if (config.provider === ModelProvider.DEEPSEEK) config.apiKey = process.env.DEEPSEEK_API_KEY;

      const result = await strategy.execute(prompt, config, context);

      context[step.name] = result;

      await stepDoc.ref.update({
        status: WorkflowStepStatus.COMPLETED,
        outputResult: result,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await workflowDoc.ref.update({
        globalContext: JSON.stringify(context),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error: unknown) {
      console.error(`[WorkflowEngine] Step ${step.name} (${stepId}) failed:`, error);
      
      const newRetryCount = (step.retry_count || 0) + 1;
      const newStatus = newRetryCount >= 3 ? WorkflowStepStatus.FAILED : WorkflowStepStatus.PENDING;
      
      await stepDoc.ref.update({
        status: newStatus,
        retryCount: newRetryCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (newStatus === WorkflowStepStatus.FAILED) {
        await workflowDoc.ref.update({
          status: WorkflowStatus.FAILED,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        throw error;
      }
    }
  }

  public async processNextStep(workflowId: string): Promise<boolean> {
    const activeStepsSnapshot = await firestoreDb.collection('workflows').doc(workflowId).collection('steps')
      .where('status', 'in', [WorkflowStepStatus.RUNNING, WorkflowStepStatus.PENDING_FRONTEND])
      .get();
    
    if (!activeStepsSnapshot.empty) {
      return false;
    }

    const nextStepSnapshot = await firestoreDb.collection('workflows').doc(workflowId).collection('steps')
      .where('status', '==', WorkflowStepStatus.PENDING)
      .orderBy('stepOrder', 'asc')
      .limit(1)
      .get();

    if (!nextStepSnapshot.empty) {
      const nextStep = nextStepSnapshot.docs[0].data();
      await this.executeStep(nextStep.id);
      
      const currentStepDoc = await firestoreDb.collection('workflows').doc(workflowId).collection('steps').doc(nextStepSnapshot.docs[0].id).get();
      const currentStepStatus = currentStepDoc.data()?.status;
      
      if (currentStepStatus === WorkflowStepStatus.PENDING_FRONTEND) {
        return false;
      }
      return true;
    }

    const failedStepsSnapshot = await firestoreDb.collection('workflows').doc(workflowId).collection('steps')
      .where('status', '==', WorkflowStepStatus.FAILED)
      .get();

    if (failedStepsSnapshot.empty) {
      await firestoreDb.collection('workflows').doc(workflowId).update({
        status: WorkflowStatus.COMPLETED,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return false;
  }
}

export const workflowEngine = new WorkflowEngine();
