import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Power, Moon, Sun, Globe, Activity, Settings, Crown, Wallet, Ghost, Layers, AlertTriangle, Siren, Loader2, LogOut, CheckCircle, ArrowUpRight, History, Network, Zap } from 'lucide-react';
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
  const [notification, setNotification] = useState<string | null>(null);
  
  // Auth State
  const [user, setUser] = useState<{email: string} | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

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

  useEffect(() => {
    localStorage.setItem('connectionHistory', JSON.stringify(connectionHistory));
  }, [connectionHistory]);

  const [userPlan, setUserPlan] = useState<PlanTier>('free');
  const [showPricing, setShowPricing] = useState(false);
  
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
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
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
    
    setTimeout(() => {
      setIsConnected(true);
      addLog(`Connexion établie (${appSettings.protocol.toUpperCase()})`, 'success');
    }, 1500);
  }, [appSettings.protocol, addLog]);

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
        setConnectionHistory(prev => [newSession, ...prev]);
        connectionStartRef.current = null;
    }

    setTimeout(() => {
      setIsConnected(false);
      setIsDisconnecting(false);
      setSecurityReport(null);
      addLog('Déconnecté', 'info');
    }, 1000);
  }, [addLog, currentIdentity, appSettings.protocol, mode]);

  const handleAnalyze = useCallback(async (identity: VirtualIdentity = currentIdentity) => {
    if (!isConnected) return;
    try {
      const report = await analyzeSecurity(mode, identity.country, identity.ip);
      setSecurityReport(report);
    } catch (error) {
      addLog('Échec de l\'analyse de sécurité', 'error');
    }
  }, [isConnected, mode, currentIdentity, addLog]);

  useEffect(() => {
    if (isConnected && !isDisconnecting) handleAnalyze();
  }, [isConnected, isDisconnecting, handleAnalyze]);

  const generateRealisticMAC = useCallback(() => {
      const hex = "0123456789ABCDEF";
      const formats = ['colon', 'hyphen', 'dot'];
      const format = formats[Math.floor(Math.random() * formats.length)];
      
      let parts = [];
      for (let i = 0; i < 6; i++) {
          let byte = "";
          if (i === 0) {
              const firstNibble = hex.charAt(Math.floor(Math.random() * 16));
              const secondNibble = ["2", "6", "A", "E"][Math.floor(Math.random() * 4)];
              byte = firstNibble + secondNibble;
          } else {
              byte = hex.charAt(Math.floor(Math.random() * 16)) + hex.charAt(Math.floor(Math.random() * 16));
          }
          parts.push(byte);
      }

      switch(format) {
          case 'hyphen': return parts.join('-');
          case 'dot': 
              const flat = parts.join('');
              return `${flat.slice(0,4)}.${flat.slice(4,8)}.${flat.slice(8,12)}`;
          default: return parts.join(':');
      }
  }, []);

  const handleMasking = useCallback(() => {
    if (!isConnected || mode === ConnectionMode.SMART_DNS || isMasking) return;
    
    setIsMasking(true);
    addLog('Calcul de l\'obfuscation de l\'empreinte matérielle...', 'info');
    
    setTimeout(() => {
        const fullUserAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
        ];

        const displayNames = [
            'Chrome 126 / Windows 11',
            'Safari 17.5 / macOS',
            'Firefox 127 / Ubuntu',
            'iOS 17.5 / iPhone 15 Pro',
            'Android 14 / Pixel 8 Pro',
            'Edge 126 / Windows 10'
        ];

        const idx = Math.floor(Math.random() * fullUserAgents.length);
        const randomUA = fullUserAgents[idx];
        const displayUA = displayNames[idx];
        const newMAC = generateRealisticMAC();
        
        setCurrentIdentity(prev => ({
            ...prev,
            mac: newMAC,
            userAgentShort: displayUA
        }));
        
        setIsMasking(false);
        addLog(`Empreinte mise à jour : ${displayUA}`, 'success');
        handleAnalyze();
    }, 2000);
  }, [isConnected, mode, isMasking, addLog, handleAnalyze, generateRealisticMAC]);

  const toggleConnection = async () => {
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

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-brand-500" />
              <span className="font-bold text-xl tracking-tight">Renumerate<span className="text-brand-500">VPN</span></span>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPricing(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-slate-800 text-amber-400 border border-amber-500/30">
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{userPlan.toUpperCase()}</span>
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
                entryIdentity={null} 
                isRotating={isRenumbering}
                isMasking={isMasking}
                mode={mode}
                securityReport={securityReport}
                onMask={handleMasking}
                isConnected={isConnected}
            />
        </div>
      </main>

      {showPricing && <PricingModal currentPlan={userPlan} onUpgrade={(p) => setUserPlan(p)} onClose={() => setShowPricing(false)} />}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-sm px-4">
        <button
          onClick={toggleConnection}
          disabled={isDisconnecting}
          className={`w-full h-16 rounded-2xl font-bold text-lg text-white shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 ${
            isConnected ? 'bg-indigo-500 shadow-indigo-500/50' : 'bg-brand-500 shadow-brand-500/50 hover:bg-brand-600'
          }`}
        >
          {isDisconnecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Power className="w-6 h-6" />}
          <span>{isConnected ? 'DÉCONNECTER' : 'CONNECTER'}</span>
        </button>
      </div>
    </div>
  );
}

export default App;