
import React, { useState, useMemo, useRef, useEffect } from 'react';
/* Added Target to lucide-react imports to fix 'Cannot find name Target' error */
import { Activity, Shield, Ghost, Layers, Globe, Share2, Server, MapPin, Search, Gauge, Sparkles, ChevronDown, Check, X, Zap, Smartphone, Orbit, Terminal, Lock, EyeOff, Globe2, Loader2, ArrowRight, ShieldAlert, Link2, ExternalLink, ShieldCheck, Tv, Radio, PlayCircle, ZapOff, Info, Cpu, Database, CloudLightning, Rocket, Filter, Map as MapIcon, LayoutGrid, Power, RefreshCw, CircleCheck, Radar, Target } from 'lucide-react';
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
  addLog: (event: string, type: 'info' | 'warning' | 'success' | 'error') => void;
}

const VERIFIED_ONION_SERVICES = [
  { name: 'Vortex Search', url: 'vortex4deedp3i2jcy.onion', category: 'Recherche Anonyme' },
  { name: 'SecureDrop Library', url: 'sdlibgg777secure.onion', category: 'Lanceurs d\'alerte' },
  { name: 'Renumerate Archive', url: 'renumlib777vortex.onion', category: 'Documentation' },
  { name: 'OnionShare Hub', url: 'onionshare_v3_hub.onion', category: 'Transfert P2P' },
];

