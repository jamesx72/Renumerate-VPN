
import React, { useState, useEffect } from 'react';
import { Coins, TrendingUp, Lock, Wallet, Zap, ArrowUpRight, History, CheckCircle, CreditCard, ChevronRight, Gauge, Sparkles, Activity, ShieldCheck, ShieldAlert, UserCheck, BarChart3, Database, Globe, ArrowRight } from 'lucide-react';
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
  const [networkLoad, setNetworkLoad] = useState(42);
  const isPremium = plan !== 'free';
  const isEarning = isConnected && isPremium && isVerified;

  useEffect(() => {
    if (isConnected) {
        const interval = setInterval(() => {
            setNetworkLoad(prev => Math.max(10, Math.min(100, prev + (Math.random() * 10 - 5))));
        }, 3000);
        return () => clearInterval(interval);
    }
  }, [isConnected]);

  const getRate = () => {
      if (!isPremium || !isVerified || !isConnected) return "0.0000";
      const base = plan === 'elite' ? 0.00018 : 0.00006;
      const intensityMult = 0.5 + ((settings?.miningIntensity || 50) / 100);
      const iaMult = settings?.yieldOptimizationIA ? 1.25 : 1.0;
      const typeMult = settings?.contributionType === 'exit' ? 1.5 : settings?.contributionType === 'relay' ? 1.25 : 1.0;
      const loadBonus = 1 + (networkLoad / 200);
      
      return (base * intensityMult * iaMult * typeMult * loadBonus).toFixed(6); 
  };

  const potentialDailyGain = () => {
    const ratePerSec = parseFloat(getRate());
    return (ratePerSec * 86400).toFixed(2);
  };

  return (
    <div className="bg-slate-950 dark:bg-slate-900 rounded-[2.5rem] p-8 border-2 border-brand-500/20 relative overflow-hidden group flex flex-col h-full shadow-2xl transition-all duration-500 hover:border-brand-500/40">
      <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex flex-col">
            <h3 className="font-black text-xl flex items-center gap-3 text-white uppercase tracking-tighter">
                <Wallet className={`w-6 h-6 ${isEarning ? 'text-amber-500 animate-pulse' : 'text-slate-600'}`} />
                RNC_TERMINAL
            </h3>
            <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isEarning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-700'}`}></div>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Node_Contribution_Protocol v5.0</p>
            </div>
        </div>
        {isEarning && (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
            <Sparkles className="w-3 h-3" />
            LIVE_MINING
          </div>
        )}
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 mb-8 group-hover:border-brand-500/20 transition-all shadow-inner">
            <div className="flex items-baseline gap-3 mb-2">
                <span className="text-5xl font-mono font-black text-white tracking-tighter">
                    {balance.toFixed(4)}
                </span>
                <span className="text-xl font-black text-amber-500 uppercase">RNC</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Available_Asset_Balance</span>
                <div className="flex items-center gap-1.5 text-emerald-500">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[10px] font-black font-mono">+{getRate()}/s</span>
                </div>
            </div>
        </div>

        {isPremium ? (
          isVerified ? (
            <div className="space-y-6">
               {/* Network Load Indicator */}
               <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      <span className="flex items-center gap-2"><Globe className="w-3 h-3 text-cyan-500" /> Network_Load</span>
                      <span className="text-cyan-400">{Math.round(networkLoad)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                      {[...Array(10)].map((_, i) => (
                          <div 
                            key={i}
                            className={`flex-1 h-full rounded-sm transition-all duration-700 ${
                                (i+1) * 10 <= networkLoad 
                                ? 'bg-brand-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]' 
                                : 'bg-slate-900'
                            }`}
                          ></div>
                      ))}
                  </div>
                  <p className="text-[8px] text-slate-600 font-bold italic">>> Plus la charge réseau est élevée, plus vos gains RNC s'accélèrent.</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2 group/tile hover:border-brand-500/30 transition-all">
                      <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest block">Est. Daily Gain</span>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-brand-500/10 rounded-lg text-brand-500"><Coins className="w-3.5 h-3.5" /></div>
                        <div className="text-sm font-mono font-black text-white">+{potentialDailyGain()} <span className="text-[10px] text-amber-500">RNC</span></div>
                      </div>
                  </div>
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2 group/tile hover:border-emerald-500/30 transition-all">
                      <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest block">Reputation Bonus</span>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500"><ShieldCheck className="w-3.5 h-3.5" /></div>
                        <div className="text-sm font-mono font-black text-white">X1.42</div>
                      </div>
                  </div>
               </div>

               <button
                onClick={onWithdraw}
                disabled={balance < 1}
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all relative overflow-hidden group/withdraw ${
                  balance >= 1 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-2xl shadow-amber-900/40 active:scale-95'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
                }`}
              >
                <ArrowRight className="w-4 h-4 transition-transform group-hover/withdraw:translate-x-2" />
                EXECUTE_WITHDRAWAL
              </button>
            </div>
          ) : (
            <div className="mt-4 p-8 bg-amber-500/5 rounded-[2.5rem] border-2 border-dashed border-amber-500/20 flex flex-col items-center text-center group/verify transition-all hover:bg-amber-500/10">
              <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-amber-500/30 group-hover/verify:scale-110 transition-transform">
                <ShieldAlert className="w-8 h-8 text-amber-500 animate-pulse" />
              </div>
              <h4 className="text-base font-black text-white mb-2 uppercase tracking-tighter">Auth_Required</h4>
              <p className="text-[10px] text-slate-500 mb-8 uppercase tracking-widest leading-relaxed">
                Le protocole de preuve d'identité (KYC) doit être validé pour débloquer le wallet.
              </p>
              <button 
                onClick={onVerify}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-amber-900/40 transition-all hover:scale-105"
              >
                INITIATE_VÉRIFICATION
              </button>
            </div>
          )
        ) : (
          <div className="mt-4 p-8 bg-slate-900/40 rounded-[2.5rem] border-2 border-dashed border-slate-800 flex flex-col items-center text-center group/upgrade transition-all hover:bg-white/[0.02]">
            <div className="w-20 h-20 bg-slate-800 rounded-[2rem] flex items-center justify-center mb-6 border border-white/5 group-hover/upgrade:rotate-12 transition-transform">
              <Lock className="w-8 h-8 text-slate-600" />
            </div>
            <h4 className="text-base font-black text-slate-300 mb-2 uppercase tracking-tighter">Mining_Locked</h4>
            <p className="text-[10px] text-slate-600 mb-8 uppercase tracking-widest leading-relaxed">
              Monétisez votre bande passante inutilisée en devenant un nœud du réseau Renumerate.
            </p>
            <button 
              onClick={onUpgrade}
              className="w-full bg-white text-slate-950 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              UPGRADE_TO_PREMIUM
            </button>
          </div>
        )}
      </div>

      {!isEarning && isPremium && isVerified && (
          <div className="mt-8 flex items-center gap-4 p-4 bg-red-500/5 rounded-2xl border border-red-500/20 group/alert">
              <Activity className="w-5 h-5 text-red-500 shrink-0 animate-pulse" />
              <p className="text-[9px] text-red-500 font-black uppercase tracking-widest leading-relaxed">
                Connectez le tunnel VPN pour synchroniser votre puissance de contribution.
              </p>
          </div>
      )}
    </div>
  );
};
