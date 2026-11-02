import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Settings,
  Shield,
  Zap,
  X,
  Lock,
  Crown,
  Activity,
  Wallet,
  Fingerprint,
  RefreshCw,
  Orbit,
  Layers,
  Globe,
  Brain,
  Network,
  ArrowRightLeft,
  ShieldAlert,
  Clock,
  Cpu,
  Server,
  Search,
  Ghost,
  Rocket,
  ZapOff,
  ChevronRight,
  ShieldCheck,
  Wand2,
  Check,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Sun,
  Moon,
  Keyboard,
  Play,
  Loader2,
  AlertTriangle,
  Bookmark,
  Sliders,
  EyeOff,
} from 'lucide-react';
import {
  AppSettings,
  PlanTier,
  ConfigurationPreset,
  VirtualIdentity,
  SavedSettingsProfile,
  SplitTunnelRule,
  WithdrawalMethod,
  FiatCurrency,
} from '../types';
import {
  DEFAULT_APP_SETTINGS,
  sanitizeAppSettings,
  computeSettingsHardeningScore,
  EYES_5_COUNTRIES,
  EYES_14_COUNTRIES,
  WITHDRAWAL_RAIL_SPECS,
  getDefaultSubNetworkForMethod,
  getSubNetworksForMethod,
  validateWithdrawalDestination,
  formatFiatValue,
} from '../constants';

interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  patchSettings: (patch: Partial<AppSettings>, reason?: string) => void;
  onResetSettings: () => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isConnected: boolean;
  isEmergency: boolean;
  onToggleEmergency: () => void;
  currentIdentity: VirtualIdentity;
  onForceRotateIdentity: () => void;
  onScrambleMac: () => void;
  onFlushDnsCache: () => number;
  onSimulateReconnect: () => void;
  onClearLogs: () => void;
  onClearHistory: () => void;
  balance: number;
  reputation?: number;
  isVerified: boolean;
  userId: string;
  onOpenWithdrawalModal?: () => void;
  addLog: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error'
  ) => void;
}

type TabId =
  | 'wizard'
  | 'general'
  | 'security'
  | 'renumbering'
  | 'vortex'
  | 'earnings'
  | 'system';

interface SearchableSettingItem {
  id: string;
  title: string;
  description: string;
  tab: TabId;
  tabLabel: string;
  keywords: string[];
  currentValue: string;
}

const PROFILES_STORAGE_PREFIX = 'renumerate_saved_profiles:';

