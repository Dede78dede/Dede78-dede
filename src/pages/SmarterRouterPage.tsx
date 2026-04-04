import React from 'react';
import { AdvancedChat } from '../components/chat/AdvancedChat';

export function SmarterRouterPage() {
  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">SmarterRouter Agent</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Motore di routing ibrido con orchestrazione autonoma dei tool e protocolli ABC.
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <AdvancedChat />
      </div>
    </div>
  );
}
