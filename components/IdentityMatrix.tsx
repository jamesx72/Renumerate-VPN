
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
  HelpCircle, Sparkles, Wand2, History as HistoryIcon
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
  onIpv6Toggle
}) => {
  const [copiedIp, setCopiedIp] = useState(false);
  const [localTime, setLocalTime] = useState<string>('');
  const [scrambleText, setScrambleText] = useState('');
  const [entropy, setEntropy] = useState('0.00');
  const [showCityModal, setShowCityModal] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [warpProgress, setWarpProgress] = useState(0);

  const isOnion = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  const currentUAData = useMemo(() => {
    return REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || REALISTIC_USER_AGENTS[0];
  }, [identity.userAgentShort]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEntropy((Math.random() * 0.4 + 9.6).toFixed(2));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    const updateTime = () => {
      const offsetValue = identity.timezone ? parseInt(identity.timezone.replace('UTC', '')) : 0;
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const cityTime = new Date(utc + (3600000 * offsetValue));
      setLocalTime(cityTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
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
      <div className="absolute w-full h-0.5 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.6)] animate-cyber-scan"></div>
    </div>
  );

  return (
    <div className={`space-y-6 md:space-y-8 ${isMasking ? 'animate-matrix-shift' : ''}`}>
      {/* Top Section: IP Gateway & Warp Core */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* IP Gateway Card */}
        <div className={`lg:col-span-7 ${theme.cardBase} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border ${theme.primaryBorder} relative overflow-hidden group ${theme.glow} bracket-corner`}>
          <CyberScanOverlay />
          <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-12">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-10 ${theme.primaryBg} rounded-full animate-pulse shadow-lg`}></div>
                <div>
                  <h3 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-[0.4em]">Identity_Nexus_Uplink</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 animate-pulse'}`}></div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{isConnected ? 'SESSION_ENCRYPTED' : 'UPLINK_DISCONNECTED'}</span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-black/40 border border-white/5 font-mono text-[9px] md:text-[10px] text-slate-400 self-start sm:self-center">
                VIRT_UUID: <span className="text-brand-400">RNC_{Math.random().toString(36).substr(2, 8).toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-4">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                  <Target className={`w-3 h-3 ${theme.primary}`} /> Active_Tunnel_Address
                </span>
                <div className="flex flex-wrap items-center gap-4 md:gap-8">
                  <div className={`text-4xl sm:text-6xl md:text-7xl font-mono font-black tracking-tighter transition-all duration-300 ${isRotating ? 'animate-glitch text-red-500' : 'text-slate-900 dark:text-white'}`}>
                    {isRotating ? scrambleText.slice(0, 15) : identity.ip}
                  </div>
                  {!isRotating && (
                    <button 
                        onClick={handleCopyIp}
                        className={`p-4 md:p-5 rounded-[1.5rem] md:rounded-[1.8rem] transition-all active:scale-90 border shadow-2xl group/copy ${copiedIp ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-white/10'}`}
                    >
                        {copiedIp ? <ShieldCheck className="w-6 h-6 md:w-7 md:h-7" /> : <Copy className="w-6 h-6 md:w-7 md:h-7 group-hover/copy:rotate-6 transition-transform" />}
                    </button>
                  )}
                </div>
            </div>

            <div className="mt-10 md:mt-14 pt-8 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
                <div className="space-y-2">
                   <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Anonymity_Entropy</span>
                   <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-5 ${theme.primaryBg} rounded-sm shadow-lg shadow-cyan-500/20`}></div>
                      <span className="text-xl font-mono font-black text-slate-800 dark:text-cyan-400">{entropy}%</span>
                   </div>
                </div>
                <div className="space-y-2">
                   <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Core_Latency</span>
                   <div className="flex items-center gap-3">
                      <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                      <span className="text-xl font-mono font-black text-slate-800 dark:text-emerald-400">{identity.latency}ms</span>
                   </div>
                </div>
                <div className="space-y-2">
                   <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Encryption_Mode</span>
                   <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-purple-500" />
                      <span className="text-xl font-mono font-black text-slate-800 dark:text-purple-400">AES-XTS</span>
                   </div>
                </div>
            </div>
          </div>
        </div>

        {/* Identity Warp Controller */}
        <div className={`lg:col-span-5 ${theme.cardBase} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border-2 border-brand-500/30 relative overflow-hidden group shadow-[0_0_50px_rgba(6,182,212,0.15)] bracket-corner flex flex-col`}>
            <div className="absolute inset-0 bg-brand-500/[0.03] pointer-events-none"></div>
            {isMasking && <div className="absolute inset-0 bg-brand-500/10 animate-pulse z-20"></div>}
            
            <div className="relative z-30 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-8">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">Identity_Warp_V2</h4>
                          <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-500"><Sparkles className="w-3 h-3" /></div>
                        </div>
                        <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Full_Trace_Elimination</p>
                    </div>
                    <div className={`p-4 rounded-2xl bg-black/50 border border-white/10 transition-all duration-700 ${isMasking ? 'animate-spin-slow text-brand-500 border-brand-500/50 shadow-[0_0_25px_rgba(6,182,212,0.5)]' : 'text-slate-600 hover:text-slate-400'}`}>
                        <Orbit className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                </div>

                <div className="flex-1 space-y-6 mb-8">
                    <div className="p-4 bg-black/60 rounded-2xl border border-white/5 space-y-3 shadow-inner">
                      <div className="flex items-center justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
                        <span>MAC_ROTATION</span>
                        <span className={isMasking ? 'text-cyan-400 animate-pulse' : 'text-emerald-500'}>{isMasking ? 'UPDATING' : 'SECURE'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
                        <span>AGENT_MORPHING</span>
                        <span className={isMasking ? 'text-cyan-400 animate-pulse' : 'text-emerald-500'}>{isMasking ? 'UPDATING' : 'SECURE'}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
                            <span>Matrix_Load</span>
                            <span className="text-brand-400">{Math.round(warpProgress)}%</span>
                        </div>
                        <div className="h-2 bg-black/60 rounded-full border border-white/5 overflow-hidden p-0.5">
                            <div 
                                className="h-full bg-brand-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.8)] transition-all duration-300"
                                style={{ width: `${warpProgress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={onMask}
                    disabled={isMasking}
                    className={`w-full py-5 md:py-6 rounded-[2rem] flex items-center justify-center gap-4 font-black text-[10px] md:text-[11px] uppercase tracking-[0.4em] transition-all active:scale-95 shadow-2xl relative overflow-hidden group/warp ${
                        isMasking 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' 
                        : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/40'
                    }`}
                >
                    <div className="absolute inset-0 bg-scanline opacity-0 group-hover/warp:opacity-10 pointer-events-none"></div>
                    {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />}
                    {isMasking ? 'INITIALIZING...' : 'EXECUTE_RE_NUMERATION'}
                </button>
            </div>
        </div>
      </div>

      {/* Grid: Identity Facets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Geo Node Card */}
        <div className={`${theme.cardBase} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border ${theme.primaryBorder} group hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] hover:translate-y-[-8px] transition-all duration-700 relative overflow-hidden flex flex-col justify-between bracket-corner`}>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-125 transition-all duration-1000">
                <Globe className="w-40 h-40" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl ${theme.accent} border border-white/10`}><MapPin className={`w-5 h-5 ${theme.primary}`} /></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active_Node</span>
                  </div>
                  <HistoryIcon className="w-4 h-4 text-slate-600 hover:text-slate-400 cursor-pointer transition-colors" />
              </div>
              
              <div className="flex items-center gap-6 mb-10 relative z-10">
                  <div className="relative">
                    <div className="absolute inset-[-12px] border border-brand-500/10 rounded-full animate-spin-slow group-hover:border-brand-500/30"></div>
                    <span className="text-6xl md:text-7xl filter drop-shadow-2xl group-hover:scale-110 transition-transform duration-700 block">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-slate-900 shadow-xl"></div>
                  </div>
                  <div>
                      <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter block">{identity.country}</span>
                      <span className="text-[9px] font-black text-brand-400 uppercase tracking-widest bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20 mt-2 inline-block">SEC_ZONE_A</span>
                  </div>
              </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-5 rounded-[2rem] border transition-all flex items-center justify-between group/city relative overflow-hidden ${
                    isConnected 
                    ? 'bg-black/40 border-white/5 hover:border-brand-500/40 hover:bg-black/60 shadow-inner' 
                    : 'bg-black/20 border-transparent grayscale opacity-50'
                }`}
            >
                <div className="text-left relative z-10">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Cluster_Exit</span>
                    <span className={`text-xl font-mono font-black tracking-tight ${isConnected ? theme.primary : 'text-slate-700'}`}>{identity.city}</span>
                </div>
                <div className="text-right relative z-10">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Sync_Time</span>
                    <span className="text-xs font-mono font-bold text-slate-400 group-hover/city:text-white transition-colors">{localTime}</span>
                </div>
            </button>
        </div>

        {/* Hardware Scrambler Card */}
        <div className={`${theme.cardBase} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border ${theme.primaryBorder} group hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] hover:translate-y-[-8px] transition-all duration-700 flex flex-col justify-between relative overflow-hidden bracket-corner`}>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 transition-all duration-1000">
                <Fingerprint className="w-40 h-40" />
            </div>
            
            <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className={`p-2.5 rounded-2xl ${theme.accent} border border-white/10`}><Binary className={`w-5 h-5 ${theme.primary}`} /></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware_Spoof</span>
            </div>

            <div className="bg-black/50 rounded-[2rem] p-6 border border-white/5 mb-8 relative overflow-hidden group/mac shadow-inner flex-1 flex flex-col justify-center">
                <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 text-center block">VIRTUAL_MAC_IDENT</span>
                <div className="font-mono text-xl md:text-2xl font-black text-white tracking-widest text-center break-all leading-tight">
                    {isMasking ? (
                        <span className="text-cyan-400 animate-pulse">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="flex justify-center gap-1.5 mt-8">
                   {[...Array(6)].map((_, i) => (
                      <div key={i} className={`w-6 h-1 rounded-full ${isMasking ? 'bg-cyan-500 animate-bounce' : 'bg-slate-800'}`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                   ))}
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={isMasking}
                className={`w-full py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl relative overflow-hidden ${
                    !isMasking
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90' 
                    : 'bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-50'
                }`}
            >
                {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
                MORPH_MAC_ONLY
            </button>
        </div>

        {/* OS Fingerprint Card */}
        <div className={`${theme.cardBase} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border ${theme.primaryBorder} group hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] hover:translate-y-[-8px] transition-all duration-700 flex flex-col justify-between relative overflow-hidden bracket-corner`}>
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 transition-all duration-1000">
                <Laptop className="w-40 h-40" />
            </div>
            
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl ${theme.accent} border border-white/10`}><Chrome className={`w-5 h-5 ${theme.primary}`} /></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Client_Fingerprint</span>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 rounded-full text-[8px] font-black text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10 animate-pulse">IA_STEALTH</div>
            </div>

            <div className="flex-1 space-y-4 mb-8 relative z-10">
                <div className="p-5 bg-black/50 rounded-[2rem] border border-white/5 space-y-5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              {getOSIcon(currentUAData.os)}
                              OS_SYS
                          </span>
                          <div className="relative group/info">
                            <HelpCircle className="w-3 h-3 text-slate-700 hover:text-cyan-500 cursor-help transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl invisible group-hover/info:visible opacity-0 group-hover/info:opacity-100 transition-all duration-300 z-50 pointer-events-none">
                              <p className="text-[10px] text-slate-300 leading-relaxed font-medium">L'User Agent est votre signature logicielle. Le modifier brise le tracking persistant par fingerprinting.</p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 border-l border-t border-white/10 bg-slate-900 rotate-[225deg] -mt-1.5"></div>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-black text-white uppercase">{isMasking ? 'ROTATING' : currentUAData.os.split(' ')[0]}</span>
                    </div>
                    
                    <div className="space-y-2">
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em] block">UA_STRING_HASH</span>
                        <div className="text-[9px] font-mono text-slate-500 leading-relaxed italic line-clamp-3 break-all bg-black/40 p-3 rounded-xl border border-white/5 min-h-[54px] group-hover:text-slate-300 transition-colors">
                            {isMasking ? scrambleText.repeat(4).slice(0, 150) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={onScrambleUA}
                disabled={isMasking}
                className={`w-full py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl relative overflow-hidden ${
                    !isMasking 
                    ? 'bg-cyan-600/90 hover:bg-cyan-600 text-white border border-cyan-400/20' 
                    : 'bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-50'
                }`}
            >
                {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
                MORPH_UA_ONLY
            </button>
        </div>
      </div>

      {/* IA Sentinel Security Collapsible */}
      {securityReport && (
          <div className={`${theme.cardBase} rounded-[2.5rem] md:rounded-[4rem] border ${theme.primaryBorder} overflow-hidden transition-all duration-1000 animate-in fade-in slide-in-from-bottom-8 shadow-2xl group/recs bracket-corner`}>
             <button 
                onClick={() => setShowRecs(!showRecs)}
                className="w-full p-6 md:p-10 flex items-center justify-between hover:bg-white/[0.02] transition-colors group/btn"
             >
                <div className="flex items-center gap-4 md:gap-8">
                    <div className={`p-4 md:p-5 rounded-2xl md:rounded-[2rem] bg-brand-500/10 border border-brand-500/30 group-hover/btn:scale-110 group-hover/btn:rotate-6 transition-all duration-500`}>
                        <Brain className={`w-8 h-8 md:w-10 md:h-10 ${theme.primary}`} />
                    </div>
                    <div className="text-left space-y-1">
                        <h4 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">IA_Sentinel_Audit</h4>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4">
                            <span className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <Activity className="w-3 h-3 text-cyan-500" /> SYSTEM_REPORT_SYNCED
                            </span>
                            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${securityReport.score > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                              <ShieldCheck className="w-3 h-3" /> THREAT_LEVEL: {securityReport.threatLevel.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-3 md:p-4 rounded-2xl border border-white/10 transition-all duration-500 flex items-center gap-3 ${showRecs ? 'rotate-180 bg-brand-500/10 text-brand-500' : 'text-slate-500 hover:text-white'}`}>
                    <ChevronDown className="w-6 h-6 md:w-7 md:h-7" />
                </div>
             </button>

             {showRecs && (
                 <div className="px-6 md:px-10 pb-8 md:pb-10 pt-2 animate-in slide-in-from-top-4 duration-700 space-y-8">
                    <div className="p-6 md:p-8 bg-black/60 rounded-[2rem] md:rounded-[3rem] border border-white/5 relative overflow-hidden group/audit shadow-inner">
                        <div className="absolute inset-0 cyber-grid opacity-[0.05]"></div>
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/audit:opacity-20 transition-opacity">
                            <ShieldHalf className="w-32 h-32" />
                        </div>
                        <p className="text-sm md:text-base text-slate-300 leading-relaxed font-medium italic relative z-10 pr-4">
                            "{securityReport.analysis}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="p-6 bg-slate-900/60 rounded-[1.8rem] md:rounded-[2.2rem] border border-white/5 hover:border-brand-500/40 hover:translate-y-[-4px] transition-all duration-500 group/rec relative overflow-hidden shadow-xl">
                                <div className="flex items-center gap-4 mb-4 relative z-10">
                                    <div className="w-8 h-8 rounded-xl bg-brand-500/10 flex items-center justify-center text-[10px] font-black text-brand-500 border border-brand-500/20 shadow-inner group-hover/rec:scale-110 transition-transform">
                                        0{i+1}
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Protocol_Patch</span>
                                </div>
                                <p className="text-xs font-bold text-slate-300 leading-relaxed relative z-10">
                                    {rec}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 py-6 border-t border-white/5 bg-black/30 rounded-b-[2.5rem] md:rounded-b-[4rem]">
                        <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-brand-500 animate-ping shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
                             <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">SENTINEL_ACTIVE_MONITORING_LOCKED</span>
                        </div>
                        <button className="text-[8px] font-black text-brand-500 uppercase tracking-widest hover:underline underline-offset-4">LOG_EXPORT_V4.2</button>
                    </div>
                 </div>
             )}
          </div>
      )}

      {/* Responsive Modal: Geo Details */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-500" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-sm ${theme.cardBase} border-2 ${theme.primaryBorder} rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-12 shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500 overflow-hidden`}>
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
             <button onClick={() => setShowCityModal(false)} className="absolute top-6 right-6 md:top-10 md:right-10 p-3 rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-all border border-white/10 hover:rotate-90"><X className="w-6 h-6" /></button>
             
             <div className="flex flex-col items-center text-center">
              <div className={`w-24 h-24 md:w-28 md:h-28 rounded-[2.5rem] ${theme.accent} flex items-center justify-center mb-8 md:mb-10 border border-white/10 shadow-2xl group/modal-icon`}>
                <Globe className={`w-12 h-12 md:w-14 md:h-14 ${theme.primary} animate-spin-slow group-hover/modal-icon:scale-110 transition-transform`} />
              </div>
              <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">{identity.city}</h3>
              <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">{identity.country}</p>
              
              <div className="grid grid-cols-1 gap-4 w-full mt-10 md:mt-12">
                <div className="p-5 bg-black/60 border border-white/5 rounded-2xl flex items-center justify-between group/meta hover:border-cyan-500/30 transition-all shadow-inner">
                    <div className="flex items-center gap-4">
                        <Users className="w-5 h-5 text-slate-600 group-hover/meta:text-cyan-500 transition-colors" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Density</span>
                    </div>
                    <span className="text-sm font-mono font-black text-white">{CITY_METADATA[identity.city]?.population || 'N/A'}</span>
                </div>
                <div className="p-5 bg-black/60 border border-white/5 rounded-2xl flex items-center justify-between group/meta hover:border-purple-500/30 transition-all shadow-inner">
                    <div className="flex items-center gap-4">
                        <Cloud className="w-5 h-5 text-slate-600 group-hover/meta:text-purple-500 transition-colors" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Atmosphere</span>
                    </div>
                    <span className="text-sm font-black text-white">{CITY_METADATA[identity.city]?.weather || 'Stable'}</span>
                </div>
                <div className="p-5 bg-black/60 border border-white/5 rounded-2xl flex items-center justify-between group/meta hover:border-red-500/30 transition-all shadow-inner">
                    <div className="flex items-center gap-4">
                        <ShieldAlert className="w-5 h-5 text-slate-600 group-hover/meta:text-red-500 transition-colors" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Risk_Index</span>
                    </div>
                    <span className="text-sm font-black text-white uppercase">{CITY_METADATA[identity.city]?.risk || 'Minimal'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
