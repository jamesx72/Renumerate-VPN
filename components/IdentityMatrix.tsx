
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, CheckCircle2, Globe2,
  Cpu, Activity, Target, ShieldCheck, Orbit, Lock, ArrowRight,
  Shield, Zap, Radio, BarChart3, Scan, Layers
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
  const [signature, setSignature] = useState('0x' + Math.random().toString(16).slice(2, 10).toUpperCase());

  const isOnion = mode === ConnectionMode.ONION_VORTEX;

  useEffect(() => {
    const interval = setInterval(() => {
      setEntropy((Math.random() * 0.5 + 9.5).toFixed(2));
      if (Math.random() > 0.8) setSignature('0x' + Math.random().toString(16).slice(2, 10).toUpperCase());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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
    border: isOnion ? 'border-purple-500/40' : 'border-cyan-500/40',
    borderStrong: isOnion ? 'border-purple-500/80' : 'border-cyan-500/80',
    bg: isOnion ? 'bg-purple-950/40' : 'bg-slate-900/40',
    glow: isOnion ? 'shadow-[0_0_40px_rgba(168,85,247,0.1)]' : 'shadow-[0_0_40px_rgba(6,182,212,0.1)]',
    gradient: isOnion ? 'from-purple-600 via-indigo-500 to-purple-400' : 'from-cyan-600 via-blue-500 to-emerald-400'
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      
      {/* Top Meta-Bar Identity */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* IP Card HUD */}
        <div className={`flex-1 glass-card p-6 rounded-[2rem] border-2 ${theme.border} relative overflow-hidden group ${theme.glow}`}>
          <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${theme.borderStrong} opacity-60 rounded-tl-2xl`}></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <ShieldCheck className={`w-3.5 h-3.5 ${theme.primary}`} />
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Access_Node_Public_IP</span>
              </div>
              <div className={`text-3xl font-mono font-black tracking-tight ${isRotating ? 'animate-glitch' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? '???.???.???.???' : identity.ip}
              </div>
            </div>
            <button 
              onClick={() => {navigator.clipboard.writeText(identity.ip); setCopiedIp(true); setTimeout(()=>setCopiedIp(false),2000)}} 
              className={`p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all ${copiedIp ? 'text-emerald-500' : 'text-slate-400'}`}
            >
               {copiedIp ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between relative z-10">
             <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-white/5">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">{isConnected ? 'Handshake_OK' : 'Link_Closed'}</span>
             </div>
             <span className="text-[9px] font-mono text-slate-600 font-bold">{signature}</span>
          </div>
        </div>

        {/* Location Card HUD */}
        <div className={`flex-1 glass-card p-6 rounded-[2rem] border-2 ${theme.border} relative overflow-hidden group ${theme.glow}`}>
           <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 ${theme.borderStrong} opacity-60 rounded-tr-2xl`}></div>
           <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <Globe className={`w-3.5 h-3.5 ${theme.secondary}`} />
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Geospatial_Resolution</span>
              </div>
              <div className={`text-2xl font-black tracking-tighter ${isRotating ? 'blur-sm' : 'text-slate-900 dark:text-white'}`}>
                {identity.city}, <span className={`${theme.secondary}`}>{identity.country}</span>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-black/40 rounded-xl border border-white/5 text-[10px] font-mono font-black text-slate-400 flex items-center gap-2">
               <Clock className={`w-3 h-3 ${theme.primary}`} /> {localTime}
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 relative z-10">
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Délai_Sync</span>
                <span className="text-xs font-mono font-black text-slate-700 dark:text-slate-200">{identity.latency}ms</span>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Entropie</span>
                <span className={`text-xs font-mono font-black ${theme.secondary}`}>{entropy} H</span>
             </div>
          </div>
        </div>
      </div>

      {/* Main Tactical Identity Panel */}
      <div className={`glass-card p-1 relative rounded-[3rem] border-2 transition-all duration-700 overflow-hidden group/panel ${isMasking ? 'border-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.2)]' : `border-slate-800 shadow-2xl hover:${theme.border}`}`}>
        
        {/* Scan Animation Line */}
        {isConnected && <div className={`absolute left-0 right-0 h-[2px] z-20 ${isOnion ? 'bg-purple-500/50 shadow-[0_0_15px_purple]' : 'bg-cyan-500/50 shadow-[0_0_15px_cyan]'} animate-cyber-scan pointer-events-none`}></div>}
        
        <div className={`p-8 md:p-12 rounded-[2.9rem] ${theme.bg} relative overflow-hidden`}>
          {/* Decorative Grid & Background */}
          <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-white/5 to-transparent pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 mb-12 relative z-10">
             <div className="flex flex-col md:flex-row items-center gap-8">
                <div className={`p-8 rounded-[2.5rem] bg-slate-900 border-2 transition-all duration-500 transform group-hover/panel:rotate-[4deg] ${isMasking ? 'border-indigo-500 text-indigo-400 animate-pulse' : isOnion ? 'border-purple-500 text-purple-400 shadow-xl shadow-purple-500/10' : 'border-cyan-500 text-cyan-400 shadow-xl shadow-cyan-500/10'}`}>
                   <Fingerprint className="w-14 h-14" />
                </div>
                <div className="text-center md:text-left">
                   <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                      <span className={`px-3 py-1 bg-black/40 rounded-full text-[9px] font-black uppercase tracking-widest border ${theme.border}`}>
                        {isOnion ? 'Moteur_Vortex_v3' : 'Protocole_Matrix_RNC'}
                      </span>
                      <Activity className={`w-4 h-4 ${theme.primary} animate-pulse`} />
                   </div>
                   <h4 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Matrice_Spoofing</h4>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-3">Synthesized Terminal Identity Readout</p>
                </div>
             </div>

             <button 
                onClick={onMask}
                disabled={isMaskingDisabled}
                className={`relative px-16 py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] overflow-hidden group/btn transition-all duration-500 ${isMasking ? 'bg-indigo-600 text-white cursor-wait' : isOnion ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-30'}`}
             >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                <div className="flex items-center gap-3 relative z-10">
                   {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-500" />}
                   <span>{isMasking ? 'SÉCURISATION...' : 'RÉ-NUMÉROTER'}</span>
                </div>
             </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
             {/* Component: UA Masking */}
             <div className={`bracket-corner p-8 rounded-[2rem] border-2 transition-all duration-500 flex flex-col justify-between h-56 relative ${isMasking || isScramblingUA ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-black/20 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <Chrome className={`w-5 h-5 ${theme.primary}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logiciel_Empreinte</span>
                   </div>
                   <button 
                    onClick={() => {setIsScramblingUA(true); setTimeout(()=>{onScrambleUA?.(); setIsScramblingUA(false)},800)}} 
                    disabled={isMaskingDisabled}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-500 hover:text-white"
                   >
                     <RefreshCw className={`w-4 h-4 ${isScramblingUA ? 'animate-spin' : ''}`} />
                   </button>
                </div>
                
                <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed text-slate-300 h-24 overflow-hidden relative">
                   {isMasking || isScramblingUA ? <div className="break-all tracking-widest italic text-indigo-400">{scrambleText}</div> : currentUAData.full}
                   <div className="absolute bottom-2 right-4 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-flicker"></div>
                      <span className="text-[7px] font-black text-slate-600 uppercase">UA_Flow_Active</span>
                   </div>
                </div>
             </div>

             {/* Component: MAC Hardware Masking */}
             <div className={`bracket-corner p-8 rounded-[2rem] border-2 transition-all duration-500 flex flex-col justify-between h-56 relative ${isMasking ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-black/20 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <Cpu className={`w-5 h-5 ${theme.secondary}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matériel_Spoof (MAC)</span>
                   </div>
                   <div className="flex bg-slate-900/80 p-1 rounded-lg border border-white/5">
                      {['standard', 'hyphen', 'cisco'].map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => !isMaskingDisabled && onFormatChange?.(fmt as any)}
                          disabled={isMaskingDisabled}
                          className={`px-2 py-1 rounded text-[8px] font-black transition-all uppercase ${macFormat === fmt ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center gap-4">
                   <div className="text-3xl font-mono font-black text-white tracking-[0.2em] relative group/mac">
                      {isRotating ? '??:??:??' : identity.mac}
                      {!isMasking && isConnected && (
                         <button onClick={onScrambleMac} className="absolute -right-10 opacity-0 group-hover/mac:opacity-100 p-2 text-brand-500 hover:scale-110 transition-all">
                            <RefreshCw className="w-4 h-4" />
                         </button>
                      )}
                   </div>
                   <div className="w-full flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-bold text-slate-500 uppercase">Fabricant:</span>
                         <span className={`text-[9px] font-black uppercase text-slate-300`}>{getMacVendor(identity.mac)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[8px] font-mono text-emerald-500 uppercase tracking-tighter">
                         <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                         Spoof_Valid
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Bottom HUD Metadata */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-white/5 pt-8">
             <div className="flex items-center gap-10">
                <div className="flex items-center gap-3">
                   <BarChart3 className="w-4 h-4 text-slate-500" />
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-600 uppercase">Anonymat_Rating</span>
                      <span className={`text-[10px] font-black ${theme.primary}`}>ULTRA_HIGH (0.98)</span>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <Layers className="w-4 h-4 text-slate-500" />
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-600 uppercase">Couches_Protection</span>
                      <span className="text-[10px] font-black text-slate-300">{isOnion ? '12-LEVEL ONION' : 'AES-256 TUNNEL'}</span>
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                   <Zap className="w-3.5 h-3.5 text-amber-500" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Moteur IA Actif</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500">
                   <Lock className="w-3.5 h-3.5" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Zéro-Log Policy</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
