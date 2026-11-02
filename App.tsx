import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ShieldAlert,
  RefreshCw,
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
  generateRandomMac,
  MOCK_NODES,
  DEFAULT_APP_SETTINGS,
  sanitizeAppSettings,
  pickUserAgentByComplexity,
  isCountryExcludedByJurisdiction,
  computeRncEarningRate,
  computeWithdrawalQuote,
  validateWithdrawalDestination,
  WITHDRAWAL_RAIL_SPECS,
  generateSettlementReference,
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
import {
  CreateWithdrawalInput,
  dbService,
  ensureValidUserId,
} from './services/dbService';
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
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [isMasking, setIsMasking] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [rotationSecondsLeft, setRotationSecondsLeft] = useState<number | null>(
    null
  );
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

  const [appSettings, setAppSettings] = useState<AppSettings>(
    DEFAULT_APP_SETTINGS
  );
  const [settingsLoadedForUser, setSettingsLoadedForUser] = useState<
    string | null
  >(null);
  const hasAutoConnectedRef = useRef<string | null>(null);
  const autoWithdrawInFlightRef = useRef(false);
  const lastAutoWithdrawAtRef = useRef(0);

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

  const connectVPN = useCallback(
    async (overrideIdentity?: VirtualIdentity) => {
      if (isDisconnecting) return;
      if (isEmergency) {
        setIsEmergency(false);
        addLog(
          'Coupe-circuit désamorcé pour autoriser l’établissement du tunnel sécurisé',
          'info'
        );
      }
      const targetIdentity = overrideIdentity ?? currentIdentity;
      setIsDisconnecting(false);
      addLog(
        `Démarrage du tunnel Renumerate (${appSettings.protocol.toUpperCase()}) vers ${targetIdentity.city}, ${targetIdentity.country}...`,
        'info',
        targetIdentity.ip
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
          `Réseau VPN rejoint via ${appSettings.protocol.toUpperCase()} (${targetIdentity.city})`,
          'success',
          targetIdentity.ip
        );

        const newSession: ConnectionSession = {
          id: Math.random().toString(36).slice(2, 11),
          serverCountry: targetIdentity.country,
          serverIp: targetIdentity.ip,
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
          targetIdentity.country,
          targetIdentity.ip,
          {
            protocol: appSettings.protocol,
            killSwitch: appSettings.killSwitch,
            ipv6LeakProtection: appSettings.ipv6LeakProtection,
          }
        );
        setSecurityReport(report);
      }, 950);
    },
    [
      appSettings.protocol,
      appSettings.killSwitch,
      appSettings.ipv6LeakProtection,
      appSettings.vortexCircuitLength,
      mode,
      currentIdentity,
      addLog,
      isDisconnecting,
      isEmergency,
      user?.id,
    ]
  );

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
      if (appSettings.logRetentionHours === 0) {
        setLogs([]);
      } else {
        addLog('Session déconnectée', 'info', currentIdentity.ip);
      }
    }, 800);
  }, [
    currentIdentity.ip,
    addLog,
    isDisconnecting,
    user?.id,
    appSettings.logRetentionHours,
  ]);

  const handleGlobalScramble = useCallback(() => {
    setIsMasking(true);
    addLog(
      `Morphing neuronal (Niveau: ${appSettings.obfuscationLevel.toUpperCase()})...`,
      'info'
    );
    setTimeout(() => {
      setCurrentIdentity((prev) => {
        const newUA = pickUserAgentByComplexity(
          appSettings.uaComplexity,
          prev.userAgentShort
        );
        const newMac = generateRandomMac(
          appSettings.macScramblingMode,
          appSettings.macFormat
        );
        addLog(`Identité matérielle re-numérotée : ${newMac}`, 'success');
        return {
          ...prev,
          mac: newMac,
          userAgentShort: newUA.short,
        };
      });
      setIsMasking(false);
    }, 1500);
  }, [
    appSettings.macScramblingMode,
    appSettings.macFormat,
    appSettings.obfuscationLevel,
    appSettings.uaComplexity,
    addLog,
  ]);

  const handleScrambleUA = useCallback(() => {
    setCurrentIdentity((prev) => {
      const newUA = pickUserAgentByComplexity(
        appSettings.uaComplexity,
        prev.userAgentShort
      );
      return { ...prev, userAgentShort: newUA.short };
    });
    addLog('Spoofing UA réussi', 'success');
  }, [addLog, appSettings.uaComplexity]);

  const handleSelectUA = useCallback(
    (uaShort: string) => {
      setIsMasking(true);
      addLog(`Injection de la signature logicielle : ${uaShort}...`, 'info');
      setTimeout(() => {
        setCurrentIdentity((prev) => ({ ...prev, userAgentShort: uaShort }));
        setIsMasking(false);
        addLog(`Empreinte synchronisée : ${uaShort}`, 'success');
      }, 650);
    },
    [addLog]
  );

  const handleSelectIdentity = useCallback(
    (selected: VirtualIdentity) => {
      setIsRenumbering(true);
      const nextIdentity: VirtualIdentity = {
        ...selected,
        mac: currentIdentity.mac,
        userAgentShort: currentIdentity.userAgentShort,
      };
      setCurrentIdentity(nextIdentity);
      addLog(
        `Passerelle virtuelle basculée vers ${selected.city}, ${selected.country}`,
        'success',
        selected.ip
      );
      if (isConnected) {
        analyzeSecurity(mode, selected.country, selected.ip, {
          protocol: appSettings.protocol,
          killSwitch: appSettings.killSwitch,
          ipv6LeakProtection: appSettings.ipv6LeakProtection,
        })
          .then((report) => setSecurityReport(report))
          .catch(() => {});
      }
      setTimeout(() => setIsRenumbering(false), 600);
    },
    [
      currentIdentity.mac,
      currentIdentity.userAgentShort,
      addLog,
      isConnected,
      mode,
      appSettings.protocol,
      appSettings.killSwitch,
      appSettings.ipv6LeakProtection,
    ]
  );

  const toggleEmergencyLockdown = useCallback(() => {
    setIsEmergency((prev) => {
      const next = !prev;
      if (next) {
        setIsConnected(false);
        setThroughput({ up: 0, down: 0 });
        addLog(
          'COUPE-CIRCUIT D’URGENCE ACTIVÉ : interfaces externes verrouillées',
          'error',
          currentIdentity.ip
        );
      } else {
        addLog(
          'Coupe-circuit d’urgence désamorcé : reprise nominale autorisée',
          'success'
        );
      }
      return next;
    });
  }, [addLog, currentIdentity.ip]);

  useEffect(() => {
    if (!appSettings.keyboardShortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;
      const key = e.key.toLowerCase();

      if (key === 's') {
        e.preventDefault();
        addLog('Raccourci détecté : Basculer connexion [Ctrl+S]', 'info');
        if (isConnected) disconnectVPN();
        else connectVPN();
      } else if (key === 'k') {
        e.preventDefault();
        toggleEmergencyLockdown();
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
      } else if (key === ',') {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    appSettings.keyboardShortcutsEnabled,
    isConnected,
    connectVPN,
    disconnectVPN,
    toggleEmergencyLockdown,
    handleGlobalScramble,
    handleScrambleUA,
    addLog,
  ]);

  useEffect(() => {
    if (isConnected && !isEmergency) {
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
  }, [isConnected, isEmergency]);

  // Rotation dynamique automatique d'identité (IP + MAC + UA)
  useEffect(() => {
    if (!isConnected || !appSettings.autoRotation || isEmergency) {
      setRotationSecondsLeft(null);
      return;
    }

    const periodSeconds = Math.max(1, appSettings.rotationInterval) * 60;
    setRotationSecondsLeft(periodSeconds);

    const ticker = setInterval(() => {
      setRotationSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          setIsRenumbering(true);
          setCurrentIdentity((curr) => {
            const compliantPool = MOCK_IDENTITIES.filter(
              (i) =>
                i.ip !== curr.ip &&
                !isCountryExcludedByJurisdiction(
                  i.country,
                  appSettings.excludeEyesJurisdictions
                )
            );
            const fallbackPool = MOCK_IDENTITIES.filter(
              (i) => i.ip !== curr.ip
            );
            const pool =
              compliantPool.length > 0 ? compliantPool : fallbackPool;
            const picked =
              pool[Math.floor(Math.random() * pool.length)] ||
              MOCK_IDENTITIES[0];
            const nextUa = pickUserAgentByComplexity(
              appSettings.uaComplexity,
              curr.userAgentShort
            );
            const nextMac = generateRandomMac(
              appSettings.macScramblingMode,
              appSettings.macFormat
            );
            const rotated: VirtualIdentity = {
              ...picked,
              mac: nextMac,
              userAgentShort: nextUa.short,
            };
            addLog(
              `Rotation auto exécutée : ${rotated.city} (${rotated.ip}) · MAC ${nextMac}`,
              'success',
              rotated.ip
            );
            analyzeSecurity(mode, rotated.country, rotated.ip, {
              protocol: appSettings.protocol,
              killSwitch: appSettings.killSwitch,
              ipv6LeakProtection: appSettings.ipv6LeakProtection,
            })
              .then((rep) => setSecurityReport(rep))
              .catch(() => {});
            return rotated;
          });
          setTimeout(() => setIsRenumbering(false), 700);
          return periodSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [
    isConnected,
    isEmergency,
    appSettings.autoRotation,
    appSettings.rotationInterval,
    appSettings.macScramblingMode,
    appSettings.macFormat,
    appSettings.uaComplexity,
    appSettings.excludeEyesJurisdictions,
    appSettings.protocol,
    appSettings.killSwitch,
    appSettings.ipv6LeakProtection,
    mode,
    addLog,
  ]);

  // Purge périodique des journaux selon logRetentionHours
  useEffect(() => {
    if (appSettings.logRetentionHours <= 0) return;
    const maxAgeMs = appSettings.logRetentionHours * 3600 * 1000;
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - maxAgeMs;
      setLogs((prev) => prev.filter((entry) => entry.timestampRaw >= cutoff));
    }, 30000);
    return () => clearInterval(cleanup);
  }, [appSettings.logRetentionHours]);

  // Bascule automatique hors 5/14-Eyes si la passerelle active devient exclue
  useEffect(() => {
    if (
      appSettings.excludeEyesJurisdictions !== 'none' &&
      isCountryExcludedByJurisdiction(
        currentIdentity.country,
        appSettings.excludeEyesJurisdictions
      )
    ) {
      const safeCandidate = MOCK_IDENTITIES.find(
        (i) =>
          !isCountryExcludedByJurisdiction(
            i.country,
            appSettings.excludeEyesJurisdictions
          )
      );
      if (safeCandidate) {
        setCurrentIdentity((prev) => ({
          ...safeCandidate,
          mac: prev.mac,
          userAgentShort: prev.userAgentShort,
        }));
        addLog(
          `Passerelle migrée vers ${safeCandidate.city} (${safeCandidate.country}) conformément au filtre ${appSettings.excludeEyesJurisdictions.toUpperCase()}`,
          'info',
          safeCandidate.ip
        );
      }
    }
  }, [
    appSettings.excludeEyesJurisdictions,
    currentIdentity.country,
    addLog,
  ]);

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
            setAppSettings((prev) =>
              sanitizeAppSettings({ ...prev, ...savedSettings })
            );
          }
          setSettingsLoadedForUser(user.id);
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
    } else {
      setSettingsLoadedForUser(null);
      hasAutoConnectedRef.current = null;
    }
  }, [user?.id, user?.email]);

  // Connexion automatique au démarrage si autoConnect est activé
  useEffect(() => {
    if (
      user?.id &&
      settingsLoadedForUser === user.id &&
      appSettings.autoConnect &&
      !isConnected &&
      !isEmergency &&
      hasAutoConnectedRef.current !== user.id
    ) {
      hasAutoConnectedRef.current = user.id;
      addLog(
        'Connexion automatique au démarrage activée : ouverture du tunnel...',
        'info'
      );
      connectVPN();
    }
  }, [
    user?.id,
    settingsLoadedForUser,
    appSettings.autoConnect,
    isConnected,
    isEmergency,
    connectVPN,
    addLog,
  ]);

  // Contribution RNC en temps réel lorsque le tunnel est connecté et le profil vérifié
  useEffect(() => {
    if (
      !isConnected ||
      userPlan === 'free' ||
      !isVerified ||
      !user?.id ||
      !user?.email ||
      appSettings.miningIntensity <= 0
    ) {
      return;
    }

    const ratePerSec = computeRncEarningRate({
      plan: userPlan,
      isVerified,
      isConnected,
      settings: appSettings,
      reputation,
    });
    if (ratePerSec <= 0) return;

    const deltaPerTick = ratePerSec * 3;

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
    reputation,
    user?.id,
    user?.email,
    appSettings.miningIntensity,
    appSettings.yieldOptimizationIA,
    appSettings.contributionType,
  ]);

  // Exécution sécurisée et validée du retrait automatique RNC lorsque le seuil configuré est atteint
  useEffect(() => {
    if (
      !appSettings.autoWithdraw ||
      !isVerified ||
      !user?.id ||
      !user?.email ||
      balance < appSettings.autoWithdrawThreshold ||
      autoWithdrawInFlightRef.current
    ) {
      return;
    }

    const validation = validateWithdrawalDestination(
      appSettings.autoWithdrawMethod,
      appSettings.autoWithdrawSubNetwork,
      appSettings.autoWithdrawAddress
    );
    if (!validation.valid) {
      return;
    }

    const rail =
      WITHDRAWAL_RAIL_SPECS[appSettings.autoWithdrawSubNetwork] ||
      WITHDRAWAL_RAIL_SPECS.polygon;
    const withdrawable = parseFloat(
      Math.max(0, balance - (appSettings.autoWithdrawReserve || 0)).toFixed(4)
    );
    if (withdrawable < rail.minRnc) {
      return;
    }

    // Debounce pour éviter tout déclenchement pendant la saisie d'adresse ou rafale
    const debounceTimer = setTimeout(() => {
      if (
        autoWithdrawInFlightRef.current ||
        Date.now() - lastAutoWithdrawAtRef.current < 12000
      ) {
        return;
      }

      const quote = computeWithdrawalQuote({
        amountRnc: withdrawable,
        method: appSettings.autoWithdrawMethod,
        subNetwork: appSettings.autoWithdrawSubNetwork,
        executionMode: 'auto',
        plan: userPlan,
        fiatCurrency: appSettings.preferredFiat || 'EUR',
      });
      if (quote.netRnc <= 0) return;

      autoWithdrawInFlightRef.current = true;
      lastAutoWithdrawAtRef.current = Date.now();

      dbService
        .createWithdrawal(user.id, user.email, {
          amount: quote.grossRnc,
          method: appSettings.autoWithdrawMethod,
          subNetwork: appSettings.autoWithdrawSubNetwork,
          networkLabel: rail.shortLabel,
          executionMode: 'auto',
          feeRnc: quote.feeRnc,
          netAmountRnc: quote.netRnc,
          fiatCurrency: quote.fiatCurrency,
          fiatAmount: quote.netFiat,
          exchangeRate: quote.exchangeRate,
          address: validation.normalized,
          status: 'completed',
          txHash: generateSettlementReference(
            appSettings.autoWithdrawMethod,
            appSettings.autoWithdrawSubNetwork
          ),
          etaSeconds: 0,
        })
        .then(({ transaction, newBalance }) => {
          setBalance(newBalance);
          setTransactions((prev) => [transaction, ...prev]);
          addLog(
            `Auto-Retrait exécuté : ${transaction.netAmountRnc?.toFixed(4)} RNC nets vers ${rail.shortLabel} (${validation.normalized})`,
            'success'
          );
        })
        .catch(() => {})
        .finally(() => {
          autoWithdrawInFlightRef.current = false;
        });
    }, 1200);

    return () => clearTimeout(debounceTimer);
  }, [
    balance,
    appSettings.autoWithdraw,
    appSettings.autoWithdrawThreshold,
    appSettings.autoWithdrawReserve,
    appSettings.autoWithdrawMethod,
    appSettings.autoWithdrawSubNetwork,
    appSettings.autoWithdrawAddress,
    appSettings.preferredFiat,
    userPlan,
    isVerified,
    user?.id,
    user?.email,
    addLog,
  ]);

  // Règlement automatique en arrière-plan des retraits en file d'attente (Mode Standard)
  useEffect(() => {
    if (!user?.id) return;
    const pendingList = transactions.filter((t) => t.status === 'processing');
    if (pendingList.length === 0) return;

    const now = Date.now();
    let earliestTx = pendingList[0];
    let minDelayMs = Infinity;

    for (const tx of pendingList) {
      const targetAt =
        (tx.createdAt || now) + (tx.etaSeconds || 45) * 1000;
      const waitMs = Math.max(250, targetAt - now);
      if (waitMs < minDelayMs) {
        minDelayMs = waitMs;
        earliestTx = tx;
      }
    }

    const timer = setTimeout(() => {
      dbService
        .completeWithdrawal(user.id, earliestTx.id)
        .then((settled) => {
          if (!settled) return;
          setTransactions((prev) =>
            prev.map((item) => (item.id === settled.id ? settled : item))
          );
          addLog(
            `Compensation finalisée (${settled.id}) : ${(settled.netAmountRnc ?? settled.amount).toFixed(4)} RNC réglés sur ${settled.networkLabel || settled.method}`,
            'success'
          );
        })
        .catch(() => {});
    }, minDelayMs);

    return () => clearTimeout(timer);
  }, [transactions, user?.id, addLog]);

  const handleExecuteWithdrawal = useCallback(
    async (input: CreateWithdrawalInput): Promise<Transaction> => {
      if (!user?.id || !user?.email) {
        throw new Error('Session utilisateur introuvable.');
      }
      const { transaction, newBalance } = await dbService.createWithdrawal(
        user.id,
        user.email,
        input
      );
      setBalance(newBalance);
      setTransactions((prev) => [transaction, ...prev]);
      addLog(
        transaction.status === 'completed'
          ? `Retrait instantané réglé (${transaction.id}) : ${(transaction.netAmountRnc ?? transaction.amount).toFixed(4)} RNC → ${transaction.networkLabel || transaction.method}`
          : `Retrait standard en file de compensation (${transaction.id}) : ${transaction.amount.toFixed(4)} RNC (annulable 45s)`,
        'success'
      );
      return transaction;
    },
    [user?.id, user?.email, addLog]
  );

  const handleCancelWithdrawal = useCallback(
    async (txId: string) => {
      if (!user?.id || !user?.email) return;
      const res = await dbService.cancelWithdrawal(user.id, user.email, txId);
      if (!res) return;
      setBalance(res.newBalance);
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === txId ? res.transaction : tx))
      );
      addLog(
        `Retrait ${txId} annulé : +${res.transaction.amount.toFixed(4)} RNC intégralement recrédités`,
        'warning'
      );
    },
    [user?.id, user?.email, addLog]
  );

  const handleAccelerateWithdrawal = useCallback(
    async (txId: string) => {
      if (!user?.id) return;
      const settled = await dbService.completeWithdrawal(user.id, txId);
      if (!settled) return;
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === txId ? settled : tx))
      );
      addLog(
        `Règlement accéléré et confirmé pour l'opération ${txId}`,
        'success'
      );
    },
    [user?.id, addLog]
  );

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const handleConnectNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const nextCity =
      node.city ||
      (node.country === 'France'
        ? 'Paris'
        : node.country === 'Suisse'
          ? 'Genève'
          : 'Central');

    const targetIdentity: VirtualIdentity = {
      ...currentIdentity,
      ip: node.ip,
      country: node.country,
      city: nextCity,
      latency: node.latency,
      timezone: node.timezone || currentIdentity.timezone,
    };

    if (isConnected) {
      addLog(
        `Bascule du relais vers ${node.name} (${nextCity}, ${node.country})...`,
        'info',
        node.ip
      );
      disconnectVPN();
      setTimeout(() => {
        setCurrentIdentity(targetIdentity);
        connectVPN(targetIdentity);
      }, 850);
    } else {
      setCurrentIdentity(targetIdentity);
      connectVPN(targetIdentity);
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

  const updateAppSettings = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setAppSettings((prev) => {
        const next = sanitizeAppSettings({ ...prev, [key]: value });
        if (user?.id) {
          dbService.saveSettings(user.id, next).catch(console.error);
        }
        return next;
      });

      if (key === 'ipv6LeakProtection') {
        addLog(
          `Protection IPv6 ${value ? 'activée' : 'désactivée'}`,
          value ? 'success' : 'warning'
        );
      } else if (key === 'webrtcLeakShield') {
        addLog(
          `Bouclier WebRTC STUN ${value ? 'activé' : 'désactivé'}`,
          value ? 'success' : 'warning'
        );
      } else if (key === 'protocol') {
        addLog(`Protocole changé pour ${String(value).toUpperCase()}`, 'info');
      } else if (key === 'tunnelPort') {
        addLog(`Port de transport défini sur :${String(value)}`, 'info');
      } else if (key === 'socks5Enabled') {
        addLog(
          `Proxy SOCKS5 ${value ? 'activé' : 'désactivé'}`,
          value ? 'success' : 'warning'
        );
      } else if (key === 'vortexBridge') {
        addLog(
          `Pont Vortex reconfiguré : ${String(value).toUpperCase()}`,
          'info'
        );
      } else if (key === 'vortexCircuitLength') {
        addLog(`Longueur du circuit Vortex : ${String(value)} sauts`, 'info');
      } else if (key === 'obfuscationLevel') {
        addLog(
          `Niveau d'obfuscation : ${String(value).toUpperCase()}`,
          'info'
        );
      } else if (key === 'excludeEyesJurisdictions') {
        addLog(
          value === 'none'
            ? 'Filtre juridictionnel désactivé (tous les relais visibles)'
            : `Politique d'exclusion ${String(value).toUpperCase()} activée`,
          'info'
        );
      }
    },
    [user?.id, addLog]
  );

  const patchAppSettings = useCallback(
    (patch: Partial<AppSettings>, reason?: string) => {
      setAppSettings((prev) => {
        const next = sanitizeAppSettings({ ...prev, ...patch });
        if (user?.id) {
          dbService.saveSettings(user.id, next).catch(console.error);
        }
        return next;
      });
      if (reason) {
        addLog(reason, 'success');
      }
    },
    [user?.id, addLog]
  );

  const resetAppSettings = useCallback(() => {
    const cleanDefaults = sanitizeAppSettings(DEFAULT_APP_SETTINGS);
    setAppSettings(cleanDefaults);
    if (user?.id) {
      dbService.saveSettings(user.id, cleanDefaults).catch(console.error);
    }
    addLog('Paramètres réinitialisés aux valeurs d’usine', 'warning');
  }, [user?.id, addLog]);

  const handleForceRotateIdentity = useCallback(() => {
    setIsRenumbering(true);
    setCurrentIdentity((curr) => {
      const compliantPool = MOCK_IDENTITIES.filter(
        (i) =>
          i.ip !== curr.ip &&
          !isCountryExcludedByJurisdiction(
            i.country,
            appSettings.excludeEyesJurisdictions
          )
      );
      const fallbackPool = MOCK_IDENTITIES.filter((i) => i.ip !== curr.ip);
      const pool = compliantPool.length > 0 ? compliantPool : fallbackPool;
      const picked =
        pool[Math.floor(Math.random() * pool.length)] || MOCK_IDENTITIES[0];
      const nextUa = pickUserAgentByComplexity(
        appSettings.uaComplexity,
        curr.userAgentShort
      );
      const nextMac = generateRandomMac(
        appSettings.macScramblingMode,
        appSettings.macFormat
      );
      const rotated: VirtualIdentity = {
        ...picked,
        mac: nextMac,
        userAgentShort: nextUa.short,
      };
      addLog(
        `Rotation forcée : ${rotated.city} (${rotated.ip}) · MAC ${nextMac}`,
        'success',
        rotated.ip
      );
      if (isConnected) {
        analyzeSecurity(mode, rotated.country, rotated.ip, {
          protocol: appSettings.protocol,
          killSwitch: appSettings.killSwitch,
          ipv6LeakProtection: appSettings.ipv6LeakProtection,
        })
          .then((rep) => setSecurityReport(rep))
          .catch(() => {});
      }
      return rotated;
    });
    if (appSettings.autoRotation) {
      setRotationSecondsLeft(Math.max(1, appSettings.rotationInterval) * 60);
    }
    setTimeout(() => setIsRenumbering(false), 650);
  }, [
    appSettings.excludeEyesJurisdictions,
    appSettings.uaComplexity,
    appSettings.macScramblingMode,
    appSettings.macFormat,
    appSettings.protocol,
    appSettings.killSwitch,
    appSettings.ipv6LeakProtection,
    appSettings.autoRotation,
    appSettings.rotationInterval,
    isConnected,
    mode,
    addLog,
  ]);

  const handleFlushDnsCache = useCallback((): number => {
    const cleared = Math.floor(Math.random() * 48) + 16;
    addLog(
      `Cache DNS local purgé (${cleared} enregistrements résolus effacés)`,
      'success'
    );
    return cleared;
  }, [addLog]);

  const handleSimulateReconnect = useCallback(() => {
    if (!isConnected) return;
    const delaySec = Math.max(1, Math.min(10, appSettings.reconnectDelay));
    addLog(
      `Micro-coupure simulée : attente de reconnexion auto (${delaySec}s)...`,
      'warning',
      currentIdentity.ip
    );
    setIsConnected(false);
    setTimeout(() => {
      connectVPN(currentIdentity);
    }, delaySec * 1000);
  }, [isConnected, appSettings.reconnectDelay, currentIdentity, addLog, connectVPN]);

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
              onClick={() => (isConnected ? disconnectVPN() : connectVPN())}
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
            {rotationSecondsLeft !== null && (
              <>
                <span className="hidden md:inline">·</span>
                <span className="hidden md:inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Rotation {Math.floor(rotationSecondsLeft / 60)}:
                  {String(rotationSecondsLeft % 60).padStart(2, '0')}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleEmergencyLockdown}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isEmergency
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-500/60 hover:text-red-500'
              }`}
              title="Coupe-circuit réseau d'urgence (Kill Switch)"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isEmergency ? 'Verrouillé' : 'Kill Switch'}
              </span>
            </button>
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
        {isEmergency && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/90 border border-red-500/50 text-red-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Coupe-circuit d’urgence actif :</span>{' '}
                toutes les connexions sortantes non chiffrées sont bloquées pour prévenir toute fuite d’identité.
              </div>
            </div>
            <button
              onClick={toggleEmergencyLockdown}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Désamorcer le coupe-circuit
            </button>
          </div>
        )}

        {activeSection === 'cockpit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <Dashboard
                isDark={isDark}
                protocol={appSettings.protocol}
                isEmergency={isEmergency}
                securityReport={securityReport}
                isConnected={isConnected}
                userPlan={userPlan}
                mode={mode}
                onModeChange={(m) => {
                  setMode(m);
                  if (isConnected) {
                    analyzeSecurity(m, currentIdentity.country, currentIdentity.ip, {
                      protocol: appSettings.protocol,
                      killSwitch: appSettings.killSwitch,
                      ipv6LeakProtection: appSettings.ipv6LeakProtection,
                    })
                      .then((rep) => setSecurityReport(rep))
                      .catch(() => {});
                  }
                }}
                nodes={nodes}
                onConnectNode={handleConnectNode}
                onDisconnect={disconnectVPN}
                currentIp={currentIdentity.ip}
                throughput={throughput}
                baseLatency={currentIdentity.latency}
                settings={appSettings}
                addLog={addLog}
                updateSettings={updateAppSettings}
                history={connectionHistory}
              />
              <IdentityMatrix
                identity={currentIdentity}
                availableIdentities={MOCK_IDENTITIES}
                isRotating={isRenumbering}
                isMasking={isMasking}
                mode={mode}
                securityReport={securityReport}
                onMask={handleGlobalScramble}
                onScrambleMac={handleScrambleMac}
                onScrambleUA={handleScrambleUA}
                onSelectUA={handleSelectUA}
                onSelectIdentity={handleSelectIdentity}
                onOpenHistory={() => setShowConnectionHistory(true)}
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
                fingerprintProtection={appSettings.fingerprintProtection}
                onToggleFingerprint={(fpKey) =>
                  updateAppSettings('fingerprintProtection', {
                    ...appSettings.fingerprintProtection,
                    [fpKey]: !appSettings.fingerprintProtection[fpKey],
                  })
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
              currentIp={currentIdentity.ip}
              isConnected={isConnected}
              mode={mode}
              isDark={isDark}
              onConnectNode={handleConnectNode}
              onAutonomyUpdate={handleAutonomyUpdate}
            />
          </div>
        )}
      </main>

      <IdentityAssistant
        mode={mode}
        protocol={appSettings.protocol}
        isConnected={isConnected}
        country={currentIdentity.country}
        ip={currentIdentity.ip}
        securityScore={securityReport?.score || 0}
        killSwitch={appSettings.killSwitch}
        ipv6LeakProtection={appSettings.ipv6LeakProtection}
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
                .claimKycVerificationBonus(user.id, user.email)
                .then(({ newBalance, bonusAwarded }) => {
                  setBalance(newBalance);
                  addLog(
                    bonusAwarded > 0
                      ? `Preuve d’identité KYC validée : prime d’opérateur +${bonusAwarded.toFixed(4)} RNC créditée`
                      : 'Preuve d’identité KYC validée et enregistrée',
                    'success'
                  );
                })
                .catch(() => {
                  addLog(
                    'Preuve d’identité KYC validée et enregistrée',
                    'success'
                  );
                });
            }
          }}
        />
      )}
      {showWithdrawal && (
        <WithdrawalModal
          balance={balance}
          userId={vaultOwnerKey}
          userPlan={userPlan}
          isConnected={isConnected}
          currentNodeLabel={`${currentIdentity.city}, ${currentIdentity.country}`}
          settings={appSettings}
          onPatchSettings={patchAppSettings}
          onExecuteWithdrawal={handleExecuteWithdrawal}
          onOpenHistory={() => setShowTransactionHistory(true)}
          onClose={() => setShowWithdrawal(false)}
        />
      )}
      {showTransactionHistory && (
        <TransactionHistoryModal
          transactions={transactions}
          preferredFiat={appSettings.preferredFiat}
          onCancelTransaction={handleCancelWithdrawal}
          onAccelerateTransaction={handleAccelerateWithdrawal}
          onOpenWithdraw={() => setShowWithdrawal(true)}
          onClose={() => setShowTransactionHistory(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={appSettings}
          updateSettings={updateAppSettings}
          patchSettings={patchAppSettings}
          onResetSettings={resetAppSettings}
          onClose={() => setShowSettings(false)}
          userPlan={userPlan}
          onShowPricing={() => {
            setShowSettings(false);
            setShowPricing(true);
          }}
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          isConnected={isConnected}
          isEmergency={isEmergency}
          onToggleEmergency={toggleEmergencyLockdown}
          currentIdentity={currentIdentity}
          onForceRotateIdentity={handleForceRotateIdentity}
          onScrambleMac={handleScrambleMac}
          onFlushDnsCache={handleFlushDnsCache}
          onSimulateReconnect={handleSimulateReconnect}
          onClearLogs={() => setLogs([])}
          onClearHistory={() => {
            setConnectionHistory([]);
            if (user?.id) {
              dbService.clearSessions(user.id).catch(() => {});
            }
            addLog('Historique des sessions effacé', 'info');
          }}
          balance={balance}
          reputation={reputation}
          isVerified={isVerified}
          userId={vaultOwnerKey}
          onOpenWithdrawalModal={() => setShowWithdrawal(true)}
          addLog={addLog}
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
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => setShowLogs(false)}
          />
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[580px]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                  <Terminal className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Journal d&apos;événements système
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Traçabilité locale du tunnel et des opérations WebCrypto
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogs(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-5 bg-slate-50/50 dark:bg-slate-950">
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
