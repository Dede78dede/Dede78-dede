import React, { useState, useRef, useEffect } from 'react';
import { useAgentSession } from '../../hooks/useAgentSession';
import { ExecutionStateFlag } from '../../core/abc/protocols';
import { PrivacyLevel } from '../../core/routing/types';
import { Send, Shield, ShieldAlert, ShieldCheck, Loader2, Wrench, AlertCircle } from 'lucide-react';

export const AdvancedChat: React.FC = () => {
  const { messages, currentState, currentTool, error, sendMessage, clearSession } = useAgentSession('/vault');
  const [input, setInput] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyLevel>(PrivacyLevel.MINIMUM);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || currentState !== ExecutionStateFlag.IDLE && currentState !== ExecutionStateFlag.COMPLETED && currentState !== ExecutionStateFlag.FAILED) return;
    
    sendMessage(input, privacy);
    setInput('');
  };

  const renderStateBadge = () => {
    switch (currentState) {
      case ExecutionStateFlag.ROUTING:
        return <div className="flex items-center text-blue-500 text-xs font-medium"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Routing request...</div>;
      case ExecutionStateFlag.TOOL_CALLING:
        return <div className="flex items-center text-amber-500 text-xs font-medium"><Wrench className="w-3 h-3 mr-1 animate-bounce" /> Using tool: {currentTool || 'MCP'}...</div>;
      case ExecutionStateFlag.GENERATING:
        return <div className="flex items-center text-purple-500 text-xs font-medium"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating response...</div>;
      case ExecutionStateFlag.FAILED:
        return <div className="flex items-center text-red-500 text-xs font-medium"><AlertCircle className="w-3 h-3 mr-1" /> Execution failed</div>;
      default:
        return null;
    }
  };

  const renderPrivacyIcon = (level: PrivacyLevel) => {
    switch (level) {
      case PrivacyLevel.MINIMUM: return <Shield className="w-4 h-4 text-gray-400" />;
      case PrivacyLevel.STRICT: return <ShieldCheck className="w-4 h-4 text-green-500" />;
      case PrivacyLevel.CONFIDENTIAL: return <ShieldAlert className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[800px] w-full max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">SmarterRouter Agent</h2>
          <p className="text-xs text-gray-500">Hybrid Edge/Cloud Orchestrator</p>
        </div>
        <div className="flex items-center space-x-3">
          <select 
            value={privacy} 
            onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)}
            className="text-xs border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={PrivacyLevel.MINIMUM}>Cloud (Fastest)</option>
            <option value={PrivacyLevel.STRICT}>Local (Private)</option>
            <option value={PrivacyLevel.CONFIDENTIAL}>WASM (Air-gapped)</option>
          </select>
          <button onClick={clearSession} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
            <Shield className="w-8 h-8 opacity-50" />
            <p className="text-sm">Ask me anything. I will route your request securely.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
            }`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              
              {/* Metadata Footer for Assistant */}
              {msg.role === 'assistant' && msg.metadata && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                  <span>{msg.metadata.endTime && msg.metadata.startTime ? `${msg.metadata.endTime - msg.metadata.startTime}ms` : ''}</span>
                  {msg.metadata.provider && <span>Via {msg.metadata.provider}</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading State Indicator */}
        {currentState !== ExecutionStateFlag.IDLE && currentState !== ExecutionStateFlag.COMPLETED && currentState !== ExecutionStateFlag.FAILED && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
              {renderStateBadge()}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-xs flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="w-full resize-none border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-3 px-4 shadow-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="absolute right-3 bottom-3">
              {renderPrivacyIcon(privacy)}
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || currentState !== ExecutionStateFlag.IDLE && currentState !== ExecutionStateFlag.COMPLETED && currentState !== ExecutionStateFlag.FAILED}
            className="inline-flex items-center justify-center p-3 border border-transparent rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
