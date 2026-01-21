
import React, { useState } from 'react';
import { Settings, Shield, Zap, ToggleLeft, ToggleRight, X, Lock, Crown, Sliders, Activity, Wallet, Sparkles, Gauge, Fingerprint, Chrome, RefreshCw, Orbit, Layers, Globe, Globe2, Brain, Network, ArrowRightLeft, ShieldAlert, Clock, Cpu, Wifi, Server, Terminal, Target, Search, MousePointer2, Ghost, Rocket, ZapOff, Info, ChevronRight, ShieldCheck, Wand2, Check } from 'lucide-react';
import { AppSettings, PlanTier, ConfigurationPreset } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
}

type TabId = 'wizard' | 'general' | 'renumbering' | 'vortex' | 'security' | 'earnings';

export const SettingsPanel: React.FC<Props> = ({ settings, updateSettings, onClose, userPlan, onShowPricing }) => {
  const [activeTab, setActiveTab] = useState<TabId>('wizard');
  const [wizardStep, setWizardStep] = useState(1);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  
  const tabs = [
    { id: 'wizard', label: 'Setup_Wizard', icon: Wand2 },
    { id: 'general', label: 'Réseau', icon: Network },
    { id: 'vortex', label: 'Vortex', icon: Orbit },
    { id: 'renumbering', label: 'Identité', icon: Fingerprint },
    { id: 'security', label: 'Shield', icon: Shield },
    { id: 'earnings', label: 'RNC_Gains', icon: Wallet },
  ];

  const isPremium = userPlan !== 'free';

  const applyPreset = (preset: ConfigurationPreset) => {
      switch(preset) {
          case 'stealth_max':
              updateSettings('protocol', 'openvpn');
              updateSettings('obfuscationLevel', 'ultra');
              updateSettings('autoRotation', true);
              updateSettings('rotationInterval', 10);
              updateSettings('uaComplexity', 'chaotic');
              break;
          case 'speed_ultra':
              updateSettings('protocol', 'wireguard');
              updateSettings('mtuSize', 1420);
              updateSettings('dnsLeakProtection', true);
              updateSettings('killSwitch', false);
              break;
          case 'vortex_deep':
              updateSettings('vortexBridge', 'meek-azure');
              updateSettings('vortexCircuitLength', 4);
              updateSettings('vortexNoScript', true);
              break;
          default: // balanced
              updateSettings('protocol', 'wireguard');
              updateSettings('mtuSize', 1400);
              updateSettings('autoRotation', false);
              updateSettings('obfuscationLevel', 'standard');
      }
  };

  const dnsProviders = [
    { id: 'cloudflare', label: 'Cloudflare', ip: '1.1.1.1' },
    { id: 'google', label: 'Google', ip: '8.8.8.8' },
    { id: 'quad9', label: 'Quad9', ip: '9.9.9.9' },
    { id: 'custom', label: 'Custom', ip: '---' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-6xl h-[820px] bg-slate-900/80 border-2 border-brand-500/30 rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Navigation Sidebar */}
        <div className="w-80 bg-black/40 border-r border-white/5 flex flex-col relative overflow-hidden text-white">
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="p-10 pb-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-brand-500/10 rounded-2xl border border-brand-500/30 shadow-lg shadow-brand-500/20">
                    <Settings className="w-8 h-8 text-brand-500 animate-spin-slow" />
                </div>
                <div>
                   <h2 className="text-2xl font-black text-white uppercase tracking-tighter">COCKPIT</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-0.5">Control_OS v4.5</p>
                </div>
              </div>

              {/* Presets Quick Select */}
              <div className="space-y-3 mb-10 bg-black/40 p-5 rounded-[2rem] border border-white/5">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Neural_Presets</p>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onMouseEnter={()=>setHoveredPreset('speed')} 
                        onClick={()=>applyPreset('speed_ultra')}
                        className="p-3 bg-slate-900 border border-white/5 rounded-xl flex flex-col items-center gap-1 hover:border-cyan-500 transition-all group"
                    >
                        <Rocket className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase text-slate-500">Fast_Track</span>
                    </button>
                    <button 
                        onMouseEnter={()=>setHoveredPreset('stealth')} 
                        onClick={()=>applyPreset('stealth_max')}
                        className="p-3 bg-slate-900 border border-white/5 rounded-xl flex flex-col items-center gap-1 hover:border-purple-500 transition-all group"
                    >
                        <Ghost className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase text-slate-500">Dark_Ghost</span>
                    </button>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-6 space-y-1 overflow-y-auto custom-scrollbar">
                {tabs.map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as TabId)} 
                        className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all relative group overflow-hidden ${
                            activeTab === tab.id 
                            ? 'bg-brand-600 text-white shadow-2xl shadow-brand-600/40 translate-x-2 z-10' 
                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                        }`}
                    >
                        <div className="flex items-center gap-5">
                            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-600 group-hover:text-brand-500'}`} /> 
                            {tab.label}
                        </div>
                        {activeTab === tab.id && <ChevronRight className="w-4 h-4 animate-in slide-in-from-left-2" />}
                    </button>
                ))}
            </nav>

            <div className="p-8 border-t border-white/5 mt-auto">
                <div className="p-6 bg-black/60 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-1">Account_Auth</span>
                        <span className="text-[10px] font-black text-brand-400 uppercase">{userPlan}_TIER</span>
                    </div>
                    {isPremium ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-amber-500" />}
                </div>
            </div>
        </div>

        {/* Dynamic Content Panel */}
        <div className="flex-1 overflow-y-auto p-12 bg-black/20 relative custom-scrollbar">
            <div className="absolute top-0 right-0 p-8 flex items-center gap-4">
                <div className="flex flex-col text-right">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active_Profile</span>
                    <span className="text-[10px] font-mono font-bold text-brand-500">SESSION-{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                </div>
                <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-3xl text-slate-500 transition-all border border-white/5 hover:rotate-90">
                    <X className="w-7 h-7" />
                </button>
            </div>

            {activeTab === 'wizard' && (
                <div className="space-y-12 animate-in slide-in-from-right-8 duration-500 max-w-3xl mx-auto">
                    <div className="text-center space-y-4">
                        <div className="inline-flex p-5 rounded-[2rem] bg-brand-500/10 border border-brand-500/20 shadow-2xl mb-4">
                            <Wand2 className="w-12 h-12 text-brand-500 animate-pulse" />
                        </div>
                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Configuration_Wizard</h3>
                        <p className="text-sm text-slate-400 font-medium">Optimisons votre expérience Renumerate en {wizardStep}/3 étapes.</p>
                    </div>

                    <div className="bg-slate-900/60 p-12 rounded-[4rem] border border-white/10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
                        
                        {wizardStep === 1 && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.4em]">Step_01</span>
                                    <h4 className="text-2xl font-black text-white uppercase">Primary_Objective</h4>
                                    <p className="text-xs text-slate-500">Quelle est votre priorité d'utilisation du tunnel ?</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {[
                                        { id: 'speed_ultra', label: 'Vitesse & Gaming', desc: 'Protocol Wireguard, MTU optimisé', icon: Rocket, color: 'text-cyan-500' },
                                        { id: 'stealth_max', label: 'Anonymat Total', desc: 'OpenVPN + Obfuscation Ultra', icon: Ghost, color: 'text-purple-500' },
                                        { id: 'balanced', label: 'Usage Polyvalent', desc: 'Équilibre entre débit et sécurité', icon: Shield, color: 'text-emerald-500' }
                                    ].map(obj => (
                                        <button 
                                            key={obj.id}
                                            onClick={() => { applyPreset(obj.id as any); setWizardStep(2); }}
                                            className="p-6 rounded-3xl bg-black/40 border border-white/5 hover:border-brand-500/50 transition-all flex items-center gap-6 group"
                                        >
                                            <div className={`p-4 rounded-2xl bg-white/5 ${obj.color} group-hover:scale-110 transition-transform`}>
                                                <obj.icon className="w-8 h-8" />
                                            </div>
                                            <div className="text-left">
                                                <h5 className="font-black text-white uppercase text-sm">{obj.label}</h5>
                                                <p className="text-[10px] text-slate-500 mt-1">{obj.desc}</p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-700 ml-auto group-hover:text-brand-500 transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {wizardStep === 2 && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Step_02</span>
                                    <h4 className="text-2xl font-black text-white uppercase">Monetization_Setup</h4>
                                    <p className="text-xs text-slate-500">Souhaitez-vous monétiser votre connexion ?</p>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <button 
                                        onClick={() => { updateSettings('miningIntensity', 0); setWizardStep(3); }}
                                        className="p-10 rounded-[3rem] bg-black/40 border border-white/5 hover:border-slate-500 transition-all flex flex-col items-center text-center gap-6 group"
                                    >
                                        <div className="p-5 rounded-full bg-slate-500/10 text-slate-500"><ZapOff className="w-10 h-10" /></div>
                                        <h5 className="font-black text-white uppercase">Mode Passif</h5>
                                        <p className="text-[10px] text-slate-600">VPN Seul. Pas de gains RNC.</p>
                                    </button>
                                    <button 
                                        onClick={() => { updateSettings('miningIntensity', 75); updateSettings('yieldOptimizationIA', true); setWizardStep(3); }}
                                        className="p-10 rounded-[3rem] bg-amber-500/5 border border-amber-500/20 hover:border-amber-500 transition-all flex flex-col items-center text-center gap-6 group"
                                    >
                                        <div className="p-5 rounded-full bg-amber-500/10 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]"><Wallet className="w-10 h-10" /></div>
                                        <h5 className="font-black text-white uppercase">Mode Nœud Actif</h5>
                                        <p className="text-[10px] text-slate-600">Gagnez des RNC en relayant des paquets.</p>
                                    </button>
                                </div>
                                <button onClick={() => setWizardStep(1)} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-white transition-colors">Retour</button>
                            </div>
                        )}

                        {wizardStep === 3 && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 text-center">
                                <div className="space-y-4">
                                    <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                                        <Check className="w-12 h-12 text-emerald-500 stroke-[4px]" />
                                    </div>
                                    <h4 className="text-3xl font-black text-white uppercase tracking-tighter">Cockpit_Ready</h4>
                                    <p className="text-sm text-slate-400">Le profil neuronal de votre tunnel est synchronisé avec le réseau Renumerate.</p>
                                </div>
                                <div className="p-6 bg-black/60 rounded-3xl border border-white/5 grid grid-cols-2 gap-4 text-left">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-slate-600 uppercase">Protocol</span>
                                        <p className="text-xs font-mono font-bold text-brand-500">{settings.protocol.toUpperCase()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-slate-600 uppercase">Intensity</span>
                                        <p className="text-xs font-mono font-bold text-amber-500">{settings.miningIntensity}%</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={onClose}
                                    className="w-full py-6 rounded-[2.5rem] bg-brand-600 hover:bg-brand-500 text-white font-black uppercase tracking-[0.4em] shadow-2xl shadow-brand-500/20 active:scale-95 transition-all"
                                >
                                    INITIALIZE_SESSION
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'general' && (
                <div className="space-y-12 animate-in slide-in-from-right-8 duration-500">
                    <div className="space-y-2 text-white">
                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Transport_Layer</h3>
                        <p className="text-sm text-slate-400 font-medium max-w-xl">Optimisez les protocoles d'échange et la fragmentation des paquets pour un tunnel ultra-performant.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-10">
                        <div className="bg-slate-900/60 p-10 rounded-[3rem] border border-white/10 space-y-12 relative group overflow-hidden">
                            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
                            
                            <div className="space-y-6">
                                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-4">
                                    <Cpu className="w-5 h-5 text-brand-500" /> Protocol_Architecture
                                </label>
                                <div className="grid grid-cols-3 gap-4 bg-black/60 p-3 rounded-[2.5rem] border border-white/5">
                                    {(['wireguard', 'openvpn', 'ikev2'] as const).map((proto) => (
                                        <button
                                            key={proto}
                                            onClick={() => updateSettings('protocol', proto)}
                                            className={`py-6 rounded-3xl text-[10px] font-black transition-all uppercase tracking-[0.2em] relative overflow-hidden group/proto ${
                                                settings.protocol === proto 
                                                ? 'bg-brand-600 text-white shadow-2xl' 
                                                : 'text-slate-600 hover:text-slate-300'
                                            }`}
                                        >
                                            {proto}
                                            {settings.protocol === proto && <div className="absolute inset-0 bg-scanline opacity-20"></div>}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-600 font-medium italic pl-4">>> Recommandé : Wireguard pour la performance, OpenVPN pour l'obfuscation.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-4">
                                        <ArrowRightLeft className="w-5 h-5 text-cyan-500" /> MTU_Segment_Size
                                    </label>
                                    <div className="relative group/input">
                                        <input 
                                            type="number" 
                                            value={settings.mtuSize} 
                                            onChange={(e) => updateSettings('mtuSize', parseInt(e.target.value))}
                                            className="w-full bg-black/60 border border-white/5 rounded-[2rem] py-6 px-10 text-xl font-mono font-black text-cyan-400 outline-none focus:border-cyan-500 transition-all shadow-inner"
                                        />
                                        <div className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700 uppercase tracking-widest">Bytes</div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-4">
                                        <Zap className="w-5 h-5 text-amber-500" /> Reconnect_Engine
                                    </label>
                                    <div className="relative group/input">
                                        <input 
                                            type="number" 
                                            value={settings.reconnectDelay} 
                                            onChange={(e) => updateSettings('reconnectDelay', parseInt(e.target.value))}
                                            className="w-full bg-black/60 border border-white/5 rounded-[2rem] py-6 px-10 text-xl font-mono font-black text-amber-400 outline-none focus:border-amber-500 transition-all shadow-inner"
                                        />
                                        <div className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700 uppercase tracking-widest">Sec</div>
                                    </div>
                                </div>
                            </div>

                            {/* SOCKS5 Proxy Section */}
                            <div className="pt-10 border-t border-white/5 space-y-8">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-4">
                                        <Shield className="w-5 h-5 text-emerald-500" /> SOCKS5_Proxy_Tunnel
                                    </label>
                                    <button onClick={() => updateSettings('socks5Enabled', !settings.socks5Enabled)} className="active:scale-90 transition-transform">
                                        {settings.socks5Enabled ? <ToggleRight className="w-16 h-16 text-emerald-500" /> : <ToggleLeft className="w-16 h-16 text-slate-700" />}
                                    </button>
                                </div>
                                
                                {settings.socks5Enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-4">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-4">Proxy_Host</span>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={settings.socks5Host} 
                                                    onChange={(e) => updateSettings('socks5Host', e.target.value)}
                                                    className="w-full bg-black/60 border border-white/5 rounded-2xl py-4 px-6 text-sm font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all"
                                                    placeholder="127.0.0.1"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-4">Proxy_Port</span>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    value={settings.socks5Port} 
                                                    onChange={(e) => updateSettings('socks5Port', parseInt(e.target.value))}
                                                    className="w-full bg-black/60 border border-white/5 rounded-2xl py-4 px-6 text-sm font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all"
                                                    placeholder="1080"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'earnings' && (
                 <div className="space-y-12 animate-in slide-in-from-right-8 duration-500">
                    <div className="space-y-2">
                        <div className="flex items-center gap-6">
                            <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Monetization_Logic</h3>
                            <div className="px-5 py-2 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full border border-amber-500/20 uppercase tracking-widest shadow-lg shadow-amber-500/10 animate-pulse">ACTIVE_REWARD_GEN</div>
                        </div>
                        <p className="text-sm text-slate-400 font-medium">Configurez comment votre nœud contribue à la matrice globale et accumule des RNC.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-10">
                        <div className="bg-slate-900/60 p-10 rounded-[4rem] border border-white/10 space-y-12 relative overflow-hidden">
                            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
                            
                            <div className="space-y-8">
                                <div className="flex items-center justify-between px-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-4">
                                        <Activity className="w-5 h-5 text-amber-500" /> Contribution_Intensity
                                    </label>
                                    <span className="text-xl font-mono font-black text-amber-500">{settings.miningIntensity}%</span>
                                </div>
                                <div className="relative h-4 bg-black/60 rounded-full border border-white/5 p-1">
                                    <input 
                                        type="range" min="0" max="100" step="5" 
                                        value={settings.miningIntensity} 
                                        onChange={(e)=>updateSettings('miningIntensity', parseInt(e.target.value))} 
                                        className="w-full h-full bg-transparent appearance-none accent-amber-500 cursor-pointer" 
                                    />
                                </div>
                                <p className="text-[10px] text-slate-600 font-bold italic">>> Plus l'intensité est élevée, plus votre CPU/Bande passante est sollicité pour le relayage réseau.</p>
                            </div>

                            <div className="space-y-8">
                                <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-4 pl-4">
                                    <Globe className="w-5 h-5 text-cyan-500" /> Contribution_Type
                                </label>
                                <div className="grid grid-cols-3 gap-6">
                                    {(['passive', 'relay', 'exit'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => updateSettings('contributionType', type)}
                                            className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-4 relative overflow-hidden group/type ${
                                                settings.contributionType === type 
                                                ? 'bg-amber-500/10 border-amber-500 text-white shadow-2xl' 
                                                : 'bg-black/40 border-white/5 text-slate-600 hover:border-white/20'
                                            }`}
                                        >
                                            <div className={`p-4 rounded-2xl transition-all ${settings.contributionType === type ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                {type === 'passive' ? <ZapOff className="w-6 h-6" /> : type === 'relay' ? <Layers className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                                            </div>
                                            <div className="text-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest block mb-1">{type}</span>
                                                <span className={`text-[8px] font-bold uppercase ${settings.contributionType === type ? 'text-amber-500' : 'text-slate-700'}`}>
                                                    {type === 'passive' ? 'Bonus X1.0' : type === 'relay' ? 'Bonus X1.25' : 'Bonus X1.50'}
                                                </span>
                                            </div>
                                            {type === 'exit' && !isPremium && (
                                                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                                                     <Lock className="w-6 h-6 text-slate-600 mb-2" />
                                                     <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Elite_Plan_Required</span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-10 border-t border-white/5 grid grid-cols-2 gap-8">
                                <div className="flex items-center justify-between p-8 bg-black/40 rounded-[2.5rem] border border-white/5 group/opt hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500"><Brain className="w-7 h-7" /></div>
                                        <div>
                                            <h4 className="font-black text-white uppercase tracking-widest text-sm">Yield_Optimizer_IA</h4>
                                            <p className="text-[10px] text-slate-600 mt-1 uppercase font-black">Dynamic_Profit_Scout</p>
                                        </div>
                                    </div>
                                    <button onClick={() => updateSettings('yieldOptimizationIA', !settings.yieldOptimizationIA)} className="active:scale-90 transition-transform">
                                        {settings.yieldOptimizationIA ? <ToggleRight className="w-16 h-16 text-emerald-500" /> : <ToggleLeft className="w-16 h-16 text-slate-700" />}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-8 bg-black/40 rounded-[2.5rem] border border-white/5 group/opt hover:border-cyan-500/30 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="p-4 bg-cyan-500/10 rounded-2xl text-cyan-500"><Activity className="w-7 h-7" /></div>
                                        <div>
                                            <h4 className="font-black text-white uppercase tracking-widest text-sm">Auto_Withdrawal</h4>
                                            <p className="text-[10px] text-slate-600 mt-1 uppercase font-black">Min_Threshold: 10_RNC</p>
                                        </div>
                                    </div>
                                    <button onClick={() => updateSettings('autoWithdraw', !settings.autoWithdraw)} className="active:scale-90 transition-transform">
                                        {settings.autoWithdraw ? <ToggleRight className="w-16 h-16 text-cyan-500" /> : <ToggleLeft className="w-16 h-16 text-slate-700" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
            )}

            {activeTab === 'security' && (
                <div className="space-y-12 animate-in slide-in-from-right-8 duration-500 text-white">
                    <div className="space-y-2">
                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Security_Sentinel</h3>
                        <p className="text-sm text-slate-400 font-medium">Gérez vos boucliers DNS, l'interception de traqueurs et les protocoles d'urgence.</p>
                    </div>

                    <div className="bg-slate-900/60 p-10 rounded-[3.5rem] border border-white/10 space-y-12 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
                        
                        <div className="space-y-8">
                            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-4">
                                <Server className="w-5 h-5 text-brand-500" /> DNS_Relay_Select
                            </label>
                            <div className="grid grid-cols-4 gap-4 bg-black/60 p-3 rounded-[2.5rem] border border-white/5">
                                {dnsProviders.map((provider) => (
                                    <button
                                        key={provider.id}
                                        onClick={() => updateSettings('dns', provider.id)}
                                        className={`py-8 rounded-3xl text-[9px] font-black transition-all uppercase tracking-widest flex flex-col items-center gap-2 group/dns ${
                                            settings.dns === provider.id 
                                            ? 'bg-brand-600 text-white shadow-2xl' 
                                            : 'text-slate-600 hover:text-slate-300'
                                        }`}
                                    >
                                        {provider.label}
                                        <span className={`text-[8px] font-mono opacity-40 group-hover/dns:opacity-100 transition-opacity ${settings.dns === provider.id ? 'text-white/60' : ''}`}>{provider.ip}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-10 border-t border-white/5 space-y-6">
                            <div className="flex items-center justify-between p-8 bg-black/40 rounded-[2.5rem] border border-white/5 group/opt hover:border-red-500/30 transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-red-500/10 rounded-2xl text-red-500 shadow-lg shadow-red-500/10"><ShieldAlert className="w-7 h-7" /></div>
                                    <div>
                                        <h4 className="font-black text-white uppercase tracking-widest text-sm">Emergency_Kill_Switch</h4>
                                        <p className="text-[10px] text-slate-600 mt-1 uppercase font-black italic leading-relaxed">Arrêt instantané de l'interface réseau si le tunnel est compromis.</p>
                                    </div>
                                </div>
                                <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)} className="active:scale-90 transition-transform">
                                    {settings.killSwitch ? <ToggleRight className="w-16 h-16 text-red-500" /> : <ToggleLeft className="w-16 h-16 text-slate-700" />}
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-8 bg-black/40 rounded-[2.5rem] border border-white/5 group/opt hover:border-cyan-500/30 transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-cyan-500/10 rounded-2xl text-cyan-500 shadow-lg shadow-cyan-500/10"><Lock className="w-7 h-7" /></div>
                                    <div>
                                        <h4 className="font-black text-white uppercase tracking-widest text-sm">IPV6_Tunnel_Guard</h4>
                                        <p className="text-[10px] text-slate-600 mt-1 uppercase font-black italic leading-relaxed">Prévention des fuites d'adresse IP réelle via la pile IPV6.</p>
                                    </div>
                                </div>
                                <button onClick={() => updateSettings('ipv6LeakProtection', !settings.ipv6LeakProtection)} className="active:scale-90 transition-transform">
                                    {settings.ipv6LeakProtection ? <ToggleRight className="w-16 h-16 text-cyan-500" /> : <ToggleLeft className="w-16 h-16 text-slate-700" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
