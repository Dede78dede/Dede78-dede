import { useState, useEffect } from 'react';
import { metricsService, MetricEvent } from '../../../services/MetricsService';

export function useMonitoringLogic() {
  const [metrics, setMetrics] = useState<MetricEvent[]>([]);

  useEffect(() => {
    setMetrics(metricsService.getMetrics());
    const unsubscribe = metricsService.subscribe(() => {
      setMetrics([...metricsService.getMetrics()]);
    });
    return unsubscribe;
  }, []);

  const latencyEvents = metrics.filter(m => m.type === 'latency').slice(-10);
  const latencyData = latencyEvents.map(m => {
    const d = new Date(m.timestamp);
    return {
      time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      local: m.data.local || 0,
      master: m.data.master || 0
    };
  });

  const cacheEvents = metrics.filter(m => m.type === 'cache');
  const hits = cacheEvents.filter(m => m.data.hit).length;
  const misses = cacheEvents.filter(m => !m.data.hit).length;
  const totalCache = hits + misses || 1; // prevent div by zero
  
  const cacheData = [
    { name: 'Cache Hit', value: Math.round((hits / totalCache) * 100) },
    { name: 'Cache Miss', value: Math.round((misses / totalCache) * 100) },
  ];

  const tokenEvents = metrics.filter(m => m.type === 'token');
  const totalTokensSaved = tokenEvents.reduce((acc, m) => acc + ((m.data.saved as number) || 0), 0);
  const tokenSavingsPercent = hits > 0 ? Math.min(99, Math.round((hits / totalCache) * 100)) : 0;

  const auditEvents = metrics.filter(m => m.type === 'audit').reverse().slice(0, 10); // Show last 10 requests

  return {
    latencyData,
    cacheData,
    totalTokensSaved,
    tokenSavingsPercent,
    auditEvents
  };
}
