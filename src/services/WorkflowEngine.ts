import db from '../db/database';
import { StrategyFactory, ModelConfig, WorkflowContext } from './ModelStrategies';
import { EventEmitter } from 'events';
import { WorkflowStatus, WorkflowStepStatus, ModelProvider } from '../types/enums';

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
  /**
   * Replaces variables in the template with values from the context.
   * e.g., "Translate {{text}}" with context { text: "Hello" } -> "Translate Hello"
   */
  private interpolatePrompt(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return context[trimmedKey] !== undefined ? String(context[trimmedKey]) : match;
    });
  }

  /**
   * Executes a single step in the workflow.
   */
  public async executeStep(stepId: string): Promise<void> {
    const step = db.prepare('SELECT * FROM workflow_steps WHERE id = ?').get(stepId) as WorkflowStep | undefined;
    if (!step) throw new Error(`Step ${stepId} not found`);

    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(step.workflow_id) as Workflow | undefined;
    if (!workflow) throw new Error(`Workflow ${step.workflow_id} not found`);

    // Update step status to RUNNING
    db.prepare('UPDATE workflow_steps SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(WorkflowStepStatus.RUNNING, stepId);
    db.prepare('UPDATE workflows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(WorkflowStatus.RUNNING, workflow.id);

    try {
      const context: WorkflowContext = JSON.parse(workflow.global_context || '{}');
      const config: ModelConfig = JSON.parse(step.model_config);

      // Interpolate prompt
      const prompt = this.interpolatePrompt(step.input_prompt_template, context);

      // Get strategy and execute
      const strategy = StrategyFactory.getStrategy(config.provider);
      
      if (config.provider === ModelProvider.GEMINI) {
        db.prepare('UPDATE workflow_steps SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(WorkflowStepStatus.PENDING_FRONTEND, stepId);
        this.emit('pending_frontend');
        return; // Stop execution, frontend worker will pick it up
      }

      // Inject API keys from environment variables
      if (config.provider === ModelProvider.OPENAI) config.apiKey = process.env.OPENAI_API_KEY;
      if (config.provider === ModelProvider.ANTHROPIC) config.apiKey = process.env.ANTHROPIC_API_KEY;
      if (config.provider === ModelProvider.GROQ) config.apiKey = process.env.GROQ_API_KEY;
      if (config.provider === ModelProvider.DEEPSEEK) config.apiKey = process.env.DEEPSEEK_API_KEY;

      const result = await strategy.execute(prompt, config, context);

      // Update context with the result of this step
      // We store it under the step's name to make it accessible to future steps
      context[step.name] = result;

      // Save result and updated context
      db.prepare('UPDATE workflow_steps SET status = ?, output_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(WorkflowStepStatus.COMPLETED, result, stepId);
      
      db.prepare('UPDATE workflows SET global_context = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(context), workflow.id);

      // console.log(`[WorkflowEngine] Step ${step.name} (${stepId}) completed successfully.`);

    } catch (error: unknown) {
      console.error(`[WorkflowEngine] Step ${step.name} (${stepId}) failed:`, error);
      
      const newRetryCount = step.retry_count + 1;
      const newStatus = newRetryCount >= 3 ? WorkflowStepStatus.FAILED : WorkflowStepStatus.PENDING; // Retry up to 3 times
      
      db.prepare('UPDATE workflow_steps SET status = ?, retry_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newStatus, newRetryCount, stepId);

      if (newStatus === WorkflowStepStatus.FAILED) {
        db.prepare('UPDATE workflows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(WorkflowStatus.FAILED, workflow.id);
        throw error; // Only throw if we've exhausted retries
      }
    }
  }

  /**
   * Finds the next pending step for a given workflow and executes it.
   */
  public async processNextStep(workflowId: string): Promise<boolean> {
    // Check if any steps are currently running or waiting for frontend
    const activeSteps = db.prepare('SELECT count(*) as count FROM workflow_steps WHERE workflow_id = ? AND status IN (?, ?)')
      .get(workflowId, WorkflowStepStatus.RUNNING, WorkflowStepStatus.PENDING_FRONTEND) as { count: number };
      
    if (activeSteps.count > 0) {
      // Wait for active steps to finish before proceeding
      return false;
    }

    const nextStep = db.prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? AND status = ? ORDER BY step_order ASC LIMIT 1')
      .get(workflowId, WorkflowStepStatus.PENDING) as WorkflowStep | undefined;

    if (nextStep) {
      await this.executeStep(nextStep.id);
      
      // After executing, if the step became PENDING_FRONTEND, we should stop processing further steps for now
      const currentStepStatus = db.prepare('SELECT status FROM workflow_steps WHERE id = ?').get(nextStep.id) as { status: string };
      if (currentStepStatus && currentStepStatus.status === WorkflowStepStatus.PENDING_FRONTEND) {
        return false;
      }
      
      return true; // More steps might exist and can be processed
    } else {
      // Check if any steps failed
      const failedSteps = db.prepare('SELECT count(*) as count FROM workflow_steps WHERE workflow_id = ? AND status = ?')
        .get(workflowId, WorkflowStepStatus.FAILED) as { count: number };
        
      if (failedSteps.count === 0) {
        db.prepare('UPDATE workflows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(WorkflowStatus.COMPLETED, workflowId);
        // console.log(`[WorkflowEngine] Workflow ${workflowId} completed successfully.`);
      }
      return false; // No more pending steps
    }
  }
}

export const workflowEngine = new WorkflowEngine();
