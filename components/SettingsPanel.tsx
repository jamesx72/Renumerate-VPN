
import React, { useState } from 'react';
import { Settings, Shield, Zap, ToggleLeft, ToggleRight, X, Lock, Crown, Sliders, Activity, Wallet, Sparkles, Gauge, Fingerprint, Chrome, RefreshCw, Orbit, Layers, Globe, Globe2 } from 'lucide-react';
import { AppSettings, PlanTier } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
}

type TabId = 'general' | 'renumbering' | 'vortex' | 'security' | 'earnings';

export const SettingsPanel: React.FC<Props> = ({ settings, updateSettings, onClose, userPlan, onShowPricing }) => {
  const [activeTab, setActiveTab] = useState<TabId>('vortex');
  
  const tabs = [
    { id: 'vortex', label: 'Vortex (Tor)', icon: Orbit },
    { id: 'renumbering', label: 'Identité', icon: Fingerprint },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'earnings', label: 'Gains RNC', icon: Wallet },
    { id: 'general', label: 'Général', icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[680px] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-6">
              <h2 className="text-xl font-black flex items-center gap-2 uppercase tracking-tighter">
                <Settings className="w-6 h-6 text-brand-500" /> Paramètres
              </h2>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {tabs.map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as TabId)} 
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === tab.id 
                            ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-700' 
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-950 relative">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
              <X className="w-6 h-6" />
            </button>

            {activeTab === 'vortex' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Configuration Vortex</h3>
                            <div className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[8px] font-black rounded border border-purple-500/20">ADVANCED TOR ENGINE</div>
                        </div>
                        <p className="text-sm text-slate-500">Ajustez les paramètres de routage en oignon pour une invisibilité maximale.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500"><Layers className="w-5 h-5" /></div>
                                <div>
                                    <h4 className="font-bold text-sm">Ponts d'Obfuscation (Bridges)</h4>
                                    <p className="text-xs text-slate-500">Utilisez des ponts pour contourner les pare-feu anti-Tor.</p>
                                </div>
                            </div>
                            <select 
                                value={settings.vortexBridge} 
                                onChange={(e) => updateSettings('vortexBridge', e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-purple-500/20"
                            >
                                <option value="none">Aucun (Direct)</option>
                                <option value="obfs4">obfs4 (Recommandé)</option>
                                <option value="snowflake">Snowflake</option>
                                <option value="meek-azure">Meek-Azure</option>
                            </select>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between text-xs font-black text-slate-500 uppercase mb-4">
                                <span>Longueur du Circuit</span>
                                <span className="text-purple-500">{settings.vortexCircuitLength} Sauts</span>
                            </div>
                            <input 
                                type="range" min="3" max="7" step="1" 
                                value={settings.vortexCircuitLength} 
                                onChange={(e)=>updateSettings('vortexCircuitLength', parseInt(e.target.value))} 
                                className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none accent-purple-500" 
                            />
                            <div className="flex justify-between mt-2">
                                <span className="text-[9px] font-bold text-slate-400">RAPIDE (3)</span>
                                <span className="text-[9px] font-bold text-slate-400">ULTRA-SÉCURISÉ (7)</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-purple-500" /> Nœud de Sortie</h4>
                            <select 
                                value={settings.vortexExitNodeCountry} 
                                onChange={(e)=>updateSettings('vortexExitNodeCountry', e.target.value)} 
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 text-xs font-bold px-3 uppercase tracking-tighter"
                            >
                                <option value="auto">Aléatoire (Auto)</option>
                                <option value="FR">France</option>
                                <option value="CH">Suisse</option>
                                <option value="IS">Islande</option>
                                <option value="PA">Panama</option>
                            </select>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Lock className="w-4 h-4 text-purple-500" /> NoScript</h4>
                                <button onClick={() => updateSettings('vortexNoScript', !settings.vortexNoScript)}>
                                    {settings.vortexNoScript ? <ToggleRight className="w-8 h-8 text-purple-500" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">Bloque tous les scripts JS dans le tunnel Vortex.</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'renumbering' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Moteur d'Identité</h3>
                        <p className="text-sm text-slate-500">Configurez l'anonymisation de votre empreinte numérique.</p>
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
                             {/* Added Globe2 to imports to fix missing name error */}
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Globe2 className="w-4 h-4" /> Format MAC</h4>
                            <select value={settings.macFormat} onChange={(e)=>updateSettings('macFormat', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 text-xs font-bold px-3">
                                <option value="random">Aléatoire (Auto)</option>
                                <option value="standard">Standard (XX:XX)</option>
                                <option value="hyphen">Windows (XX-XX)</option>
                                <option value="cisco">Cisco (XXXX.XXXX)</option>
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
