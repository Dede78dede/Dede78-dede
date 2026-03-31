import React from 'react';
import { useAgentWorkerLogic } from '../features/worker/hooks/useAgentWorkerLogic';

export const AgentWorker: React.FC = () => {
  const { isWorking, currentTask } = useAgentWorkerLogic();

  if (!isWorking && !currentTask) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg flex items-center space-x-3 z-50 text-xs text-zinc-300">
      <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      <div>
        <p className="font-medium text-white">Agent Worker Active</p>
        <p className="text-zinc-500">{currentTask || 'Processing background tasks...'}</p>
      </div>
    </div>
  );
};

