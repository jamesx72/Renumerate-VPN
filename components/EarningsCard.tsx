
import React from 'react';
import { Coins, TrendingUp, Lock, Wallet, Zap, ArrowUpRight, History, CheckCircle, CreditCard, ChevronRight, Gauge, Sparkles, Activity, ShieldCheck, ShieldAlert, UserCheck } from 'lucide-react';
import { PlanTier, Transaction, AppSettings } from '../types';

interface Props {
  isConnected: boolean;
  plan: PlanTier;
  isVerified: boolean;
  balance: number;
  reputation?: number;
  onUpgrade: () => void;
  onVerify: () => void;
  onWithdraw: () => void;
  transactions?: Transaction[];
  settings?: AppSettings;
}

export const EarningsCard: React.FC<Props> = ({ isConnected, plan, isVerified, balance, reputation = 100, onUpgrade, onVerify, onWithdraw, transactions = [], settings }) => {
  const isPremium = plan !== 'free';
  const isEarning = isConnected && isPremium && isVerified;

  const getRate = () => {
      if (!isPremium || !isVerified) return "0.000";
      const base = plan === 'elite' ? 0.00012 : 0.00004;
      const intensityMult = 0.5 + ((settings?.miningIntensity || 50) / 100);
      const iaMult = settings?.yieldOptimizationIA ? 1.2 : 1.0;
      const typeMult = settings?.contributionType === 'exit' ? 1.3 : settings?.contributionType === 'relay' ? 1.15 : 1.0;
      const reputationBonus = 0.8 + (reputation / 100) * 0.4;
      
      return (base * intensityMult * iaMult * typeMult * reputationBonus * 10).toFixed(4); 
  };

  const potentialDailyGain = () => {
    const ratePerSec = parseFloat(getRate()) / 10;
    return (ratePerSec * 86400).toFixed(2);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 relative overflow-hidden group flex flex-col h-full shadow-sm">
      {/* Background Glow */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full transition-colors ${isEarning ? 'bg-emerald-500/10' : 'bg-slate-500/5'}`}></div>

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex flex-col">
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                <Wallet className={`w-5 h-5 ${isEarning ? 'text-amber-500' : 'text-slate-400'}`} />
                Rendement RNC
            </h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Algorithme V4.5 Active</p>
        </div>
        {isEarning && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse">
            <Sparkles className="w-3 h-3" />
            LIVE YIELD
          </div>
        )}
      </div>

      <div className="relative z-10 mb-8">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono font-black text-slate-900 dark:text-white tracking-tighter">
              {balance.toFixed(4)}
            </span>
            <span className="text-lg font-black text-amber-500">RNC</span>
          </div>
        </div>

        {isPremium ? (
          isVerified ? (
            <div className="space-y-6">
               {/* Node Health / Reputation */}
               <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Santé du Nœud (Vérifié)</span>
                      <span className={reputation > 80 ? 'text-emerald-500' : 'text-amber-500'}>{Math.round(reputation)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                          className={`h-full transition-all duration-500 ${reputation > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${reputation}%` }}
                      ></div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Flux actuel</span>
                      <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">+{getRate()} /sec</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Est. 24h</span>
                      <div className="text-xs font-mono font-bold text-brand-500 mt-1">+{potentialDailyGain()} RNC</div>
                  </div>
               </div>

               <button
                onClick={onWithdraw}
                disabled={balance < 1}
                className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                  balance >= 1 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 active:scale-95'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Retirer mes Gains
              </button>
            </div>
          ) : (
            <div className="mt-4 p-6 bg-amber-500/5 rounded-2xl border-2 border-dashed border-amber-500/30 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-widest">Action Requise</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Votre identité doit être vérifiée avant de pouvoir générer et retirer des RNC.
              </p>
              <button 
                onClick={onVerify}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-transform hover:scale-105"
              >
                Vérifier mon identité
              </button>
            </div>
          )
        ) : (
          <div className="mt-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-widest">Gains Désactivés</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Monétisez votre connexion en devenant un nœud premium du réseau.
            </p>
            <button 
              onClick={onUpgrade}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-transform hover:scale-105"
            >
              Activer monétisation
            </button>
          </div>
        )}
      </div>

      {!isEarning && isPremium && isVerified && (
          <div className="mt-auto flex items-center gap-2 p-3 bg-red-500/5 rounded-xl border border-red-500/10">
              <Activity className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[10px] text-red-500 font-medium">Connectez le VPN pour commencer l'accumulation.</p>
          </div>
      )}
    </div>
  );
};
