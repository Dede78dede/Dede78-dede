import React, { useState, useEffect } from 'react';
import { Plus, GitMerge, CheckCircle, XCircle, Clock, ArrowLeft, Trash2, Save, Activity } from 'lucide-react';
import { cn } from '../utils/cn';
import { WorkflowStatus, WorkflowStepStatus } from '../types/enums';
import { authenticatedFetch } from '../utils/api';

interface Workflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  global_context: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowStep {
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

export function Workflows() {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case WorkflowStatus.COMPLETED: return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case WorkflowStatus.FAILED: return <XCircle className="w-5 h-5 text-red-500" />;
      case WorkflowStatus.RUNNING: return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />;
      default: return <Clock className="w-5 h-5 text-zinc-500" />;
    }
  };

  if (isCreating) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCreating(false)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-white">Create Workflow</h1>
          </div>
          <button 
            onClick={handleCreateWorkflow}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Save & Run
          </button>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-1 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-lg font-medium text-white mb-4">General Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Workflow Name</label>
                  <input 
                    type="text" 
                    value={newWorkflowName}
                    onChange={(e) => setNewWorkflowName(e.target.value)}
                    placeholder="My Awesome Pipeline"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Global Context (JSON)</label>
                  <p className="text-xs text-zinc-500 mb-2">Initial variables available to all steps.</p>
                  <textarea 
                    value={newGlobalContext}
                    onChange={(e) => setNewGlobalContext(e.target.value)}
                    className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Pipeline Steps</h3>
              <button 
                onClick={addStep}
                className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Step
              </button>
            </div>

            <div className="space-y-4">
              {newSteps.map((step, index) => (
                <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 relative group">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => removeStep(index)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                      disabled={newSteps.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                      {index + 1}
                    </div>
                    <input 
                      type="text" 
                      value={step.name}
                      onChange={(e) => updateStep(index, 'name', e.target.value)}
                      className="bg-transparent border-none text-lg font-medium text-white focus:outline-none focus:ring-0 p-0"
                      placeholder="Step Name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Provider</label>
                      <select 
                        value={step.provider}
                        onChange={(e) => updateStep(index, 'provider', e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="groq">Groq</option>
                        <option value="deepseek">DeepSeek</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Model</label>
                      <input 
                        type="text" 
                        value={step.model}
                        onChange={(e) => updateStep(index, 'model', e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">System Prompt (Optional)</label>
                    <input 
                      type="text" 
                      value={step.systemPrompt}
                      onChange={(e) => updateStep(index, 'systemPrompt', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      placeholder="You are a helpful assistant..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Prompt Template</label>
                    <p className="text-[10px] text-zinc-500 mb-2">Use {'{{variable_name}}'} to inject context variables or previous step outputs.</p>
                    <textarea 
                      value={step.inputTemplate}
                      onChange={(e) => updateStep(index, 'inputTemplate', e.target.value)}
                      className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 font-mono text-sm focus:outline-none focus:border-emerald-500"
                      placeholder="Summarize this text: {{input}}"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedWorkflow) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setSelectedWorkflow(null)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              {selectedWorkflow.name}
              {getStatusIcon(selectedWorkflow.status)}
            </h1>
            <p className="text-sm text-zinc-500">ID: {selectedWorkflow.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <h3 className="text-lg font-medium text-white">Execution Steps</h3>
            {workflowSteps.length === 0 ? (
              <div className="text-zinc-500 text-sm">Loading steps...</div>
            ) : (
              <div className="space-y-4">
                {workflowSteps.map((step) => (
                  <div key={step.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                          {step.step_order}
                        </div>
                        <h4 className="text-md font-medium text-white">{step.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          {JSON.parse(step.model_config).provider} / {JSON.parse(step.model_config).model}
                        </span>
                        {getStatusIcon(step.status)}
                      </div>
                    </div>
                    
                    <div className="bg-zinc-950 rounded-lg p-3 mb-4">
                      <div className="text-xs font-medium text-zinc-500 mb-1">Prompt Template</div>
                      <div className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">{step.input_prompt_template}</div>
                    </div>

                    {step.output_result && (
                      <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
                        <div className="text-xs font-medium text-emerald-500/70 mb-1">Output Result</div>
                        <div className="text-sm text-emerald-100 whitespace-pre-wrap">{step.output_result}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="col-span-1 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Global Context (Live)</h3>
              <div className="bg-zinc-950 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs text-zinc-300 font-mono">
                  {JSON.stringify(JSON.parse(selectedWorkflow.global_context), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-emerald-500" />
            Workflows
          </h1>
          <p className="text-zinc-400 mt-1">Build and monitor multi-step LLM pipelines.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Activity className="w-8 h-8 text-emerald-500 animate-pulse" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <GitMerge className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No workflows yet</h3>
          <p className="text-zinc-400 mb-6">Create your first workflow to chain multiple LLM calls together.</p>
          <button 
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map(workflow => (
            <div 
              key={workflow.id}
              onClick={() => setSelectedWorkflow(workflow)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-emerald-500/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-medium text-white group-hover:text-emerald-400 transition-colors truncate pr-4">
                  {workflow.name}
                </h3>
                {getStatusIcon(workflow.status)}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Status</span>
                  <span className={cn(
                    "font-medium",
                    workflow.status === WorkflowStatus.COMPLETED ? "text-emerald-400" :
                    workflow.status === WorkflowStatus.FAILED ? "text-red-400" :
                    workflow.status === WorkflowStatus.RUNNING ? "text-blue-400" : "text-zinc-400"
                  )}>
                    {workflow.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Created</span>
                  <span className="text-zinc-300">
                    {new Date(workflow.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
