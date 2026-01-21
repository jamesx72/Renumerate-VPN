
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const trafficData = Array.from({ length: 25 }, (_, i) => ({
  name: i.toString(),
  upload: Math.floor(Math.random() * 40) + 5,
  download: Math.floor(Math.random() * 80) + 15,
}));

interface ChartProps {
  isDark: boolean;
}

export const TrafficMonitor = ({ isDark }: ChartProps) => {
  return (
    <div className="w-full h-52 min-h-[208px] overflow-hidden relative block" style={{ height: '208px' }}>
      <div className="absolute inset-0 pointer-events-none bg-scanline opacity-[0.03] z-0"></div>
      {/* Fixed: Added debounce to handle container resize during mount */}
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={208} debounce={100}>
        <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} opacity={0.2} />
          <XAxis dataKey="name" hide />
          <YAxis hide />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
              borderColor: isDark ? '#334155' : '#cbd5e1', 
              color: isDark ? '#f8fafc' : '#0f172a',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              zIndex: 50
            }}
            itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
          />
          <Area 
            type="monotone" 
            dataKey="download" 
            stroke="#06b6d4" 
            fillOpacity={1} 
            fill="url(#colorDown)" 
            strokeWidth={3} 
            isAnimationActive={true}
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="upload" 
            stroke="#8b5cf6" 
            fillOpacity={1} 
            fill="url(#colorUp)" 
            strokeWidth={3} 
            isAnimationActive={true}
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AnonymityScore = ({ score, isDark }: { score: number, isDark: boolean }) => {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <div className={`absolute inset-0 rounded-full blur-[30px] opacity-20 transition-all duration-1000 ${
           score > 80 ? 'bg-emerald-500' : score > 50 ? 'bg-amber-500' : 'bg-red-500'
        }`}></div>
        
        <svg className="w-full h-full transform -rotate-90 relative z-10">
          <circle
            cx="72"
            cy="72"
            r="64"
            stroke={isDark ? "rgba(30, 41, 59, 0.5)" : "#e2e8f0"}
            strokeWidth="12"
            fill="transparent"
          />
          <circle
            cx="72"
            cy="72"
            r="64"
            stroke={score > 80 ? "#10b981" : score > 50 ? "#f59e0b" : "#ef4444"}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={402.12}
            strokeDashoffset={402.12 - (402.12 * score) / 100}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center z-20">
          <span className="text-4xl font-black font-mono text-slate-900 dark:text-white tracking-tighter">{Math.round(score)}</span>
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">IDENT_SCORE</span>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
         <div className={`w-2 h-2 rounded-full ${score > 80 ? 'bg-emerald-500 animate-pulse' : score > 50 ? 'bg-amber-500' : 'bg-red-500 animate-bounce'}`}></div>
         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {score > 80 ? 'Anonymat Critique' : score > 50 ? 'Traceur Détecté' : 'Identité Compromise'}
         </span>
      </div>
    </div>
  );
};
