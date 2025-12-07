import React from 'react';
import { Activity, Lock } from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './DashboardCharts';
import { SecurityReport, PlanTier } from '../types';

interface DashboardProps {
  isDark: boolean;
  protocol: string;
  isEmergency: boolean;
  securityReport: SecurityReport | null;
  isConnected: boolean;
  userPlan: PlanTier;
}

export const Dashboard: React.FC<DashboardProps> = ({
  isDark,
  protocol,
  isEmergency,
  securityReport,
  isConnected,
  userPlan
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Activity className="w-4 h-4" /> Trafic Réseau
          </h3>
          <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-mono">
            {protocol.toUpperCase()}
          </span>
        </div>
        <TrafficMonitor isDark={isDark} />
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Lock className="w-4 h-4" /> Score d'Anonymat
          </h3>
        </div>
        <AnonymityScore 
            score={isEmergency ? 10 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 75 : 99) : 0))} 
            isDark={isDark} 
        />
      </div>
    </div>
  );
};