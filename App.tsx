import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  RefreshCw, 
  Power, 
  Activity, 
  Cpu, 
  Lock, 
  Terminal, 
  Bot,
  Layers,
  WifiOff,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Globe,
  MapPin,
  Sun,
  Moon,
  Share2,
  ArrowDown,
  ArrowUp,
  Coins,
  Wallet,
  TrendingUp,
  Signal,
  Info,
  CheckCircle2
} from 'lucide-react';
import { VirtualIdentity, ConnectionMode, SecurityReport, LogEntry } from './types';
import { MOCK_IDENTITIES, INITIAL_LOGS } from './constants';
import { analyzeSecurity } from './services/geminiService';
import { TrafficMonitor, AnonymityScore } from './components/DashboardCharts';
import { IdentityMatrix } from './components/IdentityMatrix';
import { SecureFileTransfer } from './components/SecureFileTransfer';

// Helper Component for Signal Strength
const SignalIndicator = ({ ms }: { ms: number }) => (
  <div className="flex items-end gap-[1px] h-3" title={`${ms} ms`}>
    <div className={`w-1 rounded-[1px] ${ms < 200 ? 'bg-emerald-500' : 'bg-red-500'} h-1.5`}></div>
    <div className={`w-1 rounded-[1px] ${ms < 100 ? 'bg-emerald-500' : ms < 200 ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-700'} h-2`}></div>
    <div className={`w-1 rounded-[1px] ${ms < 50 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'} h-3`}></div>
  </div>
);

