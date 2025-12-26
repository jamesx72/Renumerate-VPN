
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const trafficData = Array.from({ length: 20 }, (_, i) => ({
  name: i.toString(),
  upload: Math.floor(Math.random() * 50) + 10,
  download: Math.floor(Math.random() * 100) + 20,
}));

interface ChartProps {
  isDark: boolean;
}

export const TrafficMonitor = ({ isDark }: ChartProps) => {
  return (
    <div className="w-full h-48 min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
          <XAxis dataKey="name" hide />
          <YAxis hide />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? '#0f172a' : '#ffffff', 
              borderColor: isDark ? '#334155' : '#cbd5e1', 
              color: isDark ? '#f8fafc' : '#0f172a',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              borderRadius: '12px'
            }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Area 
            type="monotone" 
            dataKey="download" 
            stroke="#06b6d4" 
            fillOpacity={1} 
            fill="url(#colorDown)" 
            strokeWidth={2} 
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="upload" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#colorUp)" 
            strokeWidth={2} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AnonymityScore = ({ score, isDark }: { score: number, isDark: boolean }) => {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke={isDark ? "#1e293b" : "#e2e8f0"}
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke={score > 80 ? "#10b981" : score > 50 ? "#f59e0b" : "#ef4444"}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={351.86}
            strokeDashoffset={351.86 - (351.86 * score) / 100}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">{Math.round(score)}</span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest">SCORE</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
         <div className={`w-2 h-2 rounded-full ${score > 80 ? 'bg-emerald-500' : score > 50 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {score > 80 ? 'Anonymat Total' : score > 50 ? 'Anonymat Partiel' : 'Empreinte Visible'}
         </span>
      </div>
    </div>
  );
};
