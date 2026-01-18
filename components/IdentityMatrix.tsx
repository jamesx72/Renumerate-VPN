
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, CircleCheck, Globe2,
  Cpu, Activity, Target, ShieldCheck, Orbit, Lock, ArrowRight,
  Shield, Zap, Radio, BarChart3, Scan, Layers, Tv, Binary, ChevronRight,
  MapPin, Users, Thermometer, Cloud, Info, X, EyeOff
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
}

// Données géographiques étendues pour l'immersion
const CITY_METADATA: Record<string, any> = {
  'Paris': { population: '2.1M', region: 'Île-de-France', weather: 'Nuageux', temp: '14°C', threat: 'Bas' },
  'Zürich': { population: '415k', region: 'Canton de Zurich', weather: 'Dégagé', temp: '11°C', threat: 'Minimal' },
  'Singapore': { population: '5.6M', region: 'Central Region', weather: 'Orageux', temp: '29°C', threat: 'Moyen' },
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
  onFormatChange
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

  const networkDelay = useMemo(() => {
    return identity.latency + Math.floor(Math.random() * 12) + 4;
  }, [identity.latency, identity.ip]);

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
      const offset = parseInt(identity.timezone.replace('UTC', '')) || 0;
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const cityTime = new Date(utc + (3600000 * offset));
      setLocalTime(cityTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [identity.timezone]);

  const currentUAData = REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || REALISTIC_USER_AGENTS[0];

  const getMacVendor = (mac: string) => {
    const clean = mac.replace(/[:.-]/g, '').toUpperCase();
    const vendors: Record<string, string> = { 
        "000502": "Apple", "000CF1": "Intel", "00163E": "Xen", "00000C": "Cisco",
        "005056": "VMware", "3C5AB4": "Samsung", "001422": "Dell", "001018": "Broadcom",
        "FCECDA": "Ubiquiti", "D404FF": "Netgear", "00155D": "Microsoft"
    };
    return vendors[clean.slice(0, 6)] || "Generic Hardware";
  };

  const isMaskingDisabled = !isConnected || isRotating || isMasking;

  const theme = {
    primary: isOnion ? 'text-purple-400' : isSmartDNS ? 'text-amber-400' : 'text-cyan-400',
    secondary: isOnion ? 'text-indigo-400' : isSmartDNS ? 'text-orange-400' : 'text-emerald-400',
    border: isOnion ? 'border-purple-500/20' : isSmartDNS ? 'border-amber-500/20' : 'border-cyan-500/20',
    borderStrong: isOnion ? 'border-purple-500/60' : isSmartDNS ? 'border-amber-500/60' : 'border-cyan-500/60',
    bg: isOnion ? 'bg-purple-950/30' : isSmartDNS ? 'bg-amber-950/30' : 'bg-slate-900/30',
    glow: isOnion ? 'shadow-[0_0_40px_rgba(168,85,247,0.1)]' : isSmartDNS ? 'shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'shadow-[0_0_40px_rgba(6,182,212,0.1)]',
    gradient: isOnion ? 'from-purple-600 to-indigo-500' : isSmartDNS ? 'from-amber-600 to-orange-500' : 'from-cyan-600 to-emerald-500',
    accent: isOnion ? 'bg-purple-500' : isSmartDNS ? 'bg-amber-500' : 'bg-cyan-500'
  };

  const currentCityData = CITY_METADATA[identity.city] || { population: 'N/A', region: 'N/A', weather: 'Stable', temp: 'N/A', threat: 'Inconnu' };

  const handleScrambleUAPress = () => {
    setIsScramblingUA(true);
    setTimeout(() => {
      onScrambleUA?.();
      setIsScramblingUA(false);
    }, 1200);
  };

  const handleScrambleMacPress = () => {
    if (isMaskingDisabled) return;
    setIsScramblingMac(true);
    setTimeout(() => {
      onScrambleMac?.();
      setIsScramblingMac(false);
    }, 800);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
};
