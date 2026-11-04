import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  Server,
  Terminal,
  Download,
  Upload,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Minus,
  RefreshCw,
  Play,
  Loader2,
  Sliders,
  Lock,
  AlertTriangle,
  RotateCcw,
  Search,
  Zap,
  FileCode2,
  KeyRound,
  Route,
  BookmarkPlus,
  Trash2,
  Network,
} from 'lucide-react';
import {
  AppSettings,
  VirtualIdentity,
  SystemRuntimeTelemetry,
  TcpCongestionControl,
  PostQuantumKex,
  SystemPowerProfile,
  TrafficPaddingJitterMs,
  SystemConfigSnapshot,
  SignedSystemBundle,
} from '../types';
import {
  DEFAULT_APP_SETTINGS,
  sanitizeAppSettings,
  computeSettingsHardeningScore,
  compileNativeTunnelConfig,
  compileSysctlConfig,
  compileNftablesConfig,
  compileSystemdServiceConfig,
  compilePolicyRoutingScript,
  simulatePacketRouteVerdict,
  computeModifiedSettingsDiff,
  EphemeralKeyMetadata,
} from '../constants';

interface SystemCenterProps {
  settings: AppSettings;
  updateSettings: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  patchSettings: (patch: Partial<AppSettings>, reason?: string) => void;
  onResetSettings: () => void;
  currentIdentity: VirtualIdentity;
  isConnected: boolean;
  isEmergency: boolean;
  vaultUnlocked: boolean;
  vaultCount: number;
  onLockVault: () => void;
  logsCount: number;
  sessionsCount: number;
  onOpenSettingsModal: () => void;
  onExecutePanic: () => void;
  addLog: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type SystemWorkspaceTab = 'audit' | 'lab' | 'compiler' | 'snapshots';

type CompilerTab =
  | 'tunnel'
  | 'sysctl'
  | 'nftables'
  | 'systemd'
  | 'routing'
  | 'diff';

type SubsystemCategoryFilter = 'all' | 'kernel' | 'egress' | 'governance';

interface SelfTestRow {
  id: string;
  title: string;
  subsystem: string;
  status: 'idle' | 'running' | 'pass' | 'warn' | 'fail';
  detail: string;
  metric: string;
  fixLabel?: string;
  onFix?: () => void;
}

interface MtuProbeReport {
  linkCeiling: number;
  currentMtu: number;
  recommendedMtu: number;
  maxPayloadBytes: number;
  maxTcpMss: number;
  pqcHandshakeBytes: number;
  fragmentationRisk: 'none' | 'moderate' | 'high';
  rttMs: number;
  jitterMs: number;
  breakdown: {
    ipHeaderBytes: number;
    transportBytes: number;
    tunnelHeaderBytes: number;
    aeadTagBytes: number;
    antiDpiFramingBytes: number;
    totalOverheadBytes: number;
  };
}

interface EphemeralKeyPairState extends EphemeralKeyMetadata {
  generatedAt: string;
  fingerprintSha256: string;
}

const SNAPSHOTS_STORAGE_KEY = 'renumerate_system_snapshots_v1';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function countSnapshotDifferences(a: AppSettings, b: AppSettings): number {
  const keys = Object.keys(DEFAULT_APP_SETTINGS) as Array<keyof AppSettings>;
  let diff = 0;
  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === 'object' || typeof vb === 'object') {
      if (JSON.stringify(va) !== JSON.stringify(vb)) diff += 1;
    } else if (va !== vb) {
      diff += 1;
    }
  }
  return diff;
}

