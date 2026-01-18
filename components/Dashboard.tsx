
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Activity, Shield, Ghost, Layers, Globe, Share2, Server, MapPin, Search, Gauge, Sparkles, ChevronDown, Check, X, Zap, Smartphone, Orbit, Terminal, Lock, EyeOff, Globe2, Loader2, ArrowRight, ShieldAlert } from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './DashboardCharts';
import { SecurityReport, PlanTier, ConnectionMode, DeviceNode } from '../types';

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
}

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
  currentIp
}) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fastOnly, setFastOnly] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [onionUrl, setOnionUrl] = useState('');
  const [isOnionResolving, setIsOnionResolving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const modes = [
    { id: ConnectionMode.STANDARD, icon: Shield, label: 'Standard', desc: 'Protection équilibrée' },
    { id: ConnectionMode.STEALTH, icon: Ghost, label: 'Stealth', desc: 'Contournement DPI' },
    { id: ConnectionMode.DOUBLE_HOP, icon: Layers, label: 'Double Hop', desc: 'Cascade multi-nœuds' },
    { id: ConnectionMode.SMART_DNS, icon: Globe, label: 'Smart DNS', desc: 'Vitesse de streaming' },
    { id: ConnectionMode.ONION_VORTEX, icon: Orbit, label: 'Vortex', desc: 'Accès Dark Web (.onion)' },
  ];

  const countriesWithFlags: Record<string, string> = {
    'France': '🇫🇷',
    'Suisse': '🇨🇭',
    'Singapour': '🇸🇬',
    'Islande': '🇮🇸',
    'Estonie': '🇪🇪',
    'Panama': '🇵🇦',
    'USA': '🇺🇸',
    'Allemagne': '🇩🇪',
    'Tous': '🌍'
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

  const countryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    nodes.forEach(n => {
      stats[n.country] = (stats[n.country] || 0) + 1;
    });
    return stats;
  }, [nodes]);

  const availableCountries = useMemo(() => {
    const countries = nodes.map(n => n.country).filter(Boolean);
    const unique = Array.from(new Set(countries));
    return ['Tous', ...unique].sort();
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const matchesCountry = countryFilter === 'Tous' || n.country === countryFilter;
      const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.ip.includes(searchQuery);
      const matchesLatency = !fastOnly || n.latency < 80;
      return matchesCountry && matchesSearch && matchesLatency;
    });
  }, [nodes, countryFilter, searchQuery, fastOnly]);

  const recommendedNodeId = useMemo(() => {
    if (filteredNodes.length === 0) return null;
    return [...filteredNodes].sort((a, b) => a.latency - b.latency)[0].id;
  }, [filteredNodes]);

  const nodesToShow = filteredNodes.slice(0, 10);

  const handleResolveOnion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onionUrl.endsWith('.onion')) {
        alert("L'adresse doit se terminer par .onion");
        return;
    }
    setIsOnionResolving(true);
    setTimeout(() => {
        setIsOnionResolving(false);
        setOnionUrl('');
        alert("Accès Vortex simulé : Le lien a été routé à travers 3 nœuds oignon.");
    }, 2500);
  };

  const isOnionMode = mode === ConnectionMode.ONION_VORTEX;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      
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

      {/* Onion Gateway Panel (Exclusif au mode Vortex) */}
      {isOnionMode && (
          <div className="glass-card p-8 rounded-[3rem] border border-purple-500/30 bg-purple-500/5 animate-in zoom-in-95 duration-500 relative overflow-hidden">
             {/* Vortex Background Patterns */}
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
                            <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black rounded border border-emerald-500/20">NO_LOGS</div>
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

             {/* Circuit Visualization */}
             <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                {[
                    { label: 'Nœud de Garde', icon: Shield, country: 'Islande' },
                    { label: 'Relais Central', icon: Ghost, country: 'Estonie' },
                    { label: 'Point de Sortie', icon: EyeOff, country: 'Panama' },
                    { label: 'Destination', icon: Globe2, country: 'Dark Web' }
                ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center">
                        <div className={`w-full p-4 rounded-2xl border flex items-center gap-3 transition-all duration-700 ${
                            isConnected ? 'bg-white/10 border-purple-500/30' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 opacity-50'
                        }`}>
                            <div className={`p-2 rounded-xl ${isConnected ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                <step.icon className="w-4 h-4" />
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
      )}

      {/* Global Network Explorer (Masqué si Onion est actif pour laisser la place à l'interface dédiée) */}
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
                 {/* Dynamic Node Search */}
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

                 {/* Custom Country Dropdown Filter */}
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
                          {availableCountries.map(country => (
                            <button
                              key={country}
                              onClick={() => {
                                setCountryFilter(country);
                                setIsDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors mb-1 ${
                                countryFilter === country 
                                  ? 'bg-cyan-500 text-white' 
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm">{countriesWithFlags[country] || '🚩'}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">{country === 'Tous' ? 'Réseau Global' : country}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {country !== 'Tous' && (
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                                    countryFilter === country ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                  }`}>
                                    {countryStats[country] || 0}
                                  </span>
                                )}
                                {countryFilter === country && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
                 
                 {/* Performance Toggle */}
                 <button 
                   onClick={() => setFastOnly(!fastOnly)}
                   className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                     fastOnly 
                      ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/30' 
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-cyan-500/50'
                   }`}
                 >
                   <Gauge className="w-4 h-4" />
                   Performance
                 </button>

                 {/* Clear All Filters */}
                 {(countryFilter !== 'Tous' || searchQuery !== '' || fastOnly) && (
                   <button 
                     onClick={() => {
                       setCountryFilter('Tous');
                       setSearchQuery('');
                       setFastOnly(false);
                     }}
                     className="p-2.5 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20"
                     title="Effacer les filtres"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 )}
              </div>
            </div>

            <div className="relative h-80 bg-slate-50 dark:bg-slate-950/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden transition-all duration-700">
              {/* Cyber Patterns */}
              <div className="absolute inset-0 cyber-grid opacity-20"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent pointer-events-none"></div>
              
              {/* Client Node */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center border-2 transition-all duration-500 transform ${
                    isConnected ? 'bg-cyan-500/10 border-cyan-500 shadow-xl shadow-cyan-500/20 scale-110' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}>
                  <Smartphone className={`w-7 h-7 ${isConnected ? 'text-cyan-500 animate-pulse' : 'text-slate-400'}`} />
                </div>
                {isConnected && (
                    <div className="mt-2 px-2 py-0.5 bg-cyan-500 text-white text-[8px] font-black uppercase rounded-full shadow-lg">Link Active</div>
                )}
              </div>

              {/* Orbiting Satellite Nodes */}
              {nodesToShow.map((node, idx) => {
                const angle = (idx / nodesToShow.length) * 2 * Math.PI;
                const radius = 110;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const isNodeConnected = isConnected && currentIp === node.ip;
                const isRecommended = node.id === recommendedNodeId;
                const isHovered = hoveredNode === node.id;

                return (
                  <div 
                    key={node.id}
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                    className="absolute transition-all duration-1000 group/node"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* Visual Connection Link */}
                    <div 
                      className={`absolute top-1/2 left-1/2 h-px origin-left transition-all duration-500 ${
                        isNodeConnected ? 'bg-cyan-500/40 w-[110px]' : isHovered ? 'bg-cyan-500/20 w-[110px]' : 'bg-transparent w-0'
                      }`}
                      style={{ transform: `rotate(${angle + Math.PI}rad) translateY(-50%)` }}
                    ></div>

                    <button
                      onClick={() => onConnectNode(node.id)}
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all border-2 relative z-20 hover:-translate-y-1 ${
                        isNodeConnected 
                            ? 'bg-cyan-500 border-cyan-500 text-white shadow-xl shadow-cyan-500/30 ring-4 ring-cyan-500/10' 
                            : isRecommended
                                ? 'bg-white dark:bg-slate-900 border-amber-400 text-amber-500 shadow-xl shadow-amber-500/10'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-cyan-500'
                      }`}
                    >
                      <Server className="w-4 h-4" />
                      <span className="absolute -top-1.5 -right-1.5 text-xs drop-shadow-sm">{countriesWithFlags[node.country] || '🚩'}</span>
                      
                      {isHovered && (
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 glass-card border border-slate-200 dark:border-slate-700 p-2.5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 z-30">
                            <div className="text-[10px] font-black uppercase text-slate-500 mb-1">{node.name}</div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-mono font-bold text-cyan-500">{node.latency}ms</span>
                               <span className="text-[10px] font-bold text-slate-400">{node.ip}</span>
                            </div>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}

              {filteredNodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 z-30">
                   <Search className="w-8 h-8 opacity-20" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Aucun nœud détecté</p>
                </div>
              )}
            </div>

            {/* Floating Quick Action */}
            {recommendedNodeId && currentIp !== nodes.find(n => n.id === recommendedNodeId)?.ip && (
                <div className="mt-6 flex justify-center">
                    <button 
                        onClick={() => onConnectNode(recommendedNodeId)}
                        className="flex items-center gap-3 px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all group"
                    >
                        <Sparkles className="w-4 h-4 text-amber-500 group-hover:animate-spin" />
                        Optimiser la sortie ({nodes.find(n => n.id === recommendedNodeId)?.country})
                    </button>
                </div>
            )}
          </div>
      )}
    </div>
  );
};
