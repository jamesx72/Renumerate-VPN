
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Activity, Shield, Ghost, Layers, Globe, Share2, Server, MapPin, Search, Gauge, Sparkles, ChevronDown, Check, X, Zap, Smartphone, Orbit, Terminal, Lock, EyeOff, Globe2, Loader2, ArrowRight, ShieldAlert, Link2, ExternalLink, ShieldCheck, Tv, Radio, PlayCircle, ZapOff, Info, Cpu, Database, CloudLightning, Rocket } from 'lucide-react';
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
  const [selectedRegion, setSelectedRegion] = useState('us');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const isOnionMode = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
      
      {/* Dynamic Mode Switcher */}
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
                <Icon className={`w-5 h-5 ${
                  isActive ? 'text-white' : 
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

      {/* Analytics Grid */}
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
                isSmartDNS ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' : 
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

      {/* Neon Database Block */}
      <div className="glass-card p-8 rounded-[3rem] border border-brand-500/30 bg-brand-500/5 relative overflow-hidden group shadow-2xl shadow-brand-500/10">
        <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none"></div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-brand-500/10 blur-[120px] rounded-full"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="p-7 bg-brand-600 text-white rounded-[2.5rem] shadow-[0_0_40px_rgba(6,182,212,0.4)] animate-pulse">
                <Database className="w-12 h-12" />
            </div>
            <div className="flex-1">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6 flex items-center gap-3">
                  Neon Database : Identity Storage
                  <div className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded uppercase">Active Serverless</div>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3 group/feat">
                        <div className="flex items-center gap-3 text-brand-500 group-hover/feat:translate-x-1 transition-transform">
                            <Zap className="w-5 h-5" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Effortless setup</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">Get a fully functional database without writing a line of backend code.</p>
                    </div>
                    <div className="space-y-3 group/feat">
                        <div className="flex items-center gap-3 text-emerald-500 group-hover/feat:translate-x-1 transition-transform">
                            <CloudLightning className="w-5 h-5" />
                            <span className="text-[11px] font-black uppercase tracking-widest">All in one place</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">Your code, deploys, and database managed through Netlify, no context switching.</p>
                    </div>
                    <div className="space-y-3 group/feat">
                        <div className="flex items-center gap-3 text-amber-500 group-hover/feat:translate-x-1 transition-transform">
                            <Rocket className="w-5 h-5" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Built to scale</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">Start small and grow without changing your stack or setup.</p>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Vortex Specific UI */}
      {isOnionMode && (
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
      )}

      {/* Smart DNS Specific UI */}
      {isSmartDNS && (
          <div className="space-y-4 animate-in zoom-in-95 duration-500">
             <div className="glass-card p-8 rounded-[3rem] border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 cyber-grid opacity-10"></div>
                    <div className="absolute -left-20 -top-20 w-80 h-80 bg-amber-600/10 blur-[120px] rounded-full"></div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-6 bg-amber-500 text-white rounded-[2rem] shadow-2xl shadow-amber-600/40">
                            <Tv className="w-12 h-12" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">DNS_Selective_Bypass</span>
                                <div className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded uppercase">LOW LATENCY</div>
                            </div>
                            <h4 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Global Streaming Hub</h4>
                            <p className="text-xs text-slate-500 mt-2">Redirection DNS optimisée pour les services de diffusion mondiaux.</p>
                        </div>
                    </div>

                    <div className="flex bg-slate-900/50 p-2 rounded-[2rem] border border-white/5">
                        <div className="flex flex-col p-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase mb-2">DNS_PROVIDER</span>
                            <div className="flex items-center gap-3">
                                <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
                                <span className="text-sm font-mono font-bold text-white uppercase">{settings.dns} (Ultra)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                    {STREAMING_REGIONS.map((region) => (
                        <button
                            key={region.id}
                            onClick={() => setSelectedRegion(region.id)}
                            className={`p-5 rounded-[2rem] border transition-all flex flex-col items-start gap-4 group ${
                                selectedRegion === region.id 
                                ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/10' 
                                : 'bg-white/5 border-white/5 hover:border-white/10'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <span className="text-2xl">{region.flag}</span>
                                {selectedRegion === region.id && <PlayCircle className="w-5 h-5 text-amber-500" />}
                            </div>
                            <div>
                                <h5 className="text-sm font-black text-white">{region.name}</h5>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                                    <span className="text-[10px] font-mono text-slate-400">{region.status} • {region.delay}</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <Zap className="w-5 h-5 text-amber-500" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Optimiseur DNS IA</h3>
                    </div>
                    <div className="space-y-4">
                        {[
                            { name: 'Cloudflare (1.1.1.1)', ping: '8ms', score: 98 },
                            { name: 'Google (8.8.8.8)', ping: '12ms', score: 94 },
                            { name: 'Renumerate Private', ping: '15ms', score: 100 }
                        ].map((dns, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800 dark:text-white">{dns.name}</span>
                                    <span className="text-[10px] font-mono text-slate-500">{dns.ping} • Latence Locale</span>
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${dns.score === 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {dns.score}% SYNC
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="glass-card p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl bg-gradient-to-br from-amber-500/5 to-transparent">
                    <div className="flex items-center gap-3 mb-6">
                        <Info className="w-5 h-5 text-amber-500" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Comment ça marche ?</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Le **Smart DNS** de Renumerate ne chiffre pas l'intégralité de votre trafic, mais redirige uniquement vos requêtes DNS. 
                        <br/><br/>
                        <span className="text-white font-bold">Avantages :</span>
                        <ul className="list-disc ml-4 mt-2 space-y-1">
                            <li>Zéro perte de vitesse de téléchargement.</li>
                            <li>Déblocage géo-localisé ultra-rapide.</li>
                            <li>Compatible avec les Smart TVs et Consoles.</li>
                        </ul>
                    </p>
                </div>
             </div>
          </div>
      )}

      {/* Cartographie des Nœuds interactive */}
      {!isOnionMode && !isSmartDNS && (
          <div className="glass-card p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl relative group overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10 relative z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-cyan-500" /> Cartographie des Nœuds
                  </h3>
                  <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-mono font-black text-slate-500">
                    {filteredNodes.length} NŒUDS FILTRÉS
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

            {/* Grille de nœuds filtrés */}
            <div className="relative min-h-[400px] max-h-[600px] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950/60 rounded-[3rem] border border-slate-100 dark:border-slate-800 p-8 transition-all duration-1000">
              <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none"></div>
              
              {filteredNodes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                  <Search className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-black uppercase tracking-widest">Aucun nœud trouvé pour cette recherche</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                  {filteredNodes.map((node) => {
                    const isActive = node.ip === currentIp && isConnected;
                    return (
                      <div 
                        key={node.id} 
                        className={`p-6 rounded-[2.5rem] border transition-all duration-500 flex flex-col justify-between group/node relative overflow-hidden ${
                          isActive 
                          ? 'bg-cyan-500/10 border-cyan-500 shadow-xl shadow-cyan-500/10 animate-glow' 
                          : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 hover:shadow-lg'
                        }`}
                      >
                        {/* Scanline subtile pour les nœuds actifs */}
                        {isActive && (
                          <div className="absolute inset-0 bg-scanline opacity-[0.05] pointer-events-none animate-scanline"></div>
                        )}

                        <div className="flex items-start justify-between mb-4 relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl transition-transform group-hover/node:scale-110 duration-500">{countriesWithFlags[node.country] || '📍'}</div>
                            <div>
                               <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{node.name}</h5>
                               <p className="text-[10px] font-mono font-bold text-slate-500">{node.ip}</p>
                            </div>
                          </div>
                          {isActive && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">ACTIVE_LINK</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-100 dark:border-white/5 relative z-10">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Délai</span>
                              <span className="text-xs font-mono font-black text-slate-700 dark:text-slate-300">{node.latency}ms</span>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Signal</span>
                              <span className="text-xs font-mono font-black text-emerald-500">{node.signalStrength}%</span>
                           </div>
                        </div>

                        <button
                          onClick={() => onConnectNode(node.id)}
                          disabled={isActive || isConnected}
                          className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all relative z-10 ${
                            isActive 
                            ? 'bg-cyan-500 text-white cursor-default' 
                            : isConnected 
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] active:scale-95 shadow-lg'
                          }`}
                        >
                          {isActive ? 'NŒUD CONNECTÉ' : 'SÉLECTIONNER'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Central Connection Overlay if connected */}
              {isConnected && activeNode && (
                <div className="mt-12 sticky bottom-0 z-20 pointer-events-none">
                    <div className="px-10 py-6 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/50 rounded-[3rem] shadow-2xl shadow-cyan-500/30 flex items-center justify-between group/active relative overflow-hidden max-w-2xl mx-auto pointer-events-auto animate-in slide-in-from-bottom-4">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-shimmer"></div>
                      <div className="flex items-center gap-6">
                        <div className="p-4 bg-cyan-600 text-white rounded-[1.5rem] shadow-xl animate-glow">
                          <Smartphone className="w-8 h-8 animate-bounce" />
                        </div>
                        <div className="flex flex-col">
                          <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em] mb-1">Cyber-Link Tunnel : ON</div>
                          <div className="flex items-center gap-3">
                             <span className="text-2xl">{countriesWithFlags[activeNode.country] || '📍'}</span>
                             <span className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">{activeNode.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 pl-8 border-l border-slate-200 dark:border-slate-800 text-right">
                         <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Latence_Sync</div>
                         <div className="text-2xl font-mono font-black text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{activeNode.latency}ms</div>
                      </div>
                    </div>
                </div>
              )}
            </div>
          </div>
      )}
    </div>
  );
};
