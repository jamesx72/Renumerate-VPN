
import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Monitor, Network, ShieldCheck, Pin, Building2, 
  Copy, Check, Activity, X, Users, MapPin, 
  CloudSun, Ghost, Fingerprint, Info, 
  Loader2, Terminal, ShieldAlert, Clock, ShieldEllipsis, Cpu, Globe2, Chrome, CloudRain, Sun, Cloud,
  Map as MapIcon, Coins, Thermometer
} from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  entryIdentity: VirtualIdentity | null;
  isRotating: boolean;
  isMasking?: boolean;
  mode: ConnectionMode;
  securityReport?: SecurityReport | null;
  onMask?: () => void;
  isConnected?: boolean;
}

export const IdentityMatrix: React.FC<Props> = ({ 
  identity, 
  isRotating, 
  isMasking = false, 
  mode, 
  securityReport, 
  onMask,
  isConnected = false
}) => {
  const [copiedIp, setCopiedIp] = useState(false);
  const [showCityDetails, setShowCityDetails] = useState(false);
  const [isFetchingCity, setIsFetchingCity] = useState(false);
  const [hasMaskedOnce, setHasMaskedOnce] = useState(false);
  const [localTime, setLocalTime] = useState<string>('');

  useEffect(() => {
    if (isMasking) setHasMaskedOnce(true);
  }, [isMasking]);

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

  const openCityDetails = () => {
    if (isRotating) return;
    setIsFetchingCity(true);
    setTimeout(() => {
      setIsFetchingCity(false);
      setShowCityDetails(true);
    }, 600);
  };

  const getCityDetails = (city: string) => {
    const data: Record<string, any> = {
      'Paris': { pop: '2.16M', region: 'Île-de-France', currency: 'Euro (€)', weather: '14°C Nuageux', icon: <Cloud className="w-3.5 h-3.5" />, isp: 'Orange Cyberdefense', reputation: '98%' },
      'Zürich': { pop: '402K', region: 'Canton de Zurich', currency: 'Franc Suisse (CHF)', weather: '10°C Pluvieux', icon: <CloudRain className="w-3.5 h-3.5" />, isp: 'Swisscom Private', reputation: '99%' },
      'Singapore': { pop: '5.6M', region: 'Central Region', currency: 'Dollar (SGD)', weather: '31°C Humide', icon: <Sun className="w-3.5 h-3.5" />, isp: 'Singtel Secure', reputation: '94%' },
      'Reykjavik': { pop: '131K', region: 'Höfuðborgarsvæðið', currency: 'Couronne (ISK)', weather: '4°C Vent', icon: <CloudRain className="w-3.5 h-3.5" />, isp: 'Arctic Fibers', reputation: '99%' },
      'Panama City': { pop: '880K', region: 'Panamá', currency: 'Balboa (PAB)', weather: '29°C Ensoleillé', icon: <Sun className="w-3.5 h-3.5" />, isp: 'LatAm Secure Gateway', reputation: '89%' },
      'Tallinn': { pop: '426K', region: 'Harju', currency: 'Euro (€)', weather: '8°C Variable', icon: <Cloud className="w-3.5 h-3.5" />, isp: 'E-stonia Cloud', reputation: '97%' },
    };
    return data[city] || { pop: '150K+', region: 'District Local', currency: 'Global (USD)', weather: 'Stable', icon: <Sun className="w-3.5 h-3.5" />, isp: 'Générique', reputation: '95%' };
  };

  const cityInfo = getCityDetails(identity.city);
  
  const getLatencyColor = (ms: number) => {
      if (ms < 50) return 'text-emerald-500';
      if (ms < 120) return 'text-amber-500';
      return 'text-red-500';
  };

  const currentUAData = REALISTIC_USER_AGENTS.find(ua => ua.short === identity.userAgentShort) || {
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    os: 'Detecting...',
    browser: identity.userAgentShort,
    build: 'N/A',
    engine: 'Blink/WebKit',
    preciseVersion: '124.0.0.0'
  };

  const isLAA = (mac: string) => {
      const clean = mac.replace(/[:.-]/g, '');
      const secondNibble = clean[1]?.toUpperCase();
      return ['2', '6', 'A', 'E'].includes(secondNibble);
  };

  const getMacVendor = (mac: string) => {
      if (isLAA(mac)) return "Privé (Masqué)";
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
      return vendors[prefix] || "Constructeur Inconnu";
  };

  const isSmartDns = mode === ConnectionMode.SMART_DNS;
  const isMaskingDisabled = !isConnected || isSmartDns || isRotating || isMasking;

  return (
    <div className="space-y-4 relative">
      {/* Modal Détails Ville */}
      {showCityDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowCityDetails(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-gradient-to-br from-brand-600 via-indigo-700 to-slate-900 text-white relative">
                    <button onClick={() => setShowCityDetails(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-xl font-black leading-none uppercase tracking-tight">{identity.city}</h4>
                            <p className="text-white/60 text-[10px] font-bold flex items-center gap-1.5 mt-2 uppercase tracking-[0.2em]">
                                <Globe className="w-3 h-3" /> {identity.country}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <Users className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Population</span>
                            </div>
                            <div className="font-mono font-bold text-slate-700 dark:text-slate-200">{cityInfo.pop}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <MapIcon className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Région</span>
                            </div>
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">{cityInfo.region}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <Thermometer className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Météo</span>
                            </div>
                            <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                {cityInfo.icon} {cityInfo.weather}
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <Clock className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Heure Locale</span>
                            </div>
                            <div className="font-mono font-bold text-slate-700 dark:text-slate-200">{localTime}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <Coins className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Devise</span>
                            </div>
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-xs">{cityInfo.currency}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <ShieldEllipsis className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Fiabilité</span>
                            </div>
                            <div className="font-bold text-emerald-500">{cityInfo.reputation}</div>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-brand-500/5 rounded-2xl border border-brand-500/10">
                        <div className="text-[9px] font-black uppercase tracking-widest text-brand-500 mb-1 flex items-center gap-2">
                           <Network className="w-3 h-3" /> Nœud ISP : {cityInfo.isp}
                        </div>
                        <p className="text-[10px] text-slate-500 italic">Passerelle de sortie certifiée et auditée par Renumerate.</p>
                    </div>

                    <button 
                        onClick={() => setShowCityDetails(false)}
                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] mt-2 transition-all active:scale-95 shadow-xl hover:shadow-brand-500/10"
                    >
                        Fermer le rapport urbain
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Matrix Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IP Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Network className="w-4 h-4 text-brand-500" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Adresse IP</span>
            </div>
            {copiedIp && <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">Copié</span>}
          </div>
          <div className="flex items-center justify-between">
            <div className={`font-mono text-lg font-bold tracking-wider ${isRotating ? 'text-brand-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
               {isRotating ? 'RENUM...' : (isSmartDns ? 'LOCAL IP' : identity.ip)}
            </div>
            {!isRotating && (
              <button onClick={handleCopyIp} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-500 transition-all">
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Location Card (Cliquable) */}
        <div 
          onClick={openCityDetails}
          className={`bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all active:scale-[0.98] relative overflow-hidden group shadow-sm ${
            isRotating ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-brand-500 hover:ring-2 hover:ring-brand-500/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-brand-500" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Passerelle de Sortie</span>
            </div>
            <div className="flex items-center gap-1.5">
                {isFetchingCity ? <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" /> : <div className="text-[9px] font-black text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Détails <Info className="w-3 h-3" /></div>}
            </div>
          </div>
          <div className={`font-bold truncate text-sm flex items-center gap-2 ${isRotating ? 'text-brand-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            <Pin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="border-b border-dotted border-slate-300 dark:border-slate-700 group-hover:border-brand-500 group-hover:text-brand-600 transition-all">
                {identity.city}, {identity.country}
            </span>
          </div>
        </div>

        {/* Dedicated Masking Section */}
        <div className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border transition-all md:col-span-2 relative overflow-hidden ${isMasking ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-indigo-500/5' : 'border-slate-200 dark:border-slate-800 shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl transition-all ${isMasking ? 'bg-indigo-500/20 text-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(8,145,178,0.3)]'}`}>
                <Ghost className={`w-6 h-6 ${isMasking ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Footprint Protection</span>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${hasMaskedOnce && isConnected ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {hasMaskedOnce && isConnected ? 'MASQUÉ' : 'VULNÉRABLE'}
                  </div>
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Masquage de l'empreinte</h4>
              </div>
            </div>
            
            <button 
                onClick={(e) => { e.stopPropagation(); onMask?.(); }}
                disabled={isMaskingDisabled}
                className={`flex items-center justify-center gap-3 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                    isMasking ? 'bg-indigo-500 text-white shadow-indigo-500/40' : isMaskingDisabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
            >
                {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
                {isMasking ? 'SÉCURISATION...' : 'MASQUER L\'EMPREINTE'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Agent Console */}
            <div className={`bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border transition-colors ${isMasking ? 'border-indigo-500/30' : 'border-slate-200/50 dark:border-slate-800/50'}`}>
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between mb-3 uppercase tracking-widest">
                  <div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-brand-500" /><span>Browser Fingerprint</span></div>
                  {isMasking && <span className="text-indigo-500 animate-pulse text-[8px] font-black">SPOOFING...</span>}
              </div>
              <div className={`text-xs font-mono font-medium break-all leading-relaxed h-12 overflow-hidden ${isMasking ? 'text-indigo-500 blur-[1px] animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? 'RENUMERATING...' : currentUAData.full}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><Monitor className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate">OS: {(isMasking || isRotating) ? '???' : currentUAData.os}</span></div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><Chrome className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate">App: {(isMasking || isRotating) ? '???' : currentUAData.browser}</span></div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><Cpu className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate">Bld: {(isMasking || isRotating) ? '0.0' : currentUAData.build}</span></div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><Activity className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate">Eng: {(isMasking || isRotating) ? '???' : currentUAData.engine}</span></div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2"><Globe2 className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 truncate">Ver: {(isMasking || isRotating) ? '0.0.0.0' : currentUAData.preciseVersion}</span></div>
              </div>
            </div>
            
            {/* MAC Console */}
            <div className={`bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border transition-colors ${isMasking ? 'border-indigo-500/30' : 'border-slate-200/50 dark:border-slate-800/50'}`}>
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between mb-3 uppercase tracking-widest">
                  <div className="flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5 text-brand-500" /><span>Hardware Descriptor</span></div>
                  {isMasking && <span className="text-indigo-500 animate-pulse text-[8px] font-black">SCRAMBLING...</span>}
              </div>
              <div className={`text-sm sm:text-lg font-mono font-black tracking-widest h-12 flex items-center ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? '---' : identity.mac}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`w-3.5 h-3.5 ${isLAA(identity.mac) ? 'text-blue-500' : 'text-emerald-500'}`} />
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                          {isLAA(identity.mac) ? 'IEEE 802.3 LAA' : 'Vendor Assigned'}
                      </span>
                    </div>
                    <div className="text-[8px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {getMacVendor(identity.mac).toUpperCase()}
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] text-slate-500 leading-tight">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Protection MAC :</span> {isLAA(identity.mac) ? "Masquage matériel actif. Empêche l'identification physique par les routeurs." : "Identifiant matériel standard (Cisco/IEEE). Recommandé pour la stabilité pro."}
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network Metrics */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm md:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-4 h-4 text-brand-500" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Métriques de Session</span>
          </div>
          <div className="flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Latence Passerelle</span>
                <div className={`font-mono text-xl font-black ${getLatencyColor(identity.latency)}`}>{identity.latency}ms</div>
             </div>
             <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Heure du Nœud</span>
                <div className="text-sm font-bold text-emerald-500 flex items-center gap-1.5 justify-end font-mono">
                    <Clock className="w-3.5 h-3.5" /> {localTime}
                </div>
             </div>
          </div>
        </div>
      </div>

      {securityReport && (
        <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /><h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Verdict de l'Expert IA</h4></div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-black ${securityReport.score > 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>CONFIANCE : {securityReport.score}%</div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed border-l-2 border-slate-300 dark:border-slate-700 pl-4">"{securityReport.analysis}"</p>
        </div>
      )}
    </div>
  );
};
