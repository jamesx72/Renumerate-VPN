
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, Wand2, CheckCircle2, Globe2, ShieldAlert,
  Cpu, Activity
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
        {/* IP Identity Card */}
        <div className="glass-card p-6 rounded-[2rem] border border-white/10 dark:border-slate-800/50 shadow-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-500">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500/50"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500/50"></div>
          
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/5 blur-3xl rounded-full group-hover:bg-cyan-500/10 transition-colors"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400">
                <Network className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Identité IP Actuelle</span>
            </div>
            <button 
              onClick={() => {navigator.clipboard.writeText(identity.ip); setCopiedIp(true); setTimeout(()=>setCopiedIp(false),2000)}} 
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 group-hover:text-cyan-500"
            >
               {copiedIp ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          <div className={`font-mono text-3xl font-black tracking-widest bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-400 bg-clip-text text-transparent ${isRotating ? 'animate-pulse' : ''}`}>
            {isRotating ? '***.***.***.***' : identity.ip}
          </div>
        </div>

        {/* Location Card */}
        <div className="glass-card p-6 rounded-[2rem] border border-white/10 dark:border-slate-800/50 shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-500/50"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-emerald-500/50"></div>
          
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full group-hover:bg-emerald-500/10 transition-colors"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Géolocalisation</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-700">
              <Clock className="w-3 h-3 text-emerald-500" /> {localTime}
            </div>
          </div>
          
          <div className={`font-black tracking-tight text-2xl mb-4 text-slate-900 dark:text-white ${isRotating ? 'animate-pulse' : ''}`}>
              {identity.city}, {identity.country}
          </div>
          
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Ping</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-slate-600 dark:text-slate-400">
                  <Activity className="w-3 h-3 text-cyan-500" />
                  {isRotating ? '--' : `${identity.latency}ms`}
                </div>
             </div>
             <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Délai Réseau</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-emerald-500">
                   <Cpu className="w-3 h-3 animate-pulse" />
                   {isRotating ? '--' : `${networkDelay}ms`}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Main Renumbering Panel */}
      <div className={`glass-card p-8 md:p-10 rounded-[3rem] border transition-all duration-700 relative overflow-hidden group/panel ${isMasking ? 'border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.2)]' : 'border-white/10 dark:border-slate-800/50 shadow-2xl'}`}>
        {/* Decorative Background for Cyber Look */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent"></div>
        {isMasking && <div className="absolute inset-0 bg-scanline pointer-events-none opacity-10"></div>}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`p-6 rounded-[2.2rem] transition-all duration-700 shadow-2xl transform group-hover/panel:rotate-3 ${isMasking ? 'bg-indigo-600 text-white rotate-12 scale-110 shadow-indigo-500/40 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700'}`}>
              <Fingerprint className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 text-[8px] font-black rounded uppercase tracking-widest border border-indigo-500/20">System-X</span>
                <h4 className="text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">Re-Numérotation</h4>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Anonymisation de l'empreinte logicielle</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3">
              <button 
                  onClick={onMask}
                  disabled={isMaskingDisabled}
                  className={`group relative flex items-center justify-center gap-4 px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 overflow-hidden ${isMasking ? 'bg-indigo-600 text-white cursor-wait shadow-2xl shadow-indigo-500/40' : 'bg-indigo-700 text-white hover:bg-indigo-800 hover:-translate-y-1 shadow-xl disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed disabled:grayscale'}`}
              >
                  {/* Shimmer Effect */}
                  {!isMaskingDisabled && <div className="absolute inset-0 bg-shimmer opacity-20 group-hover:opacity-30 pointer-events-none"></div>}
                  
                  {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5 group-hover:rotate-45 transition-transform" />}
                  <span className="relative z-10">{isMasking ? 'ANONYMISATION...' : "Masquer l'empreinte"}</span>
              </button>
              
              {isSmartDNS && (
                  <div className="flex items-center gap-2 text-amber-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
                      <ShieldAlert className="w-3 h-3" />
                      Indisponible en mode Smart DNS
                  </div>
              )}
              {!isConnected && !isRotating && (
                  <div className="text-slate-400 dark:text-slate-600 text-[9px] font-black uppercase tracking-widest">
                      Tunnel sécurisé requis pour l'action
                  </div>
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* User-Agent Section */}
          <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 group/ua ${isMasking || isScramblingUA ? 'bg-slate-950/80 border-indigo-500/30' : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}>
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 group-hover/ua:text-indigo-500 transition-colors">
                <Chrome className="w-4 h-4 text-blue-500" /> User-Agent Spoof
              </span>
              <button 
                onClick={() => {setIsScramblingUA(true); setTimeout(()=>{onScrambleUA?.(); setIsScramblingUA(false)},800)}} 
                disabled={isMaskingDisabled} 
                className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:border-indigo-500/30 border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-30"
              >
                <RefreshCw className={`w-4 h-4 ${isScramblingUA ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className={`font-mono text-[10px] leading-relaxed h-16 overflow-hidden relative p-4 bg-white/60 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner ${isMasking || isScramblingUA ? 'text-indigo-500 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>
               {isMasking || isScramblingUA ? <div className="text-indigo-500 break-all">{scrambleText}</div> : currentUAData.full}
               <div className="absolute bottom-1 right-2 text-[8px] font-bold text-slate-400 uppercase">UA-Data</div>
            </div>
          </div>

          {/* MAC Address Section */}
          <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 group/hw ${isMasking ? 'bg-slate-950/80 border-indigo-500/30' : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 group-hover/hw:text-emerald-500 transition-colors">
                <Fingerprint className="w-4 h-4 text-emerald-500" /> Hardware Mask
              </span>
              
              <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                {macFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => !isMaskingDisabled && onFormatChange?.(fmt.id)}
                    disabled={isMaskingDisabled}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${macFormat === fmt.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20'}`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`text-2xl font-mono font-black tracking-[0.2em] h-16 flex items-center justify-center p-4 bg-white/60 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner relative group/mac ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? 'XX.XX.XX.XX' : identity.mac}
                {!isMasking && (
                  <button 
                    onClick={onScrambleMac} 
                    disabled={isMaskingDisabled}
                    className="absolute right-4 opacity-0 group-hover/mac:opacity-100 p-2 text-slate-400 hover:text-emerald-500 transition-all disabled:hidden"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[10px] font-bold text-slate-500">Fabricant : <span className="text-emerald-500">{getMacVendor(identity.mac)}</span></p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Spoof</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
