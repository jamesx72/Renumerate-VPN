
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
  ArrowRightLeft, Settings2, Sliders, ZapOff, Check
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

  // Entropy simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setEntropy((Math.random() * 0.4 + 9.6).toFixed(2));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Matrix scrambling visual effect
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

  // Clock management with robust cleanup
  useEffect(() => {
    // Fixed: Using any instead of NodeJS.Timeout to avoid namespace errors in browser environments
    let timerId: any = null;
    
    const updateTime = () => {
      const tz = identity.timezone || 'UTC+0';
      const offsetStr = tz.replace('UTC', '');
      const offsetValue = offsetStr ? parseInt(offsetStr, 10) : 0;
      
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const cityTime = new Date(utc + (3600000 * (isNaN(offsetValue) ? 0 : offsetValue)));
      
      setLocalTime(cityTime.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }));
    };

    updateTime();
    timerId = setInterval(updateTime, 1000);
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [identity.timezone]);

  const theme = {
    primary: isOnion ? 'text-purple-400' : isSmartDNS ? 'text-amber-400' : 'text-cyan-400',
    primaryBg: isOnion ? 'bg-purple-500' : isSmartDNS ? 'bg-amber-500' : 'bg-cyan-500',
    primaryBorder: isOnion ? 'border-purple-500/30' : isSmartDNS ? 'border-amber-500/30' : 'border-cyan-500/30',
    glow: isOnion ? 'shadow-[0_0_30px_rgba(168,85,247,0.2)]' : isSmartDNS ? 'shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'shadow-[0_0_30px_rgba(6,182,212,0.2)]',
    accent: isOnion ? 'bg-purple-500/5' : isSmartDNS ? 'bg-amber-500/5' : 'bg-cyan-500/5',
    cardBase: 'glass-card dark:bg-slate-900/60 backdrop-blur-3xl'
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const getOSIcon = (os: string) => {
    if (os.includes('Windows')) return <Monitor className="w-4 h-4" />;
    if (os.includes('macOS') || os.includes('iOS')) return <Laptop className="w-4 h-4" />;
    if (os.includes('Android')) return <Smartphone className="w-4 h-4" />;
    return <CpuIcon className="w-4 h-4" />;
  };

  const CyberScanOverlay = () => (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-[inherit]">
      <div className="absolute w-full h-0.5 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-cyber-scan"></div>
    </div>
  );

  const isWarpDisabled = !isConnected || isSmartDNS || isMasking;

  return (
    <div className={`space-y-6 md:space-y-8 ${isMasking ? 'animate-matrix-shift' : ''}`}>
      {/* Top Section: IP Gateway & Warp Core */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* IP Gateway Card */}
        <div className={`lg:col-span-7 ${theme.cardBase} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border ${theme.primaryBorder} relative overflow-hidden group ${theme.glow} bracket-corner transition-all duration-700`}>
          <CyberScanOverlay />
          <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 md:mb-14">
              <div className="flex items-center gap-4">
                <div className={`w-2.5 h-12 ${theme.primaryBg} rounded-full animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.5)]`}></div>
                <div>
                  <h3 className="text-[11px] md:text-[13px] font-black text-white uppercase tracking-[0.5em] leading-tight">Nexus_Gateway_v4</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 animate-pulse'}`}></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isConnected ? 'SECURE_TUNNEL_ACTIVE' : 'UPLINK_DISCONNECTED'}</span>
                  </div>
                </div>
              </div>
              <div className="px-5 py-2.5 rounded-2xl bg-black/50 border border-white/10 font-mono text-[10px] text-brand-400 shadow-inner">
                CORE_ID: <span className="text-white font-black">{Math.random().toString(36).substr(2, 8).toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] ml-1 flex items-center gap-3">
                  <Target className={`w-4 h-4 ${theme.primary} animate-pulse`} /> Uplink_Virtual_Address
                </span>
                <div className="flex flex-wrap items-center gap-4 md:gap-10">
                  <div className={`text-5xl sm:text-6xl md:text-8xl font-mono font-black tracking-tighter transition-all duration-500 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] ${isRotating ? 'animate-glitch text-red-500' : 'text-slate-900 dark:text-white'}`}>
                    {isRotating ? scrambleText.slice(0, 15) : identity.ip}
                  </div>
                  {!isRotating && (
                    <button 
                        onClick={handleCopyIp}
                        className={`p-5 md:p-6 rounded-[1.8rem] md:rounded-[2.2rem] transition-all active:scale-90 border shadow-2xl group/copy ${copiedIp ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-white/10'}`}
                    >
                        {copiedIp ? <ShieldCheck className="w-7 h-7 md:w-8 md:h-8" /> : <Copy className="w-7 h-7 md:w-8 md:h-8 group-hover/copy:scale-110 transition-transform" />}
                    </button>
                  )}
                </div>
            </div>

            <div className="mt-12 md:mt-16 pt-10 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
                <div className="space-y-3">
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">System_Entropy</span>
                   <div className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <div className={`w-1.5 h-6 ${theme.primaryBg} rounded-sm`}></div>
                      <span className="text-2xl font-mono font-black text-slate-800 dark:text-cyan-400 tracking-tighter">{entropy}%</span>
                   </div>
                </div>
                <div className="space-y-3">
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Ping_Response</span>
                   <div className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
                      <span className="text-2xl font-mono font-black text-slate-800 dark:text-emerald-400 tracking-tighter">{identity.latency}ms</span>
                   </div>
                </div>
                <div className="space-y-3">
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Cipher_Matrix</span>
                   <div className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <Lock className="w-5 h-5 text-purple-500" />
                      <span className="text-2xl font-mono font-black text-slate-800 dark:text-purple-400 tracking-tighter">XTS-512</span>
                   </div>
                </div>
            </div>
          </div>
        </div>

        {/* Identity Warp Controller */}
        <div className={`lg:col-span-5 ${theme.cardBase} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border-2 border-brand-500/40 relative overflow-hidden group shadow-[0_0_60px_rgba(6,182,212,0.15)] bracket-corner flex flex-col transition-all duration-500`}>
            <div className="absolute inset-0 bg-brand-500/[0.04] pointer-events-none"></div>
            <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
            {isMasking && <div className="absolute inset-0 bg-brand-500/10 animate-pulse z-20"></div>}
            
            <div className="relative z-30 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-8">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">Identity_Warp</h4>
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"><Sparkles className="w-4 h-4" /></div>
                        </div>
                        <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1">Matrix_Sync_Active</p>
                    </div>
                    <button 
                      onClick={() => setShowWarpTuning(!showWarpTuning)}
                      className={`p-5 rounded-2xl bg-black/60 border-2 border-white/10 transition-all duration-700 ${showWarpTuning ? 'text-brand-500 border-brand-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'text-slate-700 hover:text-slate-400 hover:border-brand-500/30'}`}
                    >
                        {showWarpTuning ? <X className="w-8 h-8" /> : <Settings2 className="w-8 h-8 group-hover:rotate-90 transition-transform" />}
                    </button>
                </div>

                <div className="flex-1 relative mb-10 min-h-[140px]">
                    {!showWarpTuning ? (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="p-6 bg-black/60 rounded-[2.5rem] border border-white/10 space-y-4 shadow-2xl relative overflow-hidden">
                          <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none"></div>
                          <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-3">
                            <span className="flex items-center gap-2"><Binary className="w-3 h-3" /> MAC_ROTATION</span>
                            <span className={isMasking ? 'text-brand-400 animate-pulse' : 'text-emerald-500'}>{isMasking ? 'SYNCHRONIZING' : 'SECURE'}</span>
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><Scan className="w-3 h-3" /> AGENT_MORPHING</span>
                            <span className={isMasking ? 'text-brand-400 animate-pulse' : 'text-emerald-500'}>{isMasking ? 'SYNCHRONIZING' : 'SECURE'}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-3 px-2">
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <span>Warp_Sync_Progress</span>
                                <span className="text-brand-400 font-mono">{Math.round(warpProgress)}%</span>
                            </div>
                            <div className="h-3 bg-black/60 rounded-full border border-white/10 overflow-hidden p-1 shadow-inner">
                                <div 
                                    className="h-full bg-brand-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,1)] transition-all duration-300 relative"
                                    style={{ width: `${warpProgress}%` }}
                                >
                                    <div className="absolute inset-0 bg-shimmer opacity-30"></div>
                                </div>
                            </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-black/80 rounded-[2.5rem] border-2 border-brand-500/30 p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300 absolute inset-0 z-40 backdrop-blur-md">
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Shield className="w-3 h-3 text-brand-500" /> Obfuscation_Level
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['standard', 'high', 'ultra'] as const).map(lvl => (
                              <button 
                                key={lvl}
                                onClick={() => onObfuscationLevelChange?.(lvl)}
                                className={`py-3 rounded-xl text-[8px] font-black uppercase transition-all border ${obfuscationLevel === lvl ? 'bg-brand-500 border-brand-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <ArrowRightLeft className="w-3 h-3 text-cyan-500" /> Hardware_Logic
                          </label>
                          <button 
                            onClick={() => onFormatChange?.(macFormat === 'random' ? 'standard' : 'random')}
                            className="w-full py-4 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-between px-4 group/toggle"
                          >
                             <span className="text-[10px] font-black text-slate-400 uppercase group-hover/toggle:text-white transition-colors">{macFormat.toUpperCase()} FORMAT</span>
                             <div className={`w-10 h-5 rounded-full p-1 transition-colors ${macFormat === 'random' ? 'bg-brand-500' : 'bg-slate-800'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${macFormat === 'random' ? 'translate-x-5' : 'translate-x-0'}`}></div>
                             </div>
                          </button>
                        </div>
                        <p className="text-[8px] text-slate-600 font-black italic uppercase text-center mt-2 tracking-widest">Config_Updated_Immediately</p>
                      </div>
                    )}
                </div>

                <div className="space-y-5">
                  <button 
                      onClick={onMask}
                      disabled={isWarpDisabled}
                      className={`w-full py-6 md:py-8 rounded-[2.5rem] flex items-center justify-center gap-5 font-black text-[12px] md:text-[14px] uppercase tracking-[0.5em] transition-all active:scale-95 shadow-2xl relative overflow-hidden group/warp border-2 ${
                          isWarpDisabled 
                          ? 'bg-slate-900 text-slate-700 cursor-not-allowed border-white/5 opacity-50' 
                          : 'bg-brand-600 hover:bg-brand-500 text-white border-brand-400/30 shadow-brand-500/40'
                      }`}
                  >
                      <div className="absolute inset-0 bg-scanline opacity-0 group-hover/warp:opacity-20 pointer-events-none"></div>
                      {isMasking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Ghost className="w-6 h-6 group-hover:scale-125 transition-transform duration-500" />}
                      {isMasking ? 'INITIALIZING...' : 'MASQUER_L_EMPREINTE'}
                  </button>
                  
                  {(!isConnected || isSmartDNS) && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center gap-3">
                        <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest text-center">
                            {isSmartDNS ? 'INDISPONIBLE EN MODE SMART DNS' : 'TUNNEL VPN REQUIS POUR LE MORPHING'}
                        </p>
                    </div>
                  )}
                </div>
            </div>
        </div>
      </div>

      {/* Grid: Identity Facets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
        
        {/* Geo Node Card */}
        <div className={`${theme.cardBase} p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] border ${theme.primaryBorder} group hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] hover:translate-y-[-12px] transition-all duration-1000 relative overflow-hidden flex flex-col justify-between bracket-corner`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-150 group-hover:rotate-12 transition-all duration-1000 pointer-events-none">
                <Globe className="w-56 h-56" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-10 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`p-3.5 rounded-2xl ${theme.accent} border border-white/10 shadow-lg`}><MapPin className={`w-6 h-6 ${theme.primary}`} /></div>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Exit_Cluster</span>
                  </div>
                  <LucideHistory className="w-5 h-5 text-slate-700 hover:text-white cursor-pointer transition-colors" />
              </div>
              
              <div className="flex items-center gap-8 mb-12 relative z-10">
                  <div className="relative">
                    <div className="absolute inset-[-15px] border border-brand-500/10 rounded-full animate-spin-slow group-hover:border-brand-500/30 transition-colors"></div>
                    <span className="text-7xl md:text-8xl filter drop-shadow-2xl group-hover:scale-110 transition-transform duration-1000 block select-none">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full border-[4px] border-slate-950 shadow-2xl"></div>
                  </div>
                  <div>
                      <span className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter block leading-none">{identity.country}</span>
                      <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest bg-brand-500/10 px-4 py-1.5 rounded-full border border-brand-500/20 mt-3 inline-block shadow-lg">SEC_LEVEL_A+</span>
                  </div>
              </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-6 rounded-[2.5rem] border transition-all flex items-center justify-between group/city relative overflow-hidden shadow-2xl ${
                    isConnected 
                    ? 'bg-black/60 border-white/10 hover:border-brand-500/50 hover:bg-black/80' 
                    : 'bg-black/40 border-transparent grayscale opacity-50'
                }`}
            >
                <div className="text-left relative z-10">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Session_Location</span>
                    <span className={`text-2xl font-mono font-black tracking-tight ${isConnected ? theme.primary : 'text-slate-800'}`}>{identity.city}</span>
                </div>
                <div className="text-right relative z-10 flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]"></div>
                      Uplink_Time
                    </span>
                    <span className="text-sm font-mono font-black text-slate-400 group-hover/city:text-white transition-colors tracking-tighter">{localTime}</span>
                </div>
            </button>
        </div>

        {/* Hardware Scrambler Card */}
        <div className={`${theme.cardBase} p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] border ${theme.primaryBorder} group hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] hover:translate-y-[-12px] transition-all duration-1000 flex flex-col justify-between relative overflow-hidden bracket-corner`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-45 group-hover:scale-125 transition-all duration-1000 pointer-events-none">
                <Fingerprint className="w-56 h-56" />
            </div>
            
            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className={`p-3.5 rounded-2xl ${theme.accent} border border-white/10 shadow-lg`}><Binary className={`w-6 h-6 ${theme.primary}`} /></div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Hardware_Spoof</span>
            </div>

            <div className="bg-black/60 rounded-[2.5rem] p-8 border-2 border-white/5 mb-10 relative overflow-hidden group/mac shadow-2xl flex-1 flex flex-col justify-center min-h-[160px]">
                <div className="absolute inset-0 bg-scanline opacity-[0.04] pointer-events-none"></div>
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] mb-6 text-center block">VIRT_MAC_SIGNATURE</span>
                <div className="font-mono text-2xl md:text-3xl font-black text-white tracking-widest text-center break-all leading-tight drop-shadow-lg">
                    {isMasking ? (
                        <span className="text-brand-400 animate-pulse">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="flex justify-center gap-2 mt-10">
                   {[...Array(6)].map((_, i) => (
                      <div key={i} className={`w-8 h-1.5 rounded-full transition-all duration-300 ${isMasking ? 'bg-brand-500 animate-bounce shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'bg-slate-900'}`} style={{ animationDelay: `${i * 0.15}s` }}></div>
                   ))}
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={isWarpDisabled}
                className={`w-full py-6 rounded-[2.5rem] flex items-center justify-center gap-4 font-black text-[11px] md:text-[13px] uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl relative overflow-hidden border-2 ${
                    !isWarpDisabled
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-white/10 hover:opacity-90' 
                    : 'bg-slate-950/50 text-slate-800 cursor-not-allowed opacity-40 border-white/5'
                }`}
            >
                {isMasking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Fingerprint className="w-6 h-6" />}
                MORPH_HARDWARE_LAYER
            </button>
        </div>

        {/* OS Fingerprint Card */}
        <div className={`${theme.cardBase} p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] border ${theme.primaryBorder} group hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)] hover:translate-y-[-12px] transition-all duration-1000 flex flex-col justify-between relative overflow-hidden bracket-corner`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:-rotate-12 group-hover:scale-125 transition-all duration-1000 pointer-events-none">
                <Laptop className="w-56 h-56" />
            </div>
            
            <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-3.5 rounded-2xl ${theme.accent} border border-white/10 shadow-lg`}><Chrome className={`w-6 h-6 ${theme.primary}`} /></div>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Client_Signature</span>
                </div>
                <div className="px-4 py-1.5 bg-emerald-500/10 rounded-full text-[9px] font-black text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10 animate-pulse tracking-widest">IA_STEALTH_V2</div>
            </div>

            <div className="flex-1 space-y-6 mb-10 relative z-10">
                <div className="p-7 bg-black/60 rounded-[2.5rem] border-2 border-white/5 space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-5">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                              {getOSIcon(currentUAData.os)}
                              OS_ENGINE
                          </span>
                          <div className="relative group/info">
                            <HelpCircle className="w-4 h-4 text-slate-700 hover:text-brand-400 cursor-help transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 p-5 bg-slate-900/95 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,1)] backdrop-blur-2xl invisible group-hover/info:visible opacity-0 group-hover/info:opacity-100 transition-all duration-500 z-50 pointer-events-none border-l-4 border-l-brand-500">
                              <p className="text-[11px] text-slate-300 leading-relaxed font-bold tracking-tight">L'User Agent est votre identité logicielle unique. Le changer fragmente votre empreinte digitale numérique et empêche le ciblage publicitaire persistant.</p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-4 h-4 border-l border-t border-white/10 bg-slate-900 rotate-[225deg] -mt-2"></div>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-black text-white uppercase tracking-tighter">{isMasking ? 'RECONFIGURING' : currentUAData.os.split(' ')[0]}</span>
                    </div>
                    
                    <div className="space-y-3">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.5em] block">UA_STRING_DATA</span>
                        <div className="text-[10px] font-mono text-slate-500 leading-relaxed italic line-clamp-4 break-all bg-black/50 p-4 rounded-2xl border border-white/5 min-h-[72px] group-hover:text-brand-300 transition-colors shadow-inner">
                            {isMasking ? scrambleText.repeat(5).slice(0, 200) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={onScrambleUA}
                disabled={isWarpDisabled}
                className={`w-full py-6 rounded-[2.5rem] flex items-center justify-center gap-4 font-black text-[11px] md:text-[13px] uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl relative overflow-hidden border-2 ${
                    !isWarpDisabled 
                    ? 'bg-cyan-600/90 hover:bg-brand-600 text-white border-brand-400/30' 
                    : 'bg-slate-950/50 text-slate-800 cursor-not-allowed opacity-40 border-white/5'
                }`}
            >
                {isMasking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Scan className="w-6 h-6 group-hover:rotate-90 transition-transform duration-700" />}
                MORPH_SOFTWARE_LAYER
            </button>
        </div>
      </div>

      {/* IA Sentinel Security Collapsible */}
      {securityReport && (
          <div className={`${theme.cardBase} rounded-[3rem] md:rounded-[4.5rem] border-2 ${theme.primaryBorder} overflow-hidden transition-all duration-1000 animate-in fade-in slide-in-from-bottom-12 shadow-[0_0_80px_rgba(0,0,0,0.6)] group/recs bracket-corner`}>
             <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
             <button 
                onClick={() => setShowRecs(!showRecs)}
                className="w-full p-8 md:p-12 flex items-center justify-between hover:bg-white/[0.03] transition-all group/btn bg-black/20"
             >
                <div className="flex items-center gap-6 md:gap-10">
                    <div className={`p-5 md:p-7 rounded-[2rem] md:rounded-[2.5rem] bg-brand-500/10 border-2 border-brand-500/30 group-hover/btn:scale-110 group-hover/btn:rotate-6 group-hover/btn:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-700`}>
                        <Brain className={`w-10 h-10 md:w-14 md:h-14 ${theme.primary} drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]`} />
                    </div>
                    <div className="text-left space-y-2">
                        <h4 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">IA_Sentinel_Audit_Log</h4>
                        <div className="flex flex-wrap items-center gap-3 md:gap-6">
                            <span className="text-[10px] md:text-[12px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                              <Activity className="w-4 h-4 text-brand-500 animate-pulse" /> ENGINE_REPORT_SYNCED
                            </span>
                            <div className="hidden sm:block w-2 h-2 rounded-full bg-slate-800"></div>
                            <span className={`text-[10px] md:text-[12px] font-black uppercase tracking-widest flex items-center gap-3 ${securityReport.score > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                              <ShieldCheck className="w-4 h-4" /> THREAT_LEVEL: <span className="font-mono">{securityReport.threatLevel.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-4 md:p-5 rounded-3xl border-2 border-white/10 transition-all duration-700 flex items-center gap-4 ${showRecs ? 'rotate-180 bg-brand-500 text-white shadow-brand-500/40' : 'text-slate-600 hover:text-white hover:border-brand-500/50'}`}>
                    <ChevronDown className="w-8 h-8 md:w-10 md:h-10" />
                </div>
             </button>

             {showRecs && (
                 <div className="px-8 md:px-12 pb-12 md:pb-16 pt-4 animate-in slide-in-from-top-8 duration-1000 space-y-12">
                    <div className="p-8 md:p-12 bg-black/60 rounded-[3rem] md:rounded-[4rem] border-2 border-white/5 relative overflow-hidden group/audit shadow-inner">
                        <div className="absolute inset-0 cyber-grid opacity-[0.1]"></div>
                        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover/audit:opacity-30 group-hover:scale-110 transition-all duration-1000 pointer-events-none">
                            <ShieldHalf className="w-48 h-48" />
                        </div>
                        <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-bold italic relative z-10 pr-10 border-l-4 border-l-brand-500 pl-8">
                            "{securityReport.analysis}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="p-8 bg-slate-900/80 rounded-[2.5rem] md:rounded-[3.5rem] border-2 border-white/5 hover:border-brand-500/50 hover:translate-y-[-8px] hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-all duration-700 group/rec relative overflow-hidden">
                                <div className="absolute inset-0 bg-scanline opacity-0 group-hover/rec:opacity-[0.03] pointer-events-none"></div>
                                <div className="flex items-center gap-5 mb-6 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-[12px] font-black text-brand-500 border-2 border-brand-500/30 shadow-inner group-hover/rec:scale-110 group-hover/rec:bg-brand-500 group-hover/rec:text-white transition-all duration-500">
                                        0{i+1}
                                    </div>
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Protocol_Patch</span>
                                </div>
                                <p className="text-sm font-black text-slate-200 leading-relaxed relative z-10 group-hover:text-white transition-colors">
                                    {rec}
                                </p>
                                <div className="absolute bottom-6 right-8 opacity-0 group-hover/rec:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                    <ArrowRightLeft className="w-5 h-5 text-brand-500" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 py-8 border-t border-white/10 bg-black/40 rounded-b-[3rem] md:rounded-b-[4.5rem]">
                        <div className="flex items-center gap-4">
                             <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping shadow-[0_0_15px_rgba(6,182,212,1)]"></div>
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">SENTINEL_REALTIME_MONITOR_ON</span>
                        </div>
                        <button className="text-[10px] font-black text-brand-500 uppercase tracking-[0.3em] hover:text-white hover:underline underline-offset-8 transition-all">EXPORT_AUDIT_REPORT_V2.1</button>
                    </div>
                 </div>
             )}
          </div>
      )}

      {/* Responsive Modal: Geo Details */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
          <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-500" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-md ${theme.cardBase} border-2 ${theme.primaryBorder} rounded-[3rem] md:rounded-[4.5rem] p-10 md:p-14 shadow-[0_0_150px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500 overflow-hidden`}>
             <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
             <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
             <button onClick={() => setShowCityModal(false)} className="absolute top-8 right-8 md:top-12 md:right-12 p-4 rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-all border border-white/10 hover:rotate-90 hover:bg-red-500/20 hover:border-red-500/30"><X className="w-7 h-7" /></button>
             
             <div className="flex flex-col items-center text-center relative z-10">
              <div className={`w-32 h-32 md:w-36 md:h-36 rounded-[3rem] ${theme.accent} flex items-center justify-center mb-10 md:mb-12 border-2 border-white/10 shadow-[0_0_40px_rgba(6,182,212,0.2)] group/modal-icon`}>
                <Globe className={`w-16 h-16 md:w-20 md:h-20 ${theme.primary} animate-spin-slow group-hover/modal-icon:scale-125 transition-transform duration-1000`} />
              </div>
              <h3 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-lg">{identity.city}</h3>
              <p className="text-[12px] md:text-[14px] font-black text-slate-500 uppercase tracking-[0.6em] mt-4 italic">{identity.country}</p>
              
              <div className="grid grid-cols-1 gap-5 w-full mt-12 md:mt-16">
                <div className="p-6 bg-black/80 border-2 border-white/5 rounded-3xl flex items-center justify-between group/meta hover:border-cyan-500/40 transition-all shadow-2xl">
                    <div className="flex items-center gap-5">
                        <Users className="w-6 h-6 text-slate-600 group-hover/meta:text-cyan-500 group-hover/meta:scale-110 transition-all" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Node_Density</span>
                    </div>
                    <span className="text-lg font-mono font-black text-white tracking-tighter">{CITY_METADATA[identity.city]?.population || 'N/A'}</span>
                </div>
                <div className="p-6 bg-black/80 border-2 border-white/5 rounded-3xl flex items-center justify-between group/meta hover:border-purple-500/40 transition-all shadow-2xl">
                    <div className="flex items-center gap-5">
                        <Cloud className="w-6 h-6 text-slate-600 group-hover/meta:text-purple-500 group-hover/meta:scale-110 transition-all" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Environment</span>
                    </div>
                    <span className="text-lg font-black text-white uppercase tracking-tighter">{CITY_METADATA[identity.city]?.weather || 'Stable'}</span>
                </div>
                <div className="p-6 bg-black/80 border-2 border-white/5 rounded-3xl flex items-center justify-between group/meta hover:border-red-500/40 transition-all shadow-2xl">
                    <div className="flex items-center gap-5">
                        <ShieldAlert className="w-6 h-6 text-slate-600 group-hover/meta:text-red-500 group-hover/meta:scale-110 transition-all" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Threat_Index</span>
                    </div>
                    <span className="text-lg font-black text-white uppercase tracking-tighter">{CITY_METADATA[identity.city]?.risk || 'Minimal'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
