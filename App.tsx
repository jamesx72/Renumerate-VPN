import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Power, RefreshCw, Moon, Sun, Lock, Globe, Terminal, Activity, Share2, Wifi, Zap, Settings, Crown, Wallet, Ghost, Layers, AlertTriangle, WifiOff, Siren, Route, Loader2, ToggleLeft, ToggleRight, Fingerprint, LogOut, CheckCircle, ArrowRight } from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './components/DashboardCharts';
import { IdentityMatrix } from './components/IdentityMatrix';
import { SecureFileTransfer } from './components/SecureFileTransfer';
import { PricingModal } from './components/PricingModal';
import { SettingsPanel } from './components/SettingsPanel';
import { EarningsCard } from './components/EarningsCard';
import { SystemLogs } from './components/SystemLogs';
import { WithdrawalModal } from './components/WithdrawalModal';
import { AuthScreen } from './components/AuthScreen';
import { MOCK_IDENTITIES, INITIAL_LOGS } from './constants';
import { VirtualIdentity, ConnectionMode, SecurityReport, LogEntry, PlanTier, AppSettings, Transaction } from './types';
import { analyzeSecurity } from './services/geminiService';
import { supabase } from './services/supabaseClient';

function App() {
  const [isDark, setIsDark] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false); // New Emergency State
  const [emergencyStep, setEmergencyStep] = useState<string>(''); // For granular UI feedback
  
  // Auth State
  const [user, setUser] = useState<{email: string} | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

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
  const [isMasking, setIsMasking] = useState(false); // New Masking State
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
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
      obfuscationLevel: 'standard',
      mtuSize: 1420,
      ipv6LeakProtection: true,
      localNetworkSharing: false
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

  // Load Transactions from Supabase
  useEffect(() => {
    const fetchTransactions = async () => {
        if (!user) return;
        
        // Assume a table 'transactions' exists
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_email', user.email)
            .order('created_at', { ascending: false }); // Assuming created_at or date column

        if (error) {
            console.error('Error fetching transactions:', error);
            // Fallback to local state/empty if error for now, or you could add a log
        } else if (data) {
            // Map Supabase data to Transaction type if necessary, usually it matches if column names are same
            // Handling potential date format differences or column mapping
            const mappedTransactions: Transaction[] = data.map((t: any) => ({
                id: t.id,
                date: t.date || new Date(t.created_at).toLocaleDateString('fr-FR'),
                amount: t.amount,
                method: t.method,
                status: t.status,
                address: t.address
            }));
            setTransactions(mappedTransactions);
        }
    };

    fetchTransactions();
  }, [user]);

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
    
    // Obfuscation & Behavior Logic
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

    // Logic specifically for STEALTH Mode connection
    if (mode === ConnectionMode.STEALTH) {
        connectionDelay = 3500; // Force a longer delay for realism
        setTimeout(() => addLog('Mode Furtif : Initialisation du moteur d\'obfuscation...', 'info'), 600);
        setTimeout(() => addLog('Analyse des signatures DPI (Deep Packet Inspection)...', 'info'), 1500);
        setTimeout(() => addLog('Suppression des métadonnées du protocole VPN...', 'info'), 2200);
        setTimeout(() => addLog('Encapsulation SSL/TLS sur le port 443 (HTTPS)...', 'warning'), 3000);
    }

    if (mode === ConnectionMode.DOUBLE_HOP) {
       // Select a random entry node different from current identity
       const potentialEntryNodes = MOCK_IDENTITIES.filter(id => id.ip !== currentIdentity.ip);
       const selectedEntry = potentialEntryNodes[Math.floor(Math.random() * potentialEntryNodes.length)];
       setEntryIdentity(selectedEntry);

       setTimeout(() => {
           addLog(`Tunnel établi vers le nœud d'entrée ${selectedEntry.ip} (${selectedEntry.country})...`, 'info');
       }, 500);
       setTimeout(() => {
           addLog('Relais confirmé. Routage vers le nœud de sortie...', 'success');
       }, 1000);

       // Increase delay for Double Hop if not already long enough
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
      
      // Apply Obfuscation Side Effects (Latency penalty simulation)
      if (obsLevel !== 'standard') {
          addLog(`Mode Obfusqué ${obsLevel.toUpperCase()} actif : Anonymat renforcé`, 'success');
          setCurrentIdentity(prev => ({
              ...prev,
              latency: prev.latency + (obsLevel === 'high' ? 45 : 120)
          }));
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
      if (appSettings.ipv6LeakProtection) addLog('Protection fuite IPv6 : Active', 'info');
      
      // Trigger Analysis manually here since handleAnalyze isn't defined yet in this scope
      // We'll use a useEffect on isConnected to trigger analysis instead, or assume handleAnalyze is called later.
    }, connectionDelay);
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
    if (!hasAutoConnected.current && appSettings.autoConnect && !isConnected && !isEmergency && user) {
        hasAutoConnected.current = true;
        addLog('🚀 Démarrage : Connexion automatique activée', 'info');
        connectVPN();
    }
  }, [user]);

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
    // If Kill Switch is OFF, just standard drop
    if (!appSettings.killSwitch) {
        addLog('⚠️ Connexion interrompue. Kill Switch inactif : IP exposée.', 'error');
        disconnectVPN();
        return;
    }

    // Step 0: Trigger
    addLog('🚨 DÉCONNEXION ACCIDENTELLE DÉTECTÉE', 'error');
    setIsEmergency(true);
    setIsConnected(false);
    setEmergencyStep('BLOCAGE TRAFIC');
    
    // Step 1: Engage Kill Switch (Immediate)
    addLog('🛡️ KILL SWITCH ENGAGÉ : Trafic Internet totalement bloqué', 'warning');
    
    // Step 2: Purge
    setTimeout(() => {
        setEmergencyStep('PURGE SESSION');
        addLog('♻️ Purge des clés de session compromises...', 'info');

        // Step 3: Forced Renumbering (Find NEW identity)
        setTimeout(() => {
            setEmergencyStep('RENUMÉROTATION');
            addLog('🔄 Renumérotation forcée : Acquisition nouvelle identité...', 'warning');
            
            const availableIds = MOCK_IDENTITIES.filter(id => id.ip !== currentIdentity.ip);
            const newIdentity = availableIds[Math.floor(Math.random() * availableIds.length)];
            
            // Step 4: Apply New ID
            setTimeout(() => {
                setCurrentIdentity(newIdentity);
                addLog(`✅ Nouvelle IP sécurisée acquise : ${newIdentity.ip}`, 'success');
                setEmergencyStep('RECONNEXION');
                
                // Step 5: Re-establish
                setTimeout(() => {
                    setIsConnected(true);
                    setIsEmergency(false);
                    setEmergencyStep('');
                    addLog('🚀 TUNNEL RÉTABLI AVEC SUCCÈS', 'success');
                    handleAnalyze(newIdentity);
                }, 1000);
                
            }, 2000); // Time to find new IP
        }, 1500); // Time to purge
    }, 1000); // Time to block
  }, [isConnected, appSettings.killSwitch, currentIdentity, disconnectVPN]);

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
    if (!isConnected) {
        setMode(newMode);
        addLog(`Mode de connexion réglé sur : ${newMode}`, 'info');
        
        // Specific log for Stealth mode selection
        if (newMode === ConnectionMode.STEALTH) {
            addLog('Mode Furtif : Le trafic sera camouflé en HTTPS pour contourner les pare-feux.', 'warning');
        }
    }
  };

  const handleRenumber = () => {
    if (!isConnected || isRenumbering || isEmergency || isMasking) return;
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

  const handleMasking = () => {
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
        
        // Enhance: Randomize latency slightly to simulate stack changes
        const latencyJitter = Math.floor(Math.random() * 20) - 10; // +/- 10ms

        setCurrentIdentity(prev => ({
            ...prev,
            mac: newMAC,
            userAgentShort: randomUA,
            latency: Math.max(5, prev.latency + latencyJitter)
        }));

        setIsMasking(false);
        addLog(`Empreinte masquée : ${randomUA} | ${newMAC}`, 'success');
    }, 2000);
  };

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
        // This triggers the emergency state which will now show "NON PROTÉGÉ"
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
  }, [isConnected, appSettings.autoRotation, appSettings.rotationInterval, currentIdentity, isEmergency]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Toggle Connection
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleConnection();
      }
      // Ctrl+R: Renumber Identity
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleRenumber();
      }
      // Ctrl+M: Masking
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

  const handleUpdateSettings = (key: keyof AppSettings, value: any) => {
    // Feature Locking Logic - DNS Custom still locked
    if (key === 'dns' && value === 'custom' && userPlan === 'free') {
        addLog('DNS Sécurisé nécessite le plan PRO', 'warning');
        setShowPricing(true);
        return;
    }

    setAppSettings(prev => ({ ...prev, [key]: value }));
    
    // Updated logging for new settings
    if (key === 'autoRotation') {
        addLog(`Rotation automatique ${value ? 'activée' : 'désactivée'}`, 'info');
    } else if (key === 'adBlocker') {
        addLog(`AdBlocker AI ${value ? 'activé' : 'désactivé'}`, 'info');
    } else if (key === 'autoConnect') {
        addLog(`Connexion automatique au démarrage ${value ? 'activée' : 'désactivée'}`, 'info');
    } else if (key === 'rotationInterval') {
        addLog(`Intervalle de rotation : ${value} min`, 'info');
    } else if (key === 'mtuSize') {
        addLog(`Taille MTU ajustée : ${value} bytes`, 'info');
    } else if (key === 'ipv6LeakProtection') {
        addLog(`Protection fuite IPv6 ${value ? 'activée' : 'désactivée'}`, 'info');
    } else if (key === 'localNetworkSharing') {
        addLog(`Partage réseau local ${value ? 'activé' : 'désactivé'}`, value ? 'warning' : 'info');
    } else if (key === 'obfuscationLevel') {
        const labels: Record<string, string> = { standard: 'Standard', high: 'Élevé', ultra: 'Ultra' };
        addLog(`Niveau d'obfuscation réglé sur : ${labels[value as string] || value}`, 'info');
        if (value !== 'standard') addLog('Note : Une obfuscation plus élevée peut augmenter la latence.', 'warning');
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

  const handleConfirmWithdrawal = async (method: string, address: string) => {
    const amount = parseFloat(balance.toFixed(4));
    
    // Log initiation
    addLog(`Initialisation du retrait de ${amount} RNC vers ${method === 'crypto' ? 'Wallet' : 'PayPal'}...`, 'info');
    
    // Create new transaction object
    const newTransaction: Transaction = {
        id: `TX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        amount: amount,
        method: method as 'crypto' | 'paypal',
        status: 'completed',
        address: address
    };

    // Simulate blockchain/bank process steps in logs
    setTimeout(async () => {
        addLog(`Vérification de l'adresse ${address.substring(0,6)}...${address.substring(address.length-4)}`, 'info');
        
        // Save to Supabase
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
            console.error('Supabase Error:', error);
            addLog('Erreur lors de la sauvegarde sur la base de données', 'error');
        } else {
            addLog('Transaction enregistrée sur Supabase', 'success');
        }

        setTimeout(() => {
            // Update transactions list locally (Optimistic UI)
            setTransactions(prev => [newTransaction, ...prev]);
            
            // Reset balance
            setBalance(0);
            setShowWithdrawal(false);
            
            addLog(`Transaction confirmée [${newTransaction.id}] : ${amount} RNC envoyés.`, 'success');
        }, 1000);
    }, 800);
  };

  // Auth Handlers
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

  // Recommendation Logic
  const recommendedActions = useMemo(() => {
    if (!securityReport || !isConnected) return [];
    
    const recs = [];
    const { threatLevel } = securityReport;

    // 1. Obfuscation Recommendation
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
    } else if (threatLevel === 'Moyen' && appSettings.obfuscationLevel === 'standard') {
        recs.push({
            id: 'set_high',
            label: "Obfuscation Élevée",
            subLabel: "Recommandé pour menace moyenne",
            icon: Shield,
            color: 'text-amber-500',
            borderColor: 'border-amber-200 dark:border-amber-500/30',
            bgColor: 'bg-amber-50 dark:bg-amber-500/10',
            handler: () => {
                handleUpdateSettings('obfuscationLevel', 'high');
                addLog('Action recommandée appliquée : Obfuscation Élevée', 'success');
            }
        });
    }

    // 2. Kill Switch Recommendation
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

    // 3. AdBlocker Recommendation
    if (threatLevel !== 'Faible' && !appSettings.adBlocker) {
         recs.push({
            id: 'enable_adblock',
            label: "Activer AdBlocker",
            subLabel: "Filtrer les trackers malveillants",
            icon: Zap,
            color: 'text-brand-500',
            borderColor: 'border-brand-200 dark:border-brand-500/30',
            bgColor: 'bg-brand-50 dark:bg-brand-500/10',
            handler: () => {
                handleUpdateSettings('adBlocker', true);
                addLog('Action recommandée appliquée : AdBlocker activé', 'success');
            }
        });
    }
    
    // 4. Auto Rotation Recommendation for High Threats
    if ((threatLevel === 'Critique' || threatLevel === 'Élevé') && !appSettings.autoRotation) {
        recs.push({
           id: 'enable_rotation',
           label: "Rotation Auto",
           subLabel: "Changer d'IP périodiquement",
           icon: RefreshCw,
           color: 'text-emerald-500',
           borderColor: 'border-emerald-200 dark:border-emerald-500/30',
           bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
           handler: () => {
               handleUpdateSettings('autoRotation', true);
               addLog('Action recommandée appliquée : Rotation automatique activée', 'success');
           }
       });
   }

    return recs;
  }, [securityReport, isConnected, appSettings]);

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

  // Calculate dynamic border color based on mode for the card
  const cardBorderClass = isEmergency 
    ? 'border-red-500/30 shadow-red-900/10' 
    : isConnected && mode === ConnectionMode.STEALTH
        ? 'border-indigo-500/30 shadow-indigo-500/10'
        : isConnected && mode === ConnectionMode.DOUBLE_HOP
            ? 'border-violet-500/30 shadow-violet-500/10'
            : isConnected && mode === ConnectionMode.SMART_DNS
                ? 'border-orange-500/30 shadow-orange-500/10'
                : 'border-slate-200 dark:border-slate-800';

  // Auth Guard
  if (!user) {
      return (
          <>
            <AuthScreen onLogin={handleLogin} />
          </>
      );
  }

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
        <div className="w-full bg-red-600 text-white text-center py-1.5 text-xs font-bold uppercase tracking-wider animate-pulse flex items-center justify-center gap-2 shadow-lg relative z-40">
           <Siren className="w-4 h-4" />
           Protocole de Renumérotation d'Urgence Actif
           <Siren className="w-4 h-4" />
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={`bg-white dark:bg-slate-900 rounded-2xl p-8 border ${cardBorderClass} shadow-xl relative overflow-hidden transition-all duration-500`}>
              
              {/* Stealth Mode Indicator Banner */}
              {mode === ConnectionMode.STEALTH && isConnected && !isEmergency && (
                 <div className="absolute top-0 left-0 w-full bg-indigo-950/90 border-b border-indigo-500/30 py-1.5 flex items-center justify-center gap-2 z-20 shadow-sm backdrop-blur-sm animate-in slide-in-from-top duration-500 ease-out">
                    <Ghost className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200">
                      Mode Furtif Activé - Trafic Obfusqué
                    </span>
                 </div>
              )}

              {/* Double Hop Indicator Banner */}
              {mode === ConnectionMode.DOUBLE_HOP && isConnected && !isEmergency && (
                <div className="absolute top-0 left-0 w-full bg-violet-950/90 border-b border-violet-500/30 py-1.5 flex items-center justify-center gap-2 z-20 shadow-sm backdrop-blur-sm animate-in slide-in-from-top duration-500 ease-out">
                  <Layers className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                    Double Hop Actif - Relais Chiffré
                  </span>
                </div>
              )}

              {/* Smart DNS Indicator Banner */}
              {mode === ConnectionMode.SMART_DNS && isConnected && !isEmergency && (
                <div className="absolute top-0 left-0 w-full bg-orange-950/90 border-b border-orange-500/30 py-1.5 flex items-center justify-center gap-2 z-20 shadow-sm backdrop-blur-sm animate-in slide-in-from-top duration-500 ease-out">
                  <Globe className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-200">
                    Smart DNS Actif - IP D'origine Conservée
                  </span>
                </div>
              )}

              {/* Kill Switch Toggle - Top Right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateSettings('killSwitch', !appSettings.killSwitch);
                }}
                className={`absolute top-6 right-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 backdrop-blur-md ${
                  appSettings.killSwitch 
                    ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                    : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={appSettings.killSwitch ? "Désactiver Kill Switch" : "Activer Kill Switch"}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline-block">Kill Switch</span>
                {appSettings.killSwitch ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>

              <div className="absolute top-0 right-0 p-4 opacity-10">
                {isEmergency ? <Siren className="w-64 h-64 text-red-500 animate-pulse" /> : <Wifi className="w-64 h-64" />}
              </div>
              
              <div className="relative z-10 flex flex-col items-center justify-center py-8">
                <button
                  onClick={toggleConnection}
                  disabled={isDisconnecting || isEmergency}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 ease-in-out shadow-2xl ${mainButtonColor}`}
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
                
                {!isEmergency && !isDisconnecting && (
                  <div key={mode} className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-1 duration-300">
                      {mode === ConnectionMode.STANDARD && <Zap className="w-3.5 h-3.5 text-brand-500" />}
                      {mode === ConnectionMode.STEALTH && <Ghost className="w-3.5 h-3.5 text-indigo-500" />}
                      {mode === ConnectionMode.DOUBLE_HOP && <Layers className="w-3.5 h-3.5 text-violet-500" />}
                      {mode === ConnectionMode.SMART_DNS && <Globe className="w-3.5 h-3.5 text-orange-500" />}
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{mode}</span>
                  </div>
                )}
                
                {isEmergency && (
                    <div className="mt-3 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-sm font-bold text-red-400 animate-pulse flex items-center gap-2 bg-red-950/30 px-4 py-2 rounded-full border border-red-500/30 shadow-lg shadow-red-500/10">
                            <AlertTriangle className="w-4 h-4" />
                            KILL SWITCH ACTIF : RENUMÉROTATION
                        </div>
                        {emergencyStep && (
                            <div className="text-xs font-mono text-red-300 flex items-center gap-2 mt-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {emergencyStep}...
                            </div>
                        )}
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
                          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transform transition-all duration-300 hover:scale-105 active:scale-95 ${
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
                      disabled={!isConnected || isRenumbering || isEmergency || isMasking}
                      title={!isConnected ? "Connectez-vous pour renuméroter" : isRenumbering ? "En cours..." : "Changer d'identité"}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border shadow-sm ${
                        !isConnected || isEmergency 
                          ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                          : isRenumbering
                            ? 'bg-brand-500/10 text-brand-500 border-brand-500/20 cursor-wait'
                            : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-500/30 hover:border-brand-500 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 hover:shadow-lg hover:shadow-brand-500/10 hover:scale-105'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRenumbering ? 'animate-spin' : ''}`} />
                      <span>{isRenumbering ? 'Renumérotation...' : 'Renuméroter'}</span>
                    </button>

                    <button
                      onClick={handleMasking}
                      disabled={!isConnected || isMasking || isEmergency || isRenumbering}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border shadow-sm ${
                        !isConnected || isEmergency 
                          ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                          : isMasking
                            ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 cursor-wait'
                            : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:scale-105'
                      }`}
                      title={!isConnected ? "Connectez-vous pour masquer" : isMasking ? "Masquage..." : "Masquer les empreintes (MAC/UA)"}
                    >
                      <Fingerprint className={`w-4 h-4 ${isMasking ? 'animate-pulse' : ''}`} />
                      <span>{isMasking ? 'Masquage...' : 'Masquer'}</span>
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
                transactions={transactions}
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
                  <>
                      <IdentityMatrix 
                        identity={currentIdentity} 
                        entryIdentity={entryIdentity} 
                        isRotating={isRenumbering || isEmergency} 
                        isMasking={isMasking} 
                        mode={mode} 
                        securityReport={securityReport}
                      />
                      
                      {recommendedActions.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                             <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-amber-500" /> Actions Recommandées
                             </h4>
                             <div className="grid grid-cols-1 gap-2">
                               {recommendedActions.map(action => {
                                  const Icon = action.icon;
                                  return (
                                      <button 
                                        key={action.id}
                                        onClick={action.handler}
                                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${action.bgColor} ${action.borderColor} group`}
                                      >
                                          <div className={`p-1.5 rounded-md bg-white dark:bg-slate-900/50 shadow-sm ${action.color}`}>
                                              <Icon className="w-4 h-4" />
                                          </div>
                                          <div className="flex-1">
                                              <div className={`text-xs font-bold ${action.color}`}>{action.label}</div>
                                              <div className="text-[10px] text-slate-500 dark:text-slate-400">{action.subLabel}</div>
                                          </div>
                                          <ArrowRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 ${action.color}`} />
                                      </button>
                                  );
                               })}
                             </div>
                          </div>
                      )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Shield className="w-12 h-12 mb-2 opacity-20" />
                    <p>Connectez-vous pour masquer votre identité</p>
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