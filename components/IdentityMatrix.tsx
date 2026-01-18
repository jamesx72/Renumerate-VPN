
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, CheckCircle2, Globe2,
  Cpu, Activity, Target, ShieldCheck, Orbit, Lock, ArrowRight,
  Shield, Zap, Radio
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
  const [entropy, setEntropy] = useState('0.00');

  const isOnion = mode === ConnectionMode.ONION_VORTEX;

  // Simulation d'entropie d'identité
  useEffect(() => {
    const interval = setInterval(() => {
      setEntropy((Math.random() * 0.5 + 9.5).toFixed(2));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Calcul du délai réseau
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

  const theme = {
    primary: isOnion ? 'text-purple-400' : 'text-cyan-400',
    secondary: isOnion ? 'text-indigo-400' : 'text-emerald-400',
    accent: isOnion ? 'text-fuchsia-500' : 'text-blue-500',
    border: isOnion ? 'border-purple-500/40' : 'border-cyan-500/40',
    bg: isOnion ? 'bg-purple-500/5' : 'bg-cyan-500/5',
    glow: isOnion ? 'shadow-[0_0_25px_rgba(168,85,247,0.15)]' : 'shadow-[0_0_25px_rgba(6,182,212,0.15)]',
    gradient: isOnion ? 'from-purple-600 via-fuchsia-500 to-indigo-500' : 'from-cyan-500 via-blue-500 to-emerald-500'
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Primary Identity HUD Card */}
        <div className={`glass-card p-8 rounded-[2rem] border-2 ${theme.border} ${theme.glow} relative overflow-hidden group transition-all duration-700 hover:scale-[1.01] ${theme.bg}`}>
          {/* HUD Corner Accents */}
          <div className={`absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 ${theme.border} opacity-40 rounded-tl-3xl transition-all group-hover:w-16 group-hover:h-16`}></div>
          <div className={`absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 ${theme.border} opacity-40 rounded-br-3xl transition-all group-hover:w-16 group-hover:h-16`}></div>
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-slate-900/80 border ${theme.border} ${theme.primary} shadow-lg shadow-black/50`}>
                {isOnion ? <Orbit className="w-6 h-6 animate-spin-slow" /> : <ShieldCheck className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] block mb-0.5">
                  {isOnion ? 'Vortex_Status' : 'Link_Verification'}
                </span>
                <span className={`${theme.primary} text-[9px] font-mono font-black uppercase tracking-widest block opacity-70`}>0x82_NODE_SECURED</span>
              </div>
            </div>
            <button 
              onClick={() => {navigator.clipboard.writeText(identity.ip); setCopiedIp(true); setTimeout(()=>setCopiedIp(false),2000)}} 
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-slate-400 hover:text-white border border-white/5"
            >
               {copiedIp ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="relative z-10">
            <div className={`font-mono text-4xl font-black tracking-[0.15em] bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent mb-4 transition-all duration-1000 ${isRotating ? 'animate-pulse skew-x-2' : ''}`}>
              {isRotating ? '???.???.???.???' : isOnion ? 'ENCRYPTED_PATH' : identity.ip}
            </div>
            
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full animate-ping ${isOnion ? 'bg-purple-500' : 'bg-cyan-500'}`}></span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.2em] max-w-[200px] truncate">
                      {isOnion ? 'Layer_Circuit: 0xF22...81' : 'AES-256-GCM_ACTIVE'}
                    </span>
                </div>
                <div className="text-[9px] font-mono text-slate-600 font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full border border-white/5">
                   SIG: {Math.random().toString(16).slice(2, 8).toUpperCase()}
                </div>
            </div>
          </div>
        </div>

        {/* Network Context Card */}
        <div className={`glass-card p-8 rounded-[2rem] border-2 ${theme.border} ${theme.glow} relative overflow-hidden group transition-all duration-700 hover:scale-[1.01] ${theme.bg}`}>
          <div className={`absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 ${theme.border} opacity-40 rounded-tr-3xl transition-all group-hover:w-16 group-hover:h-16`}></div>
          <div className={`absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 ${theme.border} opacity-40 rounded-bl-3xl transition-all group-hover:w-16 group-hover:h-16`}></div>
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-slate-900/80 border ${theme.border} ${theme.secondary} shadow-lg shadow-black/50`}>
                <Globe className="w-6 h-6 group-hover:rotate-[25deg] transition-transform duration-500" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Geospatial_Context</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-2xl text-slate-300 font-mono text-[11px] font-black border border-white/10 shadow-inner">
              <Clock className={`w-4 h-4 ${theme.primary} animate-pulse`} /> {localTime}
            </div>
          </div>
          
          <div className="relative z-10 flex justify-between items-end gap-6 h-full">
            <div className={`font-black tracking-tighter text-3xl text-slate-900 dark:text-white flex-1 mb-2 ${isRotating ? 'animate-pulse blur-sm' : ''}`}>
                {identity.city}
                <div className={`text-[11px] font-black uppercase tracking-[0.4em] mt-2 opacity-60 ${theme.secondary}`}>
                  {identity.country}
                </div>
            </div>

            <div className="flex flex-col gap-5 min-w-[140px] border-l border-white/10 pl-6 pb-2">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Local_Latency</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-sm text-slate-700 dark:text-slate-200">
                    <Activity className={`w-4 h-4 ${theme.primary}`} />
                    {isRotating ? '--' : `${identity.latency}ms`}
                  </div>
               </div>
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Entropie_ID</span>
                  <div className={`flex items-center gap-2 font-mono font-bold text-sm ${theme.secondary}`}>
                     <Radio className="w-4 h-4 animate-pulse" />
                     {isRotating ? '--' : entropy}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Matrice Panel */}
      <div className={`glass-card p-12 rounded-[3.5rem] border-2 transition-all duration-700 relative overflow-hidden group/panel ${isMasking ? 'border-indigo-500/80 shadow-[0_0_80px_rgba(99,102,241,0.2)]' : `border-slate-800 shadow-2xl hover:${theme.border}`}`}>
        {/* Background Aura Layers */}
        <div className={`absolute inset-0 opacity-[0.12] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isOnion ? 'from-purple-500 via-indigo-900 to-transparent' : 'from-cyan-500 via-blue-900 to-transparent'}`}></div>
        <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.05]"></div>
        {(isMasking || isOnion) && (
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] animate-pulse">
                <div className="grid grid-cols-12 h-full w-full">
                    {Array.from({length: 12}).map((_, i) => <div key={i} className="border-r border-white/5 h-full"></div>)}
                </div>
            </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-16 relative z-10">
          <div className="flex items-center gap-10">
            <div className={`p-10 rounded-[3rem] transition-all duration-700 shadow-3xl transform group-hover/panel:scale-110 group-hover/panel:rotate-[5deg] bg-slate-900 border-2 ${isMasking ? 'border-indigo-500 text-indigo-400 animate-pulse shadow-indigo-500/20' : isOnion ? 'border-purple-500 text-purple-400 shadow-purple-500/20' : 'border-cyan-500 text-cyan-400 shadow-cyan-500/20'}`}>
              <Fingerprint className="w-16 h-16" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-inner ${isOnion ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'}`}>
                  {isOnion ? 'CORE_ENGINE: VORTEX_OS' : 'CORE_ENGINE: MATRIX_V4'}
                </span>
                <Target className={`w-6 h-6 ${theme.primary} animate-pulse`} />
              </div>
              <h4 className="text-5xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">Matrice_Identité</h4>
              <p className="text-[12px] text-slate-500 font-black uppercase tracking-[0.5em] mt-1 opacity-70">Synthesized Machine Fingerprint</p>
            </div>
          </div>
          
          <button 
              onClick={onMask}
              disabled={isMaskingDisabled}
              className={`group relative flex items-center justify-center gap-6 px-20 py-8 rounded-[2.5rem] font-black text-base uppercase tracking-[0.4em] transition-all duration-500 overflow-hidden shadow-2xl ${isMasking ? 'bg-indigo-600 text-white cursor-wait' : isOnion ? 'bg-purple-700 hover:bg-purple-800 text-white' : 'bg-cyan-700 hover:bg-cyan-800 text-white disabled:opacity-30'}`}
          >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
              {isMasking ? <Loader2 className="w-7 h-7 animate-spin" /> : <Sparkles className="w-7 h-7" />}
              <span className="relative z-10">{isMasking ? 'SYNCHRONISING...' : "RE-NUMÉROTER"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* User-Agent Panel */}
          <div className={`p-10 rounded-[3rem] border-2 transition-all duration-500 group/ua relative overflow-hidden ${isMasking || isScramblingUA ? 'bg-slate-950 border-indigo-500/50 shadow-indigo-500/10' : 'bg-black/40 border-slate-800 hover:border-slate-600'}`}>
            <div className="flex items-center justify-between mb-8">
              <span className="text-[13px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-4 group-hover/ua:text-white transition-colors">
                <Chrome className={`w-7 h-7 ${theme.primary}`} /> Logiciel_Empreinte
              </span>
              <button 
                onClick={() => {setIsScramblingUA(true); setTimeout(()=>{onScrambleUA?.(); setIsScramblingUA(false)},800)}} 
                disabled={isMaskingDisabled} 
                className={`p-4 rounded-2xl bg-slate-900 border border-white/5 text-slate-500 hover:text-white transition-all shadow-xl active:scale-95`}
              >
                <RefreshCw className={`w-6 h-6 ${isScramblingUA ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className={`font-mono text-[12px] leading-relaxed h-28 overflow-hidden relative p-6 bg-slate-900/60 rounded-[2rem] border border-white/10 shadow-inner ${isMasking || isScramblingUA ? 'text-indigo-400 italic' : 'text-slate-300'}`}>
               {isMasking || isScramblingUA ? <div className="break-all tracking-widest">{scrambleText}</div> : currentUAData.full}
               <div className="absolute bottom-3 right-6 text-[10px] font-black text-slate-700 uppercase bg-black/80 px-4 py-1 rounded border border-white/5">UA_BITSTREAM_FLOW</div>
            </div>
          </div>

          {/* Hardware ID Panel */}
          <div className={`p-10 rounded-[3rem] border-2 transition-all duration-500 group/hw relative overflow-hidden ${isMasking ? 'bg-slate-950 border-indigo-500/50 shadow-indigo-500/10' : 'bg-black/40 border-slate-800 hover:border-slate-600'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-8">
              <span className="text-[13px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-4 group-hover/hw:text-white transition-colors">
                <Shield className={`w-7 h-7 ${theme.secondary}`} /> Matériel_Spoof (MAC)
              </span>
              
              <div className="flex bg-slate-900 p-2 rounded-2xl border border-white/5 shadow-2xl">
                {['standard', 'hyphen', 'cisco', 'random'].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => !isMaskingDisabled && onFormatChange?.(fmt as any)}
                    disabled={isMaskingDisabled}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${macFormat === fmt ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    {fmt === 'standard' ? 'XX:XX' : fmt === 'hyphen' ? 'XX-XX' : fmt === 'cisco' ? 'XXXX' : 'AUTO'}
                  </button>
                ))}
              </div>
            </div>

            <div className={`text-3xl font-mono font-black tracking-[0.3em] h-28 flex items-center justify-center p-6 bg-slate-900/60 rounded-[2rem] border border-white/10 shadow-inner relative group/mac ${isMasking ? 'text-indigo-400 animate-pulse' : 'text-white'}`}>
                {isRotating ? 'MASKED' : identity.mac}
                {!isMasking && (
                  <button 
                    onClick={onScrambleMac} 
                    disabled={isMaskingDisabled}
                    className="absolute right-8 opacity-0 group-hover/mac:opacity-100 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10"
                  >
                    <RefreshCw className="w-6 h-6 text-brand-500" />
                  </button>
                )}
            </div>
            <div className="flex items-center justify-between mt-4 px-2">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                Fabricant_OEM: <span className={`${theme.primary} font-mono`}>{getMacVendor(identity.mac)}</span>
              </p>
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-slate-900/80 ${theme.secondary}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${isOnion ? 'bg-purple-500 shadow-[0_0_8px_purple]' : 'bg-emerald-500 shadow-[0_0_8px_emerald]'} animate-pulse`}></div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live_Spoof_Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
