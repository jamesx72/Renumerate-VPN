
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Activity, Shield, Ghost, Layers, Globe, Share2, Server, MapPin, Search, Gauge, Sparkles, ChevronDown, Check, X, Zap, Smartphone, Orbit, Terminal, Lock, EyeOff, Globe2, Loader2, ArrowRight, ShieldAlert, Link2, ExternalLink, ShieldCheck } from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './DashboardCharts';
import { SecurityReport, PlanTier, ConnectionMode, DeviceNode, AppSettings } from '../types';

interface DashboardProps {
  isDark: boolean;
  protocol: string;
  isEmergency: boolean;
  securityReport: SecurityReport | null;
  isConnected: boolean;
  userPlan: PlanTier;
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  nodes: DeviceNode[];
  onConnectNode: (id: string) => void;
  currentIp: string;
  settings: AppSettings;
}

const VERIFIED_ONION_SERVICES = [
  { name: 'Vortex Search', url: 'vortex4deedp3i2jcy.onion', category: 'Recherche Anonyme' },
  { name: 'SecureDrop Library', url: 'sdlibgg777secure.onion', category: 'Lanceurs d\'alerte' },
  { name: 'Renumerate Archive', url: 'renumlib777vortex.onion', category: 'Documentation' },
  { name: 'OnionShare Hub', url: 'onionshare_v3_hub.onion', category: 'Transfert P2P' },
];

