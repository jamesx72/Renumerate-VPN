
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
  CheckCircle2, ExternalLink, MousePointer2, Terminal, Cpu, Radar as RadarIcon
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

const COUNTRIES_WITH_FLAGS: Record<string, string> = {
  'France': '🇫🇷', 'Suisse': '🇨🇭', 'Singapour': '🇸🇬', 'Islande': '🇮🇸', 'Estonie': '🇪🇪', 'Panama': '🇵🇦', 'USA': '🇺🇸', 'Allemagne': '🇩🇪'
};

/**
 * Visual Entropy Radar Component
 */
const EntropyRadar = ({ isMasking, level }: { isMasking: boolean, level: string }) => {
  const [points, setPoints] = useState([60, 70, 50, 80]); // MAC, UA, IP, PACKET
  
  useEffect(() => {
    const base = level === 'ultra' ? 85 : level === 'high' ? 70 : 50;
    const interval = setInterval(() => {
      setPoints(prev => prev.map(p => {
        const target = isMasking ? 95 : base;
        const jitter = isMasking ? (Math.random() * 10 - 5) : (Math.random() * 6 - 3);
        return Math.max(20, Math.min(100, target + jitter));
      }));
    }, isMasking ? 100 : 800);
    return () => clearInterval(interval);
  }, [isMasking, level]);

  const size = 160;
  const center = size / 2;
  const radius = center - 10;
  
  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI / 2) + (index * Math.PI / 2);
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center - r * Math.sin(angle)
    };
  };

  const polyPoints = points.map((p, i) => {
    const coords = getCoordinates(i, p);
    return `${coords.x},${coords.y}`;
  }).join(' ');

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg width={size} height={size} className="absolute inset-0 overflow-visible pointer-events-none">
        <circle cx={center} cy={center} r={radius * 0.25} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <circle cx={center} cy={center} r={radius * 0.5} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <circle cx={center} cy={center} r={radius * 0.75} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(34,211,238,0.08)" strokeWidth="1" />
        
        {[0, 1, 2, 3].map(i => {
          const coords = getCoordinates(i, 100);
          return <line key={i} x1={center} y1={center} x2={coords.x} y2={coords.y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />;
        })}

        <polygon
          points={polyPoints}
          fill={isMasking ? "rgba(34,211,238,0.2)" : "rgba(139,92,246,0.15)"}
          stroke={isMasking ? "#22d3ee" : "#8b5cf6"}
          strokeWidth="2"
          className="transition-all duration-300 ease-out"
          style={{ filter: `drop-shadow(0 0 12px ${isMasking ? '#22d3ee' : '#8b5cf6'})` }}
        />
        
        {points.map((p, i) => {
          const coords = getCoordinates(i, p);
          return (
            <circle 
              key={i} 
              cx={coords.x} 
              cy={coords.y} 
              r="3" 
              fill={isMasking ? "#22d3ee" : "#8b5cf6"} 
              className="transition-all duration-300 ease-out"
            />
          );
        })}
      </svg>
      
      <span className="absolute -top-5 text-[7px] font-black text-slate-600 uppercase tracking-[0.2em]">UA_COMP</span>
      <span className="absolute -bottom-5 text-[7px] font-black text-slate-600 uppercase tracking-[0.2em]">IP_OBFS</span>
      <span className="absolute -right-8 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] rotate-90">PKT_JIT</span>
      <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] -rotate-90">MAC_ENTR</span>
    </div>
  );
};

