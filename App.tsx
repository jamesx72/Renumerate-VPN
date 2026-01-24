
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Power, Moon, Sun, SlidersVertical, Crown, Ghost, Loader2, LogOut, ShieldCheck, History, Activity, Wifi, Lock, Terminal, X } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { IdentityMatrix } from './components/IdentityMatrix';
import { PricingModal } from './components/PricingModal';
import { SettingsPanel } from './components/SettingsPanel';
import { EarningsCard } from './components/EarningsCard';
import { SystemLogs } from './components/SystemLogs';
import { SecurityAudit } from './components/SecurityAudit';
import { AuthScreen } from './components/AuthScreen';
import { VerificationModal } from './components/VerificationModal';
import { IdentityAssistant } from './components/IdentityAssistant';
import { ConnectionHistoryModal } from './components/ConnectionHistoryModal';
import { SecureFileTransfer } from './components/SecureFileTransfer';
import { MOCK_IDENTITIES, INITIAL_LOGS, REALISTIC_USER_AGENTS, generateRandomMac, MOCK_NODES } from './constants';
import { VirtualIdentity, ConnectionMode, SecurityReport, LogEntry, PlanTier, AppSettings, DeviceNode, ConnectionSession } from './types';
import { analyzeSecurity } from './services/geminiService';
import { dbService } from './services/dbService';
import { supabase } from './services/supabaseClient';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [user, setUser] = useState<{id: string, email: string} | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [mode, setMode] = useState<ConnectionMode>(ConnectionMode.STANDARD);
  const [currentIdentity, setCurrentIdentity] = useState<VirtualIdentity>(MOCK_IDENTITIES[0]);
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [isMasking, setIsMasking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [userPlan, setUserPlan] = useState<PlanTier>('free');
  const [isVerified, setIsVerified] = useState(false);
  const [balance, setBalance] = useState(0.4215);
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showConnectionHistory, setShowConnectionHistory] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionSession[]>([]);
  const [throughput, setThroughput] = useState({ up: 0, down: 0 });
  
  const [appSettings, setAppSettings] = useState<AppSettings>({
    protocol: 'wireguard',
    dns: 'cloudflare',
    customDnsServer: '',
    killSwitch: true,
    dnsLeakProtection: true,
    dnsCache: true,
    autoReconnect: true,
    reconnectDelay: 3,
    splitTunneling: false,
    adBlocker: false, 
    autoConnect: false,
    autoRotation: false,
    rotationInterval: 10,
    obfuscationLevel: 'standard',
    macScramblingMode: 'random',
    macFormat: 'random',
    uaComplexity: 'diverse',
    vortexBridge: 'none',
    vortexCircuitLength: 3,
    vortexEntryNodeCountry: 'auto',
    vortexExitNodeCountry: 'auto',
    vortexNoScript: false,
    miningIntensity: 50,
    yieldOptimizationIA: true,
    contributionType: 'passive',
    autoWithdraw: false,
    mtuSize: 1420,
    ipv6LeakProtection: true,
    localNetworkSharing: false,
    lanBypass: true,
    logRetentionHours: 168,
    socks5Enabled: false,
    socks5Host: '127.0.0.1',
    socks5Port: 1080
  });

  const addLog = useCallback((event: string, type: 'info' | 'warning' | 'success' | 'error' = 'info', ip?: string) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleTimeString('fr-FR'), timestampRaw: Date.now(), event, type, ip }].slice(-500));
  }, []);

  const connectVPN = useCallback(async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(false);
    addLog(`Démarrage du tunnel Renumerate (${appSettings.protocol.toUpperCase()})...`, 'info', currentIdentity.ip);
    
    if (mode === ConnectionMode.ONION_VORTEX) {
        addLog(`Construction du circuit Vortex (${appSettings.vortexCircuitLength} sauts)...`, 'info');
    }

    setTimeout(async () => {
      setIsConnected(true);
      addLog(`Réseau VPN rejoint via protocole sécurisé`, 'success', currentIdentity.ip);
      
      const newSession: ConnectionSession = {
        id: Math.random().toString(36).substr(2, 9),
        serverCountry: currentIdentity.country,
        serverIp: currentIdentity.ip,
        startTime: Date.now(),
        protocol: appSettings.protocol,
        mode: mode,
        durationString: 'En cours...'
      };

      setConnectionHistory(prev => [newSession, ...prev]);
      const report = await analyzeSecurity(mode, currentIdentity.country, currentIdentity.ip);
      setSecurityReport(report);
    }, 1200);
  }, [appSettings.protocol, mode, currentIdentity, addLog, isDisconnecting, appSettings.vortexCircuitLength]);

  const disconnectVPN = useCallback(() => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    addLog('Fermeture sécurisée du tunnel...', 'warning', currentIdentity.ip);
    setTimeout(() => {
      setConnectionHistory(prev => {
        if (prev.length === 0) return prev;
        const last = { ...prev[0] };
        const durationMin = Math.max(1, Math.round((Date.now() - last.startTime) / 60000));
        last.durationString = `${durationMin} min`;
        return [last, ...prev.slice(1)];
      });

      setIsConnected(false);
      setIsDisconnecting(false);
      setSecurityReport(null);
      addLog('Session déconnectée', 'info', currentIdentity.ip);
    }, 800);
  }, [currentIdentity.ip, addLog, isDisconnecting]);

  const handleGlobalScramble = useCallback(() => {
    setIsMasking(true);
    addLog(`Morphing neuronal (Niveau: ${appSettings.obfuscationLevel.toUpperCase()})...`, 'info');
    setTimeout(() => {
      const newUA = REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)];
      const newMac = generateRandomMac(appSettings.macScramblingMode, appSettings.macFormat);
      setCurrentIdentity(prev => ({ ...prev, mac: newMac, userAgentShort: newUA.short }));
      setIsMasking(false);
      addLog(`Identité matérielle re-numérotée : ${newMac}`, 'success');
    }, 1500);
  }, [appSettings.macScramblingMode, appSettings.macFormat, appSettings.obfuscationLevel, addLog]);

  const handleScrambleUA = useCallback(() => {
    const newUA = REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)];
    setCurrentIdentity(prev => ({ ...prev, userAgentShort: newUA.short }));
    addLog(`Spoofing UA réussi`, 'success');
  }, [addLog]);

  const handleSelectUA = useCallback((uaShort: string) => {
    setIsMasking(true);
    addLog(`Injection de la signature logicielle : ${uaShort}...`, 'info');
    setTimeout(() => {
        setCurrentIdentity(prev => ({ ...prev, userAgentShort: uaShort }));
        setIsMasking(false);
        addLog(`Empreinte synchronisée : ${uaShort}`, 'success');
    }, 800);
  }, [addLog]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      
      if (isCmdOrCtrl) {
        const key = e.key.toLowerCase();
        
        if (key === 's') {
          e.preventDefault();
          addLog('Raccourci détecté : Basculer connexion [Ctrl+S]', 'info');
          if (isConnected) disconnectVPN();
          else connectVPN();
        } 
        else if (key === 'r') {
          e.preventDefault();
          addLog('Raccourci détecté : Re-numéroter identité [Ctrl+R]', 'info');
          handleGlobalScramble();
        }
        else if (key === 'm') {
          e.preventDefault();
          addLog('Raccourci détecté : Masquer empreinte [Ctrl+M]', 'info');
          handleScrambleUA();
        }
        else if (key === 'l') {
          e.preventDefault();
          setShowLogs(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, connectVPN, disconnectVPN, handleGlobalScramble, handleScrambleUA, addLog]);

  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setThroughput({
          up: parseFloat((Math.random() * 2.5).toFixed(2)),
          down: parseFloat((Math.random() * 45).toFixed(2))
        });
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setThroughput({ up: 0, down: 0 });
    }
  }, [isConnected]);

  useEffect(() => {
    if (user?.id) {
      const syncData = async () => {
        try {
          const profile = await dbService.getOrCreateProfile(user.id, user.email);
          setUserPlan(profile.plan_tier);
          setIsVerified(profile.is_verified);
          setBalance(parseFloat(profile.balance));

          const remoteSettings = await dbService.getSettings(user.id);
          if (remoteSettings) {
            setAppSettings(prev => ({ ...prev, ...remoteSettings }));
          }
        } catch (err) {
          console.error("Erreur de synchronisation initiale:", err);
        }
      };
      syncData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const handleConnectNode = (nodeId: string) => {
    const node = MOCK_NODES.find(n => n.id === nodeId);
    if (!node) return;

    if (isConnected) {
        addLog(`Transition vers le nœud ${node.name} lancée...`, 'info');
        disconnectVPN();
        setTimeout(() => {
            setCurrentIdentity(prev => ({
                ...prev,
                ip: node.ip,
                country: node.country,
                city: node.country === 'France' ? 'Lyon' : node.country === 'Suisse' ? 'Genève' : 'Central',
                latency: node.latency
            }));
            connectVPN();
        }, 1000);
    } else {
        setCurrentIdentity(prev => ({
            ...prev,
            ip: node.ip,
            country: node.country,
            city: node.country === 'France' ? 'Lyon' : node.country === 'Suisse' ? 'Genève' : 'Central',
            latency: node.latency
        }));
        connectVPN();
    }
  };

  const handleProcessPayment = async (plan: PlanTier, method: 'card' | 'paypal' | 'crypto'): Promise<{ success: boolean; redirect: boolean }> => {
    if (method === 'crypto') {
      window.open('https://commerce.coinbase.com/checkout/renumerate-elite', '_blank');
      return { success: true, redirect: true };
    }
    return new Promise((resolve) => {
      setTimeout(async () => {
        setUserPlan(plan);
        if (user?.id) {
           await supabase.from('profiles').update({ plan_tier: plan }).eq('id', user.id);
        }
        resolve({ success: true, redirect: false });
      }, 3000);
    });
  };

  const updateAppSettings = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...appSettings, [key]: value };
    setAppSettings(newSettings);
    if (user?.id) {
      dbService.saveSettings(user.id, newSettings).catch(console.error);
    }
    if (key === 'ipv6LeakProtection') {
      addLog(`Protection IPv6 ${value ? 'activée' : 'désactivée'}`, value ? 'success' : 'warning');
    }
    if (key === 'protocol') {
      addLog(`Protocole changé pour ${String(value).toUpperCase()}`, 'info');
    }
    if (key === 'socks5Enabled') {
      addLog(`Proxy SOCKS5 ${value ? 'activé' : 'désactivé'}`, value ? 'success' : 'warning');
    }
    if (key === 'vortexBridge') {
      addLog(`Bridge Vortex reconfiguré : ${String(value).toUpperCase()}`, 'info');
    }
    if (key === 'vortexCircuitLength') {
      addLog(`Longueur du circuit Vortex : ${value} sauts`, 'info');
    }
    if (key === 'obfuscationLevel') {
      addLog(`Niveau d'obfuscation : ${String(value).toUpperCase()}`, 'info');
    }
  };

  const handleScrambleMac = () => {
    const newMac = generateRandomMac(appSettings.macScramblingMode, appSettings.macFormat);
    setCurrentIdentity(prev => ({ ...prev, mac: newMac }));
    addLog(`Re-numérotation MAC réussi`, 'success');
  };

  if (!user) return <AuthScreen onLogin={(e) => {
    const userData = {id: Math.random().toString(36).substr(2, 9), email: e};
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }} />;

  return (
    <div className={`min-h-screen transition-colors duration-500 overflow-x-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 cyber-grid opacity-[0.03] dark:opacity-[0.05]"></div>
          {/* Animated Background Pulse Synchronized with Connection */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-brand-500/5 blur-[150px] rounded-full transition-all duration-1000 ${isConnected ? 'opacity-100 scale-110 animate-pulse' : 'opacity-40 scale-100'}`}></div>
          <div className={`absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full transition-all duration-[2000ms] ${isConnected ? 'opacity-80 translate-x-20' : 'opacity-0 translate-x-40'}`}></div>
      </div>

      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-600 rounded-2xl shadow-lg shadow-cyan-500/20"><Shield className="w-7 h-7 text-white" /></div>
              <div className="flex flex-col -gap-1">
                <span className="font-black text-xl tracking-tighter">Renumerate<span className="text-cyan-500">VPN</span></span>
                <div className="flex items-center gap-2 opacity-50">
                   <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                   <span className="text-[8px] font-black uppercase tracking-widest">{isConnected ? 'UPLINK_STABLE' : 'OFFLINE_MODE'}</span>
                </div>
              </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 px-8 border-x border-slate-200 dark:border-slate-800 h-full">
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Activity className="w-3 h-3 text-cyan-500" /> BPS_DN</span>
                 <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{throughput.down} Mb/s</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Wifi className="w-3 h-3 text-purple-500" /> BPS_UP</span>
                 <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{throughput.up} Mb/s</span>
              </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setShowPricing(true)} className="hidden md:flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[10px] font-black border uppercase tracking-widest bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-500 hover:scale-105 transition-transform"><Crown className="w-4 h-4 text-amber-500" /> {userPlan.toUpperCase()} Plan</button>
            <button onClick={() => setShowConnectionHistory(true)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-110" title="Historique de connexion"><History className="w-5 h-5" /></button>
            <button onClick={() => setShowLogs(true)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-110" title="Journal système (Ctrl+L)"><Terminal className="w-5 h-5" /></button>
            <button onClick={() => setShowSettings(true)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:rotate-90 duration-500" title="Paramètres"><SlidersVertical className="w-5 h-5" /></button>
            <button onClick={() => setIsDark(!isDark)} className="p-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">{isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-3 rounded-2xl text-slate-500 hover:bg-red-50/10 hover:text-red-500 transition-all"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-10 pb-40 space-y-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-10">
                <Dashboard 
                    isDark={isDark} 
                    protocol={appSettings.protocol} 
                    isEmergency={false} 
                    securityReport={securityReport} 
                    isConnected={isConnected} 
                    userPlan={userPlan} 
                    mode={mode} 
                    onModeChange={(m) => setMode(m)} 
                    nodes={MOCK_NODES} 
                    onConnectNode={handleConnectNode} 
                    currentIp={currentIdentity.ip}
                    settings={appSettings}
                    addLog={addLog}
                    updateSettings={updateAppSettings}
                    history={connectionHistory}
                />
                <IdentityMatrix 
                  identity={currentIdentity} 
                  isRotating={isRenumbering} 
                  isMasking={isMasking} 
                  mode={mode} 
                  securityReport={securityReport} 
                  onMask={handleGlobalScramble} 
                  onScrambleMac={handleScrambleMac} 
                  onScrambleUA={handleScrambleUA} 
                  onSelectUA={handleSelectUA}
                  isConnected={isConnected} 
                  macFormat={appSettings.macFormat}
                  onFormatChange={(fmt) => {
                    updateAppSettings('macFormat', fmt);
                  }}
                  ipv6LeakProtection={appSettings.ipv6LeakProtection}
                  onIpv6Toggle={(enabled) => updateAppSettings('ipv6LeakProtection', enabled)}
                  obfuscationLevel={appSettings.obfuscationLevel}
                  onObfuscationLevelChange={(lvl) => updateAppSettings('obfuscationLevel', lvl)}
                />
            </div>
            <div className="lg:col-span-4 space-y-8">
                <EarningsCard isConnected={isConnected} plan={userPlan} isVerified={isVerified} balance={balance} onUpgrade={() => setShowPricing(true)} onVerify={() => setShowVerification(true)} onWithdraw={() => {}} settings={appSettings} />
                <SecureFileTransfer isConnected={isConnected} addLog={addLog} />
                <SecurityAudit currentIp={currentIdentity.ip} location={currentIdentity.country} />
                <SystemLogs 
                  logs={logs} 
                  onClear={() => setLogs([])} 
                  retentionHours={appSettings.logRetentionHours}
                  onRetentionChange={(hours) => updateAppSettings('logRetentionHours', hours)}
                />
            </div>
        </div>
      </main>

      <IdentityAssistant 
        mode={mode} 
        isConnected={isConnected} 
        securityScore={securityReport?.score || 0} 
      />

      <div className="fixed bottom-0 left-0 right-0 z-[60] p-6 flex justify-center pointer-events-none">
          <div className="w-full max-w-lg glass-card p-2 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl pointer-events-auto">
              <button
                onClick={isConnected ? disconnectVPN : connectVPN}
                disabled={isDisconnecting}
                className={`w-full h-16 rounded-[2rem] font-black text-lg text-white shadow-2xl transition-all duration-500 flex items-center justify-center gap-4 active:scale-95 group overflow-hidden relative ${isConnected ? 'bg-slate-900' : 'bg-cyan-600 hover:bg-cyan-700'}`}
              >
                {isDisconnecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Power className={`w-6 h-6 ${isConnected ? 'rotate-180' : ''}`} />}
                <span className="tracking-[0.1em] font-black">{isConnected ? 'DÉCONNECTER' : 'SÉCURISER LE TUNNEL'}</span>
              </button>
          </div>
      </div>

      {showPricing && (
        <PricingModal 
          currentPlan={userPlan} 
          onUpgrade={async (plan, method) => {
            const result = await handleProcessPayment(plan, method as any);
            return result.success && !result.redirect;
          }} 
          onClose={() => setShowPricing(false)} 
        />
      )}
      {showVerification && <VerificationModal onClose={() => setShowVerification(false)} onSuccess={()=>{setIsVerified(true); setShowVerification(false)}} />}
      {showSettings && <SettingsPanel settings={appSettings} updateSettings={updateAppSettings} onClose={() => setShowSettings(false)} userPlan={userPlan} onShowPricing={() => { setShowSettings(false); setShowPricing(true); }} />}
      {showConnectionHistory && <ConnectionHistoryModal history={connectionHistory} onClose={() => setShowConnectionHistory(false)} onClear={() => setConnectionHistory([])} />}
      
      {showLogs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowLogs(false)} />
          <div className="relative w-full max-w-3xl bg-slate-950 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 h-[600px]">
             <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-4">
                   <div className="p-2.5 bg-brand-500/10 rounded-xl border border-brand-500/20">
                      <Terminal className="w-6 h-6 text-brand-500" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-widest">Console_Système</h2>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Uplink_Realtime_Output</p>
                   </div>
                </div>
                <button onClick={() => setShowLogs(false)} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all border border-slate-800 hover:rotate-90">
                   <X className="w-6 h-6" />
                </button>
             </div>
             <div className="flex-1 overflow-hidden p-6">
                <SystemLogs 
                  logs={logs} 
                  onClear={() => setLogs([])} 
                  retentionHours={appSettings.logRetentionHours}
                  onRetentionChange={(hours) => updateAppSettings('logRetentionHours', hours)}
                />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