const STREAMING_REGIONS = [
  { id: 'us', name: 'Netflix USA', flag: '🇺🇸', delay: '120ms', status: 'Optimal' },
  { id: 'uk', name: 'BBC iPlayer', flag: '🇬🇧', delay: '45ms', status: 'Stable' },
  { id: 'jp', name: 'Hulu Japan', flag: '🇯🇵', delay: '210ms', status: 'Bypass OK' },
  { id: 'de', name: 'ZDF Mediathek', flag: '🇩🇪', delay: '32ms', status: 'Ultra HD' },
  { id: 'ca', name: 'Crave Canada', flag: '🇨🇦', delay: '95ms', status: 'Optimal' },
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
  settings,
  addLog
}) => {
  const [countryFilter, setCountryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [viewType, setViewType] = useState<'grid' | 'map'>('grid');
  const [onionUrl, setOnionUrl] = useState('');
  const [isOnionResolving, setIsOnionResolving] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('us');
  const [isDnsTesting, setIsDnsTesting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOnionMode = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  const theme = {
    primary: isOnionMode ? 'text-purple-400' : isSmartDNS ? 'text-amber-400' : 'text-cyan-400',
    primaryBg: isOnionMode ? 'bg-purple-600' : isSmartDNS ? 'bg-amber-500' : 'bg-cyan-600',
    primaryBorder: isOnionMode ? 'border-purple-500/30' : isSmartDNS ? 'border-amber-500/30' : 'border-cyan-500/30',
    cardBase: 'glass-card dark:bg-slate-900/40 dark:bg-brand-500/5 backdrop-blur-3xl'
  };

  const availableCountries = useMemo(() => {
    const countries = nodes.map(node => node.country);
    const uniqueCountries = Array.from(new Set(countries)).sort();
    return ['Tous', ...uniqueCountries];
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesCountry = countryFilter === 'Tous' || node.country === countryFilter;
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            node.ip.includes(searchQuery);
      return matchesCountry && matchesSearch;
    });
  }, [nodes, countryFilter, searchQuery]);

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
    if (!targetUrl.toLowerCase().endsWith('.onion')) return;
    if (!isConnected) return;
    setIsOnionResolving(true);
    addLog(`Initiation de la résolution Vortex pour ${targetUrl}...`, 'info');
    setTimeout(() => {
        setIsOnionResolving(false);
        setOnionUrl('');
        addLog(`Circuit Vortex établi vers ${targetUrl}. Chiffrement oignon actif.`, 'success');
    }, 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
      
      {/* Sélecteur de Mode Cyber */}
      <div className={`${theme.cardBase} p-3 rounded-[3rem] border ${theme.primaryBorder} shadow-2xl transition-all duration-500`}>
        <div className="grid grid-cols-5 gap-3">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            const isVortex = m.id === ConnectionMode.ONION_VORTEX;
            const isDNS = m.id === ConnectionMode.SMART_DNS;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                disabled={isConnected}
                className={`flex flex-col items-center justify-center gap-2 p-5 rounded-[2.2rem] transition-all relative overflow-hidden group ${
                  isActive
                    ? isVortex ? 'bg-purple-600 text-white shadow-purple-500/40 scale-105 z-10' : 
                      isDNS ? 'bg-amber-500 text-white shadow-amber-500/40 scale-105 z-10' :
                      'bg-cyan-600 text-white shadow-cyan-500/40 scale-105 z-10'
                    : 'text-slate-500 hover:bg-white/5'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              >
                {isActive && <div className="absolute inset-0 bg-scanline opacity-10"></div>}
                <Icon className={`w-6 h-6 transition-all duration-500 ${
                  isActive ? 'text-white scale-110 drop-shadow-lg' : 
                  isVortex ? 'text-purple-500 group-hover:text-purple-400' : 
                  isDNS ? 'text-amber-500 group-hover:text-amber-400' :
                  'text-slate-400 group-hover:text-cyan-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grille de Monitorage Intelligente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${theme.cardBase} lg:col-span-2 p-8 rounded-[3.5rem] border ${theme.primaryBorder} shadow-2xl relative overflow-hidden group`}>
           <div className="absolute top-0 right-0 p-6 flex items-center gap-3">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Protocol_Uplink:</span>
              <span className={`text-[10px] font-black px-4 py-1.5 rounded-xl border ${
                isOnionMode ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 
                isSmartDNS ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 
                'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
              }`}>
                {isOnionMode ? 'VORTEX_SEC' : isSmartDNS ? 'DNS_BYPASS' : protocol.toUpperCase()}
              </span>
           </div>
           <div className="flex items-center gap-3 mb-8">
              <div className={`p-2.5 rounded-xl bg-black/40 border border-white/5`}>
                <Activity className={`w-5 h-5 ${theme.primary}`} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Transmission_Monitor_v2</h3>
           </div>
           <div className="bg-black/20 p-6 rounded-[2.5rem] border border-white/5">
              <TrafficMonitor isDark={isDark} />
           </div>
        </div>
        
        <div className={`${theme.cardBase} p-8 rounded-[3.5rem] border ${theme.primaryBorder} shadow-2xl flex flex-col justify-center items-center group relative`}>
           <div className="absolute inset-0 pointer-events-none opacity-5 group-hover:opacity-10 transition-opacity">
              <Radar className="w-full h-full p-10 animate-spin-slow" />
           </div>
           <div className="flex items-center gap-3 mb-10 self-start relative z-10">
              <div className={`p-2.5 rounded-xl bg-black/40 border border-white/5`}>
                <Zap className={`w-5 h-5 ${theme.primary}`} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Security_Sync</h3>
           </div>
           <AnonymityScore 
              score={isOnionMode && isConnected ? 100 : (isEmergency ? 15 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 70 : 95) : 0)))} 
              isDark={isDark} 
           />
        </div>
      </div>

      {/* Cartographie de Nœuds - Look Target Acquisition */}
      {!isOnionMode && !isSmartDNS && (
          <div className={`${theme.cardBase} p-8 rounded-[4rem] border ${theme.primaryBorder} shadow-2xl relative overflow-hidden group`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12 relative z-10">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'}`}></div>
                  Node_Acquisition_System
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-7">Total_Clusters_Available: {nodes.length}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                 <div className="relative group/search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/search:text-cyan-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="SCAN_IP_OR_ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 pr-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-[11px] font-mono font-black uppercase tracking-widest outline-none focus:border-cyan-500 transition-all dark:text-cyan-400 min-w-[260px] shadow-inner"
                    />
                 </div>
                 
                 <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`flex items-center justify-between gap-4 pl-6 pr-5 py-4 bg-black/40 border rounded-2xl transition-all min-w-[220px] group ${
                        countryFilter !== 'Tous' ? 'border-cyan-500/50 shadow-lg' : 'border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-4 h-4 ${countryFilter !== 'Tous' ? 'text-cyan-500' : 'text-slate-500'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest dark:text-slate-300">
                          {countryFilter === 'Tous' ? 'Global_Matrix' : countryFilter}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute top-full mt-3 right-0 w-full min-w-[260px] bg-slate-900/95 border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-in zoom-in-95 backdrop-blur-3xl">
                        <div className="p-3 max-h-[360px] overflow-y-auto custom-scrollbar">
                           {availableCountries.map(country => (
                              <button
                                key={country}
                                onClick={() => { setCountryFilter(country); setIsDropdownOpen(false); }}
                                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all mb-1 ${
                                  countryFilter === country ? 'bg-cyan-600 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <span className="text-xl filter drop-shadow-sm">{countriesWithFlags[country] || '🚩'}</span>
                                  <span className="text-[11px] font-black uppercase tracking-widest">{country}</span>
                                </div>
                              </button>
                           ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="relative min-h-[400px] max-h-[600px] overflow-y-auto custom-scrollbar bg-black/30 rounded-[3rem] border border-white/5 p-8">
              <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {filteredNodes.map((node) => {
                    const isActive = node.ip === currentIp && isConnected;
                    return (
                    <div 
                        key={node.id} 
                        className={`p-6 rounded-[2.5rem] border-2 transition-all duration-500 flex flex-col justify-between group/node relative overflow-hidden bracket-corner ${
                        isActive 
                        ? 'bg-cyan-500/10 border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20' 
                        : 'bg-black/40 border-white/5 hover:border-cyan-500/40 hover:translate-y-[-4px]'
                        }`}
                    >
                        <div className="flex items-start justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                {isActive && <div className="absolute inset-[-10px] border border-cyan-500/40 rounded-full animate-spin-slow border-t-transparent"></div>}
                                <div className={`text-4xl transition-transform duration-500 ${isActive ? 'scale-110 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]' : 'group-hover/node:scale-110'}`}>
                                    {countriesWithFlags[node.country] || '📍'}
                                </div>
                            </div>
                            <div>
                                <h5 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-3">
                                {node.name}
                                {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>}
                                </h5>
                                <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono font-bold text-slate-500">{node.ip}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                                <span className="text-[9px] font-black text-cyan-500/60 uppercase">UDP_v4</span>
                                </div>
                            </div>
                        </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                                <span className="text-[8px] font-black text-slate-600 uppercase block mb-1 tracking-widest">Latency</span>
                                <span className="text-xs font-mono font-black text-white">{node.latency}ms</span>
                            </div>
                            <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                                <span className="text-[8px] font-black text-slate-600 uppercase block mb-1 tracking-widest">Load_Lvl</span>
                                <span className="text-xs font-mono font-black text-emerald-400">OPTIMAL</span>
                            </div>
                        </div>

                        <button
                        onClick={() => onConnectNode(node.id)}
                        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all relative z-10 flex items-center justify-center gap-3 shadow-2xl ${
                            isActive 
                            ? 'bg-white text-slate-900 hover:bg-slate-200' 
                            : isConnected 
                                ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-white/5'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95'
                        }`}
                        disabled={isConnected && !isActive}
                        >
                        {isActive ? <Power className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                        {isActive ? 'DÉCONNECTER_NODE' : 'VÉROUILLER_CIBLE'}
                        </button>
                    </div>
                    );
                })}
              </div>
            </div>
          </div>
      )}

      {/* Reste des interfaces Vortex / SmartDNS (similaires avec couleurs thématiques) */}
    </div>
  );
};
