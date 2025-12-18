import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Power, Moon, Sun, Globe, Activity, Settings, Crown, Wallet, Ghost, Layers, AlertTriangle, Siren, Loader2, LogOut, CheckCircle, ArrowUpRight, History, Network } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { IdentityMatrix } from './components/IdentityMatrix';
import { SecureFileTransfer } from './components/SecureFileTransfer';
import { PricingModal } from './components/PricingModal';
import { SettingsPanel } from './components/SettingsPanel';
import { EarningsCard } from './components/EarningsCard';
import { SystemLogs } from './components/SystemLogs';
import { WithdrawalModal } from './components/WithdrawalModal';
import { TransactionHistoryModal } from './components/TransactionHistoryModal';
import { ConnectionHistoryModal } from './components/ConnectionHistoryModal';
import { AuthScreen } from './components/AuthScreen';
import { NetworkView } from './components/NetworkView';
import { VerificationModal } from './components/VerificationModal';
import { MOCK_IDENTITIES, INITIAL_LOGS } from './constants';
import { VirtualIdentity, ConnectionMode, SecurityReport, LogEntry, PlanTier, AppSettings, Transaction, ConnectionSession, DeviceNode, PaymentMethod } from './types';
import { analyzeSecurity } from './services/geminiService';
import { supabase } from './services/supabaseClient';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyStep, setEmergencyStep] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'network'>('dashboard');
  
  // Auth State
  const [user, setUser] = useState<{email: string} | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isVerified, setIsVerified] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
    const saved = localStorage.getItem('paymentMethods');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('paymentMethods', JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  const [mode, setMode] = useState<ConnectionMode>(() => {
    const saved = localStorage.getItem('vpnMode');
    if (saved && Object.values(ConnectionMode).includes(saved as ConnectionMode)) {
      return saved as ConnectionMode;
    }
    return ConnectionMode.STANDARD;
  });

  useEffect(() => {
    localStorage.setItem('vpnMode', mode);
  }, [mode]);

  const [currentIdentity, setCurrentIdentity] = useState<VirtualIdentity>(() => {
    const saved = localStorage.getItem('currentIdentity');
    return saved ? JSON.parse(saved) : MOCK_IDENTITIES[0];
  });

  const [entryIdentity, setEntryIdentity] = useState<VirtualIdentity | null>(null);
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [isMasking, setIsMasking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);

  const [deviceNodes, setDeviceNodes] = useState<DeviceNode[]>([]);
  const connectionStartRef = useRef<number | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionSession[]>(() => {
    const saved = localStorage.getItem('connectionHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [showConnectionHistory, setShowConnectionHistory] = useState(false);

  useEffect(() => {
    localStorage.setItem('connectionHistory', JSON.stringify(connectionHistory));
  }, [connectionHistory]);

  const [userPlan, setUserPlan] = useState<PlanTier>('free');
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [initialSettingsTab, setInitialSettingsTab] = useState<'general' | 'connection' | 'privacy' | 'advanced' | 'billing'>('general');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [balance, setBalance] = useState(0.0000);
  const [totalEarned, setTotalEarned] = useState(() => {
      const saved = localStorage.getItem('totalEarned');
      return saved ? parseFloat(saved) : 0;
  });
  const [totalWithdrawn, setTotalWithdrawn] = useState(() => {
      const saved = localStorage.getItem('totalWithdrawn');
      return saved ? parseFloat(saved) : 0;
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  useEffect(() => localStorage.setItem('totalEarned', totalEarned.toString()), [totalEarned]);
  useEffect(() => localStorage.setItem('totalWithdrawn', totalWithdrawn.toString()), [totalWithdrawn]);

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
      autoConnectOnBoot: false,
      autoRotation: false,
      rotationInterval: 10,
      obfuscationLevel: 'standard',
      mtuSize: 1420,
      ipv6LeakProtection: true,
      localNetworkSharing: false,
      logRetentionHours: 168
    };
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
      const countries = ['France', 'Suisse', 'Singapour', 'Islande', 'Panama', 'Estonie'];
      const mockNodes: DeviceNode[] = Array.from({ length: 18 }, (_, i) => ({
          id: `node-${i}`,
          name: `Renumerate Node ${i+1}`,
          type: i % 4 === 0 ? 'server' : i % 3 === 0 ? 'iot' : 'mobile',
          status: Math.random() > 0.3 ? 'active' : 'idle',
          signalStrength: Math.floor(Math.random() * 60) + 40,
          transferRate: Math.floor(Math.random() * 100),
          latency: Math.floor(Math.random() * 120) + 10,
          autonomyProfile: i % 3 === 0 ? 'provider' : i % 2 === 0 ? 'balanced' : 'consumer',
          tags: ['Secure'],
          ip: `10.8.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          country: countries[i % countries.length]
      }));
      setDeviceNodes(mockNodes);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem('currentIdentity', JSON.stringify(currentIdentity));
  }, [currentIdentity]);

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

  const connectVPN = useCallback(() => {
    setIsDisconnecting(false);
    connectionStartRef.current = Date.now();
    addLog(`Initialisation protocole ${appSettings.protocol}...`, 'info');
    let connectionDelay = 1500;
    
    if (mode === ConnectionMode.STEALTH) connectionDelay = 3500;
    if (mode === ConnectionMode.DOUBLE_HOP) connectionDelay = 4000;

    setTimeout(() => {
      setIsConnected(true);
      addLog(`Connexion établie (${appSettings.protocol.toUpperCase()}) - Canal chiffré actif`, 'success');
    }, connectionDelay);
  }, [appSettings, mode, addLog]);

  const disconnectVPN = useCallback(() => {
    setIsDisconnecting(true);
    addLog('Déconnexion initiée...', 'warning');

    if (connectionStartRef.current) {
        const endTime = Date.now();
        const durationMs = endTime - connectionStartRef.current;
        const seconds = Math.floor((durationMs / 1000) % 60);
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
        const durationString = `${minutes}m ${seconds}s`;

        const newSession: ConnectionSession = {
            id: Math.random().toString(36).substr(2, 9),
            startTime: connectionStartRef.current,
            endTime,
            durationString,
            serverCountry: currentIdentity.country,
            serverIp: currentIdentity.ip,
            protocol: appSettings.protocol,
            mode: mode
        };
        setConnectionHistory(prev => [newSession, ...prev].slice(0, 50));
        connectionStartRef.current = null;
    }

    setTimeout(() => {
      setIsConnected(false);
      setIsDisconnecting(false);
      setSecurityReport(null);
      addLog('Déconnecté du réseau sécurisé', 'info');
    }, 1500);
  }, [addLog, currentIdentity, appSettings.protocol, mode]);

  const handleAnalyze = useCallback(async (identity: VirtualIdentity = currentIdentity) => {
    if (!isConnected && !isEmergency) return;
    try {
      const report = await analyzeSecurity(mode, identity.country, identity.ip);
      setSecurityReport(report);
    } catch (error) {
      addLog('Échec de l\'analyse de sécurité', 'error');
    }
  }, [isConnected, isEmergency, mode, currentIdentity, addLog]);

  useEffect(() => {
    if (isConnected && !isDisconnecting && !isEmergency) {
      handleAnalyze();
    }
  }, [isConnected, isDisconnecting, isEmergency, handleAnalyze]);

  // Nouveau générateur d'adresse MAC avancé
  const generateEnhancedMAC = useCallback(() => {
      const hex = "0123456789ABCDEF";
      const formats = ['colon', 'hyphen', 'dot'];
      const format = formats[Math.floor(Math.random() * formats.length)];
      
      let parts = [];
      for (let i = 0; i < 6; i++) {
          let byte = "";
          if (i === 0) {
              // Bit d'administration locale (LAA) : Force le deuxième quartet à 2, 6, A ou E
              const firstNibble = hex.charAt(Math.floor(Math.random() * 16));
              const secondNibble = ["2", "6", "A", "E"][Math.floor(Math.random() * 4)];
              byte = firstNibble + secondNibble;
          } else {
              byte = hex.charAt(Math.floor(Math.random() * 16)) + hex.charAt(Math.floor(Math.random() * 16));
          }
          parts.push(byte);
      }

      if (format === 'colon') return parts.join(':');
      if (format === 'hyphen') return parts.join('-');
      // Format Cisco : XXXX.XXXX.XXXX
      const flat = parts.join('');
      return `${flat.slice(0,4)}.${flat.slice(4,8)}.${flat.slice(8,12)}`;
  }, []);

  const handleMasking = useCallback(() => {
    if (!isConnected || mode === ConnectionMode.SMART_DNS || isMasking || isEmergency || isRenumbering) return;
    
    setIsMasking(true);
    addLog('Spoofing de l\'empreinte numérique (LAA MAC/UA)...', 'info');
    
    setTimeout(() => {
        const userAgents = [
            'Chrome 122 / Windows 11', 
            'Safari 17.4 / macOS Sonoma', 
            'Firefox 123 / Ubuntu 22.04', 
            'Chrome 121 / Android 14', 
            'Safari / iOS 17.3',
            'DuckDuckGo Browser / iPadOS'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        const newMAC = generateEnhancedMAC();
        
        setCurrentIdentity(prev => ({
            ...prev,
            mac: newMAC,
            userAgentShort: randomUA,
            latency: prev.latency + 3
        }));
        
        setIsMasking(false);
        addLog(`Identité spoofée : ${randomUA} | MAC: ${newMAC}`, 'success');
        handleAnalyze();
    }, 2000);
  }, [isConnected, mode, isMasking, isEmergency, isRenumbering, addLog, handleAnalyze, generateEnhancedMAC]);

  const toggleConnection = async () => {
    if (isEmergency) return;
    if (isConnected) disconnectVPN();
    else connectVPN();
  };

  const handleLogin = (email: string) => {
    const newUser = { email };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
      if (isConnected) disconnectVPN();
      setUser(null);
      localStorage.removeItem('user');
  };

  const mainButtonColor = isEmergency 
    ? 'bg-red-500 shadow-red-500/50 animate-pulse'
    : isConnected 
        ? mode === ConnectionMode.STEALTH ? 'bg-indigo-500 shadow-indigo-500/50' 
        : mode === ConnectionMode.DOUBLE_HOP ? 'bg-violet-500 shadow-violet-500/50'
        : mode === ConnectionMode.SMART_DNS ? 'bg-orange-500 shadow-orange-500/50'
        : 'bg-emerald-500 shadow-emerald-500/50' 
        : 'bg-slate-700 shadow-slate-900/50 hover:bg-slate-600';

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-2 bg-slate-900/90 text-white rounded-full shadow-2xl border border-slate-700/50 backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-top-full fade-in duration-300">
             <div className="w-2 h-2 rounded-full bg-brand-500"></div>
             <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {showPricing && <PricingModal currentPlan={userPlan} onUpgrade={(p) => setUserPlan(p)} onClose={() => setShowPricing(false)} />}
      {showSettings && <SettingsPanel settings={appSettings} updateSettings={(k, v) => setAppSettings(prev => ({...prev, [k]: v}))} onClose={() => setShowSettings(false)} userPlan={userPlan} onShowPricing={() => setShowPricing(true)} initialTab={initialSettingsTab} />}

      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
              <Shield className={`w-8 h-8 ${isEmergency ? 'text-red-500' : 'text-brand-500'}`} />
              <span className="font-bold text-xl tracking-tight">Renumerate<span className={`${isEmergency ? 'text-red-500' : 'text-brand-500'}`}>VPN</span></span>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPricing(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-slate-800 text-amber-400 border border-amber-500/30">
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{userPlan.toUpperCase()}</span>
            </button>
            <button onClick={() => setShowConnectionHistory(true)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors relative">
              <History className="w-5 h-5" />
            </button>
            <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-24 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                onConnectNode={(id) => { const n = deviceNodes.find(x => x.id === id); if(n) setCurrentIdentity(prev => ({...prev, ...n})); }}
                currentIp={currentIdentity.ip}
            />
            <IdentityMatrix 
                identity={currentIdentity} 
                entryIdentity={entryIdentity} 
                isRotating={isRenumbering}
                isMasking={isMasking}
                mode={mode}
                securityReport={securityReport}
                onMask={handleMasking}
                isConnected={isConnected}
            />
        </div>
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-sm px-4">
        <button
          onClick={toggleConnection}
          disabled={isEmergency || isDisconnecting}
          className={`w-full h-16 rounded-2xl font-bold text-lg text-white shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 ${mainButtonColor}`}
        >
          {isDisconnecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Power className="w-6 h-6" />}
          <span>{isConnected ? 'DÉCONNECTER' : 'CONNECTER'}</span>
        </button>
      </div>
    </div>
  );
}

export default App;
