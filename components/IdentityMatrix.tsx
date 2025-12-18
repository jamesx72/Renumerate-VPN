
import React, { useState, useEffect } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { Fingerprint, Globe, Monitor, Network, ArrowRight, ShieldCheck, Server, Pin, Building2, AlertTriangle, CheckCircle, Clock, Info, Share2, Check, Shield, Activity, Settings, Ghost, Laptop, X, Users, MapPin, Coins, CloudSun, Zap } from 'lucide-react';

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
    
    // Simulation d'un ping réseau
    setTimeout(() => {
        // Génère une nouvelle latence réaliste (entre 10ms et 150ms)
        const newLatency = Math.floor(Math.random() * 140) + 10;
        setLocalLatency(newLatency);
        setIsMeasuring(false);
    }, 1500);
  };

  const getProtocolVersion = (p: string) => {
      switch(p) {
          case 'wireguard': return 'v1.0.202309';
          case 'openvpn': return 'v2.6.8';
          case 'ikev2': return 'v5.9.2';
          default: return 'v1.0.0';
      }
  };

  const getCityDetails = (city: string) => {
    const data: Record<string, any> = {
      'Paris': { pop: '2.16M', region: 'Île-de-France', currency: 'Euro (€)', weather: '14°C Nuageux' },
      'Zürich': { pop: '402K', region: 'Canton de Zurich', currency: 'Franc Suisse (CHF)', weather: '10°C Pluvieux' },
      'Singapore': { pop: '5.6M', region: 'Central Region', currency: 'Dollar (SGD)', weather: '31°C Humide' },
      'Reykjavik': { pop: '131K', region: 'Höfuðborgarsvæðið', currency: 'Couronne (ISK)', weather: '4°C Vent' },
      'Panama City': { pop: '880K', region: 'Panamá', currency: 'Balboa (PAB)', weather: '29°C Ensoleillé' },
      'Tallinn': { pop: '426K', region: 'Harju', currency: 'Euro (€)', weather: '8°C Variable' },
    };
    return data[city] || { pop: 'Inconnu', region: 'Inconnu', currency: 'USD', weather: '--' };
  };

  const protocolVersion = getProtocolVersion(protocol);
  const protocolName = protocol === 'ikev2' ? 'IKEv2/IPsec' : protocol.charAt(0).toUpperCase() + protocol.slice(1);
  const cityInfo = getCityDetails(identity.city);

  const getLatencyColor = (ms: number) => {
      if (ms < 50) return 'text-emerald-500';
      if (ms < 120) return 'text-amber-500';
      return 'text-red-500';
  };

  const getDnsInfo = (id: string) => {
    const providers: Record<string, any> = {
      cloudflare: { name: 'Cloudflare', ip: '1.1.1.1', desc: 'Performance Max' },
      google: { name: 'Google DNS', ip: '8.8.8.8', desc: 'Global Coverage' },
      quad9: { name: 'Quad9', ip: '9.9.9.9', desc: 'Secure & Private' },
      opendns: { name: 'OpenDNS', ip: '208.67.222.222', desc: 'Family Safe' },
      custom: { name: 'Renumerate DNS', ip: '10.8.0.1', desc: 'Internal stealth' }
    };
    return providers[id] || providers.cloudflare;
  };

  const activeDns = getDnsInfo(dnsProvider);

  return (
    <div className="space-y-4 relative">
      {/* Modal Détails Ville */}
      {showCityDetails && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm rounded-2xl" onClick={() => setShowCityDetails(false)}></div>
            <div className="relative bg-white dark:bg-slate-900 w-full max-w-[280px] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4">
                <button 
                    onClick={() => setShowCityDetails(false)}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                    <X className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-brand-500" />
                    <h4 className="font-bold text-slate-900 dark:text-white">{identity.city}</h4>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Users className="w-3.5 h-3.5" />
                            <span>Population</span>
                        </div>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{cityInfo.pop}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Région</span>
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-200 text-right">{cityInfo.region}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Coins className="w-3.5 h-3.5" />
                            <span>Devise</span>
                        </div>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{cityInfo.currency}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <CloudSun className="w-3.5 h-3.5" />
                            <span>Météo</span>
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-200">{cityInfo.weather}</span>
                    </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-center text-slate-400">
                    Données simulées pour la démo
                </div>
            </div>
        </div>
      )}

      {/* Connection Mode Visual Feedback */}
      {mode === ConnectionMode.DOUBLE_HOP && entryIdentity && (
        <div className="bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg border border-brand-200 dark:border-brand-500/30 flex items-center justify-between text-xs sm:text-sm animate-pulse-fast">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
             <div className="w-2 h-2 rounded-full bg-slate-400"></div>
             <span className="hidden sm:inline">Source</span>
          </div>
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 mx-2 relative">
             <ArrowRight className="w-3 h-3 text-brand-500 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-medium">
                <Server className="w-4 h-4" />
                <span className="hidden sm:inline">{entryIdentity.country}</span>
                <span className="sm:hidden">{entryIdentity.country.slice(0,2).toUpperCase()}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:block">{entryIdentity.ip}</span>
          </div>
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 mx-2 relative">
             <ArrowRight className="w-3 h-3 text-brand-500 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="flex items-center gap-2 text-emerald-500 font-bold">
             <Globe className="w-4 h-4" />
             <span>{isRotating ? '...' : identity.country}</span>
          </div>
        </div>
      )}

      {mode === ConnectionMode.SMART_DNS && (
        <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-500/30 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-500">
                <Globe className="w-5 h-5" />
             </div>
             <div>
                <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Routage Smart DNS</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Fournisseur : {activeDns.name} ({activeDns.ip})</div>
             </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">DNS OPTIMISÉ</span>
             <span className="text-[9px] text-slate-400 mt-1 italic">Vitesse DNS: {localLatency / 2}ms</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg shadow-brand-600/10 transition-all duration-500 ease-out hover:scale-[1.03] hover:shadow-2xl hover:shadow-brand-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Adresse IP Publique</span>
            </div>
            {copiedIp && (
               <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded animate-in fade-in slide-in-from-right-2">
                   IP copiée !
               </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className={`font-mono text-xl tracking-wider ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
               {isRotating ? 'RENUMBERING...' : (
                   <span key={identity.ip} className="animate-in fade-in duration-500">
                     {mode === ConnectionMode.SMART_DNS ? 'ORIGINAL IP' : identity.ip}
                   </span>
               )}
            </div>
            {!isRotating && (
              <button 
                onClick={handleCopyIp}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-all shadow-sm group border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/30 hover:scale-105 hover:shadow-md"
                title="Copier l'adresse IP"
              >
                {copiedIp ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg shadow-brand-600/10">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Localisation Virtuelle</span>
          </div>
          <div className={`font-mono text-lg ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            {isRotating ? '---' : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-2">
                <div className="flex items-center gap-2 min-w-0" title="Emplacement VPN actuel">
                  <Pin className="w-4 h-4 text-brand-500 cursor-help shrink-0" />
                  <span className="font-bold truncate">{identity.country}</span>
                </div>
                
                <div 
                  className="flex items-center gap-2 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded px-2 py-0.5 -ml-2 cursor-pointer transition-all duration-300 group hover:shadow-sm hover:ring-1 hover:ring-brand-200 dark:hover:ring-brand-500/20 min-w-0"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-brand-500 transition-colors shrink-0" />
                  <span key={identity.city} className="text-lg font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-all animate-in fade-in duration-500 truncate">{identity.city}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowCityDetails(true); }}
                    className="p-1 rounded-full text-slate-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 hover:text-brand-600 transition-all ml-1 opacity-50 group-hover:opacity-100 shrink-0"
                    title="Plus de détails"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 min-w-0" title="Date et Heure Système">
                   <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                   <div className="flex flex-col min-w-0">
                       <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 leading-none truncate">
                           {currentTime.toLocaleTimeString('fr-FR')}
                       </span>
                       <span className="text-[9px] text-slate-400 leading-none mt-0.5 truncate">
                           {currentTime.toLocaleDateString('fr-FR')} • {identity.timezone || 'UTC+0'}
                       </span>
                   </div>
                </div>
                
                <div className="flex items-center gap-2 text-base text-slate-600 dark:text-slate-300 min-w-0" title={`Protocole: ${protocolName} ${protocolVersion}`}>
                   <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                   <span className="text-sm font-mono truncate">{protocolName}</span>
                </div>

                {obfuscationLevel && (
                    <div className="flex items-center min-w-0 -ml-1.5">
                        <div className="flex items-center gap-2 px-1.5 py-0.5 min-w-0">
                            <Ghost className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span className="text-sm font-mono capitalize text-slate-600 dark:text-slate-300 truncate">
                                {obfuscationLevel}
                            </span>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onOpenObfuscationSettings?.(); }}
                            className="ml-0.5 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-brand-500 transition-colors shrink-0"
                            title="Configurer le niveau d'obfuscation"
                        >
                            <Settings className="w-3 h-3" />
                        </button>
                    </div>
                )}

                <div 
                    onClick={handleLatencyClick}
                    className={`flex items-center gap-2 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1.5 py-0.5 -ml-1.5 transition-colors min-w-0 ${isMeasuring ? 'cursor-wait' : ''}`}
                    title={isMeasuring ? "Mesure en cours..." : "Cliquer pour rafraîchir la latence"}
                >
                   <Activity className={`w-3.5 h-3.5 shrink-0 ${isMeasuring ? 'text-brand-500 animate-pulse' : getLatencyColor(localLatency)}`} />
                   
                   {isMeasuring ? (
                       <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                           <div className="h-full bg-brand-500 w-1/2 animate-[shimmer_1s_infinite]"></div>
                       </div>
                   ) : (
                       <span className="text-sm font-mono text-slate-600 dark:text-slate-300 truncate">
                            {localLatency}ms
                       </span>
                   )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`bg-white dark:bg-brand-800/50 p-4 rounded-lg border backdrop-blur-sm shadow-lg shadow-brand-600/10 transition-colors duration-300 ${isMasking ? 'border-indigo-500/40 bg-indigo-50/10' : 'border-slate-200 dark:border-brand-500/20'}`}>
          <div className="flex items-center gap-3 mb-2">
            <Monitor className={`w-5 h-5 ${isMasking ? 'text-indigo-600 dark:text-indigo-400' : 'text-brand-600 dark:text-brand-400'}`} />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">User Agent Spoof</span>
          </div>
          <div className={`font-mono text-sm font-bold ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : isMasking ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
             {isRotating ? 'Generating Profile...' : isMasking ? 'Randomizing UA...' : (
                 <span key={identity.userAgentShort} className="animate-in fade-in duration-500">{identity.userAgentShort}</span>
             )}
          </div>
        </div>

        <div className={`bg-white dark:bg-brand-800/50 p-4 rounded-lg border backdrop-blur-sm shadow-lg shadow-brand-600/10 transition-colors duration-300 ${isMasking ? 'border-indigo-500/40 bg-indigo-50/10' : 'border-slate-200 dark:border-brand-500/20'}`}>
          <div className="flex items-center gap-3 mb-2">
            <Fingerprint className={`w-5 h-5 ${isMasking ? 'text-indigo-600 dark:text-indigo-400' : 'text-brand-600 dark:text-brand-400'}`} />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">MAC Virtuelle</span>
          </div>
          <div className={`font-mono text-base ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : isMasking ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
             {isRotating ? 'XX:XX:XX:XX:XX:XX' : isMasking ? 'Spoofing MAC...' : (
                 <span key={identity.mac} className="animate-in fade-in duration-500">{identity.mac}</span>
             )}
          </div>
        </div>

        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg shadow-brand-600/10">
          <div className="flex items-center gap-3 mb-2">
            <Laptop className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Connexions Actives</span>
          </div>
          <div className={`font-mono text-lg font-bold ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
             {isRotating ? '--' : '3 Appareils'}
          </div>
        </div>
      </div>

      {securityReport && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-brand-500" />
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Analyse de sécurité IA</h4>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 font-medium">Score de sécurité</span>
                    <div className="flex items-center gap-2">
                         <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${securityReport.score > 80 ? 'bg-emerald-500' : securityReport.score > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${securityReport.score}%` }}></div>
                         </div>
                         <span className={`text-xs font-bold ${securityReport.score > 80 ? 'text-emerald-500' : securityReport.score > 50 ? 'text-amber-500' : 'text-red-500'}`}>{securityReport.score}/100</span>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 font-medium">Niveau de menace</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        securityReport.threatLevel === 'Faible' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                        securityReport.threatLevel === 'Moyen' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                        'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                        {securityReport.threatLevel === 'Faible' ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {securityReport.threatLevel.toUpperCase()}
                    </span>
                </div>
                
                <p className="text-xs text-slate-600 dark:text-slate-400 italic border-l-2 border-brand-500 pl-2 my-3">
                    "{securityReport.analysis}"
                </p>
                
                {securityReport.recommendations.length > 0 && (
                    <div className="space-y-1">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="text-brand-500 mt-0.5">•</span>
                                <span>{rec}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
