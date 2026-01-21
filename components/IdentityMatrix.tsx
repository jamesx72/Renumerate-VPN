
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Copy, Fingerprint, 
  Loader2, Chrome, RefreshCw, 
  Globe2, Activity, ShieldCheck, Orbit, 
  Zap, ChevronRight, MapPin, Users, Cloud, X, 
  ShieldAlert, Laptop, Monitor, Smartphone, Binary, 
  Lock, Shield, Scan, Target, Radio, Brain, 
  ChevronDown, ShieldHalf, HelpCircle, Sparkles, 
  Wand2, History as LucideHistory, Ghost,
  ArrowRightLeft, Settings2, Sliders, ZapOff, Check, AlertCircle,
  CheckCircle2, ExternalLink, MousePointer2, Terminal, Cpu
} from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  isRotating: boolean;
  isMasking?: boolean;
  mode: ConnectionMode;
  securityReport?: SecurityReport | null;
  onMask?: () => void;
  onScrambleMac?: () => void;
  onScrambleUA?: () => void;
  onSelectUA?: (uaShort: string) => void;
  isConnected?: boolean;
  macFormat?: 'standard' | 'hyphen' | 'cisco' | 'random';
  onFormatChange?: (format: 'standard' | 'hyphen' | 'cisco' | 'random') => void;
  ipv6LeakProtection?: boolean;
  onIpv6Toggle?: (enabled: boolean) => void;
  obfuscationLevel?: 'standard' | 'high' | 'ultra';
  onObfuscationLevelChange?: (level: 'standard' | 'high' | 'ultra') => void;
}

const CITY_METADATA: Record<string, any> = {
  'Paris': { population: '2.1M', region: 'Île-de-France', weather: 'Nuageux', temp: '14°C', risk: 'Bas' },
  'Zürich': { population: '415k', region: 'Canton de Zurich', weather: 'Dégagé', temp: '11°C', risk: 'Minimal' },
  'Singapore': { population: '5.6M', region: 'Central Region', weather: 'Orageux', temp: '29°C', risk: 'Moyen' },
};

const COUNTRIES_WITH_FLAGS: Record<string, string> = {
  'France': '🇫🇷', 'Suisse': '🇨🇭', 'Singapour': '🇸🇬', 'Islande': '🇮🇸', 'Estonie': '🇪🇪', 'Panama': '🇵🇦', 'USA': '🇺🇸', 'Allemagne': '🇩🇪'
};

