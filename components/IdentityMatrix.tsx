import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { 
  Globe, Monitor, Network, ShieldCheck, Pin, Building2, 
  Copy, Check, Activity, X, Users, MapPin, Coins, 
  CloudSun, Zap, Database, ShieldOff, RefreshCw, Ghost, AlertCircle, Fingerprint, Info, BarChart3
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
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [showCityDetails, setShowCityDetails] = useState(false);

  // Synchronise la latence locale si l'identité change
  useEffect(() => {
    setLocalLatency(identity.latency);
  }, [identity.latency]);

  const handleCopyIp = () => {
    if (isRotating) return;
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handleLatencyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMeasuring || isRotating) return;
    setIsMeasuring(true);
    setTimeout(() => {
        const newLatency = Math.floor(Math.random() * 140) + 10;
        setLocalLatency(newLatency);
        setIsMeasuring(false);
    }, 1500);
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

  // Logique d'activation du bouton de masquage
  const isMaskingDisabled = !isConnected || mode === ConnectionMode.SMART_DNS || isRotating || isMasking;

  return (
    <div className="space-y-4 relative">
      {/* Modal Détails Ville - Geo-Context Popup */}
      {showCityDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowCityDetails(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header de la modal */}
                <div className="p-6 bg-gradient-to-br from-brand-500 to-indigo-600 text-white relative">
                    <button 
                        onClick={() => setShowCityDetails(false)}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
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
                
                {/* Grille d'infos de la ville */}
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
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Database className="w-4 h-4 text-indigo-500" />
                                <span className="font-medium">ISP Virtuel</span>
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cityInfo.isp}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-slate-500">
                                <BarChart3 className="w-4 h-4 text-emerald-500" />
                                <span className="font-medium">Charge Serveur</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: cityInfo.load }}></div>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">{cityInfo.load}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">Données Géo-ID Chiffrées</p>
                </div>
            </div>
        </div>
      )}

      {/* Grille Principale IdentityMatrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Bloc Localisation - Cliquable pour détails */}
        <div 
          onClick={() => !isRotating && setShowCityDetails(true)}
          className="bg-white dark:bg-brand-800/50 p-4 rounded-xl border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-sm cursor-pointer group hover:border-brand-500 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-brand-500" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Localisation</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-full">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[8px] font-black text-emerald-600 uppercase">Live</span>
            </div>
          </div>
          <div className={`font-bold truncate text-sm flex items-center justify-between ${isRotating ? 'text-brand-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            <div className="flex items-center gap-2 truncate">
                <Pin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="border-b border-dotted border-slate-300 dark:border-slate-700 group-hover:border-brand-500 transition-colors">
                    {identity.city}, {identity.country}
                </span>
            </div>
            <Info className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors" />
          </div>
        </div>

        {/* Masquage de l'empreinte numérique */}
        <div className={`bg-white dark:bg-brand-800/50 p-4 rounded-xl border border-slate-200 dark:border-brand-500/20 transition-all relative overflow-hidden ${isMasking ? 'ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/10' : 'shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isMasking ? 'bg-indigo-500/20 text-indigo-500' : 'bg-brand-500/10 text-brand-500'}`}>
                <Monitor className={`w-4 h-4 ${isMasking ? 'animate-pulse' : ''}`} />
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Protection Empreinte</span>
            </div>
            
            {onMask && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onMask(); }}
                  disabled={isMaskingDisabled}
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-tight transition-all flex items-center gap-2 group/mask shadow-sm ${
                    isMasking 
                        ? 'bg-indigo-500 border-indigo-500 text-white shadow-indigo-500/20' 
                        : isMaskingDisabled
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-300 cursor-not-allowed opacity-50'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-500 hover:shadow-md'
                  }`}
                  title={!isConnected ? "Activez le VPN pour masquer" : mode === ConnectionMode.SMART_DNS ? "Indisponible en Smart DNS" : "Masquer l'empreinte numérique"}
                >
                    {isMasking ? (
                        <Zap className="w-3.5 h-3.5 animate-pulse" />
                    ) : mode === ConnectionMode.SMART_DNS ? (
                        <ShieldOff className="w-3.5 h-3.5" />
                    ) : (
                        <Ghost className="w-3.5 h-3.5 group-hover/mask:animate-bounce" />
                    )}
                    <span>
                        {isMasking ? 'MASQUAGE...' : "Masquer l'empreinte"}
                    </span>
                </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/50">
              <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between mb-1">
                  <span>USER AGENT</span>
                  {isMasking && <span className="text-indigo-500 animate-pulse text-[8px] font-bold">ACTIF</span>}
              </div>
              <div className={`text-[11px] font-bold truncate transition-colors ${isMasking ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? '---' : identity.userAgentShort}
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/50 group/mac relative">
              <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between mb-1">
                  <span>ADRESSE MAC (LAA SPOOFED)</span>
                  {isMasking && (
                      <div className="flex items-center gap-1">
                          <span className="text-indigo-500 animate-pulse text-[8px] font-bold">MODIFIÉ</span>
                          <button 
                              onClick={(e) => { e.stopPropagation(); onMask?.(); }}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-indigo-500"
                              title="Générer un autre format/adresse"
                          >
                              <RefreshCw className="w-2.5 h-2.5" />
                          </button>
                      </div>
                  )}
              </div>
              <div className={`text-[11px] font-mono font-bold transition-colors ${isMasking ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isRotating ? '---' : identity.mac}
              </div>
            </div>
          </div>
          
          {isMasking && (
              <div className="absolute top-0 right-0 p-1">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></div>
              </div>
          )}
        </div>

        {/* Bloc Performances */}
        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-xl border border-slate-200 dark:border-brand-500/20 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-4 h-4 text-brand-500" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Performances</span>
          </div>
          <div className="flex items-center justify-between">
             <div onClick={handleLatencyClick} className={`flex flex-col cursor-pointer transition-transform active:scale-95 ${isMeasuring ? 'opacity-50' : ''}`}>
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Ping Réseau</span>
                <div className={`font-mono text-lg font-black flex items-center gap-2 ${getLatencyColor(localLatency)}`}>
                    {isMeasuring ? '--' : `${localLatency}ms`}
                    {isMeasuring && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                </div>
             </div>
             <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Stabilité</span>
                <div className="text-sm font-bold text-emerald-500 flex items-center gap-1 justify-end">
                  <Check className="w-3 h-3" /> OPTIMAL
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Security Report Section */}
      {securityReport && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Analyse IA</h4>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-black ${securityReport.score > 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {securityReport.score}/100
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
