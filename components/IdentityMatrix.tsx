
import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { REALISTIC_USER_AGENTS } from '../constants';
import { 
  Globe, Monitor, Network, ShieldCheck, Pin, Building2, 
  Copy, Check, Activity, X, Users, MapPin, Coins, 
  CloudSun, Zap, Database, ShieldOff, RefreshCw, Ghost, AlertCircle, Fingerprint, Info, BarChart3,
  Loader2, Terminal, ShieldAlert, ZapOff, Clock, ShieldEllipsis, Cpu
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

  useEffect(() => {
    if (isMasking) setHasMaskedOnce(true);
  }, [isMasking]);

  const handleCopyIp = () => {
    if (isRotating) return;
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const openCityDetails = () => {
    if (isRotating) return;
    setIsFetchingCity(true);
    // Simulation de récupération de données
    setTimeout(() => {
      setIsFetchingCity(false);
      setShowCityDetails(true);
    }, 600);
  };

  const getCityDetails = (city: string) => {
    const data: Record<string, any> = {
      'Paris': { pop: '2.16M', region: 'Île-de-France', currency: 'Euro (€)', weather: '14°C Nuageux', isp: 'Orange Cyberdefense', time: 'UTC+1', reputation: '98%' },
      'Zürich': { pop: '402K', region: 'Canton de Zurich', currency: 'Franc Suisse (CHF)', weather: '10°C Pluvieux', isp: 'Swisscom Private', time: 'UTC+1', reputation: '99%' },
      'Singapore': { pop: '5.6M', region: 'Central Region', currency: 'Dollar (SGD)', weather: '31°C Humide', isp: 'Singtel Secure', time: 'UTC+8', reputation: '94%' },
      'Reykjavik': { pop: '131K', region: 'Höfuðborgarsvæðið', currency: 'Couronne (ISK)', weather: '4°C Vent', isp: 'Arctic Fibers', time: 'UTC+0', reputation: '99%' },
      'Panama City': { pop: '880K', region: 'Panamá', currency: 'Balboa (PAB)', weather: '29°C Ensoleillé', isp: 'LatAm Secure Gateway', time: 'UTC-5', reputation: '89%' },
      'Tallinn': { pop: '426K', region: 'Harju', currency: 'Euro (€)', weather: '8°C Variable', isp: 'E-stonia Cloud', time: 'UTC+2', reputation: '97%' },
    };
    return data[city] || { pop: '150K+', region: 'District Local', currency: 'Global', weather: 'Stable', isp: 'Générique', time: 'UTC', reputation: '95%' };
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

  const isSmartDns = mode === ConnectionMode.SMART_DNS;
  const isMaskingDisabled = !isConnected || isSmartDns || isRotating || isMasking;

  const getMaskingButtonTitle = () => {
    if (!isConnected) return "Connectez-vous au VPN pour activer le masquage.";
    if (isSmartDns) return "Le mode Smart DNS ne supporte pas le masquage matériel.";
    if (isRotating) return "Rotation IP en cours...";
    if (isMasking) return "Génération de l'identité...";
    return "Modifier aléatoirement vos identifiants navigateurs et matériels.";
  };

  const isLAA = (mac: string) => {
      const clean = mac.replace(/[:.-]/g, '');
      const secondNibble = clean[1]?.toUpperCase();
      return ['2', '6', 'A', 'E'].includes(secondNibble);
  };

  return (
    <div className="space-y-4 relative">
      {/* Modal Détails Ville (City Intelligence) */}
      {showCityDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowCityDetails(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 text-white relative">
                    <button onClick={() => setShowCityDetails(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
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
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <Users className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Population</span>
                            </div>
                            <div className="font-mono font-bold text-slate-700 dark:text-slate-200">{cityInfo.pop}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <CloudSun className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Météo</span>
                            </div>
                            <div className="font-bold text-slate-700 dark:text-slate-200">{cityInfo.weather}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <Clock className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Heure</span>
                            </div>
                            <div className="font-mono font-bold text-slate-700 dark:text-slate-200">{cityInfo.time}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                <ShieldEllipsis className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Fiabilité</span>
                            </div>
                            <div className="font-bold text-emerald-500">{cityInfo.reputation}</div>
                        </div>
                    </div>

                    <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-500">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                <span className="font-bold uppercase tracking-wider text-[10px]">Territoire</span>
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{cityInfo.region}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Coins className="w-4 h-4 text-amber-500" />
                                <span className="font-bold uppercase tracking-wider text-[10px]">Devise</span>
                            </div>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{cityInfo.currency}</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setShowCityDetails(false)}
                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] mt-2 transition-transform active:scale-95 shadow-xl"
                    >
                        Clôturer le rapport
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

        {/* Location Card (Cliquable pour les détails de la ville) */}
        <div 
          onClick={openCityDetails}
          className={`bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all active:scale-[0.98] relative overflow-hidden ${isRotating ? 'opacity-50 cursor-wait' : 'cursor-pointer group hover:border-blue-500 shadow-sm'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-brand-500" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Passerelle de Sortie</span>
            </div>
            <div className="flex items-center gap-1.5">
                {isFetchingCity ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                ) : (
                    <div className="flex items-center gap-1 text-[9px] font-black text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">
                        Données <Info className="w-3 h-3" />
                    </div>
                )}
            </div>
          </div>
          <div className={`font-bold truncate text-sm flex items-center gap-2 ${isRotating ? 'text-brand-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            <Pin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="border-b border-dotted border-slate-300 dark:border-slate-700 group-hover:border-blue-500 group-hover:text-blue-500 transition-colors">
                {identity.city}, {identity.country}
            </span>
          </div>
        </div>

        {/* Dedicated Masking Section */}
        <div className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border transition-all md:col-span-2 relative overflow-hidden ${isMasking ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-indigo-500/5' : 'border-slate-200 dark:border-slate-800 shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl transition-all ${isMasking ? 'bg-indigo-500/20 text-indigo-500' : 'bg-blue-700 text-white'}`}>
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
            
            <div className="relative group/btn">
              <button 
                  onClick={(e) => { e.stopPropagation(); onMask?.(); }}
                  disabled={isMaskingDisabled}
                  title={getMaskingButtonTitle()}
                  className={`flex items-center justify-center gap-3 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                      isMasking 
                          ? 'bg-indigo-500 text-white shadow-indigo-500/40' 
                          : isMaskingDisabled
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                              : 'bg-blue-700 text-white hover:bg-blue-800 shadow-blue-700/20'
                  }`}
              >
                  {isMasking ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
                  {isMasking ? 'SÉCURISATION...' : 'MASQUER L\'EMPREINTE'}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Agent Console */}
            <div className={`bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border transition-colors ${isMasking ? 'border-indigo-500/30' : 'border-slate-200/50 dark:border-slate-800/50'}`}>
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between mb-3 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-brand-500" />
                    <span>Browser Fingerprint</span>
                  </div>
                  {isMasking && <span className="text-indigo-500 animate-pulse text-[8px] font-black">SPOOFING...</span>}
              </div>
              <div className={`text-xs font-mono font-medium break-all leading-relaxed h-12 overflow-hidden ${isMasking ? 'text-indigo-500 blur-[1px] animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? 'RENUMERATING...' : currentUAData.full}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <Monitor className="w-3 h-3 text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">OS: {(isMasking || isRotating) ? '???' : currentUAData.os}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <Cpu className="w-3 h-3 text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">Build: {(isMasking || isRotating) ? '00000.0000' : currentUAData.build}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <Zap className="w-3 h-3 text-brand-500" />
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{(isMasking || isRotating) ? 'Engine/???' : currentUAData.engine}</span>
                  </div>
              </div>
            </div>
            
            {/* MAC Console */}
            <div className={`bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border transition-colors ${isMasking ? 'border-indigo-500/30' : 'border-slate-200/50 dark:border-slate-800/50'}`}>
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between mb-3 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-3.5 h-3.5 text-brand-500" />
                    <span>Hardware Descriptor</span>
                  </div>
                  {isMasking && <span className="text-indigo-500 animate-pulse text-[8px] font-black">SCRAMBLING...</span>}
              </div>
              <div className={`text-sm sm:text-lg font-mono font-black tracking-widest h-12 flex items-center ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? '---' : identity.mac}
              </div>
              <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-3.5 h-3.5 ${isLAA(identity.mac) ? 'text-blue-500' : 'text-emerald-500'}`} />
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                        {isLAA(identity.mac) ? 'IEEE 802.3 LAA' : 'Vendor Assigned'}
                    </span>
                  </div>
                  <div className="text-[8px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    INT-EMULATED
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
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Latence Gateway</span>
                <div className={`font-mono text-xl font-black ${getLatencyColor(identity.latency)}`}>
                    {identity.latency}ms
                </div>
             </div>
             <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Statut de la Signature</span>
                <div className="text-sm font-bold text-emerald-500 flex items-center gap-1 justify-end">
                  <ShieldCheck className="w-3.5 h-3.5" /> CERTIFIÉ INDÉTECTABLE
                </div>
             </div>
          </div>
        </div>
      </div>

      {securityReport && (
        <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Verdict de l'Expert IA</h4>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-black ${securityReport.score > 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    CONFIANCE : {securityReport.score}%
                </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed border-l-2 border-slate-300 dark:border-slate-700 pl-4">
                "{securityReport.analysis}"
            </p>
        </div>
      )}
    </div>
  );
};
