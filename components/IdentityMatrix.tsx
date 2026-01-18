
import React, { useState, useEffect, useMemo } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Network, Copy, Ghost, Fingerprint, 
  Loader2, Clock, Chrome, RefreshCw, 
  Hash, Sparkles, CheckCircle2, Globe2,
  Cpu, Activity, Target, ShieldCheck, Orbit, Lock, ArrowRight,
  Shield, Zap, Radio, BarChart3, Scan, Layers, Tv, Binary, ChevronRight,
  MapPin, Users, Thermometer, Cloud, Info, X
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
  const [scrambleText, setScrambleText] = useState('');
  const [entropy, setEntropy] = useState('0.00');
  const [signature, setSignature] = useState('0x' + Math.random().toString(16).slice(2, 10).toUpperCase());
  const [showCityModal, setShowCityModal] = useState(false);

  const isOnion = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  useEffect(() => {
    const interval = setInterval(() => {
      setEntropy((Math.random() * 0.4 + 9.6).toFixed(2));
      if (Math.random() > 0.85) setSignature('0x' + Math.random().toString(16).slice(2, 10).toUpperCase());
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMasking || isScramblingUA) {
      const chars = "10101010101010101010101010101010";
      const interval = setInterval(() => {
        let result = "";
        for (let i = 0; i < 100; i++) result += chars[Math.floor(Math.random() * chars.length)];
        setScrambleText(result);
      }, 30);
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      
      {/* HUD Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IP Info HUD */}
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
               {copiedIp ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
             <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-slate-500 font-bold tracking-widest uppercase">Auth: {signature}</span>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
             </div>
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-40">Uptime: 99.99%</span>
          </div>
        </div>

        {/* Geo Context HUD cliquable */}
        <div 
          className={`glass-card p-6 rounded-[2.5rem] border ${theme.border} relative overflow-hidden group transition-all duration-500 hover:translate-y-[-2px] ${theme.glow} cursor-pointer group/geo`}
          onClick={() => !isRotating && setShowCityModal(true)}
        >
           <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 ${theme.borderStrong} rounded-tr-[2.5rem] opacity-30`}></div>
           <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 ${theme.borderStrong} rounded-bl-[2.5rem] opacity-30`}></div>
           
           <div className="flex justify-between items-start relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <Globe className={`w-4 h-4 ${theme.secondary} group-hover/geo:rotate-180 transition-transform duration-700`} />
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Satellite_Relay</span>
              </div>
              <div className={`text-2xl font-black tracking-tight flex items-center gap-2 ${isRotating ? 'blur-sm' : 'text-slate-900 dark:text-white'}`}>
                {identity.city}, <span className={`${theme.secondary}`}>{identity.country}</span>
                <Info className="w-4 h-4 text-slate-400 opacity-0 group-hover/geo:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex flex-col items-end">
                <div className="px-3 py-1 bg-black/30 rounded-lg text-[11px] font-mono font-black text-slate-300 flex items-center gap-2 border border-white/5">
                   <Clock className={`w-3.5 h-3.5 ${theme.primary} animate-pulse`} /> {localTime}
                </div>
                <span className="text-[8px] font-black text-slate-600 mt-1 uppercase tracking-widest">{identity.timezone}</span>
            </div>
          </div>
          
          <div className="mt-6 flex items-end justify-between border-t border-white/5 pt-4">
             <div className="flex gap-4">
                 <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Network_Lag</span>
                    <span className="text-xs font-mono font-black text-slate-400">{identity.latency}ms</span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Entropy_H</span>
                    <span className={`text-xs font-mono font-black ${theme.secondary}`}>{entropy}</span>
                 </div>
             </div>
             <div className="flex gap-0.5 items-end h-6">
                {/* Fixed: Use Array.from to avoid spread operator issue and fix potential callable expression error on line 195 */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1 rounded-full ${i < 6 ? theme.accent : 'bg-slate-700'}`} 
                      style={{ height: `${(i+1)*12}%` }}
                    ></div>
                ))}
             </div>
          </div>

          {/* Modal Geo-HUD interne */}
          {showCityModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => {e.stopPropagation(); setShowCityModal(false);}}>
               <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"></div>
               <div 
                 className="relative w-full max-w-sm glass-card p-8 rounded-[3rem] border border-cyan-500/30 shadow-2xl animate-in zoom-in-95 duration-300 bracket-corner text-white"
                 onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute top-0 right-0 p-6">
                     <button onClick={() => setShowCityModal(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="flex items-center gap-4 mb-8">
                     <div className="p-4 bg-cyan-600 text-white rounded-2xl shadow-lg">
                        <MapPin className="w-8 h-8" />
                     </div>
                     <div>
                        <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em]">Local_Metadata</h4>
                        <h3 className="text-2xl font-black uppercase tracking-tight">{identity.city}</h3>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                           <Users className="w-4 h-4 text-cyan-400" />
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Population</span>
                        </div>
                        <span className="font-mono font-black text-sm">{currentCityData.population}</span>
                     </div>

                     <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                           <Globe2 className="w-4 h-4 text-emerald-400" />
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Région</span>
                        </div>
                        <span className="font-black text-[11px] uppercase tracking-tighter">{currentCityData.region}</span>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                           <Thermometer className="w-5 h-5 text-amber-500 mb-2" />
                           <span className="text-[9px] font-black text-slate-500 uppercase mb-1">Température</span>
                           <span className="font-mono font-black text-lg">{currentCityData.temp}</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                           <Cloud className="w-5 h-5 text-blue-400 mb-2" />
                           <span className="text-[9px] font-black text-slate-500 uppercase mb-1">Météo</span>
                           <span className="font-black text-xs uppercase">{currentCityData.weather}</span>
                        </div>
                     </div>

                     <div className="mt-6 pt-6 border-t border-white/5 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                           <span className="text-slate-500">Risque Interception_OSINT</span>
                           <span className={currentCityData.threat === 'Bas' ? 'text-emerald-500' : 'text-amber-500'}>{currentCityData.threat}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                           <div 
                             className={`h-full ${currentCityData.threat === 'Bas' ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                             style={{ width: currentCityData.threat === 'Bas' ? '15%' : '45%' }}
                            ></div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Tactical Interface */}
      {/* Fixed: Replaced complex template literal with concatenation to avoid parsing errors in some environments */}
      <div className={"glass-card p-1 relative rounded-[3.5rem] border transition-all duration-1000 overflow-hidden group/panel " + (isMasking ? "border-brand-500 shadow-[0_0_80px_rgba(6,182,212,0.15)]" : "border-slate-800 shadow-2xl hover:" + theme.borderStrong)}>
        
        {/* Animated Scanline Overlay */}
        <div className={`absolute left-0 right-0 h-[3px] z-30 pointer-events-none opacity-40 ${isOnion ? 'bg-purple-500 shadow-[0_0_15px_purple]' : isSmartDNS ? 'bg-amber-500 shadow-[0_0_15px_amber]' : 'bg-cyan-500 shadow-[0_0_15px_cyan]'} animate-cyber-scan`}></div>

        <div className={`p-8 md:p-12 rounded-[3.3rem] ${theme.bg} relative overflow-hidden flex flex-col`}>
          {/* Tech Backgrounds */}
          <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
          <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 mb-14 relative z-10">
             <div className="flex flex-col md:flex-row items-center gap-8">
                <div className={`p-10 rounded-[3rem] bg-slate-900/80 border-2 transition-all duration-700 transform group-hover/panel:scale-105 group-hover/panel:rotate-[-2deg] ${isMasking ? 'border-brand-500 text-brand-400 animate-pulse' : isOnion ? 'border-purple-500 text-purple-400' : isSmartDNS ? 'border-amber-500 text-amber-400' : 'border-cyan-500 text-cyan-400'}`}>
                   <Fingerprint className="w-16 h-16" />
                </div>
                <div className="text-center md:text-left">
                   <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                      <span className={`px-4 py-1 bg-black/50 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${theme.border}`}>
                        {isOnion ? 'PROTOCOL: VORTEX_SHIELD' : isSmartDNS ? 'PROTOCOL: DNS_INJECT_v2' : 'PROTOCOL: RNC_MATRIX_v4'}
                      </span>
                      <Binary className={`w-5 h-5 ${theme.primary} animate-pulse`} />
                   </div>
                   <h4 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Matrice_Identité</h4>
                   <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.5em] mt-3">Synthesized Terminal Spoofing Layer active</p>
                </div>
             </div>

             <button 
                onClick={onMask}
                disabled={isMaskingDisabled}
                className={`relative px-16 py-7 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] overflow-hidden group/btn transition-all duration-500 shadow-2xl active:scale-95 disabled:opacity-30 ${isMasking ? 'bg-indigo-600 text-white cursor-wait' : theme.accent + ' hover:opacity-90 text-white'}`}
             >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                   {isMasking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Scan className="w-6 h-6 group-hover/btn:rotate-180 transition-transform duration-500" />}
                   <span>{isMasking ? 'TRAITEMENT...' : 'RE-NUMÉROTER'}</span>
                </div>
             </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
             {/* Component Card: User Agent */}
             <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 flex flex-col justify-between h-64 relative overflow-hidden group/card ${isMasking || isScramblingUA ? 'border-brand-500 bg-brand-500/5' : 'border-slate-800 bg-black/40 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                       <div className={`p-3 rounded-2xl bg-slate-900 ${theme.primary}`}>
                           <Chrome className="w-6 h-6" />
                       </div>
                       <div className="flex flex-col">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logiciel_Empreinte</span>
                           <span className={`text-[9px] font-mono font-black ${theme.primary}`}>[ SPOOF_BROWSER_READY ]</span>
                       </div>
                    </div>
                    <button 
                        onClick={() => {setIsScramblingUA(true); setTimeout(()=>{onScrambleUA?.(); setIsScramblingUA(false)},800)}} 
                        disabled={isMaskingDisabled}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-slate-500 hover:text-white border border-white/5 active:scale-90"
                    >
                        <RefreshCw className={`w-5 h-5 ${isScramblingUA ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="p-5 bg-black/40 rounded-2xl border border-white/5 font-mono text-[11px] leading-relaxed text-slate-300 h-28 overflow-hidden relative shadow-inner">
                   {isMasking || isScramblingUA ? (
                     <div className="break-all tracking-widest italic text-brand-400 font-black animate-pulse">
                        {scrambleText}
                     </div>
                   ) : (
                     <div className="flex flex-col gap-2">
                        <span className="text-white font-black text-xs uppercase tracking-wider">{identity.userAgentShort}</span>
                        <span className="opacity-40 text-[9px] line-clamp-2 leading-tight">{currentUAData.full}</span>
                     </div>
                   )}
                   <div className="absolute bottom-2 right-4 flex items-center gap-1.5 opacity-40">
                      <Binary className="w-3.5 h-3.5" />
                      <span className="text-[7px] font-black uppercase tracking-widest">UA_Bitstream_Active</span>
                   </div>
                </div>
             </div>

             {/* Component Card: Hardware MAC */}
             <div 
                onClick={() => !isMasking && onScrambleMac?.()}
                className={`glass-card p-6 rounded-[2.5rem] border transition-all duration-500 flex flex-col justify-between h-64 relative overflow-hidden group/card ${isMasking ? 'border-brand-500 bg-brand-500/5' : 'border-slate-800 bg-black/40 hover:border-slate-700 hover:scale-[1.01] cursor-pointer'}`}
             >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                       <div className={`p-3 rounded-2xl bg-slate-900 ${theme.secondary}`}>
                           <Cpu className="w-6 h-6" />
                       </div>
                       <div className="flex flex-col">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hardware_Spoof</span>
                           <span className={`text-[9px] font-mono font-black ${theme.secondary}`}>[ PHYSICAL_SYNC_SPOOF ]</span>
                       </div>
                    </div>
                    <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/5 shadow-xl">
                        {['standard', 'hyphen', 'cisco'].map((fmt) => (
                            <button
                                key={fmt}
                                onClick={(e) => { e.stopPropagation(); !isMaskingDisabled && onFormatChange?.(fmt as any); }}
                                disabled={isMaskingDisabled}
                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all uppercase tracking-tighter ${macFormat === fmt ? 'bg-white text-black shadow-md' : 'text-slate-500 hover:text-white'}`}
                            >
                                {fmt.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center gap-5">
                   <div className="text-4xl font-mono font-black text-white tracking-[0.25em] relative group/mac transition-all duration-300 group-hover/card:scale-105">
                      {isRotating ? (
                        <div className="flex gap-2 animate-glitch text-brand-500">
                           <span>XX</span>:<span>XX</span>:<span>XX</span>
                        </div>
                      ) : identity.mac}
                      {!isMasking && isConnected && (
                         <div className="absolute -right-14 opacity-0 group-hover/card:opacity-100 p-2 text-brand-500 hover:scale-125 transition-all drop-shadow-[0_0_80px_rgba(6,182,212,0.4)]">
                            <RefreshCw className="w-6 h-6" />
                         </div>
                      )}
                   </div>
                   <div className="w-full flex items-center justify-between px-4 border-t border-white/5 pt-4">
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor_Sig:</span>
                         <span className={`text-[10px] font-black uppercase text-slate-200`}>{getMacVendor(identity.mac)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                         <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                         SYNC_VALID
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Bottom Tactical Readouts */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-white/5 pt-10">
             <div className="flex flex-col sm:flex-row items-center gap-10">
                <div className="flex items-center gap-4 group/stat">
                   <div className="p-2.5 bg-slate-800 rounded-xl group-hover/stat:bg-slate-700 transition-colors">
                       <BarChart3 className="w-5 h-5 text-slate-400" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Identity_Safety</span>
                      <span className={`text-sm font-black font-mono ${theme.primary}`}>0.992 / 1.000</span>
                   </div>
                </div>
                <div className="flex items-center gap-4 group/stat">
                   <div className="p-2.5 bg-slate-800 rounded-xl group-hover/stat:bg-slate-700 transition-colors">
                       <Layers className="w-5 h-5 text-slate-400" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Shield_Layers</span>
                      <span className="text-sm font-black font-mono text-slate-300">
                        {isOnion ? '12-WRAP-VORTEX' : isSmartDNS ? 'DNS-SECURE-HTTPS' : 'AES-256-GCM'}
                      </span>
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-5">
                <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl border border-white/5 group/ai hover:border-amber-500/40 transition-all cursor-help">
                   <Zap className="w-4 h-4 text-amber-500 group-hover:scale-125 transition-transform duration-500" />
                   <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">RNC Engine v4.5</span>
                       <span className="text-[11px] font-black text-slate-300 uppercase">Neural_Decision Active</span>
                   </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all">
                   <Lock className="w-4 h-4" />
                   <div className="flex flex-col">
                       <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Vault_Access</span>
                       <span className="text-[11px] font-black tracking-widest uppercase">Zero_Log Tunnel</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
