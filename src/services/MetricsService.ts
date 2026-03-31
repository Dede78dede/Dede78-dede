export interface AuditTrailStep {
  component: string;
  action: string;
  durationMs?: number;
  details?: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

export interface MetricEvent {
  timestamp: number;
  type: 'latency' | 'cache' | 'token' | 'audit';
  data: Record<string, unknown>;
}

/**
 * Service to record and provide real-time metrics for the application.
 * Tracks latency, cache hits/misses, and token savings.
 * Uses a simple publish-subscribe pattern to notify components of updates.
 */
class MetricsService {
  private events: MetricEvent[] = [];
  private listeners: (() => void)[] = [];
  private readonly MAX_EVENTS = 1000;

  constructor() {
    // Carica dati mockati iniziali per avere qualcosa da mostrare
    const now = Date.now();
    for (let i = 5; i >= 0; i--) {
      this.events.push({
        timestamp: now - i * 5 * 60000,
        type: 'latency',
        data: { local: 120 + Math.random() * 30, master: 850 + Math.random() * 200 }
      });
    }
    this.events.push({ timestamp: now, type: 'cache', data: { hit: true } });
    this.events.push({ timestamp: now, type: 'cache', data: { hit: false } });
    this.events.push({ timestamp: now, type: 'token', data: { saved: 150 } });
  }

  /**
   * Records a latency event for either a local or master model execution.
   * @param localMs Latency in milliseconds for local model, or null if not applicable.
   * @param masterMs Latency in milliseconds for master model, or null if not applicable.
   */
  recordLatency(localMs: number | null, masterMs: number | null) {
    this.events.push({ timestamp: Date.now(), type: 'latency', data: { local: localMs, master: masterMs } });
    this.notify();
  }

  /**
   * Records a cache hit or miss event.
   * @param hit True if the result was served from cache, false otherwise.
   */
  recordCache(hit: boolean) {
    this.events.push({ timestamp: Date.now(), type: 'cache', data: { hit } });
    this.notify();
  }

  /**
   * Records the estimated number of tokens saved by using cache or LLM-CL.
   * @param saved The number of tokens saved.
   */
  recordTokens(saved: number) {
    this.events.push({ timestamp: Date.now(), type: 'token', data: { saved } });
    this.notify();
  }

  /**
   * Records an audit trail event for a specific request.
   * @param requestId A unique identifier for the request.
   * @param steps An array of steps taken during the request.
   */
  recordAuditTrail(requestId: string, steps: AuditTrailStep[]) {
    this.events.push({ timestamp: Date.now(), type: 'audit', data: { requestId, steps } });
    this.notify();
  }

  /**
   * Returns all recorded metric events.
   */
  getMetrics() {
    return this.events;
  }

  /**
   * Subscribes to metric updates.
   * @param listener A callback function to be invoked when metrics change.
   * @returns An unsubscribe function.
   */
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
    this.listeners.forEach(l => l());
  }
}

export const metricsService = new MetricsService();
