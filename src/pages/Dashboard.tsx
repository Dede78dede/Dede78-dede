import { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Network, CheckCircle2, Clock, AlertCircle, LucideIcon, Download, Plus, GitMerge, DownloadCloud } from 'lucide-react';
import { cn } from '../utils/cn';
import { manifestoContent } from '../utils/manifesto';
import { AgentService, Agent, Job } from '../services/agentService';
import { useSettings } from '../context/SettingsContext';

/**
 * Dashboard page component.
 * Displays an overview of system resources, active agents, and pending jobs.
 * Provides actions to download the manifesto and create test jobs.
 */
export function Dashboard({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { settings } = useSettings();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetches the latest agent and job data from the AgentService.
   */
  const fetchData = async () => {
    try {
      const [agentsData, jobsData] = await Promise.all([
        AgentService.getAgents(),
        AgentService.getJobs()
      ]);
      setAgents(agentsData);
      setJobs(jobsData);
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

  /**
   * Handles downloading the SmarterRouter manifesto as a markdown file.
   */
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

  /**
   * Creates a test job to simulate agent activity.
   */
  const handleCreateTestJob = async () => {
    try {
      await AgentService.createJob('TRAINING', { dataset: 'test.md', epochs: 3 });
      fetchData();
    } catch (error) {
      alert("Errore creazione job");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Dashboard di Sistema</h2>
          <p className="text-zinc-400 mt-1">Panoramica dello stato degli agenti e delle risorse locali.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate && onNavigate('models')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-lg text-sm font-medium transition-colors"
          >
            <DownloadCloud className="w-4 h-4" />
            Scarica Modello
          </button>
          <button
            onClick={handleCreateTestJob}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
          >
            <Plus className="w-4 h-4" />
            Test Job
          </button>
          <button
            onClick={handleDownloadManifesto}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Manifesto
          </button>
        </div>
      </header>

      {/* Resource Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard icon={Cpu} label="CPU Usage" value="42%" trend="+5%" />
        <StatCard icon={HardDrive} label="VRAM (RTX 4090)" value="18.4 / 24 GB" trend="76%" />
        <StatCard icon={Network} label="SmarterRouter" value="Online" subtext={`${agents.length} agenti attivi`} />
        <StatCard icon={Activity} label="Job in Coda" value={jobs.filter(j => j.status === 'PENDING').length.toString()} subtext={`${jobs.filter(j => j.status === 'RUNNING').length} in esecuzione`} />
        <StatCard icon={GitMerge} label="Workflows" value={jobs.filter(j => j.task_type === 'WORKFLOW' && j.status === 'COMPLETED').length.toString()} subtext={`${jobs.filter(j => j.task_type === 'WORKFLOW' && j.status === 'RUNNING').length} attivi`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agents Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-medium text-zinc-100">Agenti Specializzati</h3>
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", settings.llmclEnabled ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-zinc-800 text-zinc-400")}>
              {settings.llmclEnabled ? 'LLM-CL Protocol Active' : 'LLM-CL Disabled'}
            </span>
          </div>
          <div className="divide-y divide-zinc-800">
            {agents.length === 0 && !isLoading && (
              <div className="p-6 text-center text-zinc-500 text-sm">Nessun agente Python connesso.</div>
            )}
            {agents.map((agent) => (
              <div key={agent.id} className="p-6 flex items-center gap-6">
                <div className="flex-shrink-0">
                  {agent.status === 'BUSY' && <Clock className="w-6 h-6 text-emerald-500 animate-pulse" />}
                  {agent.status === 'IDLE' && <CheckCircle2 className="w-6 h-6 text-zinc-500" />}
                  {agent.status === 'OFFLINE' && <AlertCircle className="w-6 h-6 text-red-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-zinc-200">{agent.name}</h4>
                      <p className="text-sm text-zinc-400">Tipo: {agent.type}</p>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-md",
                      agent.status === 'BUSY' ? 'bg-emerald-500/10 text-emerald-400' :
                      agent.status === 'OFFLINE' ? 'bg-red-500/10 text-red-400' :
                      'bg-zinc-800 text-zinc-400'
                    )}>
                      {agent.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Jobs List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-medium text-zinc-100">Code di Lavoro (Jobs)</h3>
          </div>
          <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto">
            {jobs.length === 0 && !isLoading && (
              <div className="p-6 text-center text-zinc-500 text-sm">Nessun job in coda.</div>
            )}
            {jobs.map((job) => (
              <div key={job.id} className="p-6 flex items-center gap-6">
                <div className="flex-shrink-0">
                  {job.status === 'RUNNING' && <Clock className="w-6 h-6 text-emerald-500 animate-pulse" />}
                  {job.status === 'PENDING' && <Activity className="w-6 h-6 text-zinc-500" />}
                  {job.status === 'COMPLETED' && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
                  {job.status === 'FAILED' && <AlertCircle className="w-6 h-6 text-red-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-zinc-200">{job.task_type}</h4>
                      <p className="text-xs text-zinc-500 font-mono mt-1">{job.id}</p>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-md",
                      job.status === 'RUNNING' ? 'bg-emerald-500/10 text-emerald-400' :
                      job.status === 'COMPLETED' ? 'bg-indigo-500/10 text-indigo-400' :
                      job.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                      'bg-zinc-800 text-zinc-400'
                    )}>
                      {job.status}
                    </span>
                  </div>
                  {(job.status === 'RUNNING' || job.status === 'COMPLETED') && (
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3">
                      <div 
                        className={cn("h-1.5 rounded-full transition-all duration-500", job.status === 'COMPLETED' ? 'bg-indigo-500' : 'bg-emerald-500')}
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string;
  subtext?: string;
}

function StatCard({ icon: Icon, label, value, trend, subtext }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-3 text-zinc-400 mb-3">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-zinc-100">{value}</span>
        {trend && <span className="text-sm text-emerald-400">{trend}</span>}
        {subtext && <span className="text-sm text-zinc-500">{subtext}</span>}
      </div>
    </div>
  );
}
