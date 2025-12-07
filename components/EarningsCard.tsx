import React from 'react';
import { Coins, TrendingUp, Lock, Wallet, Zap, ArrowUpRight, History, CheckCircle, CreditCard, ChevronRight } from 'lucide-react';
import { PlanTier, Transaction } from '../types';

interface Props {
  isConnected: boolean;
  plan: PlanTier;
  balance: number;
  onUpgrade: () => void;
  onWithdraw: () => void;
  transactions?: Transaction[];
  onViewHistory?: () => void;
}

export const EarningsCard: React.FC<Props> = ({ isConnected, plan, balance, onUpgrade, onWithdraw, transactions = [], onViewHistory }) => {
  const isPremium = plan !== 'free';
  const isEarning = isConnected && isPremium;

  // Calculate rate based on plan (simulated)
  const rate = plan === 'elite' ? '0.012' : plan === 'pro' ? '0.004' : '0.000';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 relative overflow-hidden group flex flex-col h-full">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Coins className="w-24 h-24 rotate-12" />
      </div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
          <Wallet className={`w-5 h-5 ${isEarning ? 'text-amber-500 animate-bounce' : 'text-slate-400'}`} />
          Revenus Passifs
        </h3>
        {isPremium && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${
            isEarning 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
          }`}>
            <Zap className="w-3 h-3" />
            {isEarning ? 'Actif' : 'En pause'}
          </div>
        )}
      </div>

      <div className="relative z-10 mb-6">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 mb-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white tracking-tighter">
              {balance.toFixed(4)}
            </span>
            <span className="text-sm font-bold text-amber-500">RNC</span>
          </div>
          {isEarning && (
            <span className="text-xs font-mono font-bold text-emerald-500 mb-1.5 flex items-center gap-1 animate-pulse">
                <TrendingUp className="w-3 h-3" />
                +{rate} RNC/sec
            </span>
          )}
        </div>

        {!isPremium ? (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-2">
              <Lock className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Passez Premium pour monétiser votre bande passante sécurisée.
            </p>
            <button 
              onClick={onUpgrade}
              className="text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Activer les gains
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>Taux actuel</span>
              <span className="font-mono text-emerald-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +{rate} RNC/sec
              </span>
            </div>
            
            {/* Progress/Activity Bar */}
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
              {isEarning && (
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 w-full animate-shimmer relative">
                  <div className="absolute inset-0 bg-white/30 w-1/2 skew-x-12 -translate-x-full animate-[shimmer_1s_infinite]"></div>
                </div>
              )}
            </div>

            <button
              onClick={onWithdraw}
              disabled={balance < 1}
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                balance >= 1 
                  ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Retirer fonds
            </button>
            
            {!isConnected && (
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Connectez-vous pour reprendre le minage.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      {transactions.length > 0 && isPremium && (
          <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
             <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                     <History className="w-3.5 h-3.5" />
                     Dernières Transactions
                 </div>
                 {onViewHistory && (
                     <button 
                        onClick={onViewHistory}
                        className="text-[10px] font-bold text-brand-500 hover:text-brand-400 flex items-center gap-1 transition-colors"
                     >
                         Voir tout
                         <ChevronRight className="w-3 h-3" />
                     </button>
                 )}
             </div>
             <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                 {transactions.slice(0, 3).map((tx) => (
                     <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                         <div className="flex items-center gap-3">
                             <div className={`p-1.5 rounded-full ${tx.method === 'crypto' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-500' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-500'}`}>
                                 {tx.method === 'crypto' ? <Wallet className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                             </div>
                             <div>
                                 <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Retrait</span>
                                    <span className="text-[10px] text-slate-400 font-mono">#{tx.id.split('-')[1]}</span>
                                 </div>
                                 <div className="text-[10px] text-slate-400">{tx.date}</div>
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="text-xs font-bold font-mono text-emerald-500">-{tx.amount}</div>
                             <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                                 {tx.status === 'completed' && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                                 <span className="capitalize">{tx.status}</span>
                             </div>
                         </div>
                     </div>
                 ))}
             </div>
          </div>
      )}
    </div>
  );
};