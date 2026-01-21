
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
      <style>
        {`
          @keyframes chart-pulse {
            0%, 100% { filter: drop-shadow(0 0 2px rgba(6, 182, 212, 0.4)); stroke-width: 2.5; }
            50% { filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.8)); stroke-width: 3.5; }
          }
          @keyframes flow-line {
            from { stroke-dashoffset: 100; }
            to { stroke-dashoffset: 0; }
          }
          .animate-chart-path-down {
            animation: chart-pulse 3s infinite ease-in-out;
            stroke-dasharray: 2000;
          }
          .animate-chart-path-up {
            animation: chart-pulse 3s infinite ease-in-out 1.5s;
            stroke-dasharray: 2000;
          }
          .cyber-grid-bg {
            background-image: linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px);
            background-size: 20px 20px;
          }
        `}
      </style>
      
      <div className="absolute inset-0 cyber-grid-bg opacity-20 z-0"></div>
      <div className="absolute top-0 left-0 w-0.5 h-full bg-brand-500/20 animate-pulse"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-brand-500/5 to-transparent pointer-events-none"></div>
      
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={208} debounce={100}>
        <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} opacity={0.1} />
          <XAxis dataKey="name" hide />
          <YAxis hide />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? 'rgba(2, 6, 23, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
              borderColor: '#06b6d433', 
              color: isDark ? '#f8fafc' : '#0f172a',
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
              borderRadius: '12px',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              backdropFilter: 'blur(12px)',
              zIndex: 50
            }}
            itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
          />
          <Area 
            type="monotone" 
            dataKey="download" 
            stroke="#06b6d4" 
            fillOpacity={1} 
            fill="url(#colorDown)" 
            strokeWidth={3} 
            className="animate-chart-path-down"
            isAnimationActive={true}
            animationDuration={1000}
          />
          <Area 
            type="monotone" 
            dataKey="upload" 
            stroke="#8b5cf6" 
            fillOpacity={1} 
            fill="url(#colorUp)" 
            strokeWidth={3} 
            className="animate-chart-path-up"
            isAnimationActive={true}
            animationDuration={1200}
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
        <div className={`absolute inset-0 rounded-full blur-[40px] opacity-20 transition-all duration-1000 ${
           score > 80 ? 'bg-emerald-500' : score > 50 ? 'bg-amber-500' : 'bg-red-500'
        }`}></div>
        
        <svg className="w-full h-full transform -rotate-90 relative z-10">
          <circle
            cx="72"
            cy="72"
            r="64"
            stroke={isDark ? "rgba(30, 41, 59, 0.3)" : "#e2e8f0"}
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="72"
            cy="72"
            r="64"
            stroke={score > 80 ? "#10b981" : score > 50 ? "#f59e0b" : "#ef4444"}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={402.12}
            strokeDashoffset={402.12 - (402.12 * score) / 100}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 5px ${score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444'})` }}
          />
        </svg>
        <div className="absolute flex flex-col items-center z-20">
          <span className="text-5xl font-black font-mono text-slate-900 dark:text-white tracking-tighter drop-shadow-lg">{Math.round(score)}</span>
          <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 tracking-[0.3em] uppercase">Security_Lv</span>
        </div>
      </div>
      <div className="mt-8 flex items-center gap-3 px-5 py-2 rounded-full bg-black/40 border border-white/5 shadow-2xl backdrop-blur-xl">
         <div className={`w-2 h-2 rounded-full ${score > 80 ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : score > 50 ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' : 'bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse'}`}></div>
         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {score > 80 ? 'Anonymat Intègre' : score > 50 ? 'Alerte Traceurs' : 'Périmètre Compromis'}
         </span>
      </div>
    </div>
  );
};
