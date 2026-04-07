import React, { useMemo } from 'react';
import { Activity, Cpu, HardDrive, Network, CheckCircle2, Clock, AlertCircle, LucideIcon, Download, Plus, GitMerge, DownloadCloud } from 'lucide-react';
import { cn } from '../utils/cn';
import { AgentStatus, JobStatus, WorkflowStatus } from '../core/enums';
import { useDashboardLogic } from '../features/dashboard/hooks/useDashboardLogic';

/**
 * Dashboard page component.
 * Displays an overview of system resources, active agents, and pending jobs.
 * Provides actions to download the manifesto and create test jobs.
 */
export const Dashboard = React.memo(function Dashboard({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const {
    agents,
    jobs,
    workflows,
    isLoading,
    settings,
    handleDownloadManifesto,
    handleCreateTestJob
  } = useDashboardLogic();

  const pendingJobsCount = useMemo(() => jobs.filter(j => j.status === JobStatus.PENDING).length.toString(), [jobs]);
  const runningJobsCount = useMemo(() => jobs.filter(j => j.status === JobStatus.RUNNING).length.toString(), [jobs]);
  
  const completedWorkflowsCount = useMemo(() => jobs.filter(j => j.task_type === 'WORKFLOW' && j.status === JobStatus.COMPLETED).length.toString(), [jobs]);
  const runningWorkflowsCount = useMemo(() => jobs.filter(j => j.task_type === 'WORKFLOW' && j.status === JobStatus.RUNNING).length.toString(), [jobs]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Dashboard di Sistema</h2>
          <p className="text-zinc-400 mt-1">Panoramica dello stato degli agenti e delle risorse locali.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate && onNavigate('agents')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Network className="w-4 h-4" />
            Agenti & A2A
          </button>
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
        <StatCard icon={Activity} label="Job in Coda" value={pendingJobsCount} subtext={`${runningJobsCount} in esecuzione`} />
        <StatCard icon={GitMerge} label="Workflows" value={completedWorkflowsCount} subtext={`${runningWorkflowsCount} attivi`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agents Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-medium text-zinc-100">Agenti Specializzati</h3>
            <div className="flex items-center gap-3">
              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", settings.llmclEnabled ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-zinc-800 text-zinc-400")}>
                {settings.llmclEnabled ? 'LLM-CL Protocol Active' : 'LLM-CL Disabled'}
              </span>
            </div>
          </div>
          <div className="divide-y divide-zinc-800">
            {agents.length === 0 && !isLoading && (
              <div className="p-6 text-center text-zinc-500 text-sm">Nessun agente Python connesso.</div>
            )}
            {agents.map((agent) => (
              <div key={agent.id} className="p-6 flex items-center gap-6">
                <div className="flex-shrink-0">
                  {agent.status === AgentStatus.BUSY && <Clock className="w-6 h-6 text-emerald-500 animate-pulse" />}
                  {agent.status === AgentStatus.IDLE && <CheckCircle2 className="w-6 h-6 text-zinc-500" />}
                  {agent.status === AgentStatus.OFFLINE && <AlertCircle className="w-6 h-6 text-red-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-zinc-200">{agent.name}</h4>
                      <p className="text-sm text-zinc-400">Tipo: {agent.type}</p>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-md",
                      agent.status === AgentStatus.BUSY ? 'bg-emerald-500/10 text-emerald-400' :
                      agent.status === AgentStatus.OFFLINE ? 'bg-red-500/10 text-red-400' :
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
            <button 
              onClick={() => onNavigate && onNavigate('monitoring')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Vedi tutti
            </button>
          </div>
          <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto">
            {jobs.length === 0 && !isLoading && (
              <div className="p-6 text-center text-zinc-500 text-sm">Nessun job in coda.</div>
            )}
            {jobs.map((job) => (
              <div key={job.id} className="p-6 flex items-center gap-6">
                <div className="flex-shrink-0">
                  {job.status === JobStatus.RUNNING && <Clock className="w-6 h-6 text-emerald-500 animate-pulse" />}
                  {(job.status === JobStatus.PENDING || job.status === JobStatus.WAITING_FRONTEND || job.status === JobStatus.PENDING_FRONTEND) && <Activity className="w-6 h-6 text-zinc-500" />}
                  {job.status === JobStatus.COMPLETED && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
                  {job.status === JobStatus.FAILED && <AlertCircle className="w-6 h-6 text-red-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-zinc-200">{job.task_type}</h4>
                      <p className="text-xs text-zinc-500 font-mono mt-1">{job.id}</p>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-md",
                      job.status === JobStatus.RUNNING ? 'bg-emerald-500/10 text-emerald-400' :
                      job.status === JobStatus.COMPLETED ? 'bg-indigo-500/10 text-indigo-400' :
                      job.status === JobStatus.FAILED ? 'bg-red-500/10 text-red-400' :
                      job.status === JobStatus.WAITING_FRONTEND || job.status === JobStatus.PENDING_FRONTEND ? 'bg-blue-500/10 text-blue-400' :
                      'bg-zinc-800 text-zinc-400'
                    )}>
                      {job.status}
                    </span>
                  </div>
                  {(job.status === JobStatus.RUNNING || job.status === JobStatus.COMPLETED || job.status === JobStatus.WAITING_FRONTEND || job.status === JobStatus.PENDING_FRONTEND) && (
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3">
                      <div 
                        className={cn("h-1.5 rounded-full transition-all duration-500", job.status === JobStatus.COMPLETED ? 'bg-indigo-500' : 'bg-emerald-500')}
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflows List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-medium text-zinc-100">Workflows</h3>
            <button 
              onClick={() => onNavigate && onNavigate('workflows')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Vedi tutti
            </button>
          </div>
          <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto">
            {workflows.length === 0 && !isLoading && (
              <div className="p-6 text-center text-zinc-500 text-sm">Nessun workflow attivo.</div>
            )}
            {workflows.map((workflow) => (
              <div key={workflow.id} className="p-6 flex items-center gap-6">
                <div className="flex-shrink-0">
                  {workflow.status === WorkflowStatus.RUNNING && <Clock className="w-6 h-6 text-emerald-500 animate-pulse" />}
                  {workflow.status === WorkflowStatus.PENDING && <Activity className="w-6 h-6 text-zinc-500" />}
                  {workflow.status === WorkflowStatus.COMPLETED && <CheckCircle2 className="w-6 h-6 text-indigo-500" />}
                  {workflow.status === WorkflowStatus.FAILED && <AlertCircle className="w-6 h-6 text-red-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-zinc-200">{workflow.name}</h4>
                      <p className="text-xs text-zinc-500 font-mono mt-1">{workflow.id}</p>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded-md",
                      workflow.status === WorkflowStatus.RUNNING ? 'bg-emerald-500/10 text-emerald-400' :
                      workflow.status === WorkflowStatus.COMPLETED ? 'bg-indigo-500/10 text-indigo-400' :
                      workflow.status === WorkflowStatus.FAILED ? 'bg-red-500/10 text-red-400' :
                      'bg-zinc-800 text-zinc-400'
                    )}>
                      {workflow.status}
                    </span>
                  </div>
                  {workflow.total_steps !== undefined && workflow.total_steps > 0 && (
                    <div className="w-full mt-3">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>Progresso ({workflow.completed_steps}/{workflow.total_steps})</span>
                        <span>{Math.round((workflow.completed_steps! / workflow.total_steps) * 100)}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div 
                          className={cn("h-1.5 rounded-full transition-all duration-500", workflow.status === WorkflowStatus.COMPLETED ? 'bg-indigo-500' : workflow.status === WorkflowStatus.FAILED ? 'bg-red-500' : 'bg-emerald-500')}
                          style={{ width: `${(workflow.completed_steps! / workflow.total_steps) * 100}%` }}
                        ></div>
                      </div>
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
});

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string;
  subtext?: string;
}

const StatCard = React.memo(function StatCard({ icon: Icon, label, value, trend, subtext }: StatCardProps) {
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
});
