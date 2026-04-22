import React from 'react';
import { Terminal } from 'lucide-react';

export function LiveFeed({ logs }: { logs: any[] }) {
  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 flex flex-col h-full font-mono text-[10px]">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-xs font-bold uppercase flex items-center gap-2 text-slate-400 font-sans">
          <Terminal className="w-4 h-4 text-slate-400" /> Executive Logs
        </h3>
        <span className="text-slate-500 loading-dots">Streaming</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin pr-2 flex flex-col-reverse">
        {logs.map((L, i) => (
          <div key={i} className="text-slate-400 border-l-2 pl-2 flex gap-2 animate-in fade-in slide-in-from-left-2" 
               style={{ borderColor: L.msg.includes('EXEC') ? '#f59e0b' : L.msg.includes('HMM') ? '#a855f7' : '#334155' }}>
            <span className="text-slate-600 shrink-0">[{L.time}]</span>
            <span className={L.msg.includes('EXEC') ? 'text-amber-400 font-bold' : ''}>
              {L.msg}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-600 opacity-50">Initializing connection...</div>
        )}
      </div>
    </div>
  );
}
