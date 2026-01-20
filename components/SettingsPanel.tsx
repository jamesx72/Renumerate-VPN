
import React, { useState } from 'react';
import { Settings, Shield, Zap, ToggleLeft, ToggleRight, X, Lock, Crown, Sliders, Activity, Wallet, Sparkles, Gauge, Fingerprint, Chrome, RefreshCw, Orbit, Layers, Globe, Globe2, Brain, Network, ArrowRightLeft, ShieldAlert, Clock, Cpu, Wifi, Server, Terminal, Target } from 'lucide-react';
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
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-[760px] bg-slate-900/90 border-2 border-brand-500/30 rounded-[4rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] flex overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Sidebar Tactique */}
        <div className="w-72 bg-black/40 border-r border-white/5 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="p-10">
              <h2 className="text-2xl font-black flex items-center gap-4 uppercase tracking-tighter text-white">
                <div className="p-2 bg-brand-500/20 rounded-xl border border-brand-500/30">
                    <Settings className="w-7 h-7 text-brand-500 animate-spin-slow" />
                </div>
                Console
              </h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 ml-1">Control_Center_v4.1</p>
            </div>

            <nav className="flex-1 px-6 space-y-2">
                {tabs.map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as TabId)} 
                        className={`w-full flex items-center gap-5 px-6 py-5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all relative group overflow-hidden ${
                            activeTab === tab.id 
                            ? 'bg-brand-600 text-white shadow-2xl shadow-brand-600/40 scale-105 z-10' 
                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                        }`}
                    >
                        {activeTab === tab.id && <div className="absolute inset-0 bg-scanline opacity-10 animate-scanline"></div>}
                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-600 group-hover:text-brand-500'}`} /> 
                        {tab.label}
                    </button>
                ))}
            </nav>

            <div className="p-8 border-t border-white/5">
                <div className="p-6 bg-black/60 rounded-3xl border border-white/5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isPremium ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Service: {userPlan.toUpperCase()}</span>
                    </div>
                    {!isPremium && (
                        <button onClick={onShowPricing} className="w-full py-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all">Upgrade_Required</button>
                    )}
                </div>
            </div>
        </div>

        {/* Panneau de Commandes Central */}
        <div className="flex-1 overflow-y-auto p-12 bg-black/20 relative custom-scrollbar">
            <button onClick={onClose} className="absolute top-8 right-8 p-3 hover:bg-white/10 rounded-2xl text-slate-500 transition-all active:scale-90 border border-white/5">
              <X className="w-7 h-7" />
            </button>

            {activeTab === 'general' && (
                <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Architecture Réseau</h3>
                            <div className="px-3 py-1 bg-brand-500/10 text-brand-500 text-[10px] font-black rounded-full border border-brand-500/20 shadow-sm shadow-brand-500/5 uppercase">Secure_Core</div>
                        </div>
                        <p className="text-sm text-slate-400 font-medium">Paramétrage chirurgical des couches de transport VPN.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <div className="bg-slate-900/60 p-8 rounded-[3rem] border border-white/10 space-y-10 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3">
                                        <Cpu className="w-4 h-4 text-brand-500" /> Protocol_Select
                                    </label>
                                    <div className="flex bg-black/60 p-2 rounded-[2rem] border border-white/5 gap-2">
                                        {(['wireguard', 'openvpn', 'ikev2'] as const).map((proto) => (
                                            <button
                                                key={proto}
                                                onClick={() => updateSettings('protocol', proto)}
                                                className={`flex-1 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${
                                                    settings.protocol === proto 
                                                    ? 'bg-brand-600 text-white shadow-xl shadow-brand-600/30' 
                                                    : 'text-slate-500 hover:text-white'
                                                }`}
                                            >
                                                {proto}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3">
                                        <Activity className="w-4 h-4 text-cyan-500" /> MTU_Payload_Size
                                    </label>
                                    <div className="relative group/input">
                                        <input 
                                            type="number" 
                                            value={settings.mtuSize} 
                                            onChange={(e) => updateSettings('mtuSize', parseInt(e.target.value))}
                                            className="w-full bg-black/60 border border-white/5 rounded-[2rem] py-4 px-8 text-sm font-mono font-black text-cyan-400 outline-none focus:border-brand-500 transition-all shadow-inner"
                                        />
                                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase tracking-widest">Bytes</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-white/5">
                                <div className="flex items-center justify-between p-6 bg-black/40 rounded-[2.5rem] border border-white/5 hover:border-emerald-500/30 transition-all group/opt">
                                    <div className="flex items-center gap-6">
                                        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500 group-hover/opt:scale-110 transition-transform"><Wifi className="w-6 h-6" /></div>
                                        <div>
                                            <h4 className="font-black text-white uppercase tracking-widest text-sm">LAN Bypass Module</h4>
                                            <p className="text-xs text-slate-500 mt-1 font-medium italic">Routage local intelligent pour périphériques domestiques.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => updateSettings('lanBypass', !settings.lanBypass)} className="active:scale-90 transition-transform">
                                        {settings.lanBypass ? <ToggleRight className="w-14 h-14 text-emerald-500" /> : <ToggleLeft className="w-14 h-14 text-slate-700" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Autres onglets bénéficiant de la même refonte structurelle... */}
            {activeTab === 'renumbering' && (
                 <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
                    <div className="space-y-2">
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Dynamic_Identity_Matrix</h3>
                        <p className="text-sm text-slate-400 font-medium">Configuration de la rotation cybernétique des signatures.</p>
                    </div>

                    <div className="bg-slate-900/60 p-10 rounded-[4rem] border border-white/10 space-y-10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-brand-500/10 rounded-2xl text-brand-500"><RefreshCw className="w-6 h-6" /></div>
                                <div>
                                    <h4 className="font-black text-white uppercase tracking-widest text-sm">Auto_Rotation_Engine</h4>
                                    <p className="text-xs text-slate-500 mt-1 font-medium italic">Commutation périodique des nœuds de sortie.</p>
                                </div>
                            </div>
                            <button onClick={() => updateSettings('autoRotation', !settings.autoRotation)} className="active:scale-90 transition-transform">
                                {settings.autoRotation ? <ToggleRight className="w-14 h-14 text-brand-500" /> : <ToggleLeft className="w-14 h-14 text-slate-700" />}
                            </button>
                        </div>

                        {settings.autoRotation && (
                            <div className="space-y-8 animate-in zoom-in-95 duration-300 bg-black/40 p-8 rounded-[3rem] border border-white/5">
                                <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                    <span className="flex items-center gap-3"><Clock className="w-4 h-4 text-brand-500" /> Rotation_Delay</span>
                                    <span className="text-brand-500 px-4 py-1 bg-brand-500/10 rounded-full border border-brand-500/20">{settings.rotationInterval} Minutes</span>
                                </div>
                                <div className="relative h-2">
                                    <input 
                                        type="range" min="5" max="120" step="5" 
                                        value={settings.rotationInterval} 
                                        onChange={(e)=>updateSettings('rotationInterval', parseInt(e.target.value))} 
                                        className="w-full h-full bg-slate-800 rounded-full appearance-none accent-brand-500 cursor-pointer" 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};
