
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
  { name: 'Torch Search', url: 'torchdeedp3i2jcy.onion', category: 'Moteur de recherche' },
  { name: 'DuckDuckGo', url: 'duckduckgogg.onion', category: 'Confidentialité' },
  { name: 'Renumerate Library', url: 'renumlib777.onion', category: 'Documentation' },
  { name: 'OnionShare', url: 'onionshare.onion', category: 'Fichiers' },
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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fastOnly, setFastOnly] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [onionUrl, setOnionUrl] = useState('');
  const [isOnionResolving, setIsOnionResolving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeNode = useMemo(() => {
    return nodes.find(n => n.ip === currentIp);
  }, [nodes, currentIp]);

  const modes = [
    { id: ConnectionMode.STANDARD, icon: Shield, label: 'Standard', desc: 'Protection équilibrée' },
    { id: ConnectionMode.STEALTH, icon: Ghost, label: 'Stealth', desc: 'Contournement DPI' },
    { id: ConnectionMode.DOUBLE_HOP, icon: Layers, label: 'Double Hop', desc: 'Cascade multi-nœuds' },
    { id: ConnectionMode.SMART_DNS, icon: Globe, label: 'Smart DNS', desc: 'Vitesse de streaming' },
    { id: ConnectionMode.ONION_VORTEX, icon: Orbit, label: 'Vortex', desc: 'Accès Dark Web (.onion)' },
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

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const matchesCountry = countryFilter === 'Tous' || n.country === countryFilter;
      const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.ip.includes(searchQuery);
      const matchesLatency = !fastOnly || n.latency < 80;
      return matchesCountry && matchesSearch && matchesLatency;
    });
  }, [nodes, countryFilter, searchQuery, fastOnly]);

  const handleResolveOnion = (e?: React.FormEvent, directUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = directUrl || onionUrl;
    
    if (!targetUrl.includes('.onion')) {
        alert("L'adresse doit se terminer par .onion");
        return;
    }
    
    setIsOnionResolving(true);
    setTimeout(() => {
        setIsOnionResolving(false);
        setOnionUrl('');
        alert(`Tunnel Vortex établi vers ${targetUrl}. La session est isolée et chiffrée.`);
    }, 2000);
  };

  const isOnionMode = mode === ConnectionMode.ONION_VORTEX;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
      
      {/* Mode Navigation Bar */}
      <div className="glass-card p-2 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-cyan-500/5">
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
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-[1.5rem] transition-all relative group ${
                  isActive
                    ? isVortex ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 active:scale-95'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : isVortex ? 'text-purple-500 group-hover:text-purple-400' : 'text-slate-400 group-hover:text-cyan-500'}`} />
                <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                  {m.label.split(' ')[0]}
                </span>
                {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative min-w-0">
           <div className="absolute top-0 right-0 p-3 flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol:</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isOnionMode ? 'text-purple-500 bg-purple-500/10' : 'text-cyan-500 bg-cyan-500/10'}`}>
                {isOnionMode ? 'VORTEX-TOR' : protocol.toUpperCase()}
              </span>
           </div>
           <div className="flex items-center gap-2 mb-6">
              <Activity className={`w-4 h-4 ${isOnionMode ? 'text-purple-500' : 'text-cyan-500'}`} />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                {isOnionMode ? 'Circuit de Routage Oignon' : 'Moniteur de Flux'}
              </h3>
           </div>
           <TrafficMonitor isDark={isDark} />
        </div>
        
        <div className="glass-card p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-center items-center">
           <div className="flex items-center gap-2 mb-6 self-start">
              <Zap className={`w-4 h-4 ${isOnionMode ? 'text-purple-500' : 'text-cyan-500'}`} />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Niveau d'Obsfuscation</h3>
           </div>
           <AnonymityScore 
              score={isOnionMode && isConnected ? 100 : (isEmergency ? 10 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 75 : 99) : 0)))} 
              isDark={isDark} 
           />
        </div>
      </div>

      {/* Onion Gateway Panel */}
      {isOnionMode && (
          <div className="space-y-4 animate-in zoom-in-95 duration-500">
            <div className="glass-card p-8 rounded-[3rem] border border-purple-500/30 bg-purple-500/5 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 cyber-grid opacity-10"></div>
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-purple-600/10 blur-[100px] rounded-full"></div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-purple-600 text-white rounded-[2rem] shadow-2xl shadow-purple-600/30 animate-pulse">
                            <Orbit className="w-10 h-10" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em]">Vortex_Gateway_V3</span>
                                {settings.vortexBridge !== 'none' && <div className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[8px] font-black rounded border border-purple-500/20">BRIDGE: {settings.vortexBridge.toUpperCase()}</div>}
                                {settings.vortexNoScript && <div className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black rounded border border-red-500/20">NOSCRIPT_ACTIVE</div>}
                            </div>
                            <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Accès Services Cachés</h4>
                        </div>
                    </div>

                    <form onSubmit={handleResolveOnion} className="w-full max-w-md flex items-center gap-3">
                        <div className="relative flex-1 group">
                            <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                            <input 
                                type="text"
                                placeholder="ADRESSE_VORTEX.ONION"
                                value={onionUrl}
                                onChange={(e) => setOnionUrl(e.target.value)}
                                disabled={!isConnected || isOnionResolving}
                                className="w-full pl-12 pr-4 py-4 bg-slate-900 text-purple-400 border border-purple-500/30 rounded-2xl text-xs font-mono font-bold outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all placeholder:text-purple-900"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={!isConnected || isOnionResolving || !onionUrl}
                            className="p-4 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-all shadow-xl shadow-purple-600/20 active:scale-95 disabled:opacity-50"
                        >
                            {isOnionResolving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>
                </div>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                    {[
                        { label: 'Entrée (Bridge)', icon: Shield, country: settings.vortexBridge === 'none' ? 'Islande' : settings.vortexBridge.toUpperCase() },
                        { label: 'Relais Central', icon: Ghost, country: 'Circuit ' + settings.vortexCircuitLength + ' sauts' },
                        { label: 'Point de Sortie', icon: EyeOff, country: settings.vortexExitNodeCountry === 'auto' ? 'Panama' : settings.vortexExitNodeCountry },
                        { label: 'Destination', icon: Globe2, country: 'Onion Network' }
                    ].map((step, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <div className={`w-full p-4 rounded-2xl border flex items-center gap-3 transition-all duration-700 ${
                                isConnected ? 'bg-white/10 border-purple-500/30 shadow-lg shadow-purple-500/5' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 opacity-50'
                            }`}>
                                <div className={`p-2 rounded-xl relative ${isConnected ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                    <step.icon className="w-4 h-4" />
                                    {isConnected && i === 2 && (
                                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-slate-900">
                                        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping"></div>
                                      </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{step.label}</p>
                                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">{isConnected ? step.country : '---'}</p>
                                </div>
                            </div>
                            {i < 3 && <div className={`h-4 w-px mt-1 ${isConnected ? 'bg-purple-500/30' : 'bg-slate-200 dark:bg-slate-800'} md:hidden`}></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Onion Services Directory */}
            <div className="glass-card p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-purple-500" /> Services Vortex Vérifiés
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">Accès direct aux services .onion via tunnel chiffré</p>
                    </div>
                    <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {VERIFIED_ONION_SERVICES.map((service, idx) => (
                        <button
                            key={idx}
                            onClick={() => isConnected && handleResolveOnion(undefined, service.url)}
                            disabled={!isConnected || isOnionResolving}
                            className="flex flex-col items-start p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 hover:border-purple-500 group transition-all disabled:opacity-40"
                        >
                            <span className="text-[8px] font-black text-purple-500 uppercase tracking-widest mb-1">{service.category}</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white mb-2">{service.name}</span>
                            <div className="flex items-center justify-between w-full">
                                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">{service.url}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
          </div>
      )}

      {/* Global Network Explorer */}
      {!isOnionMode && (
          <div className="glass-card p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl relative group">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-cyan-500" /> Cartographie Topologique
                  </h3>
                  <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] font-mono font-bold text-slate-400">
                    {filteredNodes.length}/{nodes.length} NŒUDS
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Exploration des clusters de sortie mondiaux</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                 <div className="relative group/search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within/search:text-cyan-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="NOM OU IP..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 transition-all dark:text-white min-w-[180px]"
                    />
                 </div>
                 
                 <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`flex items-center justify-between gap-3 pl-4 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl transition-all min-w-[180px] group ${
                        countryFilter !== 'Tous' ? 'border-cyan-500 shadow-lg shadow-cyan-500/10' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className={`w-4 h-4 ${countryFilter !== 'Tous' ? 'text-cyan-500' : 'text-slate-400'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest dark:text-white">
                          {countryFilter === 'Tous' ? 'Réseau Global' : countryFilter}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute top-full mt-2 left-0 w-full min-w-[220px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                           {['Tous', 'France', 'Suisse', 'Singapour', 'USA', 'Allemagne'].map(country => (
                            <button
                              key={country}
                              onClick={() => { setCountryFilter(country); setIsDropdownOpen(false); }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors mb-1 ${
                                countryFilter === country ? 'bg-cyan-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm">{countriesWithFlags[country] || '🚩'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">{country}</span>
                              </div>
                              {countryFilter === country && <Check className="w-3.5 h-3.5" />}
                            </button>
                           ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="relative h-80 bg-slate-50 dark:bg-slate-950/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden transition-all duration-700">
              <div className="absolute inset-0 cyber-grid opacity-20"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center border-2 transition-all duration-500 transform ${
                    isConnected ? 'bg-cyan-500/10 border-cyan-500 shadow-xl shadow-cyan-500/20 scale-110' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}>
                  <Smartphone className={`w-7 h-7 ${isConnected ? 'text-cyan-500 animate-pulse' : 'text-slate-400'}`} />
                </div>

                {isConnected && activeNode && (
                  <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-cyan-500/40 rounded-[2rem] shadow-2xl shadow-cyan-500/10 flex items-center gap-4 group/active">
                      <div className="relative w-3 h-3">
                        <div className="absolute inset-0 bg-emerald-500 rounded-full"></div>
                        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-0.5">Lien Actif Établi</div>
                        <div className="flex items-center gap-2">
                           <span className="text-sm">{countriesWithFlags[activeNode.country] || '📍'}</span>
                           <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">{activeNode.name}</span>
                        </div>
                      </div>
                      <div className="ml-2 pl-4 border-l border-slate-200 dark:border-slate-800">
                         <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Latence</div>
                         <div className="text-[10px] font-mono font-black text-emerald-500">{activeNode.latency}ms</div>
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
