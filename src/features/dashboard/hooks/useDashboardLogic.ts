import { useState, useEffect } from 'react';
import { AgentService, Agent, Job } from '../../../services/agentService';
import { useSettings } from '../../../context/SettingsContext';
import { WorkflowStatus } from '../../../types/enums';
import { authenticatedFetch } from '../../../utils/api';
import { manifestoContent } from '../../../utils/manifesto';

export interface Workflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  global_context: string;
  created_at: string;
  updated_at: string;
  total_steps?: number;
  completed_steps?: number;
}

export function useDashboardLogic() {
  const { settings } = useSettings();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [agentsData, jobsData, workflowsRes] = await Promise.all([
        AgentService.getAgents(),
        AgentService.getJobs(),
        authenticatedFetch('/api/workflows')
      ]);
      const workflowsData = await workflowsRes.json();
      setAgents(agentsData);
      setJobs(jobsData);
      if (workflowsData.workflows) {
        setWorkflows(workflowsData.workflows);
      }
    } catch (error) {
      console.error("Errore recupero dati dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, settings.agentPollingInterval);
    return () => clearInterval(interval);
  }, [settings.agentPollingInterval]);

  const handleDownloadManifesto = () => {
    const blob = new Blob([manifestoContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SmarterRouter_Manifesto.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateTestJob = async () => {
    try {
      await AgentService.createJob('TRAINING', { dataset: 'test.md', epochs: 3 });
      fetchData();
    } catch (error) {
      alert("Errore creazione job");
    }
  };

  return {
    agents,
    jobs,
    workflows,
    isLoading,
    settings,
    handleDownloadManifesto,
    handleCreateTestJob
  };
}
