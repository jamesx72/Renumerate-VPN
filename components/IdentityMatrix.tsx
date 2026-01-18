
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, Wand2, CheckCircle2, Globe2, ShieldAlert,
  Cpu, Activity, Target, ShieldCheck
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
  const [scrambleText, setScrambleText] = useState('');

  // Calcul du délai réseau (latence + variation aléatoire)
  const networkDelay = useMemo(() => {
    return identity.latency + Math.floor(Math.random() * 8) + 3;
  }, [identity.latency, isRotating]);

  useEffect(() => {
    if (isMasking || isScramblingUA) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 60; i++) result += chars[Math.floor(Math.random() * chars.length)];
        setScrambleText(result);
      }, 40);
      return () => clearInterval(interval);
    }
  }, [isMasking, isScramblingUA]);

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
        "000502": "Apple", 
        "000CF1": "Intel", 
        "00163E": "Xen", 
        "00000C": "Cisco",
        "005056": "VMware",
        "3C5AB4": "Samsung",
        "001422": "Dell",
        "001018": "Broadcom",
        "00155D": "Microsoft",
        "080027": "Oracle/VBox"
    };
    return vendors[clean.slice(0, 6)] || "Generic Hardware";
  };

  const isSmartDNS = mode === ConnectionMode.SMART_DNS;
  const isMaskingDisabled = !isConnected || isRotating || isMasking || isSmartDNS;

  const macFormats = [
    { id: 'standard', label: 'XX:XX', icon: Hash },
    { id: 'hyphen', label: 'XX-XX', icon: Hash },
    { id: 'cisco', label: 'XXXX.XXXX', icon: Globe2 },
    { id: 'random', label: 'AUTO', icon: Sparkles },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* IP Identity HUD Card */}
        <div className="glass-card p-6 rounded-[2rem] border border-white/10 dark:border-slate-800/50 shadow-2xl relative overflow-hidden group hover:border-cyan-500/40 hover:shadow-cyan-500/10 transition-all duration-500">
          {/* HUD Corner Accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/30"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/30"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-500 group-hover:animate-pulse">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] block">Status: Online</span>
                <span className="text-cyan-500 text-[8px] font-black uppercase tracking-widest block">Virtual_Gate_V2</span>
              </div>
            </div>
            <button 
              onClick={() => {navigator.clipboard.writeText(identity.ip); setCopiedIp(true); setTimeout(()=>setCopiedIp(false),2000)}} 
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 group-hover:text-cyan-500"
            >
               {copiedIp ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          <div className={`font-mono text-3xl font-black tracking-widest bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-400 bg-clip-text text-transparent mb-2 ${isRotating ? 'animate-pulse' : ''}`}>
            {isRotating ? '***.***.***.***' : identity.ip}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[9px] font-mono font-bold text-slate-400">Tunnel Chiffré AES-256</span>
          </div>
        </div>

        {/* Location & Network Metrics HUD Card */}
        <div className="glass-card p-6 rounded-[2rem] border border-white/10 dark:border-slate-800/50 shadow-2xl relative overflow-hidden group hover:border-emerald-500/40 hover:shadow-emerald-500/10 transition-all duration-500">
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500/30"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500/30"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500">
                <Globe className="w-5 h-5 group-hover:rotate-[30deg] transition-transform" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Géolocalisation</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-700 shadow-inner">
              <Clock className="w-3 h-3 text-emerald-500" /> {localTime}
            </div>
          </div>
          
          <div className="flex justify-between items-start gap-4">
            <div className={`font-black tracking-tight text-2xl text-slate-900 dark:text-white flex-1 ${isRotating ? 'animate-pulse' : ''}`}>
                {identity.city}, {identity.country}
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">Identity_Cluster_Alpha</div>
            </div>

            {/* Network Metrics - Ping & Délai Réseau Stacked */}
            <div className="flex flex-col gap-3 min-w-[120px]">
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Ping actuel</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-slate-600 dark:text-slate-300">
                    <Activity className="w-3 h-3 text-cyan-500" />
                    {isRotating ? '--' : `${identity.latency}ms`}
                  </div>
               </div>
               <div className="flex flex-col border-t border-slate-100 dark:border-slate-800 pt-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Délai Réseau</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-emerald-500">
                     <Cpu className="w-3 h-3 animate-pulse" />
                     {isRotating ? '--' : `${networkDelay}ms`}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main AI Renumbering Panel */}
      <div className={`glass-card p-8 md:p-10 rounded-[3rem] border transition-all duration-700 relative overflow-hidden group/panel ${isMasking ? 'border-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.25)]' : 'border-white/10 dark:border-slate-800/50 shadow-2xl'}`}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent"></div>
        {isMasking && <div className="absolute inset-0 bg-scanline pointer-events-none opacity-20"></div>}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`p-6 rounded-[2.5rem] transition-all duration-700 shadow-2xl transform group-hover/panel:scale-105 ${isMasking ? 'bg-indigo-600 text-white shadow-indigo-500/40 animate-pulse' : 'bg-slate-900 text-indigo-500 border border-indigo-500/20'}`}>
              <Fingerprint className="w-12 h-12" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-black rounded uppercase tracking-widest">Renumber_IA v4.2</span>
                <Target className="w-4 h-4 text-indigo-500" />
              </div>
              <h4 className="text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">Matrice d'Identité</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">Morphing matériel & logiciel actif</p>
            </div>
          </div>
          
          <button 
              onClick={onMask}
              disabled={isMaskingDisabled}
              className={`group relative flex items-center justify-center gap-4 px-14 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all duration-500 overflow-hidden ${isMasking ? 'bg-indigo-600 text-white cursor-wait shadow-2xl shadow-indigo-500/40' : 'bg-indigo-700 text-white hover:bg-indigo-800 hover:scale-105 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed'}`}
          >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:animate-bounce" />}
              <span className="relative z-10">{isMasking ? 'SYNCHRONISATION...' : "Masquer l'empreinte"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* User-Agent Panel */}
          <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 group/ua ${isMasking || isScramblingUA ? 'bg-slate-950/90 border-indigo-500/50' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500/30'}`}>
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-3 group-hover/ua:text-blue-500 transition-colors">
                <Chrome className="w-5 h-5 text-blue-500" /> User-Agent Spoofing
              </span>
              <button 
                onClick={() => {setIsScramblingUA(true); setTimeout(()=>{onScrambleUA?.(); setIsScramblingUA(false)},800)}} 
                disabled={isMaskingDisabled} 
                className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isScramblingUA ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className={`font-mono text-[10px] leading-relaxed h-16 overflow-hidden relative p-4 bg-white/50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner ${isMasking || isScramblingUA ? 'text-indigo-500 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>
               {isMasking || isScramblingUA ? <div className="text-indigo-500 break-all">{scrambleText}</div> : currentUAData.full}
               <div className="absolute bottom-1 right-2 text-[8px] font-bold text-slate-400 uppercase bg-white dark:bg-slate-900 px-1">DATA_STREAM</div>
            </div>
          </div>

          {/* Hardware ID Panel */}
          <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 group/hw ${isMasking ? 'bg-slate-950/90 border-indigo-500/50' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/30'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-3 group-hover/hw:text-emerald-500 transition-colors">
                <ShieldCheck className="w-5 h-5 text-emerald-500" /> Hardware_ID Masking
              </span>
              
              <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1 shadow-inner">
                {macFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => !isMaskingDisabled && onFormatChange?.(fmt.id)}
                    disabled={isMaskingDisabled}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${macFormat === fmt.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 disabled:opacity-20'}`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`text-2xl font-mono font-black tracking-[0.3em] h-16 flex items-center justify-center p-4 bg-white/50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner relative group/mac ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? 'XX.XX.XX.XX' : identity.mac}
                {!isMasking && (
                  <button 
                    onClick={onScrambleMac} 
                    disabled={isMaskingDisabled}
                    className="absolute right-4 opacity-0 group-hover/mac:opacity-100 p-2 text-slate-400 hover:text-emerald-500 transition-all"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                )}
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[10px] font-bold text-slate-500">Fabricant Spoofé : <span className="text-indigo-500">{getMacVendor(identity.mac)}</span></p>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Spoof_Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
