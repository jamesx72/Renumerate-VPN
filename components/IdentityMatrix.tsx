
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
  ShieldHalf, Laptop, Monitor, Smartphone, Binary, Eye, Lock, Shield
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
  const [isScramblingUA, setIsScramblingUA] = useState(false);
  const [isScramblingMac, setIsScramblingMac] = useState(false);
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
    if (isMasking || isScramblingUA || isScramblingMac) {
      const chars = "10101010ABCDEF";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 40; i++) result += chars[Math.floor(Math.random() * chars.length)];
        setScrambleText(result);
      }, 50);
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
    primaryBorder: isOnion ? 'border-purple-500/30' : isSmartDNS ? 'border-amber-500/30' : 'border-cyan-500/30',
    glow: isOnion ? 'shadow-purple-500/10' : isSmartDNS ? 'shadow-amber-500/10' : 'shadow-cyan-500/10',
    accent: isOnion ? 'bg-purple-500/10' : isSmartDNS ? 'bg-amber-500/10' : 'bg-cyan-500/10'
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
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowCityModal(false)} />
          <div className={`relative w-full max-w-sm glass-card border-2 ${theme.primaryBorder} rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300`}>
             <button onClick={() => setShowCityModal(false)} className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
             <div className="flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-[1.5rem] ${theme.accent} flex items-center justify-center mb-6 border border-white/5`}><MapPin className={`w-10 h-10 ${theme.primary}`} /></div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{identity.city}</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">{identity.country}</p>
              
              <div className="grid grid-cols-2 gap-3 w-full mt-8">
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
                    <Users className="w-4 h-4 text-slate-500 mx-auto mb-2" />
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Population</span>
                    <span className="text-sm font-mono font-bold text-white">{CITY_METADATA[identity.city]?.population || 'N/A'}</span>
                </div>
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
                    <Cloud className="w-4 h-4 text-slate-500 mx-auto mb-2" />
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Climat</span>
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
        <div className={`glass-card p-8 rounded-[3rem] border ${theme.primaryBorder} relative overflow-hidden transition-all duration-500 ${theme.glow} bracket-corner`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Binary className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'} animate-pulse`}></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tunnel_Status_Uplink</span>
            </div>
            
            <div className="flex-1 flex flex-col justify-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Public_Gateway_IP</span>
                <div className={`text-5xl font-mono font-black tracking-tighter flex items-center gap-3 transition-all ${isRotating ? 'animate-glitch text-red-500' : 'text-slate-900 dark:text-white'}`}>
                  {isRotating ? 'RECONNECTING' : identity.ip}
                  {!isRotating && (
                    <button 
                        onClick={handleCopyIp} 
                        className={`p-2 rounded-lg transition-all ${copiedIp ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        title="Copier l'IP"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                  )}
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Entropy</span>
                        <span className="text-xs font-mono font-black text-slate-900 dark:text-white">{entropy}%</span>
                    </div>
                    <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800"></div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Latency</span>
                        <span className="text-xs font-mono font-black text-slate-900 dark:text-white">{identity.latency}ms</span>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isOnion ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' : 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20'}`}>
                    {mode}
                </div>
            </div>
          </div>
        </div>

        {/* Carte IPv6 & Leak Protection */}
        <div className={`glass-card p-8 rounded-[3rem] border ${theme.primaryBorder} relative overflow-hidden transition-all duration-500 ${theme.glow}`}>
            <div className="flex flex-col h-full justify-between">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                           <Shield className={`w-5 h-5 ${ipv6LeakProtection ? 'text-emerald-500' : 'text-red-500'}`} />
                           Protection de Fuite IPv6
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Algorithme Sentinel v3.2_SEC</p>
                    </div>
                    <div className={`p-3 rounded-2xl border transition-all ${ipv6LeakProtection ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                        {ipv6LeakProtection ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8 animate-pulse" />}
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 my-4">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                        {ipv6LeakProtection 
                            ? "Le trafic IPv6 est tunnelisé avec succès vers l'adresse virtuelle. Aucune fuite ISP détectée." 
                            : "Attention : Le trafic IPv6 risque d'exposer votre localisation réelle. Réactivation recommandée."}
                    </p>
                </div>

                <button 
                    onClick={() => onIpv6Toggle?.(!ipv6LeakProtection)}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${
                        ipv6LeakProtection 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                    }`}
                >
                    {ipv6LeakProtection ? <Lock className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    {ipv6LeakProtection ? 'BOUTON_ARMÉ_SÉCURISÉ' : 'DANGER_RÉARMER_SENTINEL'}
                </button>
            </div>
        </div>
      </div>

      {/* Grille Triple : Géo, HW et SW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Geo_Anchor */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.primaryBorder} group hover:shadow-xl transition-all duration-500`}>
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-xl ${theme.accent}`}><Globe className={`w-4 h-4 ${theme.primary}`} /></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Geo_Anchor_v4</span>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl filter drop-shadow-md">{COUNTRIES_WITH_FLAGS[identity.country] || '📍'}</span>
                <div>
                    <span className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{identity.country}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Zone_Europe_SCT</span>
                    </div>
                </div>
            </div>

            <button 
                onClick={() => isConnected && setShowCityModal(true)}
                disabled={!isConnected}
                className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group/city ${
                    isConnected 
                    ? 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/5 hover:border-cyan-500' 
                    : 'bg-slate-50/50 dark:bg-slate-900/50 border-transparent grayscale'
                }`}
            >
                <div className="flex flex-col items-start">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Node_Exit_City</span>
                    <span className={`text-lg font-mono font-black ${isConnected ? theme.primary : 'text-slate-400'}`}>{identity.city}</span>
                </div>
                <div className="text-right">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Local_Time</span>
                    <span className="text-xs font-mono font-bold text-slate-400">{localTime}</span>
                </div>
            </button>
        </div>

        {/* HW_Signature - Spoofing MAC */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.primaryBorder} group hover:shadow-xl transition-all duration-500 flex flex-col`}>
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-xl ${theme.accent}`}><Fingerprint className={`w-4 h-4 ${theme.primary}`} /></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware_Signature</span>
            </div>

            <div className="flex-1 flex flex-col justify-center bg-slate-50 dark:bg-black/30 rounded-2xl p-4 border border-slate-200 dark:border-white/5 mb-6">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">MAC_ADDRESS_VIRTUALIZED</span>
                <div className="font-mono text-xl font-black text-slate-900 dark:text-white tracking-[0.2em] text-center">
                    {isMasking || isScramblingMac ? (
                        <span className="text-cyan-500 animate-pulse">{scrambleText.slice(0, 17)}</span>
                    ) : identity.mac}
                </div>
                <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${theme.primaryBg} transition-all duration-500`} style={{ width: '100%' }}></div>
                </div>
            </div>

            <button 
                onClick={onScrambleMac}
                disabled={!isConnected || isMasking || isScramblingMac}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${
                    isConnected 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                }`}
            >
                {isScramblingMac ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                RE_NUMÉROTER_HW_MAC
            </button>
        </div>

        {/* SW_Profile - Spoofing UA */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.primaryBorder} group hover:shadow-xl transition-all duration-500 flex flex-col`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${theme.accent}`}><Chrome className={`w-4 h-4 ${theme.primary}`} /></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Software_Profile</span>
                </div>
                <div className="px-2 py-0.5 bg-emerald-500/10 rounded text-[8px] font-black text-emerald-500 border border-emerald-500/20">V3.2_IA_OPTIM</div>
            </div>

            <div className="flex-1 space-y-3 mb-6">
                <div className="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between text-[10px]">
                        <span className="font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            {getOSIcon(currentUAData.os)}
                            Plateforme
                        </span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">{isMasking || isScramblingUA ? '...' : currentUAData.os}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                        <span className="font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Globe2 className="w-3.5 h-3.5" />
                            Navigateur
                        </span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">{isMasking || isScramblingUA ? '...' : currentUAData.browser}</span>
                    </div>
                    <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Header_Fingerprint</span>
                        <div className="text-[9px] font-mono text-slate-400 leading-tight italic line-clamp-2">
                            {isMasking || isScramblingUA ? scrambleText.slice(0, 60) : currentUAData.full}
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={onScrambleUA}
                disabled={!isConnected || isMasking || isScramblingUA}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${
                    isConnected 
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xl shadow-cyan-500/20' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                }`}
            >
                {isScramblingUA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                SPOOF_UA_FINGERPRINT
            </button>
        </div>
      </div>

      {/* Hero Button - Global Scramble */}
      {isConnected && (
         <div className="flex justify-center mt-10">
            <button 
                onClick={onMask}
                disabled={isMasking}
                className={`group relative flex items-center gap-6 px-12 py-6 rounded-[3rem] font-black text-sm uppercase tracking-[0.4em] transition-all hover:scale-105 active:scale-95 shadow-2xl ${
                    isOnion 
                    ? 'bg-purple-600 shadow-purple-600/30' 
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                } overflow-hidden`}
            >
                {/* Effet de scan permanent */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                
                {isMasking ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                    <ShieldHalf className={`w-6 h-6 ${isOnion ? 'text-white' : 'text-cyan-500'} group-hover:rotate-12 transition-transform`} />
                )}
                
                <span className="relative z-10">
                    {isMasking ? 'RE-NUMÉROTAGE_EN_COURS...' : 'SCRAMBLE_GLOBAL_IDENTITY'}
                </span>
                
                <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
            </button>
         </div>
      )}
    </div>
  );
};
