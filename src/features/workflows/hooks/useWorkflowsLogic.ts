import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../../../utils/api';
import { WorkflowStatus, WorkflowStepStatus } from '../../../types/enums';

export interface Workflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  global_context: string;
  created_at: string;
  updated_at: string;
}

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
  created_at: string;
  updated_at: string;
}

export function useWorkflowsLogic() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Builder State
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newGlobalContext, setNewGlobalContext] = useState('{\n  "input": "Hello World"\n}');
  const [newSteps, setNewSteps] = useState([{
    name: 'step1',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    systemPrompt: '',
    temperature: 0.7,
    inputTemplate: 'Translate to Italian: {{input}}'
  }]);

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      fetchWorkflowSteps(selectedWorkflow.id);
      const interval = setInterval(() => fetchWorkflowSteps(selectedWorkflow.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedWorkflow]);

  const fetchWorkflows = async () => {
    try {
      const res = await authenticatedFetch('/api/workflows');
      const data = await res.json();
      if (data.workflows) {
        setWorkflows(data.workflows);
      }
    } catch (err) {
      console.error('Failed to fetch workflows', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkflowSteps = async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/workflows/${id}/steps`);
      const data = await res.json();
      if (data.steps) {
        setWorkflowSteps(data.steps);
      }
    } catch (err) {
      console.error('Failed to fetch workflow steps', err);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      let parsedContext = {};
      try {
        parsedContext = JSON.parse(newGlobalContext);
      } catch (e) {
        alert('Global Context must be valid JSON');
        return;
      }

      const payload = {
        name: newWorkflowName || 'Untitled Workflow',
        global_context: parsedContext,
        steps: newSteps.map(s => ({
          name: s.name,
          model_config: {
            provider: s.provider,
            model: s.model,
            systemPrompt: s.systemPrompt || undefined,
            temperature: s.temperature
          },
          input_prompt_template: s.inputTemplate
        }))
      };

      const res = await authenticatedFetch('/api/workflows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setIsCreating(false);
        setNewWorkflowName('');
        setNewGlobalContext('{\n  "input": "Hello World"\n}');
        setNewSteps([{
          name: 'step1',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          systemPrompt: '',
          temperature: 0.7,
          inputTemplate: 'Translate to Italian: {{input}}'
        }]);
        fetchWorkflows();
      } else {
        alert('Failed to create workflow: ' + data.error);
      }
    } catch (err) {
      console.error('Error creating workflow', err);
      alert('Error creating workflow');
    }
  };

  const addStep = () => {
    setNewSteps([...newSteps, {
      name: `step${newSteps.length + 1}`,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      systemPrompt: '',
      temperature: 0.7,
      inputTemplate: ''
    }]);
  };

  const removeStep = (index: number) => {
    setNewSteps(newSteps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const updated = [...newSteps];
    updated[index] = { ...updated[index], [field]: value };
    setNewSteps(updated);
  };

  const handleBootstrapAgents = async () => {
    try {
      setIsLoading(true);
      // Create Jules Agent Workflow
      const julesPayload = {
        name: 'Jules Agent - Code Review',
        global_context: {
          "code_snippet": "function add(a, b) { return a + b; }",
          "language": "javascript"
        },
        steps: [
          {
            name: 'analyze_code',
            model_config: {
              provider: 'gemini',
              model: 'gemini-2.5-flash',
              systemPrompt: 'You are Jules, an expert code reviewer. Analyze the provided code snippet for potential bugs, performance issues, and style improvements.',
              temperature: 0.2
            },
            input_prompt_template: 'Language: {{language}}\nCode:\n{{code_snippet}}\n\nPlease provide a detailed review.'
          },
          {
            name: 'generate_report',
            model_config: {
              provider: 'gemini',
              model: 'gemini-2.5-flash',
              systemPrompt: 'You are Jules. Summarize the code review into a concise markdown report.',
              temperature: 0.4
            },
            input_prompt_template: 'Based on this analysis:\n{{analyze_code}}\n\nGenerate a final markdown report.'
          }
        ]
      };

      // Create Antigravity Agent Workflow
      const antigravityPayload = {
        name: 'Antigravity Agent - System Optimization',
        global_context: {
          "system_metrics": "CPU: 85%, RAM: 90%, Disk: 45%",
          "target_performance": "CPU < 60%, RAM < 70%"
        },
        steps: [
          {
            name: 'diagnose_bottlenecks',
            model_config: {
              provider: 'gemini',
              model: 'gemini-3.1-pro-preview',
              systemPrompt: 'You are Antigravity, an advanced system optimization AI. Diagnose performance bottlenecks based on system metrics.',
              temperature: 0.1
            },
            input_prompt_template: 'Current Metrics: {{system_metrics}}\nTarget: {{target_performance}}\n\nIdentify the primary bottlenecks and suggest immediate actions.'
          }
        ]
      };

      await authenticatedFetch('/api/workflows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(julesPayload)
      });

      await authenticatedFetch('/api/workflows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(antigravityPayload)
      });

      await fetchWorkflows();
      alert('Agents Jules and Antigravity bootstrapped successfully!');
    } catch (err) {
      console.error('Error bootstrapping agents', err);
      alert('Error bootstrapping agents');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    workflows,
    selectedWorkflow,
    setSelectedWorkflow,
    workflowSteps,
    isCreating,
    setIsCreating,
    isLoading,
    newWorkflowName,
    setNewWorkflowName,
    newGlobalContext,
    setNewGlobalContext,
    newSteps,
    handleCreateWorkflow,
    addStep,
    removeStep,
    updateStep,
    handleBootstrapAgents
  };
}
