import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, Brain, Paperclip } from 'lucide-react';
import { MessageAttachment } from '../context/ChatContext';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: MessageAttachment[];
}

export function ChatMessageContent({ role, content, attachments }: ChatMessageProps) {
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);

  if (role === 'user') {
    return (
      <div className="flex flex-col gap-2">
        {content}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-700/50 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm">
                <Paperclip className="w-3.5 h-3.5 text-zinc-300" />
                <span className="text-zinc-200 truncate max-w-[200px]">{att.name || 'Allegato'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Parse routing messages
  const routingMessages: { icon: string, text: string }[] = [];
  let displayContent = content;
  
  // Match patterns like: ⚡ *Tier 2 (Local Thinker): ...*
  // or 🧠 *Master: ...*
  // or ⚠️ *Errore locale, escalation al Master (Tier 3)...*
  // or 🛡️ *Verifier Agent: ...*
  const routingRegex = /(?:^|\n\n)(⚡|🧠|⚠️|🛡️)\s*\*([^*]+)\*(?:\n\n|$)/g;
  let match;
  while ((match = routingRegex.exec(content)) !== null) {
    routingMessages.push({ icon: match[1], text: match[2] });
  }
  
  displayContent = displayContent.replace(routingRegex, '\n\n').trim();

  // Parse <think> tags (handles both closed and unclosed tags for streaming)
  const thinkMatch = displayContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  
  let thoughtProcess = '';
  let isThinking = false;
  let finalAnswer = displayContent;

  if (thinkMatch) {
    thoughtProcess = thinkMatch[1].trim();
    isThinking = !displayContent.includes('</think>');
    finalAnswer = displayContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
  }

  return (
    <div className="space-y-3">
      {/* Routing Badges */}
      {routingMessages.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {routingMessages.map((msg, idx) => {
            let bgColor = 'bg-zinc-800/50';
            let textColor = 'text-zinc-300';
            let borderColor = 'border-zinc-700/50';
            
            if (msg.icon === '⚡') {
              bgColor = 'bg-blue-500/10';
              textColor = 'text-blue-400';
              borderColor = 'border-blue-500/20';
            } else if (msg.icon === '🧠') {
              bgColor = 'bg-purple-500/10';
              textColor = 'text-purple-400';
              borderColor = 'border-purple-500/20';
            } else if (msg.icon === '⚠️') {
              bgColor = 'bg-amber-500/10';
              textColor = 'text-amber-400';
              borderColor = 'border-amber-500/20';
            } else if (msg.icon === '🛡️') {
              bgColor = 'bg-emerald-500/10';
              textColor = 'text-emerald-400';
              borderColor = 'border-emerald-500/20';
            }

            return (
              <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${borderColor} ${bgColor} ${textColor} text-xs font-medium w-fit`}>
                <span>{msg.icon}</span>
                <span>{msg.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Thought Process Accordion */}
      {thinkMatch && (
        <div className={`border ${isThinking ? 'border-emerald-500/50' : 'border-zinc-700/50'} rounded-lg overflow-hidden bg-zinc-900/50`}>
          <button
            onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
            className="w-full flex items-center justify-between p-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain className={`w-3.5 h-3.5 ${isThinking ? 'text-emerald-500 animate-pulse' : ''}`} />
              <span className={isThinking ? 'text-emerald-500' : ''}>
                {isThinking ? 'Sto ragionando...' : 'Processo di ragionamento'}
              </span>
            </div>
            {isThoughtExpanded || isThinking ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          
          {(isThoughtExpanded || isThinking) && (
            <div className="p-3 border-t border-zinc-700/50 text-sm text-zinc-400 font-mono bg-zinc-950/30 whitespace-pre-wrap">
              {thoughtProcess}
              {isThinking && <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 animate-pulse align-middle" />}
            </div>
          )}
        </div>
      )}

      {/* Final Answer */}
      {finalAnswer && (
        <div className="markdown-body">
          <ReactMarkdown>{finalAnswer}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
