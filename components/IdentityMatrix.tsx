
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Copy, Fingerprint, 
  Loader2, Chrome, RefreshCw, 
  Globe2, Cpu, Activity, ShieldCheck, Orbit, 
  Zap, ChevronRight, MapPin, Users, Cloud, X, 
  ShieldAlert, Laptop, Monitor, Smartphone, Binary, 
  Lock, Shield, Scan, Target, Radio, Brain, 
  ChevronDown, ListChecks, ShieldHalf, Cpu as CpuIcon,
  HelpCircle, Sparkles, Wand2, History as LucideHistory, Ghost,
  ArrowRightLeft, Settings2, Sliders, ZapOff, Check, AlertCircle,
  CheckCircle2, ExternalLink
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

  const isOnion = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  const currentUAData = useMemo(() => {
    return REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || REALISTIC_USER_AGENTS[0];
  }, [identity.userAgentShort]);

  // Simulation d'entropie
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

  // Horloge locale avec gestion du cycle de vie
  useEffect(() => {
    let timerId: any = null;
    const updateTime = () => {
      const tz = identity.timezone || 'UTC+0';
      const offsetStr = tz.replace('UTC', '');
      const offsetValue = offsetStr ? parseInt(offsetStr, 10) : 0;
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const cityTime = new Date(utc + (3600000 * (isNaN(offsetValue) ? 0 : offsetValue)));
      setLocalTime(cityTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    timerId = setInterval(updateTime, 1000);
    return () => { if (timerId) clearInterval(timerId); };
  }, [identity.timezone]);

  const theme = {
    primary: isOnion ? 'text-purple-400' : isSmartDNS ? 'text-amber-400' : 'text-cyan-400',
    primaryBg: isOnion ? 'bg-purple-500' : isSmartDNS ? 'bg-amber-500' : 'bg-cyan-500',
    primaryBorder: isOnion ? 'border-purple-500/30' : isSmartDNS ? 'border-amber-500/30' : 'border-cyan-500/30',
    glow: isOnion ? 'shadow-[0_0_40px_rgba(168,85,247,0.25)]' : isSmartDNS ? 'shadow-[0_0_40px_rgba(245,158,11,0.25)]' : 'shadow-[0_0_40px_rgba(6,182,212,0.25)]',
    accent: isOnion ? 'bg-purple-500/10' : isSmartDNS ? 'bg-amber-500/10' : 'bg-cyan-500/10',
    cardBase: 'glass-card dark:bg-slate-900/60 backdrop-blur-3xl'
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const isWarpDisabled = !isConnected || isSmartDNS || isMasking;

  return (
    <div className={`space-y-8 ${isMasking ? 'animate-matrix-shift' : ''}`}>
      {/* Top Section: IP Gateway & Warp Core */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* IP Gateway Card - Repensée pour plus d'impact */}
        <div className={`lg:col-span-7 ${theme.cardBase} p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] border ${theme.primaryBorder} relative overflow-hidden group ${theme.glow} bracket-corner transition-all duration-700 hover:scale-[1.01]`}>
          <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
          <div className="absolute w-full h-0.5 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-cyber-scan pointer-events-none z-20"></div>
          
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-5">
                  <div className={`w-3 h-14 ${theme.primaryBg} rounded-full animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.6)]`}></div>
                  <div>
                    <h3 className="text-sm md:text-base font-black text-white uppercase tracking-[0.6em] leading-tight">Nexus_Gateway_v4</h3>
                    <div className="flex items-center gap-2.5 mt-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]'}`}></div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{isConnected ? 'UPLINK_SECURE' : 'UPLINK_OFFLINE'}</span>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3 rounded-2xl bg-black/60 border-2 border-white/5 font-mono text-[11px] text-brand-400 shadow-2xl backdrop-blur-md">
                  CORE_TOKEN: <span className="text-white font-black">{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                </div>
              </div>

              <div className="space-y-4">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.5em] ml-1 flex items-center gap-4">
                    <Target className={`w-5 h-5 ${theme.primary} animate-pulse`} /> Uplink_Virtual_Address
                  </span>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className={`text-6xl sm:text-7xl md:text-8xl font-mono font-black tracking-tighter transition-all duration-700 drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] ${isRotating ? 'animate-glitch text-red-500' : 'text-slate-900 dark:text-white'}`}>
                      {isRotating ? scrambleText.slice(0, 15) : identity.ip}
                    </div>
                    {!isRotating && (
                      <button 
                          onClick={handleCopyIp}
                          className={`p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] transition-all active:scale-90 border-2 shadow-2xl group/copy ${copiedIp ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-white/10'}`}
                      >
                          {copiedIp ? <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" /> : <Copy className="w-8 h-8 md:w-10 md:h-10 group-hover/copy:scale-110 transition-transform" />}
                      </button>
                    )}
                  </div>
              </div>
            </div>

            <div className="mt-14 pt-10 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div className="space-y-4">
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">System_Entropy</span>
                   <div className="flex items-center gap-4 bg-black/60 p-5 rounded-3xl border-2 border-white/5 shadow-2xl backdrop-blur-xl">
                      <div className={`w-2 h-8 ${theme.primaryBg} rounded-sm`}></div>
                      <span className="text-3xl font-mono font-black text-slate-800 dark:text-cyan-400 tracking-tighter">{entropy}%</span>
                   </div>
                </div>
                <div className="space-y-4">
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Network_Latency</span>
                   <div className="flex items-center gap-4 bg-black/60 p-5 rounded-3xl border-2 border-white/5 shadow-2xl backdrop-blur-xl">
                      <Radio className="w-6 h-6 text-emerald-500 animate-pulse" />
                      <span className="text-3xl font-mono font-black text-slate-800 dark:text-emerald-400 tracking-tighter">{identity.latency}ms</span>
                   </div>
                </div>
                <div className="space-y-4">
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Encryption_Standard</span>
                   <div className="flex items-center gap-4 bg-black/60 p-5 rounded-3xl border-2 border-white/5 shadow-2xl backdrop-blur-xl">
                      <Lock className="w-6 h-6 text-purple-500" />
                      <span className="text-3xl font-mono font-black text-slate-800 dark:text-purple-400 tracking-tighter">XTS-512</span>
                   </div>
                </div>
            </div>
          </div>
        </div>

        {/* Identity Warp Controller - Nouveau look "Console de commande" */}
        <div className={`lg:col-span-5 ${theme.cardBase} p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] border-2 border-brand-500/50 relative overflow-hidden group shadow-[0_0_80px_rgba(6,182,212,0.2)] bracket-corner flex flex-col transition-all duration-500`}>
            <div className="absolute inset-0 bg-brand-500/[0.06] pointer-events-none"></div>
            <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none"></div>
            {isMasking && <div className="absolute inset-0 bg-brand-500/20 animate-pulse z-20"></div>}
            
            <div className="relative z-30 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <h4 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic">Identity_Warp</h4>
                          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 shadow-xl shadow-emerald-500/10"><Sparkles className="w-5 h-5 animate-spin-slow" /></div>
                        </div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2">Matrix_Synchronization: Online</p>
                    </div>
                    <button 
                      onClick={() => setShowWarpTuning(!showWarpTuning)}
                      className={`p-6 rounded-[2rem] bg-black/80 border-2 border-white/10 transition-all duration-700 ${showWarpTuning ? 'text-brand-500 border-brand-500 shadow-[0_0_30px_rgba(6,182,212,0.4)] rotate-180 scale-110' : 'text-slate-600 hover:text-slate-300 hover:border-brand-500/40'}`}
                    >
                        {showWarpTuning ? <X className="w-9 h-9" /> : <Settings2 className="w-9 h-9 group-hover:rotate-90 transition-transform" />}
                    </button>
                </div>

                <div className="flex-1 relative mb-12 min-h-[160px]">
                    {!showWarpTuning ? (
                      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                        <div className="p-8 bg-black/80 rounded-[3rem] border-2 border-white/5 space-y-6 shadow-2xl relative overflow-hidden group/mini">
                          <div className="absolute inset-0 bg-scanline opacity-[0.08] pointer-events-none"></div>
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 pb-4">
                            <span className="flex items-center gap-3"><Binary className="w-4 h-4 text-cyan-500" /> MAC_ROTATION</span>
                            <span className={isMasking ? 'text-brand-400 animate-pulse' : 'text-emerald-500'}>{isMasking ? 'SYNCHRONIZING...' : 'VERIFIED'}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            <span className="flex items-center gap-3"><Scan className="w-4 h-4 text-purple-500" /> AGENT_MORPHING</span>
                            <span className={isMasking ? 'text-brand-400 animate-pulse' : 'text-emerald-500'}>{isMasking ? 'SYNCHRONIZING...' : 'VERIFIED'}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-4 px-3">
                            <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                <span>Kernel_Warp_Progress</span>
                                <span className="text-brand-400 font-mono text-sm">{Math.round(warpProgress)}%</span>
                            </div>
                            <div className="h-4 bg-black/80 rounded-full border-2 border-white/10 overflow-hidden p-1 shadow-inner">
                                <div 
                                    className="h-full bg-brand-500 rounded-full shadow-[0_0_25px_rgba(6,182,212,1)] transition-all duration-500 relative overflow-hidden"
                                    style={{ width: `${warpProgress}%` }}
                                >
                                    <div className="absolute inset-0 bg-shimmer opacity-40"></div>
                                </div>
                            </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-black/95 rounded-[3.5rem] border-2 border-brand-500/50 p-8 space-y-7 animate-in slide-in-from-bottom-6 duration-500 absolute inset-0 z-40 backdrop-blur-3xl overflow-hidden bracket-corner">
                        <div className="absolute inset-0 cyber-grid opacity-20"></div>
                        <div className="space-y-4 relative z-10">
                          <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4">
                            <Shield className="w-5 h-5 text-brand-500" /> Obfuscation_Level
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {(['standard', 'high', 'ultra'] as const).map(lvl => (
                              <button 
                                key={lvl}
                                onClick={() => onObfuscationLevelChange?.(lvl)}
                                className={`py-5 rounded-2xl text-[10px] font-black uppercase transition-all border-2 ${obfuscationLevel === lvl ? 'bg-brand-500 border-brand-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)] scale-105' : 'bg-black/60 border-white/10 text-slate-600 hover:text-slate-300 hover:border-white/20'}`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 relative z-10">
                          <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4">
                            <Binary className="w-5 h-5 text-cyan-500" /> Hardware_Logic
                          </label>
                          <button 
                            onClick={() => onFormatChange?.(macFormat === 'random' ? 'standard' : 'random')}
                            className="w-full py-6 bg-black/80 border-2 border-white/10 rounded-3xl flex items-center justify-between px-8 group/toggle hover:border-cyan-500/40 transition-all shadow-2xl"
                          >
                             <div className="flex flex-col text-left">
                               <span className="text-sm font-black text-slate-200 uppercase tracking-tight">{macFormat.toUpperCase()} FORMAT</span>
                               <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1">{macFormat === 'random' ? 'Entropy_Injection: ACTIVE' : 'Vendor_Signature: FIXED'}</span>
                             </div>
                             <div className={`w-14 h-7 rounded-full p-1.5 transition-all duration-500 ${macFormat === 'random' ? 'bg-brand-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-slate-800'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-500 ${macFormat === 'random' ? 'translate-x-7' : 'translate-x-0'}`}></div>
                             </div>
                          </button>
                        </div>
                        <div className="flex items-center gap-4 px-6 py-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 relative z-10 shadow-lg shadow-emerald-500/5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <p className="text-[9px] text-slate-400 font-black italic uppercase tracking-widest">Kernel_Ready: Tuning_Synced</p>
                        </div>
                      </div>
                    )}
                </div>

                <div className="space-y-6">
                  <button 
                      onClick={onMask}
                      disabled={isWarpDisabled}
                      className={`w-full py-8 md:py-10 rounded-[3rem] flex items-center justify-center gap-6 font-black text-[14px] md:text-[16px] uppercase tracking-[0.6em] transition-all active:scale-95 shadow-2xl relative overflow-hidden group/warp border-2 ${
                          isWarpDisabled 
                          ? 'bg-slate-950 text-slate-800 cursor-not-allowed border-white/5 opacity-40' 
                          : 'bg-brand-600 hover:bg-brand-500 text-white border-brand-400/40 shadow-brand-500/60'
                      }`}
                  >
                      <div className="absolute inset-0 bg-scanline opacity-0 group-hover/warp:opacity-20 pointer-events-none transition-opacity"></div>
                      {isMasking ? <Loader2 className="w-8 h-8 animate-spin" /> : <Ghost className="w-8 h-8 group-hover:scale-125 transition-transform duration-500" />}
                      {isMasking ? 'RECONFIGURING...' : 'MASQUER_L_EMPREINTE'}
                  </button>
                  
                  {(!isConnected || isSmartDNS) && (
                    <div className="p-5 bg-red-500/10 border-2 border-red-500/20 rounded-[2rem] flex items-center justify-center gap-4 shadow-lg shadow-red-500/5">
                        <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                        <p className="text-[11px] font-black text-red-500 uppercase tracking-[0.2em] text-center">
                            {isSmartDNS ? 'INDISPONIBLE EN MODE SMART DNS' : 'TUNNEL VPN REQUIS POUR LE MORPHING'}
                        </p>
                    </div>
                  )}
                </div>
            </div>
        </div>
      </div>

      {/* Grid: Identity Facets - Cartes plus "Tactiques" */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Geo Node Card */}
        <div className={`${theme.cardBase} p-10 md:p-12 rounded-[3.5rem] md:rounded-[4.5rem] border ${theme.primaryBorder} group hover:shadow-[0_60px_100px_rgba(0,0,0,0.6)] hover:translate-y-[-16px] transition-all duration-1000 relative overflow-hidden flex flex-col justify-between bracket-corner`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none"></div>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.04] group-hover:opacity-15 group-hover:scale-150 group-hover:rotate-12 transition-all duration-1000 pointer-events-none">
                <Globe className="w-64 h-64" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-12 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${theme.accent} border border-white/10 shadow-2xl backdrop-blur-xl group-hover:scale-110 transition-transform duration-700`}><MapPin className={`w-8 h-8 ${theme.primary}`} /></div>
                    <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em]">Exit_Cluster</span>
                  </div>
                  <LucideHistory className="w-6 h-6 text-slate-700 hover:text-white cursor-pointer transition-colors" />
              </div>
              
              <div className="flex items-center gap-10 mb-14 relative z-10">
                  <div className="relative">
                    <div className="absolute inset-[-20px] border-2 border-brand-500/10 rounded-full animate-spin-slow group-hover:border-brand-500/40 transition-colors"></div>
                    <span className="text-8xl md:text-9xl filter drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-1000 block select-none">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                    <div className="absolute -bottom-3 -right-3 w-9 h-9 bg-emerald-500 rounded-full border-[6px] border-slate-950 shadow-2xl"></div>
                  </div>
                  <div>
                      <span className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter block leading-none">{identity.country}</span>
                      <span className="text-[11px] font-black text-brand-400 uppercase tracking-widest bg-brand-500/10 px-5 py-2 rounded-full border border-brand-500/30 mt-4 inline-block shadow-2xl">SEC_LEVEL_A+</span>
                  </div>
              </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-8 rounded-[3rem] border-2 transition-all flex items-center justify-between group/city relative overflow-hidden shadow-2xl ${
                    isConnected 
                    ? 'bg-black/80 border-white/10 hover:border-brand-500/60 hover:bg-black' 
                    : 'bg-black/60 border-transparent grayscale opacity-40'
                }`}
            >
                <div className="text-left relative z-10">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 block">Session_Location</span>
                    <span className={`text-3xl font-mono font-black tracking-tighter ${isConnected ? theme.primary : 'text-slate-800'}`}>{identity.city}</span>
                </div>
                <div className="text-right relative z-10 flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,1)]"></div>
                      Uplink_Clock
                    </span>
                    <span className="text-base font-mono font-black text-slate-400 group-hover/city:text-white transition-colors tracking-widest">{localTime}</span>
                </div>
            </button>
        </div>

        {/* Hardware Scrambler Card */}
        <div className={`${theme.cardBase} p-10 md:p-12 rounded-[3.5rem] md:rounded-[4.5rem] border ${theme.primaryBorder} group hover:shadow-[0_60px_100px_rgba(0,0,0,0.6)] hover:translate-y-[-16px] transition-all duration-1000 flex flex-col justify-between relative overflow-hidden bracket-corner`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none"></div>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.04] group-hover:opacity-15 group-hover:rotate-45 group-hover:scale-150 transition-all duration-1000 pointer-events-none">
                <Fingerprint className="w-64 h-64" />
            </div>
            
            <div className="flex items-center gap-5 mb-12 relative z-10">
                <div className={`p-4 rounded-2xl ${theme.accent} border border-white/10 shadow-2xl backdrop-blur-xl group-hover:scale-110 transition-transform duration-700`}><Binary className={`w-8 h-8 ${theme.primary}`} /></div>
                <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em]">Hardware_Spoofing</span>
            </div>

            <div className="bg-black/80 rounded-[3rem] p-10 border-2 border-white/5 mb-12 relative overflow-hidden group/mac shadow-2xl flex-1 flex flex-col justify-center min-h-[180px] backdrop-blur-xl">
                <div className="absolute inset-0 bg-scanline opacity-[0.1] pointer-events-none"></div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.6em] mb-8 text-center block">VIRT_MAC_SIGNATURE</span>
                <div className="font-mono text-3xl md:text-4xl font-black text-white tracking-[0.2em] text-center break-all leading-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                    {isMasking ? (
                        <span className="text-brand-400 animate-pulse">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="flex justify-center gap-3 mt-12">
                   {[...Array(6)].map((_, i) => (
                      <div key={i} className={`w-10 h-2 rounded-full transition-all duration-500 ${isMasking ? 'bg-brand-500 animate-bounce shadow-[0_0_15px_rgba(6,182,212,1)]' : 'bg-slate-900'}`} style={{ animationDelay: `${i * 0.15}s` }}></div>
                   ))}
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={isWarpDisabled}
                className={`w-full py-8 rounded-[3rem] flex items-center justify-center gap-5 font-black text-[13px] md:text-[15px] uppercase tracking-[0.4em] transition-all active:scale-95 shadow-2xl relative overflow-hidden border-2 ${
                    !isWarpDisabled
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-white/10 hover:opacity-90' 
                    : 'bg-slate-950/80 text-slate-800 cursor-not-allowed opacity-40 border-white/5'
                }`}
            >
                {isMasking ? <Loader2 className="w-7 h-7 animate-spin" /> : <Fingerprint className="w-7 h-7" />}
                MORPH_HARDWARE_LAYER
            </button>
        </div>

        {/* OS Fingerprint Card */}
        <div className={`${theme.cardBase} p-10 md:p-12 rounded-[3.5rem] md:rounded-[4.5rem] border ${theme.primaryBorder} group hover:shadow-[0_60px_100px_rgba(0,0,0,0.6)] hover:translate-y-[-16px] transition-all duration-1000 flex flex-col justify-between relative overflow-hidden bracket-corner`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none"></div>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.04] group-hover:opacity-15 group-hover:-rotate-12 group-hover:scale-150 transition-all duration-1000 pointer-events-none">
                <Laptop className="w-64 h-64" />
            </div>
            
            <div className="flex items-center justify-between mb-12 relative z-10">
                <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${theme.accent} border border-white/10 shadow-2xl backdrop-blur-xl group-hover:scale-110 transition-transform duration-700`}><Chrome className={`w-8 h-8 ${theme.primary}`} /></div>
                    <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em]">Client_Fingerprint</span>
                </div>
                <div className="px-5 py-2 bg-emerald-500/10 rounded-full text-[10px] font-black text-emerald-400 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 animate-pulse tracking-widest uppercase">IA_STEALTH_V2</div>
            </div>

            <div className="flex-1 space-y-8 mb-12 relative z-10">
                <div className="p-9 bg-black/80 rounded-[3rem] border-2 border-white/5 space-y-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                    <div className="absolute inset-0 bg-scanline opacity-[0.06] pointer-events-none"></div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-6">
                        <div className="flex items-center gap-5">
                          <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-4">
                              <Laptop className="w-5 h-5 text-brand-500" />
                              OS_ENGINE
                          </span>
                          <div className="relative group/info">
                            <HelpCircle className="w-5 h-5 text-slate-700 hover:text-brand-400 cursor-help transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-5 w-72 p-6 bg-slate-900/98 border-2 border-white/10 rounded-[2.5rem] shadow-[0_0_60px_rgba(0,0,0,1)] backdrop-blur-3xl invisible group-hover/info:visible opacity-0 group-hover/info:opacity-100 transition-all duration-500 z-50 pointer-events-none border-l-4 border-l-brand-500">
                              <p className="text-[12px] text-slate-300 leading-relaxed font-bold tracking-tight uppercase">L'User Agent est votre identité logicielle unique. Le changer fragmente votre empreinte digitale numérique et empêche le traçage persistant via Browser Fingerprinting.</p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-5 h-5 border-l-2 border-t-2 border-white/10 bg-slate-900 rotate-[225deg] -mt-2.5"></div>
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-mono font-black text-white uppercase tracking-tighter">{isMasking ? 'PATCHING...' : currentUAData.os.split(' ')[0]}</span>
                    </div>
                    
                    <div className="space-y-4">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.6em] block">DATA_STRING_FLOW</span>
                        <div className="text-[11px] font-mono text-slate-500 leading-relaxed italic line-clamp-4 break-all bg-black/80 p-5 rounded-2xl border border-white/5 min-h-[84px] group-hover:text-brand-400 transition-colors shadow-inner">
                            {isMasking ? scrambleText.repeat(6).slice(0, 240) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={onScrambleUA}
                disabled={isWarpDisabled}
                className={`w-full py-8 rounded-[3rem] flex items-center justify-center gap-5 font-black text-[13px] md:text-[15px] uppercase tracking-[0.4em] transition-all active:scale-95 shadow-2xl relative overflow-hidden border-2 ${
                    !isWarpDisabled 
                    ? 'bg-cyan-600/90 hover:bg-brand-600 text-white border-brand-400/40' 
                    : 'bg-slate-950/80 text-slate-800 cursor-not-allowed opacity-40 border-white/5'
                }`}
            >
                {isMasking ? <Loader2 className="w-7 h-7 animate-spin" /> : <Scan className="w-7 h-7 group-hover:rotate-90 transition-transform duration-700" />}
                MORPH_SOFTWARE_LAYER
            </button>
        </div>
      </div>

      {/* IA Sentinel Security Collapsible - Refonte style "Dossier confidentiel" */}
      {securityReport && (
          <div className={`${theme.cardBase} rounded-[3.5rem] md:rounded-[5rem] border-2 ${theme.primaryBorder} overflow-hidden transition-all duration-1000 animate-in fade-in slide-in-from-bottom-16 shadow-[0_0_120px_rgba(0,0,0,0.7)] group/recs bracket-corner`}>
             <div className="absolute inset-0 bg-scanline opacity-[0.04] pointer-events-none"></div>
             <button 
                onClick={() => setShowRecs(!showRecs)}
                className="w-full p-10 md:p-14 flex items-center justify-between hover:bg-white/[0.04] transition-all group/btn bg-black/40"
             >
                <div className="flex items-center gap-8 md:gap-12">
                    <div className={`p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] bg-brand-500/10 border-2 border-brand-500/40 group-hover/btn:scale-110 group-hover/btn:rotate-6 group-hover/btn:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all duration-700`}>
                        <Brain className={`w-12 h-12 md:w-16 md:h-16 ${theme.primary} drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]`} />
                    </div>
                    <div className="text-left space-y-3">
                        <h4 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic">IA_Sentinel_Audit_Log</h4>
                        <div className="flex flex-wrap items-center gap-4 md:gap-8">
                            <span className="text-[12px] md:text-[13px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-4">
                              <Activity className="w-5 h-5 text-brand-500 animate-pulse" /> ENGINE_REPORT_SYNCED
                            </span>
                            <div className="hidden sm:block w-3 h-3 rounded-full bg-slate-800"></div>
                            <span className={`text-[12px] md:text-[13px] font-black uppercase tracking-widest flex items-center gap-4 ${securityReport.score > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                              <ShieldCheck className="w-5 h-5" /> THREAT_LEVEL: <span className="font-mono bg-black/40 px-3 py-1 rounded-lg border border-white/5">{securityReport.threatLevel.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-5 md:p-6 rounded-[2rem] border-2 border-white/10 transition-all duration-700 flex items-center gap-4 ${showRecs ? 'rotate-180 bg-brand-500 text-white shadow-brand-500/60 scale-110' : 'text-slate-600 hover:text-white hover:border-brand-500/60'}`}>
                    <ChevronDown className="w-9 h-9 md:w-11 md:h-11" />
                </div>
             </button>

             {showRecs && (
                 <div className="px-10 md:px-14 pb-14 md:pb-20 pt-6 animate-in slide-in-from-top-12 duration-1000 space-y-14">
                    <div className="p-10 md:p-14 bg-black/80 rounded-[3.5rem] md:rounded-[4.5rem] border-2 border-white/5 relative overflow-hidden group/audit shadow-inner backdrop-blur-2xl">
                        <div className="absolute inset-0 cyber-grid opacity-[0.15]"></div>
                        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover/audit:opacity-25 group-hover:scale-110 transition-all duration-1000 pointer-events-none">
                            <ShieldHalf className="w-64 h-64" />
                        </div>
                        <p className="text-xl md:text-2xl text-slate-300 leading-relaxed font-black italic relative z-10 pr-12 border-l-4 border-l-brand-500 pl-10 uppercase tracking-tight">
                            "{securityReport.analysis}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="p-10 bg-slate-950/60 rounded-[3rem] md:rounded-[4rem] border-2 border-white/5 hover:border-brand-500/60 hover:translate-y-[-10px] hover:shadow-[0_30px_60px_rgba(0,0,0,0.8)] transition-all duration-700 group/rec relative overflow-hidden backdrop-blur-xl">
                                <div className="absolute inset-0 bg-scanline opacity-0 group-hover/rec:opacity-[0.06] pointer-events-none"></div>
                                <div className="flex items-center gap-6 mb-8 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-[14px] font-black text-brand-500 border-2 border-brand-500/40 shadow-inner group-hover/rec:scale-110 group-hover/rec:bg-brand-500 group-hover/rec:text-white transition-all duration-500">
                                        0{i+1}
                                    </div>
                                    <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em]">Protocol_Patch</span>
                                </div>
                                <p className="text-base font-black text-slate-200 leading-relaxed relative z-10 group-hover:text-white transition-colors uppercase tracking-tighter">
                                    {rec}
                                </p>
                                <div className="absolute bottom-8 right-10 opacity-0 group-hover/rec:opacity-100 transition-all translate-x-6 group-hover:translate-x-0">
                                    <ArrowRightLeft className="w-6 h-6 text-brand-500" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 py-10 border-t border-white/10 bg-black/60 rounded-b-[4rem] md:rounded-b-[5.5rem] shadow-inner">
                        <div className="flex items-center gap-6">
                             <div className="w-3.5 h-3.5 rounded-full bg-brand-500 animate-ping shadow-[0_0_20px_rgba(6,182,212,1)]"></div>
                             <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em]">SENTINEL_REALTIME_MONITOR: ON</span>
                        </div>
                        <button className="text-[11px] font-black text-brand-500 uppercase tracking-[0.4em] hover:text-white hover:underline underline-offset-8 transition-all group/export flex items-center gap-3">
                            EXPORT_AUDIT_REPORT_V2.5
                            <ExternalLink className="w-4 h-4 opacity-0 group-hover/export:opacity-100 transition-opacity" />
                        </button>
                    </div>
                 </div>
             )}
          </div>
      )}

      {/* Modal Détails Géo - Stylisée */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-[40px] animate-in fade-in duration-700" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-xl ${theme.cardBase} border-2 ${theme.primaryBorder} rounded-[4rem] md:rounded-[5rem] p-12 md:p-16 shadow-[0_0_200px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500 overflow-hidden`}>
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
             <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none"></div>
             <button onClick={() => setShowCityModal(false)} className="absolute top-10 right-10 md:top-14 md:right-14 p-5 rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-all border-2 border-white/10 hover:rotate-90 hover:bg-red-500/30 hover:border-red-500/50 shadow-2xl"><X className="w-8 h-8" /></button>
             
             <div className="flex flex-col items-center text-center relative z-10">
              <div className={`w-36 h-36 md:w-44 md:h-44 rounded-[4rem] ${theme.accent} flex items-center justify-center mb-12 border-2 border-white/10 shadow-[0_0_60px_rgba(6,182,212,0.3)] group/modal-icon relative`}>
                <div className="absolute inset-[-10px] border-2 border-dashed border-brand-500/20 rounded-[4.5rem] animate-spin-slow"></div>
                <Globe className={`w-20 h-20 md:w-24 md:h-24 ${theme.primary} animate-spin-slow group-hover/modal-icon:scale-125 transition-transform duration-1000`} />
              </div>
              <h3 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{identity.city}</h3>
              <p className="text-[14px] md:text-[16px] font-black text-slate-500 uppercase tracking-[0.8em] mt-6 italic">{identity.country}</p>
              
              <div className="grid grid-cols-1 gap-6 w-full mt-16 md:mt-20">
                <div className="p-8 bg-black/90 border-2 border-white/10 rounded-[2.5rem] flex items-center justify-between group/meta hover:border-cyan-500/60 transition-all shadow-2xl backdrop-blur-2xl">
                    <div className="flex items-center gap-6">
                        <Users className="w-7 h-7 text-slate-600 group-hover/meta:text-cyan-500 group-hover/meta:scale-110 transition-all" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Node_Density</span>
                    </div>
                    <span className="text-2xl font-mono font-black text-white tracking-tighter">{CITY_METADATA[identity.city]?.population || 'N/A'}</span>
                </div>
                <div className="p-8 bg-black/90 border-2 border-white/10 rounded-[2.5rem] flex items-center justify-between group/meta hover:border-purple-500/60 transition-all shadow-2xl backdrop-blur-2xl">
                    <div className="flex items-center gap-6">
                        <Cloud className="w-7 h-7 text-slate-600 group-hover/meta:text-purple-500 group-hover/meta:scale-110 transition-all" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Environment</span>
                    </div>
                    <span className="text-2xl font-black text-white uppercase tracking-tighter">{CITY_METADATA[identity.city]?.weather || 'Stable'}</span>
                </div>
                <div className="p-8 bg-black/90 border-2 border-white/10 rounded-[2.5rem] flex items-center justify-between group/meta hover:border-red-500/60 transition-all shadow-2xl backdrop-blur-2xl">
                    <div className="flex items-center gap-6">
                        <ShieldAlert className="w-7 h-7 text-slate-600 group-hover/meta:text-red-500 group-hover/meta:scale-110 transition-all" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Threat_Index</span>
                    </div>
                    <span className="text-2xl font-black text-white uppercase tracking-tighter">{CITY_METADATA[identity.city]?.risk || 'Minimal'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
