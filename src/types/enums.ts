export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PENDING_FRONTEND = 'PENDING_FRONTEND',
  WAITING_FRONTEND = 'WAITING_FRONTEND'
}

export enum AgentStatus {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE'
}

export enum WorkflowStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum WorkflowStepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PENDING_FRONTEND = 'PENDING_FRONTEND'
}

export enum MetricType {
  LATENCY = 'latency',
  CACHE = 'cache',
  TOKEN = 'token',
  AUDIT = 'audit'
}

export enum ModelProvider {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GROQ = 'groq',
  DEEPSEEK = 'deepseek'
}
