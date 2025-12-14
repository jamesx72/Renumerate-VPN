import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Power, RefreshCw, Moon, Sun, Lock, Globe, Terminal, Activity, Share2, Wifi, Zap, Settings, Crown, Wallet, Ghost, Layers, AlertTriangle, WifiOff, Siren, Route, Loader2, ToggleLeft, ToggleRight, Fingerprint, LogOut, CheckCircle, ArrowRight, ArrowUpRight, History, Info, Network } from 'lucide-react';
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

  // Verification & Payment State
  const [isVerified, setIsVerified] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

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

  const [entryIdentity, setEntryIdentity] = useState<VirtualIdentity | null>(null);
  const [isRenumbering, setIsRenumbering] = useState(false);
  const [isMasking, setIsMasking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Network Nodes State
  const [deviceNodes, setDeviceNodes] = useState<DeviceNode[]>([]);

  // Connection History Logic
  const connectionStartRef = useRef<number | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionSession[]>(() => {
    const saved = localStorage.getItem('connectionHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [showConnectionHistory, setShowConnectionHistory] = useState(false);

  // New State for Monetization, Settings, and Earnings
  const [userPlan, setUserPlan] = useState<PlanTier>('free');
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [initialSettingsTab, setInitialSettingsTab] = useState<'general' | 'connection' | 'privacy' | 'advanced' | 'billing'>('general');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [balance, setBalance] = useState(0.0000);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Persistent State: App Settings
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : {
      protocol: 'wireguard',
      dns: 'cloudflare',
      killSwitch: true,
      autoReconnect: true,
      reconnectDelay: 3,
      splitTunneling: false,
      adBlocker: false, 
      autoConnect: false,
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
      const mockNodes: DeviceNode[] = Array.from({ length: 12 }, (_, i) => ({
          id: `node-${i}`,
          name: `Renumerate Node ${i+1}`,
          type: i % 4 === 0 ? 'server' : i % 3 === 0 ? 'iot' : 'mobile',
          status: Math.random() > 0.3 ? 'active' : 'idle',
          signalStrength: Math.floor(Math.random() * 60) + 40,
          transferRate: Math.floor(Math.random() * 100),
          latency: Math.floor(Math.random() * 120) + 10,
          autonomyProfile: i % 3 === 0 ? 'provider' : i % 2 === 0 ? 'balanced' : 'consumer',
          tags: ['Secure'],
          ip: `10.8.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
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
    localStorage.setItem('vpnMode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('currentIdentity', JSON.stringify(currentIdentity));
  }, [currentIdentity]);

  useEffect(() => {
    localStorage.setItem('connectionHistory', JSON.stringify(connectionHistory));
  }, [connectionHistory]);

  useEffect(() => {
    const cleanupLogs = () => {
        if (appSettings.logRetentionHours <= 0) return;
        const cutoffTime = Date.now() - (appSettings.logRetentionHours * 60 * 60 * 1000);
        setLogs(prevLogs => {
            const newLogs = prevLogs.filter(log => log.timestampRaw > cutoffTime);
            return newLogs.length !== prevLogs.length ? newLogs : prevLogs;
        });
    };
    cleanupLogs();
    const interval = setInterval(cleanupLogs, 3600000);
    return () => clearInterval(interval);
  }, [appSettings.logRetentionHours]);

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

  const clearLogs = useCallback(() => {
    setLogs([]);
    setTimeout(() => {
        addLog('Journaux système effacés', 'info');
    }, 100);
  }, [addLog]);

  useEffect(() => {
    const fetchTransactions = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_email', user.email)
                .order('created_at', { ascending: false });

            if (error) {
                const errorMsg = typeof error === 'object' && error !== null && 'message' in error 
                    ? (error as any).message 
                    : JSON.stringify(error);
                console.warn(`Supabase fetch warning: ${errorMsg}`);
                addLog('Synchro cloud impossible : Mode hors ligne', 'warning');
                const saved = localStorage.getItem(`transactions_${user.email}`);
                if (saved) {
                    setTransactions(JSON.parse(saved));
                }
            } else if (data) {
                const mappedTransactions: Transaction[] = data.map((t: any) => ({
                    id: t.id,
                    date: t.date || new Date(t.created_at).toLocaleDateString('fr-FR'),
                    amount: t.amount,
                    method: t.method,
                    status: t.status,
                    address: t.address
                }));
                setTransactions(mappedTransactions);
                localStorage.setItem(`transactions_${user.email}`, JSON.stringify(mappedTransactions));
            }
        } catch (e: any) {
            console.error('Fetch transactions network error:', e);
            addLog('Erreur réseau : Chargement historique local', 'error');
            const saved = localStorage.getItem(`transactions_${user.email}`);
            if (saved) {
                setTransactions(JSON.parse(saved));
            }
        }
    };
    fetchTransactions();
  }, [user, addLog]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isConnected && userPlan !== 'free' && !isEmergency) {
      const rate = userPlan === 'elite' ? 0.012 : 0.004;
      interval = setInterval(() => {
        setBalance(prev => prev + rate);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, userPlan, isEmergency]);

  const connectVPN = useCallback(() => {
    setIsDisconnecting(false);
    connectionStartRef.current = Date.now();
    addLog(`Initialisation protocole ${appSettings.protocol}...`, 'info');
    let connectionDelay = 1500;
    const obsLevel = appSettings.obfuscationLevel;

    if (obsLevel === 'high') {
        connectionDelay = 3000;
        setTimeout(() => addLog('Obfuscation (Élevé) : Injection de paquets leurres...', 'info'), 800);
        setTimeout(() => addLog('Chiffrement des en-têtes de paquets...', 'info'), 1800);
    } else if (obsLevel === 'ultra') {
        connectionDelay = 5000;
        setTimeout(() => addLog('Obfuscation (Ultra) : Encapsulation SSL/TLS (Stealth)...', 'info'), 1000);
        setTimeout(() => addLog('Contournement DPI : Fragmentation aléatoire des paquets...', 'warning'), 2500);
        setTimeout(() => addLog('Génération de trafic de couverture...', 'info'), 3800);
    }

    if (mode === ConnectionMode.STEALTH) {
        connectionDelay = 3500;
        setTimeout(() => addLog('Mode Furtif : Initialisation du moteur d\'obfuscation...', 'info'), 600);
        setTimeout(() => addLog('Analyse des signatures DPI (Deep Packet Inspection)...', 'info'), 1500);
        setTimeout(() => addLog('Suppression des métadonnées du protocole VPN...', 'info'), 2200);
        setTimeout(() => addLog('Encapsulation SSL/TLS sur le port 443 (HTTPS)...', 'warning'), 3000);
    }

    if (mode === ConnectionMode.DOUBLE_HOP) {
       const potentialEntryNodes = MOCK_IDENTITIES.filter(id => id.ip !== currentIdentity.ip);
       const selectedEntry = potentialEntryNodes[Math.floor(Math.random() * potentialEntryNodes.length)];
       setEntryIdentity(selectedEntry);
       setTimeout(() => {
           addLog(`Tunnel établi vers le nœud d'entrée ${selectedEntry.ip} (${selectedEntry.country})...`, 'info');
       }, 500);
       setTimeout(() => {
           addLog('Relais confirmé. Routage vers le nœud de sortie...', 'success');
       }, 1000);
       if (connectionDelay < 2500) connectionDelay = 2500;
       else connectionDelay += 1000;
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
      } else if (mode === ConnectionMode.STEALTH) {
           addLog(`Connexion Furtive établie : Trafic indiscernable du HTTPS standard`, 'success');
      } else {
           addLog(`Connexion établie (${appSettings.protocol.toUpperCase()}) - Canal chiffré actif`, 'success');
      }
      
      if (obsLevel !== 'standard') {
          addLog(`Mode Obfusqué ${obsLevel.toUpperCase()} actif : Anonymat renforcé`, 'success');
          setCurrentIdentity(prev => ({
              ...prev,
              latency: prev.latency + (obsLevel === 'high' ? 45 : 120)
          }));
      }
      
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
      if (appSettings.ipv6LeakProtection) addLog('Protection fuite IPv6 : Active', 'info');
      
    }, connectionDelay);
  }, [appSettings, mode, currentIdentity, addLog]);

  const disconnectVPN = useCallback(() => {
    setIsDisconnecting(true);
    addLog('Déconnexion initiée...', 'warning');

    if (connectionStartRef.current) {
        const endTime = Date.now();
        const startTime = connectionStartRef.current;
        const durationMs = endTime - startTime;
        const seconds = Math.floor((durationMs / 1000) % 60);
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
        const hours = Math.floor((durationMs / (1000 * 60 * 60)));
        const durationString = `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;

        const newSession: ConnectionSession = {
            id: Math.random().toString(36).substr(2, 9),
            startTime,
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
      setEntryIdentity(null);
      setSecurityReport(null);
      addLog('Déconnecté du réseau sécurisé', 'info');
    }, 1500);
  }, [addLog, currentIdentity, appSettings.protocol, mode]);

  const toggleConnection = async () => {
    if (isEmergency) return;
    if (isConnected) {
      disconnectVPN();
    } else {
      connectVPN();
    }
  };

  const handleAnalyze = useCallback(async (identity: VirtualIdentity = currentIdentity) => {
    if (!isConnected && !isEmergency) return;
    setAnalyzing(true);
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
  }, [isConnected, isEmergency, mode, currentIdentity, addLog]);

  useEffect(() => {
    if (isConnected && !isDisconnecting && !isEmergency) {
      handleAnalyze();
    }
  }, [isConnected, isDisconnecting, isEmergency, handleAnalyze]);

  const hasAutoConnected = useRef(false);
  useEffect(() => {
    if (!hasAutoConnected.current && appSettings.autoConnect && !isConnected && !isEmergency && user) {
        hasAutoConnected.current = true;
        addLog('🚀 Démarrage : Connexion automatique activée', 'info');
        connectVPN();
    }
  }, [user, appSettings.autoConnect, isConnected, isEmergency, connectVPN, addLog]);

  const handleEmergencyProtocol = useCallback(() => {
    if (!appSettings.killSwitch) {
        addLog('⚠️ Connexion interrompue. Kill Switch inactif : IP exposée.', 'error');
        disconnectVPN();
        return;
    }
    addLog('🚨 DÉCONNEXION ACCIDENTELLE DÉTECTÉE', 'error');
    setIsEmergency(true);
    setIsConnected(false);
    setEmergencyStep('BLOCAGE TRAFIC');
    addLog('🛡️ KILL SWITCH ENGAGÉ : Trafic Internet totalement bloqué', 'warning');
    setTimeout(() => {
        setEmergencyStep('PURGE SESSION');
        addLog('♻️ Purge des clés de session compromises...', 'info');
        setTimeout(() => {
            setEmergencyStep('RENUMÉROTATION');
            addLog('🔄 Renumérotation forcée : Acquisition nouvelle identité...', 'warning');
            const availableIds = MOCK_IDENTITIES.filter(id => id.ip !== currentIdentity.ip);
            const newIdentity = availableIds[Math.floor(Math.random() * availableIds.length)];
            setTimeout(() => {
                setCurrentIdentity(newIdentity);
                addLog(`✅ Nouvelle IP sécurisée acquise : ${newIdentity.ip}`, 'success');
                setEmergencyStep(`ATTENTE (${appSettings.reconnectDelay}s)`);
                setTimeout(() => {
                    if (appSettings.autoReconnect) {
                        setIsConnected(true);
                        setIsEmergency(false);
                        setEmergencyStep('');
                        addLog('🚀 TUNNEL RÉTABLI AVEC SUCCÈS', 'success');
                        handleAnalyze(newIdentity);
                    } else {
                         setIsEmergency(false);
                         setEmergencyStep('');
                         addLog('Connexion coupée. Reconnexion automatique désactivée.', 'warning');
                         disconnectVPN();
                    }
                }, appSettings.reconnectDelay * 1000);
            }, 2000);
        }, 1500);
    }, 1000);
  }, [isConnected, appSettings.killSwitch, appSettings.autoReconnect, appSettings.reconnectDelay, currentIdentity, disconnectVPN, addLog, handleAnalyze]);

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
    if (!isConnected) {
        setMode(newMode);
        setNotification(`Mode de connexion changé : ${newMode}`);
        addLog(`Mode de connexion réglé sur : ${newMode}`, 'info');
        if (newMode === ConnectionMode.STEALTH) {
            addLog('Mode Furtif : Le trafic sera camouflé en HTTPS pour contourner les pare-feux.', 'warning');
        }
    }
  };

  const handleRenumber = useCallback(() => {
    if (!isConnected || isRenumbering || isEmergency || isMasking) return;
    setIsRenumbering(true);
    addLog('Rotation d\'identité en cours...', 'warning');
    setTimeout(() => {
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
  }, [isConnected, isRenumbering, isEmergency, isMasking, currentIdentity, entryIdentity, addLog, handleAnalyze]);

  const handleMasking = useCallback(() => {
    if (!isConnected || isMasking || isEmergency || isRenumbering) return;
    setIsMasking(true);
    addLog('Masquage des empreintes numériques (MAC/UA) en cours...', 'info');
    setTimeout(() => {
        const userAgents = ['Chrome / Win10', 'Firefox / MacOS', 'Safari / iOS', 'Edge / Win11', 'Brave / Linux', 'Opera / Android'];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        const generateMAC = () => {
            const hex = "0123456789ABCDEF";
            let mac = "";
            for (let i = 0; i < 6; i++) {
                mac += hex.charAt(Math.floor(Math.random() * 16));
                mac += hex.charAt(Math.floor(Math.random() * 16));
                if (i < 5) mac += ":";
            }
            return mac;
        };
        const newMAC = generateMAC();
        const latencyJitter = Math.floor(Math.random() * 20) - 10;
        setCurrentIdentity(prev => ({
            ...prev,
            mac: newMAC,
            userAgentShort: randomUA,
            latency: Math.max(5, prev.latency + latencyJitter)
        }));
        setIsMasking(false);
        addLog(`Empreinte masquée : ${randomUA} | ${newMAC}`, 'success');
    }, 2000);
  }, [isConnected, isMasking, isEmergency, isRenumbering, addLog]);

  const handleSimulateDrop = () => {
    if (!isConnected || isDisconnecting || isEmergency) return;
    if (!appSettings.killSwitch) {
        addLog('⚠️ Simulation : Perte réseau (Kill Switch Inactif)', 'error');
        disconnectVPN();
        return;
    }
    setIsDisconnecting(true);
    addLog('⚠️ Simulation : Perturbation réseau détectée...', 'warning');
    setTimeout(() => {
        setIsDisconnecting(false);
        handleEmergencyProtocol();
    }, 1000);
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
  }, [isConnected, appSettings.autoRotation, appSettings.rotationInterval, isEmergency]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleConnection();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleRenumber();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleMasking();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleConnection, handleRenumber, handleMasking]);

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

  const openSettings = (tab: 'general' | 'connection' | 'privacy' | 'advanced' | 'billing' = 'general') => {
      setInitialSettingsTab(tab);
      setShowSettings(true);
  };

  const handleUpdateSettings = (key: keyof AppSettings, value: any) => {
    if (key === 'dns' && value === 'custom' && userPlan === 'free') {
        addLog('DNS Sécurisé nécessite le plan PRO', 'warning');
        setShowPricing(true);
        return;
    }
    setAppSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'autoRotation') addLog(`Rotation automatique ${value ? 'activée' : 'désactivée'}`, 'info');
    else if (key === 'adBlocker') addLog(`AdBlocker AI ${value ? 'activé' : 'désactivé'}`, 'info');
    else addLog(`Configuration mise à jour: ${key}`, 'info');
  };

  const handleOpenWithdrawal = () => {
    if (balance < 1) {
        addLog('Solde insuffisant pour retrait (Min 1 RNC)', 'warning');
        return;
    }
    setShowWithdrawal(true);
  };

  const handleConfirmWithdrawal = async (method: string, address: string) => {
    const amount = parseFloat(balance.toFixed(4));
    const methodLabel = method === 'crypto' ? 'Wallet' : method === 'paypal' ? 'PayPal' : 'Virement Bancaire';
    addLog(`Initialisation du retrait de ${amount} RNC vers ${methodLabel}...`, 'info');
    const newTransaction: Transaction = {
        id: `TX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        amount: amount,
        method: method as 'crypto' | 'paypal' | 'bank_transfer',
        status: 'completed',
        address: address
    };
    setTimeout(async () => {
        addLog(`Vérification de l'adresse ${address.substring(0,6)}...${address.substring(address.length-4)}`, 'info');
        try {
            const { error } = await supabase.from('transactions').insert([{
                id: newTransaction.id,
                date: newTransaction.date,
                amount: newTransaction.amount,
                method: newTransaction.method,
                status: newTransaction.status,
                address: newTransaction.address,
                user_email: user?.email
            }]);
            if (error) {
                console.warn('Supabase Insert Warning:', error);
                addLog('Mode hors ligne : Transaction sauvegardée localement', 'warning');
            } else {
                addLog('Transaction synchronisée sur le cloud', 'success');
            }
        } catch (e) {
            console.warn('Network error during insert:', e);
            addLog('Mode hors ligne : Transaction sauvegardée localement', 'warning');
        }
        setTimeout(() => {
            setTransactions(prev => {
                const updated = [newTransaction, ...prev];
                if (user) {
                    localStorage.setItem(`transactions_${user.email}`, JSON.stringify(updated));
                }
                return updated;
            });
            setBalance(0);
            setShowWithdrawal(false);
            addLog(`Transaction confirmée [${newTransaction.id}] : ${amount} RNC envoyés.`, 'success');
        }, 1000);
    }, 800);
  };

  const handleLogin = (email: string) => {
    const newUser = { email };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
      if (isConnected) {
          disconnectVPN();
      }
      setUser(null);
      localStorage.removeItem('user');
      setBalance(0);
      setTransactions([]);
  };

  const handleConnectNode = (nodeId: string) => {
      const target = deviceNodes.find(n => n.id === nodeId);
      if (target) {
          addLog(`Connexion manuelle au nœud : ${target.name}`, 'info');
          setCurrentView('dashboard');
          if (!isConnected) {
              connectVPN();
          } else {
              setIsRenumbering(true);
              setTimeout(() => {
                  setCurrentIdentity(prev => ({ ...prev, ip: target.ip, latency: target.latency }));
                  setIsRenumbering(false);
                  addLog(`Basculement réussi vers ${target.name}`, 'success');
              }, 1500);
          }
      }
  };

  const handleAutonomyUpdate = (nodeId: string, profile: 'provider' | 'balanced' | 'consumer') => {
      setDeviceNodes(prev => prev.map(node => {
          if (node.id === nodeId) {
              let newRate = node.transferRate;
              if (profile === 'provider') newRate = Math.floor(Math.random() * 50) + 50;
              if (profile === 'balanced') newRate = Math.floor(Math.random() * 30) + 10;
              if (profile === 'consumer') newRate = Math.floor(Math.random() * 5);
              addLog(`Profil ${node.name} mis à jour : ${profile.toUpperCase()}`, 'info');
              return { ...node, autonomyProfile: profile, transferRate: newRate };
          }
          return node;
      }));
  };

  const handleAddPaymentMethod = () => {
      const newMethod: PaymentMethod = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'card',
          name: `Carte Visa terminant par ${Math.floor(Math.random() * 9000) + 1000}`,
          expiry: '12/26',
          isDefault: paymentMethods.length === 0
      };
      setPaymentMethods(prev => [...prev, newMethod]);
      addLog(`Moyen de paiement ajouté : ${newMethod.name}`, 'success');
  };

  const handleRemovePaymentMethod = (id: string) => {
      setPaymentMethods(prev => prev.filter(m => m.id !== id));
      addLog('Moyen de paiement supprimé', 'info');
  };

  const handleVerificationSuccess = () => {
      setIsVerified(true);
      setShowVerification(false);
      addLog('Identité vérifiée avec succès. Compte débridé.', 'success');
  };

  const recommendedActions = useMemo(() => {
    if (!securityReport || !isConnected) return [];
    const recs = [];
    const { threatLevel } = securityReport;
    if ((threatLevel === 'Critique' || threatLevel === 'Élevé') && appSettings.obfuscationLevel !== 'ultra') {
        recs.push({
            id: 'set_ultra',
            label: "Activer Obfuscation Ultra",
            subLabel: "Recommandé pour menace critique",
            icon: Ghost,
            color: 'text-indigo-500',
            borderColor: 'border-indigo-200 dark:border-indigo-500/30',
            bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
            handler: () => {
                handleUpdateSettings('obfuscationLevel', 'ultra');
                addLog('Action recommandée appliquée : Obfuscation Ultra', 'success');
            }
        });
    }
    if (threatLevel !== 'Faible' && !appSettings.killSwitch) {
        recs.push({
            id: 'enable_killswitch',
            label: "Activer Kill Switch",
            subLabel: "Protection coupure indispensable",
            icon: ToggleRight,
            color: 'text-red-500',
            borderColor: 'border-red-200 dark:border-red-500/30',
            bgColor: 'bg-red-50 dark:bg-red-500/10',
            handler: () => {
                handleUpdateSettings('killSwitch', true);
                addLog('Action recommandée appliquée : Kill Switch activé', 'success');
            }
        });
    }
    return recs;
  }, [securityReport, isConnected, appSettings, addLog]);

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

  const statusTextColor = isEmergency ? 'text-red-500' : isDisconnecting ? 'text-amber-500' : isConnected ? 'text-emerald-500' : 'text-slate-500';
  const statusBgColor = isEmergency ? 'bg-red-500/10' : isDisconnecting ? 'bg-amber-500/10' : isConnected ? 'bg-emerald-500/10' : 'bg-slate-500/10';
  const cardBorderClass = isEmergency 
    ? 'border-red-500/30 shadow-red-900/10' 
    : isConnected && mode === ConnectionMode.STEALTH
        ? 'border-indigo-500/30 shadow-indigo-500/10'
        : isConnected && mode === ConnectionMode.DOUBLE_HOP
            ? 'border-violet-500/30 shadow-violet-500/10'
            : isConnected && mode === ConnectionMode.SMART_DNS
                ? 'border-orange-500/30 shadow-orange-500/10'
                : 'border-slate-200 dark:border-slate-800';

  if (!user) {
      return (
          <>
            <AuthScreen onLogin={handleLogin} />
          </>
      );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} ${isEmergency ? 'border-4 border-red-500/50' : ''}`}>
      
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-2 bg-slate-900/90 text-white rounded-full shadow-2xl border border-slate-700/50 backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-top-full fade-in duration-300">
             <div className="w-2 h-2 rounded-full bg-brand-500"></div>
             <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

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
          initialTab={initialSettingsTab}
          isVerified={isVerified}
          onStartVerification={() => setShowVerification(true)}
          paymentMethods={paymentMethods}
          onAddPaymentMethod={handleAddPaymentMethod}
          onRemovePaymentMethod={handleRemovePaymentMethod}
          onViewHistory={() => setShowHistory(true)}
        />
      )}

      {showVerification && (
        <VerificationModal 
            onClose={() => setShowVerification(false)}
            onSuccess={handleVerificationSuccess}
        />
      )}

      {showWithdrawal && (
        <WithdrawalModal 
            balance={balance}
            onClose={() => setShowWithdrawal(false)}
            onConfirm={handleConfirmWithdrawal}
        />
      )}

      {showHistory && (
        <TransactionHistoryModal 
            transactions={transactions}
            onClose={() => setShowHistory(false)}
        />
      )}

      {showConnectionHistory && (
        <ConnectionHistoryModal
            history={connectionHistory}
            onClose={() => setShowConnectionHistory(false)}
            onClear={() => {
                setConnectionHistory([]);
                localStorage.removeItem('connectionHistory');
            }}
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
          
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mx-4">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${currentView === 'dashboard' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                  Dashboard
              </button>
              <button 
                onClick={() => setCurrentView('network')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${currentView === 'network' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                  <Network className="w-3 h-3" />
                  Réseau
              </button>
          </div>

          <div className="flex items-center gap-3">
            {userPlan !== 'free' && !isEmergency && (
              <div className="flex items-center gap-2 mr-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <Wallet className="w-4 h-4 text-amber-500" />
                  <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{balance.toFixed(2)} RNC</span>
                </div>
                
                {balance > 1 && (
                    <button
                      onClick={handleOpenWithdrawal}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-lg shadow-amber-500/20 hover:scale-105 animate-in fade-in zoom-in duration-300"
                      title="Retirer les fonds vers portefeuille externe"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Retirer</span>
                    </button>
                )}
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
              onClick={() => setShowConnectionHistory(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Historique de connexion"
            >
              <History className="w-5 h-5" />
            </button>

            <button
              onClick={() => openSettings('general')}
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

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
            
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusBgColor} ${statusTextColor}`}>
              <div className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-red-500 animate-ping' : isDisconnecting ? 'bg-amber-500 animate-pulse' : isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              <span>
                  {isEmergency 
                    ? 'URGENCE : RENUMÉROTATION' 
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
        <div className="w-full bg-red-600 text-white text-center py-1.5 text-xs font-bold uppercase tracking-wider animate-pulse flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{emergencyStep || 'PROTOCOLE D\'URGENCE ACTIF'}</span>
        </div>
      )}

      <main className={`max-w-7xl mx-auto p-4 md:p-6 pb-24 space-y-6 ${isEmergency ? 'opacity-50 pointer-events-none blur-sm' : ''}`}>
        
        {currentView === 'dashboard' ? (
          <>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Dashboard 
                    isDark={isDark} 
                    protocol={appSettings.protocol} 
                    isEmergency={isEmergency} 
                    securityReport={securityReport}
                    isConnected={isConnected}
                    userPlan={userPlan}
                />
                <IdentityMatrix 
                    identity={currentIdentity} 
                    entryIdentity={entryIdentity} 
                    isRotating={isRenumbering}
                    isMasking={isMasking}
                    mode={mode}
                    securityReport={securityReport}
                    protocol={appSettings.protocol}
                    obfuscationLevel={appSettings.obfuscationLevel}
                    onOpenObfuscationSettings={() => openSettings('advanced')}
                />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SecureFileTransfer 
                    isConnected={isConnected && !isEmergency} 
                    addLog={addLog}
                />
                <EarningsCard 
                    isConnected={isConnected}
                    plan={userPlan}
                    balance={balance}
                    onUpgrade={() => setShowPricing(true)}
                    onWithdraw={handleOpenWithdrawal}
                    transactions={transactions}
                    onViewHistory={() => setShowHistory(true)}
                />
             </div>

             <SystemLogs 
                logs={logs} 
                onClear={clearLogs}
                retentionHours={appSettings.logRetentionHours}
                onRetentionChange={(h) => handleUpdateSettings('logRetentionHours', h)}
             />
          </>
        ) : (
          <NetworkView 
             nodes={deviceNodes}
             onConnectNode={handleConnectNode}
             onAutonomyUpdate={handleAutonomyUpdate}
          />
        )}

      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
        <button
          onClick={isConnected ? toggleConnection : connectVPN}
          disabled={isEmergency || isDisconnecting}
          className={`w-full h-16 rounded-2xl font-bold text-lg text-white shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden group ${mainButtonColor}`}
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          
          {isDisconnecting ? (
             <>
                 <Loader2 className="w-6 h-6 animate-spin" />
                 <span>DÉCONNEXION...</span>
             </>
          ) : isEmergency ? (
             <>
                 <Siren className="w-6 h-6 animate-ping" />
                 <span>{emergencyStep || 'URGENCE'}</span>
             </>
          ) : isConnected ? (
             <>
                 <Power className="w-6 h-6" />
                 <span>DÉCONNECTER</span>
             </>
          ) : (
             <>
                 <Power className="w-6 h-6" />
                 <span>CONNECTER</span>
             </>
          )}
        </button>
      </div>

    </div>
  );
}

export default App;