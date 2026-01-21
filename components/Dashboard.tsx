
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Activity, Shield, Ghost, Layers, Globe, Server, MapPin, Search, 
  Orbit, Terminal, Lock, Globe2, Loader2, ArrowRight, ShieldCheck, 
  Tv, Radio, Info, Cpu, Database, Radar, Target, Box, 
  ChevronDown, ExternalLink, ShieldAlert, Zap, Power, RefreshCw, CheckCircle2,
  Share2, ShieldHalf, Key, Link2, Settings2, Sliders
} from 'lucide-react';
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
  updateSettings?: (key: keyof AppSettings, value: any) => void;
}

const VERIFIED_ONION_SERVICES = [
  { name: 'Vortex Search', url: 'vortex4deedp3i2jcy.onion', category: 'Recherche Anonyme', security: 'High' },
  { name: 'SecureDrop Library', url: 'sdlibgg777secure.onion', category: 'Lanceurs d\'alerte', security: 'Maximum' },
  { name: 'Renumerate Archive', url: 'renumlib777vortex.onion', category: 'Documentation', security: 'Verified' },
  { name: 'OnionShare Hub', url: 'onionshare_v3_hub.onion', category: 'Transfert P2P', security: 'High' },
  { name: 'DuckDuckGo Onion', url: 'duckduckgogg42.onion', category: 'Privacy Search', security: 'Standard' },
  { name: 'NY Times Onion', url: 'nytimes3xpyuniz.onion', category: 'Journalisme', security: 'Standard' },
  { name: 'Vortex Relay', url: 'rel-vx-node-01.onion', category: 'Infrastructure', security: 'Maximum' },
  { name: 'Shadow Wiki', url: 'swiki-core-77.onion', category: 'Encyclopédie', security: 'High' },
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
  addLog,
  updateSettings
}) => {
  const [countryFilter, setCountryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
    cardBase: 'glass-card dark:bg-slate-900/40 backdrop-blur-3xl'
  };

  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesCountry = countryFilter === 'Tous' || node.country === countryFilter;
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            node.ip.includes(searchQuery);
      return matchesCountry && matchesSearch;
    });
  }, [nodes, countryFilter, searchQuery]);

  const getNodeStatusBadge = (node: DeviceNode) => {
    if (node.latency < 30 && node.signalStrength > 90) {
      return { label: 'Optimal', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (node.tags.includes('exit') || node.tags.includes('stealth')) {
      return { label: 'Bypass OK', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    }
    return { label: 'Stable', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
  };

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
        addLog(`Erreur: Format d'adresse .onion invalide.`, 'error');
        return;
    }
    if (!isConnected) {
        addLog(`Liaison requise : Établissez le tunnel avant de résoudre Vortex.`, 'warning');
        return;
    }
    setIsOnionResolving(true);
    addLog(`Initiation de la résolution Vortex pour ${targetUrl}...`, 'info');
    setTimeout(() => {
        setIsOnionResolving(false);
        setOnionUrl('');
        addLog(`Circuit Vortex établi avec succès vers ${targetUrl}. Chiffrement oignon actif.`, 'success');
    }, 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
      
      {/* Mode Selector */}
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

      {/* Monitoring Grid */}
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
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Transmission_Monitor</h3>
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

      {/* Tor Access Hub Section (Vortex Optimized) */}
      {isOnionMode && (
          <div className={`${theme.cardBase} p-1 rounded-[4rem] border ${theme.primaryBorder} shadow-2xl relative overflow-hidden group animate-in fade-in zoom-in-95 duration-500`}>
              <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
              
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-0">
                  {/* Sidebar Quick Config */}
                  <div className="xl:col-span-1 p-8 bg-black/40 border-r border-white/5 space-y-8 relative overflow-hidden">
                      <div className="absolute inset-0 cyber-grid opacity-[0.05]"></div>
                      <div className="relative z-10">
                          <h3 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-3 mb-8">
                              <Settings2 className="w-5 h-5 text-purple-500" />
                              Circuit_Config
                          </h3>
                          
                          <div className="space-y-6">
                              <div className="space-y-3">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Bridge_Tunnel</label>
                                  <div className="grid grid-cols-2 gap-2">
                                      {['obfs4', 'snowflake'].map(b => (
                                          <button 
                                              key={b}
                                              onClick={() => updateSettings?.('vortexBridge', b)}
                                              className={`py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${settings.vortexBridge === b ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-black/20 border-white/10 text-slate-600 hover:text-slate-400'}`}
                                          >
                                              {b}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              
                              <div className="space-y-3">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Circuit_Length</label>
                                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-white/5">
                                      <button onClick={() => updateSettings?.('vortexCircuitLength', Math.max(3, settings.vortexCircuitLength - 1))} className="p-1 hover:bg-white/5 rounded-lg text-slate-400"><Sliders className="w-4 h-4" /></button>
                                      <span className="font-mono font-black text-purple-400">{settings.vortexCircuitLength} Hops</span>
                                      <button onClick={() => updateSettings?.('vortexCircuitLength', Math.min(6, settings.vortexCircuitLength + 1))} className="p-1 hover:bg-white/5 rounded-lg text-slate-400 rotate-180"><Sliders className="w-4 h-4" /></button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Main Content Hub */}
                  <div className="xl:col-span-3 p-8 md:p-10 space-y-10 relative">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-4">
                          <div className="space-y-1">
                              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-4">
                                  <Orbit className="w-8 h-8 text-purple-500 animate-spin-slow" />
                                  Tor_Access_Hub
                              </h3>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-12">Session_Status: {isConnected ? 'Uplink_Active' : 'Offline_Node'}</p>
                          </div>

                          <form onSubmit={handleResolveOnion} className="relative group/form">
                              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 group-focus-within/form:scale-110 transition-transform" />
                              <input 
                                type="text" 
                                placeholder="ENTER_.ONION_ADDRESS..."
                                value={onionUrl}
                                onChange={(e) => setOnionUrl(e.target.value)}
                                className="pl-12 pr-14 py-5 bg-black/60 border border-purple-500/20 rounded-2xl text-xs md:text-sm font-mono font-black uppercase tracking-widest outline-none focus:border-purple-500 transition-all text-purple-400 min-w-[320px] md:min-w-[420px] shadow-inner focus:shadow-[0_0_20px_rgba(168,85,247,0.1)]"
                              />
                              <button 
                                type="submit"
                                disabled={isOnionResolving || !onionUrl.toLowerCase().endsWith('.onion')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-30 disabled:grayscale transition-all shadow-xl active:scale-95 group/btn overflow-hidden"
                              >
                                {isOnionResolving ? <Loader2 className="w-5 h-5 animate-spin" /> : <div className="flex items-center gap-2"><span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Link</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" /></div>}
                              </button>
                          </form>
                      </div>

                      {/* Path Visualization */}
                      <div className="bg-black/20 p-8 rounded-[2.5rem] border border-white/5 relative group overflow-hidden">
                          <div className="absolute inset-0 bg-scanline opacity-[0.03] pointer-events-none"></div>
                          <div className="flex items-center justify-around relative z-10">
                              {[...Array(settings.vortexCircuitLength + 1)].map((_, i) => (
                                  <React.Fragment key={i}>
                                      <div className="flex flex-col items-center gap-3 group/node">
                                          <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all duration-500 ${i === 0 ? 'border-emerald-500 bg-emerald-500/10' : i === settings.vortexCircuitLength ? 'border-purple-500 bg-purple-500/10 animate-pulse' : 'border-slate-700 bg-black/40'} group-hover/node:scale-110`}>
                                              {i === 0 ? <Key className="w-5 h-5 text-emerald-500" /> : i === settings.vortexCircuitLength ? <Globe2 className="w-5 h-5 text-purple-500" /> : <ShieldHalf className="w-5 h-5 text-slate-600" />}
                                          </div>
                                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{i === 0 ? 'ENTRY' : i === settings.vortexCircuitLength ? 'EXIT' : `RELAY_0${i}`}</span>
                                      </div>
                                      {i < settings.vortexCircuitLength && (
                                          <div className="flex-1 max-w-[60px] h-0.5 border-t border-dashed border-slate-800 relative">
                                              <div className="absolute top-1/2 left-0 w-2 h-2 bg-purple-500/30 rounded-full -translate-y-1/2 animate-[shimmer_1.5s_infinite] shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                                          </div>
                                      )}
                                  </React.Fragment>
                              ))}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {VERIFIED_ONION_SERVICES.map((svc) => (
                              <button 
                                key={svc.url}
                                onClick={() => handleResolveOnion(undefined, svc.url)}
                                disabled={!isConnected || isOnionResolving}
                                className="p-6 rounded-[2.5rem] border border-white/5 bg-black/40 hover:border-purple-500/60 hover:bg-purple-500/5 transition-all duration-500 text-left group/svc relative overflow-hidden bracket-corner"
                              >
                                  <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover/svc:opacity-20 transition-opacity">
                                      <Database className="w-24 h-24" />
                                  </div>
                                  <div className="flex items-center justify-between mb-4 relative z-10">
                                      <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 group-hover/svc:scale-110 transition-transform">
                                          <Box className="w-5 h-5" />
                                      </div>
                                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{svc.security}</span>
                                  </div>
                                  
                                  <div className="space-y-1 relative z-10">
                                      <h4 className="text-base font-black text-white uppercase tracking-tight group-hover/svc:text-purple-300 transition-colors">{svc.name}</h4>
                                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{svc.category}</p>
                                  </div>
                                  
                                  <div className="mt-6 font-mono text-[9px] text-purple-400/60 truncate bg-black/50 p-3 rounded-xl border border-white/5 group-hover/svc:text-purple-400 transition-colors">
                                      {svc.url}
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Node Acquisition System */}
      {!isOnionMode && !isSmartDNS && (
          <div className={`${theme.cardBase} p-8 rounded-[4rem] border ${theme.primaryBorder} shadow-2xl relative overflow-hidden group`}>
            <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12 relative z-10">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  Node_Acquisition_Matrix
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-7">Network_Nodes: {nodes.length} | Latency_Optimized: True</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="SCAN_SIGNAL..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 pr-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-[11px] font-mono font-black uppercase tracking-widest outline-none focus:border-cyan-500 transition-all dark:text-cyan-400 min-w-[260px]"
                    />
                 </div>
                 
                 <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="flex items-center justify-between gap-4 pl-6 pr-5 py-4 bg-black/40 border border-white/5 rounded-2xl transition-all min-w-[220px]"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-cyan-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest dark:text-slate-300">
                          {countryFilter === 'Tous' ? 'Global_Uplink' : countryFilter}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute top-full mt-3 right-0 w-full min-w-[260px] bg-slate-900/95 border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 backdrop-blur-3xl">
                        <div className="p-3 max-h-[360px] overflow-y-auto custom-scrollbar">
                           {(['Tous', ...Array.from(new Set(nodes.map(n => n.country))).sort()] as string[]).map(country => (
                              <button
                                key={country}
                                onClick={() => { setCountryFilter(country); setIsDropdownOpen(false); }}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all mb-1 ${
                                  countryFilter === country ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-white/5'
                                }`}
                              >
                                <span className="text-xl">{countriesWithFlags[country] || '🚩'}</span>
                                <span className="text-[11px] font-black uppercase tracking-widest">{country}</span>
                              </button>
                           ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 max-h-[500px] overflow-y-auto p-2 custom-scrollbar">
              {filteredNodes.map((node) => {
                  const isActive = node.ip === currentIp && isConnected;
                  const statusInfo = getNodeStatusBadge(node);
                  return (
                  <div 
                      key={node.id} 
                      className={`p-6 rounded-[2.5rem] border-2 transition-all duration-500 flex flex-col justify-between group/node relative overflow-hidden bracket-corner ${
                      isActive 
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-2xl' 
                      : 'bg-black/40 border-white/5 hover:border-cyan-500/40'
                      }`}
                  >
                      <div className="flex items-start justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="text-4xl filter drop-shadow-lg">{countriesWithFlags[node.country as string] || '📍'}</div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h5 className="text-sm font-black text-white uppercase tracking-tight truncate">{node.name}</h5>
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0 ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                </div>
                                <div className="text-[10px] font-mono font-bold text-slate-500 flex items-center gap-1.5">
                                    <Server className="w-2.5 h-2.5" />
                                    {node.ip}
                                </div>
                            </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-8 relative z-10">
                          <div className="bg-black/40 rounded-2xl p-3 border border-white/5 group-hover/node:border-cyan-500/20 transition-colors">
                              <span className="text-[8px] font-black text-slate-600 uppercase block mb-1 tracking-widest">Latency</span>
                              <div className="flex items-center gap-2">
                                  <Radio className={`w-3 h-3 ${node.latency < 50 ? 'text-emerald-500' : 'text-amber-500'}`} />
                                  <span className="text-xs font-mono font-black text-white">{node.latency}ms</span>
                              </div>
                          </div>
                          <div className="bg-black/40 rounded-2xl p-3 border border-white/5 group-hover/node:border-emerald-500/20 transition-colors">
                              <span className="text-[8px] font-black text-slate-600 uppercase block mb-1 tracking-widest">Security</span>
                              <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                  <span className="text-xs font-mono font-black text-emerald-400">VERIFIED</span>
                              </div>
                          </div>
                      </div>

                      <button
                        onClick={() => onConnectNode(node.id)}
                        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 relative z-10 ${
                            isActive 
                            ? 'bg-white text-slate-900' 
                            : isConnected 
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg'
                        }`}
                        disabled={isConnected && !isActive}
                      >
                        {isActive ? <Power className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                        {isActive ? 'DISCONNECT' : 'INITIALIZE'}
                      </button>
                  </div>
                  );
              })}
            </div>
          </div>
      )}

      {/* Smart DNS Regions */}
      {isSmartDNS && (
          <div className={`${theme.cardBase} p-8 rounded-[4rem] border ${theme.primaryBorder} shadow-2xl relative overflow-hidden group animate-in fade-in zoom-in-95 duration-500`}>
              <div className="absolute inset-0 bg-scanline opacity-[0.02] pointer-events-none"></div>
              
              <div className="mb-10 relative z-10">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-4">
                      <Tv className="w-6 h-6 text-amber-500" />
                      Streaming_Bypass_Matrix
                  </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
                  {STREAMING_REGIONS.map((region) => (
                      <button 
                        key={region.id}
                        onClick={() => setSelectedRegion(region.id)}
                        className={`p-6 rounded-[2.5rem] border transition-all duration-500 text-left ${
                            selectedRegion === region.id 
                            ? 'bg-amber-500/10 border-amber-500/50 shadow-lg' 
                            : 'bg-black/40 border-white/5 hover:border-amber-500/30'
                        }`}
                      >
                          <div className="text-4xl mb-4">{region.flag}</div>
                          <h4 className={`text-xs font-black uppercase mb-1 ${selectedRegion === region.id ? 'text-amber-500' : 'text-white'}`}>{region.name}</h4>
                          <div className="flex items-center justify-between text-[8px] font-black text-slate-500">
                              <span>{region.delay}</span>
                              <span className="text-emerald-500">{region.status}</span>
                          </div>
                      </button>
                  ))}
              </div>

              <div className="mt-8 p-6 bg-black/40 rounded-[2.5rem] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                          <Radio className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active_DNS_Relay</p>
                          <p className="text-sm font-black text-white">Relay tunnel to {STREAMING_REGIONS.find(r => r.id === selectedRegion)?.name}</p>
                      </div>
                  </div>
                  <button 
                    onClick={() => { setIsDnsTesting(true); setTimeout(()=>setIsDnsTesting(false), 2000); }}
                    className="px-6 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all shadow-xl active:scale-95"
                  >
                    {isDnsTesting ? 'TESTING...' : 'RUN_LEAK_TEST'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
