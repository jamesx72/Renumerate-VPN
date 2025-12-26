
import React, { useState, useMemo } from 'react';
import { Activity, Lock, Shield, Ghost, Layers, Globe, Check, AlertCircle, Share2, Server, Map, Zap, Info, Smartphone, Filter, Search, Gauge, Sparkles, Navigation, MapPin, ChevronDown } from 'lucide-react';
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
    { id: ConnectionMode.STANDARD, icon: Shield, label: 'Standard', desc: 'Protection équilibrée' },
    { id: ConnectionMode.STEALTH, icon: Ghost, label: 'Stealth', desc: 'Contournement DPI' },
    { id: ConnectionMode.DOUBLE_HOP, icon: Layers, label: 'Double Hop', desc: 'Cascade multi-nœuds' },
    { id: ConnectionMode.SMART_DNS, icon: Globe, label: 'Smart DNS', desc: 'Vitesse de streaming' },
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      
      {/* Mode Navigation Bar */}
      <div className="glass-card p-2 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-cyan-500/5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                disabled={isConnected}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-[1.5rem] transition-all relative group ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 active:scale-95'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-500'}`} />
                <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                  {m.label}
                </span>
                {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
           <div className="absolute top-0 right-0 p-3 flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol:</span>
              <span className="text-[10px] font-black text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full">{protocol.toUpperCase()}</span>
           </div>
           <div className="flex items-center gap-2 mb-6">
              <Activity className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Moniteur de Flux</h3>
           </div>
           <TrafficMonitor isDark={isDark} />
        </div>
        
        <div className="glass-card p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-center items-center">
           <div className="flex items-center gap-2 mb-6 self-start">
              <Zap className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Indice d'Anonymat</h3>
           </div>
           <AnonymityScore 
              score={isEmergency ? 10 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 75 : 99) : 0))} 
              isDark={isDark} 
           />
        </div>
      </div>

      {/* Global Network Explorer */}
      <div className="glass-card p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl relative group">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-cyan-500" /> Cartographie Topologique
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Exploration des clusters de sortie mondiaux</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             <div className="relative group">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                <select 
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-cyan-500 transition-all dark:text-white appearance-none cursor-pointer min-w-[160px]"
                >
                  {availableCountries.map(country => (
                    <option key={country} value={country}>
                      {country === 'Tous' ? 'Réseau Global' : country}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>
             
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
    </div>
  );
};
