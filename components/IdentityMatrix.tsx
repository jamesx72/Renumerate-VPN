
import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { Fingerprint, Globe, Monitor, Network, ArrowRight, ShieldCheck, Server, Pin, Building2, AlertTriangle, CheckCircle, Clock, Info, Copy, Check, Shield, Activity, Settings, Ghost, Laptop, X, Users, MapPin, Coins, CloudSun, Zap, BarChart3, Database } from 'lucide-react';

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
}

export const IdentityMatrix: React.FC<Props> = ({ 
  identity, 
  entryIdentity, 
  isRotating, 
  isMasking = false, 
  mode, 
  securityReport, 
  protocol = 'wireguard', 
  obfuscationLevel, 
  dnsProvider = 'cloudflare',
  onOpenObfuscationSettings 
}) => {
  const [copiedIp, setCopiedIp] = useState(false);
  const [localLatency, setLocalLatency] = useState(identity.latency);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCityDetails, setShowCityDetails] = useState(false);

  // Mise à jour de l'heure chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Synchronise la latence locale si l'identité change (ex: rotation)
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
  const protocolName = protocol === 'ikev2' ? 'IKEv2/IPsec' : protocol.charAt(0).toUpperCase() + protocol.slice(1);

  const getLatencyColor = (ms: number) => {
      if (ms < 50) return 'text-emerald-500';
      if (ms < 120) return 'text-amber-500';
      return 'text-red-500';
  };

  return (
    <div className="space-y-4 relative">
      {/* Modal Détails Ville */}
      {showCityDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowCityDetails(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
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
                            <h4 className="text-xl font-black">{identity.city}</h4>
                            <p className="text-white/70 text-xs font-medium flex items-center gap-1">
                                <Globe className="w-3 h-3" /> {identity.country}
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* Info Grid */}
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
                                <span className="font-medium">Charge Nœud</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: cityInfo.load }}></div>
                                </div>
                                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{cityInfo.load}</span>
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

      {/* Identity Visual Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Adresse IP Publique</span>
            </div>
            {copiedIp && <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Copié !</span>}
          </div>
          <div className="flex items-center justify-between">
            <div className={`font-mono text-xl tracking-wider ${isRotating ? 'text-brand-600 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
               {isRotating ? 'RENUMBERING...' : (mode === ConnectionMode.SMART_DNS ? 'ORIGINAL IP' : identity.ip)}
            </div>
            {!isRotating && (
              <button onClick={handleCopyIp} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 transition-all">
                {copiedIp ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Bloc Ville Cliquable */}
        <div 
          onClick={() => !isRotating && setShowCityDetails(true)}
          className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg hover:border-brand-500/40 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Localisation Virtuelle</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Live</span>
            </div>
          </div>
          <div className={`font-mono text-lg ${isRotating ? 'text-brand-600 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            {isRotating ? '---' : (
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-brand-500 shrink-0" />
                <span className="font-bold border-b border-dotted border-slate-400 group-hover:border-brand-500 transition-colors">
                    {identity.city}, {identity.country}
                </span>
                <Info className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        {/* Détails Techniques Secondaires */}
        <div className={`bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 transition-all ${isMasking ? 'ring-1 ring-indigo-500/50' : ''}`}>
          <div className="flex items-center gap-3 mb-2">
            <Monitor className={`w-5 h-5 ${isMasking ? 'text-indigo-500' : 'text-brand-600 dark:text-brand-400'}`} />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">User Agent Spoof</span>
          </div>
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
             {isRotating ? '...' : identity.userAgentShort}
          </div>
        </div>

        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Latence Réseau</span>
          </div>
          <div className="flex items-center gap-2">
             <div onClick={handleLatencyClick} className={`font-mono text-lg font-bold cursor-pointer ${getLatencyColor(localLatency)} ${isMeasuring ? 'animate-pulse' : ''}`}>
                {isMeasuring ? '--' : `${localLatency}ms`}
             </div>
             {isMeasuring && <Zap className="w-3.5 h-3.5 text-brand-500 animate-bounce" />}
          </div>
        </div>
      </div>

      {/* Security Report Section */}
      {securityReport && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Rapport IA</h4>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${securityReport.score > 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    SCORE {securityReport.score}/100
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
