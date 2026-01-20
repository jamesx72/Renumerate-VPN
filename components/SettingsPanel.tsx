
import React, { useState } from 'react';
import { Settings, Shield, Zap, ToggleLeft, ToggleRight, X, Lock, Crown, Sliders, Activity, Wallet, Sparkles, Gauge, Fingerprint, Chrome, RefreshCw, Orbit, Layers, Globe, Globe2, Brain, Network, ArrowRightLeft, ShieldAlert, Clock, Cpu, Wifi, Server, Terminal } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<TabId>('general');
  
  const tabs = [
    { id: 'general', label: 'Réseau', icon: Sliders },
    { id: 'vortex', label: 'Vortex (Tor)', icon: Orbit },
    { id: 'renumbering', label: 'Identité', icon: Fingerprint },
    { id: 'security', label: 'Vie Privée', icon: Shield },
    { id: 'earnings', label: 'Monétisation', icon: Wallet },
  ];

  const isPremium = userPlan !== 'free';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[720px] bg-white dark:bg-slate-950 rounded-[3rem] shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-8">
              <h2 className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter">
                <Settings className="w-6 h-6 text-brand-500 animate-spin-slow" /> Config
              </h2>
            </div>
            <nav className="flex-1 px-4 pb-4 space-y-1">
                {tabs.map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as TabId)} 
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === tab.id 
                            ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xl border border-slate-200 dark:border-slate-700 scale-[1.02]' 
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </nav>
            <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800">
                <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isPremium ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Node Status: {userPlan.toUpperCase()}</span>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 dark:bg-slate-950 relative custom-scrollbar">
            <button onClick={onClose} className="absolute top-6 right-6 p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-2xl text-slate-500 transition-all active:scale-90">
              <X className="w-6 h-6" />
            </button>

            {/* Network / General Tab */}
            {activeTab === 'general' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Architecture Réseau</h3>
                            <div className="px-2 py-0.5 bg-brand-500/10 text-brand-500 text-[8px] font-black rounded border border-brand-500/20">LOW LATENCY OPS</div>
                        </div>
                        <p className="text-sm text-slate-500">Optimisez les protocoles de transport pour votre environnement.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 space-y-8">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Cpu className="w-3.5 h-3.5" /> Protocole Tunnel
                                </label>
                                <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 border border-slate-100 dark:border-slate-700">
                                    {(['wireguard', 'openvpn', 'ikev2'] as const).map((proto) => (
                                        <button
                                            key={proto}
                                            onClick={() => updateSettings('protocol', proto)}
                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all uppercase ${
                                                settings.protocol === proto 
                                                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-lg ring-1 ring-black/5' 
                                                : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            {proto}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5" /> Taille MTU
                                </label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={settings.mtuSize} 
                                        onChange={(e) => updateSettings('mtuSize', parseInt(e.target.value))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-sm font-bold outline-none focus:border-brand-500 transition-colors"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Bytes</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><Wifi className="w-5 h-5" /></div>
                                    <div>
                                        <h4 className="font-bold text-sm">LAN Bypass (Réseau Local)</h4>
                                        <p className="text-xs text-slate-500">Permet d'accéder aux imprimantes et serveurs locaux.</p>
                                    </div>
                                </div>
                                <button onClick={() => updateSettings('lanBypass', !settings.lanBypass)}>
                                    {settings.lanBypass ? <ToggleRight className="w-12 h-12 text-emerald-500" /> : <ToggleLeft className="w-12 h-12 text-slate-300" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'vortex' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Configuration Vortex</h3>
                            <div className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[8px] font-black rounded border border-purple-500/20">ADVANCED TOR ENGINE</div>
                        </div>
                        <p className="text-sm text-slate-500">Ajustez les paramètres de routage en oignon pour une invisibilité maximale.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500"><Layers className="w-5 h-5" /></div>
                                <div>
                                    <h4 className="font-bold text-sm">Ponts d'Obfuscation (Bridges)</h4>
                                    <p className="text-xs text-slate-500">Utilisez des ponts pour contourner les DPI (Deep Packet Inspection).</p>
                                </div>
                            </div>
                            <select 
                                value={settings.vortexBridge} 
                                onChange={(e) => updateSettings('vortexBridge', e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-purple-500/5 transition-all"
                            >
                                <option value="none">Direct Connection</option>
                                <option value="obfs4">obfs4 (High Obfuscation)</option>
                                <option value="snowflake">Snowflake (P2P)</option>
                                <option value="meek-azure">Meek-Azure (Cloud)</option>
                            </select>
                        </div>

                        <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase mb-5">
                                <span className="flex items-center gap-2"><ArrowRightLeft className="w-3.5 h-3.5" /> Longueur du Circuit</span>
                                <span className="text-purple-500 bg-purple-500/10 px-3 py-1 rounded-full">{settings.vortexCircuitLength} Sauts</span>
                            </div>
                            <input 
                                type="range" min="3" max="7" step="1" 
                                value={settings.vortexCircuitLength} 
                                onChange={(e)=>updateSettings('vortexCircuitLength', parseInt(e.target.value))} 
                                className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none accent-purple-500 cursor-pointer" 
                            />
                            <div className="flex justify-between mt-3">
                                <span className="text-[9px] font-black text-slate-400">RAPIDE (3)</span>
                                <span className="text-[9px] font-black text-slate-400">SÉCURITÉ MAX (7)</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-purple-500" /> Nœud d'Entrée</h4>
                            <select 
                                value={settings.vortexEntryNodeCountry} 
                                onChange={(e)=>updateSettings('vortexEntryNodeCountry', e.target.value)} 
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 text-xs font-black px-4 uppercase transition-all focus:border-purple-500"
                            >
                                <option value="auto">Auto Selection</option>
                                <option value="DE">Germany</option>
                                <option value="NL">Netherlands</option>
                                <option value="US">USA</option>
                            </select>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2"><Server className="w-4 h-4 text-purple-500" /> Nœud de Sortie</h4>
                            <select 
                                value={settings.vortexExitNodeCountry} 
                                onChange={(e)=>updateSettings('vortexExitNodeCountry', e.target.value)} 
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 text-xs font-black px-4 uppercase transition-all focus:border-purple-500"
                            >
                                <option value="auto">Auto Selection</option>
                                <option value="CH">Switzerland</option>
                                <option value="IS">Iceland</option>
                                <option value="PA">Panama</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'security' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Vie Privée & Blindage</h3>
                        <p className="text-sm text-slate-500">Configurez les barrières de protection de votre tunnel.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 space-y-8">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Terminal className="w-5 h-5" /></div>
                                    <div>
                                        <h4 className="font-bold text-sm">Système DNS</h4>
                                        <p className="text-xs text-slate-500">Sélectionnez votre résolveur de confiance.</p>
                                    </div>
                                </div>
                                <select 
                                    value={settings.dns} 
                                    onChange={(e) => updateSettings('dns', e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-xs font-black uppercase outline-none transition-all"
                                >
                                    <option value="cloudflare">Cloudflare (1.1.1.1)</option>
                                    <option value="google">Google (8.8.8.8)</option>
                                    <option value="quad9">Quad9 (Secured)</option>
                                    <option value="custom">Custom Server</option>
                                </select>
                            </div>

                            {settings.dns === 'custom' && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Custom DNS IP</label>
                                    <input 
                                        type="text" 
                                        value={settings.customDnsServer}
                                        onChange={(e) => updateSettings('customDnsServer', e.target.value)}
                                        placeholder="0.0.0.0"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-sm font-mono focus:border-brand-500 transition-all"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-500/10 rounded-2xl text-red-500"><ShieldAlert className="w-5 h-5" /></div>
                                <div>
                                    <h4 className="font-bold text-sm">Kill Switch Réseau</h4>
                                    <p className="text-xs text-slate-500">Interrompt tout trafic si la liaison VPN est instable.</p>
                                </div>
                            </div>
                            <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)}>
                                {settings.killSwitch ? <ToggleRight className="w-12 h-12 text-red-500" /> : <ToggleLeft className="w-12 h-12 text-slate-300" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'renumbering' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Moteur d'Identité Dynamique</h3>
                        <p className="text-sm text-slate-500">Configurez l'anonymisation de votre empreinte matérielle et logicielle.</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-brand-500/10 rounded-2xl text-brand-500"><RefreshCw className="w-5 h-5" /></div>
                                <div>
                                    <h4 className="font-bold text-sm">Rotation Automatique d'IP</h4>
                                    <p className="text-xs text-slate-500">Change de nœud de sortie périodiquement.</p>
                                </div>
                            </div>
                            <button onClick={() => updateSettings('autoRotation', !settings.autoRotation)}>
                                {settings.autoRotation ? <ToggleRight className="w-12 h-12 text-brand-500" /> : <ToggleLeft className="w-12 h-12 text-slate-300" />}
                            </button>
                        </div>

                        {settings.autoRotation && (
                            <div className="space-y-5 animate-in slide-in-from-top-2">
                                <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase">
                                    <span>Intervalle de Rotation</span>
                                    <span className="text-brand-500">{settings.rotationInterval} min</span>
                                </div>
                                <input 
                                    type="range" min="5" max="120" step="5" 
                                    value={settings.rotationInterval} 
                                    onChange={(e)=>updateSettings('rotationInterval', parseInt(e.target.value))} 
                                    className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none accent-brand-500 cursor-pointer" 
                                />
                            </div>
                        )}

                        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Mode Spoofing MAC</label>
                                <select 
                                    value={settings.macScramblingMode} 
                                    onChange={(e)=>updateSettings('macScramblingMode', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-xs font-black uppercase outline-none focus:border-brand-500 transition-all"
                                >
                                    <option value="random">Aléatoire Total</option>
                                    <option value="vendor">Simuler Vendeur Réel</option>
                                    <option value="laa">Forcer Unicast Local</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Complexité User-Agent</label>
                                <select 
                                    value={settings.uaComplexity} 
                                    onChange={(e)=>updateSettings('uaComplexity', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-5 text-xs font-black uppercase outline-none focus:border-brand-500 transition-all"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="diverse">Diversifiée</option>
                                    <option value="chaotic">Chaotique (Random)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'earnings' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Algorithme de Rendement</h3>
                            <p className="text-sm text-slate-500">Générez des jetons RNC en contribuant au réseau global.</p>
                        </div>
                        {!isPremium && (
                            <button 
                                onClick={onShowPricing}
                                className="flex items-center gap-3 px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-amber-500/30 hover:scale-105 transition-all"
                            >
                                <Crown className="w-4 h-4" /> Activer ELITE
                            </button>
                        )}
                    </div>

                    <div className={`space-y-8 ${!isPremium ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><Gauge className="w-5 h-5" /></div>
                                    <div>
                                        <h4 className="font-bold text-sm">Intensité de Contribution</h4>
                                        <p className="text-xs text-slate-500">Allocation des ressources processeur pour le minage réseau.</p>
                                    </div>
                                </div>
                                <span className="text-sm font-black font-mono text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full">{settings.miningIntensity}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="100" step="10" 
                                value={settings.miningIntensity} 
                                onChange={(e)=>updateSettings('miningIntensity', parseInt(e.target.value))} 
                                className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" 
                            />
                            <div className="flex justify-between mt-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Economie (Passif)</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase">Puissance (Actif)</span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-brand-500/10 rounded-2xl text-brand-500"><Brain className="w-5 h-5" /></div>
                                <div>
                                    <h4 className="font-bold text-sm">Optimisation IA</h4>
                                    <p className="text-xs text-slate-500">Bascule intelligemment entre les nœuds les plus rentables.</p>
                                </div>
                            </div>
                            <button onClick={() => updateSettings('yieldOptimizationIA', !settings.yieldOptimizationIA)}>
                                {settings.yieldOptimizationIA ? <ToggleRight className="w-12 h-12 text-brand-500" /> : <ToggleLeft className="w-12 h-12 text-slate-300" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
