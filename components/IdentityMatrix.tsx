
import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Monitor, Network, ShieldCheck, 
  Copy, Activity, 
  Ghost, Fingerprint, 
  Loader2, Terminal, ShieldAlert, Clock, Cpu, Globe2, Chrome,
  RefreshCw,
  EyeOff, Shield as ShieldIcon, ChevronRight, Hash
} from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  entryIdentity: VirtualIdentity | null;
  isRotating: boolean;
  isMasking?: boolean;
  mode: ConnectionMode;
  securityReport?: SecurityReport | null;
  onMask?: () => void;
  onScrambleMac?: (forceLAA: boolean) => void;
  onScrambleUA?: () => void;
  isConnected?: boolean;
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
  isConnected = false
}) => {
  const [copiedIp, setCopiedIp] = useState(false);
  const [hasMaskedOnce, setHasMaskedOnce] = useState(false);
  const [localTime, setLocalTime] = useState<string>('');
  const [forceLAA, setForceLAA] = useState(true);
  const [isScramblingMac, setIsScramblingMac] = useState(false);
  const [isScramblingUA, setIsScramblingUA] = useState(false);
  const [scrambleText, setScrambleText] = useState('');

  useEffect(() => {
    if (isMasking) setHasMaskedOnce(true);
  }, [isMasking]);

  useEffect(() => {
    if (isMasking || isScramblingUA) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 60; i++) {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
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

  const handleCopyIp = () => {
    if (isRotating) return;
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const currentUAData = REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || REALISTIC_USER_AGENTS[0];

  const isLAA = (mac: string) => {
      const clean = mac.replace(/[:.-]/g, '');
      const secondNibble = clean[1]?.toUpperCase();
      return ['2', '6', 'A', 'E'].includes(secondNibble);
  };

  const getMacVendor = (mac: string) => {
      if (isLAA(mac)) return "Locally Administered";
      const clean = mac.replace(/[:.-]/g, '').toUpperCase();
      const prefix = clean.slice(0, 6);
      const vendors: Record<string, string> = {
          "000502": "Apple Inc.",
          "000CF1": "Intel Corp.",
          "00163E": "Xen (Virtual)",
          "005056": "VMware",
          "00000C": "Cisco Systems",
          "3C5AB4": "Samsung",
          "001422": "Dell Inc.",
          "001018": "Broadcom",
          "E0D55E": "Giga-Byte",
          "525400": "QEMU Virtual"
      };
      return vendors[prefix] || "Unknown Hardware";
  };

  const isSmartDns = mode === ConnectionMode.SMART_DNS;
  const isMaskingDisabled = !isConnected || isSmartDns || isRotating || isMasking;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Primary Identity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Virtual IP Display */}
        <div className="glass-card p-6 rounded-[2rem] border border-white/10 dark:border-slate-800/50 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-700/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-700/10 rounded-xl text-blue-700">
                <Network className="w-5 h-5" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Flux Sortant</span>
            </div>
            {copiedIp ? (
              <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-tighter">Copié</span>
            ) : (
              <button onClick={handleCopyIp} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-blue-700">
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative z-10">
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-[0.1em] mb-1 block">Adresse IP Virtuelle</span>
            <div className={`font-mono text-3xl font-black tracking-widest ${isRotating ? 'text-blue-700 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
               {isRotating ? '000.000.0.000' : (isSmartDns ? 'LOCAL_DNS_IP' : identity.ip)}
            </div>
          </div>
        </div>

        {/* Node Location Display */}
        <div className="glass-card p-6 rounded-[2rem] border border-white/10 dark:border-slate-800/50 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-700/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-700/10 rounded-xl text-blue-700">
                <Globe className="w-5 h-5" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Localisation</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 font-mono text-[10px] font-bold">
              <Clock className="w-3 h-3" />
              {localTime}
            </div>
          </div>
          <div className="relative z-10">
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-[0.1em] mb-1 block">Nœud de Sortie</span>
            <div className={`font-black tracking-tight text-2xl ${isRotating ? 'text-blue-700 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {identity.city}, {identity.country}
            </div>
          </div>
        </div>
      </div>

      {/* Main Protection Card */}
      <div className={`glass-card p-8 md:p-10 rounded-[3rem] border transition-all duration-500 relative overflow-hidden ${isMasking ? 'border-indigo-500/50 ring-8 ring-indigo-500/5 shadow-[0_0_50px_rgba(79,70,229,0.1)]' : 'border-white/10 dark:border-slate-800/50 shadow-2xl'}`}>
        
        {/* Cyber Scanning Line */}
        {isMasking && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-scanline z-20"></div>}

        {/* Background Patterns */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.07]">
           <div className="absolute inset-0 cyber-grid"></div>
           <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-700/10 to-transparent"></div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`p-6 rounded-[2.2rem] transition-all duration-700 shadow-2xl transform ${isMasking ? 'bg-indigo-600 text-white rotate-12 scale-110' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <Ghost className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Privacy_Matrix_V2</span>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${hasMaskedOnce && isConnected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                  {hasMaskedOnce && isConnected ? <><ShieldCheck className="w-3 h-3" /> SECURED</> : <><ShieldAlert className="w-3 h-3 animate-pulse" /> EXPOSED</>}
                </div>
              </div>
              <h4 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Anonymisation Avancée</h4>
            </div>
          </div>
          
          <button 
              onClick={(e) => { e.stopPropagation(); onMask?.(); }}
              disabled={isMaskingDisabled}
              className={`group flex items-center justify-center gap-4 px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] transition-all relative overflow-hidden ${
                  isMasking 
                    ? 'bg-indigo-600 text-white cursor-wait' 
                    : isMaskingDisabled 
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50' 
                      : 'bg-blue-700 text-white hover:bg-blue-800 hover:-translate-y-1 shadow-[0_20px_40px_-15px_rgba(29,78,216,0.4)] active:scale-95'
              }`}
          >
              {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <EyeOff className="w-5 h-5 group-hover:scale-125 transition-transform" />}
              {isMasking ? 'GÉNÉRATION...' : "Masquer l'empreinte"}
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* User Agent Block */}
          <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${isMasking || isScramblingUA ? 'bg-slate-950/80 border-indigo-500/30' : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-700/10 rounded-lg text-blue-700">
                  <Terminal className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Browser_Spoof</span>
              </div>
              <button 
                onClick={() => { if(!isMaskingDisabled && !isScramblingUA) { setIsScramblingUA(true); setTimeout(() => { onScrambleUA?.(); setIsScramblingUA(false); }, 800); }}}
                disabled={isMaskingDisabled || isScramblingUA}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-700 transition-all border border-slate-200 dark:border-slate-700 hover:shadow-lg active:scale-90"
              >
                <RefreshCw className={`w-4 h-4 ${isScramblingUA ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="font-mono text-[10px] leading-relaxed h-14 overflow-hidden relative mb-8 p-4 bg-white/40 dark:bg-slate-950/40 rounded-2xl border border-white/10 dark:border-slate-800/50">
               <div className={`transition-opacity duration-300 ${isMasking || isScramblingUA ? 'opacity-0' : 'opacity-100'}`}>
                  {currentUAData.full}
               </div>
               {(isMasking || isScramblingUA) && (
                 <div className="absolute inset-0 p-4 text-indigo-500 break-all font-bold animate-pulse">
                    {scrambleText}
                 </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-4">
               {[
                 { icon: Monitor, label: 'S.O', val: currentUAData.os },
                 { icon: Chrome, label: 'NAV', val: currentUAData.browser },
                 { icon: Hash, label: 'BUILD', val: currentUAData.build },
                 { icon: Globe2, label: 'ENGINE', val: currentUAData.engine.split(' ')[0] }
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 group/item hover:border-blue-700/30 transition-colors">
                   <item.icon className="w-4 h-4 text-slate-400 group-hover/item:text-blue-700 transition-colors shrink-0" />
                   <div className="min-w-0">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.label}</p>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{(isMasking || isScramblingUA) ? 'REDACTED' : item.val}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
          
          {/* MAC Address Block */}
          <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${isMasking || isScramblingMac ? 'bg-slate-950/80 border-indigo-500/30' : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-700/10 rounded-lg text-blue-700">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Hardware_Mask</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setForceLAA(!forceLAA)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black border transition-all ${forceLAA ? 'bg-blue-700 text-white border-blue-700 shadow-lg shadow-blue-700/20' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}
                >
                  FORCER LAA
                </button>
                <button 
                  onClick={() => { if(!isMaskingDisabled && !isScramblingMac) { setIsScramblingMac(true); setTimeout(() => { onScrambleMac?.(forceLAA); setIsScramblingMac(false); }, 800); }}}
                  disabled={isMaskingDisabled || isScramblingMac}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-700 transition-all border border-slate-200 dark:border-slate-700 hover:shadow-lg active:scale-90"
                >
                  <RefreshCw className={`w-4 h-4 ${isScramblingMac ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            <div className={`text-2xl font-mono font-black tracking-[0.25em] h-14 flex items-center justify-center p-4 bg-white/40 dark:bg-slate-950/40 rounded-2xl border border-white/10 dark:border-slate-800/50 mb-8 ${isMasking || isScramblingMac ? 'text-indigo-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? 'XX:XX:XX:XX' : identity.mac}
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between p-5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isLAA(identity.mac) ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      <ShieldIcon className="w-5 h-5" />
                    </div>
                    <div>
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Hardware Vendor</span>
                       <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{getMacVendor(identity.mac)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
               </div>
               <div className={`px-5 py-4 rounded-2xl border text-[10px] font-medium leading-relaxed italic transition-colors ${isLAA(identity.mac) ? 'bg-blue-700/5 border-blue-700/10 text-blue-700 dark:text-blue-400' : 'bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                  {isLAA(identity.mac) 
                    ? "Mode LAA actif : L'identification physique de votre contrôleur réseau est impossible." 
                    : "Attention : Votre signature matérielle est corrélée à un constructeur connu."}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security AI Report (Expert Opinion) */}
      {securityReport && (
        <div className="glass-card p-8 rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 animate-in slide-in-from-bottom-2 duration-700 relative overflow-hidden">
           <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full"></div>
           <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                   <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">IA_Security_Audit</h4>
                   <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Analyse temps réel de l'empreinte</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                 <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{securityReport.score}<span className="text-xs text-slate-400 ml-1">/100</span></div>
              </div>
           </div>
           <div className="p-5 bg-white/40 dark:bg-slate-950/40 rounded-2xl border border-emerald-500/10 relative z-10">
              <Terminal className="absolute top-4 right-4 w-3.5 h-3.5 text-emerald-500/20" />
              <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed pl-4 border-l-2 border-emerald-500/30">
                "{securityReport.analysis}"
              </p>
           </div>
        </div>
      )}
    </div>
  );
};
