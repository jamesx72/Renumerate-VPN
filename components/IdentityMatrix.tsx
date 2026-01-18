
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, Wand2, CheckCircle2, Globe2, ShieldAlert,
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

  const isOnion = mode === ConnectionMode.ONION_VORTEX;
  const isMaskingDisabled = !isConnected || isRotating || isMasking || mode === ConnectionMode.SMART_DNS;

  const macFormats = [
    { id: 'standard', label: 'XX:XX' },
    { id: 'hyphen', label: 'XX-XX' },
    { id: 'cisco', label: 'XXXX.XXXX' },
    { id: 'random', label: 'AUTO' },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Primary Identity HUD Card */}
        <div className={`glass-card p-6 rounded-[2.5rem] border shadow-2xl relative overflow-hidden group transition-all duration-500 ${isOnion ? 'border-purple-500/40 hover:shadow-purple-500/10' : 'border-white/10 dark:border-slate-800/50 hover:border-cyan-500/40'}`}>
          <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${isOnion ? 'border-purple-500/40' : 'border-cyan-500/30'}`}></div>
          <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${isOnion ? 'border-purple-500/40' : 'border-cyan-500/30'}`}></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isOnion ? 'bg-purple-500/10 text-purple-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
                {isOnion ? <Orbit className="w-5 h-5 animate-spin-slow" /> : <Network className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] block">{isOnion ? 'Vortex Circuit ID' : 'Status: Connecté'}</span>
                <span className={`${isOnion ? 'text-purple-500' : 'text-cyan-500'} text-[8px] font-black uppercase tracking-widest block`}>Secure_Gateway_V3</span>
              </div>
            </div>
            <button 
              onClick={() => {navigator.clipboard.writeText(identity.ip); setCopiedIp(true); setTimeout(()=>setCopiedIp(false),2000)}} 
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
            >
               {copiedIp ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          <div className={`font-mono text-3xl font-black tracking-widest bg-gradient-to-r ${isOnion ? 'from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400' : 'from-slate-900 to-slate-700 dark:from-white dark:to-slate-400'} bg-clip-text text-transparent mb-3 ${isRotating ? 'animate-pulse' : ''}`}>
            {isRotating ? '***.***.***.***' : isOnion ? 'FRAGMENTED' : identity.ip}
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${isOnion ? 'bg-purple-500' : 'bg-emerald-500'}`}></span>
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-tighter">
              {isOnion ? 'Chiffrement Multi-Couche (Onion)' : 'Tunnel Chiffré AES-256'}
            </span>
          </div>
        </div>

        {/* Network Context Card */}
        <div className={`glass-card p-6 rounded-[2.5rem] border shadow-2xl relative overflow-hidden group transition-all duration-500 ${isOnion ? 'border-purple-500/40 hover:shadow-purple-500/10' : 'border-white/10 dark:border-slate-800/50 hover:border-emerald-500/40'}`}>
          <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${isOnion ? 'border-purple-500/40' : 'border-emerald-500/30'}`}></div>
          <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${isOnion ? 'border-purple-500/40' : 'border-emerald-500/30'}`}></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isOnion ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                <Globe className="w-5 h-5 group-hover:rotate-[25deg] transition-transform" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Région Exit_Node</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-800 shadow-inner">
              <Clock className={`w-3.5 h-3.5 ${isOnion ? 'text-purple-500' : 'text-emerald-500'}`} /> {localTime}
            </div>
          </div>
          
          <div className="flex justify-between items-start gap-6">
            <div className={`font-black tracking-tight text-2xl text-slate-900 dark:text-white flex-1 ${isRotating ? 'animate-pulse' : ''}`}>
                {identity.city}, {identity.country}
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 opacity-50">{isOnion ? 'Vortex_Chain_Alpha' : 'Renumerate_Cluster'}</div>
            </div>

            <div className="flex flex-col gap-4 min-w-[130px]">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ping local</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-xs text-slate-600 dark:text-slate-300">
                    <Activity className={`w-3.5 h-3.5 ${isOnion ? 'text-purple-500' : 'text-cyan-500'}`} />
                    {isRotating ? '--' : `${identity.latency}ms`}
                  </div>
               </div>
               <div className="flex flex-col border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Délai Réseau</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-xs text-emerald-500">
                     <Cpu className="w-3.5 h-3.5 animate-pulse" />
                     {isRotating ? '--' : `${networkDelay}ms`}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Matrice Panel */}
      <div className={`glass-card p-10 rounded-[3.5rem] border transition-all duration-700 relative overflow-hidden group/panel ${isMasking ? 'border-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.25)]' : isOnion ? 'border-purple-500/40 shadow-purple-500/10' : 'border-white/10 dark:border-slate-800/50 shadow-2xl'}`}>
        <div className={`absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isOnion ? 'from-purple-500 via-transparent to-transparent' : 'from-indigo-500 via-transparent to-transparent'}`}></div>
        {(isMasking || isOnion) && <div className="absolute inset-0 bg-scanline pointer-events-none opacity-20"></div>}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-14 relative z-10">
          <div className="flex items-center gap-8">
            <div className={`p-8 rounded-[3rem] transition-all duration-700 shadow-2xl transform group-hover/panel:scale-105 ${isMasking ? 'bg-indigo-600 text-white animate-pulse' : isOnion ? 'bg-purple-900 text-purple-400 border border-purple-500/40' : 'bg-slate-900 text-indigo-500 border border-indigo-500/20'}`}>
              <Fingerprint className="w-14 h-14" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2.5 py-1 rounded-[10px] text-[10px] font-black uppercase tracking-widest ${isOnion ? 'bg-purple-500 text-white' : 'bg-indigo-500 text-white'}`}>
                  {isOnion ? 'Vortex_IA v2.0' : 'Renumber_IA v4.2'}
                </span>
                <Target className={`w-5 h-5 ${isOnion ? 'text-purple-500' : 'text-indigo-500'}`} />
              </div>
              <h4 className="text-4xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">Matrice d'Identité</h4>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.4em]">Morphing matériel & logiciel actif</p>
            </div>
          </div>
          
          <button 
              onClick={onMask}
              disabled={isMaskingDisabled}
              className={`group relative flex items-center justify-center gap-5 px-16 py-7 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] transition-all duration-500 overflow-hidden ${isMasking ? 'bg-indigo-600 text-white cursor-wait shadow-2xl shadow-indigo-500/40' : isOnion ? 'bg-purple-700 text-white hover:bg-purple-800' : 'bg-indigo-700 text-white hover:bg-indigo-800 hover:scale-105 shadow-xl disabled:opacity-40'}`}
          >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {isMasking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
              <span className="relative z-10">{isMasking ? 'SYNCHRONISATION...' : "Ré-numéroter"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* User-Agent Spoofing */}
          <div className={`p-8 rounded-[3rem] border transition-all duration-500 group/ua ${isMasking || isScramblingUA ? 'bg-slate-950/90 border-indigo-500/50' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-8">
              <span className="text-[12px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-4 group-hover/ua:text-blue-500 transition-colors">
                <Chrome className="w-6 h-6 text-blue-500" /> Profil Logiciel
              </span>
              <button 
                onClick={() => {setIsScramblingUA(true); setTimeout(()=>{onScrambleUA?.(); setIsScramblingUA(false)},800)}} 
                disabled={isMaskingDisabled} 
                className="p-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
              >
                <RefreshCw className={`w-5 h-5 ${isScramblingUA ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className={`font-mono text-[11px] leading-relaxed h-20 overflow-hidden relative p-5 bg-white/50 dark:bg-slate-950/80 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-inner ${isMasking || isScramblingUA ? 'text-indigo-500 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>
               {isMasking || isScramblingUA ? <div className="text-indigo-500 break-all">{scrambleText}</div> : currentUAData.full}
               <div className="absolute bottom-2 right-4 text-[9px] font-bold text-slate-400 uppercase bg-white dark:bg-slate-900 px-2 rounded">DATA_STREAM</div>
            </div>
          </div>

          {/* Hardware ID Panel */}
          <div className={`p-8 rounded-[3rem] border transition-all duration-500 group/hw ${isMasking ? 'bg-slate-950/90 border-indigo-500/50' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
              <span className="text-[12px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-4 group-hover/hw:text-emerald-500 transition-colors">
                <ShieldCheck className="w-6 h-6 text-emerald-500" /> Profil Matériel
              </span>
              
              <div className="flex bg-slate-200 dark:bg-slate-800 rounded-2xl p-1.5 shadow-inner">
                {macFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => !isMaskingDisabled && onFormatChange?.(fmt.id)}
                    disabled={isMaskingDisabled}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${macFormat === fmt.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 disabled:opacity-20'}`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`text-2xl font-mono font-black tracking-[0.4em] h-20 flex items-center justify-center p-5 bg-white/50 dark:bg-slate-950/80 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-inner relative group/mac ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? 'XX.XX.XX.XX' : identity.mac}
                {!isMasking && (
                  <button 
                    onClick={onScrambleMac} 
                    disabled={isMaskingDisabled}
                    className="absolute right-6 opacity-0 group-hover/mac:opacity-100 p-3 text-slate-400 hover:text-emerald-500 transition-all"
                  >
                    <RefreshCw className="w-6 h-6" />
                  </button>
                )}
            </div>
            <div className="flex items-center justify-between mt-3 px-2">
              <p className="text-[11px] font-bold text-slate-500">Constructeur : <span className={`${isOnion ? 'text-purple-500' : 'text-indigo-500'}`}>{getMacVendor(identity.mac)}</span></p>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isOnion ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
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
