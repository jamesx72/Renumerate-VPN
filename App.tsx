import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Power, RefreshCw, Moon, Sun, Lock, Globe, Terminal, Activity, Share2, Wifi, Zap, Settings, Crown, Wallet, Ghost, Layers, AlertTriangle, WifiOff, Siren, Route } from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './components/DashboardCharts';
import { IdentityMatrix } from './components/IdentityMatrix';
import { SecureFileTransfer } from './components/SecureFileTransfer';
import { PricingModal } from './components/PricingModal';
import { SettingsPanel } from './components/SettingsPanel';
import { EarningsCard } from './components/EarningsCard';
import { SystemLogs } from './components/SystemLogs';
import { WithdrawalModal } from './components/WithdrawalModal';
import { MOCK_IDENTITIES, INITIAL_LOGS } from './constants';
import { VirtualIdentity, ConnectionMode, SecurityReport, LogEntry, PlanTier, AppSettings } from './types';
import { analyzeSecurity } from './services/geminiService';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false); // New Emergency State
  
  // Persistent State: Mode
  const [mode, setMode] = useState<ConnectionMode>(() => {
    const saved = localStorage.getItem('vpnMode');
    return saved ? (saved as ConnectionMode) : ConnectionMode.STANDARD;
  });

  // Persistent State: Current Identity (Last Server)
  const [currentIdentity, setCurrentIdentity] = useState<VirtualIdentity>(() => {
    const saved = localStorage.getItem('currentIdentity');
    return saved ? JSON.parse(saved) : MOCK_IDENTITIES[0];
  });

  const [entryIdentity, setEntryIdentity] = useState<VirtualIdentity | null>(null); // Entry node for Double Hop
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // New State for Monetization, Settings, and Earnings
  const [userPlan, setUserPlan] = useState<PlanTier>('free');
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [balance, setBalance] = useState(0.0000);
  
  // Persistent State: App Settings
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : {
      protocol: 'wireguard',
      dns: 'cloudflare',
      killSwitch: true,
      splitTunneling: false,
      adBlocker: false, 
      autoConnect: false,
      autoRotation: false,
      rotationInterval: 10,
      obfuscationLevel: 'standard'
    };
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem('vpnMode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('currentIdentity', JSON.stringify(currentIdentity));
  }, [currentIdentity]);

  // Earning Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isConnected && userPlan !== 'free' && !isEmergency) {
      // Rates: Pro = 0.004/sec, Elite = 0.012/sec
      const rate = userPlan === 'elite' ? 0.012 : 0.004;
      
      interval = setInterval(() => {
        setBalance(prev => prev + rate);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, userPlan, isEmergency]);

  const addLog = (event: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      event,
      type
    };
    setLogs(prev => [...prev, newLog].slice(-50));
  };

  const clearLogs = () => {
    setLogs([]);
    // Add a small delay to show the "Logs cleared" message after clearing
    setTimeout(() => {
        addLog('Journaux système effacés', 'info');
    }, 100);
  };

  const connectVPN = useCallback(() => {
    setIsDisconnecting(false);
    addLog(`Initialisation protocole ${appSettings.protocol}...`, 'info');
    
    if (mode === ConnectionMode.DOUBLE_HOP) {
       // Select a random entry node different from current identity
       const potentialEntryNodes = MOCK_IDENTITIES.filter(id => id.ip !== currentIdentity.ip);
       const selectedEntry = potentialEntryNodes[Math.floor(Math.random() * potentialEntryNodes.length)];
       setEntryIdentity(selectedEntry);

       setTimeout(() => {
           addLog(`Tunnel établi vers le nœud d'entrée (${selectedEntry.country})...`, 'info');
       }, 500);
       setTimeout(() => {
           addLog('Relais confirmé. Routage vers le nœud de sortie...', 'success');
       }, 1000);
    } else {
       setEntryIdentity(null);
    }

    setTimeout(() => {
      setIsConnected(true);
      if (mode === ConnectionMode.DOUBLE_HOP) {
           addLog(`Double Hop Actif: Trafic routé via 2 serveurs sécurisés`, 'success');
      } else if (mode === ConnectionMode.SMART_DNS) {
           addLog(`Smart DNS Activé: Routage intelligent via ${appSettings.dns}`, 'success');
           addLog(`Note: Votre IP d'origine est conservée pour les connexions directes.`, 'warning');
      } else {
           addLog(`Connexion établie (${appSettings.protocol.toUpperCase()}) - Canal chiffré actif`, 'success');
      }
      
      // DNS Log
      const dnsLabels: Record<string, string> = {
        cloudflare: 'Cloudflare DNS',
        google: 'Google DNS',
        quad9: 'Quad9 DNS',
        opendns: 'OpenDNS',
        custom: 'Renumerate Private DNS'
      };
      const dnsLabel = dnsLabels[appSettings.dns] || 'DNS';
      addLog(`Résolution DNS: ${dnsLabel} actif`, 'info');
      
      if (appSettings.killSwitch) addLog('Kill Switch activé : Protection active', 'success');
      if (appSettings.adBlocker) addLog('AdBlocker AI : Filtrage publicitaire activé', 'info');
      if (appSettings.autoRotation) addLog(`Rotation auto active (toutes les ${appSettings.rotationInterval} min)`, 'info');
      
      // Trigger Analysis manually here since handleAnalyze isn't defined yet in this scope
      // We'll use a useEffect on isConnected to trigger analysis instead, or assume handleAnalyze is called later.
    }, 1500);
  }, [appSettings, mode, currentIdentity]);

  const disconnectVPN = useCallback(() => {
    setIsDisconnecting(true);
    addLog('Déconnexion initiée...', 'warning');
    setTimeout(() => {
      setIsConnected(false);
      setIsDisconnecting(false);
      setEntryIdentity(null);
      setSecurityReport(null);
      addLog('Déconnecté du réseau sécurisé', 'info');
    }, 1500);
  }, []);

  const toggleConnection = async () => {
    if (isEmergency) return;
    if (isConnected) {
      disconnectVPN();
    } else {
      connectVPN();
    }
  };

  // Trigger analysis when connected
  useEffect(() => {
    if (isConnected && !isDisconnecting && !isEmergency) {
      handleAnalyze();
    }
  }, [isConnected]);

  // Auto Connect Effect
  const hasAutoConnected = useRef(false);
  useEffect(() => {
    if (!hasAutoConnected.current && appSettings.autoConnect && !isConnected && !isEmergency) {
        hasAutoConnected.current = true;
        addLog('🚀 Démarrage : Connexion automatique activée', 'info');
        connectVPN();
    }
  }, []);

  const handleAnalyze = async (identity: VirtualIdentity = currentIdentity) => {
    if (!isConnected && !isEmergency) return;
    setAnalyzing(true);
    // Only log if not in emergency loop to avoid clutter
    if (!isEmergency) addLog('Analyse de sécurité par IA en cours...', 'info');
    
    try {
      const report = await analyzeSecurity(mode, identity.country, identity.ip);
      setSecurityReport(report);
      if (!isEmergency) addLog(`Rapport de sécurité généré : Score ${report.score}/100`, 'success');
    } catch (error) {
      addLog('Échec de l\'analyse de sécurité', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleEmergencyProtocol = useCallback(() => {
    if (!isConnected || !appSettings.killSwitch) return;

    // Simulate Drop
    addLog('⚠️ DÉTECTION PERTE RÉSEAU !', 'error');
    setIsEmergency(true);
    setIsConnected(false); // Visually disconnect
    
    // Step 1: Engage Kill Switch
    addLog('🛡️ KILL SWITCH ENGAGÉ : Trafic Internet Bloqué', 'warning');
    
    setTimeout(() => {
        // Step 2: Emergency Renumeration
        addLog('🚨 PROTOCOLE D\'URGENCE : Renumérotation forcée...', 'info');
        
        // Use a functional update or logic that doesn't depend on stale closure if possible, 
        // but for this mock, currentIdentity from render scope is acceptable as it doesn't change fast.
        const availableIds = MOCK_IDENTITIES.filter(id => id.ip !== currentIdentity.ip);
        const newIdentity = availableIds[Math.floor(Math.random() * availableIds.length)];
        
        setTimeout(() => {
            setCurrentIdentity(newIdentity);
            addLog(`✅ IDENTITÉ D'URGENCE ACQUISE : ${newIdentity.ip}`, 'success');
            
            // Step 3: Re-establish
            setTimeout(() => {
                setIsConnected(true);
                setIsEmergency(false);
                addLog('🚀 CONNEXION SÉCURISÉE RÉTABLIE', 'success');
                handleAnalyze(newIdentity);
            }, 1200);
            
        }, 2000);
    }, 1500);
  }, [isConnected, appSettings.killSwitch, currentIdentity]);

  // Listen for offline events
  useEffect(() => {
    const onOffline = () => {
        if (isConnected && appSettings.killSwitch && !isEmergency) {
            handleEmergencyProtocol();
        }
    };
    
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, [isConnected, appSettings.killSwitch, isEmergency, handleEmergencyProtocol]);

  const handleModeChange = (newMode: ConnectionMode) => {
    if (newMode !== ConnectionMode.STANDARD && userPlan === 'free') {
      addLog(`Tentative d'accès ${newMode} bloquée (Premium requis)`, 'warning');
      setShowPricing(true);
      return;
    }
    if (!isConnected) setMode(newMode);
  };

  const handleRenumber = () => {
    if (!isConnected || isRenumbering || isEmergency) return;
    setIsRenumbering(true);
    addLog('Rotation d\'identité en cours...', 'warning');
    
    setTimeout(() => {
      // Filter out current identity AND entry identity (if in Double Hop) to avoid collision
      const availableIds = MOCK_IDENTITIES.filter(id => 
        id.ip !== currentIdentity.ip && 
        (!entryIdentity || id.ip !== entryIdentity.ip)
      );
      
      const newIdentity = availableIds[Math.floor(Math.random() * availableIds.length)];
      setCurrentIdentity(newIdentity);
      setIsRenumbering(false);
      addLog(`Nouvelle identité assignée : ${newIdentity.country}`, 'success');
      handleAnalyze(newIdentity);
    }, 2000);
  };

  const handleSimulateDrop = () => {
    if (!isConnected || isDisconnecting || isEmergency) return;
    
    if (!appSettings.killSwitch) {
        addLog('Activez le Kill Switch pour cette simulation.', 'warning');
        return;
    }

    setIsDisconnecting(true);
    addLog('⚠️ Simulation : Perturbation réseau détectée...', 'warning');

    setTimeout(() => {
        setIsDisconnecting(false);
        // This triggers the emergency state which will now show "NON PROTÉGÉ"
        handleEmergencyProtocol();
    }, 1500);
  };

  const handleRenumberRef = useRef(handleRenumber);
  useEffect(() => {
    handleRenumberRef.current = handleRenumber;
  }, [handleRenumber]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isConnected && appSettings.autoRotation && !isEmergency) {
      const ms = Math.max(1, appSettings.rotationInterval) * 60 * 1000;
      interval = setInterval(() => {
        if (handleRenumberRef.current) {
           handleRenumberRef.current();
        }
      }, ms);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, appSettings.autoRotation, appSettings.rotationInterval, currentIdentity, isEmergency]);


  const shareIdentity = () => {
    if (!currentIdentity) return;
    const text = `Identity: ${currentIdentity.ip} (${currentIdentity.country})`;
    navigator.clipboard.writeText(text);
    addLog('Identité copiée dans le presse-papier', 'info');
  };

  const handleUpgrade = (plan: PlanTier) => {
    addLog(`Traitement de la mise à niveau vers ${plan.toUpperCase()}...`, 'info');
    setTimeout(() => {
      setUserPlan(plan);
      setShowPricing(false);
      addLog(`Mise à niveau réussie ! Bienvenue dans le plan ${plan.toUpperCase()}`, 'success');
    }, 1500);
  };

  const handleUpdateSettings = (key: keyof AppSettings, value: any) => {
    // Feature Locking Logic - DNS Custom still locked
    if (key === 'dns' && value === 'custom' && userPlan === 'free') {
        addLog('DNS Sécurisé nécessite le plan PRO', 'warning');
        setShowPricing(true);
        return;
    }

    setAppSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'autoRotation') {
        addLog(`Rotation automatique ${value ? 'activée' : 'désactivée'}`, 'info');
    } else if (key === 'adBlocker') {
        addLog(`AdBlocker AI ${value ? 'activé' : 'désactivé'}`, 'info');
    } else if (key === 'autoConnect') {
        addLog(`Connexion automatique au démarrage ${value ? 'activée' : 'désactivée'}`, 'info');
    } else if (key === 'rotationInterval') {
        addLog(`Intervalle de rotation : ${value} min`, 'info');
    } else if (key === 'obfuscationLevel') {
        addLog(`Niveau d'obfuscation réglé sur : ${value.toUpperCase()}`, 'info');
    } else {
        addLog(`Configuration mise à jour: ${key} -> ${value}`, 'info');
    }
  };

  const handleOpenWithdrawal = () => {
    if (balance < 1) {
        addLog('Solde insuffisant pour retrait (Min 1 RNC)', 'warning');
        return;
    }
    setShowWithdrawal(true);
  };

  const handleConfirmWithdrawal = (method: string, address: string) => {
    const amount = balance.toFixed(4);
    addLog(`Retrait de ${amount} RNC via ${method === 'crypto' ? 'Crypto' : 'PayPal'} initié vers ${address}...`, 'info');
    
    // Reset balance
    setBalance(0);
    setShowWithdrawal(false);
    
    setTimeout(() => {
        addLog(`Transaction confirmée: ${amount} RNC envoyés avec succès.`, 'success');
    }, 1000);
  };

  // Dynamic Styles for Emergency Mode
  const mainButtonColor = isEmergency 
    ? 'bg-red-500 shadow-red-500/50 animate-pulse-fast'
    : isConnected 
        ? mode === ConnectionMode.STEALTH
            ? 'bg-indigo-500 shadow-indigo-500/50 hover:shadow-indigo-500/70'
            : mode === ConnectionMode.DOUBLE_HOP
                ? 'bg-violet-500 shadow-violet-500/50 hover:shadow-violet-500/70'
                : mode === ConnectionMode.SMART_DNS
                    ? 'bg-orange-500 shadow-orange-500/50 hover:shadow-orange-500/70'
                    : 'bg-emerald-500 shadow-emerald-500/50 hover:shadow-emerald-500/70' 
        : 'bg-slate-700 shadow-slate-900/50 hover:bg-slate-600';

  const statusTextColor = isEmergency 
    ? 'text-red-500' 
    : isDisconnecting 
        ? 'text-amber-500' 
        : isConnected 
            ? 'text-emerald-500' 
            : 'text-slate-500';
            
  const statusBgColor = isEmergency 
    ? 'bg-red-500/10' 
    : isDisconnecting 
        ? 'bg-amber-500/10' 
        : isConnected 
            ? 'bg-emerald-500/10' 
            : 'bg-slate-500/10';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} ${isEmergency ? 'border-4 border-red-500/50' : ''}`}>
      
      {/* Modals */}
      {showPricing && (
        <PricingModal 
          currentPlan={userPlan} 
          onUpgrade={handleUpgrade} 
          onClose={() => setShowPricing(false)} 
        />
      )}
      
      {showSettings && (
        <SettingsPanel 
          settings={appSettings} 
          updateSettings={handleUpdateSettings} 
          onClose={() => setShowSettings(false)}
          userPlan={userPlan}
          onShowPricing={() => setShowPricing(true)}
        />
      )}

      {showWithdrawal && (
        <WithdrawalModal 
            balance={balance}
            onClose={() => setShowWithdrawal(false)}
            onConfirm={handleConfirmWithdrawal}
        />
      )}

      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
                <Shield className={`w-8 h-8 ${isEmergency ? 'text-red-500' : 'text-brand-500'}`} />
                <span className="font-bold text-xl tracking-tight hidden md:inline">Renumerate<span className={`${isEmergency ? 'text-red-500' : 'text-brand-500'}`}>VPN</span></span>
                <span className="font-bold text-xl tracking-tight md:hidden">R<span className={`${isEmergency ? 'text-red-500' : 'text-brand-500'}`}>VPN</span></span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide hidden md:block pl-10 -mt-1">Redéfinissez votre identité numérique.</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Wallet Display */}
            {userPlan !== 'free' && !isEmergency && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mr-2">
                <Wallet className="w-4 h-4 text-amber-500" />
                <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{balance.toFixed(2)} RNC</span>
              </div>
            )}

            <button
              onClick={() => setShowPricing(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                userPlan === 'free' 
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-500/20' 
                  : 'bg-slate-800 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{userPlan === 'free' ? 'Go Premium' : userPlan.toUpperCase()}</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Configuration"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusBgColor} ${statusTextColor}`}>
              <div className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-red-500 animate-ping' : isDisconnecting ? 'bg-amber-500 animate-pulse' : isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              <span>
                  {isEmergency 
                    ? 'NON PROTÉGÉ' 
                    : isDisconnecting
                        ? 'DÉCONNEXION...'
                        : isConnected 
                            ? 'SÉCURISÉ' 
                            : 'DÉCONNECTÉ'}
              </span>
              
              {!isEmergency && !isDisconnecting && (
                <div className={`flex items-center gap-1.5 ml-2 pl-2 border-l text-xs transition-colors ${isConnected ? 'border-emerald-500/20' : 'border-slate-500/20'}`}>
                   {mode === ConnectionMode.STANDARD && <Zap className="w-3 h-3" />}
                   {mode === ConnectionMode.STEALTH && <Ghost className="w-3 h-3" />}
                   {mode === ConnectionMode.DOUBLE_HOP && <Layers className="w-3 h-3" />}
                   {mode === ConnectionMode.SMART_DNS && <Globe className="w-3 h-3" />}
                   <span className="uppercase tracking-wide">{mode}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {isEmergency && (
        <div className="w-full bg-red-600 text-white text-center py-1.5 text-xs font-bold uppercase tracking-wider animate-pulse flex items-center justify-center gap-2 shadow-lg relative z-40">
           <Siren className="w-4 h-4" />
           Protocole de Renumérotation d'Urgence Actif
           <Siren className="w-4 h-4" />
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={`bg-white dark:bg-slate-900 rounded-2xl p-8 border ${isEmergency ? 'border-red-500/30' : 'border-slate-200 dark:border-slate-800'} shadow-xl relative overflow-hidden transition-all duration-500`}>
              
              {/* Stealth Mode Indicator Banner */}
              {mode === ConnectionMode.STEALTH && isConnected && !isEmergency && (
                 <div className="absolute top-0 left-0 w-full bg-indigo-950/90 border-b border-indigo-500/30 py-1.5 flex items-center justify-center gap-2 z-20 shadow-sm backdrop-blur-sm animate-shimmer">
                    <Ghost className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200">
                      Mode Furtif Activé - Trafic Obfusqué
                    </span>
                 </div>
              )}

              {/* Double Hop Indicator Banner */}
              {mode === ConnectionMode.DOUBLE_HOP && isConnected && !isEmergency && (
                <div className="absolute top-0 left-0 w-full bg-violet-950/90 border-b border-violet-500/30 py-1.5 flex items-center justify-center gap-2 z-20 shadow-sm backdrop-blur-sm animate-shimmer">
                  <Layers className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                    Double Hop Actif - Relais Chiffré
                  </span>
                </div>
              )}

              {/* Smart DNS Indicator Banner */}
              {mode === ConnectionMode.SMART_DNS && isConnected && !isEmergency && (
                <div className="absolute top-0 left-0 w-full bg-orange-950/90 border-b border-orange-500/30 py-1.5 flex items-center justify-center gap-2 z-20 shadow-sm backdrop-blur-sm animate-shimmer">
                  <Globe className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-200">
                    Smart DNS Actif - IP D'origine Conservée
                  </span>
                </div>
              )}

              <div className="absolute top-0 right-0 p-4 opacity-10">
                {isEmergency ? <Siren className="w-64 h-64 text-red-500 animate-pulse" /> : <Wifi className="w-64 h-64" />}
              </div>
              
              <div className="relative z-10 flex flex-col items-center justify-center py-8">
                <button
                  onClick={toggleConnection}
                  disabled={isDisconnecting || isEmergency}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${mainButtonColor}`}
                >
                  {isEmergency ? (
                      <WifiOff className="w-12 h-12 text-white animate-shake" />
                  ) : (
                      <Power className="w-12 h-12 text-white" />
                  )}
                </button>
                
                <h2 className={`mt-6 text-2xl font-bold ${isEmergency ? 'text-red-500' : ''}`}>
                  {isEmergency 
                    ? 'COUPURE DÉTECTÉE' 
                    : isDisconnecting 
                        ? 'Déconnexion...' 
                        : isConnected 
                            ? 'Connexion Active' 
                            : 'Prêt à connecter'}
                </h2>
                
                {isEmergency && (
                    <div className="mt-2 text-sm font-bold text-red-400 animate-pulse flex items-center gap-2 bg-red-950/30 px-4 py-2 rounded-full border border-red-500/30">
                        <AlertTriangle className="w-4 h-4" />
                        Renumérotation d'urgence en cours...
                    </div>
                )}
                
                {isConnected && !isDisconnecting && !isEmergency && (
                  <div className={`mt-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700 ${isRenumbering ? 'opacity-50 scale-95 blur-[1px]' : 'opacity-100 scale-100'}`}>
                    
                    <div className="flex flex-col items-center gap-2 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                            {mode === ConnectionMode.SMART_DNS ? 'Serveur DNS Actif' : 'Serveur Connecté'}
                        </span>
                        
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xl font-bold text-slate-700 dark:text-white tracking-tight">{currentIdentity.ip}</span>
                            </div>
                            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-brand-500" />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{currentIdentity.country}</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs text-slate-400">{currentIdentity.city}</span>
                             <button 
                                onClick={shareIdentity}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-brand-500"
                                title="Copier l'IP"
                             >
                                <Share2 className="w-3 h-3" />
                             </button>
                        </div>
                    </div>

                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3 justify-center w-full">
                  {Object.values(ConnectionMode).map((m) => {
                    const isSelected = mode === m;
                    // Icon selection
                    const Icon = m === ConnectionMode.STEALTH ? Ghost : m === ConnectionMode.DOUBLE_HOP ? Layers : m === ConnectionMode.SMART_DNS ? Globe : Zap;
                    
                    return (
                        <button
                          key={m}
                          onClick={() => handleModeChange(m)}
                          disabled={isConnected || isEmergency}
                          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                            isSelected
                              ? m === ConnectionMode.STEALTH
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : m === ConnectionMode.DOUBLE_HOP
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                                    : m === ConnectionMode.SMART_DNS
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                                        : 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? 'animate-pulse' : ''}`} />
                          <span>{m}</span>
                          
                          {/* Lock icon for premium modes */}
                          {m !== ConnectionMode.STANDARD && userPlan === 'free' && (
                            <div className="absolute -top-1.5 -right-1.5 bg-slate-900 text-amber-500 rounded-full p-0.5 border border-slate-700 shadow-sm z-10">
                                <Lock className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap gap-3 mt-6 justify-center">
                    <button
                      onClick={handleRenumber}
                      disabled={!isConnected || isRenumbering || isEmergency}
                      title={!isConnected ? "Connectez-vous pour renuméroter" : isRenumbering ? "En cours..." : "Changer d'identité"}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border ${
                        !isConnected || isEmergency 
                          ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                          : isRenumbering
                            ? 'bg-brand-500/10 text-brand-500 border-brand-500/20 cursor-wait'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:shadow-lg hover:shadow-brand-500/10'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRenumbering ? 'animate-spin' : ''}`} />
                      <span>{isRenumbering ? 'Renumérotation...' : 'Renuméroter'}</span>
                    </button>

                    <button
                      onClick={handleSimulateDrop}
                      disabled={!isConnected || isDisconnecting || isEmergency}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border ${
                        !isConnected || isDisconnecting || isEmergency
                          ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                          : 'border-amber-500/20 text-amber-600 dark:text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10'
                      }`}
                      title={!appSettings.killSwitch ? "Activez Kill Switch d'abord" : "Simuler une coupure réseau"}
                    >
                      <WifiOff className="w-4 h-4" />
                      <span className="hidden sm:inline">Simuler Drop</span>
                    </button>

                    {isConnected && !isEmergency && appSettings.killSwitch && (
                         <button
                         onClick={handleEmergencyProtocol}
                         className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border border-red-500/20 text-red-500 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10"
                         title="Simuler une coupure réseau pour tester le Kill Switch"
                       >
                         <AlertTriangle className="w-4 h-4" />
                         <span className="hidden sm:inline">Test Kill Switch</span>
                       </button>
                    )}
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Activity className="w-4 h-4" /> Trafic Réseau
                  </h3>
                  <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-mono">
                    {appSettings.protocol.toUpperCase()}
                  </span>
                </div>
                <TrafficMonitor isDark={isDark} />
              </div>
              
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Lock className="w-4 h-4" /> Score d'Anonymat
                  </h3>
                </div>
                <AnonymityScore score={isEmergency ? 10 : (securityReport?.score || (isConnected ? (userPlan === 'free' ? 75 : 99) : 0))} isDark={isDark} />
              </div>
            </div>
            
            <SecureFileTransfer isConnected={isConnected} addLog={addLog} />

          </div>

          <div className="space-y-6">
             {/* Earnings Card */}
             <EarningsCard 
                isConnected={isConnected} 
                plan={userPlan} 
                balance={balance} 
                onUpgrade={() => setShowPricing(true)} 
                onWithdraw={handleOpenWithdrawal}
             />

             <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 min-h-[300px]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-lg flex items-center gap-2">
                     <Globe className="w-5 h-5 text-brand-500" />
                     {isConnected ? 'Identité Virtuelle' : 'Identité Réelle'}
                   </h3>
                   {isConnected && (
                     <div className="flex gap-1">
                       {appSettings.killSwitch && <div className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-red-500 animate-pulse' : 'bg-red-500'}`} title="Kill Switch ON"></div>}
                       {appSettings.adBlocker && <div className="w-2 h-2 rounded-full bg-brand-500" title="AdBlocker ON"></div>}
                       {appSettings.autoRotation && <div className="w-2 h-2 rounded-full bg-brand-300 animate-pulse" title="Auto Rotation ON"></div>}
                     </div>
                   )}
                </div>
                
                {isConnected || isEmergency ? (
                  <IdentityMatrix identity={currentIdentity} entryIdentity={entryIdentity} isRotating={isRenumbering || isEmergency} mode={mode} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Shield className="w-12 h-12 mb-2 opacity-20" />
                    <p>Connectez-vous pour masquer votre identité</p>
                  </div>
                )}

                {securityReport && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-medium mb-3 text-slate-500">Analyse IA Gemini</h4>
                    <div className="space-y-3 text-sm">
                       <div className="flex justify-between items-center">
                         <span>Menace:</span>
                         <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                           securityReport.threatLevel === 'Faible' ? 'bg-emerald-500/10 text-emerald-500' : 
                           securityReport.threatLevel === 'Moyen' ? 'bg-amber-500/10 text-amber-500' : 
                           'bg-red-500/10 text-red-500'
                         }`}>{securityReport.threatLevel.toUpperCase()}</span>
                       </div>
                       <p className="text-slate-600 dark:text-slate-300 text-xs italic">"{securityReport.analysis}"</p>
                       <ul className="space-y-1 mt-2">
                         {securityReport.recommendations.map((rec, i) => (
                           <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                             <span className="text-brand-500">•</span> {rec}
                           </li>
                         ))}
                       </ul>
                    </div>
                  </div>
                )}
             </div>

             {/* Styled Terminal / Logs System */}
             <SystemLogs logs={logs} onClear={clearLogs} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;