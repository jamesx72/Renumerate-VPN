
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, CheckCircle2, Globe2,
  Cpu, Activity, Target, ShieldCheck, Orbit, Lock, ArrowRight
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

  const isOnion = mode === ConnectionMode.ONION_VORTEX;

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
        "000502": "Apple", "000CF1": "Intel", "00163E": "Xen", "00000C": "Cisco",
        "005056": "VMware", "3C5AB4": "Samsung", "001422": "Dell", "001018": "Broadcom"
    };
    return vendors[clean.slice(0, 6)] || "Generic Hardware";
  };

  const isMaskingDisabled = !isConnected || isRotating || isMasking || mode === ConnectionMode.SMART_DNS;

  const macFormats = [
    { id: 'standard', label: 'XX:XX' },
    { id: 'hyphen', label: 'XX-XX' },
    { id: 'cisco', label: 'XXXX.XXXX' },
    { id: 'random', label: 'AUTO' },
  ] as const;

  // Configuration des thèmes IA
  const theme = {
    primary: isOnion ? 'text-purple-400' : 'text-cyan-400',
    secondary: isOnion ? 'text-indigo-400' : 'text-emerald-400',
    accent: isOnion ? 'text-fuchsia-500' : 'text-blue-500',
    border: isOnion ? 'border-purple-500/40' : 'border-cyan-500/40',
    bg: isOnion ? 'bg-purple-500/5' : 'bg-cyan-500/5',
    glow: isOnion ? 'shadow-purple-500/20' : 'shadow-cyan-500/20',
    gradient: isOnion ? 'from-purple-600 to-fuchsia-600' : 'from-cyan-500 to-blue-600'
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Primary Identity HUD Card */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} shadow-2xl relative overflow-hidden group transition-all duration-500 hover:${theme.glow} ${theme.bg}`}>
          {/* HUD Corner Accents */}
          <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${theme.border} opacity-60`}></div>
          <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 ${theme.border} opacity-60`}></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-black/40 border ${theme.border} ${theme.primary}`}>
                {isOnion ? <Orbit className="w-5 h-5 animate-spin-slow" /> : <Network className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] block">
                  {isOnion ? 'Vortex_Circuit_Active' : 'Identity_Link_Stable'}
                </span>
                <span className={`${theme.primary} text-[8px] font-black uppercase tracking-widest block`}>Secure_Gateway_V4.2</span>
              </div>
            </div>
            <button 
              onClick={() => {navigator.clipboard.writeText(identity.ip); setCopiedIp(true); setTimeout(()=>setCopiedIp(false),2000)}} 
              className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white"
            >
               {copiedIp ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          <div className={`relative z-10 font-mono text-3xl font-black tracking-widest bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent mb-3 ${isRotating ? 'animate-pulse' : ''}`}>
            {isRotating ? '***.***.***.***' : isOnion ? 'FRAGMENTED' : identity.ip}
          </div>
          
          <div className="relative z-10 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${isOnion ? 'bg-purple-500' : 'bg-cyan-500'}`}></span>
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-tighter">
              {isOnion ? 'Chiffrement Multi-Couche (Onion-Layer)' : 'Tunnel Chiffré AES-256-GCM'}
            </span>
          </div>
        </div>

        {/* Network Context Card */}
        <div className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} shadow-2xl relative overflow-hidden group transition-all duration-500 hover:${theme.glow} ${theme.bg}`}>
          <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 ${theme.border} opacity-60`}></div>
          <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 ${theme.border} opacity-60`}></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-black/40 border ${theme.border} ${theme.secondary}`}>
                <Globe className="w-5 h-5 group-hover:rotate-[30deg] transition-transform" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Context_Metadata</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 rounded-2xl text-slate-400 font-mono text-[10px] font-bold border border-white/5 shadow-inner">
              <Clock className={`w-3.5 h-3.5 ${theme.primary}`} /> {localTime}
            </div>
          </div>
          
          <div className="relative z-10 flex justify-between items-start gap-6">
            <div className={`font-black tracking-tight text-2xl text-slate-900 dark:text-white flex-1 ${isRotating ? 'animate-pulse' : ''}`}>
                {identity.city}, {identity.country}
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 opacity-50">
                  {isOnion ? 'Vortex_Node_Cluster_X' : 'Renumerate_Mainframe_B'}
                </div>
            </div>

            <div className="flex flex-col gap-4 min-w-[130px]">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ping_Local</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-xs text-slate-600 dark:text-slate-300">
                    <Activity className={`w-3.5 h-3.5 ${theme.primary}`} />
                    {isRotating ? '--' : `${identity.latency}ms`}
                  </div>
               </div>
               <div className="flex flex-col border-t border-white/5 pt-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Délai_Réseau</span>
                  <div className={`flex items-center gap-2 font-mono font-bold text-xs ${theme.secondary}`}>
                     <Cpu className="w-3.5 h-3.5 animate-pulse" />
                     {isRotating ? '--' : `${networkDelay}ms`}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Matrice Panel */}
      <div className={`glass-card p-10 rounded-[3.5rem] border transition-all duration-700 relative overflow-hidden group/panel ${isMasking ? 'border-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.25)]' : `border-white/10 dark:border-slate-800/50 shadow-2xl hover:${theme.border}`}`}>
        {/* Background Aura */}
        <div className={`absolute inset-0 opacity-[0.08] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isOnion ? 'from-purple-500 via-transparent to-transparent' : 'from-cyan-500 via-transparent to-transparent'}`}></div>
        {(isMasking || isOnion) && <div className="absolute inset-0 bg-scanline pointer-events-none opacity-20"></div>}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-14 relative z-10">
          <div className="flex items-center gap-8">
            <div className={`p-8 rounded-[3rem] transition-all duration-700 shadow-2xl transform group-hover/panel:scale-105 bg-slate-900 border ${isMasking ? 'border-indigo-500 text-indigo-500 animate-pulse' : isOnion ? 'border-purple-500 text-purple-400' : 'border-cyan-500 text-cyan-400'}`}>
              <Fingerprint className="w-14 h-14" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2.5 py-1 rounded-[10px] text-[10px] font-black uppercase tracking-widest ${isOnion ? 'bg-purple-600 text-white' : 'bg-cyan-600 text-white'}`}>
                  {isOnion ? 'Vortex_Core_OS' : 'Cyber_Matrix_v4'}
                </span>
                <Target className={`w-5 h-5 ${theme.primary}`} />
              </div>
              <h4 className="text-4xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">Matrice d'Identité</h4>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.4em]">Morphing Matériel & Logiciel IA-Driven</p>
            </div>
          </div>
          
          <button 
              onClick={onMask}
              disabled={isMaskingDisabled}
              className={`group relative flex items-center justify-center gap-5 px-16 py-7 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] transition-all duration-500 overflow-hidden ${isMasking ? 'bg-indigo-600 text-white cursor-wait' : isOnion ? 'bg-purple-700 hover:bg-purple-800 text-white' : 'bg-cyan-700 hover:bg-cyan-800 text-white shadow-xl disabled:opacity-40'}`}
          >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {isMasking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
              <span className="relative z-10">{isMasking ? 'SYNCHRONISATION...' : "RE-NUMÉROTER"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* User-Agent Panel */}
          <div className={`p-8 rounded-[3rem] border transition-all duration-500 group/ua ${isMasking || isScramblingUA ? 'bg-slate-950 border-indigo-500/50' : 'bg-black/20 dark:bg-slate-900/40 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center justify-between mb-8">
              <span className="text-[12px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-4 group-hover/ua:text-white transition-colors">
                <Chrome className={`w-6 h-6 ${theme.primary}`} /> Empreinte Logicielle
              </span>
              <button 
                onClick={() => {setIsScramblingUA(true); setTimeout(()=>{onScrambleUA?.(); setIsScramblingUA(false)},800)}} 
                disabled={isMaskingDisabled} 
                className={`p-4 rounded-2xl bg-black/40 text-slate-500 hover:text-white border border-white/5 transition-all shadow-sm active:scale-95`}
              >
                <RefreshCw className={`w-5 h-5 ${isScramblingUA ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className={`font-mono text-[11px] leading-relaxed h-20 overflow-hidden relative p-5 bg-black/40 rounded-[1.5rem] border border-white/5 shadow-inner ${isMasking || isScramblingUA ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`}>
               {isMasking || isScramblingUA ? <div className="break-all">{scrambleText}</div> : currentUAData.full}
               <div className="absolute bottom-2 right-4 text-[9px] font-bold text-slate-600 uppercase bg-black/60 px-2 rounded border border-white/5">IO_DATA_FLOW</div>
            </div>
          </div>

          {/* Hardware ID Panel */}
          <div className={`p-8 rounded-[3rem] border transition-all duration-500 group/hw ${isMasking ? 'bg-slate-950 border-indigo-500/50' : 'bg-black/20 dark:bg-slate-900/40 border-white/5 hover:border-white/10'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
              <span className="text-[12px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-4 group-hover/hw:text-white transition-colors">
                <ShieldCheck className={`w-6 h-6 ${theme.secondary}`} /> Profil Matériel (MAC)
              </span>
              
              <div className="flex bg-black/40 rounded-2xl p-1.5 border border-white/5">
                {macFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => !isMaskingDisabled && onFormatChange?.(fmt.id)}
                    disabled={isMaskingDisabled}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${macFormat === fmt.id ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`text-2xl font-mono font-black tracking-[0.4em] h-20 flex items-center justify-center p-5 bg-black/40 rounded-[1.5rem] border border-white/5 shadow-inner relative group/mac ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-white'}`}>
                {isRotating ? 'XX.XX.XX.XX' : identity.mac}
                {!isMasking && (
                  <button 
                    onClick={onScrambleMac} 
                    disabled={isMaskingDisabled}
                    className="absolute right-6 opacity-0 group-hover/mac:opacity-100 p-3 text-slate-500 hover:text-white transition-all"
                  >
                    <RefreshCw className="w-6 h-6" />
                  </button>
                )}
            </div>
            <div className="flex items-center justify-between mt-3 px-2">
              <p className="text-[11px] font-bold text-slate-500">Fabricant : <span className={theme.primary}>{getMacVendor(identity.mac)}</span></p>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-black/20 ${theme.secondary}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${isOnion ? 'bg-purple-500' : 'bg-emerald-500'}`}></div>
                <span className="text-[9px] font-black uppercase tracking-widest">Active_Spoof</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
