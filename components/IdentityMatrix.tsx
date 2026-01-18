
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
  Wind, Droplets, Map
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
      const chars = "10101010101010101010101010101010";
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
    secondary: isOnion ? 'text-indigo-400' : isSmartDNS ? 'text-orange-400' : 'text-emerald-400',
    border: isOnion ? 'border-purple-500/20' : isSmartDNS ? 'border-amber-500/20' : 'border-cyan-500/20',
    borderStrong: isOnion ? 'border-purple-500/60' : isSmartDNS ? 'border-amber-500/60' : 'border-cyan-500/60',
    bg: isOnion ? 'bg-purple-950/30' : isSmartDNS ? 'bg-amber-950/30' : 'bg-slate-900/30',
    glow: isOnion ? 'shadow-[0_0_40px_rgba(168,85,247,0.1)]' : isSmartDNS ? 'shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'shadow-[0_0_40px_rgba(6,182,212,0.1)]',
    gradient: isOnion ? 'from-purple-600 to-indigo-500' : isSmartDNS ? 'from-amber-600 to-orange-500' : 'from-cyan-600 to-emerald-500',
    accent: isOnion ? 'bg-purple-500' : isSmartDNS ? 'bg-amber-500' : 'bg-cyan-500',
    accentBg: isOnion ? 'bg-purple-500/10' : isSmartDNS ? 'bg-amber-500/10' : 'bg-cyan-500/10'
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* City Information Modal */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-sm glass-card border-2 ${theme.border} rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300`}>
            <button 
              onClick={() => setShowCityModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-full ${theme.accentBg} flex items-center justify-center mb-6 border border-white/5`}>
                <MapPin className={`w-10 h-10 ${theme.primary}`} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{identity.city}</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">{identity.country} {COUNTRIES_WITH_FLAGS[identity.country]}</p>
              
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center">
                  <Users className="w-4 h-4 text-slate-500 mb-2" />
                  <span className="text-[10px] font-black text-slate-500 uppercase mb-1">Population</span>
                  <span className="text-sm font-mono font-bold text-white">{cityInfo.population}</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center">
                  <Map className="w-4 h-4 text-slate-500 mb-2" />
                  <span className="text-[10px] font-black text-slate-500 uppercase mb-1">Région</span>
                  <span className="text-sm font-bold text-white truncate w-full px-1">{cityInfo.region}</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center">
                  <Cloud className="w-4 h-4 text-slate-500 mb-2" />
                  <span className="text-[10px] font-black text-slate-500 uppercase mb-1">Météo</span>
                  <span className="text-sm font-bold text-white">{cityInfo.weather}</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center">
                  <Thermometer className="w-4 h-4 text-slate-500 mb-2" />
                  <span className="text-[10px] font-black text-slate-500 uppercase mb-1">Temp.</span>
                  <span className="text-sm font-mono font-bold text-white">{cityInfo.temp}</span>
                </div>
              </div>

              <div className="mt-6 p-4 w-full bg-slate-900/50 rounded-2xl border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Droplets className="w-3 h-3 text-cyan-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">Humidité: <span className="text-slate-300">{cityInfo.humidity}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="w-3 h-3 text-slate-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">Vent: <span className="text-slate-300">{cityInfo.wind}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card IP */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} relative overflow-hidden group transition-all duration-500 hover:translate-y-[-2px] ${theme.glow}`}>
          <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${theme.borderStrong} rounded-tl-[2.5rem] opacity-30`}></div>
          <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 ${theme.borderStrong} rounded-br-[2.5rem] opacity-30`}></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <div className={`w-1 h-3 ${theme.accent} rounded-full`}></div>
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Identity_Node_IP</span>
              </div>
              <div className={`text-3xl font-mono font-black tracking-tight ${isRotating ? 'animate-glitch text-brand-500' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? 'SYNCHRONIZING...' : identity.ip}
              </div>
            </div>
            <button 
              onClick={() => {navigator.clipboard.writeText(identity.ip); setCopiedIp(true); setTimeout(()=>setCopiedIp(false),2000)}} 
              className={`p-3 rounded-2xl border border-white/5 bg-black/10 hover:bg-black/20 transition-all ${copiedIp ? 'text-emerald-500' : 'text-slate-400'}`}
            >
               {copiedIp ? <CircleCheck className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Card Advanced: IPv6 Leak Protection */}
        {isConnected && (
          <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} relative overflow-hidden group transition-all duration-500 hover:translate-y-[-2px] ${theme.glow} animate-in zoom-in-95 duration-500`}>
            <div className="flex items-center justify-between relative z-10 h-full">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${ipv6LeakProtection ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'} transition-colors duration-500 shadow-lg`}>
                  {ipv6LeakProtection ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Security_Layer</span>
                    {ipv6LeakProtection && <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>}
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">IPv6 Leak Shield</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{ipv6LeakProtection ? 'Protection Active' : 'Vulnérabilité IPv6'}</p>
                </div>
              </div>
              
              <button 
                onClick={() => onIpv6Toggle?.(!ipv6LeakProtection)}
                className={`p-2 rounded-2xl transition-all hover:scale-110 active:scale-95 ${ipv6LeakProtection ? 'text-emerald-500' : 'text-slate-400'}`}
              >
                {ipv6LeakProtection ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
              </button>
            </div>
            {ipv6LeakProtection && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-emerald-400/30 animate-cyber-scan pointer-events-none"></div>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Location Card */}
          <div className={`glass-card p-5 rounded-3xl border ${theme.border} group transition-all relative overflow-hidden`}>
              <div className="flex items-center gap-3 mb-4">
                  <Globe className={`w-4 h-4 ${theme.primary}`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network_Geolocation</span>
              </div>
              <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{identity.country}</span>
                  </div>
                  <button 
                    onClick={() => isConnected && setShowCityModal(true)}
                    className={`flex items-center gap-2 group/city transition-all w-fit ${isConnected ? 'cursor-pointer hover:translate-x-1' : 'cursor-default'}`}
                    disabled={!isConnected}
                  >
                    <span className={`text-xl font-mono font-black ${isConnected ? theme.primary + ' underline decoration-dotted underline-offset-4 decoration-white/20' : 'text-slate-500'}`}>
                      {identity.city}
                    </span>
                    {isConnected && <Info className="w-3 h-3 text-slate-500 opacity-0 group-hover/city:opacity-100 transition-opacity" />}
                  </button>
              </div>
              <div className="mt-4 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] font-mono font-bold text-slate-400">{identity.timezone} • {localTime}</span>
              </div>
          </div>

          {/* MAC Address */}
          <div className={`glass-card p-5 rounded-3xl border ${theme.border} group transition-all`}>
              <div className="flex items-center gap-3 mb-4">
                  <Fingerprint className={`w-4 h-4 ${theme.primary}`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware_Signature</span>
              </div>
              <div className="font-mono text-lg font-black text-slate-900 dark:text-white tracking-widest mb-4">
                  {isMasking || isScramblingMac ? scrambleText.slice(0, 17) : identity.mac}
              </div>
              <button 
                onClick={onScrambleMac}
                disabled={!isConnected || isMasking || isScramblingMac}
                className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                    isConnected ? 'border-brand-500/20 text-brand-500 hover:bg-brand-500/10' : 'border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isScramblingMac ? 'animate-spin' : ''}`} /> SPROOF_MAC
              </button>
          </div>

          {/* User Agent */}
          <div className={`glass-card p-5 rounded-3xl border ${theme.border} group transition-all`}>
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <Chrome className={`w-4 h-4 ${theme.primary}`} />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Software_Profile</span>
                  </div>
                  <div className="px-2 py-0.5 bg-brand-500/10 rounded text-[8px] font-black text-brand-500 uppercase">Spoof_v3</div>
              </div>
              <div className="font-medium text-[10px] text-slate-700 dark:text-slate-300 mb-4 line-clamp-2 italic h-8">
                  {isMasking || isScramblingUA ? scrambleText.slice(0, 40) : currentUAData.full}
              </div>
              <button 
                onClick={onScrambleUA}
                disabled={!isConnected || isMasking || isScramblingUA}
                className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                    isConnected ? 'border-brand-500/20 text-brand-500 hover:bg-brand-500/10' : 'border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Zap className={`w-3 h-3 ${isScramblingUA ? 'animate-pulse' : ''}`} /> RANDOMIZE_UA
              </button>
          </div>
      </div>
    </div>
  );
};
