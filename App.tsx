
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Power, Moon, Sun, Globe, Activity, Settings, Crown, Wallet, Ghost, Layers, AlertTriangle, Siren, Loader2, LogOut, CheckCircle, ArrowUpRight, History, Network, Zap, ShieldCheck } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { IdentityMatrix } from './components/IdentityMatrix';
import { PricingModal } from './components/PricingModal';
import { SettingsPanel } from './components/SettingsPanel';
import { EarningsCard } from './components/EarningsCard';
import { SystemLogs } from './components/SystemLogs';
import { SecurityAudit } from './components/SecurityAudit';
import { WithdrawalModal } from './components/WithdrawalModal';
import { TransactionHistoryModal } from './components/TransactionHistoryModal';
import { ConnectionHistoryModal } from './components/ConnectionHistoryModal';
import { AuthScreen } from './components/AuthScreen';
import { VerificationModal } from './components/VerificationModal';
import { MOCK_IDENTITIES, INITIAL_LOGS, REALISTIC_USER_AGENTS, generateRandomMac, MOCK_NODES } from './constants';
import { VirtualIdentity, ConnectionMode, SecurityReport, LogEntry, PlanTier, AppSettings, Transaction, ConnectionSession, DeviceNode } from './types';
import { analyzeSecurity } from './services/geminiService';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  
  const [user, setUser] = useState<{email: string} | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [mode, setMode] = useState<ConnectionMode>(ConnectionMode.STANDARD);
  const [currentIdentity, setCurrentIdentity] = useState<VirtualIdentity>(MOCK_IDENTITIES[0]);
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [isMasking, setIsMasking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);

  const [deviceNodes, setDeviceNodes] = useState<DeviceNode[]>(MOCK_NODES);
  const [balance, setBalance] = useState(0.4215);
  const [reputationScore, setReputationScore] = useState(85);
  const [userPlan, setUserPlan] = useState<PlanTier>(() => (localStorage.getItem('userPlan') as PlanTier) || 'free');
  const [isVerified, setIsVerified] = useState<boolean>(() => localStorage.getItem('isVerified') === 'true');
  
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : {
      protocol: 'wireguard',
      dns: 'cloudflare',
      killSwitch: true,
      dnsLeakProtection: true,
      autoReconnect: true,
      reconnectDelay: 3,
      splitTunneling: false,
      adBlocker: false, 
      autoConnect: false,
      autoConnectAutoReconnect: true,
      autoRotation: false,
      rotationInterval: 10,
      obfuscationLevel: 'standard',
      miningIntensity: 50,
      yieldOptimizationIA: true,
      contributionType: 'passive',
      autoWithdraw: false,
      mtuSize: 1420,
      ipv6LeakProtection: true,
      localNetworkSharing: false,
      logRetentionHours: 168
    };
  });

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem('userPlan', userPlan);
  }, [userPlan]);

  useEffect(() => {
    localStorage.setItem('isVerified', isVerified.toString());
  }, [isVerified]);

  useEffect(() => {
    if (!isConnected) {
        const interval = setInterval(() => {
            setReputationScore(prev => Math.max(prev - 0.01, 0));
        }, 10000);
        return () => clearInterval(interval);
    } else {
        const interval = setInterval(() => {
            setReputationScore(prev => Math.min(prev + 0.02, 100));
        }, 5000);
        return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Earning Accumulation Engine
  useEffect(() => {
    // Condition de rémunération : Connecté + Plan Payant + Identité Vérifiée
    if (!isConnected || userPlan === 'free' || !isVerified) return;

    const interval = setInterval(() => {
      const baseRate = userPlan === 'elite' ? 0.00012 : 0.00004;
      const intensityFactor = 0.5 + (appSettings.miningIntensity / 100);
      const iaBonus = appSettings.yieldOptimizationIA ? 1.2 : 1.0;
      const typeBonus = appSettings.contributionType === 'exit' ? 1.3 : appSettings.contributionType === 'relay' ? 1.15 : 1.0;
      const reputationBonus = 0.8 + (reputationScore / 100) * 0.4;
      
      const totalIncrement = baseRate * intensityFactor * iaBonus * typeBonus * reputationBonus;
      setBalance(prev => prev + (totalIncrement / 5));
    }, 200);

    return () => clearInterval(interval);
  }, [isConnected, userPlan, isVerified, appSettings.miningIntensity, appSettings.yieldOptimizationIA, appSettings.contributionType, reputationScore]);

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setAppSettings(prev => ({ ...prev, [key]: value }));
  };

  const addLog = useCallback((event: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      timestampRaw: Date.now(),
      event,
      type
    };
    setLogs(prev => [...prev, newLog].slice(-500));
  }, []);

  const connectVPN = async () => {
    setIsDisconnecting(false);
    addLog(`Démarrage du tunnel ${appSettings.protocol}...`, 'info');
    setTimeout(async () => {
      setIsConnected(true);
      addLog(`Réseau Renumerate rejoint avec succès`, 'success');
      const report = await analyzeSecurity(mode, currentIdentity.country, currentIdentity.ip);
      setSecurityReport(report);
      addLog(`Analyse de sécurité terminée : Score ${report.score}/100`, 'info');
      
      if (userPlan !== 'free') {
        if (isVerified) {
          addLog(`Génération de RNC active (Intensité: ${appSettings.miningIntensity}%)`, 'info');
        } else {
          addLog(`Attention : Rémunération RNC suspendue. Vérification d'identité requise.`, 'warning');
        }
      }
    }, 1500);
  };

  const disconnectVPN = () => {
    setIsDisconnecting(true);
    addLog('Fermeture sécurisée du tunnel...', 'warning');
    setTimeout(() => {
      setIsConnected(false);
      setIsDisconnecting(false);
      setSecurityReport(null);
      addLog('Session VPN clôturée', 'info');
    }, 1000);
  };

  const handleMaskFootprint = () => {
    setIsMasking(true);
    addLog('Initialisation du masquage matériel et logiciel...', 'info');
    setTimeout(() => {
      const randomUA = REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)];
      const randomMAC = generateRandomMac(true);
      setCurrentIdentity(prev => ({
        ...prev,
        mac: randomMAC,
        userAgentShort: randomUA.short
      }));
      setIsMasking(false);
      addLog(`Nouvelle identité générée : ${randomUA.browser} sur ${randomUA.os}`, 'success');
      addLog(`Spoofing MAC (LAA) : ${randomMAC}`, 'success');
    }, 1500);
  };

  const handleScrambleMac = (forceLAA: boolean) => {
    const newMac = generateRandomMac(forceLAA);
    setCurrentIdentity(prev => ({ ...prev, mac: newMac }));
    addLog(`Scrambling MAC réussi : ${newMac}`, 'success');
  };

  const handleScrambleUA = () => {
    const randomUA = REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)];
    setCurrentIdentity(prev => ({ ...prev, userAgentShort: randomUA.short }));
    addLog(`Scrambling UA réussi : ${randomUA.browser}`, 'success');
  };

  const handleConnectNode = (nodeId: string) => {
    const node = deviceNodes.find(n => n.id === nodeId);
    if (!node) return;
    addLog(`Routage forcé vers le nœud : ${node.name} (${node.country})`, 'info');
    setCurrentIdentity(prev => ({
      ...prev,
      ip: node.ip,
      country: node.country,
      city: node.name.split('-')[1] || 'Unknown'
    }));
    if (!isConnected) connectVPN();
  };

  const handleVerificationSuccess = () => {
    setIsVerified(true);
    setShowVerification(false);
    addLog("Identité vérifiée avec succès. Accès RNC débloqué.", "success");
  };

  const handlePlanUpgrade = (plan: PlanTier) => {
    setUserPlan(plan);
    addLog(`Plan mis à niveau vers : ${plan.toUpperCase()}. Vérification du paiement en cours...`, "info");
    setTimeout(() => {
      addLog(`Paiement confirmé par l'infrastructure bancaire.`, "success");
    }, 2000);
  };

  if (!user) return <AuthScreen onLogin={(e) => setUser({email: e})} />;

  return (
    <div className={`min-h-screen transition-colors duration-500 overflow-x-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Dynamic Cyber Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 cyber-grid opacity-[0.03] dark:opacity-[0.05]"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-cyan-500/5 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full"></div>
      </div>

      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
              <div className="p-2.5 bg-cyan-600 rounded-2xl shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <span className="font-black text-2xl tracking-tighter">Renumerate<span className="text-cyan-500">VPN</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowPricing(true)} 
              className={`hidden md:flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[10px] font-black border shadow-sm transition-all uppercase tracking-widest ${
                userPlan === 'elite' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 
                userPlan === 'pro' ? 'bg-brand-500/10 border-brand-500/30 text-brand-500' :
                'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-500'
              }`}
            >
              <Crown className={`w-4 h-4 ${userPlan !== 'free' ? 'animate-pulse' : ''}`} />
              {userPlan} Plan
            </button>
            
            <div className="h-10 w-px bg-slate-200 dark:border-slate-800 mx-2 hidden md:block"></div>

            <button onClick={() => setShowSettings(true)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:text-cyan-500">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={() => setIsDark(!isDark)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:text-cyan-500">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-3 rounded-2xl text-slate-500 hover:bg-red-500/10 hover:text-red-500 transition-all">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-10 pb-40 space-y-10 relative z-10">
        {/* Verification Banner if Pro but not verified */}
        {!isVerified && userPlan !== 'free' && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Identité non vérifiée</h4>
                <p className="text-xs text-slate-500">Vérifiez votre identité pour débloquer la rémunération RNC sur votre plan {userPlan.toUpperCase()}.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowVerification(true)}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              Vérifier maintenant
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Content */}
            <div className="lg:col-span-8 space-y-10">
                <Dashboard 
                    isDark={isDark} 
                    protocol={appSettings.protocol} 
                    isEmergency={isEmergency} 
                    securityReport={securityReport}
                    isConnected={isConnected}
                    userPlan={userPlan}
                    mode={mode}
                    onModeChange={(m) => setMode(m)}
                    nodes={deviceNodes}
                    onConnectNode={handleConnectNode}
                    currentIp={currentIdentity.ip}
                />
                <IdentityMatrix 
                    identity={currentIdentity} 
                    entryIdentity={null} 
                    isRotating={isRenumbering}
                    isMasking={isMasking}
                    mode={mode}
                    securityReport={securityReport}
                    onMask={handleMaskFootprint}
                    onScrambleMac={handleScrambleMac}
                    onScrambleUA={handleScrambleUA}
                    isConnected={isConnected}
                />
            </div>
            
            {/* Right Sidebar */}
            <div className="lg:col-span-4 space-y-8">
                <EarningsCard 
                    isConnected={isConnected}
                    plan={userPlan}
                    isVerified={isVerified}
                    balance={balance}
                    reputation={reputationScore}
                    onUpgrade={() => setShowPricing(true)}
                    onVerify={() => setShowVerification(true)}
                    onWithdraw={() => {}}
                    settings={appSettings}
                />
                <SecurityAudit 
                  currentIp={currentIdentity.ip} 
                  location={currentIdentity.country} 
                />
                <SystemLogs logs={logs} onClear={() => setLogs([])} />
            </div>
        </div>
      </main>

      {/* Persistent Mobile-Ready Footer Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] p-6 flex justify-center pointer-events-none">
          <div className="w-full max-w-lg glass-card p-2 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl pointer-events-auto">
              <button
                onClick={isConnected ? disconnectVPN : connectVPN}
                disabled={isDisconnecting}
                className={`w-full h-16 rounded-[2rem] font-black text-lg text-white shadow-2xl transition-all duration-500 flex items-center justify-center gap-4 active:scale-95 group overflow-hidden relative ${
                  isConnected ? 'bg-slate-900 shadow-slate-900/40' : 'bg-cyan-600 shadow-cyan-500/50 hover:bg-cyan-700'
                }`}
              >
                {/* Button Scanline Effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                
                {isDisconnecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Power className={`w-6 h-6 transition-transform ${isConnected ? 'rotate-180' : ''}`} />}
                <span className="tracking-[0.1em]">{isConnected ? 'DÉCONNECTER' : 'SÉCURISER LA CONNEXION'}</span>
              </button>
          </div>
      </div>

      {showPricing && <PricingModal currentPlan={userPlan} onUpgrade={handlePlanUpgrade} onClose={() => setShowPricing(false)} />}
      
      {showVerification && <VerificationModal onClose={() => setShowVerification(false)} onSuccess={handleVerificationSuccess} />}

      {showSettings && (
        <SettingsPanel 
          settings={appSettings} 
          updateSettings={updateSetting} 
          onClose={() => setShowSettings(false)} 
          userPlan={userPlan}
          onShowPricing={() => { setShowSettings(false); setShowPricing(true); }}
        />
      )}
    </div>
  );
}

export default App;
