import db from '../db/database';
import { StrategyFactory, ModelConfig, WorkflowContext } from './ModelStrategies';

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  name: string;
  model_config: string;
  input_prompt_template: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  output_result: string | null;
  retry_count: number;
}

export interface Workflow {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  global_context: string;
}

export class WorkflowEngine {
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
    db.prepare('UPDATE workflow_steps SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('RUNNING', stepId);
    db.prepare('UPDATE workflows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('RUNNING', workflow.id);

    try {
      const context: WorkflowContext = JSON.parse(workflow.global_context || '{}');
      const config: ModelConfig = JSON.parse(step.model_config);

      // Interpolate prompt
      const prompt = this.interpolatePrompt(step.input_prompt_template, context);

      // Get strategy and execute
      const strategy = StrategyFactory.getStrategy(config.provider);
      const result = await strategy.execute(prompt, config, context);

      // Update context with the result of this step
      // We store it under the step's name to make it accessible to future steps
      context[step.name] = result;

      // Save result and updated context
      db.prepare('UPDATE workflow_steps SET status = ?, output_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('COMPLETED', result, stepId);
      
      db.prepare('UPDATE workflows SET global_context = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(context), workflow.id);

      // console.log(`[WorkflowEngine] Step ${step.name} (${stepId}) completed successfully.`);

    } catch (error: any) {
      console.error(`[WorkflowEngine] Step ${step.name} (${stepId}) failed:`, error);
      
      const newRetryCount = step.retry_count + 1;
      const newStatus = newRetryCount >= 3 ? 'FAILED' : 'PENDING'; // Retry up to 3 times
      
      db.prepare('UPDATE workflow_steps SET status = ?, retry_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newStatus, newRetryCount, stepId);

      if (newStatus === 'FAILED') {
        db.prepare('UPDATE workflows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('FAILED', workflow.id);
        throw error; // Only throw if we've exhausted retries
      }
    }
  }

  /**
   * Finds the next pending step for a given workflow and executes it.
   */
  public async processNextStep(workflowId: string): Promise<boolean> {
    const nextStep = db.prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? AND status = ? ORDER BY step_order ASC LIMIT 1')
      .get(workflowId, 'PENDING') as WorkflowStep | undefined;

    if (nextStep) {
      await this.executeStep(nextStep.id);
      return true; // More steps might exist
    } else {
      // Check if any steps failed
      const failedSteps = db.prepare('SELECT count(*) as count FROM workflow_steps WHERE workflow_id = ? AND status = ?')
        .get(workflowId, 'FAILED') as { count: number };
        
      if (failedSteps.count === 0) {
        db.prepare('UPDATE workflows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('COMPLETED', workflowId);
        // console.log(`[WorkflowEngine] Workflow ${workflowId} completed successfully.`);
      }
      return false; // No more pending steps
    }
  }
}

export const workflowEngine = new WorkflowEngine();