const GlitchIP = ({ text, active }: { text: string, active: boolean }) => {
  if (!active) return <>{text}</>;

  return (
    <div className="relative inline-block isolate">
      <span className="absolute top-0 left-0 -z-10 animate-glitch text-red-500 mix-blend-screen opacity-80 translate-x-[3px] translate-y-[-2px] select-none overflow-hidden">
        {text}
      </span>
      <span className="absolute top-0 left-0 -z-10 animate-glitch text-cyan-400 mix-blend-screen opacity-80 translate-x-[-3px] translate-y-[2px] select-none overflow-hidden">
        {text}
      </span>
      <span className="relative z-10 animate-glitch text-white block">
        {text}
      </span>
      <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        <div className="w-full h-[2px] bg-white/20 absolute top-1/4 animate-scanline opacity-30"></div>
        <div className="w-full h-[1px] bg-brand-400/40 absolute top-2/3 animate-scanline opacity-20"></div>
      </div>
    </div>
  );
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
    cardBase: 'bg-slate-900/40 backdrop-blur-3xl border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]',
    accent: isOnion ? 'bg-purple-500/10' : isSmartDNS ? 'bg-amber-500/10' : 'bg-brand-500/10'
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Gateway Card */}
        <div className={`lg:col-span-7 ${theme.cardBase} p-10 rounded-[3rem] relative overflow-hidden group shadow-2xl transition-all duration-700`}>
          <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
          <div className="absolute inset-0 cyber-grid opacity-5 pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-500/40 to-transparent animate-cyber-scan pointer-events-none"></div>
          
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-6">
                <div className={`w-[2px] h-14 ${theme.primaryBg} rounded-full animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.5)]`}></div>
                <div>
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Network_Uplink_Node</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[11px] font-mono font-black uppercase tracking-widest ${isConnected ? 'text-brand-400' : 'text-red-500'}`}>
                      {isConnected ? 'ENCRYPTED_256B' : 'CONNECTION_OFFLINE'}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-brand-500 animate-ping' : 'bg-red-500 shadow-[0_0_8px_red]'}`}></div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-[9px] text-slate-500 shadow-inner group-hover:border-brand-500/30 transition-colors">
                KERN_ID: <span className="text-white font-black">{Math.random().toString(36).substr(2, 8).toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-6">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.7em] ml-1 flex items-center gap-3">
                  <Terminal className={`w-3.5 h-3.5 ${theme.primary} opacity-70`} /> Public_Gateway_Address
                </span>
                <div className="flex flex-wrap items-center gap-8">
                  <div className={`text-5xl sm:text-6xl md:text-7xl font-mono font-black tracking-tighter transition-all duration-700 text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.05)]`}>
                    <GlitchIP 
                      text={isRotating || isMasking ? scrambleText.slice(0, 15) : identity.ip} 
                      active={isRotating || isMasking} 
                    />
                  </div>
                  {!isRotating && !isMasking && (
                    <button 
                        onClick={handleCopyIp}
                        className={`p-5 rounded-[2rem] bg-white/5 border border-white/5 text-slate-500 hover:text-brand-400 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all active:scale-90 group/copy shadow-xl backdrop-blur-md`}
                    >
                        {copiedIp ? <ShieldCheck className="w-7 h-7 text-emerald-500" /> : <Copy className="w-7 h-7 group-hover/copy:scale-110 transition-transform" />}
                    </button>
                  )}
                </div>
            </div>

            <div className="mt-14 pt-8 border-t border-white/5 grid grid-cols-3 gap-8">
                <div className="space-y-3">
                   <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block">Entropy_Index</span>
                   <div className="font-mono text-xl font-black text-brand-400 tracking-tighter italic">{entropy}%</div>
                   <div className="w-full h-[3px] bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-all duration-1000" style={{ width: `${entropy}%` }}></div>
                   </div>
                </div>
                <div className="space-y-3 border-l border-white/5 pl-8">
                   <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block">Ping_Response</span>
                   <div className="font-mono text-xl font-black text-emerald-400 tracking-tighter italic">{identity.latency}ms</div>
                   <div className="flex gap-1">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className={`w-1.5 h-3 rounded-[1px] transition-all duration-500 ${i <= 4 ? 'bg-emerald-500/40 group-hover:bg-emerald-500' : 'bg-slate-800'}`}></div>
                      ))}
                   </div>
                </div>
                <div className="space-y-3 border-l border-white/5 pl-8">
                   <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block">Kernel_Security</span>
                   <div className="font-mono text-xl font-black text-purple-400 tracking-tighter italic">AES_GCM</div>
                   <div className="text-[7px] font-black text-slate-800 uppercase tracking-[0.2em] group-hover:text-slate-600 transition-colors">Phase_4_Sync</div>
                </div>
            </div>
          </div>
        </div>

        {/* Warp Module Card */}
        <div className={`lg:col-span-5 ${theme.cardBase} p-10 rounded-[3rem] border-2 border-brand-500/10 relative overflow-hidden group shadow-[0_0_60px_rgba(0,0,0,0.3)] flex flex-col transition-all duration-500 hover:border-brand-500/30 hover:scale-[1.01]`}>
            <div className="absolute inset-0 bg-brand-500/[0.02] pointer-events-none"></div>
            
            <div className="relative z-30 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <h4 className="text-2xl font-black text-white uppercase tracking-tighter italic">Neural_Warp</h4>
                          <div className="p-2 rounded-xl bg-brand-500/5 border border-brand-500/10 text-brand-400 group-hover:rotate-180 transition-transform duration-1000"><Sparkles className="w-4 h-4 animate-pulse" /></div>
                        </div>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] mt-2">Matrix_Sync: <span className="text-emerald-500/80">NOMINAL</span></p>
                    </div>
                    <button 
                      onClick={() => setShowWarpTuning(!showWarpTuning)}
                      className={`p-3.5 rounded-xl bg-black/40 border border-white/5 transition-all duration-500 ${showWarpTuning ? 'text-brand-400 border-brand-500 shadow-[0_0_15px_rgba(6,182,212,0.2)] rotate-90 scale-110' : 'text-slate-600 hover:text-white'}`}
                    >
                        {showWarpTuning ? <X className="w-6 h-6" /> : <Settings2 className="w-6 h-6" />}
                    </button>
                </div>

                <div className="flex-1 relative mb-6 flex items-center justify-center min-h-[160px]">
                    {!showWarpTuning ? (
                      <div className="flex flex-col items-center gap-8 w-full animate-in fade-in zoom-in-95 duration-500">
                        <EntropyRadar isMasking={isMasking} level={obfuscationLevel} />
                        
                        <div className="w-full space-y-4 px-2">
                            <div className="flex justify-between text-[8px] font-black text-slate-700 uppercase tracking-[0.3em]">
                                <span>Synchronicity_Core</span>
                                <span className="text-brand-400 font-mono text-sm">{Math.round(warpProgress)}%</span>
                            </div>
                            <div className="h-[3px] bg-black/40 rounded-full overflow-hidden p-0 flex gap-0.5">
                                {[...Array(24)].map((_, i) => (
                                  <div 
                                    key={i} 
                                    className={`h-full flex-1 rounded-[1px] transition-all duration-300 ${i * 4 < warpProgress ? 'bg-brand-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'bg-slate-900'}`}
                                  ></div>
                                ))}
                            </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950/80 rounded-[2.5rem] border border-brand-500/20 p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500 absolute inset-0 z-40 backdrop-blur-2xl overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 cyber-grid opacity-5"></div>
                        <div className="space-y-4 relative z-10">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                            <Shield className="w-3.5 h-3.5 text-brand-500" /> Layer_Security
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['standard', 'high', 'ultra'] as const).map(lvl => (
                              <button 
                                key={lvl}
                                onClick={() => onObfuscationLevelChange?.(lvl)}
                                className={`py-4 rounded-xl text-[8px] font-black uppercase transition-all border ${obfuscationLevel === lvl ? 'bg-brand-500 text-white border-brand-400 shadow-lg' : 'bg-black/40 border-white/5 text-slate-600 hover:text-slate-400'}`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 relative z-10">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                            <Binary className="w-3.5 h-3.5 text-brand-400" /> HW_Algorithm
                          </label>
                          <button 
                            onClick={() => onFormatChange?.(macFormat === 'random' ? 'standard' : 'random')}
                            className="w-full py-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between px-6 hover:border-brand-500/30 transition-all"
                          >
                             <div className="flex flex-col text-left">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{macFormat.toUpperCase()}</span>
                               <span className="text-[7px] font-bold text-slate-700 uppercase mt-0.5">{macFormat === 'random' ? 'Entropy_Enabled' : 'Fixed_Stream'}</span>
                             </div>
                             <div className={`w-9 h-4.5 rounded-full p-1 transition-all duration-500 ${macFormat === 'random' ? 'bg-brand-500' : 'bg-slate-800'}`}>
                                <div className={`w-2.5 h-2.5 bg-white rounded-full transition-transform duration-500 ${macFormat === 'random' ? 'translate-x-4' : 'translate-x-0'}`}></div>
                             </div>
                          </button>
                        </div>
                      </div>
                    )}
                </div>

                <div className="space-y-3">
                  <button 
                      onClick={onMask}
                      disabled={isWarpDisabled}
                      className={`w-full py-6 rounded-[2rem] flex items-center justify-center gap-4 font-black text-[11px] uppercase tracking-[0.4em] transition-all active:scale-95 shadow-2xl relative overflow-hidden group/warp border border-white/5 ${
                          isWarpDisabled 
                          ? 'bg-slate-900/40 text-slate-700 cursor-not-allowed border-transparent' 
                          : 'bg-brand-600 hover:bg-brand-500 text-white shadow-[0_0_25px_rgba(6,182,212,0.25)] hover:-translate-y-0.5 hover:animate-glitch'
                      }`}
                  >
                      <div className="absolute inset-0 bg-scanline opacity-0 group-hover/warp:opacity-10 pointer-events-none transition-opacity"></div>
                      {isMasking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 group-hover:scale-125 transition-transform" />}
                      {isMasking ? 'SYNCHRONIZING...' : "RENOUVELER L'IDENTITÉ"}
                  </button>
                  
                  {(!isConnected || isSmartDNS) && (
                    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-red-500/5 rounded-xl border border-red-500/10">
                        <AlertCircle className="w-3 h-3 text-red-500/70" />
                        <p className="text-[7px] font-black text-red-500/70 uppercase tracking-widest">
                            REQUIERT UPLINK ACTIF
                        </p>
                    </div>
                  )}
                </div>
            </div>
        </div>
      </div>

      {/* Identity Facets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Geo Location Card */}
        <div className={`${theme.cardBase} p-8 rounded-[3rem] group hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all duration-700 relative overflow-hidden flex flex-col justify-between hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 p-6 opacity-[0.01] group-hover:opacity-[0.05] group-hover:scale-125 group-hover:rotate-6 transition-all duration-1000 pointer-events-none">
                <Globe className="w-56 h-56 text-brand-400" />
            </div>
            
            <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${theme.accent} border border-white/5 backdrop-blur-xl group-hover:scale-110 transition-transform duration-700 shadow-lg`}><MapPin className={`w-5 h-5 ${theme.primary}`} /></div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Geo_Coordinates</span>
                </div>
                <LucideHistory className="w-4 h-4 text-slate-700 hover:text-white cursor-pointer transition-colors" />
            </div>
            
            <div className="flex items-center gap-8 mb-12 relative z-10">
                <div className="relative">
                  <div className="absolute inset-[-8px] border border-dashed border-brand-500/20 rounded-full animate-spin-slow"></div>
                  <span className="text-7xl filter drop-shadow-2xl group-hover:scale-110 transition-transform duration-1000 block">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-slate-900 shadow-lg"></div>
                </div>
                <div className="space-y-2">
                    <span className="text-3xl font-black text-white uppercase tracking-tighter block leading-none">{identity.country}</span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-brand-500/10 rounded-lg border border-brand-500/10 w-fit">
                        <div className="w-1 h-1 bg-brand-400 rounded-full animate-pulse"></div>
                        <span className="text-[8px] font-black text-brand-400 uppercase tracking-widest">TIER_1_UPLINK</span>
                    </div>
                </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-5 rounded-[2rem] border transition-all flex items-center justify-between group/city relative overflow-hidden ${
                    isConnected 
                    ? 'bg-black/40 border-white/5 hover:border-brand-500/30 hover:bg-black/60 shadow-lg' 
                    : 'bg-black/20 border-transparent grayscale opacity-50'
                }`}
            >
                <div className="text-left relative z-10">
                    <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em] mb-1 block">Session_Region</span>
                    <span className={`text-xl font-mono font-black tracking-tighter ${isConnected ? 'text-white' : 'text-slate-700'}`}>{identity.city}</span>
                </div>
                <div className="text-right relative z-10 flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                      Local_Uptime
                    </span>
                    <span className="text-xs font-mono font-black text-slate-500 group-hover/city:text-brand-400 transition-colors">{localTime}</span>
                </div>
            </button>
        </div>

        {/* Hardware Signature Card */}
        <div className={`${theme.cardBase} p-8 rounded-[3rem] group hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all duration-700 flex flex-col justify-between relative overflow-hidden hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 p-6 opacity-[0.01] group-hover:opacity-[0.05] group-hover:rotate-45 group-hover:scale-125 transition-all duration-1000 pointer-events-none">
                <Fingerprint className="w-56 h-56 text-brand-400" />
            </div>
            
            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className={`p-4 rounded-2xl ${theme.accent} border border-white/5 backdrop-blur-xl group-hover:scale-110 transition-transform duration-700 shadow-lg`}><Binary className={`w-5 h-5 ${theme.primary}`} /></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">HW_ID_Scrambler</span>
            </div>

            <div className="bg-black/40 rounded-[2.5rem] p-8 border border-white/5 mb-8 relative overflow-hidden group/mac shadow-inner flex-1 flex flex-col justify-center text-center">
                <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none"></div>
                <span className="text-[8px] font-black text-slate-800 uppercase tracking-[0.4em] mb-6 block">VIRTUAL_MAC_STREAM</span>
                <div className="font-mono text-2xl font-black text-white tracking-[0.1em] leading-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-500 group-hover:text-brand-400">
                    {isMasking ? (
                        <span className="text-brand-500 animate-pulse tracking-[0.2em]">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="flex justify-center gap-2 mt-8">
                   {[...Array(8)].map((_, i) => (
                      <div key={i} className={`w-5 h-[2px] rounded-full transition-all duration-500 ${isMasking ? 'bg-brand-500 animate-bounce' : 'bg-slate-800'}`} style={{ animationDelay: `${i * 0.08}s` }}></div>
                   ))}
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={isWarpDisabled}
                className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.3em] transition-all active:scale-95 border ${
                    !isWarpDisabled
                    ? 'bg-slate-900/60 text-white border-white/10 hover:bg-slate-800 hover:border-brand-500/30 shadow-xl' 
                    : 'bg-slate-950/40 text-slate-800 cursor-not-allowed border-transparent'
                }`}
            >
                {isMasking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />}
                MORPH_SIGNATURE
            </button>
        </div>

        {/* Client Footprint Card */}
        <div className={`${theme.cardBase} p-8 rounded-[3rem] group hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all duration-700 flex flex-col justify-between relative overflow-hidden hover:-translate-y-1`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 p-6 opacity-[0.01] group-hover:opacity-[0.05] group-hover:-rotate-12 group-hover:scale-125 transition-all duration-1000 pointer-events-none">
                <Laptop className="w-56 h-56 text-brand-400" />
            </div>
            
            <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${theme.accent} border border-white/5 backdrop-blur-xl group-hover:scale-110 transition-transform duration-700 shadow-lg`}><Chrome className={`w-5 h-5 ${theme.primary}`} /></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Client_Metadata</span>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 rounded-full text-[8px] font-black text-emerald-500 border border-emerald-500/20 shadow-lg animate-pulse tracking-[0.2em]">S_SYNC</div>
            </div>

            <div className="flex-1 space-y-6 mb-8 relative z-10">
                <div className="p-6 bg-black/40 rounded-[2.5rem] border border-white/5 space-y-5 shadow-inner relative overflow-hidden hover:border-brand-500/20 transition-all">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <Cpu className="w-3.5 h-3.5 text-brand-500/50" /> Virtual_OS
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-black text-white uppercase tracking-tighter italic">{isMasking ? 'RECONFIG...' : currentUAData.os.split(' ')[0]}</span>
                    </div>
                    
                    <div className="space-y-3">
                        <span className="text-[8px] font-black text-slate-800 uppercase tracking-[0.4em] block">HTTP_HEADER_ID</span>
                        <div className="text-[9px] font-mono text-slate-500 leading-relaxed truncate bg-black/40 p-4 rounded-xl border border-white/5 min-h-[50px] group-hover:text-brand-400/80 transition-colors">
                            {isMasking ? scrambleText.repeat(3) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-3 relative z-10">
              <button 
                  onClick={onScrambleUA}
                  disabled={isWarpDisabled}
                  className={`col-span-4 py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.3em] transition-all active:scale-95 border ${
                      !isWarpDisabled 
                      ? 'bg-brand-600 hover:bg-brand-500 text-white border-white/5 shadow-xl shadow-brand-900/40' 
                      : 'bg-slate-950/40 text-slate-800 cursor-not-allowed border-transparent'
                  }`}
              >
                  {isMasking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  PATCH_UA
              </button>
              <button 
                  onClick={() => !isWarpDisabled && setShowUAModal(true)}
                  disabled={isWarpDisabled}
                  className={`col-span-1 rounded-2xl flex items-center justify-center transition-all active:scale-95 border ${
                      !isWarpDisabled 
                      ? 'bg-slate-900/60 border-white/5 text-slate-500 hover:text-white hover:border-brand-500/40 shadow-lg' 
                      : 'bg-slate-950/40 text-slate-800 cursor-not-allowed border-transparent'
                  }`}
              >
                  <Sliders className="w-4 h-4" />
              </button>
            </div>
        </div>
      </div>

      {/* IA Report Panel */}
      {securityReport && (
          <div className={`${theme.cardBase} rounded-[3rem] border border-white/5 overflow-hidden transition-all duration-1000 animate-in fade-in slide-in-from-bottom-8 group/recs shadow-2xl hover:border-brand-500/20`}>
             <button 
                onClick={() => setShowRecs(!showRecs)}
                className="w-full p-10 flex items-center justify-between hover:bg-white/[0.01] transition-all bg-black/20"
             >
                <div className="flex items-center gap-8">
                    <div className={`p-6 rounded-2xl bg-brand-500/5 border border-white/5 group-hover:scale-105 transition-all duration-500 shadow-xl`}>
                        <Brain className={`w-10 h-10 ${theme.primary} opacity-80`} />
                    </div>
                    <div className="text-left space-y-2">
                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter italic">Sentinel_AI_Sync</h4>
                        <div className="flex items-center gap-6">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                              <Activity className="w-3.5 h-3.5 text-brand-500/40" /> Active_Session_Audit
                            </span>
                            <div className="w-[1px] h-3 bg-slate-800"></div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${securityReport.score > 80 ? 'text-emerald-500/80' : 'text-amber-500/80'}`}>
                              MENACE: <span className="font-mono bg-black/40 px-3 py-1 rounded-lg border border-white/5 ml-2 italic">{securityReport.threatLevel.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-4 rounded-xl border border-white/5 transition-all duration-500 ${showRecs ? 'rotate-180 bg-brand-500 text-white shadow-xl' : 'text-slate-700'}`}>
                    <ChevronDown className="w-6 h-6" />
                </div>
             </button>

             {showRecs && (
                 <div className="px-10 pb-12 pt-2 animate-in slide-in-from-top-6 duration-700 space-y-10">
                    <div className="p-8 bg-slate-900/60 rounded-[2rem] border border-white/5 relative overflow-hidden backdrop-blur-3xl shadow-inner">
                        <div className="absolute inset-0 cyber-grid opacity-[0.03]"></div>
                        <p className="text-xl text-slate-300 leading-relaxed font-black italic relative z-10 pr-10 border-l-2 border-l-brand-500/40 pl-8 uppercase tracking-tight">
                            "{securityReport.analysis}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="p-6 rounded-[2rem] border border-white/5 bg-black/40 hover:border-brand-500/20 hover:-translate-y-1 transition-all duration-500 group/rec relative overflow-hidden shadow-lg">
                                <div className="absolute inset-0 bg-scanline opacity-0 group-hover/rec:opacity-[0.03] pointer-events-none transition-opacity"></div>
                                <div className="flex items-center gap-4 mb-5 relative z-10">
                                    <div className="w-10 h-10 rounded-xl bg-brand-500/5 flex items-center justify-center text-[11px] font-black text-brand-400 border border-brand-500/10 group-hover/rec:bg-brand-500 group-hover/rec:text-white transition-all shadow-inner">
                                        {i+1}
                                    </div>
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">Neural_Patch</span>
                                </div>
                                <p className="text-xs font-black text-slate-400 leading-relaxed relative z-10 group-hover:text-white transition-colors uppercase tracking-tight">
                                    {rec}
                                </p>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex justify-center border-t border-white/5 pt-8">
                        <button className="text-[9px] font-black text-slate-700 uppercase tracking-[0.5em] hover:text-brand-400 hover:underline underline-offset-8 transition-all flex items-center gap-3 group/audit-btn">
                            EXPORT_AUDIT_DATA_LOG
                            <ExternalLink className="w-3 h-3 group-hover/audit-btn:translate-x-1 transition-transform" />
                        </button>
                    </div>
                 </div>
             )}
          </div>
      )}
    </div>
  );
};
