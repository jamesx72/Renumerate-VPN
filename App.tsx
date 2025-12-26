
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Power, Moon, Sun, Globe, Activity, Settings, Crown, Wallet, Ghost, Layers, AlertTriangle, Siren, Loader2, LogOut, CheckCircle, ArrowUpRight, History, Network, Zap } from 'lucide-react';
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
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
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
    if (!isConnected || userPlan === 'free') return;

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
  }, [isConnected, userPlan, appSettings.miningIntensity, appSettings.yieldOptimizationIA, appSettings.contributionType, reputationScore]);

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
        addLog(`Génération de RNC active (Intensité: ${appSettings.miningIntensity}%)`, 'info');
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
              <span className="font-black text-2xl tracking-tighter">Renumerate<span class="text-cyan-500">VPN</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setShowPricing(true)} className="hidden md:flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[10px] font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 shadow-sm transition-all uppercase tracking-widest">
              <Crown className="w-4 h-4 text-amber-500" />
              {userPlan} Plan
            </button>
            
            <div className="h-10 w-px bg-slate-200 dark:border-slate-800 mx-2 hidden md:block"></div>

            <button onClick={() => setShowSettings(true)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:text-cyan-500">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={() => setIsDark(!isDark)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:text-cyan-500">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setUser(null)} className="p-3 rounded-2xl text-slate-500 hover:bg-red-500/10 hover:text-red-500 transition-all">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-10 pb-40 space-y-10 relative z-10">
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
                    balance={balance}
                    reputation={reputationScore}
                    onUpgrade={() => setShowPricing(true)}
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

      {showPricing && <PricingModal currentPlan={userPlan} onUpgrade={(p) => setUserPlan(p)} onClose={() => setShowPricing(false)} />}
      
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
