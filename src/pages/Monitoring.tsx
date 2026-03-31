import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AuditTrailStep } from '../services/MetricsService';
import { Activity, CheckCircle2, AlertCircle, Info, Clock } from 'lucide-react';
import { useMonitoringLogic } from '../features/monitoring/hooks/useMonitoringLogic';

/**
 * Monitoring page component.
 * Displays real-time metrics for the SmarterRouter system, including
 * latency comparisons (Local vs Cloud), semantic cache performance,
 * and estimated token savings.
 */
export function Monitoring() {
  const {
    latencyData,
    cacheData,
    totalTokensSaved,
    tokenSavingsPercent,
    auditEvents
  } = useMonitoringLogic();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-zinc-100">Monitoraggio SmarterRouter</h2>
        <p className="text-zinc-400 mt-1">Metriche in tempo reale su latenza, cache e utilizzo token.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-medium text-zinc-200 mb-6">Latenza Media (ms)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                  itemStyle={{ color: '#e4e4e7' }}
                />
                <Line type="monotone" dataKey="local" name="Modelli Locali" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="master" name="Master (Gemini)" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cache Performance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-medium text-zinc-200 mb-6">Semantic Cache Performance (%)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cacheData} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#27272a' }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Token Savings */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 lg:col-span-2 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-zinc-200">Risparmio Token (LLM-CL)</h3>
            <p className="text-zinc-400 text-sm mt-1">Riduzione stimata grazie al protocollo LLM-CL e Semantic Cache.</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-emerald-400">{tokenSavingsPercent}%</div>
            <div className="text-sm text-zinc-500 mt-1">~{totalTokensSaved} token risparmiati oggi</div>
          </div>
        </div>

        {/* Audit Trail (Distributed Tracing) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-medium text-zinc-200">Audit Trail (Tracciamento Distribuito)</h3>
          </div>
          
          <div className="space-y-6">
            {auditEvents.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">Nessun tracciamento disponibile. Effettua una richiesta nella chat.</p>
            ) : (
              auditEvents.map((event, i) => (
                <div key={i} className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 border-b border-zinc-800/50 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">{event.data.requestId as string}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
                    {(event.data.steps as AuditTrailStep[]).map((step: AuditTrailStep, j: number) => (
                      <div key={j} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          {getStatusIcon(step.status)}
                        </div>
                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border border-zinc-800/50 bg-zinc-900/50 shadow">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-zinc-300">{step.component}</span>
                            {step.durationMs !== undefined && (
                              <span className="text-xs font-mono text-zinc-500">{step.durationMs}ms</span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 font-medium mb-1">{step.action}</div>
                          {step.details && (
                            <div className="text-xs text-zinc-500 bg-zinc-950 p-2 rounded border border-zinc-800/30 mt-2 font-mono break-all">
                              {step.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
