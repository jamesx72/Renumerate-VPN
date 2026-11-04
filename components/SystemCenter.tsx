import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Activity,
  HardDrive,
  Server,
  Terminal,
  Download,
  Copy,
  Check,
  RefreshCw,
  Play,
  Loader2,
  Sliders,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  Search,
  Zap,
  FileCode2,
} from 'lucide-react';
import {
  AppSettings,
  VirtualIdentity,
  SystemRuntimeTelemetry,
  TcpCongestionControl,
  PostQuantumKex,
  SystemPowerProfile,
} from '../types';
import {
  DEFAULT_APP_SETTINGS,
  computeSettingsHardeningScore,
  compileNativeTunnelConfig,
  compileSysctlConfig,
  compileNftablesConfig,
  computeModifiedSettingsDiff,
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

type CompilerTab = 'tunnel' | 'sysctl' | 'nftables' | 'diff';
type SubsystemCategoryFilter = 'all' | 'kernel' | 'egress' | 'governance';

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
  const [telemetry, setTelemetry] = useState<SystemRuntimeTelemetry | null>(
    null
  );
  const [telemetryRttMs, setTelemetryRttMs] = useState<number | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(true);

  const [storageInfo, setStorageInfo] = useState<{
    usedKb: number;
    quotaMb: number;
  } | null>(null);

  const [isBenchmarkingCrypto, setIsBenchmarkingCrypto] = useState(false);
  const [cryptoBench, setCryptoBench] = useState<{
    mbPerSec: number;
    avgLatencyMs: number;
  } | null>(null);

  const [subsystemFilter, setSubsystemFilter] =
    useState<SubsystemCategoryFilter>('all');
  const [subsystemSearch, setSubsystemSearch] = useState('');

  const [compilerTab, setCompilerTab] = useState<CompilerTab>('tunnel');
  const [copiedCompiler, setCopiedCompiler] = useState(false);
  const [clipboardSecondsLeft, setClipboardSecondsLeft] = useState<
    number | null
  >(null);
  const clipboardIntervalRef = useRef<number | null>(null);

  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [confirmPanicRun, setConfirmPanicRun] = useState(false);

  const [isRunningSelfTest, setIsRunningSelfTest] = useState(false);
  const [selfTests, setSelfTests] = useState<SelfTestRow[]>([]);

  const hardeningScore = useMemo(
    () => computeSettingsHardeningScore(settings),
    [settings]
  );

  const tunnelConfig = useMemo(
    () => compileNativeTunnelConfig(settings, currentIdentity),
    [settings, currentIdentity]
  );
  const sysctlConfig = useMemo(() => compileSysctlConfig(settings), [settings]);
  const nftablesConfig = useMemo(
    () => compileNftablesConfig(settings, currentIdentity),
    [settings, currentIdentity]
  );
  const modifiedDiffs = useMemo(
    () => computeModifiedSettingsDiff(settings),
    [settings]
  );

  const fetchRuntimeTelemetry = useCallback(async () => {
    setIsLoadingTelemetry(true);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/system/diagnostics', {
        cache: 'no-store',
      });
      const elapsed = Math.max(1, Math.round(performance.now() - t0));
      if (res.ok) {
        const data = (await res.json()) as SystemRuntimeTelemetry;
        setTelemetry(data);
        setTelemetryRttMs(elapsed);
      }
    } catch {
      // Fallback silencieux si mode statique
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, []);

  const refreshStorageEstimate = useCallback(async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usedKb = Math.max(1, Math.round((est.usage || 0) / 1024));
        const quotaMb = Math.max(
          1,
          Math.round((est.quota || 0) / (1024 * 1024))
        );
        setStorageInfo({ usedKb, quotaMb });
      }
    } catch {
      // Non supporté
    }
  }, []);

  useEffect(() => {
    fetchRuntimeTelemetry();
    refreshStorageEstimate();
  }, [fetchRuntimeTelemetry, refreshStorageEstimate, logsCount, sessionsCount, vaultCount]);

  useEffect(() => {
    return () => {
      if (clipboardIntervalRef.current !== null) {
        window.clearInterval(clipboardIntervalRef.current);
      }
    };
  }, []);

  const runWebCryptoBenchmark = async () => {
    if (isBenchmarkingCrypto) return;
    setIsBenchmarkingCrypto(true);
    try {
      const subtle = window.crypto?.subtle;
      if (!subtle) {
        throw new Error('WebCrypto indisponible');
      }
      const key = await subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      const chunkBytes = 65536; // 64 KB
      const plain = new Uint8Array(chunkBytes);
      window.crypto.getRandomValues(plain);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const iterations = 64;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        iv[11] = i & 0xff;
        await subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
      }
      const totalMs = Math.max(0.5, performance.now() - start);
      const totalMb = (chunkBytes * iterations) / (1024 * 1024);
      const mbPerSec = Math.round((totalMb / totalMs) * 1000);
      const avgLatencyMs = parseFloat((totalMs / iterations).toFixed(2));

      setCryptoBench({ mbPerSec, avgLatencyMs });
      addLog(
        `Benchmark WebCrypto AES-256-GCM terminé : ${mbPerSec} Mo/s (${avgLatencyMs} ms/bloc)`,
        'success'
      );
    } catch {
      addLog('Impossible d’exécuter le banc d’essai WebCrypto local', 'error');
    } finally {
      setIsBenchmarkingCrypto(false);
    }
  };

  const handleAutoHardenWeaknesses = () => {
    patchSettings(
      {
        killSwitch: true,
        killSwitchMode: 'strict',
        dnsLeakProtection: true,
        ipv6LeakProtection: true,
        webrtcLeakShield: true,
        postQuantumKex: 'ml-kem-1024',
        blockQuicUdp443: true,
        blockCaptivePortalProbes: true,
        arpSpoofGuard: true,
        strictReversePathFilter: true,
        mssClamping: true,
        autoLockVaultMinutes:
          settings.autoLockVaultMinutes === 0
            ? 15
            : settings.autoLockVaultMinutes,
      },
      'Durcissement système automatique appliqué (PQC ML-KEM-1024 + Pare-feu Egress Strict)'
    );
  };

  const runFullSystemSelfTest = async () => {
    if (isRunningSelfTest) return;
    setIsRunningSelfTest(true);

    const results: SelfTestRow[] = [];

    // 1. WebCrypto round-trip check
    let cryptoOk = false;
    let cryptoMs = 0;
    try {
      const t0 = performance.now();
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const sample = new TextEncoder().encode('renumerate-integrity-probe-v2');
      const cipher = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        sample
      );
      const plainBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipher
      );
      const decoded = new TextDecoder().decode(plainBuf);
      cryptoOk = decoded === 'renumerate-integrity-probe-v2';
      cryptoMs = Math.max(1, Math.round(performance.now() - t0));
    } catch {
      cryptoOk = false;
    }

    results.push({
      id: 'crypto',
      title: 'Moteur WebCrypto Subtle (AES-256-GCM)',
      subsystem: 'crypto.subtle',
      status: cryptoOk ? 'pass' : 'fail',
      detail: cryptoOk
        ? 'Chiffrement et déchiffrement authentifié vérifiés en RAM'
        : 'API WebCrypto indisponible dans ce contexte navigateur',
      metric: cryptoOk ? `${cryptoMs} ms` : 'ERR',
    });
    setSelfTests([...results]);
    await new Promise((r) => setTimeout(r, 120));

    // 2. Backend Diagnostics API check
    let apiOk = false;
    let apiRtt = 0;
    try {
      const t0 = performance.now();
      const res = await fetch('/api/system/diagnostics', { cache: 'no-store' });
      apiRtt = Math.max(1, Math.round(performance.now() - t0));
      if (res.ok) {
        const payload = (await res.json()) as SystemRuntimeTelemetry;
        setTelemetry(payload);
        setTelemetryRttMs(apiRtt);
        apiOk = true;
      }
    } catch {
      apiOk = false;
    }

    results.push({
      id: 'backend',
      title: 'Passerelle Daemon & Télémétrie Serveur',
      subsystem: '/api/system/diagnostics',
      status: apiOk ? 'pass' : 'warn',
      detail: apiOk
        ? 'Liaison IPC/HTTP locale opérationnelle avec le moteur Express'
        : 'Mode autonome client actif (serveur distant en veille)',
      metric: apiOk ? `${apiRtt} ms` : 'Local',
    });
    setSelfTests([...results]);
    await new Promise((r) => setTimeout(r, 120));

    // 3. Egress Firewall & Kill Switch
    const egressStrong =
      settings.killSwitch &&
      settings.killSwitchMode === 'strict' &&
      settings.blockQuicUdp443 &&
      settings.arpSpoofGuard;
    results.push({
      id: 'egress',
      title: 'Pare-feu Egress, QUIC UDP/443 & Garde ARP',
      subsystem: 'nftables / arp_guard',
      status: egressStrong ? 'pass' : 'warn',
      detail: egressStrong
        ? 'Kill Switch strict, rejet QUIC HTTP/3 et anti-spoofing ARP actifs'
        : 'Protection sortante partielle (Kill Switch souple ou QUIC/ARP non filtrés)',
      metric: settings.killSwitch ? settings.killSwitchMode.toUpperCase() : 'OFF',
      fixLabel: egressStrong ? undefined : 'Verrouiller',
      onFix: egressStrong
        ? undefined
        : () => {
            patchSettings(
              {
                killSwitch: true,
                killSwitchMode: 'strict',
                blockQuicUdp443: true,
                arpSpoofGuard: true,
              },
              'Pare-feu Egress corrigé depuis l’auto-diagnostic système'
            );
          },
    });
    setSelfTests([...results]);
    await new Promise((r) => setTimeout(r, 120));

    // 4. Leak Shield (DNS / IPv6 / WebRTC)
    const leakShieldOk =
      settings.dnsLeakProtection &&
      settings.ipv6LeakProtection &&
      settings.webrtcLeakShield;
    results.push({
      id: 'leaks',
      title: 'Cloisonnement Anti-Fuite (DNS, IPv6, WebRTC)',
      subsystem: 'net.ipv6 / edns0',
      status: leakShieldOk ? 'pass' : 'warn',
      detail: leakShieldOk
        ? `Résolveur ${settings.dns.toUpperCase()} isolé, IPv6 désactivé et STUN masqué`
        : 'Au moins un bouclier anti-fuite (DNS, IPv6 ou WebRTC) est désactivé',
      metric: leakShieldOk ? '3/3 actifs' : 'Partiel',
      fixLabel: leakShieldOk ? undefined : 'Activer 3/3',
      onFix: leakShieldOk
        ? undefined
        : () => {
            patchSettings(
              {
                dnsLeakProtection: true,
                ipv6LeakProtection: true,
                webrtcLeakShield: true,
              },
              'Boucliers DNS, IPv6 et WebRTC réactivés'
            );
          },
    });
    setSelfTests([...results]);
    await new Promise((r) => setTimeout(r, 120));

    // 5. MTU & MSS Clamping
    const overhead =
      settings.protocol === 'wireguard'
        ? 80
        : settings.protocol === 'ikev2'
          ? 76
          : 69;
    const mtuClean = settings.mtuSize + overhead <= 1500 && settings.mssClamping;
    results.push({
      id: 'mtu',
      title: 'Segment Path-MTU & Clamping TCP MSS',
      subsystem: 'tcp_mtu_probing',
      status: mtuClean ? 'pass' : 'warn',
      detail: mtuClean
        ? `Trame totale ${settings.mtuSize + overhead} octets <= 1500B avec MSS dynamique`
        : `Trame ${settings.mtuSize + overhead}B ou Clamping MSS inactif (risque de fragmentation)`,
      metric: `${settings.mtuSize}B`,
      fixLabel: mtuClean ? undefined : 'Calibrer 1420B',
      onFix: mtuClean
        ? undefined
        : () => {
            patchSettings(
              { mtuSize: 1420, mssClamping: true },
              'MTU calibré à 1420 octets avec ajustement MSS actif'
            );
          },
    });
    setSelfTests([...results]);
    await new Promise((r) => setTimeout(r, 120));

    // 6. Post-Quantum KEX
    const isPqc = settings.postQuantumKex !== 'classic-x25519';
    results.push({
      id: 'pqc',
      title: 'Résistance Post-Quantique (Harvest-Now Decrypt-Later)',
      subsystem: 'wg0.pqc_kex',
      status: isPqc ? 'pass' : 'warn',
      detail: isPqc
        ? `Échange hybride ${settings.postQuantumKex.toUpperCase()} actif sur l'établissement de clé`
        : 'Échange X25519 classique uniquement (sans encapsulation post-quantique)',
      metric: settings.postQuantumKex.toUpperCase(),
      fixLabel: isPqc ? undefined : 'Activer ML-KEM',
      onFix: isPqc
        ? undefined
        : () => {
            updateSettings('postQuantumKex', 'ml-kem-1024');
          },
    });
    setSelfTests([...results]);
    await new Promise((r) => setTimeout(r, 120));

    // 7. Operational Memory Hygiene
    const hygieneOk =
      settings.autoLockVaultMinutes > 0 && settings.clipboardAutoClearSeconds > 0;
    results.push({
      id: 'hygiene',
      title: 'Hygiène Mémoire RAM & Presse-papiers',
      subsystem: 'daemon.hygiene',
      status: hygieneOk ? 'pass' : 'warn',
      detail: hygieneOk
        ? `Verrouillage coffre ${settings.autoLockVaultMinutes}m · Purge presse-papiers ${settings.clipboardAutoClearSeconds}s`
        : 'Verrouillage auto du coffre ou nettoyage du presse-papiers désactivé',
      metric:
        settings.autoLockVaultMinutes > 0
          ? `${settings.autoLockVaultMinutes} min`
          : 'Manuel',
      fixLabel: hygieneOk ? undefined : 'Sécuriser',
      onFix: hygieneOk
        ? undefined
        : () => {
            patchSettings(
              {
                autoLockVaultMinutes: 15,
                clipboardAutoClearSeconds: 30,
              },
              'Politique d’hygiène RAM et presse-papiers activée (15m / 30s)'
            );
          },
    });

    setSelfTests(results);
    setIsRunningSelfTest(false);
    const passCount = results.filter((r) => r.status === 'pass').length;
    addLog(
      `Auto-diagnostic système terminé : ${passCount}/${results.length} contrôles conformes`,
      passCount === results.length ? 'success' : 'info'
    );
  };

  // Re-evaluate self-test statuses live when settings change after a run
  useEffect(() => {
    if (selfTests.length === 0 || isRunningSelfTest) return;
    setSelfTests((prev) =>
      prev.map((row) => {
        if (row.id === 'egress') {
          const ok =
            settings.killSwitch &&
            settings.killSwitchMode === 'strict' &&
            settings.blockQuicUdp443 &&
            settings.arpSpoofGuard;
          return {
            ...row,
            status: ok ? 'pass' : 'warn',
            detail: ok
              ? 'Kill Switch strict, rejet QUIC HTTP/3 et anti-spoofing ARP actifs'
              : 'Protection sortante partielle (Kill Switch souple ou QUIC/ARP non filtrés)',
            metric: settings.killSwitch
              ? settings.killSwitchMode.toUpperCase()
              : 'OFF',
            fixLabel: ok ? undefined : row.fixLabel,
          };
        }
        if (row.id === 'leaks') {
          const ok =
            settings.dnsLeakProtection &&
            settings.ipv6LeakProtection &&
            settings.webrtcLeakShield;
          return {
            ...row,
            status: ok ? 'pass' : 'warn',
            detail: ok
              ? `Résolveur ${settings.dns.toUpperCase()} isolé, IPv6 désactivé et STUN masqué`
              : 'Au moins un bouclier anti-fuite (DNS, IPv6 ou WebRTC) est désactivé',
            metric: ok ? '3/3 actifs' : 'Partiel',
            fixLabel: ok ? undefined : row.fixLabel,
          };
        }
        if (row.id === 'mtu') {
          const overhead =
            settings.protocol === 'wireguard'
              ? 80
              : settings.protocol === 'ikev2'
                ? 76
                : 69;
          const ok =
            settings.mtuSize + overhead <= 1500 && settings.mssClamping;
          return {
            ...row,
            status: ok ? 'pass' : 'warn',
            detail: ok
              ? `Trame totale ${settings.mtuSize + overhead} octets <= 1500B avec MSS dynamique`
              : `Trame ${settings.mtuSize + overhead}B ou Clamping MSS inactif`,
            metric: `${settings.mtuSize}B`,
            fixLabel: ok ? undefined : row.fixLabel,
          };
        }
        if (row.id === 'pqc') {
          const ok = settings.postQuantumKex !== 'classic-x25519';
          return {
            ...row,
            status: ok ? 'pass' : 'warn',
            detail: ok
              ? `Échange hybride ${settings.postQuantumKex.toUpperCase()} actif sur l'établissement de clé`
              : 'Échange X25519 classique uniquement',
            metric: settings.postQuantumKex.toUpperCase(),
            fixLabel: ok ? undefined : row.fixLabel,
          };
        }
        if (row.id === 'hygiene') {
          const ok =
            settings.autoLockVaultMinutes > 0 &&
            settings.clipboardAutoClearSeconds > 0;
          return {
            ...row,
            status: ok ? 'pass' : 'warn',
            detail: ok
              ? `Verrouillage coffre ${settings.autoLockVaultMinutes}m · Purge presse-papiers ${settings.clipboardAutoClearSeconds}s`
              : 'Verrouillage auto du coffre ou nettoyage du presse-papiers désactivé',
            metric:
              settings.autoLockVaultMinutes > 0
                ? `${settings.autoLockVaultMinutes} min`
                : 'Manuel',
            fixLabel: ok ? undefined : row.fixLabel,
          };
        }
        return row;
      })
    );
  }, [settings, isRunningSelfTest, selfTests.length]);

  const activeCompiledFile = useMemo(() => {
    if (compilerTab === 'sysctl') return sysctlConfig;
    if (compilerTab === 'nftables') return nftablesConfig;
    return tunnelConfig;
  }, [compilerTab, sysctlConfig, nftablesConfig, tunnelConfig]);

  const handleCopyActiveConfig = async () => {
    try {
      await navigator.clipboard.writeText(activeCompiledFile.content);
      setCopiedCompiler(true);
      window.setTimeout(() => setCopiedCompiler(false), 1800);
      addLog(
        `Configuration système copiée (${activeCompiledFile.filename})`,
        'info'
      );

      if (clipboardIntervalRef.current !== null) {
        window.clearInterval(clipboardIntervalRef.current);
        clipboardIntervalRef.current = null;
      }

      if (settings.clipboardAutoClearSeconds > 0) {
        setClipboardSecondsLeft(settings.clipboardAutoClearSeconds);
        clipboardIntervalRef.current = window.setInterval(() => {
          setClipboardSecondsLeft((prev) => {
            if (prev === null || prev <= 1) {
              if (clipboardIntervalRef.current !== null) {
                window.clearInterval(clipboardIntervalRef.current);
                clipboardIntervalRef.current = null;
              }
              navigator.clipboard.writeText('').catch(() => {});
              addLog(
                'Presse-papiers purgé automatiquement (politique d’hygiène système)',
                'info'
              );
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch {
      addLog('Accès au presse-papiers refusé par le navigateur', 'warning');
    }
  };

  const handleDownloadActiveConfig = () => {
    const blob = new Blob([activeCompiledFile.content], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeCompiledFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog(
      `Fichier système téléchargé : ${activeCompiledFile.filename}`,
      'success'
    );
  };

  const subsystemRows = useMemo(
    () => [
      {
        id: 'tcp_cc',
        category: 'kernel' as const,
        name: 'Contrôle de congestion TCP noyau',
        directive: `net.ipv4.tcp_congestion_control = ${settings.tcpCongestionControl}`,
        description:
          'BBR optimise le débit sous perte de paquets ; Hybla stabilise les circuits multi-sauts longue distance.',
        status: 'nominal' as const,
        control: (
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5">
            {(['bbr', 'cubic', 'hybla'] as TcpCongestionControl[]).map((cc) => (
              <button
                key={cc}
                type="button"
                onClick={() => updateSettings('tcpCongestionControl', cc)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold uppercase transition-colors cursor-pointer ${
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
        category: 'kernel' as const,
        name: 'Encapsulation de clés Post-Quantique (PQC)',
        directive: `kex.hybrid = ${settings.postQuantumKex}`,
        description:
          'Protège les sessions chiffrées contre la collecte rétroactive quantique (FIPS-203 ML-KEM-1024).',
        status:
          settings.postQuantumKex !== 'classic-x25519'
            ? ('nominal' as const)
            : ('warning' as const),
        control: (
          <select
            value={settings.postQuantumKex}
            onChange={(e) =>
              updateSettings('postQuantumKex', e.target.value as PostQuantumKex)
            }
            aria-label="Échange de clés Post-Quantique"
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ml-kem-1024">ML-KEM-1024 + X25519</option>
            <option value="sntrup761">sntrup761 + X25519</option>
            <option value="classic-x25519">X25519 Classique</option>
          </select>
        ),
      },
      {
        id: 'mss_clamp',
        category: 'kernel' as const,
        name: 'Ajustement dynamique TCP MSS (Clamp-to-PMTU)',
        directive: `net.ipv4.tcp_mtu_probing = ${settings.mssClamping ? 1 : 0}`,
        description:
          'Recalibre automatiquement la taille maximale des segments SYN pour éviter les trous noirs PMTU.',
        status: settings.mssClamping
          ? ('nominal' as const)
          : ('warning' as const),
        control: (
          <button
            type="button"
            onClick={() => updateSettings('mssClamping', !settings.mssClamping)}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
              settings.mssClamping
                ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            {settings.mssClamping ? 'ACTIF' : 'INACTIF'}
          </button>
        ),
      },
      {
        id: 'multiqueue',
        category: 'kernel' as const,
        name: 'Parallélisation Multi-Queue TUN (RSS)',
        directive: `tun.iff_multi_queue = ${settings.multiQueueTun ? 'on' : 'off'}`,
        description:
          'Répartit le chiffrement/déchiffrement des files virtuelles sur l’ensemble des cœurs logiques.',
        status: settings.multiQueueTun
          ? ('nominal' as const)
          : ('idle' as const),
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('multiQueueTun', !settings.multiQueueTun)
            }
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
              settings.multiQueueTun
                ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            {settings.multiQueueTun ? 'ACTIF' : 'MONO-FILE'}
          </button>
        ),
      },
      {
        id: 'quic_block',
        category: 'egress' as const,
        name: 'Verrouillage HTTP/3 QUIC (UDP/443)',
        directive: `nft.egress.udp_443 = ${settings.blockQuicUdp443 ? 'reject' : 'accept'}`,
        description:
          'Force le repli TLS 1.3 sur TCP afin d’empêcher les fuites d’empreinte UDP hors inspection.',
        status: settings.blockQuicUdp443
          ? ('nominal' as const)
          : ('warning' as const),
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('blockQuicUdp443', !settings.blockQuicUdp443)
            }
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
              settings.blockQuicUdp443
                ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {settings.blockQuicUdp443 ? 'FILTRÉ' : 'OUVERT'}
          </button>
        ),
      },
      {
        id: 'arp_guard',
        category: 'egress' as const,
        name: 'Garde ARP Anti-Spoofing Couche 2',
        directive: `net.ipv4.conf.all.drop_gratuitous_arp = ${settings.arpSpoofGuard ? 1 : 0}`,
        description:
          'Rejette les annonces ARP gratuites suspectes pour contrer les interceptions MitM sur Wi-Fi public.',
        status: settings.arpSpoofGuard
          ? ('nominal' as const)
          : ('warning' as const),
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings('arpSpoofGuard', !settings.arpSpoofGuard)
            }
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
              settings.arpSpoofGuard
                ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {settings.arpSpoofGuard ? 'PROTÉGÉ' : 'DÉSACTIVÉ'}
          </button>
        ),
      },
      {
        id: 'rp_filter',
        category: 'egress' as const,
        name: 'Validation stricte de route source (rp_filter)',
        directive: `net.ipv4.conf.all.rp_filter = ${settings.strictReversePathFilter ? 1 : 0}`,
        description:
          'Écarte tout paquet entrant dont l’adresse source ne correspond pas à la table de routage retour.',
        status: settings.strictReversePathFilter
          ? ('nominal' as const)
          : ('warning' as const),
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings(
                'strictReversePathFilter',
                !settings.strictReversePathFilter
              )
            }
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
              settings.strictReversePathFilter
                ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            {settings.strictReversePathFilter ? 'STRICT (1)' : 'LÂCHE (0)'}
          </button>
        ),
      },
      {
        id: 'captive_probes',
        category: 'egress' as const,
        name: 'Neutralisation des sondes OS & Portail Captif',
        directive: `os.connectivity_probes = ${settings.blockCaptivePortalProbes ? 'blocked' : 'allow'}`,
        description:
          'Intercepte les requêtes automatiques de connectivité OS avant l’établissement complet du tunnel.',
        status: settings.blockCaptivePortalProbes
          ? ('nominal' as const)
          : ('idle' as const),
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings(
                'blockCaptivePortalProbes',
                !settings.blockCaptivePortalProbes
              )
            }
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
              settings.blockCaptivePortalProbes
                ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            {settings.blockCaptivePortalProbes ? 'BLOQUÉ' : 'AUTORISÉ'}
          </button>
        ),
      },
      {
        id: 'power_profile',
        category: 'governance' as const,
        name: 'Gouvernance énergétique du démon VPN',
        directive: `daemon.scheduler_profile = ${settings.powerProfile}`,
        description:
          'Module la cadence d’échantillonnage télémétrique et l’allocation bande passante (Éco / Équilibré / Max).',
        status: 'nominal' as const,
        control: (
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5">
            {(
              [
                { id: 'eco', label: 'Éco' },
                { id: 'balanced', label: 'Équilibré' },
                { id: 'performance', label: 'Perf' },
              ] as Array<{ id: SystemPowerProfile; label: string }>
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateSettings('powerProfile', p.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
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
        category: 'governance' as const,
        name: 'Verrouillage d’inactivité de la clé Coffre-fort RAM',
        directive: `vault.ram_key_ttl = ${settings.autoLockVaultMinutes === 0 ? 'infinite' : `${settings.autoLockVaultMinutes}m`}`,
        description:
          'Efface automatiquement la clé dérivée PBKDF2 en mémoire vive après une période sans interaction.',
        status:
          settings.autoLockVaultMinutes > 0
            ? ('nominal' as const)
            : ('warning' as const),
        control: (
          <select
            value={settings.autoLockVaultMinutes}
            onChange={(e) =>
              updateSettings('autoLockVaultMinutes', Number(e.target.value))
            }
            aria-label="Délai de verrouillage du coffre-fort"
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
            <option value={0}>Désactivé</option>
          </select>
        ),
      },
      {
        id: 'privacy_blur',
        category: 'governance' as const,
        name: 'Voile furtif anti-regard hors focus',
        directive: `ui.blur_on_inactive = ${settings.privacyScreenBlurOnInactive ? 'true' : 'false'}`,
        description:
          'Masque automatiquement les adresses IP, MAC et soldes dès que l’onglet ou la fenêtre perd le focus.',
        status: settings.privacyScreenBlurOnInactive
          ? ('nominal' as const)
          : ('idle' as const),
        control: (
          <button
            type="button"
            onClick={() =>
              updateSettings(
                'privacyScreenBlurOnInactive',
                !settings.privacyScreenBlurOnInactive
              )
            }
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
              settings.privacyScreenBlurOnInactive
                ? 'bg-cyan-600 text-white border-cyan-600'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            {settings.privacyScreenBlurOnInactive ? 'ACTIF' : 'DÉSACTIVÉ'}
          </button>
        ),
      },
    ],
    [settings, updateSettings]
  );

  const filteredSubsystems = useMemo(() => {
    const q = subsystemSearch.trim().toLowerCase();
    return subsystemRows.filter((row) => {
      const catOk =
        subsystemFilter === 'all' || row.category === subsystemFilter;
      const searchOk =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.directive.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q);
      return catOk && searchOk;
    });
  }, [subsystemRows, subsystemFilter, subsystemSearch]);

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Architecture Système &amp; Noyau
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pilotez les paramètres bas-niveau du tunnel, l&apos;encapsulation post-quantique, les règles pare-feu sortantes et les fichiers natifs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={runFullSystemSelfTest}
            disabled={isRunningSelfTest}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
          >
            {isRunningSelfTest ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>
              {isRunningSelfTest
                ? 'Diagnostic en cours...'
                : 'Auto-diagnostic (7 tests)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
          >
            <Sliders className="w-4 h-4 text-cyan-500" />
            <span>Tous les paramètres</span>
          </button>
        </div>
      </div>

      {/* 4-Column Flat KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hardening Posture */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Indice de durcissement
              </div>
              <div className="text-2xl font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1">
                {hardeningScore}
                <span className="text-sm text-slate-400 font-normal">/100</span>
              </div>
            </div>
            <div
              className={`p-2 rounded-xl border ${
                hardeningScore >= 82
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  hardeningScore >= 82
                    ? 'bg-emerald-500'
                    : hardeningScore >= 60
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${hardeningScore}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {isEmergency
                  ? 'Verrouillage actif'
                  : hardeningScore >= 85
                    ? 'Posture Forteresse'
                    : 'Marge de durcissement'}
              </span>
              {hardeningScore < 92 && (
                <button
                  type="button"
                  onClick={handleAutoHardenWeaknesses}
                  className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Durcir auto.
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Cryptographic Engine & Live WebCrypto Bench */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Pile Cryptographique
              </div>
              <div className="text-base font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1 truncate">
                {settings.protocol.toUpperCase()} ·{' '}
                {settings.postQuantumKex === 'ml-kem-1024'
                  ? 'ML-KEM-1024'
                  : settings.postQuantumKex === 'sntrup761'
                    ? 'SNTRUP761'
                    : 'X25519'}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {cryptoBench
                ? `${cryptoBench.mbPerSec} Mo/s (${cryptoBench.avgLatencyMs}ms)`
                : 'AES-256-GCM Subtle'}
            </span>
            <button
              type="button"
              onClick={runWebCryptoBenchmark}
              disabled={isBenchmarkingCrypto}
              className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {isBenchmarkingCrypto ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              <span>{cryptoBench ? 'Relancer' : 'Tester débit'}</span>
            </button>
          </div>
        </div>

        {/* Card 3: Local Storage & RAM Key Hygiene */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Persistance &amp; Clé RAM
              </div>
              <div className="text-base font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1">
                {storageInfo ? `${storageInfo.usedKb} Ko utilisés` : 'IndexedDB actif'}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate">
              {logsCount} logs · {sessionsCount} sess. · {vaultCount} coffre
            </span>
            {vaultUnlocked ? (
              <button
                type="button"
                onClick={() => {
                  onLockVault();
                  addLog(
                    'Clé maîtresse PBKDF2 purgée manuellement de la RAM',
                    'info'
                  );
                }}
                className="font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Unlock className="w-3 h-3" />
                <span>Purger clé RAM</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                <Lock className="w-3 h-3" />
                <span>RAM isolée</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Backend Runtime Telemetry */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Runtime &amp; Démon Hôte
              </div>
              {isLoadingTelemetry && !telemetry ? (
                <div className="h-6 w-36 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mt-1" />
              ) : (
                <div className="text-base font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1 truncate">
                  {telemetry
                    ? `${telemetry.platform}/${telemetry.arch} · ${telemetry.cpuCores} cœurs`
                    : `${isConnected ? 'Tunnel actif' : 'Veille locale'}`}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={fetchRuntimeTelemetry}
              title="Actualiser la télémétrie du démon"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingTelemetry ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {telemetry ? (
              <>
                <span>
                  Heap {telemetry.memoryHeapUsedMb} Mo · Uptime{' '}
                  {formatUptime(telemetry.uptimeSeconds)}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {telemetryRttMs ?? 2} ms
                </span>
              </>
            ) : (
              <>
                <span>Profil {settings.powerProfile.toUpperCase()}</span>
                <span>MTU {settings.mtuSize}B</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Interactive 7-Stage System Self-Test Results (rendered when executed or empty prompt card) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-cyan-500 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Contrôle d&apos;intégrité des sous-systèmes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vérifie en direct le chiffrement WebCrypto, la passerelle serveur, le pare-feu sortant et la conformité post-quantique.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!confirmPanicRun ? (
              <button
                type="button"
                onClick={() => setConfirmPanicRun(true)}
                className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Protocole Panique</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onExecutePanic();
                    setConfirmPanicRun(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Exécuter Panique
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmPanicRun(false)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={runFullSystemSelfTest}
              disabled={isRunningSelfTest}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {isRunningSelfTest ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{selfTests.length > 0 ? 'Relancer' : 'Exécuter'}</span>
            </button>
          </div>
        </div>

        {selfTests.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Server className="w-7 h-7 text-slate-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Aucun cycle d&apos;auto-diagnostic exécuté durant cette session
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Lancez la séquence de 7 tests pour auditer vos paramètres noyau, mesurer la latence WebCrypto et détecter tout vecteur de fuite.
            </p>
            <button
              type="button"
              onClick={runFullSystemSelfTest}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
            >
              Démarrer la vérification système
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {selfTests.map((row) => (
              <div
                key={row.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 mt-1.5 sm:mt-0 ${
                      row.status === 'pass'
                        ? 'bg-emerald-500'
                        : row.status === 'warn'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {row.title}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {row.subsystem}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {row.detail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {row.fixLabel && row.onFix && row.status !== 'pass' && (
                    <button
                      type="button"
                      onClick={row.onFix}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      {row.fixLabel}
                    </button>
                  )}
                  <span
                    className={`font-mono tabular-nums text-xs font-bold min-w-[72px] text-right ${
                      row.status === 'pass'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : row.status === 'warn'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {row.metric}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Interactive Kernel & Daemon Subsystems Table */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Sous-systèmes Noyau, Pare-feu Egress &amp; Gouvernance Démon
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chaque modification ci-dessous met immédiatement à jour le moteur actif et recompile les profils natifs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={subsystemSearch}
                onChange={(e) => setSubsystemSearch(e.target.value)}
                placeholder="Filtrer un module sysctl..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500 w-48"
              />
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              {(
                [
                  { id: 'all', label: 'Tous' },
                  { id: 'kernel', label: 'Noyau' },
                  { id: 'egress', label: 'Egress' },
                  { id: 'governance', label: 'Démon' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubsystemFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    subsystemFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredSubsystems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Aucun sous-système ne correspond au filtre « {subsystemSearch} ».
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredSubsystems.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        item.status === 'nominal'
                          ? 'bg-emerald-500'
                          : item.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </span>
                    <code className="font-mono text-[11px] text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                      {item.directive}
                    </code>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 pl-4">
                    {item.description}
                  </p>
                </div>

                <div className="shrink-0 pl-4 sm:pl-0">{item.control}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Native Configuration Compiler & Factory Drift Inspector */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileCode2 className="w-4 h-4 text-cyan-500 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Compilateur de configurations natives &amp; Audit des écarts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exportez des fichiers prêts pour Linux/macOS/routeur ou inspectez les écarts vis-à-vis de la configuration d&apos;usine.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCompilerTab('tunnel')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                compilerTab === 'tunnel'
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tunnelConfig.formatLabel}
            </button>
            <button
              type="button"
              onClick={() => setCompilerTab('sysctl')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                compilerTab === 'sysctl'
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Sysctl Noyau
            </button>
            <button
              type="button"
              onClick={() => setCompilerTab('nftables')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                compilerTab === 'nftables'
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Pare-feu nftables
            </button>
            <button
              type="button"
              onClick={() => setCompilerTab('diff')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border font-mono tabular-nums cursor-pointer ${
                compilerTab === 'diff'
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Écarts Usine ({modifiedDiffs.length})
            </button>
          </div>
        </div>

        {compilerTab !== 'diff' ? (
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                <span>{activeCompiledFile.filename}</span>
                {clipboardSecondsLeft !== null && (
                  <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                    · Purge presse-papiers dans {clipboardSecondsLeft}s
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyActiveConfig}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCompiler ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-500" />
                  )}
                  <span>{copiedCompiler ? 'Copié' : 'Copier'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadActiveConfig}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger {activeCompiledFile.filename}</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto max-h-80">
              {activeCompiledFile.content}
            </pre>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {modifiedDiffs.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Check className="w-7 h-7 text-emerald-500 mx-auto" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Configuration strictement identique au profil d&apos;usine par défaut
                </div>
                <p className="text-xs text-slate-500">
                  Aucun paramètre système ne dévie actuellement des valeurs recommandées par défaut.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {modifiedDiffs.length}
                    </span>{' '}
                    paramètre(s) personnalisé(s) par rapport à la référence usine.
                  </span>

                  {!confirmFactoryReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmFactoryReset(true)}
                      className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Tout rétablir par défaut</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onResetSettings();
                          setConfirmFactoryReset(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Confirmer réinitialisation
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmFactoryReset(false)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-3.5 font-semibold">Paramètre</th>
                        <th className="py-2.5 px-3.5 font-semibold">Catégorie</th>
                        <th className="py-2.5 px-3.5 font-semibold">Usine</th>
                        <th className="py-2.5 px-3.5 font-semibold">Valeur active</th>
                        <th className="py-2.5 px-3.5 font-semibold text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {modifiedDiffs.map((diff) => (
                        <tr
                          key={String(diff.key)}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                            {diff.label}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400">
                            {diff.category}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-500">
                            {diff.defaultFormatted}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                            {diff.currentFormatted}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (diff.key === 'killSwitch') {
                                  patchSettings(
                                    {
                                      killSwitch: DEFAULT_APP_SETTINGS.killSwitch,
                                      killSwitchMode:
                                        DEFAULT_APP_SETTINGS.killSwitchMode,
                                    },
                                    `Paramètre « ${diff.label} » rétabli`
                                  );
                                } else if (diff.key === 'autoRotation') {
                                  patchSettings(
                                    {
                                      autoRotation:
                                        DEFAULT_APP_SETTINGS.autoRotation,
                                      rotationInterval:
                                        DEFAULT_APP_SETTINGS.rotationInterval,
                                    },
                                    `Paramètre « ${diff.label} » rétabli`
                                  );
                                } else {
                                  updateSettings(
                                    diff.key,
                                    DEFAULT_APP_SETTINGS[diff.key]
                                  );
                                }
                              }}
                              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer"
                            >
                              Rétablir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
