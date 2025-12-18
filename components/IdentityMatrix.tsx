import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { 
  Globe, Monitor, Network, ShieldCheck, Pin, Building2, 
  Copy, Check, Activity, X, Users, MapPin, Coins, 
  CloudSun, Zap, Database, ShieldOff, RefreshCw, Ghost, AlertCircle, Fingerprint, Info, BarChart3,
  Loader2
} from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  entryIdentity: VirtualIdentity | null;
  isRotating: boolean;
  isMasking?: boolean;
  mode: ConnectionMode;
  securityReport?: SecurityReport | null;
  protocol?: string;
  obfuscationLevel?: 'standard' | 'high' | 'ultra';
  dnsProvider?: string;
  onOpenObfuscationSettings?: () => void;
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
  const [localLatency, setLocalLatency] = useState(identity.latency);
  const [showCityDetails, setShowCityDetails] = useState(false);

  useEffect(() => {
    setLocalLatency(identity.latency);
  }, [identity.latency]);

  const handleCopyIp = () => {
    if (isRotating) return;
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const getCityDetails = (city: string) => {
    const data: Record<string, any> = {
      'Paris': { pop: '2.16M', region: 'Île-de-France', currency: 'Euro (€)', weather: '14°C Nuageux', isp: 'Orange Cyberdefense', load: '42%' },
      'Zürich': { pop: '402K', region: 'Canton de Zurich', currency: 'Franc Suisse (CHF)', weather: '10°C Pluvieux', isp: 'Swisscom Private', load: '18%' },
      'Singapore': { pop: '5.6M', region: 'Central Region', currency: 'Dollar (SGD)', weather: '31°C Humide', isp: 'Singtel Secure', load: '65%' },
      'Reykjavik': { pop: '131K', region: 'Höfuðborgarsvæðið', currency: 'Couronne (ISK)', weather: '4°C Vent', isp: 'Arctic Fibers', load: '12%' },
      'Panama City': { pop: '880K', region: 'Panamá', currency: 'Balboa (PAB)', weather: '29°C Ensoleillé', isp: 'LatAm Secure Gateway', load: '38%' },
      'Tallinn': { pop: '426K', region: 'Harju', currency: 'Euro (€)', weather: '8°C Variable', isp: 'E-stonia Cloud', load: '24%' },
    };
    return data[city] || { pop: 'Inconnu', region: 'Inconnu', currency: 'USD', weather: '--', isp: 'Générique', load: 'N/A' };
  };

  const cityInfo = getCityDetails(identity.city);
  
  const getLatencyColor = (ms: number) => {
      if (ms < 50) return 'text-emerald-500';
      if (ms < 120) return 'text-amber-500';
      return 'text-red-500';
  };

  const getMacFormatBadge = (mac: string) => {
      if (mac.includes(':')) return 'IEEE 802';
      if (mac.includes('-')) return 'Legacy/Win';
      if (mac.includes('.')) return 'Cisco/Dot';
      return 'Standard';
  };

  const isMaskingDisabled = !isConnected || mode === ConnectionMode.SMART_DNS || isRotating || isMasking;

  return (
    <div className="space-y-4 relative">
      {/* Modal Détails Ville */}
      {showCityDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowCityDetails(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-gradient-to-br from-brand-500 to-indigo-600 text-white relative">
                    <button onClick={() => setShowCityDetails(false)} className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-xl font-black leading-none">{identity.city}</h4>
                            <p className="text-white/70 text-xs font-medium flex items-center gap-1 mt-1">
                                <Globe className="w-3 h-3" /> {identity.country}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                                <Users className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Population</span>
                            </div>
                            <div className="font-mono font-bold text-slate-700 dark:text-slate-200">{cityInfo.pop}</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                                <CloudSun className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Météo</span>
                            </div>
                            <div className="font-bold text-slate-700 dark:text-slate-200">{cityInfo.weather}</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-slate-500">
                                <MapPin className="w-4 h-4 text-brand-500" />
                                <span className="font-medium">Région</span>
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{cityInfo.region}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Coins className="w-4 h-4 text-amber-500" />
                                <span className="font-medium">Devise</span>
                            </div>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{cityInfo.currency}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">Données Géo-ID Chiffrées</p>
                </div>
            </div>
        </div>
      )}

      {/* Grid Matrix UI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IP Block */}
        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-xl border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Network className="w-4 h-4 text-brand-500" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Adresse IP</span>
            </div>
            {copiedIp && <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">Copié</span>}
          </div>
          <div className="flex items-center justify-between">
            <div className={`font-mono text-lg font-bold tracking-wider ${isRotating ? 'text-brand-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
               {isRotating ? 'RENUM...' : (mode === ConnectionMode.SMART_DNS ? 'LOCAL IP' : identity.ip)}
            </div>
            {!isRotating && (
              <button onClick={handleCopyIp} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-500 transition-all">
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Location Block */}
        <div 
          onClick={() => !isRotating && setShowCityDetails(true)}
          className="bg-white dark:bg-brand-800/50 p-4 rounded-xl border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-sm cursor-pointer group hover:border-brand-500 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-brand-500" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Localisation</span>
            </div>
            <Info className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors" />
          </div>
          <div className={`font-bold truncate text-sm flex items-center gap-2 ${isRotating ? 'text-brand-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            <Pin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="border-b border-dotted border-slate-300 dark:border-slate-700 group-hover:border-brand-500 transition-colors">
                {identity.city}, {identity.country}
            </span>
          </div>
        </div>

        {/* Protection Block - Footprint Masking Section */}
        <div className={`bg-white dark:bg-brand-800/50 p-5 rounded-2xl border transition-all md:col-span-2 relative overflow-hidden ${isMasking ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 dark:border-brand-500/20 shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isMasking ? 'bg-indigo-500/20 text-indigo-500' : 'bg-brand-500/10 text-brand-500'}`}>
                <Monitor className={`w-5 h-5 ${isMasking ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">Protection Matérielle</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Masquage d'Empreinte
                    {isMasking && <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>}
                </h4>
              </div>
            </div>
            
            <button 
                onClick={(e) => { e.stopPropagation(); onMask?.(); }}
                disabled={isMaskingDisabled}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 ${
                    isMasking 
                        ? 'bg-indigo-500 text-white shadow-indigo-500/40' 
                        : isMaskingDisabled
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'
                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:shadow-brand-500/20'
                }`}
                title={!isConnected ? "Activez le VPN pour masquer" : mode === ConnectionMode.SMART_DNS ? "Indisponible en mode Smart DNS" : "Régénérer une nouvelle identité logicielle et matérielle"}
            >
                {/* Loader2 icon for masking state */}
                {isMasking ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === ConnectionMode.SMART_DNS ? <ShieldOff className="w-4 h-4" /> : <Ghost className="w-4 h-4" />}
                {isMasking ? 'Masquage...' : 'Masquer l\'empreinte'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200/50 dark:border-slate-800/50 group/item">
              <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between mb-2 uppercase tracking-widest">
                  <span>User Agent Actif</span>
                  <Fingerprint className="w-3 h-3 text-slate-300 group-hover/item:text-brand-500 transition-colors" />
              </div>
              <div className={`text-xs font-mono font-bold break-all leading-relaxed ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? '...' : identity.userAgentShort}
              </div>
              <div className="mt-2 text-[8px] text-slate-400 font-medium">Signature : Mozilla/5.0 (Compatible)</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200/50 dark:border-slate-800/50 group/item relative">
              <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between mb-2 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <span>Adresse MAC Spoofée</span>
                    <span className="text-[8px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                        {getMacFormatBadge(identity.mac)}
                    </span>
                  </div>
                  {!isMaskingDisabled && (
                      <button onClick={onMask} className="hover:text-brand-500 transition-colors">
                          <RefreshCw className="w-3 h-3" />
                      </button>
                  )}
              </div>
              <div className={`text-sm font-mono font-black tracking-[0.1em] ${isMasking ? 'text-indigo-500 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? '...' : identity.mac}
              </div>
              <div className="mt-2 text-[8px] text-slate-400 font-medium uppercase tracking-widest">Bit LAA : Actif (Administré Localement)</div>
            </div>
          </div>

          {isMasking && (
              <div className="absolute inset-0 pointer-events-none bg-indigo-500/5 animate-pulse"></div>
          )}
        </div>

        {/* Performances Block */}
        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-xl border border-slate-200 dark:border-brand-500/20 shadow-sm md:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-4 h-4 text-brand-500" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Performances Réseau</span>
          </div>
          <div className="flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Ping Gateway</span>
                <div className={`font-mono text-xl font-black ${getLatencyColor(identity.latency)}`}>
                    {identity.latency}ms
                </div>
             </div>
             <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Stabilité du Tunnel</span>
                <div className="text-sm font-bold text-emerald-500 flex items-center gap-1 justify-end">
                  <Check className="w-3 h-3" /> FLUX OPTIMAL
                </div>
             </div>
          </div>
        </div>
      </div>

      {securityReport && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Rapport d'Analyse IA</h4>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-black ${securityReport.score > 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    CONFiance : {securityReport.score}%
                </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 italic mb-2 leading-relaxed">
                "{securityReport.analysis}"
            </p>
        </div>
      )}
    </div>
  );
};
