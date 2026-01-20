
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, CircleCheck, Globe2,
  Cpu, Activity, Target, ShieldCheck, Orbit, Lock, ArrowRight,
  Shield, Zap, Radio, BarChart3, Scan, Layers, Tv, Binary, ChevronRight,
  MapPin, Users, Thermometer, Cloud, Info, X, EyeOff, ShieldAlert, ToggleLeft, ToggleRight,
  Wind, Droplets, Map, ShieldHalf
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

// Données géographiques étendues pour l'immersion
const CITY_METADATA: Record<string, any> = {
  'Paris': { population: '2.1M', region: 'Île-de-France', weather: 'Nuageux', temp: '14°C', threat: 'Bas', humidity: '65%', wind: '12 km/h' },
  'Zürich': { population: '415k', region: 'Canton de Zurich', weather: 'Dégagé', temp: '11°C', threat: 'Minimal', humidity: '40%', wind: '5 km/h' },
  'Singapore': { population: '5.6M', region: 'Central Region', weather: 'Orageux', temp: '29°C', threat: 'Moyen', humidity: '85%', wind: '18 km/h' },
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
  const [isScramblingUA, setIsScramblingUA] = useState(false);
  const [isScramblingMac, setIsScramblingMac] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [entropy, setEntropy] = useState('0.00');
  const [signature, setSignature] = useState('0x' + Math.random().toString(16).slice(2, 10).toUpperCase());
  const [showCityModal, setShowCityModal] = useState(false);

  const isOnion = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  const currentUAData = useMemo(() => {
    return REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || REALISTIC_USER_AGENTS[0];
  }, [identity.userAgentShort]);

  const cityInfo = useMemo(() => {
    return CITY_METADATA[identity.city] || { population: 'N/A', region: 'N/A', weather: 'Stable', temp: 'N/A', humidity: 'N/A', wind: 'N/A', threat: 'Inconnu' };
  }, [identity.city]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEntropy((Math.random() * 0.4 + 9.6).toFixed(2));
      if (Math.random() > 0.85) setSignature('0x' + Math.random().toString(16).slice(2, 10).toUpperCase());
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMasking || isScramblingUA || isScramblingMac) {
      const chars = "10101010101010101010101010101010ABCDEF";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 100; i++) result += chars[Math.floor(Math.random() * chars.length)];
        setScrambleText(result);
      }, 30);
      return () => clearInterval(interval);
    }
  }, [isMasking, isScramblingUA, isScramblingMac]);

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
    secondary: isOnion ? 'text-indigo-400' : isSmartDNS ? 'text-orange-400' : 'text-emerald-400',
    border: isOnion ? 'border-purple-500/20' : isSmartDNS ? 'border-amber-500/20' : 'border-cyan-500/20',
    borderStrong: isOnion ? 'border-purple-500/60' : isSmartDNS ? 'border-amber-500/60' : 'border-cyan-500/60',
    glow: isOnion ? 'shadow-[0_0_40px_rgba(168,85,247,0.15)]' : isSmartDNS ? 'shadow-[0_0_40px_rgba(245,158,11,0.15)]' : 'shadow-[0_0_40px_rgba(6,182,212,0.15)]',
    accentBg: isOnion ? 'bg-purple-500/10' : isSmartDNS ? 'bg-amber-500/10' : 'bg-cyan-500/10'
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* City Information Modal */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-sm glass-card border-2 ${theme.borderStrong} rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden`}>
            {/* Cyber background deco */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
            
            <button 
              onClick={() => setShowCityModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors border border-white/5"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center relative z-10">
              <div className={`w-24 h-24 rounded-[2rem] ${theme.accentBg} flex items-center justify-center mb-6 border border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-500`}>
                <MapPin className={`w-12 h-12 ${theme.primary} drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]`} />
              </div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">{identity.city}</h3>
              <div className="flex items-center gap-2 mb-8">
                 <span className="text-xl">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{identity.country}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-3xl flex flex-col items-center group/item hover:bg-slate-900 transition-colors">
                  <Users className="w-4 h-4 text-slate-500 mb-2 group-hover/item:text-cyan-500 transition-colors" />
                  <span className="text-[9px] font-black text-slate-500 uppercase mb-1">Pop_Estim</span>
                  <span className="text-sm font-mono font-bold text-white">{cityInfo.population}</span>
                </div>
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-3xl flex flex-col items-center group/item hover:bg-slate-900 transition-colors">
                  <Map className="w-4 h-4 text-slate-500 mb-2 group-hover/item:text-cyan-500 transition-colors" />
                  <span className="text-[9px] font-black text-slate-500 uppercase mb-1">Reg_Zone</span>
                  <span className="text-xs font-bold text-white truncate w-full px-1">{cityInfo.region}</span>
                </div>
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-3xl flex flex-col items-center group/item hover:bg-slate-900 transition-colors">
                  <Cloud className="w-4 h-4 text-slate-500 mb-2 group-hover/item:text-cyan-500 transition-colors" />
                  <span className="text-[9px] font-black text-slate-500 uppercase mb-1">Local_Weather</span>
                  <span className="text-sm font-bold text-white">{cityInfo.weather}</span>
                </div>
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-3xl flex flex-col items-center group/item hover:bg-slate-900 transition-colors">
                  <Thermometer className="w-4 h-4 text-slate-500 mb-2 group-hover/item:text-cyan-500 transition-colors" />
                  <span className="text-[9px] font-black text-slate-500 uppercase mb-1">Thermal_Lvl</span>
                  <span className="text-sm font-mono font-bold text-white">{cityInfo.temp}</span>
                </div>
              </div>

              <div className="mt-6 p-4 w-full bg-black/40 rounded-2xl border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3 h-3 text-cyan-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">Humidité: <span className="text-slate-300 font-mono">{cityInfo.humidity}</span></span>
                </div>
                <div className="h-4 w-[1px] bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <Wind className="w-3 h-3 text-slate-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">Vent: <span className="text-slate-300 font-mono">{cityInfo.wind}</span></span>
                </div>
              </div>
              
              <div className="mt-8 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Geolocation_Data_Verified_Node</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Main IP Identity Card */}
        <div className={`glass-card p-8 rounded-[3rem] border ${theme.border} relative overflow-hidden group transition-all duration-500 hover:translate-y-[-4px] ${theme.glow} bracket-corner`}>
          {/* Subtle Scan Line */}
          <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-3">
                 <div className={`w-1.5 h-4 ${theme.primaryBg} rounded-full animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.5)]`}></div>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Current_Identity_IP</span>
              </div>
              <div className={`text-4xl font-mono font-black tracking-tighter flex items-baseline gap-2 ${isRotating ? 'animate-glitch text-brand-500' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? 'SYNCHRONIZING...' : identity.ip}
                {!isRotating && <span className={`text-xs font-black uppercase tracking-widest ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isConnected ? 'LIVE' : 'DOWN'}
                </span>}
              </div>
              <div className="mt-4 flex items-center gap-4 text-[10px] font-mono text-slate-400">
                 <span className="flex items-center gap-1.5"><Hash className="w-3 h-3" /> UID: {signature.slice(0, 8)}</span>
                 <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> Ent: {entropy}%</span>
              </div>
            </div>
            
            <button 
              onClick={handleCopyIp} 
              className={`p-4 rounded-2xl border border-white/5 bg-black/5 hover:bg-black/10 transition-all active:scale-95 group/copy ${copiedIp ? 'text-emerald-500 border-emerald-500/20' : 'text-slate-400'}`}
              title="Copier l'adresse IP"
            >
               {copiedIp ? <CircleCheck className="w-6 h-6 animate-in zoom-in duration-300" /> : <Copy className="w-6 h-6 group-hover/copy:scale-110 transition-transform" />}
            </button>
          </div>
        </div>

        {/* Security Shield Card */}
        {isConnected && (
          <div className={`glass-card p-8 rounded-[3rem] border ${theme.border} relative overflow-hidden group transition-all duration-500 hover:translate-y-[-4px] ${theme.glow} animate-in zoom-in-95 duration-500`}>
            <div className="flex items-center justify-between relative z-10 h-full">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-700 shadow-2xl relative overflow-hidden border-2 ${ipv6LeakProtection ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-emerald-500/10' : 'bg-red-500/10 border-red-500/30 text-red-500 shadow-red-500/10'}`}>
                   {ipv6LeakProtection ? (
                     <>
                        <ShieldCheck className="w-10 h-10 animate-in fade-in duration-700" />
                        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-emerald-400 shadow-[0_0_10px_emerald] animate-cyber-scan pointer-events-none"></div>
                     </>
                   ) : (
                     <ShieldAlert className="w-10 h-10 animate-pulse" />
                   )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural_Protection</span>
                    {ipv6LeakProtection && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_emerald]"></div>}
                  </div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">IPv6 Leak Shield</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${ipv6LeakProtection ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                        {ipv6LeakProtection ? 'Active_Tunnel_Secure' : 'Critical_Leak_Detected'}
                    </p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => onIpv6Toggle?.(!ipv6LeakProtection)}
                className={`p-2 rounded-2xl transition-all hover:scale-110 active:scale-95 relative ${ipv6LeakProtection ? 'text-emerald-500' : 'text-slate-400'}`}
              >
                {ipv6LeakProtection ? <ToggleRight className="w-12 h-12" /> : <ToggleLeft className="w-12 h-12" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Secondary Grid for Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Location Details */}
          <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} group transition-all relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] duration-500`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${theme.accentBg}`}>
                        <Globe className={`w-4 h-4 ${theme.primary}`} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Geo_Anchor</span>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-black font-mono text-slate-500">{identity.timezone}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl filter drop-shadow-md transition-transform group-hover:scale-110 duration-500">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{identity.country}</span>
                  </div>
                  
                  <button 
                    onClick={() => isConnected && setShowCityModal(true)}
                    className={`group/city flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 transition-all w-full mt-2 ${isConnected ? 'cursor-pointer hover:border-cyan-500/50 hover:bg-slate-100 dark:hover:bg-slate-900/50' : 'cursor-default'}`}
                    disabled={!isConnected}
                  >
                    <div className="flex items-center gap-2">
                        <span className={`text-xl font-mono font-black ${isConnected ? theme.primary : 'text-slate-500'}`}>
                        {identity.city}
                        </span>
                        {isConnected && <Info className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover/city:opacity-100 transition-opacity" />}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500">{localTime}</span>
                  </button>
              </div>
          </div>

          {/* MAC Spoofing Card */}
          <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} group transition-all hover:shadow-xl hover:translate-y-[-2px] duration-500 flex flex-col`}>
              <div className="flex items-center gap-3 mb-6">
                  <div className={`p-2 rounded-xl ${theme.accentBg}`}>
                    <Fingerprint className={`w-4 h-4 ${theme.primary}`} />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HW_Signature</span>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                  <div className="font-mono text-xl font-black text-slate-900 dark:text-white tracking-[0.2em] mb-4 text-center">
                      {isMasking || isScramblingMac ? scrambleText.slice(0, 17) : identity.mac}
                  </div>
              </div>
              <button 
                onClick={onScrambleMac}
                disabled={!isConnected || isMasking || isScramblingMac}
                className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all flex items-center justify-center gap-3 ${
                    isConnected ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent hover:scale-[1.02] shadow-xl' : 'border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isScramblingMac ? 'animate-spin' : ''}`} /> SPROOF_MAC_HW
              </button>
          </div>

          {/* Browser Profile Card */}
          <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} group transition-all hover:shadow-xl hover:translate-y-[-2px] duration-500 flex flex-col`}>
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${theme.accentBg}`}>
                        <Chrome className={`w-4 h-4 ${theme.primary}`} />
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SW_Profile</span>
                  </div>
                  <div className="px-2 py-0.5 bg-emerald-500/10 rounded text-[9px] font-black text-emerald-500 uppercase border border-emerald-500/20">v3.2_SEC</div>
              </div>
              
              <div className="flex-1 flex flex-col justify-center mb-4">
                  <div className="p-3 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                      <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200 line-clamp-2 italic leading-relaxed text-center">
                          {isMasking || isScramblingUA ? scrambleText.slice(0, 40) : currentUAData.full}
                      </div>
                  </div>
              </div>

              <button 
                onClick={onScrambleUA}
                disabled={!isConnected || isMasking || isScramblingUA}
                className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                    isConnected ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xl shadow-cyan-500/20 active:scale-95' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                }`}
              >
                <Zap className={`w-4 h-4 ${isScramblingUA ? 'animate-pulse' : ''}`} /> RANDOM_UA_PROFILE
              </button>
          </div>
      </div>

      {/* Global Scramble Trigger - Only visible when connected */}
      {isConnected && (
         <div className="flex justify-center mt-8">
            <button 
                onClick={onMask}
                disabled={isMasking}
                className="group relative flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 overflow-hidden"
            >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-shimmer opacity-20"></div>
                {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldHalf className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
                <span>FULL_IDENTITY_SCRAMBLE</span>
                <ChevronRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
            </button>
         </div>
      )}
    </div>
  );
};
