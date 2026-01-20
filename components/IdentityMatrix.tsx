
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
  ChevronDown, ListChecks, ShieldHalf, Cpu as CpuIcon
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
      return () => clearInterval(interval);
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
    glow: isOnion ? 'shadow-[0_0_20px_rgba(168,85,247,0.15)]' : isSmartDNS ? 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
    accent: isOnion ? 'bg-purple-500/10' : isSmartDNS ? 'bg-amber-500/10' : 'bg-cyan-500/10',
    cardBase: 'glass-card dark:bg-slate-950/40 backdrop-blur-3xl'
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
    <div className="absolute inset-0 pointer-events-none z-20">
      <div className="absolute w-full h-0.5 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-cyber-scan"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Grid Supérieure : IP & Security Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Gateway Card IP */}
        <div className={`lg:col-span-7 ${theme.cardBase} p-8 rounded-[3.5rem] border ${theme.primaryBorder} relative overflow-hidden group ${theme.glow} bracket-corner`}>
          <CyberScanOverlay />
          <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-8 ${theme.primaryBg} rounded-full animate-pulse`}></div>
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Node_Uplink_Identity</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Protocol: Encrypted_Tunnel</span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-1.5 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] text-slate-400">
                AUTH_KEY: <span className="text-white">RNC-{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-4">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] ml-1 flex items-center gap-2">
                  <Target className={`w-3 h-3 ${theme.primary}`} /> Entry_Point_IP
                </span>
                <div className="flex items-center gap-8">
                  <div className={`text-6xl md:text-7xl font-mono font-black tracking-tighter transition-all duration-300 ${isRotating ? 'animate-glitch text-red-500' : 'text-slate-900 dark:text-white'}`}>
                    {isRotating ? scrambleText.slice(0, 12) : identity.ip}
                  </div>
                  {!isRotating && (
                    <button 
                        onClick={handleCopyIp}
                        className={`p-5 rounded-[1.8rem] transition-all active:scale-90 border shadow-2xl group/copy ${copiedIp ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-black/20 border-white/5 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-black/40'}`}
                    >
                        {copiedIp ? <ShieldCheck className="w-7 h-7" /> : <Copy className="w-7 h-7 group-hover/copy:rotate-6 transition-transform" />}
                    </button>
                  )}
                </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 grid grid-cols-3 gap-8">
                <div className="space-y-1">
                   <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Entropy_Index</span>
                   <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-4 ${theme.primaryBg} rounded-sm`}></div>
                      <span className="text-lg font-mono font-black text-slate-800 dark:text-cyan-400">{entropy}%</span>
                   </div>
                </div>
                <div className="space-y-1">
                   <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Latency_Sync</span>
                   <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                      <span className="text-lg font-mono font-black text-slate-800 dark:text-emerald-400">{identity.latency}ms</span>
                   </div>
                </div>
                <div className="space-y-1">
                   <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Cipher_Tech</span>
                   <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-purple-500" />
                      <span className="text-lg font-mono font-black text-slate-800 dark:text-purple-400">CHACHA20</span>
                   </div>
                </div>
            </div>
          </div>
        </div>

        {/* Leak Protection Sentinel */}
        <div className={`lg:col-span-5 ${theme.cardBase} p-8 rounded-[3.5rem] border-2 ${ipv6LeakProtection ? 'border-emerald-500/20' : 'border-red-500/30'} relative overflow-hidden group bracket-corner`}>
            <CyberScanOverlay />
            {isMasking && <div className="absolute inset-0 bg-brand-500/5 animate-pulse z-20"></div>}
            <div className="absolute -bottom-10 -right-10 p-4 opacity-5 group-hover:opacity-20 transition-all duration-1000 group-hover:scale-110">
                <Shield className="w-56 h-56" />
            </div>

            <div className="relative z-10 h-full flex flex-col">
                <div className="flex justify-between items-start mb-8">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-black text-white uppercase tracking-tighter">Sentinel_v4</h4>
                          <span className="px-2 py-0.5 bg-brand-500 text-[8px] font-black rounded text-black">BETA</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Leak_Prevention_Sys</p>
                    </div>
                    <div className={`p-4 rounded-[1.5rem] border-2 transition-all duration-500 ${ipv6LeakProtection ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-red-500/30 text-red-500 bg-red-500/10 animate-flicker'}`}>
                        {ipv6LeakProtection ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                    </div>
                </div>

                <div className="flex-1 bg-black/40 p-6 rounded-[2rem] border border-white/5 mb-8 relative overflow-hidden">
                    <div className="absolute inset-0 cyber-grid opacity-10"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-3">
                          <div className={`w-2 h-2 rounded-full ${ipv6LeakProtection ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network_Integrity</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-300 leading-relaxed italic">
                          {ipv6LeakProtection 
                              ? ">> STATUS: NOMINAL. IPV6 TUNNEL ACTIVE. NO LEAK VECTORS DETECTED IN ACTIVE STACK." 
                              : ">> CRITICAL: IPV6 LEAK DETECTED. REAL GEOLOCATION PARTIALLY EXPOSED. ROTATE IDENTITY IMMEDIATELY."}
                      </p>
                    </div>
                </div>

                <button 
                    onClick={() => onIpv6Toggle?.(!ipv6LeakProtection)}
                    className={`w-full py-6 rounded-[2.2rem] flex items-center justify-center gap-4 font-black text-[11px] uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl relative overflow-hidden group/btn ${
                        ipv6LeakProtection 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40' 
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'
                    }`}
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                    {ipv6LeakProtection ? <Lock className="w-4 h-4" /> : <Zap className="w-4 h-4 animate-pulse" />}
                    {ipv6LeakProtection ? 'DISABLE_GUARD' : 'FORCE_RE-ENGAGE'}
                </button>
            </div>
        </div>
      </div>

      {/* Grid Triple Identity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Geo Cluster Matrix */}
        <div className={`${theme.cardBase} p-8 rounded-[3.5rem] border ${theme.primaryBorder} group hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:translate-y-[-8px] transition-all duration-700 relative overflow-hidden bracket-corner`}>
            <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] group-hover:opacity-10 group-hover:scale-125 transition-all duration-1000">
                <Globe className="w-40 h-40" />
            </div>
            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className={`p-3 rounded-2xl ${theme.accent} border border-white/5`}><MapPin className={`w-5 h-5 ${theme.primary}`} /></div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Geo_Anchor_Node</span>
            </div>
            
            <div className="flex items-center gap-8 mb-10 relative z-10">
                <div className="relative">
                  <div className="absolute inset-[-15px] border border-white/5 rounded-full animate-spin-slow group-hover:border-cyan-500/20"></div>
                  <span className="text-7xl filter drop-shadow-2xl group-hover:scale-110 transition-transform duration-700 block">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-900 shadow-xl shadow-emerald-500/20"></div>
                </div>
                <div>
                    <span className="text-3xl font-black text-white uppercase tracking-tighter block">{identity.country}</span>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20 shadow-inner">ZONE_SEC_ALPHA</span>
                    </div>
                </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-6 rounded-[2.5rem] border transition-all flex items-center justify-between group/city relative overflow-hidden ${
                    isConnected 
                    ? 'bg-black/60 border-white/5 hover:border-brand-500/40 hover:bg-black/80' 
                    : 'bg-black/20 border-transparent grayscale opacity-50'
                }`}
            >
                <div className="relative z-10">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Active_Exit_Node</span>
                    <span className={`text-2xl font-mono font-black tracking-tight ${isConnected ? theme.primary : 'text-slate-600'}`}>{identity.city}</span>
                </div>
                <div className="text-right relative z-10">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Clock_Sync</span>
                    <span className="text-sm font-mono font-bold text-slate-400 group-hover/city:text-white transition-colors">{localTime}</span>
                </div>
            </button>
        </div>

        {/* Hardware Scrambler Matrix */}
        <div className={`${theme.cardBase} p-8 rounded-[3.5rem] border ${theme.primaryBorder} group hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:translate-y-[-8px] transition-all duration-700 flex flex-col relative overflow-hidden bracket-corner`}>
            <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 transition-all duration-1000">
                <Fingerprint className="w-40 h-40" />
            </div>
            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className={`p-3 rounded-2xl ${theme.accent} border border-white/5`}><Binary className={`w-5 h-5 ${theme.primary}`} /></div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Hardware_Mask</span>
            </div>

            <div className="flex-1 flex flex-col justify-center bg-black/60 rounded-[2.5rem] p-8 border border-white/5 mb-8 relative overflow-hidden group/mac">
                <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none"></div>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] mb-4 text-center block">VIRTUAL_MAC_SIGNATURE</span>
                <div className="font-mono text-2xl font-black text-white tracking-[0.2em] text-center mb-8 break-all leading-tight">
                    {isMasking ? (
                        <span className="text-cyan-500 animate-pulse">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="flex justify-center gap-2">
                   {[...Array(8)].map((_, i) => (
                      <div key={i} className={`w-4 h-1 rounded-full ${isMasking ? 'bg-cyan-500 animate-bounce' : 'bg-slate-800'}`} style={{ animationDelay: `${i * 0.08}s` }}></div>
                   ))}
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={!isConnected || isMasking}
                className={`w-full py-6 rounded-[2.5rem] flex items-center justify-center gap-4 font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl relative overflow-hidden ${
                    isConnected 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-white/10' 
                    : 'bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-50 border border-transparent'
                }`}
            >
                {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-1000" />}
                MORPH_MAC_ADDRESS
            </button>
        </div>

        {/* UserAgent Stealth Card */}
        <div className={`${theme.cardBase} p-8 rounded-[3.5rem] border ${theme.primaryBorder} group hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:translate-y-[-8px] transition-all duration-700 flex flex-col relative overflow-hidden bracket-corner`}>
            <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] group-hover:opacity-10 transition-all duration-1000">
                <Laptop className="w-40 h-40" />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${theme.accent} border border-white/5`}><Chrome className={`w-5 h-5 ${theme.primary}`} /></div>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">OS_Fingerprint</span>
                </div>
                <div className="px-4 py-1 bg-emerald-500/10 rounded-full text-[9px] font-black text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">STEALTH_IA</div>
            </div>

            <div className="flex-1 space-y-6 mb-8 relative z-10">
                <div className="p-6 bg-black/60 rounded-[2.5rem] border border-white/5 space-y-6 shadow-inner">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                            {getOSIcon(currentUAData.os)}
                            OS_SYSTEM
                        </span>
                        <span className="text-[11px] font-mono font-black text-white">{isMasking ? 'SYNCHING...' : currentUAData.os}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                            <Globe2 className="w-4 h-4" />
                            CLIENT_TYPE
                        </span>
                        <span className="text-[11px] font-mono font-black text-white">{isMasking ? 'SYNCHING...' : currentUAData.browser}</span>
                    </div>
                    <div className="pt-5 border-t border-white/10">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-3 block">UA_HASH_FINGERPRINT</span>
                        <div className="text-[10px] font-mono text-slate-500 leading-relaxed italic line-clamp-2 break-all group-hover:text-slate-300 transition-colors bg-black/20 p-3 rounded-xl border border-white/5">
                            {isMasking ? scrambleText.repeat(3).slice(0, 100) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={onScrambleUA}
                disabled={!isConnected || isMasking}
                className={`w-full py-6 rounded-[2.5rem] flex items-center justify-center gap-4 font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl relative overflow-hidden ${
                    isConnected 
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/40 border border-cyan-400/20' 
                    : 'bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-50 border border-transparent'
                }`}
            >
                {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5 group-hover:scale-125 transition-transform" />}
                RE-INITIALIZE_HASH
            </button>
        </div>
      </div>

      {/* IA Sentinel Security Recommendations Section */}
      {securityReport && (
          <div className={`${theme.cardBase} rounded-[4rem] border ${theme.primaryBorder} overflow-hidden transition-all duration-1000 animate-in fade-in slide-in-from-bottom-8 shadow-2xl group/recs bracket-corner`}>
             <CyberScanOverlay />
             <button 
                onClick={() => setShowRecs(!showRecs)}
                className="w-full p-10 flex items-center justify-between hover:bg-white/[0.02] transition-colors group/btn"
             >
                <div className="flex items-center gap-8">
                    <div className={`p-5 rounded-[2rem] bg-brand-500/10 border border-brand-500/30 group-hover/btn:scale-110 group-hover/btn:rotate-6 transition-all duration-500`}>
                        <Brain className={`w-10 h-10 ${theme.primary}`} />
                    </div>
                    <div className="text-left space-y-1">
                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Analyse Sentinel IA Neural</h4>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <Activity className="w-3 h-3 text-cyan-500" /> IA_REPORT_SYNCED
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                            <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${securityReport.score > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                              <ShieldCheck className="w-3 h-3" /> PROTECTION_OPTIMISÉE
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-4 rounded-2xl border border-white/10 transition-all duration-500 flex items-center gap-3 ${showRecs ? 'rotate-180 bg-brand-500/10 border-brand-500/30 text-brand-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">View_Details</span>
                    <ChevronDown className="w-7 h-7" />
                </div>
             </button>

             {showRecs && (
                 <div className="px-10 pb-10 pt-2 animate-in slide-in-from-top-4 duration-700 space-y-10">
                    <div className="p-8 bg-black/60 rounded-[3rem] border border-white/5 relative overflow-hidden group/audit">
                        <div className="absolute inset-0 cyber-grid opacity-[0.05]"></div>
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/audit:opacity-20 transition-opacity">
                            <ShieldHalf className="w-32 h-32" />
                        </div>
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className="p-2 bg-brand-500/20 rounded-lg"><Activity className="w-4 h-4 text-brand-500" /></div>
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Audit_Critique_Expert</span>
                        </div>
                        <p className="text-base text-slate-300 leading-relaxed font-medium italic relative z-10">
                            "{securityReport.analysis}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="p-6 bg-slate-900/80 rounded-[2.5rem] border border-white/5 hover:border-brand-500/40 hover:translate-y-[-4px] transition-all duration-500 group/rec relative overflow-hidden shadow-xl">
                                <div className="absolute -right-6 -top-6 p-6 opacity-[0.02] group-hover/rec:opacity-10 group-hover/rec:rotate-12 transition-all duration-1000">
                                    <ListChecks className="w-24 h-24" />
                                </div>
                                <div className="flex items-center gap-4 mb-5 relative z-10">
                                    <div className="w-10 h-10 rounded-2xl bg-brand-500/10 flex items-center justify-center text-xs font-black text-brand-500 border border-brand-500/20 shadow-inner group-hover/rec:scale-110 transition-transform">
                                        0{i+1}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Protocol_Patch</span>
                                </div>
                                <p className="text-sm font-bold text-slate-200 leading-relaxed relative z-10">
                                    {rec}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-6 py-6 border-t border-white/5 bg-black/20 rounded-b-[4rem]">
                        <div className="flex items-center gap-3">
                             <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">IA_SENTINEL_ACTIVE_MONITORING_READY</span>
                        </div>
                        <button className="text-[9px] font-black text-brand-500 uppercase tracking-widest hover:underline underline-offset-4">Full_Log_Export_v2.5</button>
                    </div>
                 </div>
             )}
          </div>
      )}

      {/* Global Scramble Hero Action */}
      {isConnected && (
         <div className="flex justify-center mt-12 pb-12">
            <div className="relative group">
              {/* Ultra Glow Effect */}
              <div className={`absolute inset-0 rounded-[5rem] blur-[80px] opacity-30 transition-all duration-1000 group-hover:opacity-60 ${isOnion ? 'bg-purple-600' : 'bg-brand-500'}`}></div>
              
              <button 
                  onClick={onMask}
                  disabled={isMasking}
                  className={`group relative flex items-center gap-10 px-20 py-10 rounded-[5rem] font-black text-base uppercase tracking-[0.6em] transition-all duration-700 hover:scale-105 active:scale-95 shadow-[0_40px_80px_rgba(0,0,0,0.6)] border-2 ${theme.primaryBorder} overflow-hidden ${
                      isOnion 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  }`}
              >
                  <div className="absolute inset-0 bg-scanline opacity-10 pointer-events-none animate-scanline"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                  
                  <div className="relative z-10 flex items-center gap-10">
                    <div className={`p-6 rounded-[2rem] ${isOnion ? 'bg-white/10' : 'bg-brand-500/10'} border border-white/20 group-hover:rotate-[360deg] transition-transform duration-[2000ms] shadow-inner`}>
                      {isMasking ? (
                          <Loader2 className="w-12 h-12 animate-spin text-white" />
                      ) : (
                          <Orbit className={`w-12 h-12 ${isOnion ? 'text-white' : 'text-cyan-500'} animate-spin-slow`} />
                      )}
                    </div>
                    
                    <div className="flex flex-col items-start text-left">
                        <span className="text-[11px] opacity-50 font-black tracking-[0.4em] mb-1.5">Deep_Scramble_Protocol</span>
                        <span className="relative text-2xl tracking-[0.3em] font-black">
                            {isMasking ? 'SYNCHRONIZING...' : 'GLOBAL_RE-NUMBERING'}
                        </span>
                    </div>
                    
                    <div className="ml-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-6 transition-all duration-700">
                        <ChevronRight className={`w-10 h-10 ${isOnion ? 'text-white' : 'text-cyan-500'}`} />
                    </div>
                  </div>
              </button>
            </div>
         </div>
      )}

      {/* Geo Detail Modal */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-500" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-sm ${theme.cardBase} border-2 ${theme.primaryBorder} rounded-[4rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-500 overflow-hidden`}>
             <CyberScanOverlay />
             <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
             <button onClick={() => setShowCityModal(false)} className="absolute top-10 right-10 p-4 rounded-2xl bg-slate-800/50 text-slate-400 hover:text-white transition-all border border-white/5 hover:rotate-90"><X className="w-7 h-7" /></button>
             
             <div className="flex flex-col items-center text-center">
              <div className={`w-28 h-28 rounded-[2.5rem] ${theme.accent} flex items-center justify-center mb-10 border border-white/5 shadow-2xl group/modal-icon`}><Globe className={`w-14 h-14 ${theme.primary} animate-spin-slow group-hover/modal-icon:scale-110 transition-transform`} /></div>
              <h3 className="text-4xl font-black text-white uppercase tracking-tighter">{identity.city}</h3>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">{identity.country}</p>
              
              <div className="grid grid-cols-1 gap-5 w-full mt-12">
                <div className="p-6 bg-black/60 border border-white/5 rounded-[2rem] flex items-center justify-between group/meta hover:border-cyan-500/30 transition-all shadow-inner">
                    <div className="flex items-center gap-4">
                        <Users className="w-6 h-6 text-slate-600 group-hover/meta:text-cyan-500 transition-colors" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Density</span>
                    </div>
                    <span className="text-base font-mono font-black text-white">{CITY_METADATA[identity.city]?.population || 'N/A'}</span>
                </div>
                <div className="p-6 bg-black/60 border border-white/5 rounded-[2rem] flex items-center justify-between group/meta hover:border-purple-500/30 transition-all shadow-inner">
                    <div className="flex items-center gap-4">
                        <Cloud className="w-6 h-6 text-slate-600 group-hover/meta:text-purple-500 transition-colors" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Atmo_State</span>
                    </div>
                    <span className="text-base font-black text-white">{CITY_METADATA[identity.city]?.weather || 'Stable'}</span>
                </div>
                <div className="p-6 bg-black/60 border border-white/5 rounded-[2rem] flex items-center justify-between group/meta hover:border-red-500/30 transition-all shadow-inner">
                    <div className="flex items-center gap-4">
                        <ShieldAlert className="w-6 h-6 text-slate-600 group-hover/meta:text-red-500 transition-colors" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Zone_Risk</span>
                    </div>
                    <span className="text-base font-black text-white uppercase">{CITY_METADATA[identity.city]?.risk || 'Minimal'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