export const IdentityMatrix: React.FC<Props> = ({ 
  identity, 
  isRotating, 
  isMasking = false, 
  mode, 
  securityReport, 
  onMask,
  onScrambleMac,
  onScrambleUA,
  onSelectUA,
  isConnected = false,
  macFormat = 'random',
  onFormatChange,
  ipv6LeakProtection = true,
  onIpv6Toggle,
  obfuscationLevel = 'standard',
  onObfuscationLevelChange
}) => {
  const [copiedIp, setCopiedIp] = useState(false);
  const [localTime, setLocalTime] = useState<string>('');
  const [scrambleText, setScrambleText] = useState('');
  const [entropy, setEntropy] = useState('0.00');
  const [showCityModal, setShowCityModal] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [warpProgress, setWarpProgress] = useState(0);
  const [showWarpTuning, setShowWarpTuning] = useState(false);
  const [showUAModal, setShowUAModal] = useState(false);

  const isOnion = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  const currentUAData = useMemo(() => {
    return REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || REALISTIC_USER_AGENTS[0];
  }, [identity.userAgentShort]);

  // Simulation d'entropie technique
  useEffect(() => {
    const interval = setInterval(() => {
      setEntropy((Math.random() * 0.4 + 9.6).toFixed(2));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Effet de scrambling visuel
  useEffect(() => {
    if (isMasking || isRotating) {
      const chars = "10101010ABCDEF-X.#";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 20; i++) result += chars[Math.floor(Math.random() * chars.length)];
        setScrambleText(result);
      }, 60);

      setWarpProgress(0);
      const progressInterval = setInterval(() => {
        setWarpProgress(prev => Math.min(100, prev + (100 / 15)));
      }, 100);

      return () => {
        clearInterval(interval);
        clearInterval(progressInterval);
      };
    } else {
        setWarpProgress(0);
    }
  }, [isMasking, isRotating]);

  // Horloge locale synchronisée
  useEffect(() => {
    let timerId: any = null;
    const updateTime = () => {
      const tz = identity.timezone || 'UTC+0';
      const offsetValue = parseInt(tz.replace('UTC', '') || '0', 10);
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const cityTime = new Date(utc + (3600000 * offsetValue));
      setLocalTime(cityTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    timerId = setInterval(updateTime, 1000);
    return () => { if (timerId) clearInterval(timerId); };
  }, [identity.timezone]);

  const theme = {
    primary: isOnion ? 'text-purple-400' : isSmartDNS ? 'text-amber-400' : 'text-brand-400',
    primaryBg: isOnion ? 'bg-purple-500' : isSmartDNS ? 'bg-amber-500' : 'bg-brand-500',
    primaryBorder: isOnion ? 'border-purple-500/20' : isSmartDNS ? 'border-amber-500/20' : 'border-brand-500/20',
    glow: isOnion ? 'shadow-[0_0_50px_rgba(168,85,247,0.15)]' : isSmartDNS ? 'shadow-[0_0_50px_rgba(245,158,11,0.15)]' : 'shadow-[0_0_50px_rgba(6,182,212,0.15)]',
    accent: isOnion ? 'bg-purple-500/5' : isSmartDNS ? 'bg-amber-500/5' : 'bg-brand-500/5',
    cardBase: 'bg-slate-950/60 backdrop-blur-3xl'
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const isWarpDisabled = !isConnected || isSmartDNS || isMasking;

  return (
    <div className={`space-y-10 ${isMasking ? 'animate-matrix-shift' : ''}`}>
      {/* Top Section: IP Gateway & Warp Core */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* IP Gateway Card - Look "Terminal de Contrôle" */}
        <div className={`lg:col-span-7 ${theme.cardBase} p-10 rounded-[4rem] border border-white/5 relative overflow-hidden group shadow-2xl transition-all duration-700`}>
          <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
          <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-brand-500/40 to-transparent animate-cyber-scan pointer-events-none"></div>
          
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-6">
                <div className={`w-1.5 h-16 ${theme.primaryBg} rounded-full animate-pulse shadow-[0_0_20px_rgba(34,211,238,0.5)]`}></div>
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em]">Node_Protocol_v4.5</h3>
                  <div className="flex items-center gap-2.5 mt-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isConnected ? 'text-brand-400' : 'text-red-500'}`}>
                      {isConnected ? 'UPLINK_ENCRYPTED_256' : 'SIGNAL_LOST'}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-brand-500 animate-ping' : 'bg-red-500'}`}></div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-3 rounded-2xl bg-black/40 border border-white/10 font-mono text-[10px] text-brand-500 shadow-inner">
                KERN_ID: <span className="text-white font-black">{Math.random().toString(36).substr(2, 8).toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-6">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em] ml-1 flex items-center gap-3">
                  <Terminal className={`w-4 h-4 ${theme.primary}`} /> Virtual_Network_Endpoint
                </span>
                <div className="flex flex-wrap items-center gap-8">
                  <div className={`text-6xl sm:text-7xl md:text-8xl font-mono font-black tracking-tighter transition-all duration-700 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] ${isRotating ? 'animate-glitch text-red-500' : 'text-white'}`}>
                    {isRotating ? scrambleText.slice(0, 15) : identity.ip}
                  </div>
                  {!isRotating && (
                    <button 
                        onClick={handleCopyIp}
                        className={`p-6 rounded-[2.5rem] bg-white/5 border border-white/10 text-slate-500 hover:text-brand-400 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all active:scale-90 group/copy shadow-2xl`}
                    >
                        {copiedIp ? <ShieldCheck className="w-8 h-8 text-emerald-500" /> : <Copy className="w-8 h-8 group-hover/copy:scale-110 transition-transform" />}
                    </button>
                  )}
                </div>
            </div>

            <div className="mt-14 pt-10 border-t border-white/5 grid grid-cols-3 gap-6">
                <div className="space-y-3">
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Core_Entropia</span>
                   <div className="font-mono text-2xl font-black text-brand-400 tracking-tighter">{entropy}%</div>
                   <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 shadow-[0_0_8px_rgba(6,182,212,1)]" style={{ width: `${entropy}%` }}></div>
                   </div>
                </div>
                <div className="space-y-3 border-l border-white/5 pl-6">
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Ping_Interval</span>
                   <div className="font-mono text-2xl font-black text-emerald-400 tracking-tighter">{identity.latency}ms</div>
                   <div className="flex gap-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`w-2 h-1 rounded-sm ${i <= 3 ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                      ))}
                   </div>
                </div>
                <div className="space-y-3 border-l border-white/5 pl-6">
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Crypt_Engine</span>
                   <div className="font-mono text-2xl font-black text-purple-400 tracking-tighter">AES_GCM</div>
                   <div className="text-[8px] font-black text-slate-700 uppercase">Status: Nominal</div>
                </div>
            </div>
          </div>
        </div>

        {/* Identity Warp Controller - Look "Core Engine" */}
        <div className={`lg:col-span-5 ${theme.cardBase} p-10 rounded-[4rem] border-2 border-brand-500/20 relative overflow-hidden group shadow-[0_0_80px_rgba(6,182,212,0.1)] flex flex-col transition-all duration-500`}>
            <div className="absolute inset-0 bg-brand-500/[0.04] pointer-events-none"></div>
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-5 transition-opacity">
                <Wand2 className="w-64 h-64 text-brand-500" />
            </div>
            
            <div className="relative z-30 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <h4 className="text-3xl font-black text-white uppercase tracking-tighter">Identity_Warp</h4>
                          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500 border border-brand-500/20"><Sparkles className="w-5 h-5 animate-spin-slow" /></div>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Matrix_Sync: <span className="text-emerald-500">OPTIMAL</span></p>
                    </div>
                    <button 
                      onClick={() => setShowWarpTuning(!showWarpTuning)}
                      className={`p-4 rounded-2xl bg-black/60 border border-white/10 transition-all duration-500 ${showWarpTuning ? 'text-brand-400 border-brand-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] rotate-90 scale-110' : 'text-slate-500 hover:text-white'}`}
                    >
                        {showWarpTuning ? <X className="w-8 h-8" /> : <Settings2 className="w-8 h-8" />}
                    </button>
                </div>

                <div className="flex-1 relative mb-12 min-h-[180px]">
                    {!showWarpTuning ? (
                      <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
                        <div className="space-y-6">
                            {[
                              { label: 'MAC_ROTATION_STREAMS', icon: Binary, color: 'text-cyan-500' },
                              { label: 'AGENT_NEURAL_MORPH', icon: Scan, color: 'text-purple-500' }
                            ].map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-6 bg-black/40 rounded-3xl border border-white/5 relative group/item overflow-hidden">
                                <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none"></div>
                                <div className="flex items-center gap-4">
                                  <item.icon className={`w-5 h-5 ${item.color}`} />
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{item.label}</span>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${isMasking ? 'text-brand-400 animate-pulse border-brand-500/30' : 'text-emerald-500 border-emerald-500/30'}`}>
                                  {isMasking ? 'INJECTING...' : 'PROTECTED'}
                                </span>
                              </div>
                            ))}
                        </div>
                        
                        <div className="space-y-4 px-2">
                            <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                <span>Kernel_Synchronicity</span>
                                <span className="text-brand-400 font-mono text-sm">{Math.round(warpProgress)}%</span>
                            </div>
                            <div className="h-3 bg-black/60 rounded-full border border-white/10 overflow-hidden p-0.5 flex gap-0.5">
                                {[...Array(20)].map((_, i) => (
                                  <div 
                                    key={i} 
                                    className={`h-full flex-1 rounded-sm transition-all duration-300 ${i * 5 < warpProgress ? 'bg-brand-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-slate-900'}`}
                                  ></div>
                                ))}
                            </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950/90 rounded-[3rem] border border-brand-500/30 p-8 space-y-8 animate-in slide-in-from-bottom-6 duration-500 absolute inset-0 z-40 backdrop-blur-3xl overflow-hidden">
                        <div className="absolute inset-0 cyber-grid opacity-10"></div>
                        <div className="space-y-4 relative z-10">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                            <Shield className="w-4 h-4 text-brand-500" /> Layer_Obfuscation
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {(['standard', 'high', 'ultra'] as const).map(lvl => (
                              <button 
                                key={lvl}
                                onClick={() => onObfuscationLevelChange?.(lvl)}
                                className={`py-4 rounded-xl text-[9px] font-black uppercase transition-all border ${obfuscationLevel === lvl ? 'bg-brand-500/20 border-brand-500 text-white shadow-lg' : 'bg-black/40 border-white/5 text-slate-600 hover:text-slate-400'}`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 relative z-10">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                            <Binary className="w-4 h-4 text-brand-400" /> HW_Spoof_Logic
                          </label>
                          <button 
                            onClick={() => onFormatChange?.(macFormat === 'random' ? 'standard' : 'random')}
                            className="w-full py-5 bg-black/60 border border-white/10 rounded-2xl flex items-center justify-between px-6 hover:border-brand-500/40 transition-all"
                          >
                             <div className="flex flex-col text-left">
                               <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{macFormat.toUpperCase()}</span>
                               <span className="text-[8px] font-bold text-slate-600 uppercase mt-0.5">{macFormat === 'random' ? 'Entropy_Max' : 'Fixed_Signature'}</span>
                             </div>
                             <div className={`w-10 h-5 rounded-full p-1 transition-all duration-500 ${macFormat === 'random' ? 'bg-brand-500' : 'bg-slate-800'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-500 ${macFormat === 'random' ? 'translate-x-5' : 'translate-x-0'}`}></div>
                             </div>
                          </button>
                        </div>
                      </div>
                    )}
                </div>

                <div className="space-y-4">
                  <button 
                      onClick={onMask}
                      disabled={isWarpDisabled}
                      className={`w-full py-8 rounded-[2.5rem] flex items-center justify-center gap-6 font-black text-sm uppercase tracking-[0.5em] transition-all active:scale-95 shadow-2xl relative overflow-hidden group/warp border-2 ${
                          isWarpDisabled 
                          ? 'bg-slate-900/50 text-slate-700 cursor-not-allowed border-white/5' 
                          : 'bg-brand-600 hover:bg-brand-500 text-white border-brand-400/30 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
                      }`}
                  >
                      <div className="absolute inset-0 bg-scanline opacity-0 group-hover/warp:opacity-20 pointer-events-none transition-opacity"></div>
                      {isMasking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Ghost className="w-6 h-6 group-hover:scale-125 transition-transform" />}
                      {isMasking ? 'SYNCHRONIZING...' : "MASQUER L'EMPREINTE"}
                  </button>
                  
                  {(!isConnected || isSmartDNS) && (
                    <div className="flex items-center justify-center gap-3 px-6 py-3 bg-red-500/5 border border-red-500/20 rounded-2xl">
                        <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                            {isSmartDNS ? 'DÉSACTIVÉ EN MODE SMART DNS' : 'TUNNEL ACTIF REQUIS'}
                        </p>
                    </div>
                  )}
                </div>
            </div>
        </div>
      </div>

      {/* Grid: Identity Facets - Design Raffiné */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        
        {/* Geo Node Card */}
        <div className={`${theme.cardBase} p-10 rounded-[4rem] border border-white/5 group hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] transition-all duration-700 relative overflow-hidden flex flex-col justify-between`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 p-8 opacity-[0.02] group-hover:opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 pointer-events-none">
                <Globe className="w-64 h-64 text-brand-400" />
            </div>
            
            <div className="flex items-center justify-between mb-12 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${theme.accent} border border-white/5 backdrop-blur-xl group-hover:scale-110 transition-transform duration-700`}><MapPin className={`w-6 h-6 ${theme.primary}`} /></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Geo_Uplink</span>
                </div>
                <LucideHistory className="w-5 h-5 text-slate-700 hover:text-white cursor-pointer transition-colors" />
            </div>
            
            <div className="flex items-center gap-10 mb-14 relative z-10">
                <div className="relative">
                  <div className="absolute inset-[-12px] border border-dashed border-brand-500/20 rounded-full animate-spin-slow"></div>
                  <span className="text-8xl filter drop-shadow-2xl group-hover:scale-105 transition-transform duration-1000 block">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full border-[4px] border-slate-950 shadow-2xl"></div>
                </div>
                <div>
                    <span className="text-4xl font-black text-white uppercase tracking-tighter block leading-none">{identity.country}</span>
                    <span className="text-[9px] font-black text-brand-400 uppercase tracking-widest bg-brand-500/10 px-4 py-1.5 rounded-full border border-brand-500/20 mt-4 inline-block shadow-lg">TIER_1_AUTH</span>
                </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-6 rounded-[2.5rem] border transition-all flex items-center justify-between group/city relative overflow-hidden ${
                    isConnected 
                    ? 'bg-black/60 border-white/10 hover:border-brand-500/40 hover:bg-black/80' 
                    : 'bg-black/40 border-transparent grayscale opacity-50'
                }`}
            >
                <div className="text-left relative z-10">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Session_City</span>
                    <span className={`text-2xl font-mono font-black tracking-tighter ${isConnected ? 'text-white' : 'text-slate-700'}`}>{identity.city}</span>
                </div>
                <div className="text-right relative z-10 flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Uplink_Clock
                    </span>
                    <span className="text-sm font-mono font-black text-slate-400 group-hover/city:text-brand-400 transition-colors">{localTime}</span>
                </div>
            </button>
        </div>

        {/* Hardware Scrambler Card */}
        <div className={`${theme.cardBase} p-10 rounded-[4rem] border border-white/5 group hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] transition-all duration-700 flex flex-col justify-between relative overflow-hidden`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 p-8 opacity-[0.02] group-hover:opacity-10 group-hover:rotate-45 group-hover:scale-110 transition-all duration-1000 pointer-events-none">
                <Fingerprint className="w-64 h-64 text-brand-400" />
            </div>
            
            <div className="flex items-center gap-4 mb-12 relative z-10">
                <div className={`p-4 rounded-2xl ${theme.accent} border border-white/5 backdrop-blur-xl group-hover:scale-110 transition-transform duration-700`}><Binary className={`w-6 h-6 ${theme.primary}`} /></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">HW_Anonymizer</span>
            </div>

            <div className="bg-black/60 rounded-[3rem] p-10 border border-white/5 mb-10 relative overflow-hidden group/mac shadow-inner flex-1 flex flex-col justify-center">
                <div className="absolute inset-0 bg-scanline opacity-[0.08] pointer-events-none"></div>
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.5em] mb-8 text-center block">VIRTUAL_MAC_SIG</span>
                <div className="font-mono text-3xl font-black text-white tracking-[0.15em] text-center leading-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                    {isMasking ? (
                        <span className="text-brand-400 animate-pulse">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="flex justify-center gap-3 mt-10">
                   {[...Array(6)].map((_, i) => (
                      <div key={i} className={`w-8 h-1 rounded-full transition-all duration-500 ${isMasking ? 'bg-brand-500 animate-bounce' : 'bg-slate-900'}`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                   ))}
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={isWarpDisabled}
                className={`w-full py-6 rounded-3xl flex items-center justify-center gap-4 font-black text-[12px] uppercase tracking-[0.3em] transition-all active:scale-95 border ${
                    !isWarpDisabled
                    ? 'bg-slate-900 text-white border-white/10 hover:bg-slate-800' 
                    : 'bg-slate-900/30 text-slate-800 cursor-not-allowed border-white/5'
                }`}
            >
                {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                RE_NUM_HARDWARE
            </button>
        </div>

        {/* OS Fingerprint Card */}
        <div className={`${theme.cardBase} p-10 rounded-[4rem] border border-white/5 group hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] transition-all duration-700 flex flex-col justify-between relative overflow-hidden`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 p-8 opacity-[0.02] group-hover:opacity-10 group-hover:-rotate-12 group-hover:scale-110 transition-all duration-1000 pointer-events-none">
                <Laptop className="w-64 h-64 text-brand-400" />
            </div>
            
            <div className="flex items-center justify-between mb-12 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${theme.accent} border border-white/5 backdrop-blur-xl group-hover:scale-110 transition-transform duration-700`}><Chrome className={`w-6 h-6 ${theme.primary}`} /></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Client_Finger</span>
                </div>
                <div className="px-4 py-1 bg-emerald-500/10 rounded-full text-[9px] font-black text-emerald-400 border border-emerald-500/20 shadow-lg animate-pulse tracking-widest">SENTINEL_ACTIVE</div>
            </div>

            <div className="flex-1 space-y-8 mb-10 relative z-10">
                <div className="p-8 bg-black/60 rounded-[3rem] border border-white/10 space-y-6 shadow-inner relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <Cpu className="w-4 h-4 text-brand-400" /> OS_KERN
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-black text-white uppercase tracking-tighter">{isMasking ? 'PATCHING...' : currentUAData.os.split(' ')[0]}</span>
                    </div>
                    
                    <div className="space-y-3">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] block">UPLINK_STRING_ID</span>
                        <div className="text-[10px] font-mono text-slate-500 leading-relaxed truncate break-all bg-black/40 p-4 rounded-xl border border-white/5 min-h-[60px] group-hover:text-brand-400 transition-colors">
                            {isMasking ? scrambleText.repeat(4) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-3 relative z-10">
              <button 
                  onClick={onScrambleUA}
                  disabled={isWarpDisabled}
                  className={`col-span-4 py-6 rounded-3xl flex items-center justify-center gap-4 font-black text-[12px] uppercase tracking-[0.3em] transition-all active:scale-95 border ${
                      !isWarpDisabled 
                      ? 'bg-brand-600 hover:bg-brand-500 text-white border-brand-400/20 shadow-lg shadow-brand-900/40' 
                      : 'bg-slate-900/30 text-slate-800 cursor-not-allowed border-white/5'
                  }`}
              >
                  {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />}
                  NEURAL_RECONFIG
              </button>
              <button 
                  onClick={() => !isWarpDisabled && setShowUAModal(true)}
                  disabled={isWarpDisabled}
                  className={`col-span-1 rounded-3xl flex items-center justify-center transition-all active:scale-95 border ${
                      !isWarpDisabled 
                      ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:border-brand-500/40 shadow-lg' 
                      : 'bg-slate-900/30 text-slate-800 cursor-not-allowed border-white/5'
                  }`}
                  title="Studio Empreintes"
              >
                  <Sliders className="w-5 h-5" />
              </button>
            </div>
        </div>
      </div>

      {/* IA Sentinel Audit - Nouveau Design "Panel de Sécurité" */}
      {securityReport && (
          <div className={`${theme.cardBase} rounded-[4rem] border border-white/10 overflow-hidden transition-all duration-1000 animate-in fade-in slide-in-from-bottom-12 group/recs shadow-2xl`}>
             <button 
                onClick={() => setShowRecs(!showRecs)}
                className="w-full p-10 flex items-center justify-between hover:bg-white/[0.02] transition-all bg-black/20"
             >
                <div className="flex items-center gap-8">
                    <div className={`p-8 rounded-[2.5rem] bg-brand-500/5 border border-brand-500/20 group-hover:scale-105 transition-all duration-500`}>
                        <Brain className={`w-12 h-12 ${theme.primary}`} />
                    </div>
                    <div className="text-left space-y-2">
                        <h4 className="text-3xl font-black text-white uppercase tracking-tighter">Sentinel_Security_Log</h4>
                        <div className="flex items-center gap-6">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                              <Activity className="w-4 h-4 text-brand-500" /> Realtime_Report_v2
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${securityReport.score > 80 ? 'text-brand-400' : 'text-amber-500'}`}>
                              THREAT: <span className="font-mono bg-black/40 px-3 py-1 rounded-lg border border-white/5 ml-2">{securityReport.threatLevel.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-5 rounded-2xl border border-white/10 transition-all duration-500 ${showRecs ? 'rotate-180 bg-brand-500 text-white shadow-xl' : 'text-slate-600'}`}>
                    <ChevronDown className="w-8 h-8" />
                </div>
             </button>

             {showRecs && (
                 <div className="px-10 pb-16 pt-2 animate-in slide-in-from-top-10 duration-700 space-y-12">
                    <div className="p-10 bg-slate-900/40 rounded-[3rem] border border-white/5 relative overflow-hidden backdrop-blur-xl">
                        <div className="absolute inset-0 cyber-grid opacity-[0.05]"></div>
                        <p className="text-2xl text-slate-300 leading-relaxed font-black italic relative z-10 pr-10 border-l-4 border-l-brand-500 pl-10 uppercase tracking-tight">
                            "{securityReport.analysis}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="p-8 bg-black/40 rounded-[2.5rem] border border-white/5 hover:border-brand-500/40 hover:-translate-y-2 transition-all duration-500 group/rec relative overflow-hidden">
                                <div className="absolute inset-0 bg-scanline opacity-0 group-hover/rec:opacity-[0.05] pointer-events-none transition-opacity"></div>
                                <div className="flex items-center gap-5 mb-6 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-[12px] font-black text-brand-400 border border-brand-500/20 group-hover/rec:bg-brand-500 group-hover/rec:text-white transition-all">
                                        0{i+1}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sec_Patch</span>
                                </div>
                                <p className="text-sm font-black text-slate-300 leading-relaxed relative z-10 group-hover:text-white transition-colors uppercase tracking-tight">
                                    {rec}
                                </p>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex justify-center border-t border-white/5 pt-10">
                        <button className="text-[10px] font-black text-brand-500 uppercase tracking-[0.4em] hover:text-white hover:underline underline-offset-8 transition-all flex items-center gap-3 group/audit-btn">
                            EXPORT_COMPLETE_AUDIT_DATA
                            <ExternalLink className="w-3.5 h-3.5 group-hover/audit-btn:translate-x-1 transition-transform" />
                        </button>
                    </div>
                 </div>
             )}
          </div>
      )}

      {/* Modal Studio User Agent - Look "Laboratoire de Morphing" */}
      {showUAModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-500" onClick={() => setShowUAModal(false)} />
            <div className="relative w-full max-w-4xl bg-slate-900/80 border border-brand-500/20 rounded-[4rem] p-12 shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="absolute inset-0 cyber-grid opacity-5 pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 relative z-10">
                    <div className="space-y-1">
                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic flex items-center gap-4">
                            <Monitor className="w-8 h-8 text-brand-500" />
                            Uplink_Fingerprint_Studio
                        </h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-1">Archive_Synchrone: 12,482 Profils Neuronaux Disponibles</p>
                    </div>
                    <button onClick={() => setShowUAModal(false)} className="p-4 rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-all border border-white/10 hover:rotate-90 shadow-xl"><X className="w-8 h-8" /></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4 relative z-10 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
                        {REALISTIC_USER_AGENTS.map((ua) => {
                            const isCurrent = identity.userAgentShort === ua.short;
                            return (
                                <button 
                                    key={ua.short}
                                    onClick={() => {
                                        onSelectUA?.(ua.short);
                                        setShowUAModal(false);
                                    }}
                                    className={`p-8 rounded-[3rem] border transition-all duration-500 text-left group/ua relative overflow-hidden flex flex-col justify-between min-h-[200px] ${
                                        isCurrent 
                                        ? 'bg-brand-500/10 border-brand-500 shadow-2xl' 
                                        : 'bg-black/40 border-white/5 hover:border-brand-500/40 hover:bg-black/60'
                                    }`}
                                >
                                    <div className="absolute inset-0 bg-scanline opacity-0 group-hover/ua:opacity-[0.05] pointer-events-none transition-opacity"></div>
                                    
                                    <div className="flex items-start justify-between mb-8">
                                        <div className="flex items-center gap-5">
                                            <div className={`p-4 rounded-2xl border transition-all ${isCurrent ? 'bg-brand-500 text-white border-brand-400' : 'bg-slate-900 text-slate-600 border-white/5 group-hover/ua:text-brand-400'}`}>
                                                {ua.short.includes('Chrome') ? <Chrome className="w-6 h-6" /> : ua.short.includes('Safari') ? <Smartphone className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <h4 className={`text-xl font-black uppercase tracking-tight ${isCurrent ? 'text-white' : 'text-slate-400 group-hover/ua:text-brand-300'}`}>{ua.short}</h4>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{ua.os.split(' ')[0]} Engine</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isCurrent && <div className="p-2 rounded-full bg-brand-500 text-white shadow-xl"><Check className="w-3 h-3" /></div>}
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-[9px] font-mono text-slate-600 italic truncate uppercase tracking-widest bg-black/40 p-3 rounded-xl border border-white/5 group-hover/ua:text-slate-400 transition-colors">
                                            {ua.full}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-1000 ${isCurrent ? 'bg-brand-500' : 'bg-slate-800'}`} style={{ width: `${Math.random() * 60 + 40}%` }}></div>
                                            </div>
                                            <span className="text-[8px] font-black text-slate-700 uppercase">Entropy_Sync</span>
                                        </div>
                                    </div>
                                    
                                    <div className="absolute bottom-6 right-8 opacity-0 group-hover/ua:opacity-100 transition-all translate-x-4 group-hover/ua:translate-x-0">
                                        <MousePointer2 className="w-5 h-5 text-brand-500" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between text-slate-600 relative z-10 font-black uppercase tracking-widest text-[9px]">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span>Neural_Core: Healthy</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
                            <span>Database: v4.5.2 SYNC</span>
                        </div>
                    </div>
                    <span className="font-mono">REN-MATRIX-OS-KERNEL-V2</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
