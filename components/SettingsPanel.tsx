
import React, { useState } from 'react';
import { Settings, Shield, Zap, ToggleLeft, ToggleRight, X, Lock, Crown, Sliders, Activity, Wallet, Sparkles, Gauge, Fingerprint, Chrome, RefreshCw } from 'lucide-react';
import { AppSettings, PlanTier } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
}

type TabId = 'general' | 'renumbering' | 'security' | 'earnings';

export const SettingsPanel: React.FC<Props> = ({ settings, updateSettings, onClose, userPlan, onShowPricing }) => {
  const [activeTab, setActiveTab] = useState<TabId>('renumbering');
  
  const tabs = [
    { id: 'renumbering', label: 'Re-Numérotation', icon: RefreshCw },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'earnings', label: 'Gains RNC', icon: Wallet },
    { id: 'general', label: 'Général', icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[650px] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-6"><h2 className="text-xl font-bold flex items-center gap-2"><Settings className="w-6 h-6 text-brand-500" /> Paramètres</h2></div>
            <nav className="flex-1 p-4 space-y-1">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950 relative">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500"><X className="w-5 h-5" /></button>

            {activeTab === 'renumbering' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-widest">Moteur de Re-Numérotation</h3>
                        <p className="text-sm text-slate-500">Configurez l'automatisme de changement de votre identité numérique.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><RefreshCw className="w-5 h-5" /></div>
                                <div><h4 className="font-bold text-sm">Rotation Automatique d'IP</h4><p className="text-xs text-slate-500">Change de nœud de sortie à intervalles réguliers.</p></div>
                            </div>
                            <button onClick={() => updateSettings('autoRotation', !settings.autoRotation)}>{settings.autoRotation ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300" />}</button>
                        </div>
                        {settings.autoRotation && (
                            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Intervalle</span><span className="text-brand-500">{settings.rotationInterval} min</span></div>
                                <input type="range" min="5" max="60" step="5" value={settings.rotationInterval} onChange={(e)=>updateSettings('rotationInterval', parseInt(e.target.value))} className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none accent-brand-500" />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Fingerprint className="w-4 h-4" /> Mode MAC</h4>
                            <select value={settings.macScramblingMode} onChange={(e)=>updateSettings('macScramblingMode', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 text-xs font-bold px-3">
                                <option value="random">Aléatoire Total</option>
                                <option value="vendor">Vendeur Réel (Spoof)</option>
                                <option value="laa">Forcer LAA (Local)</option>
                            </select>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Chrome className="w-4 h-4" /> Complexité UA</h4>
                            <select value={settings.uaComplexity} onChange={(e)=>updateSettings('uaComplexity', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 text-xs font-bold px-3">
                                <option value="standard">Standard (OS Actuel)</option>
                                <option value="diverse">Diversifié (Multi-Plateforme)</option>
                                <option value="chaotic">Chaotique (IA Driven)</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'security' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-bold">Sécurité & Protocoles</h3>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div><h4 className="font-bold text-sm">Kill Switch Réseau</h4><p className="text-xs text-slate-500">Coupe Internet si le VPN se déconnecte.</p></div>
                            <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)}>{settings.killSwitch ? <ToggleRight className="w-10 h-10 text-red-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300" />}</button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div><h4 className="font-bold text-sm">DNS Leak Protection</h4><p className="text-xs text-slate-500">Force les requêtes DNS dans le tunnel.</p></div>
                            <button onClick={() => updateSettings('dnsLeakProtection', !settings.dnsLeakProtection)}>{settings.dnsLeakProtection ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300" />}</button>
                        </div>
                    </div>
                </div>
            )}

            {(activeTab === 'earnings' || activeTab === 'general') && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
                    <Settings className="w-12 h-12 mb-4" />
                    <p className="text-sm">Paramètres en cours d'optimisation...</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
