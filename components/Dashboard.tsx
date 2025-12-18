
import React, { useState, useMemo } from 'react';
import { Activity, Lock, Shield, Ghost, Layers, Globe, Check, AlertCircle, Share2, Server, Map, Zap, Info, Smartphone, Filter, Search, Gauge, Sparkles } from 'lucide-react';
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

  const modes = [
    { id: ConnectionMode.STANDARD, icon: Shield, label: 'Standard', desc: 'Équilibre parfait' },
    { id: ConnectionMode.STEALTH, icon: Ghost, label: 'Stealth', desc: 'Furtivité totale' },
    { id: ConnectionMode.DOUBLE_HOP, icon: Layers, label: 'Double Hop', desc: 'Double tunnel' },
    { id: ConnectionMode.SMART_DNS, icon: Globe, label: 'Smart DNS', desc: 'Vitesse max' },
  ];

  const availableCountries = useMemo(() => {
    const countries = nodes.map(n => n.country).filter(Boolean);
    return ['Tous', ...Array.from(new Set(countries))];
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      const matchesCountry = countryFilter === 'Tous' || n.country === countryFilter;
      const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.ip.includes(searchQuery);
      const matchesLatency = !fastOnly || n.latency < 80;
      return matchesCountry && matchesSearch && matchesLatency;
    });
  }, [nodes, countryFilter, searchQuery, fastOnly]);

  // Déterminer le meilleur nœud (Recommandation IA)
  const recommendedNodeId = useMemo(() => {
    if (filteredNodes.length === 0) return null;
    return [...filteredNodes].sort((a, b) => a.latency - b.latency)[0].id;
  }, [filteredNodes]);

  const nodesToShow = filteredNodes.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Mode Selector Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-5 px-1">
           <div className="flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-brand-500" /> Mode de Connexion
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Routage dynamique sécurisé</p>
           </div>
           
           <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${isConnected ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'}`}>
              {isConnected ? <Lock className="w-3 h-3" /> : <Check className="w-3 h-3" />}
              <span className="text-[9px] font-bold uppercase">{isConnected ? 'Verrouillé' : 'Disponible'}</span>
           </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                disabled={isConnected}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all relative ${
                  isActive
                    ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/25 scale-[1.02]'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand-400 dark:hover:border-brand-500/50'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}`}
              >
                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20' : 'bg-white dark:bg-slate-800 shadow-sm'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-500'}`} />
                </div>
                <div className="text-center">
                  <div className={`text-xs font-bold tracking-tight ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{m.label}</div>
                  <div className={`text-[9px] mt-0.5 leading-tight ${isActive ? 'text-brand-100' : 'text-slate-400'}`}>{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Network Map Section with Advanced Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5 text-brand-500" /> Topologie Réseau
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Exploration des points de terminaison</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
             {/* Search Bar */}
             <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] w-32 focus:w-48 transition-all outline-none focus:border-brand-500 dark:text-white"
                />
             </div>

             {/* Fast Only Toggle */}
             <button 
               onClick={() => setFastOnly(!fastOnly)}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                 fastOnly 
                  ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' 
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
               }`}
             >
               <Gauge className="w-3.5 h-3.5" />
               <span className="hidden lg:inline">Basse Latence</span>
             </button>

             {/* Country Filter */}
             <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-2 py-1 border border-slate-200 dark:border-slate-700">
               <Filter className="w-3 h-3 text-slate-400" />
               <select 
                 value={countryFilter}
                 onChange={(e) => setCountryFilter(e.target.value)}
                 className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
               >
                 {availableCountries.map(country => (
                   <option key={country} value={country}>{country}</option>
                 ))}
               </select>
             </div>
          </div>
        </div>

        <div className="relative h-72 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 overflow-hidden flex items-center justify-center">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
               style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          {/* Center (USER) */}
          <div className="relative z-10">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                isConnected ? 'bg-brand-500/10 border-brand-500 shadow-lg shadow-brand-500/20' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
            }`}>
              <Smartphone className={`w-6 h-6 ${isConnected ? 'text-brand-500 animate-pulse' : 'text-slate-400'}`} />
            </div>
          </div>

          {/* Orbiting Nodes */}
          {nodesToShow.length > 0 ? nodesToShow.map((node, idx) => {
            const angle = (idx / nodesToShow.length) * 2 * Math.PI;
            const radius = 100;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const isNodeConnected = isConnected && currentIp === node.ip;
            const isRecommended = node.id === recommendedNodeId;
            const isHovered = hoveredNode === node.id;

            return (
              <div 
                key={node.id}
                style={{ transform: `translate(${x}px, ${y}px)` }}
                className="absolute transition-all duration-700"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Connection Line */}
                <div 
                  className={`absolute top-1/2 left-1/2 h-0.5 origin-left transition-all duration-500 ${
                    isNodeConnected ? 'bg-brand-500/40 w-[100px]' : isHovered ? 'bg-brand-500/20 w-[100px]' : 'bg-slate-200 dark:bg-slate-800/20 w-0'
                  }`}
                  style={{ transform: `rotate(${angle + Math.PI}rad) translateY(-50%)` }}
                ></div>

                <button
                  onClick={() => onConnectNode(node.id)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border-2 relative z-20 ${
                    isNodeConnected 
                        ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/30' 
                        : isRecommended
                            ? 'bg-white dark:bg-slate-900 border-amber-400 text-amber-500 shadow-lg shadow-amber-500/10'
                            : isHovered
                                ? 'bg-white dark:bg-slate-800 border-brand-500 text-brand-500 scale-110'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  
                  {isRecommended && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                        <Sparkles className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}

                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xl text-[10px] whitespace-nowrap animate-in fade-in zoom-in-90 z-30">
                        <div className="font-bold flex items-center gap-1.5">
                            {node.name} {isRecommended && <span className="text-[8px] text-amber-400">(RECOMMANDÉ)</span>}
                        </div>
                        <div className="opacity-70 font-mono mt-0.5">{node.country} • {node.latency}ms</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                    </div>
                  )}
                </button>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
                <AlertCircle className="w-6 h-6 opacity-30" />
                <span className="text-[10px] font-bold uppercase tracking-widest italic">Zéro nœud trouvé</span>
            </div>
          )}
        </div>
        
        {/* Recommended Node Quick Action */}
        {recommendedNodeId && !isConnected && (
            <div className="mt-4 flex justify-center">
                <button 
                    onClick={() => onConnectNode(recommendedNodeId)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold shadow-xl hover:scale-105 transition-transform"
                >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    CONNEXION AU NŒUD OPTIMAL
                </button>
            </div>
        )}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <Activity className="w-4 h-4" /> Flux Réseau
            </h3>
            <span className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500 font-mono font-bold">{protocol.toUpperCase()}</span>
          </div>
          <TrafficMonitor isDark={isDark} />
        </div>
        
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <Lock className="w-4 h-4" /> Confidentialité
            </h3>
            {isConnected && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>}
          </div>
          <AnonymityScore 
              score={isEmergency ? 10 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 75 : 99) : 0))} 
              isDark={isDark} 
          />
        </div>
      </div>
    </div>
  );
};
