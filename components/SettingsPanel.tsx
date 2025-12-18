
import React, { useState, useMemo } from 'react';
import { Settings, Shield, Globe, Zap, ToggleLeft, ToggleRight, X, RefreshCw, Lock, Crown, Network, Clock, Smartphone, Monitor, Tv, RotateCcw, Wifi, Eye, EyeOff, Ghost, Users, Activity, Sliders, Languages, Palette, Server, BoxSelect, Cpu, Power, WifiOff, Timer, CreditCard, Receipt, Plus, Trash2, CheckCircle, AlertTriangle, ShieldAlert, ShieldCheck, Wallet, TrendingUp, Landmark, ArrowRight, Sparkles, Gauge, Info } from 'lucide-react';
import { AppSettings, PlanTier } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
}

type TabId = 'general' | 'connection' | 'privacy' | 'billing';

export const SettingsPanel: React.FC<Props> = ({ 
    settings, 
    updateSettings, 
    onClose, 
    userPlan, 
    onShowPricing
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  
  const tabs = [
    { id: 'general', label: 'Général', icon: Sliders },
    { id: 'connection', label: 'Connexion', icon: Activity },
    { id: 'privacy', label: 'Sécurité', icon: Shield },
    { id: 'billing', label: 'Compte & Gains', icon: Wallet },
  ];

  const multipliers = {
    passive: 1.0,
    relay: 1.15,
    exit: 1.30
  };

  const planMultiplier = userPlan === 'elite' ? 2.5 : userPlan === 'pro' ? 1.8 : 1.0;
  const intensityMultiplier = 0.5 + (settings.miningIntensity / 100);
  const iaMultiplier = settings.yieldOptimizationIA ? 1.2 : 1.0;
  const typeMultiplier = multipliers[settings.contributionType];
  const finalMultiplier = planMultiplier * intensityMultiplier * iaMultiplier * typeMultiplier;

  // Simulate potential daily gain
  const potentialDailyGain = useMemo(() => {
    const baseDaily = userPlan === 'elite' ? 5.2 : 1.8;
    return (baseDaily * intensityMultiplier * iaMultiplier * typeMultiplier).toFixed(2);
  }, [userPlan, intensityMultiplier, iaMultiplier, typeMultiplier]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[650px] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Settings className="w-6 h-6 text-brand-500" />
                    Settings
                </h2>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabId)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            activeTab === tab.id 
                                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-700' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </nav>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <div className="p-3 bg-brand-500/10 rounded-xl border border-brand-500/20">
                    <p className="text-[10px] font-bold text-brand-500 uppercase mb-1">Status Abonnement</p>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{userPlan}</span>
                        {userPlan === 'free' && (
                            <button onClick={onShowPricing} className="text-[10px] font-black text-brand-500 underline">UPGRADE</button>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950 relative">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
            </button>

            {activeTab === 'billing' ? (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configuration du Rendement</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Maximisez vos gains RNC en optimisant votre participation au réseau.</p>
                        </div>
                    </div>

                    {/* Breakdown and Potential Gain */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/10 blur-3xl rounded-full"></div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <Zap className="w-3 h-3 text-brand-500" /> Simulateur de Rendement
                            </h4>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-4xl font-mono font-black text-brand-400 tracking-tighter">{potentialDailyGain}</span>
                                <span className="text-sm font-bold text-slate-400">RNC / 24h</span>
                            </div>
                            <p className="text-[9px] text-slate-500">Basé sur une connexion 24/7 stable.</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-3 h-3 text-emerald-500" /> Multiplicateur Actif
                            </h4>
                            <div className="text-3xl font-black text-slate-900 dark:text-white mb-2">x{finalMultiplier.toFixed(2)}</div>
                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">PLAN: x{planMultiplier}</span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">INT: x{intensityMultiplier.toFixed(1)}</span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">IA: x{iaMultiplier}</span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">TYPE: x{typeMultiplier}</span>
                            </div>
                        </div>
                    </div>

                    {/* Yield Optimization AI */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 group-hover:scale-110 transition-transform">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">IA Yield Optimizer</h4>
                                    <p className="text-xs text-slate-500">Ajuste le routage en temps réel vers les zones à forte demande.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => updateSettings('yieldOptimizationIA', !settings.yieldOptimizationIA)}
                                className="focus:outline-none"
                            >
                                {settings.yieldOptimizationIA ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                            </button>
                        </div>
                    </div>

                    {/* Intensity Slider */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                                    <Gauge className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Intensité de Contribution</h4>
                                    <p className="text-xs text-slate-500">Définit la part de bande passante allouée au réseau.</p>
                                </div>
                            </div>
                            <div className="text-lg font-mono font-black text-brand-500">{settings.miningIntensity}%</div>
                        </div>
                        
                        <input 
                            type="range" 
                            min="10" 
                            max="100" 
                            step="10"
                            value={settings.miningIntensity}
                            onChange={(e) => updateSettings('miningIntensity', parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                        />
                        <div className="flex justify-between mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span className={settings.miningIntensity <= 30 ? 'text-brand-500' : ''}>Économique</span>
                            <span className={settings.miningIntensity > 30 && settings.miningIntensity <= 70 ? 'text-brand-500' : ''}>Balancé</span>
                            <span className={settings.miningIntensity > 70 ? 'text-brand-500' : ''}>Performance</span>
                        </div>
                    </div>

                    {/* Auto-Withdraw Toggle */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Retrait Automatique</h4>
                                    <p className="text-xs text-slate-500">Retire vos gains vers votre wallet dès 10 RNC accumulés.</p>
                                </div>
                            </div>
                            <button onClick={() => updateSettings('autoWithdraw', !settings.autoWithdraw)}>
                                {settings.autoWithdraw ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                            </button>
                        </div>
                    </div>

                    {/* Contribution Mode Selection */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase text-slate-500 ml-1">Rôle dans le Réseau</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(['passive', 'relay', 'exit'] as const).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => updateSettings('contributionType', type)}
                                    className={`p-4 rounded-2xl border text-left transition-all group ${
                                        settings.contributionType === type
                                            ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20 scale-[1.02]'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-brand-500/50'
                                    }`}
                                >
                                    <div className={`text-xs font-black uppercase mb-1 ${settings.contributionType === type ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                        {type === 'passive' ? 'Utilisateur' : type === 'relay' ? 'Relais' : 'Point de Sortie'}
                                    </div>
                                    <div className={`text-[10px] font-bold ${settings.contributionType === type ? 'text-brand-100' : 'text-slate-400'}`}>
                                        Boost : x{multipliers[type].toFixed(2)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Settings className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-sm font-medium">L'onglet {activeTab} est en cours de développement.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
