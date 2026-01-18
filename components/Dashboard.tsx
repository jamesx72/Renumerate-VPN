
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Activity, Shield, Ghost, Layers, Globe, Share2, Server, MapPin, Search, Gauge, Sparkles, ChevronDown, Check, X, Zap, Smartphone, Orbit, Terminal, Lock, EyeOff, Globe2, Loader2, ArrowRight, ShieldAlert, Link2, ExternalLink, ShieldCheck, Tv, Radio, PlayCircle, ZapOff, Info, Cpu, Database, CloudLightning, Rocket, Filter, Map as MapIcon, LayoutGrid, Power, RefreshCw, CircleCheck } from 'lucide-react';
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
  settings
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

  // Extraction dynamique des pays depuis la liste des nœuds
  const availableCountries = useMemo(() => {
    const countries = nodes.map(node => node.country);
    const uniqueCountries = Array.from(new Set(countries)).sort();
    return ['Tous', ...uniqueCountries];
  }, [nodes]);

  // Filtrage intelligent des nœuds
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

  const handleTestDns = () => {
    setIsDnsTesting(true);
    setTimeout(() => setIsDnsTesting(false), 2000);
  };

  const isOnionMode = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
      
      {/* Switcher de Mode Dynamique */}
      <div className={`glass-card p-2 rounded-[2.5rem] border shadow-2xl transition-all duration-500 ${
        isOnionMode ? 'border-purple-500/30 shadow-purple-500/10' : 
        isSmartDNS ? 'border-amber-500/30 shadow-amber-500/10' : 
        'border-slate-200 dark:border-slate-800'
      }`}>
        <div className="grid grid-cols-5 gap-2">
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
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-[2rem] transition-all relative group ${
                  isActive
                    ? isVortex ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 
                      isDNS ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' :
                      'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 active:scale-95'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                } ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-500 ${
                  isActive ? 'text-white scale-110' : 
                  isVortex ? 'text-purple-500 group-hover:text-purple-400' : 
                  isDNS ? 'text-amber-500 group-hover:text-amber-400' :
                  'text-slate-400 group-hover:text-cyan-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                  {m.label}
                </span>
                {isActive && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grille d'Analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 glass-card p-6 rounded-[2.5rem] border shadow-xl overflow-hidden relative transition-all duration-500 ${
          isOnionMode ? 'border-purple-500/20' : 
          isSmartDNS ? 'border-amber-500/20' : 
          'border-slate-200 dark:border-slate-800'
        }`}>
           <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol Engine:</span>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                isOnionMode ? 'text-purple-400 bg-purple-500/10 border border-purple-500/20' : 
                isSmartDNS ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 
                'text-cyan-500 bg-cyan-500/10 border border-cyan-500/20'
              }`}>
                {isOnionMode ? 'VORTEX-TOR-NET' : isSmartDNS ? 'SMART-DNS-OPTIM' : protocol.toUpperCase()}
              </span>
           </div>
           <div className="flex items-center gap-2 mb-6">
              <Activity className={`w-4 h-4 ${isOnionMode ? 'text-purple-500' : isSmartDNS ? 'text-amber-500' : 'text-cyan-500'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                {isOnionMode ? 'Flux de Circuit Oignon' : isSmartDNS ? 'Analyse de Streaming DNS' : 'Moniteur de Trafic'}
              </h3>
           </div>
           <TrafficMonitor isDark={isDark} />
        </div>
        
        <div className={`glass-card p-6 rounded-[2.5rem] border shadow-xl flex flex-col justify-center items-center transition-all duration-500 ${
          isOnionMode ? 'border-purple-500/20' : 
          isSmartDNS ? 'border-amber-500/20' : 
          'border-slate-200 dark:border-slate-800'
        }`}>
           <div className="flex items-center gap-2 mb-6 self-start">
              <Zap className={`w-4 h-4 ${isOnionMode ? 'text-purple-500' : isSmartDNS ? 'text-amber-500' : 'text-cyan-500'}`} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Intégrité Tunnel</h3>
           </div>
           <AnonymityScore 
              score={isOnionMode && isConnected ? 100 : (isEmergency ? 15 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 70 : 95) : 0)))} 
              isDark={isDark} 
           />
        </div>
      </div>

      {/* Interface Smart DNS spécifique */}
      {isSmartDNS && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
             <div className="glass-card p-10 rounded-[4rem] border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 cyber-grid opacity-10"></div>
                    <div className="absolute -left-20 -top-20 w-80 h-80 bg-amber-600/10 blur-[120px] rounded-full"></div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                    <div className="flex items-center gap-8">
                        <div className="p-8 bg-amber-500 text-white rounded-[2.5rem] shadow-2xl shadow-amber-600/40 animate-pulse relative">
                            <Tv className="w-14 h-14" />
                            <div className="absolute inset-[-10px] border-2 border-amber-400/30 rounded-full animate-spin-slow"></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.5em]">Selective_Bypass_Engine</span>
                                <div className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded uppercase">LOW LATENCY</div>
                            </div>
                            <h4 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Global Streaming Hub</h4>
                            <p className="text-xs text-slate-500 mt-2">Détournement DNS haute fidélité pour services de streaming mondiaux.</p>
                        </div>
                    </div>

                    <div className="flex bg-slate-900/80 p-3 rounded-[2rem] border border-white/10 shadow-2xl">
                        <div className="flex flex-col p-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase mb-2">DNS_Provider_Target</span>
                            <div className="flex items-center gap-3">
                                <Radio className="w-6 h-6 text-amber-500 animate-pulse" />
                                <span className="text-base font-mono font-black text-white uppercase">{settings.dns} (Tier-1)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
                    {STREAMING_REGIONS.map((region) => (
                        <button
                            key={region.id}
                            onClick={() => setSelectedRegion(region.id)}
                            className={`p-6 rounded-[2.5rem] border transition-all flex flex-col items-start gap-6 group bracket-corner ${
                                selectedRegion === region.id 
                                ? 'bg-amber-500/20 border-amber-500 shadow-2xl shadow-amber-500/20 scale-105 z-10' 
                                : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <span className="text-3xl filter drop-shadow-lg">{region.flag}</span>
                                {selectedRegion === region.id && <PlayCircle className="w-6 h-6 text-amber-500 animate-bounce" />}
                            </div>
                            <div>
                                <h5 className="text-sm font-black text-white uppercase tracking-tight truncate w-full">{region.name}</h5>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`}></div>
                                    <span className="text-[9px] font-mono font-bold text-slate-400">{region.status} • {region.delay}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950/40">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <Zap className="w-6 h-6 text-amber-500" />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Injecteur DNS IA_v2</h3>
                        </div>
                        <button 
                            onClick={handleTestDns}
                            disabled={isDnsTesting}
                            className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                        >
                            {isDnsTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="space-y-3">
                        {[
                            { name: 'Cloudflare (1.1.1.1)', ping: '8ms', score: 98, load: 12 },
                            { name: 'Renumerate Elite DNS', ping: '12ms', score: 100, load: 4 },
                            { name: 'Google (8.8.8.8)', ping: '15ms', score: 94, load: 45 }
                        ].map((dns, i) => (
                            <div key={i} className="p-5 rounded-3xl bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-amber-500/30 transition-all">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        {dns.name}
                                        {dns.score === 100 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                                    </span>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] font-mono text-slate-500">{dns.ping} latency</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                                        <span className="text-[10px] font-mono text-slate-500">Charge: {dns.load}%</span>
                                    </div>
                                </div>
                                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-2 ${dns.score === 100 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {isDnsTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CircleCheck className="w-3 h-3" />}
                                    {dns.score}% SYNC
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="glass-card p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden">
                    <div className="absolute -bottom-10 -right-10 opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                        <PlayCircle className="w-48 h-48 text-amber-500" />
                    </div>
                    <div className="flex items-center gap-4 mb-8">
                        <Info className="w-6 h-6 text-amber-500" />
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Protocoles de Détournement</h3>
                    </div>
                    <div className="space-y-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            Le système **Smart DNS** redirige chirurgicalement vos requêtes sans impacter le reste de votre trafic IP. 
                            <br/><br/>
                            <span className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-[10px] bg-amber-500/10 px-2 py-1 rounded">Metrics_Streaming_v4 :</span>
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <div className="p-1 rounded-md bg-emerald-500 text-white"><Check className="w-3.5 h-3.5" /></div>
                                Zéro Perte de Débit (Vitesse Native)
                            </li>
                            <li className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <div className="p-1 rounded-md bg-emerald-500 text-white"><Check className="w-3.5 h-3.5" /></div>
                                Bypass des Geo-Blocks 4K HDR
                            </li>
                            <li className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <div className="p-1 rounded-md bg-emerald-500 text-white"><Check className="w-3.5 h-3.5" /></div>
                                Masquage des requêtes DNS (HTTPS/TLS)
                            </li>
                        </ul>
                        <div className="mt-6 p-4 bg-black/20 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Statut_Bypass</span>
                                <span className="text-xs font-black text-emerald-500">ENGINE_READY</span>
                            </div>
                            <div className="h-8 w-[1px] bg-white/10"></div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Buffer_IA</span>
                                <span className="text-xs font-black text-amber-500">OPTIMIZED</span>
                            </div>
                        </div>
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* Cartographie Tactique */}
      {!isOnionMode && !isSmartDNS && (
          <div className="glass-card p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl relative group overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 relative z-10">
              <div className="space-y-1">
                <h3 className="text-base font-black uppercase tracking-[0.3em] text-slate-900 dark:text-white flex items-center gap-3">
                  <Share2 className="w-5 h-5 text-cyan-500" /> Centre de Commande Réseau
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Clusters Actifs: <span className="text-cyan-500">{nodes.length}</span>
                  </span>
                  <div className="h-1 w-1 rounded-full bg-slate-400"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Filtrage: <span className="text-emerald-500">{filteredNodes.length}</span>
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                 <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button 
                      onClick={() => setViewType('grid')}
                      className={`p-2.5 rounded-xl transition-all ${viewType === 'grid' ? 'bg-white dark:bg-slate-700 text-cyan-500 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setViewType('map')}
                      className={`p-2.5 rounded-xl transition-all ${viewType === 'map' ? 'bg-white dark:bg-slate-700 text-cyan-500 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <MapIcon className="w-4 h-4" />
                    </button>
                 </div>

                 <div className="relative group/search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/search:text-cyan-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="RECHERCHE_NŒUD..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-11 pr-5 py-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] font-mono font-bold uppercase tracking-widest outline-none focus:border-cyan-500 transition-all dark:text-white min-w-[220px]"
                    />
                 </div>
                 
                 <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`flex items-center justify-between gap-4 pl-5 pr-4 py-4 bg-slate-50 dark:bg-slate-800/80 border rounded-2xl transition-all min-w-[200px] group ${
                        countryFilter !== 'Tous' ? 'border-cyan-500 shadow-lg shadow-cyan-500/10' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-4 h-4 ${countryFilter !== 'Tous' ? 'text-cyan-500' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest dark:text-white">
                          {countryFilter === 'Tous' ? 'Global_Sync' : countryFilter}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute top-full mt-3 right-0 w-full min-w-[240px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-3 max-h-[320px] overflow-y-auto custom-scrollbar">
                           {availableCountries.map(country => {
                            const nodeCount = country === 'Tous' ? nodes.length : nodes.filter(n => n.country === country).length;
                            return (
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
                                <span className={`text-[10px] font-mono font-black ${countryFilter === country ? 'text-white/70' : 'text-slate-400'}`}>
                                  {nodeCount}
                                </span>
                              </button>
                            );
                           })}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="relative min-h-[500px] max-h-[700px] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950/60 rounded-[3rem] border border-slate-100 dark:border-slate-800 p-8 transition-all duration-1000">
              <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none"></div>
              
              {viewType === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                  {filteredNodes.length === 0 ? (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-500 gap-4">
                      <Search className="w-12 h-12 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-widest">Aucun signal détecté sur cette fréquence</p>
                    </div>
                  ) : (
                    filteredNodes.map((node) => {
                      const isActive = node.ip === currentIp && isConnected;
                      const serverLoad = Math.floor(Math.random() * 40) + 10;
                      return (
                        <div 
                          key={node.id} 
                          className={`p-6 rounded-[2rem] border transition-all duration-500 flex flex-col justify-between group/node relative overflow-hidden bracket-corner ${
                            isActive 
                            ? 'bg-cyan-500/10 border-cyan-500 shadow-xl shadow-cyan-500/20 animate-glow ring-2 ring-cyan-500/40' 
                            : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 hover:shadow-lg hover:-translate-y-1'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-cyber-scan pointer-events-none z-0"></div>
                          )}
                          <div className="flex items-start justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                  {isActive && <div className="absolute inset-[-6px] border border-cyan-500/40 rounded-full animate-spin-slow border-t-transparent"></div>}
                                  <div className={`text-3xl transition-transform duration-500 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'group-hover/node:scale-110'}`}>
                                      {countriesWithFlags[node.country] || '📍'}
                                  </div>
                              </div>
                              <div>
                                 <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                   {node.name}
                                   {isActive && (
                                     <span className="relative flex h-2 w-2">
                                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                       <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                     </span>
                                   )}
                                 </h5>
                                 <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">UDP:443</span>
                                    <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                                    <span className="text-[10px] font-mono font-bold text-slate-500">{node.ip}</span>
                                 </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => onConnectNode(node.id)}
                            className={`w-full py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all relative z-10 flex items-center justify-center gap-2 ${
                              isActive 
                              ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-cyan-500/30' 
                              : isConnected 
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] active:scale-95 shadow-xl'
                            }`}
                            disabled={isConnected && !isActive}
                          >
                            {isActive ? (
                              <>
                                <Power className="w-3.5 h-3.5" />
                                DÉCONNECTER
                              </>
                            ) : 'SÉLECTIONNER_LE_NŒUD'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="h-[500px] w-full relative flex items-center justify-center animate-in zoom-in-95 duration-500">
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <Globe2 className="w-96 h-96 text-cyan-500 animate-spin-slow" />
                    </div>
                </div>
              )}
            </div>
          </div>
      )}

      {/* Bloc Neon Identity Storage */}
      <div className="glass-card p-10 rounded-[4rem] border border-brand-500/30 bg-gradient-to-br from-brand-500/5 to-transparent relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 p-10 opacity-[0.05] pointer-events-none group-hover:scale-125 transition-transform duration-1000">
            <Database className="w-48 h-48 text-brand-500" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
            <div className="p-8 bg-brand-600 text-white rounded-[2.5rem] shadow-[0_0_50px_rgba(6,182,212,0.5)] animate-glow border-4 border-white/10">
                <Database className="w-14 h-14" />
            </div>
            <div className="flex-1">
                <div className="flex flex-wrap items-center gap-4 mb-6">
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Identity_Vault</h3>
                    <div className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black rounded-full uppercase flex items-center gap-2">
                        <CloudLightning className="w-3 h-3" /> Neon Serverless Active
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Interface Vortex */}
      {isOnionMode && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            <div className="glass-card p-10 rounded-[4rem] border border-purple-500/30 bg-purple-500/5 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 cyber-grid opacity-10"></div>
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-purple-600/10 blur-[120px] rounded-full"></div>
                </div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                    <div className="flex items-center gap-8">
                        <div className="p-8 bg-purple-600 text-white rounded-[2.5rem] shadow-2xl shadow-purple-600/40 animate-pulse relative">
                            <Orbit className="w-14 h-14" />
                        </div>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
