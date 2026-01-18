
import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Monitor, Network, ShieldCheck, Pin, Building2, 
  Copy, Activity, X, Users, MapPin, 
  Ghost, Fingerprint, Info, 
  Loader2, Terminal, ShieldAlert, Clock, ShieldEllipsis, Cpu, Globe2, Chrome, CloudRain, Sun, Cloud,
  Map as MapIcon, Coins, Thermometer, RefreshCw, ToggleLeft, ToggleRight,
  EyeOff, Unplug, Shield as ShieldIcon
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
  const [showCityDetails, setShowCityDetails] = useState(false);
  const [isFetchingCity, setIsFetchingCity] = useState(false);
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
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./()_";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 60; i++) {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
        setScrambleText(result);
      }, 50);
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

  const handleScrambleMacLocal = () => {
    if (!onScrambleMac || isRotating || isMasking || isScramblingMac) return;
    setIsScramblingMac(true);
    setTimeout(() => {
      onScrambleMac(forceLAA);
      setIsScramblingMac(false);
    }, 800);
  };

  const handleScrambleUALocal = () => {
    if (!onScrambleUA || isRotating || isMasking || isScramblingUA) return;
    setIsScramblingUA(true);
    setTimeout(() => {
      onScrambleUA();
      setIsScramblingUA(false);
    }, 800);
  };

  const currentUAData = REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || REALISTIC_USER_AGENTS[0];

  const isLAA = (mac: string) => {
      const clean = mac.replace(/[:.-]/g, '');
      const secondNibble = clean[1]?.toUpperCase();
      return ['2', '6', 'A', 'E'].includes(secondNibble);
  };

  const getMacVendor = (mac: string) => {
      if (isLAA(mac)) return "Local Admin (LAA)";
      const clean = mac.replace(/[:.-]/g, '').toUpperCase();
      const prefix = clean.slice(0, 6);
      const vendors: Record<string, string> = {
          "000502": "Apple Inc.",
          "000CF1": "Intel Corp.",
          "00163E": "XenSource",
          "005056": "VMware",
          "00000C": "Cisco Systems",
          "3C5AB4": "Samsung",
          "001422": "Dell Inc.",
          "001018": "Broadcom",
          "E0D55E": "Giga-Byte",
          "525400": "QEMU Virtual"
      };
      return vendors[prefix] || "Vendor Unknown";
  };

  const isSmartDns = mode === ConnectionMode.SMART_DNS;
  const isMaskingDisabled = !isConnected || isSmartDns || isRotating || isMasking;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Primary Identity Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Virtual IP Display */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-blue-700/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-700/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-700/10 rounded-xl text-blue-700 dark:text-blue-400">
                <Network className="w-5 h-5" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest">Tunnel de Sortie</span>
            </div>
            {copiedIp ? (
              <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-tighter animate-in zoom-in-50">Copié</span>
            ) : (
              <button onClick={handleCopyIp} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400">
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">Adresse IP Virtuelle</span>
            <div className={`font-mono text-2xl font-black tracking-widest ${isRotating ? 'text-blue-700 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
               {isRotating ? 'RENUMERATING...' : (isSmartDns ? 'LOCAL_DNS_IP' : identity.ip)}
            </div>
            <div className="mt-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cryptage AES-256 Actif</span>
            </div>
          </div>
        </div>

        {/* Node Location Display */}
        <div className="glass-card p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-blue-700/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-700/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-700/10 rounded-xl text-blue-700 dark:text-blue-400">
                <Globe className="w-5 h-5" />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest">Localisation</span>
            </div>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">Point de Terminaison</span>
            <div className={`font-black tracking-tight text-xl ${isRotating ? 'text-blue-700 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {identity.city}, {identity.country}
            </div>
            <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-700" />
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{identity.latency}ms</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{localTime}</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Protection Card */}
      <div className={`glass-card p-6 md:p-8 rounded-[2.5rem] border transition-all relative overflow-hidden ${isMasking ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-2xl shadow-indigo-500/20 animate-glow' : 'border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/10'}`}>
        
        {/* Dynamic Background Effects */}
        <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-40">
           <div className="absolute inset-0 cyber-grid"></div>
           {isMasking && <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-blue-700/10"></div>}
           <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-700/50 to-transparent animate-scanline"></div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 relative z-10">
          <div className="flex items-center gap-5">
            <div className={`p-5 rounded-[2rem] transition-all transform ${isMasking ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 rotate-12 scale-110' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <Ghost className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-[0.3em]">Protection Empreinte</span>
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${hasMaskedOnce && isConnected ? 'bg-emerald-50/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-50/10 text-red-500 border border-red-500/20'}`}>
                  {hasMaskedOnce && isConnected ? (
                    <><ShieldCheck className="w-3 h-3" /> MASQUÉ</>
                  ) : (
                    <><ShieldAlert className="w-3 h-3 animate-pulse" /> VULNÉRABLE</>
                  )}
                </div>
              </div>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1.5">Anonymisation Avancée</h4>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3">
              <button 
                  onClick={(e) => { e.stopPropagation(); onMask?.(); }}
                  disabled={isMaskingDisabled}
                  className={`flex items-center justify-center gap-4 px-10 py-4 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.15em] transition-all shadow-2xl active:scale-95 ${
                      isMasking 
                        ? 'bg-indigo-600 text-white shadow-indigo-500/40' 
                        : isMaskingDisabled 
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50' 
                          : 'bg-blue-700 text-white hover:bg-blue-800 hover:-translate-y-1 shadow-blue-700/30'
                  }`}
              >
                  {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <EyeOff className="w-5 h-5" />}
                  {isMasking ? 'RE-GÉNÉRATION...' : "Masquer l'empreinte"}
              </button>
              {isSmartDns && isConnected && (
                  <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-lg uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5" /> Désactivé en Smart DNS
                  </div>
              )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
          {/* User Agent Block */}
          <div className={`p-6 rounded-3xl border transition-all ${isMasking || isScramblingUA ? 'bg-slate-900/50 border-indigo-500/40' : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-blue-700" />
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Spoofing Navigateur</span>
              </div>
              <button 
                onClick={handleScrambleUALocal}
                disabled={isMaskingDisabled || isScramblingUA}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-700 transition-all border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className={`w-4 h-4 ${isScramblingUA ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="font-mono text-[11px] leading-relaxed h-16 overflow-hidden relative">
               <div className={`transition-opacity duration-300 ${isMasking || isScramblingUA ? 'opacity-0' : 'opacity-100'}`}>
                  {currentUAData.full}
               </div>
               {(isMasking || isScramblingUA) && (
                 <div className="absolute inset-0 text-indigo-500 break-all font-bold animate-pulse">
                    {scrambleText}
                 </div>
               )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
               {[
                 { icon: Monitor, label: 'Système', val: currentUAData.os },
                 { icon: Chrome, label: 'Navigateur', val: currentUAData.browser },
                 { icon: Cpu, label: 'Build ID', val: currentUAData.build },
                 { icon: Globe2, label: 'Moteur', val: currentUAData.engine }
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                   <item.icon className="w-4 h-4 text-slate-400 shrink-0" />
                   <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{item.label}</p>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{(isMasking || isScramblingUA) ? '???' : item.val}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
          
          {/* MAC Address Block */}
          <div className={`p-6 rounded-3xl border transition-all ${isMasking || isScramblingMac ? 'bg-slate-900/50 border-indigo-500/40' : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-4 h-4 text-blue-700" />
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Usurpation Matérielle</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setForceLAA(!forceLAA)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all ${forceLAA ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}
                >
                  LAA
                </button>
                <button 
                  onClick={handleScrambleMacLocal}
                  disabled={isMaskingDisabled || isScramblingMac}
                  className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-700 transition-all border border-slate-200 dark:border-slate-700"
                >
                  <RefreshCw className={`w-4 h-4 ${isScramblingMac ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            <div className={`text-2xl font-mono font-black tracking-[0.2em] h-16 flex items-center justify-center ${isMasking || isScramblingMac ? 'text-indigo-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {isRotating ? '--:--:--' : identity.mac}
            </div>

            <div className="mt-6 flex flex-col gap-3">
               <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className={`w-5 h-5 ${isLAA(identity.mac) ? 'text-indigo-500' : 'text-emerald-500'}`} />
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase">Constructeur Détecté</span>
                       <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{getMacVendor(identity.mac)}</span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${isLAA(identity.mac) ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    {isLAA(identity.mac) ? 'ANONYME' : 'VISIBLE'}
                  </div>
               </div>
               <div className="px-4 py-3 bg-blue-700/5 border border-blue-700/10 rounded-2xl">
                  <p className="text-[10px] text-slate-500 leading-tight italic">
                    {isLAA(identity.mac) 
                      ? "L'adresse LAA empêche l'identification physique de votre carte réseau." 
                      : "Utilisez le mode LAA pour briser la corrélation matérielle sur les réseaux publics."}
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security AI Report (Expert Opinion) */}
      {securityReport && (
        <div className="glass-card p-6 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 animate-in slide-in-from-bottom-2 duration-700">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                   <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Rapport d'Expert IA</h4>
                   <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Analyse en temps réel de votre tunnel</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                 <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{securityReport.score}</span>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">/100</span>
              </div>
           </div>
           <div className="p-4 bg-white/50 dark:bg-slate-950/50 rounded-2xl border border-emerald-500/10 relative">
              <Terminal className="absolute top-3 right-3 w-3 h-3 text-emerald-500/30" />
              <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed pl-4 border-l-2 border-emerald-500/30">
                "{securityReport.analysis}"
              </p>
           </div>
        </div>
      )}
    </div>
  );
};