export const Dashboard: React.FC<DashboardProps> = ({
  isDark,
  protocol,
  isEmergency,
  securityReport,
  isConnected,
  userPlan,
  mode,
  onModeChange,
  nodes,
  onConnectNode,
  currentIp,
  settings
}) => {
  const [countryFilter, setCountryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [onionUrl, setOnionUrl] = useState('');
  const [isOnionResolving, setIsOnionResolving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeNode = useMemo(() => {
    return nodes.find(n => n.ip === currentIp);
  }, [nodes, currentIp]);

  const modes = [
    { id: ConnectionMode.STANDARD, icon: Shield, label: 'Standard' },
    { id: ConnectionMode.STEALTH, icon: Ghost, label: 'Stealth' },
    { id: ConnectionMode.DOUBLE_HOP, icon: Layers, label: 'Double Hop' },
    { id: ConnectionMode.SMART_DNS, icon: Globe, label: 'Smart DNS' },
    { id: ConnectionMode.ONION_VORTEX, icon: Orbit, label: 'Vortex' },
  ];

  const countriesWithFlags: Record<string, string> = {
    'France': '🇫🇷', 'Suisse': '🇨🇭', 'Singapour': '🇸🇬', 'Islande': '🇮🇸', 'Estonie': '🇪🇪', 'Panama': '🇵🇦', 'USA': '🇺🇸', 'Allemagne': '🇩🇪', 'Tous': '🌍'
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResolveOnion = (e?: React.FormEvent, directUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = directUrl || onionUrl;
    
    if (!targetUrl.toLowerCase().endsWith('.onion')) {
        alert("L'adresse de destination doit être un service caché .onion valide.");
        return;
    }
    
    setIsOnionResolving(true);
    setTimeout(() => {
        setIsOnionResolving(false);
        setOnionUrl('');
        alert(`Tunnel Vortex établi avec succès vers ${targetUrl}. Votre navigation est désormais isolée par le circuit Tor.`);
    }, 2500);
  };

  const isOnionMode = mode === ConnectionMode.ONION_VORTEX;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
      
      {/* Dynamic Mode Switcher */}
      <div className={`glass-card p-2 rounded-[2.5rem] border shadow-2xl transition-all duration-500 ${isOnionMode ? 'border-purple-500/30 shadow-purple-500/10' : 'border-slate-200 dark:border-slate-800'}`}>
        <div className="grid grid-cols-5 gap-2">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            const isVortex = m.id === ConnectionMode.ONION_VORTEX;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                disabled={isConnected}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-[2rem] transition-all relative group ${
                  isActive
                    ? isVortex ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 active:scale-95'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : isVortex ? 'text-purple-500 group-hover:text-purple-400' : 'text-slate-400 group-hover:text-cyan-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                  {m.label}
                </span>
                {isActive && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 glass-card p-6 rounded-[2.5rem] border shadow-xl overflow-hidden relative transition-all duration-500 ${isOnionMode ? 'border-purple-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
           <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol Engine:</span>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isOnionMode ? 'text-purple-400 bg-purple-500/10 border border-purple-500/20' : 'text-cyan-500 bg-cyan-500/10 border border-cyan-500/20'}`}>
                {isOnionMode ? 'VORTEX-TOR-NET' : protocol.toUpperCase()}
              </span>
           </div>
           <div className="flex items-center gap-2 mb-6">
              <Activity className={`w-4 h-4 ${isOnionMode ? 'text-purple-500' : 'text-cyan-500'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                {isOnionMode ? 'Flux de Circuit Oignon' : 'Moniteur de Trafic'}
              </h3>
           </div>
           <TrafficMonitor isDark={isDark} />
        </div>
        
        <div className={`glass-card p-6 rounded-[2.5rem] border shadow-xl flex flex-col justify-center items-center transition-all duration-500 ${isOnionMode ? 'border-purple-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
           <div className="flex items-center gap-2 mb-6 self-start">
              <Zap className={`w-4 h-4 ${isOnionMode ? 'text-purple-500' : 'text-cyan-500'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Intégrité Tunnel</h3>
           </div>
           <AnonymityScore 
              score={isOnionMode && isConnected ? 100 : (isEmergency ? 15 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 70 : 95) : 0)))} 
              isDark={isDark} 
           />
        </div>
      </div>

      {/* Vortex Specific UI */}
      {isOnionMode ? (
          <div className="space-y-4 animate-in zoom-in-95 duration-500">
            {/* Tor Circuit visualization */}
            <div className="glass-card p-8 rounded-[3rem] border border-purple-500/30 bg-purple-500/5 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 cyber-grid opacity-10"></div>
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-purple-600/10 blur-[120px] rounded-full"></div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-6 bg-purple-600 text-white rounded-[2rem] shadow-2xl shadow-purple-600/40 animate-pulse">
                            <Orbit className="w-12 h-12" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em]">Vortex_Gateway_Active</span>
                                {settings.vortexBridge !== 'none' && <div className="px-2 py-0.5 bg-purple-500 text-white text-[8px] font-black rounded uppercase">BRIDGE ON</div>}
                            </div>
                            <h4 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Navigateur de Services Cachés</h4>
                        </div>
                    </div>

                    <form onSubmit={handleResolveOnion} className="w-full max-w-lg flex items-center gap-4">
                        <div className="relative flex-1 group">
                            <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                            <input 
                                type="text"
                                placeholder="ADRESSE_CIBLE.ONION"
                                value={onionUrl}
                                onChange={(e) => setOnionUrl(e.target.value)}
                                disabled={!isConnected || isOnionResolving}
                                className="w-full pl-12 pr-4 py-5 bg-slate-900 text-purple-400 border border-purple-500/40 rounded-[1.5rem] text-sm font-mono font-bold outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-purple-900"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={!isConnected || isOnionResolving || !onionUrl}
                            className="p-5 bg-purple-600 text-white rounded-[1.5rem] hover:bg-purple-700 transition-all shadow-xl shadow-purple-600/30 active:scale-95 disabled:opacity-50"
                        >
                            {isOnionResolving ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                        </button>
                    </form>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                    {[
                        { label: 'Entrée (Bridge)', icon: Shield, info: settings.vortexBridge === 'none' ? 'Connexion Directe' : `Pont ${settings.vortexBridge.toUpperCase()}` },
                        { label: 'Relais Central', icon: Ghost, info: `Multiplexage : ${settings.vortexCircuitLength} sauts` },
                        { label: 'Point de Sortie', icon: EyeOff, info: `Localisation : ${settings.vortexExitNodeCountry === 'auto' ? 'Aléatoire' : settings.vortexExitNodeCountry}` },
                        { label: 'Destination (.onion)', icon: Globe2, info: 'Réseau Caché Isolé' }
                    ].map((step, i) => (
                        <div key={i} className="flex flex-col items-center group/step">
                            <div className={`w-full p-5 rounded-[2rem] border flex items-center gap-4 transition-all duration-1000 ${
                                isConnected ? 'bg-white/10 border-purple-500/40 shadow-xl shadow-purple-500/10 hover:border-purple-400' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 opacity-40'
                            }`}>
                                <div className={`p-3 rounded-2xl relative ${isConnected ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                    <step.icon className="w-5 h-5" />
                                    {isConnected && (
                                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900">
                                        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-50"></div>
                                      </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest truncate">{step.label}</p>
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{isConnected ? step.info : 'Inactif'}</p>
                                </div>
                            </div>
                            {i < 3 && <div className={`h-6 w-px mt-2 ${isConnected ? 'bg-purple-500/40' : 'bg-slate-200 dark:border-slate-800'} md:hidden`}></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Onion Directory */}
            <div className="glass-card p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                            <Link2 className="w-5 h-5 text-purple-500" /> Annuaire de Services Vortex
                        </h3>
                        <p className="text-xs text-slate-400 mt-2">Nœuds de confiance pour une exploration sécurisée du Dark Web</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500 border border-purple-500/20">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {VERIFIED_ONION_SERVICES.map((service, idx) => (
                        <button
                            key={idx}
                            onClick={() => isConnected && handleResolveOnion(undefined, service.url)}
                            disabled={!isConnected || isOnionResolving}
                            className="flex flex-col items-start p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 hover:border-purple-500 group transition-all disabled:opacity-40 hover:shadow-lg hover:shadow-purple-500/5"
                        >
                            <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-2">{service.category}</span>
                            <span className="text-base font-black text-slate-900 dark:text-white mb-3">{service.name}</span>
                            <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-500 truncate max-w-[140px]">{service.url}</span>
                                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
          </div>
      ) : (
          /* Standard Global Network View */
          <div className="glass-card p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl relative group">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 relative z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-cyan-500" /> Cartographie des Nœuds
                  </h3>
                  <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-mono font-black text-slate-500">
                    {nodes.length} NŒUDS RÉFÉRENCÉS
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">Exploration des clusters de sortie mondiaux disponibles</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                 <div className="relative group/search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/search:text-cyan-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="FILTRER LES NŒUDS..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-11 pr-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:border-cyan-500 transition-all dark:text-white min-w-[220px]"
                    />
                 </div>
                 
                 <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`flex items-center justify-between gap-4 pl-5 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border rounded-2xl transition-all min-w-[200px] group ${
                        countryFilter !== 'Tous' ? 'border-cyan-500 shadow-lg shadow-cyan-500/10' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-4 h-4 ${countryFilter !== 'Tous' ? 'text-cyan-500' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest dark:text-white">
                          {countryFilter === 'Tous' ? 'Réseau Global' : countryFilter}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute top-full mt-3 left-0 w-full min-w-[240px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-3 max-h-[320px] overflow-y-auto custom-scrollbar">
                           {['Tous', 'France', 'Suisse', 'Singapour', 'USA', 'Allemagne'].map(country => (
                            <button
                              key={country}
                              onClick={() => { setCountryFilter(country); setIsDropdownOpen(false); }}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mb-1 ${
                                countryFilter === country ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-base">{countriesWithFlags[country] || '🚩'}</span>
                                <span className="text-[11px] font-black uppercase tracking-widest">{country}</span>
                              </div>
                              {countryFilter === country && <Check className="w-4 h-4" />}
                            </button>
                           ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="relative h-96 bg-slate-50 dark:bg-slate-950/60 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden transition-all duration-1000">
              <div className="absolute inset-0 cyber-grid opacity-30"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center border-4 transition-all duration-700 transform ${
                    isConnected ? 'bg-cyan-500/10 border-cyan-500 shadow-2xl shadow-cyan-500/30 scale-110' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}>
                  <Smartphone className={`w-10 h-10 ${isConnected ? 'text-cyan-500 animate-pulse' : 'text-slate-400'}`} />
                </div>

                {isConnected && activeNode && (
                  <div className="mt-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    <div className="px-8 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-cyan-500/50 rounded-[2.5rem] shadow-2xl shadow-cyan-500/20 flex items-center gap-6 group/active">
                      <div className="relative w-4 h-4">
                        <div className="absolute inset-0 bg-emerald-500 rounded-full"></div>
                        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] mb-1">Liaison Cyber-Link Active</div>
                        <div className="flex items-center gap-3">
                           <span className="text-xl">{countriesWithFlags[activeNode.country] || '📍'}</span>
                           <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{activeNode.name}</span>
                        </div>
                      </div>
                      <div className="ml-4 pl-6 border-l border-slate-200 dark:border-slate-800">
                         <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Délai Sync</div>
                         <div className="text-base font-mono font-black text-emerald-500">{activeNode.latency}ms</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      )}
    </div>
  );
};
