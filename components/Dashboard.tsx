
import React from 'react';
import { Activity, Lock, Shield, Ghost, Layers, Globe, Check, AlertCircle } from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './DashboardCharts';
import { SecurityReport, PlanTier, ConnectionMode } from '../types';

interface DashboardProps {
  isDark: boolean;
  protocol: string;
  isEmergency: boolean;
  securityReport: SecurityReport | null;
  isConnected: boolean;
  userPlan: PlanTier;
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  isDark,
  protocol,
  isEmergency,
  securityReport,
  isConnected,
  userPlan,
  mode,
  onModeChange
}) => {
  const modes = [
    { 
      id: ConnectionMode.STANDARD, 
      icon: Shield, 
      label: 'Standard', 
      desc: 'Équilibre parfait' 
    },
    { 
      id: ConnectionMode.STEALTH, 
      icon: Ghost, 
      label: 'Stealth', 
      desc: 'Contourne les pare-feux' 
    },
    { 
      id: ConnectionMode.DOUBLE_HOP, 
      icon: Layers, 
      label: 'Double Hop', 
      desc: 'Double chiffrement' 
    },
    { 
      id: ConnectionMode.SMART_DNS, 
      icon: Globe, 
      label: 'Smart DNS', 
      desc: 'Vitesse maximale' 
    },
  ];

  return (
    <div className="space-y-6">
      {/* Mode Selector Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-5 px-1">
           <div className="flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-brand-500" /> Mode de Connexion
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Choisissez votre méthode de routage</p>
           </div>
           
           {isConnected ? (
             <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <Lock className="w-3 h-3 text-amber-500" />
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">Verrouillé</span>
             </div>
           ) : (
             <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Modifiable</span>
             </div>
           )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                disabled={isConnected}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all relative group ${
                  isActive
                    ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/25 scale-[1.02]'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand-400 dark:hover:border-brand-500/50'
                } ${isConnected ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : 'cursor-pointer hover:shadow-md'}`}
              >
                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20' : 'bg-white dark:bg-slate-800 shadow-sm'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-brand-500'}`} />
                </div>
                
                <div className="text-center">
                  <div className={`text-xs font-bold tracking-tight ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                    {m.label}
                  </div>
                  <div className={`text-[9px] mt-0.5 leading-tight ${isActive ? 'text-brand-100' : 'text-slate-400'}`}>
                    {m.desc}
                  </div>
                </div>

                {isActive && !isConnected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {isConnected && (
          <div className="mt-4 flex items-center justify-center gap-2 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-in fade-in slide-in-from-bottom-1 duration-300">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">
              Veuillez vous déconnecter pour changer de mode de routage.
            </p>
          </div>
        )}
      </div>

      {/* Traffic Monitoring Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <Activity className="w-4 h-4" /> Trafic Réseau
            </h3>
            <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500 font-mono font-bold">
              {protocol.toUpperCase()}
            </span>
          </div>
          <TrafficMonitor isDark={isDark} />
        </div>
        
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <Lock className="w-4 h-4" /> Score d'Anonymat
            </h3>
            {isConnected && (
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            )}
          </div>
          <AnonymityScore 
              score={isEmergency ? 10 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 75 : 99) : 0))} 
              isDark={isDark} 
          />
        </div>
      </div>
    </div>
  );
};
