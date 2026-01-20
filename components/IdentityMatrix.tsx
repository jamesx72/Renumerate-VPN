
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Copy, Fingerprint, 
  Loader2, Chrome, RefreshCw, 
  Hash, Globe2,
  Cpu, Activity, ShieldCheck, Orbit, 
  Zap, ChevronRight,
  MapPin, Users, Cloud, X, ShieldAlert, ToggleLeft, ToggleRight,
  ShieldHalf, Laptop, Monitor, Smartphone, Binary, Eye, Lock, Shield,
  Scan, Target, ShieldQuestion, Radar
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
  'Paris': { population: '2.1M', region: 'Île-de-France', weather: 'Nuageux', temp: '14°C', threat: 'Bas' },
  'Zürich': { population: '415k', region: 'Canton de Zurich', weather: 'Dégagé', temp: '11°C', threat: 'Minimal' },
  'Singapore': { population: '5.6M', region: 'Central Region', weather: 'Orageux', temp: '29°C', threat: 'Moyen' },
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
      const chars = "10101010ABCDEF";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 40; i++) result += chars[Math.floor(Math.random() * chars.length)];
        setScrambleText(result);
      }, 50);
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
    glow: isOnion ? 'shadow-purple-500/10' : isSmartDNS ? 'shadow-amber-500/10' : 'shadow-cyan-500/10',
    accent: isOnion ? 'bg-purple-500/10' : isSmartDNS ? 'bg-amber-500/10' : 'bg-cyan-500/10',
    fill: isOnion ? 'fill-purple-500' : isSmartDNS ? 'fill-amber-500' : 'fill-cyan-500'
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
    return <Cpu className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Modal Ville - Design Cyber-Clean */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-sm glass-card border-2 ${theme.primaryBorder} rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden`}>
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
             <button onClick={() => setShowCityModal(false)} className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white transition-colors border border-white/5"><X className="w-5 h-5" /></button>
             <div className="flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-[1.5rem] ${theme.accent} flex items-center justify-center mb-6 border border-white/5 shadow-inner`}><MapPin className={`w-10 h-10 ${theme.primary}`} /></div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{identity.city}</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">{identity.country}</p>
              
              <div className="grid grid-cols-2 gap-3 w-full mt-8">
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-col items-center">
                    <Users className="w-4 h-4 text-slate-500 mb-2" />
                    <span className="text-[9px] font-black text-slate-500 uppercase block tracking-widest">Population</span>
                    <span className="text-sm font-mono font-bold text-white">{CITY_METADATA[identity.city]?.population || 'N/A'}</span>
                </div>
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-col items-center">
                    <Cloud className="w-4 h-4 text-slate-500 mb-2" />
                    <span className="text-[9px] font-black text-slate-500 uppercase block tracking-widest">Atmosphere</span>
                    <span className="text-sm font-bold text-white">{CITY_METADATA[identity.city]?.weather || 'Stable'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rangée Principale IP & Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Carte IP - Look "Terminal Dashboard" */}
        <div className={`glass-card p-8 rounded-[3rem] border ${theme.primaryBorder} relative overflow-hidden transition-all duration-500 ${theme.glow} bracket-corner group`}>
          <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Radar className="w-32 h-32 animate-spin-slow" />
          </div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-2 h-4 ${theme.primaryBg} rounded-sm animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]`}></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Identity_Uplink_Node</span>
            </div>
            
            <div className="flex-1 flex flex-col justify-center">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Virtual_Gateway_Address</span>
                <div className={`text-5xl font-mono font-black tracking-tighter flex items-center gap-4 transition-all ${isRotating ? 'animate-glitch text-red-500' : 'text-slate-900 dark:text-white'}`}>
                  {isRotating ? scrambleText.slice(0, 12) : identity.ip}
                  {!isRotating && (
                    <button 
                        onClick={handleCopyIp} 
                        className={`p-2.5 rounded-xl transition-all active:scale-90 ${copiedIp ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-white/5'}`}
                        title="Copier l'IP"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                  )}
                </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Entropy_Lvl</span>
                        <div className="flex items-center gap-2">
                          <Activity className={`w-3 h-3 ${theme.primary}`} />
                          <span className="text-xs font-mono font-black text-slate-900 dark:text-white">{entropy}%</span>
                        </div>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-800/50"></div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Sync_Delay</span>
                        <div className="flex items-center gap-2">
                          <Target className="w-3 h-3 text-emerald-500" />
                          <span className="text-xs font-mono font-black text-slate-900 dark:text-white">{identity.latency}ms</span>
                        </div>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${isOnion ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'}`}>
                    PROTO: {mode}
                </div>
            </div>
          </div>
        </div>

        {/* Carte IPv6 & Leak Protection - Design Alerte/Sécurité */}
        <div className={`glass-card p-8 rounded-[3rem] border-2 ${ipv6LeakProtection ? 'border-emerald-500/20' : 'border-red-500/40'} relative overflow-hidden transition-all duration-500 group`}>
            <div className={`absolute inset-0 opacity-[0.03] transition-colors ${ipv6LeakProtection ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
            
            <div className="flex flex-col h-full justify-between relative z-10">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                           {ipv6LeakProtection ? <ShieldCheck className="w-6 h-6 text-emerald-500" /> : <ShieldAlert className="w-6 h-6 text-red-500 animate-bounce" />}
                           IPv6 Sentinel Shield
                        </h4>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Protocol_Security_v4.1</p>
                    </div>
                    <div className={`p-4 rounded-2xl border transition-all shadow-lg ${ipv6LeakProtection ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                        {ipv6LeakProtection ? <Lock className="w-8 h-8" /> : <ShieldQuestion className="w-8 h-8 animate-pulse" />}
                    </div>
                </div>

                <div className="bg-slate-900/40 p-5 rounded-[2rem] border border-white/5 my-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${ipv6LeakProtection ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Real_Time_Audit</span>
                    </div>
                    <p className="text-xs font-medium text-slate-300 leading-relaxed font-mono">
                        {ipv6LeakProtection 
                            ? ">>> SHIELD_STATUS: ACTIVE. IPV6 TUNNELING ESTABLISHED. ZERO ISP LEAK DETECTED." 
                            : ">>> CRITICAL: IPV6 TRAFFIC IS EXPOSED. LOCALIZATION DE-ANONYMIZATION RISK DETECTED."}
                    </p>
                </div>

                <button 
                    onClick={() => onIpv6Toggle?.(!ipv6LeakProtection)}
                    className={`w-full py-5 rounded-[2rem] flex items-center justify-center gap-4 font-black text-xs uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl relative overflow-hidden group/btn ${
                        ipv6LeakProtection 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' 
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                    }`}
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                    {ipv6LeakProtection ? <ShieldCheck className="w-5 h-5" /> : <Zap className="w-5 h-5 animate-pulse" />}
                    <span>{ipv6LeakProtection ? 'PROTECTION_ARMÉE' : 'RÉARMER_SÉCURITÉ_VÉLOCE'}</span>
                </button>
            </div>
        </div>
      </div>

      {/* Grille Triple : Géo, HW et SW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Geo_Anchor */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.primaryBorder} group hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500 bracket-corner`}>
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-xl ${theme.accent}`}><Globe className={`w-4 h-4 ${theme.primary}`} /></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Geo_Anchor_v4</span>
            </div>
            
            <div className="flex items-center gap-5 mb-6 pl-2">
                <div className="relative">
                  <span className="text-5xl filter drop-shadow-2xl group-hover:scale-110 transition-transform block">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-lg"></div>
                </div>
                <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{identity.country}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">Réseau_Cluster_02</span>
                    </div>
                </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group/city ${
                    isConnected 
                    ? 'bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/5 hover:border-cyan-500 hover:shadow-lg' 
                    : 'bg-slate-50/50 dark:bg-slate-900/50 border-transparent grayscale'
                }`}
            >
                <div className="flex flex-col items-start">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Exit_Node</span>
                    <span className={`text-xl font-mono font-black tracking-tight ${isConnected ? theme.primary : 'text-slate-400'}`}>{identity.city}</span>
                </div>
                <div className="text-right">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Local_Time</span>
                    <span className="text-xs font-mono font-bold text-slate-400">{localTime}</span>
                </div>
            </button>
        </div>

        {/* HW_Signature - Spoofing MAC */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.primaryBorder} group hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500 flex flex-col bracket-corner`}>
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-xl ${theme.accent}`}><Fingerprint className={`w-4 h-4 ${theme.primary}`} /></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware_Spoof</span>
            </div>

            <div className="flex-1 flex flex-col justify-center bg-slate-900/40 rounded-2xl p-5 border border-white/5 mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-scanline opacity-5 pointer-events-none"></div>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3 text-center block">MAC_VIRTUALIZATION</span>
                <div className="font-mono text-xl font-black text-slate-900 dark:text-white tracking-[0.3em] text-center mb-4">
                    {isMasking ? (
                        <span className="text-cyan-500 animate-pulse">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden flex">
                    <div className={`h-full ${theme.primaryBg} animate-shimmer`} style={{ width: '100%' }}></div>
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={!isConnected || isMasking}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 group/scramble relative overflow-hidden ${
                    isConnected 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                }`}
            >
                <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover/scramble:opacity-100 transition-opacity"></div>
                {isMasking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 group-hover/scramble:rotate-180 transition-transform duration-700" />}
                RE_NUMÉROTER_HW
            </button>
        </div>

        {/* SW_Profile - Spoofing UA */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.primaryBorder} group hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500 flex flex-col bracket-corner`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${theme.accent}`}><Chrome className={`w-4 h-4 ${theme.primary}`} /></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Browser_Profile</span>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 rounded-full text-[8px] font-black text-emerald-500 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">AI_STEALTH</div>
            </div>

            <div className="flex-1 space-y-3 mb-6">
                <div className="p-5 bg-slate-900/40 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            {getOSIcon(currentUAData.os)}
                            OS_System
                        </span>
                        <span className="text-[10px] font-mono font-black text-white">{isMasking ? 'SYNCHING...' : currentUAData.os}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Globe2 className="w-4 h-4" />
                            Engine
                        </span>
                        <span className="text-[10px] font-mono font-black text-white">{isMasking ? 'SYNCHING...' : currentUAData.browser}</span>
                    </div>
                    <div className="pt-3 border-t border-white/10 flex flex-col gap-1.5">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">FINGERPRINT_STRING</span>
                        <div className="text-[9px] font-mono text-slate-400 leading-relaxed italic line-clamp-2 break-all opacity-80 group-hover:opacity-100 transition-opacity">
                            {isMasking ? scrambleText.slice(0, 60) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={onScrambleUA}
                disabled={!isConnected || isMasking}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl relative overflow-hidden group/ua ${
                    isConnected 
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                }`}
            >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/ua:opacity-100 transition-opacity"></div>
                {isMasking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4 group-hover/ua:scale-125 transition-transform" />}
                SPOOF_UA_FINGERPRINT
            </button>
        </div>
      </div>

      {/* Hero Button - Global Scramble - Design Centralisé & Immersif */}
      {isConnected && (
         <div className="flex justify-center mt-12 mb-4">
            <div className="relative">
              {/* Lueur d'arrière-plan pulsée */}
              <div className={`absolute inset-0 rounded-[4rem] blur-[60px] opacity-20 transition-all duration-1000 ${isOnion ? 'bg-purple-500' : 'bg-cyan-500'}`}></div>
              
              <button 
                  onClick={onMask}
                  disabled={isMasking}
                  className={`group relative flex items-center gap-8 px-16 py-7 rounded-[4rem] font-black text-sm uppercase tracking-[0.5em] transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl ${
                      isOnion 
                      ? 'bg-purple-600 text-white shadow-purple-600/30' 
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  } border-2 ${theme.primaryBorder} overflow-hidden`}
              >
                  {/* Effets visuels de fond */}
                  <div className="absolute inset-0 bg-scanline opacity-10 pointer-events-none"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                  
                  <div className="relative z-10 flex items-center gap-6">
                    <div className={`p-4 rounded-3xl ${isOnion ? 'bg-purple-500/20' : 'bg-cyan-500/10'} border border-white/10 group-hover:rotate-12 transition-transform duration-500`}>
                      {isMasking ? (
                          <Loader2 className="w-8 h-8 animate-spin" />
                      ) : (
                          <ShieldHalf className={`w-8 h-8 ${isOnion ? 'text-white' : 'text-cyan-500'}`} />
                      )}
                    </div>
                    
                    <div className="flex flex-col items-start text-left">
                        <span className="text-[10px] opacity-50 font-black tracking-widest mb-1">Total_Privacy_Engine</span>
                        <span className="relative">
                            {isMasking ? 'INITIALISING_SCRAMBLE...' : 'SCRAMBLE_GLOBAL_IDENTITY'}
                        </span>
                    </div>
                    
                    <div className="ml-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-500">
                        <ChevronRight className={`w-6 h-6 ${theme.primary}`} />
                    </div>
                  </div>
              </button>
            </div>
         </div>
      )}
    </div>
  );
};
