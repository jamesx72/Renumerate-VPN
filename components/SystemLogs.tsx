import React, { useRef, useEffect, useState } from 'react';
import { Terminal, XCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

export const SystemLogs: React.FC<Props> = ({ logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'success' | 'info'>('all');

  // Auto-scroll when logs update or filter changes
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, filter]);

  const filteredLogs = logs.filter(log => filter === 'all' || log.type === filter);

  return (
    <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 h-[400px] flex flex-col shadow-inner font-mono relative overflow-hidden group">
       {/* Gradient Line */}
       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500/20 to-transparent"></div>
       
       {/* Header */}
       <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
         <div className="flex items-center gap-2">
           <Terminal className="w-3.5 h-3.5 text-brand-500" />
           <h3 className="text-xs font-bold text-brand-500/80 uppercase tracking-widest">System_Logs</h3>
         </div>
         
         {/* Filters */}
         <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg">
            {(['all', 'info', 'success', 'warning', 'error'] as const).map(f => (
                <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-all ${
                        filter === f 
                            ? 'bg-slate-700 text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                    title={`Filtrer par ${f}`}
                >
                    {f === 'all' ? 'ALL' : f.charAt(0)}
                </button>
            ))}
         </div>
       </div>

       {/* Logs Area */}
       <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar p-1">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-2.5 text-[10px] md:text-xs hover:bg-white/5 p-1 rounded transition-colors group/item">
              <span className="text-slate-500 shrink-0 font-mono opacity-60 group-hover/item:opacity-100 transition-opacity">
                [{log.timestamp}]
              </span>
              
              <span className="shrink-0 pt-0.5">
                  {log.type === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
                  {log.type === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  {log.type === 'success' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                  {log.type === 'info' && <Info className="w-3 h-3 text-blue-500" />}
              </span>

              <span className={`${
                log.type === 'success' ? 'text-emerald-400' :
                log.type === 'warning' ? 'text-amber-400' :
                log.type === 'error' ? 'text-red-400' :
                'text-slate-300'
              } break-words leading-relaxed flex-1`}>
                {log.event}
              </span>
            </div>
          ))}
          
          {filteredLogs.length === 0 && (
              <div className="text-slate-600 italic text-xs text-center mt-8 opacity-50">
                  Aucun log pour le filtre "{filter.toUpperCase()}".
              </div>
          )}

          <div ref={logsEndRef} />
          
          {/* Active line simulation */}
          {filter === 'all' && (
              <div className="flex gap-2.5 text-[10px] md:text-xs pt-1 opacity-70">
                <span className="text-brand-500 font-bold shrink-0 animate-pulse">$</span>
                <span className="w-2 h-4 bg-brand-500/50 block animate-[pulse_1s_ease-in-out_infinite]"></span>
              </div>
          )}
       </div>
    </div>
  );
};