const PRESET_DEFINITIONS: Array<{
  id: ConfigurationPreset;
  label: string;
  subtitle: string;
  patch: Partial<AppSettings>;
}> = [
  {
    id: 'balanced',
    label: 'Équilibré',
    subtitle: 'WireGuard 1420B · Anti-fuite complet',
    patch: {
      protocol: 'wireguard',
      tunnelPort: 51820,
      mtuSize: 1420,
      killSwitch: true,
      killSwitchMode: 'strict',
      dnsLeakProtection: true,
      ipv6LeakProtection: true,
      webrtcLeakShield: true,
      autoRotation: false,
      obfuscationLevel: 'standard',
      excludeEyesJurisdictions: 'none',
    },
  },
  {
    id: 'speed_ultra',
    label: 'Vitesse & Streaming',
    subtitle: 'WireGuard UDP · Cache DNS actif · Latence min.',
    patch: {
      protocol: 'wireguard',
      tunnelPort: 51820,
      mtuSize: 1420,
      dns: 'cloudflare',
      dnsCache: true,
      dnsLeakProtection: true,
      killSwitch: true,
      killSwitchMode: 'soft',
      autoRotation: false,
      obfuscationLevel: 'standard',
      vortexBridge: 'none',
    },
  },
  {
    id: 'stealth_max',
    label: 'Furtivité Maximale',
    subtitle: 'OpenVPN :443 · Obfuscation Ultra · Rotation 5m',
    patch: {
      protocol: 'openvpn',
      tunnelPort: 443,
      mtuSize: 1380,
      dns: 'quad9',
      killSwitch: true,
      killSwitchMode: 'strict',
      dnsLeakProtection: true,
      ipv6LeakProtection: true,
      webrtcLeakShield: true,
      obfuscationLevel: 'ultra',
      autoRotation: true,
      rotationInterval: 5,
      uaComplexity: 'chaotic',
      macScramblingMode: 'laa',
      fingerprintProtection: {
        canvasNoise: true,
        webglMask: true,
        audioContextSpoof: true,
        timezoneSync: true,
      },
    },
  },
  {
    id: 'vortex_deep',
    label: 'Vortex Profond',
    subtitle: '4 sauts chiffrés · Pont OBFS4 · Hors 14-Eyes',
    patch: {
      protocol: 'openvpn',
      tunnelPort: 443,
      vortexBridge: 'obfs4',
      vortexCircuitLength: 4,
      vortexEntryNodeCountry: 'Suisse',
      vortexExitNodeCountry: 'Islande',
      vortexNoScript: true,
      excludeEyesJurisdictions: '14-eyes',
      dns: 'quad9',
      killSwitch: true,
      killSwitchMode: 'strict',
    },
  },
  {
    id: 'zero_trace',
    label: 'Forteresse Zéro-Trace',
    subtitle: 'Journaux RAM 0h · Blocage total · Hors 14-Eyes',
    patch: {
      protocol: 'wireguard',
      tunnelPort: 443,
      dns: 'quad9',
      killSwitch: true,
      killSwitchMode: 'strict',
      dnsLeakProtection: true,
      ipv6LeakProtection: true,
      webrtcLeakShield: true,
      adBlocker: true,
      threatFilters: {
        ads: true,
        trackers: true,
        malware: true,
        cryptominers: true,
      },
      autoRotation: true,
      rotationInterval: 10,
      obfuscationLevel: 'ultra',
      excludeEyesJurisdictions: '14-eyes',
      logRetentionHours: 0,
      fingerprintProtection: {
        canvasNoise: true,
        webglMask: true,
        audioContextSpoof: true,
        timezoneSync: true,
      },
    },
  },
];

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accent?: 'cyan' | 'emerald' | 'purple' | 'amber' | 'red';
  ariaLabel?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  accent = 'cyan',
  ariaLabel,
}) => {
  const activeBg =
    accent === 'emerald'
      ? 'bg-emerald-600'
      : accent === 'purple'
        ? 'bg-purple-600'
        : accent === 'amber'
          ? 'bg-amber-500'
          : accent === 'red'
            ? 'bg-red-600'
            : 'bg-cyan-600';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? activeBg : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

function isValidCustomDns(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const ipv4Regex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (ipv4Regex.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'tls:';
  } catch {
    return false;
  }
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  updateSettings,
  patchSettings,
  onResetSettings,
  onClose,
  userPlan,
  onShowPricing,
  isDark,
  onToggleTheme,
  isConnected,
  isEmergency,
  onToggleEmergency,
  currentIdentity,
  onForceRotateIdentity,
  onScrambleMac,
  onFlushDnsCache,
  onSimulateReconnect,
  onClearLogs,
  onClearHistory,
  balance,
  reputation = 100,
  isVerified,
  userId,
  onOpenWithdrawalModal,
  addLog,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardStep, setWizardStep] = useState(1);
  const [statusFeedback, setStatusFeedback] = useState<{
    message: string;
    tone: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  // Saved Custom Profiles (persisted per user in localStorage)
  const storageKey = `${PROFILES_STORAGE_PREFIX}${userId || 'default'}`;
  const [savedProfiles, setSavedProfiles] = useState<SavedSettingsProfile[]>(
    () => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw) as SavedSettingsProfile[]) : [];
      } catch {
        return [];
      }
    }
  );
  const [newProfileName, setNewProfileName] = useState('');

  // Inline confirmations (Zero window.alert / window.confirm)
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmPurgeLogs, setConfirmPurgeLogs] = useState(false);
  const [confirmPurgeHistory, setConfirmPurgeHistory] = useState(false);

  // Split Tunneling form state
  const [splitTarget, setSplitTarget] = useState('');
  const [splitType, setSplitType] = useState<SplitTunnelRule['type']>('domain');
  const [splitPolicy, setSplitPolicy] =
    useState<SplitTunnelRule['policy']>('bypass');

  // Custom Blocked Domain input
  const [newBlockedDomain, setNewBlockedDomain] = useState('');

  // Interactive Diagnostic Tools States
  const [isMtuProbing, setIsMtuProbing] = useState(false);
  const [mtuProbeResult, setMtuProbeResult] = useState<{
    optimalMtu: number;
    overheadBytes: number;
    payloadBytes: number;
    fragmented: boolean;
  } | null>(null);

  const [isSocksTesting, setIsSocksTesting] = useState(false);
  const [socksTestResult, setSocksTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);

  const [isDnsBenchmarking, setIsDnsBenchmarking] = useState(false);
  const [dnsBenchResults, setDnsBenchResults] = useState<
    Record<string, number>
  >({});
  const [lastDnsFlushInfo, setLastDnsFlushInfo] = useState<string | null>(null);

  const [isBridgeTesting, setIsBridgeTesting] = useState(false);
  const [bridgeTestResult, setBridgeTestResult] = useState<{
    bridge: string;
    rttMs: number;
    dpiResistance: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPremium = userPlan !== 'free';
  const hardeningScore = useMemo(
    () => computeSettingsHardeningScore(settings),
    [settings]
  );

  const notify = (
    message: string,
    tone: 'success' | 'warning' | 'error' | 'info' = 'success'
  ) => {
    setStatusFeedback({ message, tone });
  };

  useEffect(() => {
    if (!statusFeedback) return;
    const t = setTimeout(() => setStatusFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [statusFeedback]);

  const persistSavedProfiles = (next: SavedSettingsProfile[]) => {
    setSavedProfiles(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage quota
    }
  };

  const tabs: Array<{
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: 'general', label: 'Réseau & Tunnel', icon: Network },
    { id: 'security', label: 'Bouclier & DNS', icon: Shield },
    { id: 'renumbering', label: 'Identité & Morphing', icon: Fingerprint },
    {
      id: 'vortex',
      label: 'Onion Vortex',
      icon: Orbit,
      badge: `${settings.vortexCircuitLength} sauts`,
    },
    { id: 'earnings', label: 'Gains RNC', icon: Wallet },
    { id: 'wizard', label: 'Profils & Sauvegarde', icon: Wand2 },
    { id: 'system', label: 'Système & Purge', icon: Sliders },
  ];

  const applyPreset = (presetId: ConfigurationPreset) => {
    const found = PRESET_DEFINITIONS.find((p) => p.id === presetId);
    if (!found) return;
    patchSettings(found.patch, `Préréglage appliqué : ${found.label}`);
    notify(`Profil « ${found.label} » appliqué avec succès`, 'success');
  };

  const handleSaveCustomProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    const entry: SavedSettingsProfile = {
      id: `prof-${Date.now().toString(36)}`,
      name: trimmed,
      createdAt: new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      settings: sanitizeAppSettings(settings),
    };
    persistSavedProfiles([entry, ...savedProfiles].slice(0, 12));
    setNewProfileName('');
    addLog(`Profil de configuration enregistré : ${trimmed}`, 'success');
    notify(`Profil « ${trimmed} » sauvegardé localement`, 'success');
  };

  const handleLoadCustomProfile = (profile: SavedSettingsProfile) => {
    const clean = sanitizeAppSettings(profile.settings);
    patchSettings(clean, `Profil chargé : ${profile.name}`);
    notify(`Profil « ${profile.name} » restauré`, 'success');
  };

  const handleDeleteCustomProfile = (id: string) => {
    const next = savedProfiles.filter((p) => p.id !== id);
    persistSavedProfiles(next);
    notify('Profil supprimé', 'info');
  };

  const handleExportJson = () => {
    const payload = {
      app: 'Renumerate VPN',
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      settings: sanitizeAppSettings(settings),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `renumerate-config-${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('Configuration exportée au format JSON', 'info');
    notify('Fichier JSON exporté avec succès', 'success');
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(sanitizeAppSettings(settings), null, 2)
      );
      notify('Configuration JSON copiée dans le presse-papiers', 'success');
    } catch {
      notify('Impossible d’accéder au presse-papiers', 'error');
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        settings?: Partial<AppSettings>;
      } & Partial<AppSettings>;
      const candidate =
        parsed && typeof parsed === 'object' && parsed.settings
          ? parsed.settings
          : parsed;
      const sanitized = sanitizeAppSettings(candidate);
      patchSettings(sanitized, `Import JSON (${file.name})`);
      notify(`Configuration importée depuis ${file.name}`, 'success');
    } catch {
      notify('Fichier JSON invalide ou corrompu', 'error');
      addLog('Échec de l’importation du fichier de configuration JSON', 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Path MTU Discovery Probe
  const handleRunMtuProbe = async () => {
    if (isMtuProbing) return;
    setIsMtuProbing(true);
    await new Promise((r) => setTimeout(r, 650));
    const overhead =
      settings.protocol === 'wireguard'
        ? 80
        : settings.protocol === 'ikev2'
          ? 76
          : 69;
    const optimal =
      settings.protocol === 'wireguard'
        ? 1420
        : settings.protocol === 'ikev2'
          ? 1400
          : 1380;
    const fragmented = settings.mtuSize + overhead > 1500;
    setMtuProbeResult({
      optimalMtu: optimal,
      overheadBytes: overhead,
      payloadBytes: settings.mtuSize - 28,
      fragmented,
    });
    setIsMtuProbing(false);
    addLog(
      `Sonde Path-MTU terminée (${settings.protocol.toUpperCase()}) : optimal ${optimal} octets`,
      fragmented ? 'warning' : 'success'
    );
  };

  // Split Tunneling Rule Actions
  const handleAddSplitRule = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = splitTarget.trim();
    if (!clean) return;
    if (
      settings.splitTunnelRules.some(
        (r) => r.target.toLowerCase() === clean.toLowerCase()
      )
    ) {
      notify('Cette règle existe déjà dans le routage sélectif', 'warning');
      return;
    }
    const newRule: SplitTunnelRule = {
      id: `st-${Date.now().toString(36)}`,
      target: clean,
      type: splitType,
      policy: splitPolicy,
      enabled: true,
    };
    updateSettings('splitTunnelRules', [
      newRule,
      ...settings.splitTunnelRules,
    ]);
    setSplitTarget('');
    addLog(
      `Règle Split Tunnel ajoutée : ${clean} (${splitPolicy === 'bypass' ? 'Hors VPN' : 'Forcé VPN'})`,
      'info'
    );
  };

  const handleToggleSplitRule = (ruleId: string) => {
    updateSettings(
      'splitTunnelRules',
      settings.splitTunnelRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      )
    );
  };

  const handleRemoveSplitRule = (ruleId: string) => {
    updateSettings(
      'splitTunnelRules',
      settings.splitTunnelRules.filter((r) => r.id !== ruleId)
    );
  };

  // SOCKS5 Socket Test
  const handleTestSocks5 = async () => {
    if (isSocksTesting) return;
    setIsSocksTesting(true);
    await new Promise((r) => setTimeout(r, 550));
    const hostOk =
      settings.socks5Host.trim().length >= 3 &&
      !settings.socks5Host.includes(' ');
    const portOk = settings.socks5Port >= 1 && settings.socks5Port <= 65535;
    if (!hostOk || !portOk) {
      setSocksTestResult({
        ok: false,
        latencyMs: 0,
        message: 'Hôte ou port SOCKS5 hors plage valide (1–65535).',
      });
    } else {
      const rtt = Math.max(
        2,
        (isConnected ? currentIdentity.latency : 4) +
          Math.floor(Math.random() * 6)
      );
      setSocksTestResult({
        ok: true,
        latencyMs: rtt,
        message: `Socket SOCKS5v5 prêt sur ${settings.socks5Host}:${settings.socks5Port} (Auth: No-Auth / Loopback isolé)`,
      });
      addLog(
        `Test proxy SOCKS5 validé sur ${settings.socks5Host}:${settings.socks5Port} (${rtt} ms)`,
        'success'
      );
    }
    setIsSocksTesting(false);
  };

  // DNS Benchmark
  const handleRunDnsBenchmark = async () => {
    if (isDnsBenchmarking) return;
    setIsDnsBenchmarking(true);
    const start = performance.now();
    let baseRtt = 18;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(
        'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
        {
          headers: { Accept: 'application/dns-json' },
          signal: ctrl.signal,
          cache: 'no-store',
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        baseRtt = Math.max(5, Math.round(performance.now() - start));
      }
    } catch {
      baseRtt = Math.max(9, currentIdentity.latency);
    }

    await new Promise((r) => setTimeout(r, 350));
    setDnsBenchResults({
      cloudflare: baseRtt,
      quad9: baseRtt + 5,
      opendns: baseRtt + 8,
      google: baseRtt + 3,
      custom: settings.customDnsServer.trim() ? baseRtt + 6 : 0,
    });
    setIsDnsBenchmarking(false);
    addLog(
      `Benchmark DNS terminé : Cloudflare ${baseRtt} ms · Quad9 ${baseRtt + 5} ms`,
      'info'
    );
  };

  // Custom Blocked Domains
  const handleAddBlockedDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newBlockedDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!cleaned || !cleaned.includes('.')) {
      notify('Veuillez saisir un nom de domaine valide (ex: tracker.exemple.fr)', 'warning');
      return;
    }
    if (settings.customBlockedDomains.includes(cleaned)) {
      notify('Ce domaine figure déjà dans la liste noire', 'info');
      return;
    }
    updateSettings('customBlockedDomains', [
      cleaned,
      ...settings.customBlockedDomains,
    ]);
    setNewBlockedDomain('');
    addLog(`Domaine ajouté au bouclier DNS : ${cleaned}`, 'success');
  };

  // Bridge Reachability Probe
  const handleTestVortexBridge = async () => {
    if (isBridgeTesting) return;
    setIsBridgeTesting(true);
    await new Promise((r) => setTimeout(r, 700));
    const bridgeLabel =
      settings.vortexBridge === 'none'
        ? 'Entrée Tor Directe'
        : settings.vortexBridge.toUpperCase();
    const extraRtt =
      settings.vortexBridge === 'meek-azure'
        ? 68
        : settings.vortexBridge === 'snowflake'
          ? 52
          : settings.vortexBridge === 'obfs4'
            ? 29
            : 14;
    const dpiResistance =
      settings.vortexBridge === 'none'
        ? 'Standard (visible aux pare-feux DPI stricts)'
        : settings.vortexBridge === 'obfs4'
          ? 'Élevée (entropie polymorphe anti-DPI)'
          : settings.vortexBridge === 'snowflake'
            ? 'Très élevée (flux WebRTC éphémère)'
            : 'Maximale (encapsulation HTTPS CDN)';
    setBridgeTestResult({
      bridge: bridgeLabel,
      rttMs: currentIdentity.latency + extraRtt,
      dpiResistance,
    });
    setIsBridgeTesting(false);
    addLog(
      `Sonde de pont Vortex (${bridgeLabel}) : joignable en ${currentIdentity.latency + extraRtt} ms`,
      'success'
    );
  };

  // Real-time RNC Yield Calculation (matches App.tsx & EarningsCard.tsx)
  const rncProjection = useMemo(() => {
    const baseRate =
      userPlan === 'elite' ? 0.00018 : userPlan === 'pro' ? 0.00006 : 0.00006;
    const intensityMult = 0.5 + settings.miningIntensity / 100;
    const iaMult = settings.yieldOptimizationIA ? 1.25 : 1.0;
    const typeMult =
      settings.contributionType === 'exit'
        ? 1.5
        : settings.contributionType === 'relay'
          ? 1.25
          : 1.0;
    const repMult = 1 + (Math.max(0, Math.min(100, reputation)) / 100) * 0.42;
    const loadBonus = 1 + 44 / 200;
    const perSec =
      settings.miningIntensity === 0
        ? 0
        : baseRate * intensityMult * iaMult * typeMult * repMult * loadBonus;
    return {
      perHour: perSec * 3600,
      perDay: perSec * 86400,
      totalMultiplier:
        settings.miningIntensity === 0
          ? 0
          : intensityMult * iaMult * typeMult * repMult,
    };
  }, [
    userPlan,
    reputation,
    settings.miningIntensity,
    settings.yieldOptimizationIA,
    settings.contributionType,
  ]);

  // Global Search Directory across all Settings
  const searchableDirectory = useMemo<SearchableSettingItem[]>(
    () => [
      {
        id: 'proto',
        title: 'Protocole de tunnel & Port de transport',
        description: 'WireGuard, OpenVPN ou IKEv2 et sélection du port réseau (51820, 443, 1194).',
        tab: 'general',
        tabLabel: 'Réseau & Tunnel',
        keywords: ['wireguard', 'openvpn', 'ikev2', 'protocole', 'port', '443', 'udp', 'tcp'],
        currentValue: `${settings.protocol.toUpperCase()} :${settings.tunnelPort}`,
      },
      {
        id: 'mtu',
        title: 'Taille de segment MTU & Sonde Path-MTU',
        description: 'Ajustement de la taille maximale des paquets (1280–1500 octets) anti-fragmentation.',
        tab: 'general',
        tabLabel: 'Réseau & Tunnel',
        keywords: ['mtu', 'paquets', 'fragmentation', 'octets', 'latence'],
        currentValue: `${settings.mtuSize} octets`,
      },
      {
        id: 'autoconnect',
        title: 'Connexion au démarrage & Reconnexion automatique',
        description: 'Ouverture automatique du tunnel et reprise après micro-coupure réseau.',
        tab: 'general',
        tabLabel: 'Réseau & Tunnel',
        keywords: ['auto', 'démarrage', 'reconnexion', 'délai', 'coupure'],
        currentValue: settings.autoReconnect ? `Actif (${settings.reconnectDelay}s)` : 'Inactif',
      },
      {
        id: 'splittunnel',
        title: 'Split Tunneling (Routage sélectif)',
        description: 'Exclure ou forcer certains domaines, sous-réseaux CIDR ou applications dans le VPN.',
        tab: 'general',
        tabLabel: 'Réseau & Tunnel',
        keywords: ['split', 'tunneling', 'bypass', 'domaine', 'cidr', 'lan', 'imprimante'],
        currentValue: settings.splitTunneling
          ? `${settings.splitTunnelRules.filter((r) => r.enabled).length} règles actives`
          : 'Désactivé',
      },
      {
        id: 'socks5',
        title: 'Proxy SOCKS5 local / passerelle',
        description: 'Configuration de l’hôte, du port et test de connectivité socket SOCKS5.',
        tab: 'general',
        tabLabel: 'Réseau & Tunnel',
        keywords: ['socks5', 'proxy', '1080', '127.0.0.1', 'socket'],
        currentValue: settings.socks5Enabled
          ? `${settings.socks5Host}:${settings.socks5Port}`
          : 'Désactivé',
      },
      {
        id: 'dns',
        title: 'Résolveur DNS chiffré & Benchmark DoH',
        description: 'Cloudflare, Quad9, OpenDNS, Google ou serveur DoH/IPv4 personnalisé.',
        tab: 'security',
        tabLabel: 'Bouclier & DNS',
        keywords: ['dns', 'cloudflare', 'quad9', 'opendns', 'google', 'doh', '1.1.1.1', '9.9.9.9'],
        currentValue: settings.dns.toUpperCase(),
      },
      {
        id: 'leaks',
        title: 'Protection anti-fuite DNS, IPv6 & WebRTC',
        description: 'Verrouillage EDNS0, neutralisation de la pile IPv6 et blocage STUN/ICE WebRTC.',
        tab: 'security',
        tabLabel: 'Bouclier & DNS',
        keywords: ['fuite', 'leak', 'ipv6', 'webrtc', 'stun', 'aaaa'],
        currentValue:
          settings.dnsLeakProtection &&
          settings.ipv6LeakProtection &&
          settings.webrtcLeakShield
            ? 'Protection intégrale'
            : 'Partielle',
      },
      {
        id: 'killswitch',
        title: 'Coupe-circuit réseau (Kill Switch Strict / Souple)',
        description: 'Bloque tout trafic hors tunnel en cas de rupture de liaison VPN.',
        tab: 'security',
        tabLabel: 'Bouclier & DNS',
        keywords: ['kill', 'switch', 'coupe-circuit', 'urgence', 'strict', 'blocage'],
        currentValue: settings.killSwitch
          ? `Actif (${settings.killSwitchMode})`
          : 'Désactivé',
      },
      {
        id: 'blocker',
        title: 'Filtrage anti-traqueurs, Malware & Liste noire DNS',
        description: 'Bloque publicités, télémétrie, phishing, cryptomineurs et domaines personnalisés.',
        tab: 'security',
        tabLabel: 'Bouclier & DNS',
        keywords: ['pub', 'adblocker', 'traqueurs', 'malware', 'phishing', 'domaines', 'cache'],
        currentValue: settings.adBlocker ? 'Bouclier actif' : 'Inactif',
      },
      {
        id: 'rotation',
        title: 'Rotation dynamique IP / MAC / User-Agent',
        description: 'Cycle automatique de re-numérotation d’identité et brouillage matériel.',
        tab: 'renumbering',
        tabLabel: 'Identité & Morphing',
        keywords: ['rotation', 'mac', 'user-agent', 'identite', 'morphing', 'obfuscation'],
        currentValue: settings.autoRotation
          ? `Toutes les ${settings.rotationInterval} min`
          : 'Manuelle',
      },
      {
        id: 'fingerprint',
        title: 'Protection Anti-Fingerprinting (Canvas, WebGL, Fuseau)',
        description: 'Injection de bruit Canvas/Audio et synchronisation du fuseau horaire.',
        tab: 'renumbering',
        tabLabel: 'Identité & Morphing',
        keywords: ['canvas', 'webgl', 'audio', 'timezone', 'fuseau', 'empreinte', 'fingerprint'],
        currentValue: settings.fingerprintProtection.canvasNoise ? 'Actif' : 'Standard',
      },
      {
        id: 'vortex',
        title: 'Ponts Onion Vortex & Alliances 5/14-Eyes',
        description: 'Ponts OBFS4/Snowflake/Meek, longueur de circuit et exclusion des juridictions de surveillance.',
        tab: 'vortex',
        tabLabel: 'Onion Vortex',
        keywords: ['vortex', 'tor', 'onion', 'obfs4', 'snowflake', 'meek', '14-eyes', '5-eyes', 'juridiction'],
        currentValue: `${settings.vortexCircuitLength} sauts · ${settings.excludeEyesJurisdictions === 'none' ? 'Global' : `Hors ${settings.excludeEyesJurisdictions}`}`,
      },
      {
        id: 'rnc',
        title: 'Monétisation RNC & Retrait automatique',
        description: 'Intensité de relayage, optimiseur IA et seuil de virement automatique RNC.',
        tab: 'earnings',
        tabLabel: 'Gains RNC',
        keywords: ['rnc', 'gains', 'mining', 'retrait', 'portefeuille', 'intensité', 'ia'],
        currentValue: `${settings.miningIntensity}% · ${settings.contributionType.toUpperCase()}`,
      },
      {
        id: 'profiles',
        title: 'Profils personnalisés, Import / Export JSON & Reset',
        description: 'Sauvegardez vos configurations, exportez en JSON ou réinitialisez par défaut.',
        tab: 'wizard',
        tabLabel: 'Profils & Sauvegarde',
        keywords: ['profil', 'preset', 'export', 'import', 'json', 'sauvegarde', 'reset', 'usine'],
        currentValue: `${savedProfiles.length} profil(s)`,
      },
      {
        id: 'system',
        title: 'Thème, Raccourcis clavier & Rétention des journaux',
        description: 'Mode sombre/clair, raccourcis Ctrl+S/R/K et purge automatique Zero-Trace.',
        tab: 'system',
        tabLabel: 'Système & Purge',
        keywords: ['thème', 'sombre', 'clair', 'clavier', 'raccourcis', 'logs', 'journaux', 'purge', 'historique'],
        currentValue:
          settings.logRetentionHours === 0
            ? 'RAM Volatile (0h)'
            : `Rétention ${settings.logRetentionHours}h`,
      },
    ],
    [settings, savedProfiles.length]
  );

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchableDirectory.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tabLabel.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q))
    );
  }, [searchQuery, searchableDirectory]);

  const dnsProviders: Array<{
    id: AppSettings['dns'];
    label: string;
    ip: string;
    protocol: string;
  }> = [
    { id: 'cloudflare', label: 'Cloudflare', ip: '1.1.1.1', protocol: 'DoH Zero-Log' },
    { id: 'quad9', label: 'Quad9 Suisse', ip: '9.9.9.9', protocol: 'DoH Malware-Block' },
    { id: 'opendns', label: 'OpenDNS', ip: '208.67.222.222', protocol: 'DNSCrypt' },
    { id: 'google', label: 'Google DNS', ip: '8.8.8.8', protocol: 'DoT Anycast' },
    { id: 'custom', label: 'Personnalisé', ip: 'DoH / IPv4', protocol: 'Privé' },
  ];

  const customDnsValid =
    settings.dns !== 'custom' || isValidCustomDns(settings.customDnsServer);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-6xl h-[90vh] max-h-[860px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-72 bg-slate-50 dark:bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          {/* Header Brand & Hardening Score */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-600/10 dark:bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-600 dark:text-cyan-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Paramètres avancés
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Moteur & Sécurité VPN
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Security Hardening Posture */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Indice de durcissement
                </span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    hardeningScore >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : hardeningScore >= 55
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {hardeningScore}/100
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    hardeningScore >= 80
                      ? 'bg-emerald-500'
                      : hardeningScore >= 55
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${hardeningScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex md:flex-col overflow-x-auto md:overflow-y-auto p-3 gap-1 flex-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id && !searchQuery.trim();
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                  className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span>{tab.label}</span>
                  </span>
                  {tab.badge && (
                    <span
                      className={`font-mono tabular-nums text-[11px] px-2 py-0.5 rounded-md ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Plan & Quick Export Strip */}
          <div className="hidden md:flex flex-col gap-2.5 p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Licence active
                </div>
                <div className="text-xs font-bold uppercase text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Forfait {userPlan}</span>
                </div>
              </div>
              {!isPremium ? (
                <button
                  type="button"
                  onClick={onShowPricing}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Évoluer
                </button>
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </div>
          </div>
        </aside>

        {/* Right Workspace Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Search & Action Bar */}
          <div className="px-5 sm:px-7 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un réglage (MTU, Split Tunnel, DNS, SOCKS5, 14-Eyes...)"
                className="w-full pl-10 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-cyan-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-cyan-500/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Exporter la configuration JSON"
              >
                <Download className="w-3.5 h-3.5 text-cyan-500" />
                <span className="hidden sm:inline">Exporter JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-cyan-500/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Importer un fichier de configuration JSON"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-500" />
                <span className="hidden sm:inline">Importer</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJson}
                className="hidden"
              />

              <button
                type="button"
                onClick={onClose}
                className="hidden md:inline-flex p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fermer les paramètres"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Notification Banner */}
          {statusFeedback && (
            <div
              className={`mx-5 sm:mx-7 mt-4 px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
                statusFeedback.tone === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : statusFeedback.tone === 'error'
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300'
                    : statusFeedback.tone === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                      : 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300'
              }`}
            >
              <span>{statusFeedback.message}</span>
              <button
                type="button"
                onClick={() => setStatusFeedback(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
            {/* Quick Presets Bar (visible when not searching) */}
            {!searchQuery.trim() && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Préréglages tactiques instantanés
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                     Sauvegarde automatique active
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PRESET_DEFINITIONS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 text-left transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {preset.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {preset.subtitle}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* GLOBAL SEARCH RESULTS VIEW */}
            {searchQuery.trim() ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Résultats pour « {searchQuery.trim()} » ({searchMatches.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Fermer la recherche
                  </button>
                </div>

                {searchMatches.length === 0 ? (
                  <div className="p-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <Search className="w-7 h-7 text-slate-400 mx-auto" />
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Aucun paramètre ne correspond à « {searchQuery} »
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Essayez un terme technique comme MTU, WireGuard, Split Tunnel, DNS, WebRTC, SOCKS5, 14-Eyes ou RNC.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Réinitialiser le filtre
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                    {searchMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.tab);
                          setSearchQuery('');
                        }}
                        className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">
                              · {item.tabLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono tabular-nums text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {item.currentValue}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* TAB 1: RÉSEAU & TUNNEL */}
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Transport réseau, Split Tunneling & Proxy SOCKS5
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Configurez l'encapsulation protocolaire, le port de sortie, le calibrage Path-MTU et les règles de routage sélectif.
                      </p>
                    </div>

                    {/* Protocol & Port Selection */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-5">
                      <div className="space-y-2.5">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-cyan-500" />
                          Protocole d'encapsulation
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {(
                            [
                              {
                                id: 'wireguard',
                                title: 'WireGuard',
                                desc: 'ChaCha20-Poly1305 · Latence minimale',
                                defaultPort: 51820 as const,
                              },
                              {
                                id: 'openvpn',
                                title: 'OpenVPN',
                                desc: 'AES-256-GCM · Contournement pare-feu TCP/UDP',
                                defaultPort: 443 as const,
                              },
                              {
                                id: 'ikev2',
                                title: 'IKEv2 / IPsec',
                                desc: 'MOBIKE · Bascule Wi-Fi / 5G sans coupure',
                                defaultPort: 500 as const,
                              },
                            ] as const
                          ).map((proto) => {
                            const selected = settings.protocol === proto.id;
                            return (
                              <button
                                key={proto.id}
                                type="button"
                                onClick={() =>
                                  patchSettings(
                                    {
                                      protocol: proto.id,
                                      tunnelPort: proto.defaultPort,
                                    },
                                    `Protocole basculé sur ${proto.title} (:${proto.defaultPort})`
                                  )
                                }
                                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                                  selected
                                    ? 'bg-cyan-600/10 dark:bg-cyan-500/15 border-cyan-500 text-slate-900 dark:text-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold">
                                    {proto.title}
                                  </span>
                                  {selected && (
                                    <Check className="w-4 h-4 text-cyan-500" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                  {proto.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Port Selector */}
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Port de transport distant
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Utilisez le port <span className="font-mono">443</span> pour traverser les réseaux d'entreprise ou d'hôtels restrictifs.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {([51820, 443, 1194, 500, 8443] as const).map((port) => (
                            <button
                              key={port}
                              type="button"
                              onClick={() => updateSettings('tunnelPort', port)}
                              className={`px-3 py-1.5 rounded-lg font-mono tabular-nums text-xs font-bold border transition-colors cursor-pointer ${
                                settings.tunnelPort === port
                                  ? 'bg-cyan-600 text-white border-cyan-600'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500/50'
                              }`}
                            >
                              :{port}
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* MTU Calibration & Interactive Path-MTU Probe */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <ArrowRightLeft className="w-4 h-4 text-cyan-500" />
                            Calibrage MTU & Sonde anti-fragmentation
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Plage autorisée : <span className="font-mono tabular-nums">1280</span> à <span className="font-mono tabular-nums">1500</span> octets.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRunMtuProbe}
                            disabled={isMtuProbing}
                            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            {isMtuProbing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isMtuProbing ? 'Sondage MTU...' : 'Tester Path-MTU'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={1280}
                          max={1500}
                          step={10}
                          value={settings.mtuSize}
                          onChange={(e) =>
                            updateSettings('mtuSize', Number(e.target.value))
                          }
                          className="flex-1 accent-cyan-600 cursor-pointer"
                        />
                        <input
                          type="number"
                          min={1280}
                          max={1500}
                          value={settings.mtuSize}
                          onChange={(e) =>
                            updateSettings(
                              'mtuSize',
                              Math.min(
                                1500,
                                Math.max(1280, Number(e.target.value) || 1420)
                              )
                            )
                          }
                          className="w-24 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-xs font-bold text-center text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                        />
                        <span className="text-xs font-mono text-slate-500">
                          octets
                        </span>
                      </div>

                      {mtuProbeResult && (
                        <div
                          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            mtuProbeResult.fragmented
                              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-300'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                          }`}
                        >
                          <div className="font-mono tabular-nums">
                            Charge utile : {mtuProbeResult.payloadBytes}B · En-tête{' '}
                            {settings.protocol.toUpperCase()} : +
                            {mtuProbeResult.overheadBytes}B ·{' '}
                            {mtuProbeResult.fragmented
                              ? `Risque de fragmentation (>1500B)`
                              : `Aucune fragmentation détectée`}
                          </div>
                          {settings.mtuSize !== mtuProbeResult.optimalMtu && (
                            <button
                              type="button"
                              onClick={() => {
                                updateSettings(
                                  'mtuSize',
                                  mtuProbeResult.optimalMtu
                                );
                                notify(
                                  `MTU calibré à ${mtuProbeResult.optimalMtu} octets`,
                                  'success'
                                );
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs whitespace-nowrap cursor-pointer"
                            >
                              Appliquer {mtuProbeResult.optimalMtu}B
                            </button>
                          )}
                        </div>
                      )}
                    </section>

                    {/* Auto-Connect, Auto-Reconnect & Local LAN */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 divide-y divide-slate-200 dark:divide-slate-800">
                      <div className="pb-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Connexion automatique à l'ouverture de session
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Établit immédiatement le tunnel sécurisé dès l'authentification utilisateur.
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.autoConnect}
                          onChange={(v) => updateSettings('autoConnect', v)}
                          ariaLabel="Connexion automatique"
                        />
                      </div>

                      <div className="py-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Reconnexion automatique sur perte de porteuse
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Relance le tunnel après un délai tampon en cas d'instabilité réseau.
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={settings.autoReconnect}
                            onChange={(v) => updateSettings('autoReconnect', v)}
                            ariaLabel="Reconnexion automatique"
                          />
                        </div>

                        {settings.autoReconnect && (
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                Délai avant reprise :
                              </span>
                              {[1, 3, 5, 10, 15].map((sec) => (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() =>
                                    updateSettings('reconnectDelay', sec)
                                  }
                                  className={`px-2.5 py-1 rounded-lg font-mono tabular-nums text-xs font-semibold border cursor-pointer ${
                                    settings.reconnectDelay === sec
                                      ? 'bg-cyan-600 text-white border-cyan-600'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {sec}s
                                </button>
                              ))}
                            </div>

                            {isConnected && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSimulateReconnect();
                                  notify(
                                    `Simulation de bascule déclenchée (reprise sous ${settings.reconnectDelay}s)`,
                                    'info'
                                  );
                                }}
                                className="px-3 py-1.5 rounded-lg border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 text-xs font-semibold cursor-pointer"
                              >
                                Tester la reconnexion
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Accès direct au réseau local (LAN Bypass)
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Autorise les imprimantes, NAS et passerelles <span className="font-mono">192.168.x.x</span>.
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={settings.lanBypass}
                            onChange={(v) => updateSettings('lanBypass', v)}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Découverte & partage P2P local
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Autorise mDNS / AirDrop / partage local pendant la session VPN.
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={settings.localNetworkSharing}
                            onChange={(v) =>
                              updateSettings('localNetworkSharing', v)
                            }
                          />
                        </div>
                      </div>
                    </section>

                    {/* Split Tunneling Rule Engine */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            Split Tunneling (Routage sélectif par règle)
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Définissez quels domaines, sous-réseaux CIDR ou applications contournent ou exigent le tunnel.
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.splitTunneling}
                          onChange={(v) => updateSettings('splitTunneling', v)}
                          accent="emerald"
                        />
                      </div>

                      {settings.splitTunneling && (
                        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <form
                            onSubmit={handleAddSplitRule}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-2"
                          >
                            <select
                              value={splitType}
                              onChange={(e) =>
                                setSplitType(
                                  e.target.value as SplitTunnelRule['type']
                                )
                              }
                              className="sm:col-span-3 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                            >
                              <option value="domain">Domaine</option>
                              <option value="cidr">Sous-réseau CIDR</option>
                              <option value="app">Application</option>
                            </select>

                            <input
                              type="text"
                              value={splitTarget}
                              onChange={(e) => setSplitTarget(e.target.value)}
                              placeholder={
                                splitType === 'cidr'
                                  ? 'Ex: 10.0.0.0/8'
                                  : splitType === 'app'
                                    ? 'Ex: Steam / Docker'
                                    : 'Ex: banque-locale.fr'
                              }
                              className="sm:col-span-4 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                            />

                            <select
                              value={splitPolicy}
                              onChange={(e) =>
                                setSplitPolicy(
                                  e.target.value as SplitTunnelRule['policy']
                                )
                              }
                              className="sm:col-span-3 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                            >
                              <option value="bypass">Hors VPN (Direct)</option>
                              <option value="vpn_only">Forcer le VPN</option>
                            </select>

                            <button
                              type="submit"
                              className="sm:col-span-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Ajouter</span>
                            </button>
                          </form>

                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                            {settings.splitTunnelRules.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500">
                                Aucune règle définie. Ajoutez un domaine ou CIDR ci-dessus.
                              </div>
                            ) : (
                              settings.splitTunnelRules.map((rule) => (
                                <div
                                  key={rule.id}
                                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={rule.enabled}
                                      onChange={() =>
                                        handleToggleSplitRule(rule.id)
                                      }
                                      className="accent-cyan-600 rounded cursor-pointer"
                                    />
                                    <span
                                      className={`font-mono truncate ${
                                        rule.enabled
                                          ? 'text-slate-900 dark:text-white font-semibold'
                                          : 'text-slate-400 line-through'
                                      }`}
                                    >
                                      {rule.target}
                                    </span>
                                    <span className="text-[11px] text-slate-400 uppercase">
                                      {rule.type}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <span
                                      className={`text-[11px] font-semibold ${
                                        rule.policy === 'bypass'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {rule.policy === 'bypass'
                                        ? 'Hors VPN'
                                        : 'Tunnel forcé'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveSplitRule(rule.id)
                                      }
                                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                                      title="Supprimer la règle"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* SOCKS5 Proxy */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            Passerelle Proxy SOCKS5v5
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Expose un relais local SOCKS5 pour acheminer un navigateur ou client CLI dans le tunnel.
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.socks5Enabled}
                          onChange={(v) => updateSettings('socks5Enabled', v)}
                          accent="emerald"
                        />
                      </div>

                      {settings.socks5Enabled && (
                        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                                Adresse d'écoute (Host)
                              </label>
                              <input
                                type="text"
                                value={settings.socks5Host}
                                onChange={(e) =>
                                  updateSettings('socks5Host', e.target.value)
                                }
                                placeholder="127.0.0.1"
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                                Port TCP (1–65535)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={65535}
                                value={settings.socks5Port}
                                onChange={(e) =>
                                  updateSettings(
                                    'socks5Port',
                                    Number(e.target.value) || 1080
                                  )
                                }
                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <button
                                type="button"
                                onClick={handleTestSocks5}
                                disabled={isSocksTesting}
                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                {isSocksTesting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Activity className="w-3.5 h-3.5" />
                                )}
                                <span>Tester</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard
                                    ?.writeText(
                                      `socks5h://${settings.socks5Host}:${settings.socks5Port}`
                                    )
                                    .then(() =>
                                      notify('URI socks5h:// copiée', 'success')
                                    )
                                    .catch(() => {});
                                }}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-emerald-500 cursor-pointer"
                                title="Copier l'URI socks5h://"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {socksTestResult && (
                            <div
                              className={`p-3 rounded-xl border text-xs font-mono tabular-nums ${
                                socksTestResult.ok
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300'
                              }`}
                            >
                              {socksTestResult.message}
                              {socksTestResult.ok
                                ? ` · RTT ${socksTestResult.latencyMs} ms`
                                : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* TAB 2: BOUCLIER & DNS */}
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Bouclier DNS, Étanchéité IPv6/WebRTC & Coupe-circuit
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Sélectionnez votre résolveur chiffré, filtrez les domaines hostiles et calibrez le Kill Switch matériel.
                      </p>
                    </div>

                    {/* DNS Provider & Benchmark */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Server className="w-4 h-4 text-cyan-500" />
                            Résolveur DNS sécurisé (DoH / DoT / DNSCrypt)
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Toutes les requêtes DNS sont routées à travers le résolveur choisi lorsque le bouclier est actif.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRunDnsBenchmark}
                          disabled={isDnsBenchmarking}
                          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          {isDnsBenchmarking ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isDnsBenchmarking
                              ? 'Mesure RTT...'
                              : 'Benchmark latence DNS'}
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {dnsProviders.map((prov) => {
                          const selected = settings.dns === prov.id;
                          const bench = dnsBenchResults[prov.id];
                          return (
                            <button
                              key={prov.id}
                              type="button"
                              onClick={() => updateSettings('dns', prov.id)}
                              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-cyan-600/10 dark:bg-cyan-500/15 border-cyan-500 text-slate-900 dark:text-white'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <div className="text-xs font-bold truncate">
                                {prov.label}
                              </div>
                              <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                                {prov.ip}
                              </div>
                              <div className="flex items-center justify-between mt-1.5 text-[10px]">
                                <span className="text-slate-400">
                                  {prov.protocol}
                                </span>
                                {bench ? (
                                  <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                                    {bench}ms
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {settings.dns === 'custom' && (
                        <div className="pt-2 space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                            Adresse IPv4 ou endpoint HTTPS DoH personnalisé
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={settings.customDnsServer}
                              onChange={(e) =>
                                updateSettings(
                                  'customDnsServer',
                                  e.target.value
                                )
                              }
                              placeholder="Ex: 94.140.14.14 ou https://dns.quad9.net/dns-query"
                              className={`flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border font-mono text-xs text-slate-900 dark:text-white outline-none ${
                                customDnsValid
                                  ? 'border-slate-200 dark:border-slate-700 focus:border-cyan-500'
                                  : 'border-red-500'
                              }`}
                            />
                            <span
                              className={`text-xs font-semibold whitespace-nowrap ${
                                customDnsValid && settings.customDnsServer.trim()
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {customDnsValid && settings.customDnsServer.trim()
                                ? 'Format valide'
                                : 'IPv4 / https:// requis'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Smart DNS Cache + Flush */}
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <ToggleSwitch
                            checked={settings.dnsCache}
                            onChange={(v) => updateSettings('dnsCache', v)}
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Cache DNS local chiffré
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Réduit l'empreinte temporelle des résolutions répétées.
                              {lastDnsFlushInfo ? ` · ${lastDnsFlushInfo}` : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const flushed = onFlushDnsCache();
                            const stamp = new Date().toLocaleTimeString('fr-FR');
                            setLastDnsFlushInfo(
                              `${flushed} entrées purgées à ${stamp}`
                            );
                            notify(
                              `Cache DNS vidé (${flushed} enregistrements supprimés)`,
                              'success'
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Vider le cache DNS</span>
                        </button>
                      </div>
                    </section>

                    {/* Leak Protections & Kill Switch */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 divide-y divide-slate-200 dark:divide-slate-800">
                      <div className="pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Anti-fuite DNS strict
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Bloque UDP/53 hors interface VPN.
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={settings.dnsLeakProtection}
                            onChange={(v) =>
                              updateSettings('dnsLeakProtection', v)
                            }
                            accent="emerald"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Garde-fou pile IPv6
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Neutralise SLAAC / Teredo / AAAA.
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={settings.ipv6LeakProtection}
                            onChange={(v) =>
                              updateSettings('ipv6LeakProtection', v)
                            }
                            accent="emerald"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Bouclier WebRTC STUN
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Masque l'IP LAN dans les candidats ICE.
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={settings.webrtcLeakShield}
                            onChange={(v) =>
                              updateSettings('webrtcLeakShield', v)
                            }
                            accent="emerald"
                          />
                        </div>
                      </div>

                      {/* Kill Switch Config + Live Trigger */}
                      <div className="pt-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                              <ShieldAlert className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                Coupe-circuit réseau (Kill Switch)
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Interrompt immédiatement le trafic sortant si le tunnel chiffré tombe.
                              </p>
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={settings.killSwitch}
                            onChange={(v) => updateSettings('killSwitch', v)}
                            accent="red"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2">
                            {(
                              [
                                {
                                  id: 'strict',
                                  label: 'Mode Strict (Verrouillage permanent)',
                                },
                                {
                                  id: 'soft',
                                  label: 'Mode Souple (Durant reconnexion)',
                                },
                              ] as const
                            ).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                disabled={!settings.killSwitch}
                                onClick={() =>
                                  updateSettings('killSwitchMode', m.id)
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-40 ${
                                  settings.killSwitchMode === m.id
                                    ? 'bg-red-600 text-white border-red-600'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={onToggleEmergency}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              isEmergency
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-white dark:bg-slate-900 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10'
                            }`}
                          >
                            {isEmergency
                              ? 'Désamorcer le coupe-circuit actif'
                              : 'Tester le verrouillage d’urgence'}
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* Granular Threat Blocker & Custom Domain Blocklist */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            Filtrage granulaire des menaces & listes noires DNS
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Intercepte les domaines malveillants directement au niveau du résolveur.
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.adBlocker}
                          onChange={(v) => updateSettings('adBlocker', v)}
                          accent="amber"
                        />
                      </div>

                      {settings.adBlocker && (
                        <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {(
                              [
                                { key: 'ads', label: 'Publicités' },
                                { key: 'trackers', label: 'Traqueurs' },
                                { key: 'malware', label: 'Malware / Phishing' },
                                { key: 'cryptominers', label: 'Cryptomineurs' },
                              ] as const
                            ).map((cat) => {
                              const active = settings.threatFilters[cat.key];
                              return (
                                <button
                                  key={cat.key}
                                  type="button"
                                  onClick={() =>
                                    updateSettings('threatFilters', {
                                      ...settings.threatFilters,
                                      [cat.key]: !active,
                                    })
                                  }
                                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer ${
                                    active
                                      ? 'bg-amber-500/10 border-amber-500/50 text-slate-900 dark:text-white'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                                  }`}
                                >
                                  <span className="truncate">{cat.label}</span>
                                  {active && (
                                    <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <form
                            onSubmit={handleAddBlockedDomain}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              value={newBlockedDomain}
                              onChange={(e) =>
                                setNewBlockedDomain(e.target.value)
                              }
                              placeholder="Ajouter un domaine à bloquer (ex: metrics.tracker.io)"
                              className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                            />
                            <button
                              type="submit"
                              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                            >
                              Bloquer
                            </button>
                          </form>

                          {settings.customBlockedDomains.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {settings.customBlockedDomains.map((dom) => (
                                <span
                                  key={dom}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300"
                                >
                                  <span>{dom}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSettings(
                                        'customBlockedDomains',
                                        settings.customBlockedDomains.filter(
                                          (d) => d !== dom
                                        )
                                      )
                                    }
                                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* TAB 3: IDENTITÉ & MORPHING */}
                {activeTab === 'renumbering' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Morphing d'identité matérielle & Anti-Fingerprinting
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Automatisez la rotation d'IP, le brouillage d'adresse MAC et les contre-mesures d'empreinte navigateur.
                      </p>
                    </div>

                    {/* Auto Rotation + Immediate Trigger */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500">
                            <RefreshCw className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              Rotation cyclique automatique (IP + MAC + User-Agent)
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Identité active : <span className="font-mono">{currentIdentity.ip}</span> · MAC <span className="font-mono">{currentIdentity.mac}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              onForceRotateIdentity();
                              notify(
                                'Rotation complète exécutée (IP, MAC & signature UA)',
                                'success'
                              );
                            }}
                            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Forcer une rotation</span>
                          </button>
                          <ToggleSwitch
                            checked={settings.autoRotation}
                            onChange={(v) => updateSettings('autoRotation', v)}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-500" />
                          Périodicité de rotation :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 5, 10, 15, 30, 60].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() =>
                                updateSettings('rotationInterval', mins)
                              }
                              className={`px-3 py-1.5 rounded-lg font-mono tabular-nums text-xs font-bold border cursor-pointer ${
                                settings.rotationInterval === mins
                                  ? 'bg-cyan-600 text-white border-cyan-600'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {mins} min
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* Obfuscation, MAC Generator & UA Complexity */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Niveau d'obfuscation matérielle
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                          {(
                            [
                              { id: 'standard', label: 'Standard' },
                              { id: 'high', label: 'Élevé (Padding)' },
                              { id: 'ultra', label: 'Polymorphe Ultra' },
                            ] as const
                          ).map((lvl) => (
                            <button
                              key={lvl.id}
                              type="button"
                              onClick={() =>
                                updateSettings('obfuscationLevel', lvl.id)
                              }
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                settings.obfuscationLevel === lvl.id
                                  ? 'bg-cyan-600 text-white border-cyan-600'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {lvl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Mode & format d'adresse MAC
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                onScrambleMac();
                                notify('Nouvelle adresse MAC générée', 'success');
                              }}
                              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                            >
                              Régénérer ({currentIdentity.mac})
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                { id: 'vendor', label: 'OUI Réel' },
                                { id: 'laa', label: 'Locale LAA' },
                                { id: 'random', label: 'Aléatoire' },
                              ] as const
                            ).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() =>
                                  updateSettings('macScramblingMode', m.id)
                                }
                                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  settings.macScramblingMode === m.id
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 pt-1">
                            {(
                              [
                                { id: 'standard', label: 'AA:BB' },
                                { id: 'hyphen', label: 'AA-BB' },
                                { id: 'cisco', label: 'aaaa.bb' },
                                { id: 'random', label: 'Mixte' },
                              ] as const
                            ).map((fmt) => (
                              <button
                                key={fmt.id}
                                type="button"
                                onClick={() =>
                                  updateSettings('macFormat', fmt.id)
                                }
                                className={`py-1.5 rounded-lg font-mono text-[11px] font-semibold border cursor-pointer ${
                                  settings.macFormat === fmt.id
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                                }`}
                              >
                                {fmt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            Complexité de rotation User-Agent
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                { id: 'standard', label: 'Bureau' },
                                { id: 'diverse', label: 'Diversifiée' },
                                { id: 'chaotic', label: 'Chaotique' },
                              ] as const
                            ).map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() =>
                                  updateSettings('uaComplexity', u.id)
                                }
                                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  settings.uaComplexity === u.id
                                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {u.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-500 pt-1">
                            Signature actuelle :{' '}
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {currentIdentity.userAgentShort}
                            </span>
                          </p>
                        </div>
                      </div>
                    </section>

                    {/* Browser Anti-Fingerprinting Matrix */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Contre-mesures d'empreinte navigateur (Anti-Fingerprinting)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(
                          [
                            {
                              key: 'canvasNoise',
                              title: 'Bruit entropique HTML5 Canvas',
                              desc: 'Altère subtilement les pixels lus par toDataURL().',
                            },
                            {
                              key: 'webglMask',
                              title: 'Masquage du rendu GPU WebGL',
                              desc: 'Normalise les constantes UNMASKED_RENDERER_WEBGL.',
                            },
                            {
                              key: 'audioContextSpoof',
                              title: 'Protection AudioContext',
                              desc: 'Neutralise le profilage acoustique par oscillateur.',
                            },
                            {
                              key: 'timezoneSync',
                              title: 'Alignement automatique du fuseau horaire',
                              desc: `Synchronise l'horloge locale avec la sortie (${currentIdentity.timezone}).`,
                            },
                          ] as const
                        ).map((fp) => (
                          <div
                            key={fp.key}
                            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {fp.title}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {fp.desc}
                              </p>
                            </div>
                            <ToggleSwitch
                              checked={settings.fingerprintProtection[fp.key]}
                              onChange={(val) =>
                                updateSettings('fingerprintProtection', {
                                  ...settings.fingerprintProtection,
                                  [fp.key]: val,
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* TAB 4: ONION VORTEX & JURIDICTIONS */}
                {activeTab === 'vortex' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Routage Onion Vortex & Exclusion des alliances 5/14-Eyes
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Configurez les ponts anti-censure, le nombre de sauts chiffrés et filtrez les juridictions de surveillance.
                      </p>
                    </div>

                    {/* Surveillance Alliance Exclusion Filter */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <EyeOff className="w-4 h-4 text-purple-500" />
                            Politique d'exclusion des juridictions de renseignement
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Masque automatiquement les serveurs situés dans les pays membres sur le tableau de bord.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {(
                          [
                            {
                              id: 'none',
                              label: 'Aucune exclusion',
                              desc: 'Tous les relais mondiaux disponibles',
                            },
                            {
                              id: '5-eyes',
                              label: 'Exclure 5-Eyes',
                              desc: `Exclut : ${EYES_5_COUNTRIES.slice(0, 3).join(', ')}...`,
                            },
                            {
                              id: '14-eyes',
                              label: 'Exclure 14-Eyes (Strict)',
                              desc: 'Privilégie Suisse, Islande, Panama, Estonie, Singapour',
                            },
                          ] as const
                        ).map((pol) => (
                          <button
                            key={pol.id}
                            type="button"
                            onClick={() =>
                              updateSettings('excludeEyesJurisdictions', pol.id)
                            }
                            className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                              settings.excludeEyesJurisdictions === pol.id
                                ? 'bg-purple-600/10 dark:bg-purple-500/15 border-purple-500 text-slate-900 dark:text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">
                                {pol.label}
                              </span>
                              {settings.excludeEyesJurisdictions === pol.id && (
                                <Check className="w-4 h-4 text-purple-500" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">
                              {pol.desc}
                            </p>
                          </button>
                        ))}
                      </div>

                      {settings.excludeEyesJurisdictions !== 'none' && (
                        <div className="text-[11px] text-purple-700 dark:text-purple-300 font-mono">
                          Juridictions filtrées :{' '}
                          {(settings.excludeEyesJurisdictions === '14-eyes'
                            ? EYES_14_COUNTRIES
                            : EYES_5_COUNTRIES
                          ).join(', ')}
                        </div>
                      )}
                    </section>

                    {/* Bridges + Probe */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Orbit className="w-4 h-4 text-purple-500" />
                          Pont de transport anti-DPI (Pluggable Transport)
                        </h4>
                        <button
                          type="button"
                          onClick={handleTestVortexBridge}
                          disabled={isBridgeTesting}
                          className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          {isBridgeTesting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>Tester le pont</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(
                          [
                            {
                              id: 'none',
                              label: 'Direct (Sans pont)',
                              desc: 'Débit maximal sur réseaux non filtrés',
                            },
                            {
                              id: 'obfs4',
                              label: 'OBFS4 Polymorphe',
                              desc: 'Offusque la signature TLS/Tor face au DPI',
                            },
                            {
                              id: 'snowflake',
                              label: 'Snowflake WebRTC',
                              desc: 'Pairs éphémères difficiles à bloquer par IP',
                            },
                            {
                              id: 'meek-azure',
                              label: 'Meek Domain-Fronting',
                              desc: 'Trafic indiscernable d’une requête HTTPS CDN',
                            },
                          ] as const
                        ).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => updateSettings('vortexBridge', b.id)}
                            className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                              settings.vortexBridge === b.id
                                ? 'bg-purple-600/10 dark:bg-purple-500/15 border-purple-500 text-slate-900 dark:text-white'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">{b.label}</span>
                              {settings.vortexBridge === b.id && (
                                <Check className="w-4 h-4 text-purple-500" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {b.desc}
                            </p>
                          </button>
                        ))}
                      </div>

                      {bridgeTestResult && (
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-xs font-mono tabular-nums text-purple-900 dark:text-purple-200">
                          {bridgeTestResult.bridge} joignable · RTT estimé :{' '}
                          {bridgeTestResult.rttMs} ms · Résistance :{' '}
                          {bridgeTestResult.dpiResistance}
                        </div>
                      )}
                    </section>

                    {/* Circuit Length, Entry/Exit & NoScript */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-500" />
                            Longueur du circuit en oignon
                          </span>
                          <span className="font-mono tabular-nums text-purple-600 dark:text-purple-400 font-bold">
                            {settings.vortexCircuitLength} sauts (+
                            {settings.vortexCircuitLength * 18} ms RTT estimé)
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[3, 4, 5, 6].map((hops) => (
                            <button
                              key={hops}
                              type="button"
                              onClick={() =>
                                updateSettings('vortexCircuitLength', hops)
                              }
                              className={`py-2 rounded-xl font-mono tabular-nums text-xs font-bold border cursor-pointer ${
                                settings.vortexCircuitLength === hops
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {hops} sauts
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <div>
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                            Juridiction d'entrée (Guard Node)
                          </label>
                          <select
                            value={settings.vortexEntryNodeCountry}
                            onChange={(e) =>
                              updateSettings(
                                'vortexEntryNodeCountry',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                          >
                            <option value="auto">Sélection automatique</option>
                            <option value="Suisse">Suisse (Hors UE)</option>
                            <option value="Islande">Islande</option>
                            <option value="Estonie">Estonie</option>
                            <option value="Allemagne">Allemagne</option>
                            <option value="France">France</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                            Juridiction de sortie (Exit Node)
                          </label>
                          <select
                            value={settings.vortexExitNodeCountry}
                            onChange={(e) =>
                              updateSettings(
                                'vortexExitNodeCountry',
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-200 outline-none"
                          >
                            <option value="auto">Rotation multi-juridictions</option>
                            <option value="Suisse">Suisse</option>
                            <option value="Islande">Islande</option>
                            <option value="Panama">Panama</option>
                            <option value="Singapour">Singapour</option>
                            <option value="USA">États-Unis</option>
                          </select>
                        </div>
                      </div>

                      {settings.vortexEntryNodeCountry !== 'auto' &&
                        settings.vortexEntryNodeCountry ===
                          settings.vortexExitNodeCountry && (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-300">
                            <span className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              Entrée et sortie dans la même juridiction ({settings.vortexEntryNodeCountry}) réduisent la séparation corrélationnelle.
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateSettings(
                                  'vortexExitNodeCountry',
                                  settings.vortexEntryNodeCountry === 'Suisse'
                                    ? 'Islande'
                                    : 'Suisse'
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold whitespace-nowrap cursor-pointer"
                            >
                              Séparer
                            </button>
                          </div>
                        )}

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Isolation stricte NoScript sur circuits .onion
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Désactive l'exécution d'API dynamiques risquées durant la navigation Vortex.
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={settings.vortexNoScript}
                          onChange={(v) => updateSettings('vortexNoScript', v)}
                          accent="purple"
                        />
                      </div>
                    </section>
                  </div>
                )}

                {/* TAB 5: GAINS RNC */}
                {activeTab === 'earnings' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Contribution réseau & Automatisation des gains RNC
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Ajustez la bande passante partagée, l'optimisation IA et le seuil de virement automatique.
                      </p>
                    </div>

                    {/* Live Yield Estimator */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Solde actuel
                        </div>
                        <div className="text-base font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
                          {balance.toFixed(4)} RNC
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Cadence horaire est.
                        </div>
                        <div className="text-base font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                          +{rncProjection.perHour.toFixed(3)} /h
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Projection 24h
                        </div>
                        <div className="text-base font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          +{rncProjection.perDay.toFixed(2)} RNC
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Multiplicateur actif
                        </div>
                        <div className="text-base font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                          x{rncProjection.totalMultiplier.toFixed(2)}
                        </div>
                      </div>
                    </section>

                    {(!isPremium || !isVerified) && (
                      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                        <span>
                          {!isPremium
                            ? 'Le minage de relais RNC en direct nécessite un forfait Pro ou Elite.'
                            : 'Validez votre preuve KYC dans la carte RNC pour débloquer l’accumulation.'}
                        </span>
                        {!isPremium && (
                          <button
                            type="button"
                            onClick={onShowPricing}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold cursor-pointer"
                          >
                            Voir les forfaits
                          </button>
                        )}
                      </div>
                    )}

                    {/* Intensity & Node Contribution Role */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-5">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            Intensité d'allocation bande passante
                          </span>
                          <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                            {settings.miningIntensity}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={settings.miningIntensity}
                          onChange={(e) =>
                            updateSettings(
                              'miningIntensity',
                              Number(e.target.value)
                            )
                          }
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <div className="flex gap-1.5">
                          {[0, 25, 50, 75, 100].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() =>
                                updateSettings('miningIntensity', pct)
                              }
                              className={`px-2.5 py-1 rounded-lg font-mono tabular-nums text-xs font-semibold border cursor-pointer ${
                                settings.miningIntensity === pct
                                  ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                        <label className="text-xs font-bold text-slate-900 dark:text-white block">
                          Rôle du nœud sur la matrice
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {(
                            [
                              {
                                id: 'passive',
                                label: 'Télémétrie Passive',
                                bonus: 'Bonus x1.00',
                                locked: false,
                              },
                              {
                                id: 'relay',
                                label: 'Relais Intermédiaire',
                                bonus: 'Bonus x1.25',
                                locked: false,
                              },
                              {
                                id: 'exit',
                                label: 'Nœud de Sortie (Exit)',
                                bonus: 'Bonus x1.50',
                                locked: !isPremium,
                              },
                            ] as const
                          ).map((role) => (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => {
                                if (role.locked) {
                                  onShowPricing();
                                  return;
                                }
                                updateSettings('contributionType', role.id);
                              }}
                              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                                settings.contributionType === role.id
                                  ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">
                                  {role.label}
                                </span>
                                {role.locked ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                                ) : settings.contributionType === role.id ? (
                                  <Check className="w-4 h-4 text-amber-500" />
                                ) : null}
                              </div>
                              <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 mt-1">
                                {role.bonus}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                            <Brain className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Allocation prédictive Yield IA (+25%)
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Oriente automatiquement les paquets vers les routes à forte demande.
                            </p>
                          </div>
                        </div>
                        <ToggleSwitch
                          checked={settings.yieldOptimizationIA}
                          onChange={(v) =>
                            updateSettings('yieldOptimizationIA', v)
                          }
                          accent="emerald"
                        />
                      </div>
                    </section>

                    {/* Auto-Withdraw Multi-Mode Configuration & Fiat Currency */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            Devise d&apos;affichage &amp; Retrait automatique programmé
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Déclenche un virement validé dès que le solde franchit le seuil, en conservant votre réserve.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700">
                            {(['EUR', 'USD', 'XOF'] as FiatCurrency[]).map(
                              (curr) => (
                                <button
                                  key={curr}
                                  type="button"
                                  onClick={() =>
                                    updateSettings('preferredFiat', curr)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer ${
                                    settings.preferredFiat === curr
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  {curr}
                                </button>
                              )
                            )}
                          </div>

                          <ToggleSwitch
                            checked={settings.autoWithdraw}
                            onChange={(v) => updateSettings('autoWithdraw', v)}
                            accent="amber"
                          />
                        </div>
                      </div>

                      {onOpenWithdrawalModal && (
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                            Valeur disponible : {balance.toFixed(4)} RNC (≈{' '}
                            {formatFiatValue(balance, settings.preferredFiat)})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenWithdrawalModal();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                          >
                            Ouvrir le Terminal de Retrait
                          </button>
                        </div>
                      )}

                      {settings.autoWithdraw && (
                        <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(
                              [
                                { id: 'crypto', label: 'Crypto On-Chain' },
                                { id: 'mobile_money', label: 'Mobile Money' },
                                { id: 'paypal', label: 'PayPal Express' },
                                { id: 'bank_transfer', label: 'Virement SEPA' },
                              ] as Array<{ id: WithdrawalMethod; label: string }>
                            ).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() =>
                                  patchSettings({
                                    autoWithdrawMethod: m.id,
                                    autoWithdrawSubNetwork:
                                      getDefaultSubNetworkForMethod(m.id),
                                  })
                                }
                                className={`py-2 px-3 rounded-xl border text-xs font-bold whitespace-nowrap cursor-pointer ${
                                  settings.autoWithdrawMethod === m.id
                                    ? 'bg-amber-500/15 border-amber-500 text-slate-900 dark:text-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>

                          {getSubNetworksForMethod(settings.autoWithdrawMethod)
                            .length > 1 && (
                            <div className="flex flex-wrap gap-1.5">
                              {getSubNetworksForMethod(
                                settings.autoWithdrawMethod
                              ).map((net) => (
                                <button
                                  key={net.id}
                                  type="button"
                                  onClick={() =>
                                    updateSettings(
                                      'autoWithdrawSubNetwork',
                                      net.id
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                                    settings.autoWithdrawSubNetwork === net.id
                                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {net.shortLabel}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                                Seuil de déclenchement (RNC)
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[1, 2.5, 5, 10, 25, 50].map((thr) => (
                                  <button
                                    key={thr}
                                    type="button"
                                    onClick={() =>
                                      updateSettings(
                                        'autoWithdrawThreshold',
                                        thr
                                      )
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg font-mono tabular-nums text-xs font-bold border cursor-pointer ${
                                      settings.autoWithdrawThreshold === thr
                                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {thr} RNC
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                                Réserve minimale conservée (RNC)
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[0, 0.5, 1, 2].map((resVal) => (
                                  <button
                                    key={resVal}
                                    type="button"
                                    onClick={() =>
                                      updateSettings(
                                        'autoWithdrawReserve',
                                        resVal
                                      )
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg font-mono tabular-nums text-xs font-bold border cursor-pointer ${
                                      settings.autoWithdrawReserve === resVal
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {resVal === 0
                                      ? 'Aucune (0)'
                                      : `${resVal} RNC`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold text-slate-500">
                                {WITHDRAWAL_RAIL_SPECS[
                                  settings.autoWithdrawSubNetwork
                                ]?.inputLabel || 'Destination automatique'}
                              </label>
                              {(() => {
                                const check = validateWithdrawalDestination(
                                  settings.autoWithdrawMethod,
                                  settings.autoWithdrawSubNetwork,
                                  settings.autoWithdrawAddress
                                );
                                return settings.autoWithdrawAddress.trim() ? (
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      check.valid
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {check.valid
                                      ? 'Destination vérifiée'
                                      : 'Format incomplet'}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <input
                              type="text"
                              value={settings.autoWithdrawAddress}
                              onChange={(e) =>
                                updateSettings(
                                  'autoWithdrawAddress',
                                  e.target.value
                                )
                              }
                              placeholder={
                                WITHDRAWAL_RAIL_SPECS[
                                  settings.autoWithdrawSubNetwork
                                ]?.placeholder || '0x71C...9A2B'
                              }
                              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* TAB 6: PROFILS, ASSISTANT & SAUVEGARDE JSON */}
                {activeTab === 'wizard' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Profils personnalisés, Assistant guidé & Sauvegarde JSON
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Enregistrez plusieurs configurations nommées, utilisez l'assistant en 3 étapes ou exportez vos réglages.
                      </p>
                    </div>

                    {/* Guided 3-Step Configuration Wizard */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Wand2 className="w-4 h-4 text-cyan-500" />
                          Assistant de calibrage rapide — Étape {wizardStep}/3
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3].map((s) => (
                            <span
                              key={s}
                              className={`w-6 h-1.5 rounded-full ${
                                s <= wizardStep
                                  ? 'bg-cyan-500'
                                  : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {wizardStep === 1 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {[
                            {
                              id: 'speed_ultra' as ConfigurationPreset,
                              title: 'Vitesse & Basse latence',
                              desc: 'WireGuard 1420B · Streaming & Cloud',
                              icon: Rocket,
                            },
                            {
                              id: 'stealth_max' as ConfigurationPreset,
                              title: 'Furtivité & Anonymat',
                              desc: 'OpenVPN :443 · Rotation & Anti-DPI',
                              icon: Ghost,
                            },
                            {
                              id: 'balanced' as ConfigurationPreset,
                              title: 'Protection Quotidienne',
                              desc: 'Équilibre sécurité et performances',
                              icon: Shield,
                            },
                          ].map((choice) => {
                            const Icon = choice.icon;
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => {
                                  applyPreset(choice.id);
                                  setWizardStep(2);
                                }}
                                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 text-left space-y-1.5 cursor-pointer"
                              >
                                <Icon className="w-4 h-4 text-cyan-500" />
                                <div className="text-xs font-bold text-slate-900 dark:text-white">
                                  {choice.title}
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  {choice.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {wizardStep === 2 && (
                        <div className="space-y-3">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Souhaitez-vous filtrer les juridictions de surveillance 14-Eyes ?
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                patchSettings({
                                  excludeEyesJurisdictions: '14-eyes',
                                  dns: 'quad9',
                                });
                                setWizardStep(3);
                              }}
                              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 text-left cursor-pointer"
                            >
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                Isolation Juridictionnelle Stricte (Hors 14-Eyes)
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Conserve uniquement Suisse, Islande, Panama, Estonie, Singapour + DNS Quad9.
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateSettings(
                                  'excludeEyesJurisdictions',
                                  'none'
                                );
                                setWizardStep(3);
                              }}
                              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 text-left cursor-pointer"
                            >
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                Couverture Mondiale Complète
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Accès à tous les relais proches (France, Allemagne, USA inclus).
                              </p>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setWizardStep(1)}
                            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            ← Étape précédente
                          </button>
                        </div>
                      )}

                      {wizardStep === 3 && (
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                              <Check className="w-4 h-4" />
                              Configuration synchronisée (Score {hardeningScore}/100)
                            </div>
                            <p className="text-xs font-mono tabular-nums text-slate-500">
                              {settings.protocol.toUpperCase()} :{settings.tunnelPort} · DNS{' '}
                              {settings.dns.toUpperCase()} · MTU {settings.mtuSize}B
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setWizardStep(1)}
                              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              Recommencer
                            </button>
                            <button
                              type="button"
                              onClick={onClose}
                              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Terminer & Appliquer
                            </button>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* User Custom Profiles Manager */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-cyan-500" />
                          Profils utilisateur sauvegardés ({savedProfiles.length})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Enregistrez l'état exact de vos réglages actuels pour y revenir en un clic.
                        </p>
                      </div>

                      <form
                        onSubmit={handleSaveCustomProfile}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          placeholder="Nom du profil (ex: Déplacement Hôtel, Audit Dev...)"
                          className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                        />
                        <button
                          type="submit"
                          disabled={!newProfileName.trim()}
                          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                        >
                          Sauvegarder le profil
                        </button>
                      </form>

                      {savedProfiles.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                          Aucun profil personnalisé enregistré pour le moment.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                          {savedProfiles.map((prof) => (
                            <div
                              key={prof.id}
                              className="p-3.5 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {prof.name}
                                </div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                                  Créé le {prof.createdAt} ·{' '}
                                  {prof.settings.protocol.toUpperCase()} :
                                  {prof.settings.tunnelPort} · DNS{' '}
                                  {prof.settings.dns.toUpperCase()}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleLoadCustomProfile(prof)}
                                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                                >
                                  Charger
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteCustomProfile(prof.id)
                                  }
                                  className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* JSON Backup & Factory Reset */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportJson}
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Télécharger .json</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyJson}
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Copier le JSON</span>
                        </button>
                      </div>

                      {!confirmReset ? (
                        <button
                          type="button"
                          onClick={() => setConfirmReset(true)}
                          className="px-3.5 py-2 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Réinitialiser aux valeurs d'usine</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onResetSettings();
                              setConfirmReset(false);
                              notify(
                                'Paramètres restaurés aux valeurs par défaut',
                                'info'
                              );
                            }}
                            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                          >
                            Confirmer la réinitialisation
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmReset(false)}
                            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* TAB 7: SYSTÈME, RACCOURCIS & PURGE */}
                {activeTab === 'system' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Préférences d'interface, Raccourcis clavier & Rétention Zero-Trace
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Gérez le thème d'affichage, les commandes rapides au clavier et la politique de conservation locale.
                      </p>
                    </div>

                    {/* Theme Appearance */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500">
                          {isDark ? (
                            <Moon className="w-4 h-4" />
                          ) : (
                            <Sun className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Thème visuel de l'interface
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Actuellement en mode {isDark ? 'Sombre (Tactique)' : 'Clair (Haute lisibilité)'}.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            if (isDark) onToggleTheme();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                            !isDark
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>Clair</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDark) onToggleTheme();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                            isDark
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Sombre</span>
                        </button>
                      </div>
                    </section>

                    {/* Keyboard Shortcuts */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500">
                            <Keyboard className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              Raccourcis clavier globaux
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Pilotez instantanément le tunnel et le morphing avec Ctrl (ou Cmd sur macOS).
                            </p>
                          </div>
                        </div>
                        <ToggleSwitch
                          checked={settings.keyboardShortcutsEnabled}
                          onChange={(v) =>
                            updateSettings('keyboardShortcutsEnabled', v)
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {[
                          { keys: 'Ctrl + S', action: 'Connecter / Déconnecter le tunnel' },
                          { keys: 'Ctrl + K', action: 'Activer / Désamorcer le Kill Switch' },
                          { keys: 'Ctrl + R', action: 'Morphing global (MAC + User-Agent)' },
                          { keys: 'Ctrl + M', action: 'Changer la signature User-Agent' },
                          { keys: 'Ctrl + L', action: 'Ouvrir le journal système' },
                          { keys: 'Ctrl + ,', action: 'Ouvrir / Fermer les paramètres' },
                        ].map((sc) => (
                          <div
                            key={sc.keys}
                            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                          >
                            <span className="text-slate-600 dark:text-slate-300">
                              {sc.action}
                            </span>
                            <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {sc.keys}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Log Retention & Zero-Trace Purge */}
                    <section className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-900 dark:text-white">
                            Durée de rétention des journaux d'événements
                          </label>
                          <span className="font-mono tabular-nums text-xs text-cyan-600 dark:text-cyan-400 font-bold">
                            {settings.logRetentionHours === 0
                              ? 'RAM Volatile uniquement'
                              : `${settings.logRetentionHours} heures`}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[
                            { hours: 0, label: '0h (RAM)' },
                            { hours: 1, label: '1h' },
                            { hours: 6, label: '6h' },
                            { hours: 24, label: '24h' },
                            { hours: 72, label: '3 jours' },
                            { hours: 168, label: '7 jours' },
                          ].map((opt) => (
                            <button
                              key={opt.hours}
                              type="button"
                              onClick={() =>
                                updateSettings('logRetentionHours', opt.hours)
                              }
                              className={`py-2 px-2.5 rounded-xl font-mono tabular-nums text-xs font-semibold border cursor-pointer ${
                                settings.logRetentionHours === opt.hours
                                  ? 'bg-cyan-600 text-white border-cyan-600'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
                        {!confirmPurgeLogs ? (
                          <button
                            type="button"
                            onClick={() => setConfirmPurgeLogs(true)}
                            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-red-500/50 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            <span>Purger les journaux système</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onClearLogs();
                                setConfirmPurgeLogs(false);
                                notify('Journaux système purgés', 'success');
                              }}
                              className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
                            >
                              Confirmer purge journaux
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmPurgeLogs(false)}
                              className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-500 cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        )}

                        {!confirmPurgeHistory ? (
                          <button
                            type="button"
                            onClick={() => setConfirmPurgeHistory(true)}
                            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-red-500/50 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            <span>Effacer l'historique des sessions</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onClearHistory();
                                setConfirmPurgeHistory(false);
                                notify(
                                  'Historique des connexions effacé',
                                  'success'
                                );
                              }}
                              className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
                            >
                              Confirmer effacement
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmPurgeHistory(false)}
                              className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-500 cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