const App: React.FC = () => {
  // State
  // Initialize theme from localStorage or system preference
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('renumerate-theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark'; // Fallback
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [currentIdentity, setCurrentIdentity] = useState<VirtualIdentity>(MOCK_IDENTITIES[0]);
  const [mode, setMode] = useState<ConnectionMode>(ConnectionMode.STANDARD);
  const [selectedLocation, setSelectedLocation] = useState<string>('Auto');
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [isEmergencyRenumbering, setIsEmergencyRenumbering] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS as LogEntry[]);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(true);
  const [trafficStats, setTrafficStats] = useState({ down: 0, up: 0 });
  const [earnings, setEarnings] = useState(12.45); // Initial wallet balance simulation
  const [showEarningsInfo, setShowEarningsInfo] = useState(false);

  // Derived State
  const locations = useMemo(() => Array.from(new Set(MOCK_IDENTITIES.map(id => id.country))), []);

  // Theme Effect: Apply class and save to localStorage
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('renumerate-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Refs for intervals
  const rotationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uptimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper: Add Log
  const addLog = useCallback((event: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      event,
      type
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  // AI Handler (Moved up to be accessible by renumerate)
  const handleAIAnalysis = useCallback(async (identity: VirtualIdentity) => {
    setIsAnalyzing(true);
    try {
      const report = await analyzeSecurity(mode, identity.country, identity.ip);
      setSecurityReport(report);
      addLog('Analyse de sécurité IA mise à jour', 'info');
    } catch (e) {
      addLog('Échec analyse IA', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [mode, addLog]);

  // Action: Rotate Identity (Renumerate)
  const renumerate = useCallback(() => {
    setIsRenumbering(true);
    addLog(`Renumérotation identité (${selectedLocation === 'Auto' ? 'Optimisée' : selectedLocation}) en cours...`, 'warning');
    
    // Simulate network delay
    setTimeout(() => {
      // Filter candidates based on selected location
      let candidates = MOCK_IDENTITIES;
      if (selectedLocation !== 'Auto') {
        candidates = MOCK_IDENTITIES.filter(id => id.country === selectedLocation);
      }
      
      // Fallback if no candidates (shouldn't happen with mock data)
      if (candidates.length === 0) candidates = MOCK_IDENTITIES;

      const randomIndex = Math.floor(Math.random() * candidates.length);
      const newId = candidates[randomIndex];
      setCurrentIdentity(newId);
      setIsRenumbering(false);
      addLog(`Nouvelle identité acquise : ${newId.ip} (${newId.country})`, 'success');
      
      // Trigger AI analysis on new identity
      handleAIAnalysis(newId);
    }, 1200);
  }, [addLog, selectedLocation, handleAIAnalysis]);

  // Action: Share Identity
  const shareIdentity = useCallback(async () => {
    if (!isConnected) return;
    
    const textToShare = `🔒 Identité Renumerate VPN\n\nIP: ${currentIdentity.ip}\nPays: ${currentIdentity.country}\nUser Agent: ${currentIdentity.userAgentShort}\n\nProtégé par le mode ${mode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mon Identité VPN',
          text: textToShare,
        });
        addLog('Identité partagée avec succès', 'success');
      } catch (err) {
        // User cancelled or error, ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(textToShare);
        addLog('Identité copiée dans le presse-papier', 'success');
      } catch (err) {
        addLog('Erreur lors du partage', 'error');
      }
    }
  }, [isConnected, currentIdentity, mode, addLog]);

  // Toggle Connection
  const toggleConnection = () => {
    if (isConnected || isDisconnecting) {
      // Disconnect
      setIsConnected(false);
      setIsDisconnecting(false);
      setUptime(0);
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
      if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);
      addLog('Déconnexion du réseau sécurisé', 'warning');
      setSecurityReport(null);
    } else {
      // Connect
      setIsConnected(true);
      addLog(`Connexion au serveur ${selectedLocation === 'Auto' ? 'le plus rapide' : selectedLocation}...`, 'info');
      setTimeout(() => {
        // Initial Identity Pick based on location
        let candidates = MOCK_IDENTITIES;
        if (selectedLocation !== 'Auto') {
          candidates = MOCK_IDENTITIES.filter(id => id.country === selectedLocation);
        }
        const initialId = candidates[Math.floor(Math.random() * candidates.length)];
        setCurrentIdentity(initialId);

        setIsConnected(true);
        addLog('Connexion établie. Tunnel chiffré actif.', 'success');
        handleAIAnalysis(initialId);
      }, 1000);
    }
  };

  // Simulate Accidental Drop (Kill Switch Trigger)
  const simulateNetworkDrop = useCallback(() => {
    if (!isConnected) return;

    // 1. Trigger Disconnecting Animation
    setIsDisconnecting(true);
    addLog('⚠️ ALERTE : Instabilité du signal détectée...', 'warning');

    // 2. Delayed Disconnect after animation
    setTimeout(() => {
      setIsDisconnecting(false);
      setIsConnected(false);
      setUptime(0);
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
      if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);
      
      addLog('⚠️ ALERTE : Perte de connexion confirmée !', 'error');

      if (killSwitchEnabled) {
        addLog('🛡️ KILL SWITCH ACTIVÉ : Trafic internet bloqué.', 'warning');
        addLog('🔄 Lancement protocole renumérotation d\'urgence...', 'info');
        
        setIsRenumbering(true);
        setIsEmergencyRenumbering(true);

        // 3. Forced Renumeration & Reconnect
        setTimeout(() => {
          let candidates = MOCK_IDENTITIES;
          if (selectedLocation !== 'Auto') {
            candidates = MOCK_IDENTITIES.filter(id => id.country === selectedLocation);
          }
          // Fallback
          if (candidates.length === 0) candidates = MOCK_IDENTITIES;

          const newId = candidates[Math.floor(Math.random() * candidates.length)];

          setCurrentIdentity(newId);
          
          setIsConnected(true);
          setIsRenumbering(false);
          setIsEmergencyRenumbering(false);
          
          addLog(`✅ Connexion rétablie. Nouvelle IP d'urgence : ${newId.ip}`, 'success');
          handleAIAnalysis(newId);
        }, 3000); // 3 seconds for emergency effect
      } else {
        addLog('❌ Kill Switch désactivé. Votre IP réelle est exposée.', 'error');
      }
    }, 1500); // 1.5s delay for animation
  }, [isConnected, killSwitchEnabled, addLog, selectedLocation, handleAIAnalysis]);


  // Effect: Handle Rotation based on Mode
  useEffect(() => {
    if (!isConnected) return;

    // Define rate based on mode
    let rate = 0.00042; // Standard
    if (mode === ConnectionMode.DOUBLE_HOP) rate = 0.00064;
    if (mode === ConnectionMode.STEALTH) rate = 0.00092;

    if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);
    uptimeIntervalRef.current = setInterval(() => {
      setUptime(u => u + 1);
      // Simulate earning money while connected
      setEarnings(prev => prev + rate);
    }, 1000);

    if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);

    if (mode === ConnectionMode.STEALTH) {
      // Fast rotation in stealth mode (every 10s for demo purposes)
      rotationIntervalRef.current = setInterval(renumerate, 10000);
    } else {
      // Standard rotation (slower, just manual or long interval)
      rotationIntervalRef.current = setInterval(renumerate, 300000); // 5 mins
    }

    return () => {
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
      if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);
    };
  }, [isConnected, mode, renumerate]);

  // Effect: Simulate Traffic Stats
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isConnected && !isDisconnecting) {
        // Initial stats
        setTrafficStats({
            down: Math.floor(Math.random() * (120 - 40) + 40),
            up: Math.floor(Math.random() * (40 - 10) + 10)
        });
        
        interval = setInterval(() => {
             setTrafficStats({
                down: Math.floor(Math.random() * (120 - 40) + 40),
                up: Math.floor(Math.random() * (40 - 10) + 10)
            });
        }, 2000);
    } else {
        setTrafficStats({ down: 0, up: 0 });
    }
    return () => clearInterval(interval);
  }, [isConnected, isDisconnecting]);

  // Format Uptime
  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getEarningRate = () => {
    switch (mode) {
      case ConnectionMode.STEALTH: return 0.00092;
      case ConnectionMode.DOUBLE_HOP: return 0.00064;
      default: return 0.00042;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans selection:bg-brand-500 selection:text-white pb-10 transition-colors duration-300">
      
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-brand-500 flex items-center justify-center">
              <RefreshCw className={`w-5 h-5 text-white ${isConnected ? 'animate-spin-slow' : ''}`} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-none">Renumerate VPN</h1>
              <span className="text-[10px] text-brand-600 dark:text-brand-400 uppercase tracking-widest font-mono">Quantum Identity Layer</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button
               onClick={toggleTheme}
               className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors mr-2"
               aria-label="Toggle Theme"
             >
               {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>

             <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-wider border transition-colors duration-300 ${
                mode === ConnectionMode.STEALTH 
                  ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400' 
                  : mode === ConnectionMode.DOUBLE_HOP 
                    ? 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400'
                    : 'bg-brand-100 dark:bg-brand-500/10 border-brand-300 dark:border-brand-500/30 text-brand-700 dark:text-brand-400'
             }`}>
               {mode === ConnectionMode.STEALTH && <ShieldAlert className="w-3 h-3" />}
               {mode === ConnectionMode.DOUBLE_HOP && <Layers className="w-3 h-3" />}
               {mode === ConnectionMode.STANDARD && <Shield className="w-3 h-3" />}
               {mode.toUpperCase()}
             </div>

             <div className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-300 ${
               isDisconnecting 
                 ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 animate-shake'
                 : isConnected 
                    ? 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-400' 
                    : 'bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-400'
             }`}>
               {isDisconnecting ? 'DÉCONNEXION...' : isConnected ? 'SÉCURISÉ' : 'NON PROTÉGÉ'}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Controls & Stats (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Main Control Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden group transition-colors duration-300 min-h-[500px]">
            
            {/* Ambient Backgrounds */}
            {isConnected && mode === ConnectionMode.STEALTH && !isEmergencyRenumbering && !isDisconnecting && (
               <div className="absolute inset-0 bg-amber-500/5 dark:bg-amber-500/5 animate-pulse pointer-events-none z-0"></div>
            )}
            
            {isConnected && mode === ConnectionMode.DOUBLE_HOP && !isEmergencyRenumbering && !isDisconnecting && (
               <div className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/5 animate-pulse pointer-events-none z-0"></div>
            )}

            {/* Mode Banner Indicator - NEW */}
            <div className={`absolute top-0 left-0 right-0 py-2 flex items-center justify-center gap-2 z-20 transition-transform duration-500 ${
              isConnected && !isDisconnecting && (mode === ConnectionMode.STEALTH || mode === ConnectionMode.DOUBLE_HOP)
                ? 'translate-y-0'
                : '-translate-y-full'
            } ${
              mode === ConnectionMode.STEALTH 
                ? 'bg-amber-500 dark:bg-amber-600 text-white shadow-lg shadow-amber-500/20' 
                : 'bg-indigo-500 dark:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
            }`}>
              {mode === ConnectionMode.STEALTH ? (
                <>
                  <ShieldAlert className="w-4 h-4 animate-pulse" />
                  <span className="text-xs font-bold tracking-widest uppercase">Mode Furtif Actif</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 animate-bounce" />
                  <span className="text-xs font-bold tracking-widest uppercase">Double Hop Actif</span>
                </>
              )}
            </div>

            {/* Kill Switch Overlay */}
            {isEmergencyRenumbering && (
               <div className="absolute inset-0 z-30 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center backdrop-blur-sm border-2 border-red-500/50 rounded-2xl p-6 text-center animate-pulse">
                 <AlertTriangle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
                 <h3 className="text-red-600 dark:text-red-500 font-bold text-xl tracking-wider mb-2">KILL SWITCH ENGAGED</h3>
                 <p className="text-red-500 dark:text-red-400/80 text-sm font-mono mb-6">Connexion coupée. Renumérotation d'urgence en cours...</p>
                 <div className="w-full max-w-[200px] h-1.5 bg-red-200 dark:bg-red-900/30 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-full animate-[pulse_1s_ease-in-out_infinite]"></div>
                 </div>
               </div>
            )}

            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity z-0">
              <Shield className="w-32 h-32 text-brand-500" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center pt-6">
              
              {/* Power Button Container with Animation Effects */}
              <div className="relative mb-6">
                {/* Stealth Ring Animation */}
                {isConnected && mode === ConnectionMode.STEALTH && !isDisconnecting && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-4 border-amber-500/30 animate-ping pointer-events-none"></div>
                )}
                
                {/* Double Hop Spinner Animation */}
                {isConnected && mode === ConnectionMode.DOUBLE_HOP && !isDisconnecting && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-dashed border-indigo-500/40 animate-spin-slow pointer-events-none"></div>
                )}

                <button 
                  onClick={toggleConnection}
                  className={`w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all duration-300 shadow-xl dark:shadow-[0_0_30px_rgba(0,0,0,0.5)] relative z-10 ${
                    isConnected 
                      ? isDisconnecting
                          ? 'bg-amber-100 dark:bg-amber-600/20 border-amber-400 dark:border-amber-500/50 text-amber-500 dark:text-amber-400 shadow-none'
                          : mode === ConnectionMode.STEALTH 
                            ? 'bg-amber-500 dark:bg-amber-600 border-amber-300 dark:border-amber-400 shadow-amber-500/30 dark:shadow-amber-500/50 hover:shadow-amber-500/50' 
                            : mode === ConnectionMode.DOUBLE_HOP
                              ? 'bg-indigo-500 dark:bg-indigo-600 border-indigo-300 dark:border-indigo-400 shadow-indigo-500/30 dark:shadow-indigo-500/50 hover:shadow-indigo-500/50'
                              : 'bg-brand-500 border-brand-300 dark:border-brand-400 shadow-brand-500/20 dark:shadow-brand-500/30 hover:shadow-brand-500/40'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {isDisconnecting ? (
                     <WifiOff className="w-10 h-10 text-amber-500 dark:text-amber-400 animate-pulse" />
                  ) : (
                     <Power className={`w-10 h-10 ${isConnected ? 'text-white' : 'text-slate-400'}`} />
                  )}
                </button>
              </div>

              <div className="text-center w-full">
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">État de la connexion</p>
                <h2 className={`text-2xl font-bold transition-colors duration-300 ${
                  isDisconnecting
                    ? 'text-amber-500 dark:text-amber-400 animate-pulse'
                    : isConnected 
                      ? mode === ConnectionMode.STEALTH 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : mode === ConnectionMode.DOUBLE_HOP
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-900 dark:text-white'
                      : 'text-slate-500'
                }`}>
                  {isDisconnecting ? 'Perte Signal...' : isConnected ? 'Connecté' : 'Déconnecté'}
                </h2>
                
                {/* Status Indicators */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  {isDisconnecting ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 animate-shake flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        INTERRUPTION...
                      </span>
                  ) : isConnected ? (
                    <>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        mode === ConnectionMode.STEALTH 
                          ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' 
                          : mode === ConnectionMode.DOUBLE_HOP 
                            ? 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                            : 'bg-brand-100 dark:bg-brand-500/10 border-brand-300 dark:border-brand-500/30 text-brand-600 dark:text-brand-400'
                      }`}>
                        {mode === ConnectionMode.STEALTH && <ShieldAlert className="w-3 h-3" />}
                        {mode === ConnectionMode.DOUBLE_HOP && <Layers className="w-3 h-3" />}
                        {mode === ConnectionMode.STANDARD && <Shield className="w-3 h-3" />}
                        {mode.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                        SÉCURISÉ
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      NON PROTÉGÉ
                    </span>
                  )}
                </div>

                {/* Traffic Stats Display */}
                {isConnected && !isDisconnecting && (
                    <div className="flex items-center justify-center gap-8 mt-6">
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mb-0.5">
                                <ArrowDown className="w-3 h-3" />
                                <span className="text-[10px] font-bold tracking-wider uppercase">Down</span>
                             </div>
                             <span className="text-xl font-mono font-bold text-slate-700 dark:text-slate-200">
                                {trafficStats.down} <span className="text-sm font-normal text-slate-500">Mb/s</span>
                             </span>
                        </div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mb-0.5">
                                <ArrowUp className="w-3 h-3" />
                                <span className="text-[10px] font-bold tracking-wider uppercase">Up</span>
                             </div>
                             <span className="text-xl font-mono font-bold text-slate-700 dark:text-slate-200">
                                {trafficStats.up} <span className="text-sm font-normal text-slate-500">Mb/s</span>
                             </span>
                        </div>
                    </div>
                )}

                {isConnected && !isDisconnecting && (
                  <div className={`mt-5 flex flex-col items-center transition-all duration-500 ${isRenumbering ? 'opacity-50 scale-95 blur-[0.5px]' : 'opacity-100 scale-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-inner mb-2 group cursor-default hover:border-brand-300 dark:hover:border-brand-500/30 transition-colors">
                         <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 tracking-wider group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{currentIdentity.ip}</span>
                      </div>
                      
                      <button 
                        onClick={shareIdentity}
                        className="p-2 -mt-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-brand-500/20 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shadow-sm"
                        title="Partager l'identité"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex flex-col items-center gap-1 mt-1">
                       <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                          <Globe className="w-3.5 h-3.5 text-brand-500" />
                          <span>{currentIdentity.country}</span>
                       </div>
                       <span className="font-mono text-xs text-brand-600/70 dark:text-brand-400/70 tracking-wide">{formatUptime(uptime)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Renumber Button - Enhanced */}
              <button
                onClick={renumerate}
                disabled={!isConnected || isRenumbering || isDisconnecting}
                className={`mt-8 w-full max-w-[200px] py-3 rounded-xl border transition-all duration-300 flex items-center justify-center gap-3 text-sm font-bold tracking-wide uppercase shadow-lg relative overflow-hidden group/renum ${
                  isConnected && !isDisconnecting
                    ? 'bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-400/5 border-brand-200 dark:border-brand-500/30 text-brand-600 dark:text-brand-400 hover:border-brand-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]' 
                    : 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                {isConnected && !isRenumbering && !isDisconnecting && (
                  <div className="absolute inset-0 bg-brand-400/5 translate-y-full group-hover/renum:translate-y-0 transition-transform duration-300"></div>
                )}
                
                {isRenumbering ? (
                   <div className="relative z-10 flex items-center gap-3 w-full justify-center px-4">
                     <RefreshCw className="w-4 h-4 animate-spin text-brand-600 dark:text-brand-400" />
                     <div className="h-1 flex-1 bg-brand-200/50 dark:bg-brand-900/50 rounded-full overflow-hidden">
                       <div className="h-full bg-brand-500 dark:bg-brand-400 w-1/2 animate-shimmer origin-left"></div>
                     </div>
                   </div>
                ) : (
                  <>
                    <RefreshCw className={`w-4 h-4 relative z-10 ${isConnected && !isDisconnecting ? 'group-hover/renum:rotate-180 transition-transform duration-500' : ''}`} />
                    <span className="relative z-10">Renuméroter</span>
                  </>
                )}
              </button>
            </div>

            {/* Server List */}
            <div className="mt-8 w-full flex-1 min-h-0 flex flex-col">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2 px-1">
                <Globe className="w-3 h-3" />
                Réseau de Serveurs
              </h3>
              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 max-h-48">
                {/* Auto Option */}
                <button
                  onClick={() => setSelectedLocation('Auto')}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-medium text-left transition-all border flex items-center justify-between group ${
                    selectedLocation === 'Auto'
                      ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selectedLocation === 'Auto' ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block font-bold text-sm">Sélection Automatique</span>
                      <span className="text-[10px] opacity-70">Connexion optimisée (latence min.)</span>
                    </div>
                  </div>
                  {selectedLocation === 'Auto' && <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />}
                </button>

                {/* Server Items */}
                {MOCK_IDENTITIES.map((identity) => (
                  <button
                    key={identity.country}
                    onClick={() => setSelectedLocation(identity.country)}
                    className={`w-full px-4 py-3 rounded-xl text-xs font-medium text-left transition-all border flex items-center justify-between group ${
                      selectedLocation === identity.country
                        ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg font-mono text-lg leading-none flex items-center justify-center w-8 h-8 ${selectedLocation === identity.country ? 'bg-brand-100 dark:bg-brand-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <span className="text-xs font-bold">{identity.country.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <span className="block font-bold text-sm text-slate-700 dark:text-slate-200">{identity.city}</span>
                           <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{identity.country}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                           <SignalIndicator ms={identity.latency} />
                           <span className="text-[10px] font-mono opacity-70">{identity.latency} ms</span>
                        </div>
                      </div>
                    </div>
                    {selectedLocation === identity.country && <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Selector */}
            <div className="mt-6 flex flex-col gap-3">
              {[ConnectionMode.STANDARD, ConnectionMode.DOUBLE_HOP, ConnectionMode.STEALTH].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={!isConnected || isDisconnecting}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center ${
                    mode === m 
                      ? m === ConnectionMode.STEALTH
                        ? 'bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-400'
                        : m === ConnectionMode.DOUBLE_HOP
                          ? 'bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-400'
                          : 'bg-brand-100 dark:bg-brand-500/10 border border-brand-300 dark:border-brand-500/50 text-brand-700 dark:text-brand-400' 
                      : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                  } ${!isConnected || isDisconnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {m === ConnectionMode.STEALTH && <ShieldAlert className="w-4 h-4 mr-2" />}
                  {m === ConnectionMode.DOUBLE_HOP && <Layers className="w-4 h-4 mr-2" />}
                  {m === ConnectionMode.STANDARD && <Shield className="w-4 h-4 mr-2" />}
                  {m}
                </button>
              ))}
            </div>

            {/* Kill Switch & Simulation Controls */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${killSwitchEnabled ? 'bg-red-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`}></div>
                  <span className={`text-xs font-medium ${killSwitchEnabled ? 'text-red-500 dark:text-red-400' : 'text-slate-500'}`}>Kill Switch Avancé</span>
                </div>
                <button 
                  onClick={() => setKillSwitchEnabled(!killSwitchEnabled)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  {killSwitchEnabled ? <ToggleRight className="w-6 h-6 text-red-500" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>

              {isConnected && (
                <button
                  onClick={simulateNetworkDrop}
                  disabled={isDisconnecting}
                  className={`w-full py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all group ${isDisconnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <WifiOff className="w-3 h-3 group-hover:scale-110 transition-transform" />
                  Simuler Coupure Réseau
                </button>
              )}
            </div>

            {mode === ConnectionMode.STEALTH && isConnected && !isDisconnecting && (
              <p className="text-[10px] text-amber-600 dark:text-amber-500/70 mt-3 text-center animate-pulse">
                Rotation agressive activée (10s)
              </p>
            )}
            {mode === ConnectionMode.DOUBLE_HOP && isConnected && !isDisconnecting && (
              <p className="text-[10px] text-indigo-600 dark:text-indigo-500/70 mt-3 text-center">
                Tunnel double nœud actif (2 Relais)
              </p>
            )}
          </div>

          {/* Traffic Graph */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Trafic Réseau
            </h3>
            {isConnected ? (
              <TrafficMonitor isDark={theme === 'dark'} />
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-950/50 rounded-lg">
                Aucune donnée
              </div>
            )}
          </div>

          {/* Digital Rewards Card (New Feature) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300 overflow-hidden relative">
            {isConnected && !isDisconnecting && (
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            )}
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Coins className="w-4 h-4" /> Récompenses Digitales
            </h3>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-end justify-between">
                <div>
                   <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">Solde de session</p>
                   <div className="text-3xl font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      ${earnings.toFixed(6)}
                   </div>
                </div>
                <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-slate-50 dark:bg-slate-800'}`}>
                   <Wallet className={`w-5 h-5 ${isConnected ? 'text-emerald-500' : 'text-slate-400'}`} />
                </div>
              </div>

              <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
                isConnected 
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'
              }`}>
                <TrendingUp className="w-3.5 h-3.5" />
                {isConnected ? (
                  <div className="flex justify-between w-full">
                    <span className="flex items-center gap-1">
                      Taux: <span className="font-mono font-bold">+{getEarningRate().toFixed(5)}/s</span>
                    </span>
                     <span className="opacity-70">
                       ~${(getEarningRate() * 3600).toFixed(2)}/h
                     </span>
                  </div>
                ) : (
                  <span>Minage inactif</span>
                )}
              </div>
              
              {/* Projections Section */}
              {isConnected && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-100 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Est. 24h</span>
                          <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                              ${(getEarningRate() * 86400).toFixed(2)}
                          </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-100 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Est. 30j</span>
                          <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                              ${(getEarningRate() * 86400 * 30).toFixed(2)}
                          </div>
                      </div>
                  </div>
              )}
              
              {showEarningsInfo && (
                  <div className="mt-2 bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg text-xs text-brand-800 dark:text-brand-300 border border-brand-100 dark:border-brand-500/20 animate-in fade-in slide-in-from-top-2">
                     <div className="flex gap-2 mb-2">
                         <Info className="w-4 h-4 shrink-0 mt-0.5" />
                         <p>Contribuez au réseau décentralisé en partageant votre bande passante sécurisée.</p>
                     </div>
                     <ul className="space-y-1 ml-6 list-disc opacity-90">
                         <li>Standard: Rémunération de base</li>
                         <li>Double Hop: x1.5 (plus de ressources)</li>
                         <li>Furtif: x2.2 (nœud de sortie critique)</li>
                     </ul>
                  </div>
              )}

              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden mt-1">
                {isConnected && (
                  <div className="h-full bg-emerald-500 w-full animate-shimmer"></div>
                )}
              </div>

              {/* Info / Withdraw Actions */}
               <div className="flex gap-2 mt-1">
                   <button className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group">
                       Retirer <span className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0">→</span>
                   </button>
                   <button 
                     onClick={() => setShowEarningsInfo(!showEarningsInfo)}
                     className={`px-3 py-2 rounded-lg border transition-colors ${showEarningsInfo ? 'bg-brand-50 dark:bg-brand-500/20 border-brand-200 dark:border-brand-500/50 text-brand-600 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                   >
                       <Info className="w-4 h-4" />
                   </button>
               </div>
            </div>
          </div>

          {/* Anonymity Score */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Score d'Anonymat
            </h3>
            {isConnected ? (
              <AnonymityScore score={securityReport?.score || 65} isDark={theme === 'dark'} />
            ) : (
               <AnonymityScore score={0} isDark={theme === 'dark'} />
            )}
          </div>

        </div>

        {/* Center Column: Identity & Map (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Identity Matrix */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-brand-600 dark:text-brand-500" />
                Matrice d'Identité
              </h3>
              {isConnected && (
                <button 
                  onClick={renumerate}
                  disabled={isRenumbering || isDisconnecting}
                  className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className={`w-3 h-3 ${isRenumbering ? 'animate-spin' : ''}`} />
                  Renuméroter
                </button>
              )}
            </div>

            {isConnected ? (
              <IdentityMatrix identity={currentIdentity} isRotating={isRenumbering} />
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
                <p>Identité numérique exposée</p>
                <p className="text-xs">Connectez-vous pour masquer vos données</p>
              </div>
            )}
          </div>

          {/* Secure File Transfer - New Component */}
          <SecureFileTransfer isConnected={isConnected && !isDisconnecting} addLog={addLog} />

          {/* Logs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex-1 min-h-[300px] shadow-sm dark:shadow-none transition-colors duration-300">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Journaux Système
            </h3>
            <div className="font-mono text-xs space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 border-l-2 border-slate-200 dark:border-slate-800 pl-3 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <span className="text-slate-400 dark:text-slate-500">{log.timestamp}</span>
                  <span className={`${
                    log.type === 'error' ? 'text-red-600 dark:text-red-400' :
                    log.type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                    log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'
                  }`}>
                    {log.event}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-full flex flex-col relative overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
             {/* Decorative background element */}
             <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Gemini Advisor</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Analyste Sécurité IA</p>
              </div>
            </div>

            <div className="flex-1">
              {!isConnected ? (
                <div className="text-center text-slate-500 mt-10">
                  <p className="text-sm mb-2">En attente de connexion...</p>
                  <p className="text-xs opacity-70">L'IA analysera votre tunnel une fois actif.</p>
                </div>
              ) : isAnalyzing ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                  <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded w-full mt-4"></div>
                </div>
              ) : securityReport ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Niveau de Menace</span>
                    <div className={`text-lg font-bold ${
                      securityReport.threatLevel === 'Faible' ? 'text-emerald-600 dark:text-emerald-400' : 
                      securityReport.threatLevel === 'Critique' ? 'text-red-600 dark:text-red-500' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {securityReport.threatLevel}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">Analyse</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed border-l-2 border-purple-500 pl-3">
                      {securityReport.analysis}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">Recommandations</span>
                    <ul className="space-y-2">
                      {securityReport.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 flex gap-2">
                          <span className="text-purple-600 dark:text-purple-400">•</span> {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-500 dark:text-red-400 text-sm">
                  Erreur de chargement du rapport.
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 dark:text-slate-600 text-center">
                Propulsé par Google Gemini 2.5 Flash
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;