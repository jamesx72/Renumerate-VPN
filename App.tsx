import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Power,
  Moon,
  Sun,
  SlidersVertical,
  Crown,
  Loader2,
  LogOut,
  History,
  Terminal,
  X,
  Lock,
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { IdentityMatrix } from './components/IdentityMatrix';
import { NetworkView } from './components/NetworkView';
import { LocalVault } from './components/LocalVault';
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
import { WithdrawalModal } from './components/WithdrawalModal';
import { TransactionHistoryModal } from './components/TransactionHistoryModal';
import {
  MOCK_IDENTITIES,
  INITIAL_LOGS,
  REALISTIC_USER_AGENTS,
  generateRandomMac,
  MOCK_NODES,
} from './constants';
import {
  VirtualIdentity,
  ConnectionMode,
  SecurityReport,
  LogEntry,
  PlanTier,
  AppSettings,
  DeviceNode,
  ConnectionSession,
  Transaction,
} from './types';
import { analyzeSecurity } from './services/geminiService';
import { dbService, ensureValidUserId } from './services/dbService';
import { listUserVaultItems } from './services/cryptoVaultService';

type WorkspaceSection = 'cockpit' | 'vault' | 'network';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeSection, setActiveSection] =
    useState<WorkspaceSection>('cockpit');
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as { id?: string; email?: string };
      if (!parsed?.email) return null;
      const normalized = {
        id: ensureValidUserId(parsed.id, parsed.email),
        email: parsed.email.trim().toLowerCase(),
      };
      if (normalized.id !== parsed.id || normalized.email !== parsed.email) {
        localStorage.setItem('user', JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return null;
    }
  });

  // Session password kept strictly in volatile RAM for WebCrypto PBKDF2 derivation (never persisted)
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);
  const [vaultRevision, setVaultRevision] = useState(0);
  const [vaultCount, setVaultCount] = useState(0);

  const [nodes, setNodes] = useState<DeviceNode[]>(MOCK_NODES);
  const [mode, setMode] = useState<ConnectionMode>(ConnectionMode.STANDARD);
  const [currentIdentity, setCurrentIdentity] = useState<VirtualIdentity>(
    MOCK_IDENTITIES[0]
  );
  const [isRenumbering] = useState(false);
  const [isMasking, setIsMasking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(
    null
  );
  const [userPlan, setUserPlan] = useState<PlanTier>('free');
  const [isVerified, setIsVerified] = useState(false);
  const [balance, setBalance] = useState(0.4215);
  const [reputation, setReputation] = useState(100);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [showConnectionHistory, setShowConnectionHistory] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<
    ConnectionSession[]
  >([]);
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
    socks5Port: 1080,
  });

  const addLog = useCallback(
    (
      event: string,
      type: 'info' | 'warning' | 'success' | 'error' = 'info',
      ip?: string
    ) => {
      setLogs((prev) =>
        [
          ...prev,
          {
            id: Math.random().toString(36).slice(2, 11),
            timestamp: new Date().toLocaleTimeString('fr-FR'),
            timestampRaw: Date.now(),
            event,
            type,
            ip,
          },
        ].slice(-500)
      );
    },
    []
  );

  const vaultOwnerKey = user?.email ? user.email.toLowerCase() : 'anonymous';

  useEffect(() => {
    if (!user?.email) {
      setVaultCount(0);
      return;
    }
    listUserVaultItems(vaultOwnerKey)
      .then((items) => setVaultCount(items.length))
      .catch(() => {});
  }, [user?.email, vaultOwnerKey, vaultRevision]);

  const connectVPN = useCallback(async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(false);
    addLog(
      `Démarrage du tunnel Renumerate (${appSettings.protocol.toUpperCase()})...`,
      'info',
      currentIdentity.ip
    );

    if (mode === ConnectionMode.ONION_VORTEX) {
      addLog(
        `Construction du circuit Vortex (${appSettings.vortexCircuitLength} sauts)...`,
        'info'
      );
    }

    setTimeout(async () => {
      setIsConnected(true);
      addLog(
        'Réseau VPN rejoint via protocole sécurisé',
        'success',
        currentIdentity.ip
      );

      const newSession: ConnectionSession = {
        id: Math.random().toString(36).slice(2, 11),
        serverCountry: currentIdentity.country,
        serverIp: currentIdentity.ip,
        startTime: Date.now(),
        protocol: appSettings.protocol,
        mode: mode,
        durationString: 'En cours...',
      };

      setConnectionHistory((prev) => [newSession, ...prev]);
      if (user?.id) {
        dbService.logSession(user.id, newSession).catch(() => {});
      }
      const report = await analyzeSecurity(
        mode,
        currentIdentity.country,
        currentIdentity.ip
      );
      setSecurityReport(report);
    }, 1200);
  }, [
    appSettings.protocol,
    mode,
    currentIdentity,
    addLog,
    isDisconnecting,
    appSettings.vortexCircuitLength,
    user?.id,
  ]);

  const disconnectVPN = useCallback(() => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    addLog('Fermeture sécurisée du tunnel...', 'warning', currentIdentity.ip);
    setTimeout(() => {
      setConnectionHistory((prev) => {
        if (prev.length === 0) return prev;
        const last = { ...prev[0] };
        const durationMin = Math.max(
          1,
          Math.round((Date.now() - last.startTime) / 60000)
        );
        last.durationString = `${durationMin} min`;
        if (user?.id) {
          dbService
            .finalizeLatestSession(user.id, last.id, last.durationString)
            .catch(() => {});
        }
        return [last, ...prev.slice(1)];
      });

      setIsConnected(false);
      setIsDisconnecting(false);
      setSecurityReport(null);
      addLog('Session déconnectée', 'info', currentIdentity.ip);
    }, 800);
  }, [currentIdentity.ip, addLog, isDisconnecting, user?.id]);

  const handleGlobalScramble = useCallback(() => {
    setIsMasking(true);
    addLog(
      `Morphing neuronal (Niveau: ${appSettings.obfuscationLevel.toUpperCase()})...`,
      'info'
    );
    setTimeout(() => {
      const newUA =
        REALISTIC_USER_AGENTS[
          Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)
        ];
      const newMac = generateRandomMac(
        appSettings.macScramblingMode,
        appSettings.macFormat
      );
      setCurrentIdentity((prev) => ({
        ...prev,
        mac: newMac,
        userAgentShort: newUA.short,
      }));
      setIsMasking(false);
      addLog(`Identité matérielle re-numérotée : ${newMac}`, 'success');
    }, 1500);
  }, [
    appSettings.macScramblingMode,
    appSettings.macFormat,
    appSettings.obfuscationLevel,
    addLog,
  ]);

  const handleScrambleUA = useCallback(() => {
    const newUA =
      REALISTIC_USER_AGENTS[
        Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)
      ];
    setCurrentIdentity((prev) => ({ ...prev, userAgentShort: newUA.short }));
    addLog('Spoofing UA réussi', 'success');
  }, [addLog]);

  const handleSelectUA = useCallback(
    (uaShort: string) => {
      setIsMasking(true);
      addLog(`Injection de la signature logicielle : ${uaShort}...`, 'info');
      setTimeout(() => {
        setCurrentIdentity((prev) => ({ ...prev, userAgentShort: uaShort }));
        setIsMasking(false);
        addLog(`Empreinte synchronisée : ${uaShort}`, 'success');
      }, 800);
    },
    [addLog]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;
      const key = e.key.toLowerCase();

      if (key === 's') {
        e.preventDefault();
        addLog('Raccourci détecté : Basculer connexion [Ctrl+S]', 'info');
        if (isConnected) disconnectVPN();
        else connectVPN();
      } else if (key === 'r') {
        e.preventDefault();
        addLog('Raccourci détecté : Re-numéroter identité [Ctrl+R]', 'info');
        handleGlobalScramble();
      } else if (key === 'm') {
        e.preventDefault();
        addLog('Raccourci détecté : Masquer empreinte [Ctrl+M]', 'info');
        handleScrambleUA();
      } else if (key === 'l') {
        e.preventDefault();
        setShowLogs((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isConnected,
    connectVPN,
    disconnectVPN,
    handleGlobalScramble,
    handleScrambleUA,
    addLog,
  ]);

  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setThroughput({
          up: parseFloat((Math.random() * 2.5 + 0.4).toFixed(2)),
          down: parseFloat((Math.random() * 45 + 8).toFixed(2)),
        });
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setThroughput({ up: 0, down: 0 });
    }
  }, [isConnected]);

  useEffect(() => {
    if (user?.id && user?.email) {
      let cancelled = false;
      const syncData = async () => {
        try {
          const [profile, savedSettings, savedSessions, savedTransactions] =
            await Promise.all([
              dbService.getOrCreateProfile(user.id, user.email),
              dbService.getSettings(user.id),
              dbService.getSessions(user.id),
              dbService.getTransactions(user.id),
            ]);

          if (cancelled) return;

          if (profile?.plan_tier) setUserPlan(profile.plan_tier);
          if (typeof profile?.is_verified === 'boolean') {
            setIsVerified(profile.is_verified);
          }
          if (profile?.balance !== undefined) {
            const parsed = parseFloat(profile.balance);
            if (!Number.isNaN(parsed)) setBalance(parsed);
          }
          if (typeof profile?.reputation === 'number') {
            setReputation(profile.reputation);
          }

          if (savedSettings) {
            setAppSettings((prev) => ({ ...prev, ...savedSettings }));
          }
          setConnectionHistory(savedSessions);
          setTransactions(savedTransactions);
        } catch (err) {
          console.error('Erreur de synchronisation du profil:', err);
        }
      };
      syncData();
      return () => {
        cancelled = true;
      };
    }
  }, [user?.id, user?.email]);

  // Contribution RNC en temps réel lorsque le tunnel est connecté et le profil vérifié
  useEffect(() => {
    if (!isConnected || userPlan === 'free' || !isVerified || !user?.id || !user?.email) {
      return;
    }

    const baseRate = userPlan === 'elite' ? 0.00018 : 0.00006;
    const intensityMult = 0.5 + appSettings.miningIntensity / 100;
    const iaMult = appSettings.yieldOptimizationIA ? 1.25 : 1.0;
    const typeMult =
      appSettings.contributionType === 'exit'
        ? 1.5
        : appSettings.contributionType === 'relay'
          ? 1.25
          : 1.0;
    const deltaPerTick = baseRate * intensityMult * iaMult * typeMult * 3;

    const timer = setInterval(() => {
      dbService
        .addEarnings(user.id, user.email, deltaPerTick)
        .then((nextBalance) => setBalance(nextBalance))
        .catch(() => {
          setBalance((prev) => prev + deltaPerTick);
        });
    }, 3000);

    return () => clearInterval(timer);
  }, [
    isConnected,
    userPlan,
    isVerified,
    user?.id,
    user?.email,
    appSettings.miningIntensity,
    appSettings.yieldOptimizationIA,
    appSettings.contributionType,
  ]);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const handleConnectNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const nextCity =
      node.country === 'France'
        ? 'Lyon'
        : node.country === 'Suisse'
          ? 'Genève'
          : 'Central';

    if (isConnected) {
      addLog(`Transition vers le nœud ${node.name} lancée...`, 'info');
      disconnectVPN();
      setTimeout(() => {
        setCurrentIdentity((prev) => ({
          ...prev,
          ip: node.ip,
          country: node.country,
          city: nextCity,
          latency: node.latency,
        }));
        connectVPN();
      }, 900);
    } else {
      setCurrentIdentity((prev) => ({
        ...prev,
        ip: node.ip,
        country: node.country,
        city: nextCity,
        latency: node.latency,
      }));
      connectVPN();
    }
  };

  const handleAutonomyUpdate = (
    nodeId: string,
    profile: 'provider' | 'balanced' | 'consumer'
  ) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, autonomyProfile: profile } : n))
    );
    addLog(`Profil d'autonomie ajusté (${profile})`, 'info');
  };

  const handleProcessPayment = async (
    plan: PlanTier
  ): Promise<{ success: boolean; redirect: boolean }> => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        setUserPlan(plan);
        if (user?.id && user?.email) {
          await dbService.updateProfile(user.id, user.email, {
            plan_tier: plan,
          });
        }
        addLog(`Forfait mis à niveau : ${plan.toUpperCase()}`, 'success');
        resolve({ success: true, redirect: false });
      }, 1200);
    });
  };

  const updateAppSettings = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...appSettings, [key]: value };
    setAppSettings(newSettings);
    if (user?.id) {
      dbService.saveSettings(user.id, newSettings).catch(console.error);
    }
    if (key === 'ipv6LeakProtection') {
      addLog(
        `Protection IPv6 ${value ? 'activée' : 'désactivée'}`,
        value ? 'success' : 'warning'
      );
    }
    if (key === 'protocol') {
      addLog(`Protocole changé pour ${String(value).toUpperCase()}`, 'info');
    }
    if (key === 'socks5Enabled') {
      addLog(
        `Proxy SOCKS5 ${value ? 'activé' : 'désactivé'}`,
        value ? 'success' : 'warning'
      );
    }
    if (key === 'vortexBridge') {
      addLog(
        `Bridge Vortex reconfiguré : ${String(value).toUpperCase()}`,
        'info'
      );
    }
    if (key === 'vortexCircuitLength') {
      addLog(`Longueur du circuit Vortex : ${value} sauts`, 'info');
    }
    if (key === 'obfuscationLevel') {
      addLog(
        `Niveau d'obfuscation : ${String(value).toUpperCase()}`,
        'info'
      );
    }
  };

  const handleScrambleMac = () => {
    const newMac = generateRandomMac(
      appSettings.macScramblingMode,
      appSettings.macFormat
    );
    setCurrentIdentity((prev) => ({ ...prev, mac: newMac }));
    addLog('Re-numérotation MAC réussie', 'success');
  };

  const handleLogout = () => {
    setSessionPassword(null);
    setIsConnected(false);
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return (
      <AuthScreen
        onLogin={(email, password, userId) => {
          const userData = {
            id: ensureValidUserId(userId, email),
            email: email.trim().toLowerCase(),
          };
          setUser(userData);
          setSessionPassword(password);
          localStorage.setItem('user', JSON.stringify(userData));
        }}
      />
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 overflow-x-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* 3-Zone Top Workspace Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
            <div className="p-2 bg-cyan-600 rounded-xl text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight">
              Renumerate <span className="text-cyan-500">VPN</span>
            </span>
          </div>

          {/* Zone 2: Primary Workspace Navigation */}
          <nav className="hidden md:flex items-center gap-6 whitespace-nowrap">
            <button
              onClick={() => setActiveSection('cockpit')}
              className={`py-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeSection === 'cockpit'
                  ? 'border-cyan-500 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Cockpit VPN
            </button>
            <button
              onClick={() => setActiveSection('vault')}
              className={`py-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'vault'
                  ? 'border-cyan-500 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-cyan-500" />
              <span>Coffre-fort local</span>
              <span className="font-mono tabular-nums text-xs text-slate-400">
                ({vaultCount})
              </span>
            </button>
            <button
              onClick={() => setActiveSection('network')}
              className={`py-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeSection === 'network'
                  ? 'border-cyan-500 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Topologie Réseau
            </button>
          </nav>

          {/* Zone 3: Primary Tunnel Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={isConnected ? disconnectVPN : connectVPN}
              disabled={isDisconnecting}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
                isConnected
                  ? 'bg-emerald-600 hover:bg-red-600'
                  : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              {isDisconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              <span>
                {isDisconnecting
                  ? 'Fermeture...'
                  : isConnected
                    ? 'Déconnecter'
                    : 'Sécuriser le tunnel'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Telemetry & Utility Strip */}
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">
              {isConnected
                ? `${currentIdentity.city}, ${currentIdentity.country}`
                : 'Tunnel hors ligne'}
            </span>
            <span>·</span>
            <span>{currentIdentity.ip}</span>
            {isConnected && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline text-cyan-600 dark:text-cyan-400">
                  ↓ {throughput.down} Mb/s
                </span>
                <span className="hidden sm:inline text-purple-600 dark:text-purple-400">
                  ↑ {throughput.up} Mb/s
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPricing(true)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span className="capitalize">{userPlan}</span>
            </button>
            <button
              onClick={() => setShowConnectionHistory(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Historique de connexion"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowLogs(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Journal système (Ctrl+L)"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Paramètres"
            >
              <SlidersVertical className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isDark ? 'Mode clair' : 'Mode sombre'}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Section Switcher */}
        <div className="flex md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-1.5 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSection('cockpit')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeSection === 'cockpit'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Cockpit VPN
          </button>
          <button
            onClick={() => setActiveSection('vault')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeSection === 'vault'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Coffre-fort local ({vaultCount})
          </button>
          <button
            onClick={() => setActiveSection('network')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeSection === 'network'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Topologie Réseau
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 relative z-10">
        {activeSection === 'cockpit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <Dashboard
                isDark={isDark}
                protocol={appSettings.protocol}
                isEmergency={false}
                securityReport={securityReport}
                isConnected={isConnected}
                userPlan={userPlan}
                mode={mode}
                onModeChange={(m) => setMode(m)}
                nodes={nodes}
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
                onFormatChange={(fmt) => updateAppSettings('macFormat', fmt)}
                ipv6LeakProtection={appSettings.ipv6LeakProtection}
                onIpv6Toggle={(enabled) =>
                  updateAppSettings('ipv6LeakProtection', enabled)
                }
                obfuscationLevel={appSettings.obfuscationLevel}
                onObfuscationLevelChange={(lvl) =>
                  updateAppSettings('obfuscationLevel', lvl)
                }
              />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <SecureFileTransfer
                userId={vaultOwnerKey}
                sessionPassword={sessionPassword}
                onUnlockPassword={setSessionPassword}
                isConnected={isConnected}
                currentNodeIp={currentIdentity.ip}
                onOpenFullVault={() => setActiveSection('vault')}
                onVaultMutated={() => setVaultRevision((r) => r + 1)}
                vaultCount={vaultCount}
                addLog={addLog}
              />
              <EarningsCard
                isConnected={isConnected}
                plan={userPlan}
                isVerified={isVerified}
                balance={balance}
                reputation={reputation}
                transactions={transactions}
                onUpgrade={() => setShowPricing(true)}
                onVerify={() => setShowVerification(true)}
                onWithdraw={() => setShowWithdrawal(true)}
                onShowTransactions={() => setShowTransactionHistory(true)}
                settings={appSettings}
              />
              <SecurityAudit
                currentIp={currentIdentity.ip}
                location={currentIdentity.country}
              />
              <SystemLogs
                logs={logs}
                onClear={() => setLogs([])}
                retentionHours={appSettings.logRetentionHours}
                onRetentionChange={(hours) =>
                  updateAppSettings('logRetentionHours', hours)
                }
              />
            </div>
          </div>
        )}

        {activeSection === 'vault' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Coffre-fort cryptographique local
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Chiffrez et déchiffrez vos fichiers localement via <span className="font-mono">window.crypto.subtle</span> (PBKDF2-SHA256 + AES-256-GCM) avec une clé dérivée de votre mot de passe utilisateur avant tout stockage ou transfert.
              </p>
            </div>
            <LocalVault
              userId={vaultOwnerKey}
              userEmail={user.email}
              sessionPassword={sessionPassword}
              onUnlockPassword={setSessionPassword}
              onLockVault={() => setSessionPassword(null)}
              isConnected={isConnected}
              currentNodeIp={currentIdentity.ip}
              currentNodeCountry={currentIdentity.country}
              addLog={addLog}
              vaultRevision={vaultRevision}
              onVaultMutated={() => setVaultRevision((r) => r + 1)}
            />
          </div>
        )}

        {activeSection === 'network' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Topologie du réseau & relais actifs
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Explorez les nœuds disponibles, ajustez leurs profils d'autonomie et simulez des transferts sécurisés.
              </p>
            </div>
            <NetworkView
              nodes={nodes}
              onConnectNode={handleConnectNode}
              onAutonomyUpdate={handleAutonomyUpdate}
            />
          </div>
        )}
      </main>

      <IdentityAssistant
        mode={mode}
        isConnected={isConnected}
        securityScore={securityReport?.score || 0}
      />

      {showPricing && (
        <PricingModal
          currentPlan={userPlan}
          onUpgrade={async (plan) => {
            const result = await handleProcessPayment(plan);
            return result.success && !result.redirect;
          }}
          onClose={() => setShowPricing(false)}
        />
      )}
      {showVerification && (
        <VerificationModal
          onClose={() => setShowVerification(false)}
          onSuccess={() => {
            setIsVerified(true);
            setShowVerification(false);
            if (user?.id && user?.email) {
              dbService
                .updateProfile(user.id, user.email, { is_verified: true })
                .catch(() => {});
            }
            addLog('Preuve d’identité KYC validée et enregistrée', 'success');
          }}
        />
      )}
      {showWithdrawal && (
        <WithdrawalModal
          balance={balance}
          onClose={() => setShowWithdrawal(false)}
          onConfirm={async (method, address) => {
            if (user?.id && user?.email) {
              const validMethod =
                method === 'paypal' || method === 'bank_transfer'
                  ? method
                  : 'crypto';
              const { transaction, newBalance } =
                await dbService.createWithdrawal(
                  user.id,
                  user.email,
                  balance,
                  validMethod,
                  address
                );
              setBalance(newBalance);
              setTransactions((prev) => [transaction, ...prev]);
              addLog(
                `Retrait de ${transaction.amount.toFixed(4)} RNC enregistré (${transaction.id})`,
                'success'
              );
            }
            setShowWithdrawal(false);
          }}
        />
      )}
      {showTransactionHistory && (
        <TransactionHistoryModal
          transactions={transactions}
          onClose={() => setShowTransactionHistory(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={appSettings}
          updateSettings={updateAppSettings}
          onClose={() => setShowSettings(false)}
          userPlan={userPlan}
          onShowPricing={() => {
            setShowSettings(false);
            setShowPricing(true);
          }}
        />
      )}
      {showConnectionHistory && (
        <ConnectionHistoryModal
          history={connectionHistory}
          onClose={() => setShowConnectionHistory(false)}
          onClear={() => {
            setConnectionHistory([]);
            if (user?.id) {
              dbService.clearSessions(user.id).catch(() => {});
            }
          }}
        />
      )}

      {showLogs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
            onClick={() => setShowLogs(false)}
          />
          <div className="relative w-full max-w-3xl bg-slate-950 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col h-[580px]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                  <Terminal className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Journal d'événements système
                  </h2>
                  <p className="text-xs text-slate-400">
                    Traçabilité locale du tunnel et des opérations WebCrypto
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogs(false)}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-5">
              <SystemLogs
                logs={logs}
                onClear={() => setLogs([])}
                retentionHours={appSettings.logRetentionHours}
                onRetentionChange={(hours) =>
                  updateAppSettings('logRetentionHours', hours)
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
