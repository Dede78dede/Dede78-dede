export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'IDLE' | 'BUSY' | 'OFFLINE';
  created_at: string;
}

export interface Job {
  id: string;
  agent_id: string | null;
  task_type: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  logs: string;
  created_at: string;
  updated_at: string;
}

/**
 * Service to interact with the Python backend agents and job queue.
 * Handles fetching agent status, creating jobs, and monitoring job progress.
 */
export class AgentService {
  /**
   * Recupera la lista degli agenti Python registrati nel sistema.
   */
  static async getAgents(): Promise<Agent[]> {
    const response = await fetch("/api/agents");
    if (!response.ok) throw new Error("Errore nel recupero degli agenti");
    const data = await response.json();
    return data.agents;
  }

  /**
   * Crea un nuovo Job asincrono (es. Training, Merging, Evaluation)
   * che verrà prelevato da un worker Python.
   */
  static async createJob(taskType: string, payload: any): Promise<string> {
    const response = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_type: taskType, payload })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Errore creazione job: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return data.jobId;
  }

  /**
   * Controlla lo stato di un Job specifico.
   * Utile per il polling dalla UI (Dashboard).
   */
  static async getJobStatus(jobId: string): Promise<Job> {
    const response = await fetch(`/api/jobs/${jobId}`);
    if (!response.ok) throw new Error("Errore nel recupero dello stato del job");
    const data = await response.json();
    return data.job;
  }

  /**
   * Recupera gli ultimi job.
   */
  static async getJobs(): Promise<Job[]> {
    const response = await fetch("/api/jobs");
    if (!response.ok) throw new Error("Errore nel recupero dei job");
    const data = await response.json();
    return data.jobs;
  }
}
