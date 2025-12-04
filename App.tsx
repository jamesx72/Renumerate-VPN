import React, { useState, useEffect, useRef } from 'react';
import { Shield, Power, RefreshCw, Moon, Sun, Lock, Globe, Terminal, Activity, Share2, Wifi, Zap, Settings, Crown, Wallet } from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './components/DashboardCharts';
import { IdentityMatrix } from './components/IdentityMatrix';
import { SecureFileTransfer } from './components/SecureFileTransfer';
import { PricingModal } from './components/PricingModal';
import { SettingsPanel } from './components/SettingsPanel';
import { EarningsCard } from './components/EarningsCard';
import { SystemLogs } from './components/SystemLogs';
import { MOCK_IDENTITIES, INITIAL_LOGS } from './constants';
import { VirtualIdentity, ConnectionMode, SecurityReport, LogEntry, PlanTier, AppSettings } from './types';
import { analyzeSecurity } from './services/geminiService';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [mode, setMode] = useState<ConnectionMode>(ConnectionMode.STANDARD);
  const [currentIdentity, setCurrentIdentity] = useState<VirtualIdentity>(MOCK_IDENTITIES[0]);
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // New State for Monetization, Settings, and Earnings
  const [userPlan, setUserPlan] = useState<PlanTier>('free');
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [balance, setBalance] = useState(0.0000);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    protocol: 'wireguard',
    dns: 'cloudflare',
    killSwitch: true,
    splitTunneling: false,
    adBlocker: false,
    autoRotation: false,
    rotationInterval: 10
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Earning Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isConnected && userPlan !== 'free') {
      // Rates: Pro = 0.004/sec, Elite = 0.012/sec
      const rate = userPlan === 'elite' ? 0.012 : 0.004;
      
      interval = setInterval(() => {
        setBalance(prev => prev + rate);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, userPlan]);

  const addLog = (event: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      event,
      type
    };
    setLogs(prev => [...prev, newLog].slice(-50));
  };

  const toggleConnection = async () => {
    if (isConnected) {
      setIsDisconnecting(true);
      addLog('Déconnexion initiée...', 'warning');
      setTimeout(() => {
        setIsConnected(false);
        setIsDisconnecting(false);
        setSecurityReport(null);
        addLog('Déconnecté du réseau sécurisé', 'info');
      }, 1500);
    } else {
      setIsDisconnecting(false);
      addLog(`Initialisation protocole ${appSettings.protocol}...`, 'info');
      
      if (mode === ConnectionMode.DOUBLE_HOP) {
         setTimeout(() => {
             addLog('Établissement du tunnel vers le nœud d\'entrée (Relais Chiffré)...', 'info');
         }, 500);
         setTimeout(() => {
             addLog('Relais confirmé. Routage vers le nœud de sortie...', 'success');
         }, 1000);
      }

      setTimeout(() => {
        setIsConnected(true);
        if (mode === ConnectionMode.DOUBLE_HOP) {
             addLog(`Double Hop Actif: Trafic routé via 2 serveurs sécurisés`, 'success');
        } else {
             addLog(`Connexion établie (${appSettings.protocol.toUpperCase()}) - Canal chiffré actif`, 'success');
        }
        
        if (appSettings.killSwitch) addLog('Kill Switch activé', 'success');
        if (appSettings.autoRotation) addLog(`Rotation auto active (toutes les ${appSettings.rotationInterval} min)`, 'info');
        handleAnalyze();
      }, 1500);
    }
  };

  const handleModeChange = (newMode: ConnectionMode) => {
    if (newMode !== ConnectionMode.STANDARD && userPlan === 'free') {
      addLog(`Tentative d'accès ${newMode} bloquée (Premium requis)`, 'warning');
      setShowPricing(true);
      return;
    }
    if (!isConnected) setMode(newMode);
  };

  const handleRenumber = () => {
    if (!isConnected || isRenumbering) return;
    setIsRenumbering(true);
    addLog('Rotation d\'identité en cours...', 'warning');
    
    setTimeout(() => {
      const availableIds = MOCK_IDENTITIES.filter(id => id.ip !== currentIdentity.ip);
      const newIdentity = availableIds[Math.floor(Math.random() * availableIds.length)];
      setCurrentIdentity(newIdentity);
      setIsRenumbering(false);
      addLog(`Nouvelle identité assignée : ${newIdentity.country}`, 'success');
      handleAnalyze(newIdentity);
    }, 2000);
  };

  // Logic to handle auto-rotation interval
  // We use a ref to access the latest handleRenumber function without triggering re-renders of the effect
  const handleRenumberRef = useRef(handleRenumber);
  useEffect(() => {
    handleRenumberRef.current = handleRenumber;
  }, [handleRenumber]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isConnected && appSettings.autoRotation) {
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
  }, [isConnected, appSettings.autoRotation, appSettings.rotationInterval, currentIdentity]); // Reset timer if identity changes manually

  const handleAnalyze = async (identity: VirtualIdentity = currentIdentity) => {
    if (!isConnected) return;
    setAnalyzing(true);
    addLog('Analyse de sécurité par IA en cours...', 'info');
    
    try {
      const report = await analyzeSecurity(mode, identity.country, identity.ip);
      setSecurityReport(report);
      addLog(`Rapport de sécurité généré : Score ${report.score}/100`, 'success');
    } catch (error) {
      addLog('Échec de l\'analyse de sécurité', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

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
    setAppSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'autoRotation') {
        addLog(`Rotation automatique ${value ? 'activée' : 'désactivée'}`, 'info');
    } else if (key === 'rotationInterval') {
        addLog(`Intervalle de rotation : ${value} min`, 'info');
    } else {
        addLog(`Configuration mise à jour: ${key} -> ${value}`, 'info');
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
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
        />
      )}

      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-brand-500" />
            <span className="font-bold text-xl tracking-tight hidden md:inline">Renumerate<span className="text-brand-500">VPN</span></span>
            <span className="font-bold text-xl tracking-tight md:hidden">R<span className="text-brand-500">VPN</span></span>
          </div>
          <div className="flex items-center gap-3">
            {/* Wallet Display */}
            {userPlan !== 'free' && (
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
            
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              {isConnected ? 'SÉCURISÉ' : 'DÉCONNECTÉ'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Wifi className="w-64 h-64" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center justify-center py-8">
                <button
                  onClick={toggleConnection}
                  disabled={isDisconnecting}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
                    isConnected 
                      ? 'bg-emerald-500 shadow-emerald-500/50 hover:shadow-emerald-500/70' 
                      : 'bg-slate-700 shadow-slate-900/50 hover:bg-slate-600'
                  }`}
                >
                  <Power className="w-12 h-12 text-white" />
                </button>
                
                <h2 className="mt-6 text-2xl font-bold">
                  {isDisconnecting ? 'Déconnexion...' : isConnected ? 'Connexion Active' : 'Prêt à connecter'}
                </h2>
                
                {isConnected && !isDisconnecting && (
                  <div className={`mt-4 flex flex-col items-center transition-all duration-500 ${isRenumbering ? 'opacity-50 scale-95 blur-[0.5px]' : 'opacity-100 scale-100'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-inner group cursor-default hover:border-brand-300 dark:hover:border-brand-500/30 transition-colors">
                         <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 tracking-wider group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{currentIdentity.ip}</span>
                      </div>
                      
                      <button 
                        onClick={shareIdentity}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-brand-500/20 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shadow-sm group/share"
                        title="Partager l'identité"
                      >
                        <Share2 className="w-3.5 h-3.5 group-hover/share:scale-110 transition-transform" />
                        <span>Partager</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                        <Globe className="w-3.5 h-3.5 text-brand-500" />
                        <span className="text-sm font-medium">{currentIdentity.country}</span>
                        <span className="text-xs text-slate-400 opacity-75 hidden sm:inline">• {currentIdentity.city}</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-4">
                  {Object.values(ConnectionMode).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      disabled={isConnected}
                      className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        mode === m 
                          ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {m}
                      {m !== ConnectionMode.STANDARD && userPlan === 'free' && (
                        <Lock className="w-3 h-3 absolute -top-1 -right-1 text-amber-500 bg-slate-900 rounded-full p-0.5" />
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleRenumber}
                  disabled={!isConnected || isRenumbering}
                  className={`mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border ${
                    !isConnected 
                      ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                      : isRenumbering
                        ? 'bg-brand-500/10 text-brand-500 border-brand-500/20 cursor-wait'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:shadow-lg hover:shadow-brand-500/10'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isRenumbering ? 'animate-spin' : ''}`} />
                  <span>{isRenumbering ? 'Renumérotation...' : 'Renuméroter Identité'}</span>
                </button>
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
                <AnonymityScore score={securityReport?.score || (isConnected ? (userPlan === 'free' ? 75 : 99) : 0)} isDark={isDark} />
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
             />

             <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 min-h-[300px]">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-lg flex items-center gap-2">
                     <Globe className="w-5 h-5 text-brand-500" />
                     {isConnected ? 'Identité Virtuelle' : 'Identité Réelle'}
                   </h3>
                   {isConnected && (
                     <div className="flex gap-1">
                       {appSettings.killSwitch && <div className="w-2 h-2 rounded-full bg-red-500" title="Kill Switch ON"></div>}
                       {appSettings.adBlocker && <div className="w-2 h-2 rounded-full bg-brand-500" title="AdBlocker ON"></div>}
                       {appSettings.autoRotation && <div className="w-2 h-2 rounded-full bg-brand-300 animate-pulse" title="Auto Rotation ON"></div>}
                     </div>
                   )}
                </div>
                
                {isConnected ? (
                  <IdentityMatrix identity={currentIdentity} isRotating={isRenumbering} mode={mode} />
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
             <SystemLogs logs={logs} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;