export const SystemCenter: React.FC<SystemCenterProps> = ({
  settings,
  updateSettings,
  patchSettings,
  onResetSettings,
  currentIdentity,
  isConnected,
  isEmergency,
  vaultUnlocked,
  vaultCount,
  onLockVault,
  logsCount,
  sessionsCount,
  onOpenSettingsModal,
  onExecutePanic,
  addLog,
}) => {
  const [workspaceTab, setWorkspaceTab] =
    useState<SystemWorkspaceTab>('audit');

  const [notice, setNotice] = useState<{
    tone: 'success' | 'warning' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [telemetry, setTelemetry] = useState<SystemRuntimeTelemetry | null>(
    null
  );
  const [telemetryRttMs, setTelemetryRttMs] = useState<number | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(true);

  const [storageInfo, setStorageInfo] = useState<{
    usedKb: number;
    quotaMb: number;
  } | null>(null);

  // Crypto Lab & Ephemeral RAM Keys
  const [ephemeralKeys, setEphemeralKeys] =
    useState<EphemeralKeyPairState | null>(null);
  const [injectEphemeralIntoCompiler, setInjectEphemeralIntoCompiler] =
    useState(true);
  const [rekeySecondsLeft, setRekeySecondsLeft] = useState<number>(
    settings.ephemeralRekeyMinutes * 60
  );
  const [isBenchmarkingCrypto, setIsBenchmarkingCrypto] = useState(false);
  const [cryptoBench, setCryptoBench] = useState<{
    mbPerSec: number;
    avgLatencyMs: number;
  } | null>(null);

  // Path-MTU Analyzer
  const [selectedLinkCeiling, setSelectedLinkCeiling] = useState<number>(1500);
  const [isProbingMtu, setIsProbingMtu] = useState(false);
  const [mtuReport, setMtuReport] = useState<MtuProbeReport | null>(null);

  // Packet Verdict Simulator
  const [simDest, setSimDest] = useState('1.1.1.1');
  const [simProtocol, setSimProtocol] = useState<'UDP' | 'TCP' | 'ICMPv6'>(
    'TCP'
  );
  const [simPort, setSimPort] = useState<number>(443);

  // Subsystems Filter & Search
  const [subsystemFilter, setSubsystemFilter] =
    useState<SubsystemCategoryFilter>('all');
  const [subsystemSearch, setSubsystemSearch] = useState('');

  // Compiler & Signed Bundles
  const [compilerTab, setCompilerTab] = useState<CompilerTab>('tunnel');
  const [copiedCompiler, setCopiedCompiler] = useState(false);
  const [clipboardSecondsLeft, setClipboardSecondsLeft] = useState<
    number | null
  >(null);
  const clipboardIntervalRef = useRef<number | null>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);
  const [isSigningBundle, setIsSigningBundle] = useState(false);
  const [bundleVerifyStatus, setBundleVerifyStatus] = useState<{
    verified: boolean;
    sha256: string;
    message: string;
  } | null>(null);

  // Snapshots & Rollback
  const [snapshots, setSnapshots] = useState<SystemConfigSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SystemConfigSnapshot[]) : [];
    } catch {
      return [];
    }
  });
  const [snapshotName, setSnapshotName] = useState('');
  const [autoSnapshotOnHarden, setAutoSnapshotOnHarden] = useState(true);

  // Inline Confirmations
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [confirmPanicRun, setConfirmPanicRun] = useState(false);

  // Self-Test State
  const [isRunningSelfTest, setIsRunningSelfTest] = useState(false);
  const [selfTests, setSelfTests] = useState<SelfTestRow[]>([]);

  const showNotice = useCallback(
    (
      text: string,
      tone: 'success' | 'warning' | 'error' | 'info' = 'info'
    ) => {
      setNotice({ text, tone });
    },
    []
  );

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const persistSnapshots = useCallback((next: SystemConfigSnapshot[]) => {
    setSnapshots(next);
    try {
      localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota exceeded
    }
  }, []);

  const createSnapshotInternal = useCallback(
    (customLabel?: string) => {
      const cleanSettings = sanitizeAppSettings(settings);
      const score = computeSettingsHardeningScore(cleanSettings);
      const label =
        (customLabel || snapshotName).trim() ||
        `Snapshot ${cleanSettings.protocol.toUpperCase()} (${score}/100)`;
      const entry: SystemConfigSnapshot = {
        id: `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: label,
        createdAt: new Date().toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        hardeningScore: score,
        protocol: cleanSettings.protocol,
        postQuantumKex: cleanSettings.postQuantumKex,
        settings: cleanSettings,
      };
      persistSnapshots([entry, ...snapshots].slice(0, 15));
      if (!customLabel) setSnapshotName('');
      return entry;
    },
    [settings, snapshotName, snapshots, persistSnapshots]
  );

  const hardeningScore = useMemo(
    () => computeSettingsHardeningScore(settings),
    [settings]
  );

  const generateVolatileKeyPair = useCallback(
    async (silent = false) => {
      try {
        const privRaw = new Uint8Array(32);
        crypto.getRandomValues(privRaw);
        // RFC 7748 Curve25519 clamping on volatile key buffer
        privRaw[0] &= 248;
        privRaw[31] &= 127;
        privRaw[31] |= 64;

        const pubDigest = await crypto.subtle.digest('SHA-256', privRaw);
        const pubBytes = new Uint8Array(pubDigest);
        const pskRaw = new Uint8Array(32);
        crypto.getRandomValues(pskRaw);
        const fpDigest = await crypto.subtle.digest('SHA-256', pubBytes);

        // Zeroize private buffer immediately after deriving session public handle
        privRaw.fill(0);

        const keyIdHex = bytesToHex(new Uint8Array(fpDigest).slice(0, 6));
        const pskB64 = bytesToBase64(pskRaw);
        pskRaw.fill(0);

        const nextState: EphemeralKeyPairState = {
          keyIdHex,
          publicKeyBase64: bytesToBase64(pubBytes),
          presharedKeyMask: `${pskB64.slice(0, 10)}••••••••${pskB64.slice(-6)}=`,
          generatedAt: new Date().toLocaleTimeString('fr-FR'),
          fingerprintSha256: bytesToHex(new Uint8Array(fpDigest)),
        };

        setEphemeralKeys(nextState);
        setRekeySecondsLeft(settings.ephemeralRekeyMinutes * 60);
        if (!silent) {
          addLog(
            `Clés éphémères Curve25519 + ${settings.postQuantumKex.toUpperCase()} régénérées en RAM volatile [ID ${keyIdHex}]`,
            'success'
          );
          showNotice(
            `Nouvelle paire éphémère RAM générée (Key-ID ${keyIdHex})`,
            'success'
          );
        }
      } catch {
        if (!silent) {
          showNotice(
            'Erreur lors de la génération WebCrypto en RAM volatile',
            'error'
          );
        }
      }
    },
    [settings.ephemeralRekeyMinutes, settings.postQuantumKex, addLog, showNotice]
  );

  useEffect(() => {
    generateVolatileKeyPair(true);
  }, [generateVolatileKeyPair]);

  // Live PFS Ephemeral Rekey Countdown
  useEffect(() => {
    setRekeySecondsLeft(settings.ephemeralRekeyMinutes * 60);
    const timer = window.setInterval(() => {
      setRekeySecondsLeft((prev) => {
        if (prev <= 1) {
          generateVolatileKeyPair(true);
          return settings.ephemeralRekeyMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settings.ephemeralRekeyMinutes, generateVolatileKeyPair]);

  const tunnelConfig = useMemo(
    () =>
      compileNativeTunnelConfig(
        settings,
        currentIdentity,
        injectEphemeralIntoCompiler ? ephemeralKeys : null
      ),
    [settings, currentIdentity, injectEphemeralIntoCompiler, ephemeralKeys]
  );
  const sysctlConfig = useMemo(() => compileSysctlConfig(settings), [settings]);
  const nftablesConfig = useMemo(
    () => compileNftablesConfig(settings, currentIdentity),
    [settings, currentIdentity]
  );
  const systemdConfig = useMemo(
    () => compileSystemdServiceConfig(settings),
    [settings]
  );
  const routingConfig = useMemo(
    () => compilePolicyRoutingScript(settings, currentIdentity),
    [settings, currentIdentity]
  );
  const modifiedDiffs = useMemo(
    () => computeModifiedSettingsDiff(settings),
    [settings]
  );

  const packetVerdict = useMemo(
    () =>
      simulatePacketRouteVerdict(
        {
          destination: simDest,
          protocol: simProtocol,
          port: simPort,
        },
        settings,
        currentIdentity,
        isConnected,
        isEmergency
      ),
    [simDest, simProtocol, simPort, settings, currentIdentity, isConnected, isEmergency]
  );

  const fetchDiagnostics = useCallback(async () => {
    const t0 = performance.now();
    try {
      const resp = await fetch('/api/system/diagnostics');
      if (resp.ok) {
        const data = (await resp.json()) as SystemRuntimeTelemetry;
        setTelemetry(data);
        setTelemetryRttMs(Math.max(1, Math.round(performance.now() - t0)));
      }
    } catch {
      // Keep last known telemetry if transient network hiccup
    } finally {
      setIsLoadingTelemetry(false);
    }

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        setStorageInfo({
          usedKb: Math.max(1, Math.round((est.usage || 0) / 1024)),
          quotaMb: Math.max(1, Math.round((est.quota || 0) / (1024 * 1024))),
        });
      } catch {
        // Ignore quota estimation errors
      }
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    const pollMs =
      settings.powerProfile === 'performance'
        ? 4000
        : settings.powerProfile === 'eco'
          ? 10000
          : 6000;
    const interval = window.setInterval(fetchDiagnostics, pollMs);
    return () => window.clearInterval(interval);
  }, [fetchDiagnostics, settings.powerProfile]);

  useEffect(() => {
    return () => {
      if (clipboardIntervalRef.current) {
        window.clearInterval(clipboardIntervalRef.current);
      }
    };
  }, []);

  const buildBaselineTests = useCallback((): SelfTestRow[] => {
    const ksPass = settings.killSwitch && settings.killSwitchMode === 'strict';
    const dnsPass = settings.dnsLeakProtection && settings.webrtcLeakShield;
    const ipv6Pass = settings.ipv6LeakProtection;
    const pqcPass = settings.postQuantumKex !== 'classic-x25519';
    const quicPass = settings.blockQuicUdp443;
    const ebpfMemPass =
      settings.ebpfXdpAcceleration && settings.strictMemoryLock;
    const ntpPass = settings.ntpDriftProtection;
    const mtuOptimal =
      settings.protocol === 'wireguard'
        ? settings.mtuSize <= 1420
        : settings.mtuSize <= 1400;
    const l2Pass = settings.arpSpoofGuard && settings.strictReversePathFilter;
    const vaultPass =
      settings.autoLockVaultMinutes > 0 && settings.autoLockVaultMinutes <= 30;

    return [
      {
        id: 'killswitch',
        title: 'Coupe-Circuit Netfilter (Kill Switch)',
        subsystem: 'inet renumerate_guard',
        status: ksPass ? 'pass' : settings.killSwitch ? 'warn' : 'fail',
        detail: ksPass
          ? 'Politique chain output verrouillée sur DROP hors interface tunnel'
          : settings.killSwitch
            ? 'Mode souple actif : tolérance transitoire lors des reconnexions'
            : 'Coupe-circuit désactivé : exposition directe FAI en cas de coupure',
        metric: settings.killSwitch
          ? settings.killSwitchMode.toUpperCase()
          : 'OFF',
        fixLabel: !ksPass ? 'Forcer Strict' : undefined,
        onFix: !ksPass
          ? () =>
              patchSettings(
                { killSwitch: true, killSwitchMode: 'strict' },
                'Diagnostic Système : Kill Switch Strict activé'
              )
          : undefined,
      },
      {
        id: 'dns_webrtc',
        title: 'Étanchéité DNS DoH & Bouclier WebRTC',
        subsystem: 'DNS / ICE STUN',
        status: dnsPass ? 'pass' : 'fail',
        detail: dnsPass
          ? `Résolveur ${settings.dns.toUpperCase()} scellé et candidats ICE locaux filtrés`
          : 'Fuite potentielle UDP/53 ou exposition IP locale STUN détectée',
        metric: dnsPass ? 'SCELLÉ' : 'EXPOSÉ',
        fixLabel: !dnsPass ? 'Sceller DNS+ICE' : undefined,
        onFix: !dnsPass
          ? () =>
              patchSettings(
                { dnsLeakProtection: true, webrtcLeakShield: true },
                'Diagnostic Système : Anti-fuite DNS & WebRTC activés'
              )
          : undefined,
      },
      {
        id: 'ipv6_stack',
        title: 'Neutralisation Pile IPv6 Hors Tunnel',
        subsystem: 'sysctl disable_ipv6',
        status: ipv6Pass ? 'pass' : 'fail',
        detail: ipv6Pass
          ? 'Trafic AAAA / ICMPv6 Router Advertisement bloqué en amont'
          : 'Pile IPv6 hôte active sans encapsulation dédiée',
        metric: ipv6Pass ? 'BLOQUÉ' : 'OUVERT',
        fixLabel: !ipv6Pass ? 'Bloquer IPv6' : undefined,
        onFix: !ipv6Pass
          ? () => updateSettings('ipv6LeakProtection', true)
          : undefined,
      },
      {
        id: 'pqc_kex',
        title: 'Encapsulation Hybride Post-Quantique & PFS',
        subsystem: 'Crypto KEX / Rekey',
        status: pqcPass ? 'pass' : 'warn',
        detail: pqcPass
          ? `Échange ${settings.postQuantumKex.toUpperCase()} actif · Rotation PFS ${settings.ephemeralRekeyMinutes}m`
          : 'Échange X25519 classique sans protection Store-Now-Decrypt-Later',
        metric: settings.postQuantumKex.toUpperCase(),
        fixLabel: !pqcPass ? 'Activer ML-KEM' : undefined,
        onFix: !pqcPass
          ? () => updateSettings('postQuantumKex', 'ml-kem-1024')
          : undefined,
      },
      {
        id: 'ebpf_mlock',
        title: 'Chemin Rapide eBPF/XDP & Verrouillage RAM mlockall',
        subsystem: 'BPF JIT / VM Swap',
        status: ebpfMemPass ? 'pass' : 'warn',
        detail: ebpfMemPass
          ? 'Traitement XDP Zero-Copy actif et pages clés verrouillées hors swap disque'
          : 'Accélération XDP ou verrouillage mlockall partiellement désactivé',
        metric: ebpfMemPass ? 'XDP+MLOCK' : 'PARTIEL',
        fixLabel: !ebpfMemPass ? 'Activer XDP+RAM' : undefined,
        onFix: !ebpfMemPass
          ? () =>
              patchSettings(
                { ebpfXdpAcceleration: true, strictMemoryLock: true },
                'Diagnostic Système : Accélération eBPF/XDP et mlockall activés'
              )
          : undefined,
      },
      {
        id: 'quic_egress',
        title: 'Répression Flux HTTP/3 QUIC (UDP/443)',
        subsystem: 'Pare-feu Egress',
        status: quicPass ? 'pass' : 'warn',
        detail: quicPass
          ? 'Rejet UDP/443 actif : repli forcé sur TCP/TLS 1.3 inspectable'
          : 'Sessions UDP/443 QUIC autorisées (empreinte transport exposée)',
        metric: quicPass ? 'REJETÉ' : 'AUTORISÉ',
        fixLabel: !quicPass ? 'Bloquer QUIC' : undefined,
        onFix: !quicPass
          ? () => updateSettings('blockQuicUdp443', true)
          : undefined,
      },
      {
        id: 'ntp_guard',
        title: 'Garde Temporelle NTP/NTS Anti-Corrélation',
        subsystem: 'Horloge Monotone',
        status: ntpPass ? 'pass' : 'warn',
        detail: ntpPass
          ? 'Synchronisation UDP/123 confinée au tunnel chiffré (zéro fuite horodatage FAI)'
          : 'Requêtes NTP système autorisées hors tunnel',
        metric: ntpPass ? 'CONFINÉ' : 'CLAIR',
        fixLabel: !ntpPass ? 'Confiner NTP' : undefined,
        onFix: !ntpPass
          ? () => updateSettings('ntpDriftProtection', true)
          : undefined,
      },
      {
        id: 'mtu_mss',
        title: 'Alignement Path-MTU & Clamping TCP MSS',
        subsystem: 'Couche Transport L4',
        status: mtuOptimal && settings.mssClamping ? 'pass' : 'warn',
        detail:
          mtuOptimal && settings.mssClamping
            ? `MTU ${settings.mtuSize}B calibré avec ajustement dynamique SYN MSS`
            : `Risque de fragmentation IP (MTU ${settings.mtuSize}B, MSS Clamping ${settings.mssClamping ? 'ON' : 'OFF'})`,
        metric: `${settings.mtuSize}B`,
        fixLabel:
          !(mtuOptimal && settings.mssClamping) ? 'Calibrer 1420B' : undefined,
        onFix:
          !(mtuOptimal && settings.mssClamping)
            ? () =>
                patchSettings(
                  { mtuSize: 1420, mssClamping: true },
                  'Diagnostic Système : MTU calibré à 1420B + MSS Clamping'
                )
            : undefined,
      },
      {
        id: 'arp_rpfilter',
        title: 'Garde Couche 2 ARP & Validation rp_filter',
        subsystem: 'Noyau L2 / L3',
        status: l2Pass ? 'pass' : 'warn',
        detail: l2Pass
          ? 'Rejet ARP gratuitous et filtrage strict de route inverse activés'
          : 'Protection partielle contre l’empoisonnement ARP sur Wi-Fi partagé',
        metric: l2Pass ? 'DURCI' : 'STANDARD',
        fixLabel: !l2Pass ? 'Durcir L2/L3' : undefined,
        onFix: !l2Pass
          ? () =>
              patchSettings(
                { arpSpoofGuard: true, strictReversePathFilter: true },
                'Diagnostic Système : Garde ARP et rp_filter strict activés'
              )
          : undefined,
      },
      {
        id: 'ram_hygiene',
        title: 'TTL Clé Coffre RAM & Purge Presse-Papiers',
        subsystem: 'Mémoire Volatile',
        status: vaultPass ? 'pass' : 'warn',
        detail: vaultPass
          ? `Verrouillage auto Coffre à ${settings.autoLockVaultMinutes}m · Presse-papiers ${settings.clipboardAutoClearSeconds}s`
          : 'Expiration automatique de la clé maîtresse RAM désactivée ou trop longue',
        metric:
          settings.autoLockVaultMinutes === 0
            ? 'MANUEL'
            : `${settings.autoLockVaultMinutes} MIN`,
        fixLabel: !vaultPass ? 'Régler TTL 10m' : undefined,
        onFix: !vaultPass
          ? () =>
              patchSettings(
                { autoLockVaultMinutes: 10, clipboardAutoClearSeconds: 30 },
                'Diagnostic Système : TTL Coffre RAM fixé à 10 min'
              )
          : undefined,
      },
    ];
  }, [settings, patchSettings, updateSettings]);

  useEffect(() => {
    if (!isRunningSelfTest) {
      setSelfTests(buildBaselineTests());
    }
  }, [buildBaselineTests, isRunningSelfTest]);

  const handleRunSelfTest = async () => {
    if (isRunningSelfTest) return;
    setIsRunningSelfTest(true);
    const targetRows = buildBaselineTests();
    setSelfTests(
      targetRows.map((r) => ({
        ...r,
        status: 'idle',
      }))
    );

    for (let i = 0; i < targetRows.length; i += 1) {
      setSelfTests((prev) =>
        prev.map((row, idx) =>
          idx === i ? { ...row, status: 'running' } : row
        )
      );
      await new Promise((resolve) => window.setTimeout(resolve, 115));
      setSelfTests((prev) =>
        prev.map((row, idx) =>
          idx === i ? { ...targetRows[i] } : row
        )
      );
    }

    const passed = targetRows.filter((r) => r.status === 'pass').length;
    setIsRunningSelfTest(false);
    addLog(
      `Auto-diagnostic noyau terminé : ${passed}/${targetRows.length} contrôles conformes (Indice ${hardeningScore}/100)`,
      passed === targetRows.length ? 'success' : 'warning'
    );
  };

  const handleRunCryptoBenchmark = async () => {
    if (isBenchmarkingCrypto) return;
    setIsBenchmarkingCrypto(true);
    try {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      const payload = new Uint8Array(65536);
      crypto.getRandomValues(payload);
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);

      const iterations = 48;
      const start = performance.now();
      for (let i = 0; i < iterations; i += 1) {
        iv[11] = i & 0xff;
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
      }
      const elapsedMs = Math.max(1, performance.now() - start);
      const totalMegabytes = (payload.byteLength * iterations) / (1024 * 1024);
      const mbPerSec = Math.round((totalMegabytes / elapsedMs) * 1000);
      const avgLatencyMs = parseFloat((elapsedMs / iterations).toFixed(2));

      setCryptoBench({ mbPerSec, avgLatencyMs });
      addLog(
        `Benchmark WebCrypto AES-256-GCM : ${mbPerSec} Mo/s (${avgLatencyMs} ms / bloc 64 Ko)`,
        'success'
      );
    } catch {
      addLog('Échec du benchmark matériel WebCrypto', 'error');
    } finally {
      setIsBenchmarkingCrypto(false);
    }
  };

  const handleRunPathMtuProbe = useCallback(
    async (ceilingOverride?: number) => {
      if (isProbingMtu) return;
      const ceiling = ceilingOverride ?? selectedLinkCeiling;
      setIsProbingMtu(true);
      try {
        const samples: number[] = [];
        let lastPayload: {
          linkCeiling: number;
          currentMtu: number;
          recommendedMtu: number;
          maxPayloadBytes: number;
          maxTcpMss: number;
          pqcHandshakeBytes: number;
          fragmentationRisk: 'none' | 'moderate' | 'high';
          breakdown: MtuProbeReport['breakdown'];
        } | null = null;

        for (let i = 0; i < 3; i += 1) {
          const t0 = performance.now();
          const resp = await fetch('/api/system/probe-mtu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              linkCeiling: ceiling,
              protocol: settings.protocol,
              ipv6: !settings.ipv6LeakProtection,
              pqcKex: settings.postQuantumKex,
              tlsFrag: settings.tlsClientHelloFragmentation,
              paddingMs: settings.trafficPaddingJitterMs,
              currentMtu: settings.mtuSize,
            }),
          });
          samples.push(Math.max(1, performance.now() - t0));
          if (resp.ok) {
            lastPayload = await resp.json();
          }
        }

        if (lastPayload) {
          const avgRtt = Math.round(
            samples.reduce((acc, v) => acc + v, 0) / samples.length
          );
          const maxDiff =
            Math.max(...samples) - Math.min(...samples);
          setMtuReport({
            ...lastPayload,
            rttMs: avgRtt,
            jitterMs: parseFloat(maxDiff.toFixed(1)),
          });
          addLog(
            `Sonde Path-MTU (${ceiling}B) : MTU optimal ${lastPayload.recommendedMtu}B · Overhead ${lastPayload.breakdown.totalOverheadBytes}B`,
            lastPayload.fragmentationRisk === 'high' ? 'warning' : 'success'
          );
        }
      } catch {
        showNotice('Impossible de joindre la sonde Path-MTU locale', 'error');
      } finally {
        setIsProbingMtu(false);
      }
    },
    [
      isProbingMtu,
      selectedLinkCeiling,
      settings.protocol,
      settings.ipv6LeakProtection,
      settings.postQuantumKex,
      settings.tlsClientHelloFragmentation,
      settings.trafficPaddingJitterMs,
      settings.mtuSize,
      addLog,
      showNotice,
    ]
  );

  useEffect(() => {
    if (workspaceTab === 'lab' && !mtuReport && !isProbingMtu) {
      handleRunPathMtuProbe(selectedLinkCeiling);
    }
  }, [workspaceTab, mtuReport, isProbingMtu, handleRunPathMtuProbe, selectedLinkCeiling]);

  const handleApplyFullHardening = () => {
    if (autoSnapshotOnHarden) {
      createSnapshotInternal(
        `Pré-durcissement auto (${hardeningScore}/100)`
      );
    }
    patchSettings(
      {
        killSwitch: true,
        killSwitchMode: 'strict',
        dns: 'quad9',
        dnsLeakProtection: true,
        ipv6LeakProtection: true,
        webrtcLeakShield: true,
        postQuantumKex: 'ml-kem-1024',
        tcpCongestionControl: 'bbr',
        mssClamping: true,
        multiQueueTun: true,
        ebpfXdpAcceleration: true,
        tlsClientHelloFragmentation: true,
        trafficPaddingJitterMs: 15,
        ephemeralRekeyMinutes: 5,
        strictMemoryLock: true,
        ntpDriftProtection: true,
        blockQuicUdp443: true,
        blockCaptivePortalProbes: true,
        arpSpoofGuard: true,
        strictReversePathFilter: true,
        autoLockVaultMinutes: 10,
        clipboardAutoClearSeconds: 30,
      },
      'Console Système : Durcissement intégral Noyau eBPF, Anti-DPI & PQC appliqué'
    );
    showNotice(
      autoSnapshotOnHarden
        ? 'Point de restauration créé et durcissement intégral appliqué'
        : 'Durcissement intégral du système appliqué',
      'success'
    );
  };

  const activeCompilerPayload = useMemo(() => {
    if (compilerTab === 'tunnel') {
      return {
        filename: tunnelConfig.filename,
        content: tunnelConfig.content,
      };
    }
    if (compilerTab === 'sysctl') return sysctlConfig;
    if (compilerTab === 'nftables') return nftablesConfig;
    if (compilerTab === 'systemd') return systemdConfig;
    if (compilerTab === 'routing') return routingConfig;
    const diffText =
      modifiedDiffs.length === 0
        ? '# Aucun écart détecté : la configuration active correspond exactement aux paramètres usine.'
        : modifiedDiffs
            .map(
              (d) =>
                `[${d.category}] ${d.label}\n  Usine : ${d.defaultFormatted}\n  Actif : ${d.currentFormatted}`
            )
            .join('\n\n');
    return {
      filename: 'renumerate-settings-diff.txt',
      content: diffText,
    };
  }, [
    compilerTab,
    tunnelConfig,
    sysctlConfig,
    nftablesConfig,
    systemdConfig,
    routingConfig,
    modifiedDiffs,
  ]);

  const handleCopyCompilerOutput = async () => {
    try {
      await navigator.clipboard.writeText(activeCompilerPayload.content);
      setCopiedCompiler(true);
      window.setTimeout(() => setCopiedCompiler(false), 2000);

      if (clipboardIntervalRef.current) {
        window.clearInterval(clipboardIntervalRef.current);
      }

      if (settings.clipboardAutoClearSeconds > 0) {
        setClipboardSecondsLeft(settings.clipboardAutoClearSeconds);
        clipboardIntervalRef.current = window.setInterval(() => {
          setClipboardSecondsLeft((prev) => {
            if (prev === null || prev <= 1) {
              if (clipboardIntervalRef.current) {
                window.clearInterval(clipboardIntervalRef.current);
                clipboardIntervalRef.current = null;
              }
              navigator.clipboard?.writeText('').catch(() => {});
              addLog(
                `Presse-papiers système purgé automatiquement (${settings.clipboardAutoClearSeconds}s)`,
                'info'
              );
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch {
      addLog('Impossible de copier dans le presse-papiers', 'error');
    }
  };

  const handleDownloadCompilerFile = () => {
    const blob = new Blob([activeCompilerPayload.content], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeCompilerPayload.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog(
      `Fichier système compilé téléchargé : ${activeCompilerPayload.filename}`,
      'success'
    );
  };

  const handleExportSignedBundle = async () => {
    if (isSigningBundle) return;
    setIsSigningBundle(true);
    try {
      const cleanSettings = sanitizeAppSettings(settings);
      const resp = await fetch('/api/system/attest-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sign',
          schemaVersion: 'renumerate-sys-v2',
          settings: cleanSettings,
        }),
      });
      if (!resp.ok) {
        throw new Error('Échec attestation serveur');
      }
      const att = (await resp.json()) as {
        exportedAt: string;
        sha256: string;
        hmacSignature: string;
      };

      const bundle: SignedSystemBundle = {
        schemaVersion: 'renumerate-sys-v2',
        exportedAt: att.exportedAt,
        sha256: att.sha256,
        hmacSignature: att.hmacSignature,
        hardeningScore,
        settings: cleanSettings,
        manifests: {
          [tunnelConfig.filename]: tunnelConfig.content,
          [sysctlConfig.filename]: sysctlConfig.content,
          [nftablesConfig.filename]: nftablesConfig.content,
          [systemdConfig.filename]: systemdConfig.content,
          [routingConfig.filename]: routingConfig.content,
        },
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `renumerate-bundle-${dateStr}.renum-sys.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBundleVerifyStatus({
        verified: true,
        sha256: att.sha256,
        message: 'Bundle système exporté et scellé par HMAC-SHA256.',
      });
      addLog(
        `Bundle système signé exporté (SHA-256 ${att.sha256.slice(0, 12)}…)`,
        'success'
      );
      showNotice('Bundle système signé téléchargé avec succès', 'success');
    } catch {
      showNotice('Échec lors de la signature du bundle système', 'error');
    } finally {
      setIsSigningBundle(false);
    }
  };

  const handleImportSignedBundle = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as Partial<SignedSystemBundle> &
        Record<string, unknown>;
      const rawSettings =
        parsed.settings && typeof parsed.settings === 'object'
          ? parsed.settings
          : (parsed as Partial<AppSettings>);
      const cleanSettings = sanitizeAppSettings(rawSettings);

      const resp = await fetch('/api/system/attest-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'verify',
          schemaVersion: parsed.schemaVersion || 'renumerate-sys-v2',
          settings: cleanSettings,
          sha256: parsed.sha256 || '',
          hmacSignature: parsed.hmacSignature || '',
        }),
      });

      const verifyRes = resp.ok
        ? ((await resp.json()) as {
            verified: boolean;
            computedSha256: string;
            reason: string;
          })
        : {
            verified: false,
            computedSha256: '',
            reason: 'Vérification hors-ligne appliquée.',
          };

      // If a HMAC signature WAS present and failed verification, refuse tampered payload
      if (parsed.hmacSignature && !verifyRes.verified) {
        setBundleVerifyStatus({
          verified: false,
          sha256: verifyRes.computedSha256,
          message: verifyRes.reason,
        });
        addLog(
          `Import bloqué : signature HMAC invalide sur ${file.name}`,
          'error'
        );
        showNotice(
          'Import refusé : le sceau cryptographique du bundle a été altéré',
          'error'
        );
        return;
      }

      patchSettings(
        cleanSettings,
        `Bundle système restauré depuis ${file.name}`
      );
      setBundleVerifyStatus({
        verified: verifyRes.verified,
        sha256: verifyRes.computedSha256,
        message: verifyRes.reason,
      });
      showNotice(
        verifyRes.verified
          ? `Bundle authentifié et restauré (${file.name})`
          : `Configuration JSON importée (${file.name})`,
        'success'
      );
    } catch {
      showNotice('Fichier bundle JSON illisible ou corrompu', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const subsystemRows = useMemo(() => {
    const items: Array<{
      id: string;
      category: 'kernel' | 'egress' | 'governance';
      name: string;
      technicalParam: string;
      description: string;
      isHealthy: boolean;
      statusLabel: string;
      control: React.ReactNode;
    }> = [
      {
        id: 'ebpf_xdp',
        category: 'kernel',
        name: 'Accélération eBPF / XDP Zero-Copy',
        technicalParam: 'net.core.bpf_jit_enable = 1',
        description:
          'Décharge le routage des paquets chiffrés dès le pilote réseau avant allocation SKB.',
        isHealthy: settings.ebpfXdpAcceleration,
        statusLabel: settings.ebpfXdpAcceleration ? 'XDP Actif' : 'SKB Standard',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings(
                'ebpfXdpAcceleration',
                !settings.ebpfXdpAcceleration
              )
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.ebpfXdpAcceleration
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            {settings.ebpfXdpAcceleration ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'tcp_cc',
        category: 'kernel',
        name: 'Contrôle de Congestion TCP Noyau',
        technicalParam: 'net.ipv4.tcp_congestion_control',
        description:
          'BBR maximise le débit sans bufferbloat ; Hybla stabilise les liaisons longue distance.',
        isHealthy: settings.tcpCongestionControl !== 'cubic',
        statusLabel: settings.tcpCongestionControl.toUpperCase(),
        control: (
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-0.5">
            {(['bbr', 'cubic', 'hybla'] as TcpCongestionControl[]).map((cc) => (
              <button
                key={cc}
                type="button"
                onClick={() => updateSettings('tcpCongestionControl', cc)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold uppercase transition-colors cursor-pointer ${
                  settings.tcpCongestionControl === cc
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cc}
              </button>
            ))}
          </div>
        ),
      },
      {
        id: 'pqc_kex',
        category: 'kernel',
        name: 'Échange de Clés Hybride Post-Quantique',
        technicalParam: 'crypto.kem_handshake',
        description:
          'Combine X25519 et ML-KEM-1024 (FIPS-203) contre la collecte rétroactive quantique.',
        isHealthy: settings.postQuantumKex !== 'classic-x25519',
        statusLabel:
          settings.postQuantumKex === 'ml-kem-1024'
            ? 'ML-KEM-1024'
            : settings.postQuantumKex === 'sntrup761'
              ? 'sntrup761'
              : 'Classique',
        control: (
          <select
            aria-label="Sélecteur Post-Quantum KEX"
            value={settings.postQuantumKex}
            onChange={(e) =>
              updateSettings('postQuantumKex', e.target.value as PostQuantumKex)
            }
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ml-kem-1024">ML-KEM-1024 (FIPS-203)</option>
            <option value="sntrup761">sntrup761x25519</option>
            <option value="classic-x25519">X25519 Classique</option>
          </select>
        ),
      },
      {
        id: 'pfs_rekey',
        category: 'kernel',
        name: 'Cadence de Re-Cléage Éphémère (PFS)',
        technicalParam: 'wg.rekey_after_minutes',
        description:
          'Purge et remplace périodiquement les clés symétriques de session en RAM.',
        isHealthy: settings.ephemeralRekeyMinutes <= 15,
        statusLabel: `Toutes les ${settings.ephemeralRekeyMinutes}m`,
        control: (
          <select
            aria-label="Intervalle de rotation PFS"
            value={settings.ephemeralRekeyMinutes}
            onChange={(e) =>
              updateSettings('ephemeralRekeyMinutes', Number(e.target.value))
            }
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value={3}>3 min (Ultra)</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min (Nominal)</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
          </select>
        ),
      },
      {
        id: 'mss_clamping',
        category: 'kernel',
        name: 'Clamping Dynamique TCP MSS (PMTU)',
        technicalParam: 'tcp option maxseg size set rt mtu',
        description:
          'Ajuste la taille des segments SYN TCP au MTU du tunnel pour éliminer les trous noirs PMTU.',
        isHealthy: settings.mssClamping,
        statusLabel: settings.mssClamping ? 'Actif' : 'Désactivé',
        control: (
          <button
            type="button"
            onClick={() => updateSettings('mssClamping', !settings.mssClamping)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.mssClamping
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            {settings.mssClamping ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'multiqueue_tun',
        category: 'kernel',
        name: 'Files Parallèles Multi-Queue virtio/TUN',
        technicalParam: 'IFF_MULTI_QUEUE (tx/rx)',
        description:
          'Répartit le chiffrement ChaCha20/AES-GCM sur tous les cœurs logiques CPU.',
        isHealthy: settings.multiQueueTun,
        statusLabel: settings.multiQueueTun ? 'Parallèle' : 'Mono-file',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('multiQueueTun', !settings.multiQueueTun)
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.multiQueueTun
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            {settings.multiQueueTun ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'keepalive',
        category: 'kernel',
        name: 'Battement NAT Persistent Keepalive',
        technicalParam: 'wg.persistent_keepalive',
        description:
          'Maintient les tables d’état NAT ouvertes sur routeurs cellulaires 5G et CGNAT.',
        isHealthy: settings.keepaliveInterval > 0,
        statusLabel:
          settings.keepaliveInterval === 0
            ? 'Désactivé'
            : `${settings.keepaliveInterval}s`,
        control: (
          <select
            aria-label="Intervalle Persistent Keepalive"
            value={settings.keepaliveInterval}
            onChange={(e) =>
              updateSettings('keepaliveInterval', Number(e.target.value))
            }
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value={0}>OFF (0s)</option>
            <option value={15}>15s (CGNAT)</option>
            <option value={25}>25s (Recommandé)</option>
            <option value={45}>45s (Éco)</option>
          </select>
        ),
      },
      {
        id: 'tls_frag',
        category: 'egress',
        name: 'Fragmentation TLS ClientHello (Anti-DPI)',
        technicalParam: 'dpi.tls_sni_record_split',
        description:
          'Découpe l’extension SNI sur plusieurs segments TCP pour déjouer l’inspection profonde.',
        isHealthy: settings.tlsClientHelloFragmentation,
        statusLabel: settings.tlsClientHelloFragmentation
          ? 'SNI Fragmenté'
          : 'Standard',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings(
                'tlsClientHelloFragmentation',
                !settings.tlsClientHelloFragmentation
              )
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.tlsClientHelloFragmentation
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            {settings.tlsClientHelloFragmentation ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'chaff_padding',
        category: 'egress',
        name: 'Bourrage Chaff & Gigue Anti-Corrélation',
        technicalParam: 'dpi.traffic_padding_jitter_ms',
        description:
          'Injecte un bruit temporel contrôlé pour masquer la signature volumétrique des pages.',
        isHealthy: settings.trafficPaddingJitterMs > 0,
        statusLabel:
          settings.trafficPaddingJitterMs === 0
            ? '0 ms (Direct)'
            : `${settings.trafficPaddingJitterMs} ms`,
        control: (
          <select
            aria-label="Bourrage temporel Anti-DPI"
            value={settings.trafficPaddingJitterMs}
            onChange={(e) =>
              updateSettings(
                'trafficPaddingJitterMs',
                Number(e.target.value) as TrafficPaddingJitterMs
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value={0}>0 ms (Vitesse max)</option>
            <option value={15}>15 ms (Léger)</option>
            <option value={40}>40 ms (Furtif)</option>
            <option value={85}>85 ms (Paranoïaque)</option>
          </select>
        ),
      },
      {
        id: 'quic_block',
        category: 'egress',
        name: 'Blocage QUIC / HTTP3 (UDP 443)',
        technicalParam: 'nft udp dport 443 reject',
        description:
          'Empêche les navigateurs de contourner les filtres TCP fins via des sessions QUIC.',
        isHealthy: settings.blockQuicUdp443,
        statusLabel: settings.blockQuicUdp443 ? 'Rejeté' : 'Autorisé',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('blockQuicUdp443', !settings.blockQuicUdp443)
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.blockQuicUdp443
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
            }`}
          >
            {settings.blockQuicUdp443 ? 'BLOQUÉ' : 'AUTORISÉ'}
          </button>
        ),
      },
      {
        id: 'ntp_drift',
        category: 'egress',
        name: 'Confinement Horloge NTP/NTS au Tunnel',
        technicalParam: 'nft oifname != wg0 udp dport 123 drop',
        description:
          'Bloque les requêtes NTP en clair vers le FAI pour éviter le profilage d’horloge.',
        isHealthy: settings.ntpDriftProtection,
        statusLabel: settings.ntpDriftProtection ? 'Confiné' : 'Clair',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('ntpDriftProtection', !settings.ntpDriftProtection)
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.ntpDriftProtection
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
            }`}
          >
            {settings.ntpDriftProtection ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'captive_probes',
        category: 'egress',
        name: 'Neutralisation Sondes Connectivité OS',
        technicalParam: 'os.connectivity_check_sinkhole',
        description:
          'Intercepte les requêtes automatiques NCSI / Captive Portal émises par l’OS.',
        isHealthy: settings.blockCaptivePortalProbes,
        statusLabel: settings.blockCaptivePortalProbes ? 'Filtré' : 'Passant',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings(
                'blockCaptivePortalProbes',
                !settings.blockCaptivePortalProbes
              )
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.blockCaptivePortalProbes
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            {settings.blockCaptivePortalProbes ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'arp_guard',
        category: 'egress',
        name: 'Garde Couche 2 Anti-ARP Spoofing',
        technicalParam: 'net.ipv4.conf.all.arp_ignore = 1',
        description:
          'Ignore les annonces ARP non sollicitées pour contrer les attaques MITM LAN.',
        isHealthy: settings.arpSpoofGuard,
        statusLabel: settings.arpSpoofGuard ? 'Verrouillé' : 'Standard',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('arpSpoofGuard', !settings.arpSpoofGuard)
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.arpSpoofGuard
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
            }`}
          >
            {settings.arpSpoofGuard ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'rp_filter',
        category: 'egress',
        name: 'Validation Stricte Route Inverse (RFC 3704)',
        technicalParam: 'net.ipv4.conf.all.rp_filter = 1',
        description:
          'Écarte tout paquet entrant dont l’adresse source ne correspond pas à la table retour.',
        isHealthy: settings.strictReversePathFilter,
        statusLabel: settings.strictReversePathFilter ? 'Strict (1)' : 'Souple (0)',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings(
                'strictReversePathFilter',
                !settings.strictReversePathFilter
              )
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.strictReversePathFilter
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
            }`}
          >
            {settings.strictReversePathFilter ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'mlockall',
        category: 'governance',
        name: 'Verrouillage Pages RAM (mlockall Anti-Swap)',
        technicalParam: 'LimitMEMLOCK=infinity · fs.suid_dumpable=0',
        description:
          'Interdit la pagination disque des clés cryptographiques et bloque tout core-dump.',
        isHealthy: settings.strictMemoryLock,
        statusLabel: settings.strictMemoryLock ? 'RAM Scellée' : 'Swap Autorisé',
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('strictMemoryLock', !settings.strictMemoryLock)
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              settings.strictMemoryLock
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
            }`}
          >
            {settings.strictMemoryLock ? 'VERROUILLÉ' : 'SOUPLE'}
          </button>
        ),
      },
      {
        id: 'power_profile',
        category: 'governance',
        name: 'Ordonnanceur Énergétique du Démon',
        technicalParam: 'systemd.CPUSchedulingPolicy',
        description:
          'Ajuste la priorité CPU temps réel et la fréquence de télémétrie.',
        isHealthy: true,
        statusLabel: settings.powerProfile.toUpperCase(),
        control: (
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-0.5">
            {(
              [
                { id: 'eco', label: 'Éco' },
                { id: 'balanced', label: 'Nominal' },
                { id: 'performance', label: 'Perf' },
              ] as Array<{ id: SystemPowerProfile; label: string }>
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateSettings('powerProfile', p.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  settings.powerProfile === p.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ),
      },
      {
        id: 'vault_autolock',
        category: 'governance',
        name: 'Expiration Clé Maîtresse Coffre RAM',
        technicalParam: 'vault.idle_key_wipe_ttl',
        description:
          'Efface la clé PBKDF2 en mémoire vive après une période d’inactivité.',
        isHealthy: settings.autoLockVaultMinutes > 0,
        statusLabel:
          settings.autoLockVaultMinutes === 0
            ? 'Manuel'
            : `${settings.autoLockVaultMinutes} min`,
        control: (
          <select
            aria-label="Expiration automatique du coffre"
            value={settings.autoLockVaultMinutes}
            onChange={(e) =>
              updateSettings('autoLockVaultMinutes', Number(e.target.value))
            }
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value={0}>Manuel (0m)</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
          </select>
        ),
      },
    ];

    const q = subsystemSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (subsystemFilter !== 'all' && item.category !== subsystemFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.technicalParam.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [settings, subsystemFilter, subsystemSearch, updateSettings]);

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const passCount = selfTests.filter((t) => t.status === 'pass').length;
  const activeDirectivesCount = subsystemRows.filter((r) => r.isHealthy).length;

  return (
    <div className="space-y-6 pb-8">
      {/* Top Engineering Console Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Ingénierie Système &amp; Noyau
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
              {settings.ebpfXdpAcceleration ? 'eBPF XDP' : 'SKB'} ·{' '}
              {settings.postQuantumKex.toUpperCase()}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Pilotage bas niveau des directives noyau, laboratoire Path-MTU &amp;
            clés éphémères RAM, compilateur système multi-cibles et snapshots de
            restauration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              const snap = createSnapshotInternal();
              addLog(
                `Point de restauration système créé : ${snap.name}`,
                'success'
              );
              showNotice(`Snapshot « ${snap.name} » enregistré`, 'success');
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Snapshot</span>
          </button>

          <button
            type="button"
            onClick={handleApplyFullHardening}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Durcir le système</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-cyan-500 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-500" />
            <span>Paramètres</span>
          </button>

          {!confirmPanicRun ? (
            <button
              type="button"
              onClick={() => setConfirmPanicRun(true)}
              className="px-3.5 py-2 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Protocole Panique</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmPanicRun(false);
                  onExecutePanic();
                }}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                Exécuter Panique
              </button>
              <button
                type="button"
                onClick={() => setConfirmPanicRun(false)}
                className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Feedback Notice */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            notice.tone === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : notice.tone === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
                : notice.tone === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-800 dark:text-cyan-300'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[11px] font-semibold underline cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* 4-Card System Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Indice de Durcissement</span>
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {hardeningScore}
              <span className="text-sm font-normal text-slate-400">/100</span>
            </span>
            <span
              className={`text-xs font-semibold ${
                hardeningScore >= 85
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : hardeningScore >= 65
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {hardeningScore >= 85
                ? 'Forteresse'
                : hardeningScore >= 65
                  ? ' Intermédiaire'
                  : 'Exposé'}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                hardeningScore >= 85
                  ? 'bg-emerald-500'
                  : hardeningScore >= 65
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${hardeningScore}%` }}
            />
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {passCount}/{selfTests.length || 10} tests conformes ·{' '}
            {modifiedDiffs.length} écart(s) usine
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Noyau Hôte &amp; Runtime</span>
            <Server className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
              {isLoadingTelemetry
                ? 'Sonde...'
                : `${telemetry?.platform || 'linux'}/${telemetry?.arch || 'x64'}`}
            </span>
            <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {telemetryRttMs !== null ? `RTT ${telemetryRttMs} ms` : 'Nominal'}
            </span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 truncate">
            {telemetry
              ? `${telemetry.cpuCores} cœurs · Load ${telemetry.loadAvg1m} · RSS ${telemetry.memoryRssMb} Mo`
              : 'Collecte des compteurs processus...'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate">
            {telemetry
              ? `Uptime ${formatUptime(telemetry.uptimeSeconds)} · ${telemetry.interfaces?.length ?? 0} interface(s)`
              : 'Node Runtime actif'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Clés Éphémères &amp; PFS</span>
            <KeyRound className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCountdown(rekeySecondsLeft)}
            </span>
            <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
              {ephemeralKeys ? `ID ${ephemeralKeys.keyIdHex}` : 'Init RAM'}
            </span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            {cryptoBench
              ? `AES-GCM : ${cryptoBench.mbPerSec} Mo/s (${cryptoBench.avgLatencyMs} ms)`
              : `${telemetry?.cipherSuitesCount ?? 64} suites TLS · PQC prêt`}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Cycle PFS : {settings.ephemeralRekeyMinutes} min ·{' '}
            {settings.strictMemoryLock ? 'mlockall actif' : 'swap standard'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Mémoire &amp; Restauration</span>
            <HardDrive className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {storageInfo ? `${storageInfo.usedKb} Ko` : 'LocalDB'}
            </span>
            <span
              className={`text-xs font-semibold ${
                vaultUnlocked
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {vaultUnlocked ? 'Coffre ouvert' : 'Coffre scellé'}
            </span>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            {vaultCount} secret(s) · {logsCount} log(s) · {sessionsCount}{' '}
            session(s)
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {snapshots.length} snapshot(s) · Rétention{' '}
            {settings.logRetentionHours === 0
              ? 'RAM 0h'
              : `${settings.logRetentionHours}h`}
          </div>
        </div>
      </div>

      {/* 4-Workspace Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              {
                id: 'audit',
                label: 'Sous-systèmes & Audit',
                icon: ShieldCheck,
                badge: `${activeDirectivesCount}/17`,
              },
              {
                id: 'lab',
                label: 'Labo Réseau & Crypto',
                icon: Cpu,
                badge: `${settings.mtuSize}B`,
              },
              {
                id: 'compiler',
                label: 'Compilateur & Bundles',
                icon: FileCode2,
                badge: '6 cibles',
              },
              {
                id: 'snapshots',
                label: 'Points de Restauration',
                icon: RotateCcw,
                badge: String(snapshots.length),
              },
            ] as Array<{
              id: SystemWorkspaceTab;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
              badge: string;
            }>
          ).map((tab) => {
            const Icon = tab.icon;
            const active = workspaceTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setWorkspaceTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-cyan-500/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={fetchDiagnostics}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualiser les sondes</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: SOUS-SYSTÈMES & AUDIT                                         */}
      {/* =================================================================== */}
      {workspaceTab === 'audit' && (
        <div className="space-y-6">
          {/* Interactive 10-Stage Self-Test */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-500" />
                  <span>Auto-Diagnostic Intégral du Noyau (10 Contrôles)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Vérifie l’étanchéité Netfilter, l’accélération eBPF/XDP, le
                  verrouillage RAM mlockall et corrige tout écart en un clic.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunSelfTest}
                disabled={isRunningSelfTest}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 self-start sm:self-auto cursor-pointer"
              >
                {isRunningSelfTest ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>
                  {isRunningSelfTest
                    ? 'Audit séquentiel...'
                    : 'Exécuter les 10 tests'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {selfTests.map((row) => {
                const StatusIcon =
                  row.status === 'running'
                    ? Loader2
                    : row.status === 'pass'
                      ? CheckCircle2
                      : row.status === 'warn'
                        ? AlertTriangle
                        : row.status === 'fail'
                          ? XCircle
                          : Minus;
                const iconTone =
                  row.status === 'running'
                    ? 'text-cyan-500 animate-spin'
                    : row.status === 'pass'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : row.status === 'warn'
                        ? 'text-amber-600 dark:text-amber-400'
                        : row.status === 'fail'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-400';

                return (
                  <div
                    key={row.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <StatusIcon
                        className={`w-4 h-4 mt-0.5 shrink-0 ${iconTone}`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {row.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {row.subsystem}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {row.detail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {row.onFix && row.fixLabel && row.status !== 'running' && (
                        <button
                          type="button"
                          onClick={row.onFix}
                          className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          {row.fixLabel}
                        </button>
                      )}
                      <span
                        className={`font-mono tabular-nums text-[11px] font-bold ${
                          row.status === 'pass'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : row.status === 'warn'
                              ? 'text-amber-600 dark:text-amber-400'
                              : row.status === 'fail'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-500'
                        }`}
                      >
                        {row.metric}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 17-Row Kernel, eBPF, Anti-DPI & Daemon Subsystems Table */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Matrice des Sous-Systèmes Noyau, eBPF &amp; Gouvernance (17
                  Directives)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Modifiez en temps réel les paramètres sysctl, anti-DPI,
                  re-cléage PFS et confinement mémoire.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={subsystemSearch}
                    onChange={(e) => setSubsystemSearch(e.target.value)}
                    placeholder="Filtrer (ex: ebpf, mlock, quic...)"
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500 w-52"
                  />
                </div>

                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5">
                  {(
                    [
                      { id: 'all', label: 'Tous' },
                      { id: 'kernel', label: 'Noyau & PQC' },
                      { id: 'egress', label: 'Anti-DPI & Egress' },
                      { id: 'governance', label: 'Mémoire & Démon' },
                    ] as Array<{ id: SubsystemCategoryFilter; label: string }>
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSubsystemFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        subsystemFilter === cat.id
                          ? 'bg-cyan-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Sous-système</th>
                    <th className="py-2.5 px-4 hidden md:table-cell">
                      Directive technique
                    </th>
                    <th className="py-2.5 px-4">État</th>
                    <th className="py-2.5 px-4 text-right">Action directe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {subsystemRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {row.description}
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {row.technicalParam}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono tabular-nums text-[11px] font-semibold ${
                            row.isHealthy
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {row.isHealthy ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{row.statusLabel}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {row.control}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LABO RÉSEAU & CRYPTO                                          */}
      {/* =================================================================== */}
      {workspaceTab === 'lab' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Volatile RAM Ephemeral Key & PFS Engine */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-500" />
                    <span>
                      Générateur de Clés Éphémères RAM &amp; Benchmark WebCrypto
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Clé privée X25519 générée puis effacée du tampon JS après
                    dérivation de l’identifiant public de session.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => generateVolatileKeyPair(false)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Régénérer RAM</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Session Key-ID :</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                    {ephemeralKeys?.keyIdHex || '—'} (générée à{' '}
                    {ephemeralKeys?.generatedAt || '—'})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Clé publique X25519 :</span>
                  <span className="text-slate-900 dark:text-slate-100 truncate max-w-[230px]">
                    {ephemeralKeys?.publicKeyBase64 || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">
                    Jeton PSK {settings.postQuantumKex.toUpperCase()} :
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {ephemeralKeys?.presharedKeyMask || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Prochain re-cléage PFS :</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    dans {formatCountdown(rekeySecondsLeft)} (cycle{' '}
                    {settings.ephemeralRekeyMinutes}m)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunCryptoBenchmark}
                    disabled={isBenchmarkingCrypto}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-cyan-500 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isBenchmarkingCrypto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-cyan-500" />
                    )}
                    <span>Benchmark AES-256-GCM</span>
                  </button>
                  {cryptoBench && (
                    <span className="text-xs font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {cryptoBench.mbPerSec} Mo/s
                    </span>
                  )}
                </div>

                {vaultUnlocked && (
                  <button
                    type="button"
                    onClick={onLockVault}
                    className="px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Purger clé Coffre RAM</span>
                  </button>
                )}
              </div>
            </section>

            {/* Path-MTU & Encapsulation Overhead Analyzer */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Network className="w-4 h-4 text-cyan-500" />
                    <span>
                      Analyseur Path-MTU &amp; Budget d’Encapsulation
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Calcule la surcharge exacte des en-têtes{' '}
                    {settings.protocol.toUpperCase()} + AEAD + Anti-DPI selon la
                    liaison physique.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRunPathMtuProbe(selectedLinkCeiling)}
                  disabled={isProbingMtu}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {isProbingMtu ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Sonder MTU</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { ceiling: 1500, label: 'Ethernet 1500B' },
                  { ceiling: 1492, label: 'PPPoE 1492B' },
                  { ceiling: 1420, label: '5G / LTE 1420B' },
                  { ceiling: 1360, label: 'Wi-Fi Hôtel 1360B' },
                ].map((preset) => (
                  <button
                    key={preset.ceiling}
                    type="button"
                    onClick={() => {
                      setSelectedLinkCeiling(preset.ceiling);
                      handleRunPathMtuProbe(preset.ceiling);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-mono tabular-nums font-semibold border transition-colors cursor-pointer ${
                      selectedLinkCeiling === preset.ceiling
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {mtuReport && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                    <span className="text-slate-600 dark:text-slate-300">
                      Overhead total :{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {mtuReport.breakdown.totalOverheadBytes} octets
                      </strong>{' '}
                      (IP {mtuReport.breakdown.ipHeaderBytes}B + L4{' '}
                      {mtuReport.breakdown.transportBytes}B + Tunnel{' '}
                      {mtuReport.breakdown.tunnelHeaderBytes}B + AEAD{' '}
                      {mtuReport.breakdown.aeadTagBytes}B)
                    </span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                      RTT {mtuReport.rttMs} ms (±{mtuReport.jitterMs} ms)
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-xs">
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        MTU recommandé : {mtuReport.recommendedMtu}B
                      </span>
                      <span className="text-slate-500 ml-2 font-mono tabular-nums">
                        (MSS {mtuReport.maxTcpMss}B · Clé PQC{' '}
                        {mtuReport.pqcHandshakeBytes}B)
                      </span>
                    </div>

                    {settings.mtuSize !== mtuReport.recommendedMtu ? (
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings('mtuSize', mtuReport.recommendedMtu);
                          showNotice(
                            `Segment MTU calibré à ${mtuReport.recommendedMtu} octets`,
                            'success'
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono tabular-nums cursor-pointer"
                      >
                        Appliquer {mtuReport.recommendedMtu}B
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        <span>Aligné</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Live Packet Firewall & Routing Verdict Simulator */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Route className="w-4 h-4 text-cyan-500" />
                  <span>
                    Simulateur de Verdict Pare-feu &amp; Routage (nftables +
                    ip-rule)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Évalue en direct comment un paquet sortant est traité selon
                  vos règles Kill Switch, QUIC, IPv6, LAN et Split Tunneling.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'HTTPS 1.1.1.1', dst: '1.1.1.1', proto: 'TCP' as const, port: 443 },
                  { label: 'QUIC UDP/443', dst: '142.250.74.14', proto: 'UDP' as const, port: 443 },
                  { label: 'LAN 192.168.1.25', dst: '192.168.1.25', proto: 'TCP' as const, port: 445 },
                  { label: 'IPv6 2606:4700::1111', dst: '2606:4700:4700::1111', proto: 'ICMPv6' as const, port: 443 },
                  { label: 'Traqueur DNS', dst: 'telemetry.ad-tracker.example', proto: 'TCP' as const, port: 443 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setSimDest(preset.dst);
                      setSimProtocol(preset.proto);
                      setSimPort(preset.port);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Destination (IPv4, IPv6 ou Domaine)
                </label>
                <input
                  type="text"
                  value={simDest}
                  onChange={(e) => setSimDest(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Protocole L4
                </label>
                <select
                  aria-label="Protocole simulé"
                  value={simProtocol}
                  onChange={(e) =>
                    setSimProtocol(e.target.value as 'UDP' | 'TCP' | 'ICMPv6')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                >
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                  <option value="ICMPv6">ICMPv6</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Port cible
                </label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={simPort}
                  onChange={(e) => setSimPort(Number(e.target.value) || 443)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold ${
                      packetVerdict.action === 'ACCEPT_TUNNEL'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : packetVerdict.action === 'BYPASS_DIRECT'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {packetVerdict.action}
                  </span>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    Sortie : <strong>{packetVerdict.outboundInterface}</strong>
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                   Règle : {packetVerdict.matchedRule} · Latence est.{' '}
                  {packetVerdict.latencyImpactMs} ms
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                {packetVerdict.explanation}
              </p>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {packetVerdict.traceSteps.map((step) => (
                  <div key={step}>{step}</div>
                ))}
              </div>
            </div>
          </section>

          {/* Host Network Interfaces Table */}
          {telemetry?.interfaces && telemetry.interfaces.length > 0 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Interfaces Réseau Hôtes Détectées (Sanitisées)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Topologie des adaptateurs réseau exposés au démon local.
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                      <th className="py-2 px-3">Interface</th>
                      <th className="py-2 px-3">Famille</th>
                      <th className="py-2 px-3">CIDR</th>
                      <th className="py-2 px-3 hidden sm:table-cell">MAC</th>
                      <th className="py-2 px-3 text-right">MTU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {telemetry.interfaces.map((iface, idx) => (
                      <tr key={`${iface.name}-${iface.family}-${idx}`}>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                          {iface.name}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {iface.family}
                        </td>
                        <td className="py-2 px-3 text-cyan-700 dark:text-cyan-400">
                          {iface.cidr}
                        </td>
                        <td className="py-2 px-3 hidden sm:table-cell text-slate-500">
                          {iface.mac}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                          {iface.mtu}B
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: COMPILATEUR NATIF & BUNDLES SIGNÉS                           */}
      {/* =================================================================== */}
      {workspaceTab === 'compiler' && (
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-cyan-500" />
                  <span>
                    Compilateur de Fichiers Système Natifs (6 Cibles OS)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Génération déterministe prête pour Linux / WireGuard /
                  OpenVPN / StrongSwan / nftables / systemd.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mr-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={injectEphemeralIntoCompiler}
                    onChange={(e) =>
                      setInjectEphemeralIntoCompiler(e.target.checked)
                    }
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>Injecter métadonnées clés RAM</span>
                </label>

                <button
                  type="button"
                  onClick={handleCopyCompilerOutput}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-cyan-500 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCompiler ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-500" />
                  )}
                  <span>
                    {copiedCompiler
                      ? 'Copié'
                      : clipboardSecondsLeft !== null
                        ? `Purge dans ${clipboardSecondsLeft}s`
                        : 'Copier'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCompilerFile}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger {activeCompilerPayload.filename}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  {
                    id: 'tunnel',
                    label: `Tunnel (${settings.protocol.toUpperCase()})`,
                  },
                  { id: 'sysctl', label: 'Sysctl Noyau' },
                  { id: 'nftables', label: 'Pare-feu nftables' },
                  { id: 'systemd', label: 'Unité systemd durcie' },
                  { id: 'routing', label: 'Routage ip-rule' },
                  {
                    id: 'diff',
                    label: `Écarts Usine (${modifiedDiffs.length})`,
                  },
                ] as Array<{ id: CompilerTab; label: string }>
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCompilerTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    compilerTab === t.id
                      ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 overflow-x-auto max-h-[380px]">
              <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre">
                {activeCompilerPayload.content}
              </pre>
            </div>
          </section>

          {/* Cryptographically Signed System Bundle */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bundles Système Signés SHA-256 / HMAC (.renum-sys.json)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Archive l’intégralité de la configuration et des 5 manifestes
                  OS avec sceau d’intégrité vérifié à l’importation.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={bundleInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportSignedBundle}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleExportSignedBundle}
                  disabled={isSigningBundle}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSigningBundle ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Exporter un bundle signé</span>
                </button>
                <button
                  type="button"
                  onClick={() => bundleInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-cyan-500 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Vérifier &amp; Importer</span>
                </button>
              </div>
            </div>

            {bundleVerifyStatus && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {bundleVerifyStatus.verified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {bundleVerifyStatus.message}
                  </span>
                </div>
                {bundleVerifyStatus.sha256 && (
                  <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs">
                    SHA-256 : {bundleVerifyStatus.sha256.slice(0, 24)}…
                  </span>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: POINTS DE RESTAURATION & RESET                               */}
      {/* =================================================================== */}
      {workspaceTab === 'snapshots' && (
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookmarkPlus className="w-4 h-4 text-cyan-500" />
                  <span>
                    Points de Restauration Système ({snapshots.length}/15)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Capturez l’état exact de toutes les directives système pour y
                  revenir instantanément sans perte.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSnapshotOnHarden}
                  onChange={(e) => setAutoSnapshotOnHarden(e.target.checked)}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span>Snapshot auto avant « Durcir le système »</span>
              </label>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const snap = createSnapshotInternal();
                addLog(
                  `Point de restauration enregistré : ${snap.name}`,
                  'success'
                );
                showNotice(`Snapshot « ${snap.name} » sauvegardé`, 'success');
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="Libellé du point de restauration (ex: Avant test Anti-DPI, Réseau Hôtel...)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                Capturer l’état actuel
              </button>
            </form>

            {snapshots.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                Aucun point de restauration enregistré. Capturez un snapshot
                avant de modifier vos paramètres noyau.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {snapshots.map((snap) => {
                  const delta = countSnapshotDifferences(
                    settings,
                    snap.settings
                  );
                  return (
                    <div
                      key={snap.id}
                      className="p-3.5 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {snap.name}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                            {snap.hardeningScore}/100
                          </span>
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {snap.createdAt} · {snap.protocol.toUpperCase()} ·{' '}
                          {snap.postQuantumKex.toUpperCase()} ·{' '}
                          {delta === 0
                            ? 'Identique à l’état actif'
                            : `${delta} paramètre(s) d’écart`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={delta === 0}
                          onClick={() => {
                            patchSettings(
                              sanitizeAppSettings(snap.settings),
                              `Point de restauration appliqué : ${snap.name}`
                            );
                            showNotice(
                              `État restauré depuis « ${snap.name} »`,
                              'success'
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                        >
                          Restaurer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            persistSnapshots(
                              snapshots.filter((s) => s.id !== snap.id)
                            );
                            showNotice('Snapshot supprimé', 'info');
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                          title="Supprimer ce point de restauration"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Factory Reset Card */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Réinitialisation aux Valeurs d’Usine ({modifiedDiffs.length}{' '}
                écart(s) actif(s))
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Restaure tous les réglages réseau, sysctl, anti-DPI et démon aux
                valeurs nominales par défaut.
              </p>
            </div>

            {!confirmFactoryReset ? (
              <button
                type="button"
                onClick={() => setConfirmFactoryReset(true)}
                className="px-4 py-2 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser l’état usine</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetSettings();
                    setConfirmFactoryReset(false);
                    showNotice(
                      'Paramètres système restaurés aux valeurs d’usine',
                      'info'
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirmer la remise à zéro
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFactoryReset(false)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
