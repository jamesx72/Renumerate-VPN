import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  VirtualIdentity,
  ConnectionMode,
  SecurityReport,
  FingerprintProtectionConfig,
} from '../types';
import { REALISTIC_USER_AGENTS, MOCK_IDENTITIES } from '../constants';
import {
  Globe,
  Copy,
  Loader2,
  Chrome,
  RefreshCw,
  Activity,
  ShieldCheck,
  MapPin,
  X,
  Binary,
  Shield,
  Brain,
  ChevronDown,
  History as LucideHistory,
  Settings2,
  Sliders,
  Check,
  Terminal,
  Cpu,
  Download,
  Search,
  Fingerprint,
  AlertTriangle,
  Eye,
  Radio,
} from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  availableIdentities?: VirtualIdentity[];
  isRotating: boolean;
  isMasking?: boolean;
  mode: ConnectionMode;
  securityReport?: SecurityReport | null;
  onMask?: () => void;
  onScrambleMac?: () => void;
  onScrambleUA?: () => void;
  onSelectUA?: (uaShort: string) => void;
  onSelectIdentity?: (identity: VirtualIdentity) => void;
  onOpenHistory?: () => void;
  isConnected?: boolean;
  macFormat?: 'standard' | 'hyphen' | 'cisco' | 'random';
  onFormatChange?: (format: 'standard' | 'hyphen' | 'cisco' | 'random') => void;
  ipv6LeakProtection?: boolean;
  onIpv6Toggle?: (enabled: boolean) => void;
  webrtcLeakShield?: boolean;
  onWebrtcToggle?: (enabled: boolean) => void;
  obfuscationLevel?: 'standard' | 'high' | 'ultra';
  onObfuscationLevelChange?: (level: 'standard' | 'high' | 'ultra') => void;
  fingerprintProtection?: FingerprintProtectionConfig;
  onToggleFingerprint?: (key: keyof FingerprintProtectionConfig) => void;
  onHarmonizeFingerprints?: () => void;
  onRefreshSecurity?: () => void;
  isRefreshingSecurity?: boolean;
}

interface BrowserSurfaceTelemetry {
  scannedAt: string;
  rawCanvasHash: string;
  exposedCanvasHash: string;
  rawWebglRenderer: string;
  exposedWebglRenderer: string;
  webrtcCandidatesDetected: number;
  webrtcMdnsMasked: boolean;
  browserTimezone: string;
  browserUtcOffset: string;
  gatewayTimezone: string;
  timezoneAligned: boolean;
  hardwareThreads: number;
  exposedThreads: number;
}

const COUNTRIES_WITH_FLAGS: Record<string, string> = {
  France: '🇫🇷',
  Suisse: '🇨🇭',
  Singapour: '🇸🇬',
  Islande: '🇮🇸',
  Estonie: '🇪🇪',
  Panama: '🇵🇦',
  USA: '🇺🇸',
  Allemagne: '🇩🇪',
};

function bytesToHexShort(buffer: ArrayBuffer, byteCount = 8): string {
  return Array.from(new Uint8Array(buffer))
    .slice(0, byteCount)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function computeCanvasDigests(
  noiseEnabled: boolean,
  saltToken: string
): Promise<{ rawHash: string; exposedHash: string }> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { rawHash: 'INDISPONIBLE', exposedHash: 'MASQUÉ-2D' };
    }

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#0891b2';
    ctx.fillRect(8, 6, 92, 22);
    ctx.fillStyle = '#0f172a';
    ctx.font = '13px monospace';
    ctx.fillText('Renumerate-2D-Probe', 12, 22);
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(178, 24, 14, 0, Math.PI * 1.65, false);
    ctx.stroke();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rawDigest = await window.crypto.subtle.digest(
      'SHA-256',
      imageData.data.buffer.slice(0)
    );
    const rawHash = bytesToHexShort(rawDigest, 8);

    if (!noiseEnabled) {
      return { rawHash, exposedHash: rawHash };
    }

    const encoder = new TextEncoder();
    const saltBytes = encoder.encode(`canvas-chaff:${saltToken}:${rawHash}`);
    const saltedDigest = await window.crypto.subtle.digest('SHA-256', saltBytes);
    return {
      rawHash,
      exposedHash: bytesToHexShort(saltedDigest, 8),
    };
  } catch {
    return { rawHash: 'BLOQUÉ-DOM', exposedHash: 'ISOLÉ-DOM' };
  }
}

function inspectWebglRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return 'WebGL désactivé';
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugExt) {
      const unmasked = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL);
      if (typeof unmasked === 'string' && unmasked.trim().length > 0) {
        return unmasked.trim();
      }
    }
    const stdRenderer = gl.getParameter(gl.RENDERER);
    return typeof stdRenderer === 'string' && stdRenderer.trim()
      ? stdRenderer.trim()
      : 'Renderer standard';
  } catch {
    return 'Contexte GPU confiné';
  }
}

async function probeLocalWebrtcIce(): Promise<{
  candidateCount: number;
  mdnsOnly: boolean;
}> {
  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    return { candidateCount: 0, mdnsOnly: true };
  }

  return new Promise((resolve) => {
    let settled = false;
    let candidateCount = 0;
    let sawRawIp = false;
    let pc: RTCPeerConnection | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        pc?.close();
      } catch {
        // Ignore close error
      }
      resolve({
        candidateCount,
        mdnsOnly: !sawRawIp,
      });
    };

    const timer = window.setTimeout(finish, 650);

    try {
      pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('renumerate-ice-audit');
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) {
          window.clearTimeout(timer);
          finish();
          return;
        }
        const candStr = ev.candidate.candidate || '';
        if (candStr) {
          candidateCount += 1;
          const ipv4Match = candStr.match(
            /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168|\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b/
          );
          if (ipv4Match && !candStr.includes('.local')) {
            sawRawIp = true;
          }
        }
      };
      pc.createOffer()
        .then((offer) => pc?.setLocalDescription(offer))
        .catch(() => {
          window.clearTimeout(timer);
          finish();
        });
    } catch {
      window.clearTimeout(timer);
      finish();
    }
  });
}

const EntropyRadar = ({
  isMasking,
  level,
  fingerprintProtection,
}: {
  isMasking: boolean;
  level: 'standard' | 'high' | 'ultra';
  fingerprintProtection?: FingerprintProtectionConfig;
}) => {
  const fpBonus = useMemo(() => {
    if (!fingerprintProtection) return 10;
    return Object.values(fingerprintProtection).filter(Boolean).length * 5;
  }, [fingerprintProtection]);

  const [points, setPoints] = useState([68, 74, 62, 80]);

  useEffect(() => {
    const base =
      (level === 'ultra' ? 78 : level === 'high' ? 66 : 52) + fpBonus * 0.6;
    const interval = setInterval(
      () => {
        const randBytes = new Uint8Array(4);
        window.crypto.getRandomValues(randBytes);
        setPoints((prev) =>
          prev.map((_, idx) => {
            const axisOffset = idx % 2 === 0 ? 4 : -3;
            const target = isMasking ? 96 : Math.min(96, base + axisOffset);
            const delta = ((randBytes[idx] % 9) - 4) * (isMasking ? 0.9 : 0.45);
            return Math.max(25, Math.min(100, target + delta));
          })
        );
      },
      isMasking ? 120 : 1400
    );
    return () => clearInterval(interval);
  }, [isMasking, level, fpBonus]);

  const size = 152;
  const center = size / 2;
  const radius = center - 14;

  const getCoordinates = (index: number, value: number) => {
    const angle = Math.PI / 2 + (index * Math.PI) / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center - r * Math.sin(angle),
    };
  };

  const polyPoints = points
    .map((p, i) => {
      const coords = getCoordinates(i, p);
      return `${coords.x.toFixed(1)},${coords.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="overflow-visible pointer-events-none"
      >
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx={center}
            cy={center}
            r={radius * scale}
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="1"
          />
        ))}

        {[0, 1, 2, 3].map((i) => {
          const coords = getCoordinates(i, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={coords.x}
              y2={coords.y}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={polyPoints}
          fill="rgba(6,182,212,0.18)"
          stroke="#06b6d4"
          strokeWidth="2"
          className="transition-all duration-300 ease-out"
        />

        {points.map((p, i) => {
          const coords = getCoordinates(i, p);
          return (
            <circle
              key={i}
              cx={coords.x}
              cy={coords.y}
              r="3.2"
              fill="#06b6d4"
              className="transition-all duration-300 ease-out"
            />
          );
        })}
      </svg>

      <span className="absolute -top-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Agent HTTP
      </span>
      <span className="absolute -bottom-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Passerelle IP
      </span>
      <span className="absolute -right-7 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 rotate-90">
        Obfuscation
      </span>
      <span className="absolute -left-7 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 -rotate-90">
        MAC / Toile
      </span>
    </div>
  );
};

export const IdentityMatrix: React.FC<Props> = ({
  identity,
  availableIdentities = MOCK_IDENTITIES,
  isRotating,
  isMasking = false,
  mode,
  securityReport,
  onMask,
  onScrambleMac,
  onScrambleUA,
  onSelectUA,
  onSelectIdentity,
  onOpenHistory,
  isConnected = false,
  macFormat = 'random',
  onFormatChange,
  ipv6LeakProtection = true,
  onIpv6Toggle,
  webrtcLeakShield = true,
  onWebrtcToggle,
  obfuscationLevel = 'standard',
  onObfuscationLevelChange,
  fingerprintProtection,
  onToggleFingerprint,
  onHarmonizeFingerprints,
  onRefreshSecurity,
  isRefreshingSecurity = false,
}) => {
  const [copiedField, setCopiedField] = useState<'ip' | 'mac' | 'ua' | null>(
    null
  );
  const [localTime, setLocalTime] = useState<string>('');
  const [scrambleText, setScrambleText] = useState('');
  const [warpProgress, setWarpProgress] = useState(0);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  const [showWarpTuning, setShowWarpTuning] = useState(false);
  const [showUAModal, setShowUAModal] = useState(false);
  const [uaSearch, setUaSearch] = useState('');

  // Client-side browser surface forensic audit states
  const [canvasSaltNonce, setCanvasSaltNonce] = useState<string>('A1F0');
  const [isScanningSurface, setIsScanningSurface] = useState(false);
  const [surfaceTelemetry, setSurfaceTelemetry] =
    useState<BrowserSurfaceTelemetry | null>(null);

  const sessionFingerprintTag = useMemo(() => {
    const seed = `${identity.ip}-${identity.mac}-${identity.userAgentShort}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash)
      .toString(16)
      .toUpperCase()
      .padStart(8, '0')
      .slice(0, 8);
  }, [identity.ip, identity.mac, identity.userAgentShort]);

  const entropyIndex = useMemo(() => {
    let base =
      obfuscationLevel === 'ultra'
        ? 9.76
        : obfuscationLevel === 'high'
          ? 9.38
          : 8.84;
    if (ipv6LeakProtection) base += 0.08;
    if (webrtcLeakShield) base += 0.06;
    if (fingerprintProtection?.canvasNoise) base += 0.04;
    if (fingerprintProtection?.webglMask) base += 0.03;
    if (fingerprintProtection?.timezoneSync) base += 0.02;
    return Math.min(9.99, base).toFixed(2);
  }, [
    obfuscationLevel,
    ipv6LeakProtection,
    webrtcLeakShield,
    fingerprintProtection,
  ]);

  const currentUAData = useMemo(() => {
    return (
      REALISTIC_USER_AGENTS.find((ua) => ua.short === identity.userAgentShort) ||
      REALISTIC_USER_AGENTS[0]
    );
  }, [identity.userAgentShort]);

  const runSurfaceForensicScan = useCallback(async () => {
    setIsScanningSurface(true);
    try {
      const noiseActive = Boolean(fingerprintProtection?.canvasNoise);
      const webglMaskActive = Boolean(fingerprintProtection?.webglMask);
      const tzSyncActive = Boolean(fingerprintProtection?.timezoneSync);

      const [canvasHashes, iceResult] = await Promise.all([
        computeCanvasDigests(
          noiseActive,
          `${sessionFingerprintTag}-${canvasSaltNonce}`
        ),
        probeLocalWebrtcIce(),
      ]);

      const rawWebgl = inspectWebglRenderer();
      const exposedWebgl = webglMaskActive
        ? 'Mesa Intel(R) UHD Graphics · Generic Virtualizer'
        : rawWebgl;

      const resolvedTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const offsetMin = -new Date().getTimezoneOffset();
      const offsetHours = Math.trunc(offsetMin / 60);
      const browserUtcOffset =
        offsetHours >= 0 ? `UTC+${offsetHours}` : `UTC${offsetHours}`;
      const gatewayTz = identity.timezone || 'UTC+0';
      const timezoneAligned = tzSyncActive || browserUtcOffset === gatewayTz;

      const hwThreads =
        typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? navigator.hardwareConcurrency
          : 8;
      const exposedThreads =
        obfuscationLevel === 'ultra'
          ? 4
          : obfuscationLevel === 'high'
            ? Math.min(8, hwThreads)
            : hwThreads;

      setSurfaceTelemetry({
        scannedAt: new Date().toLocaleTimeString('fr-FR'),
        rawCanvasHash: canvasHashes.rawHash,
        exposedCanvasHash: canvasHashes.exposedHash,
        rawWebglRenderer: rawWebgl,
        exposedWebglRenderer: exposedWebgl,
        webrtcCandidatesDetected: webrtcLeakShield
          ? 0
          : iceResult.candidateCount,
        webrtcMdnsMasked: webrtcLeakShield || iceResult.mdnsOnly,
        browserTimezone: resolvedTz,
        browserUtcOffset,
        gatewayTimezone: gatewayTz,
        timezoneAligned,
        hardwareThreads: hwThreads,
        exposedThreads,
      });
    } finally {
      setIsScanningSurface(false);
    }
  }, [
    fingerprintProtection?.canvasNoise,
    fingerprintProtection?.webglMask,
    fingerprintProtection?.timezoneSync,
    sessionFingerprintTag,
    canvasSaltNonce,
    identity.timezone,
    obfuscationLevel,
    webrtcLeakShield,
  ]);

  useEffect(() => {
    runSurfaceForensicScan();
  }, [runSurfaceForensicScan]);

  const handleReseedCanvasSalt = () => {
    const buf = new Uint8Array(3);
    window.crypto.getRandomValues(buf);
    const nextNonce = Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    setCanvasSaltNonce(nextNonce);
  };

  useEffect(() => {
    if (isMasking || isRotating) {
      const chars = '0123456789ABCDEF:.';
      const interval = setInterval(() => {
        const bytes = new Uint8Array(18);
        window.crypto.getRandomValues(bytes);
        let result = '';
        for (let i = 0; i < 18; i++) {
          result += chars[bytes[i] % chars.length];
        }
        setScrambleText(result);
      }, 65);

      setWarpProgress(0);
      const progressInterval = setInterval(() => {
        setWarpProgress((prev) => Math.min(100, prev + 10));
      }, 110);

      return () => {
        clearInterval(interval);
        clearInterval(progressInterval);
      };
    } else {
      setWarpProgress(100);
    }
  }, [isMasking, isRotating]);

  useEffect(() => {
    const updateTime = () => {
      const tz = identity.timezone || 'UTC+0';
      const offsetValue = parseInt(tz.replace('UTC', '') || '0', 10);
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const cityTime = new Date(utc + 3600000 * offsetValue);
      setLocalTime(
        cityTime.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timerId = setInterval(updateTime, 1000);
    return () => clearInterval(timerId);
  }, [identity.timezone]);

  const handleCopy = (field: 'ip' | 'mac' | 'ua', value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleExportAuditReport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      application: 'Renumerate VPN',
      connectionMode: mode,
      obfuscationLevel,
      ipv6LeakProtection,
      webrtcLeakShield,
      fingerprintProtection,
      virtualIdentity: identity,
      browserSurfaceForensics: surfaceTelemetry,
      securityReport,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-audit-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredUserAgents = useMemo(() => {
    const q = uaSearch.trim().toLowerCase();
    if (!q) return REALISTIC_USER_AGENTS;
    return REALISTIC_USER_AGENTS.filter(
      (ua) =>
        ua.short.toLowerCase().includes(q) ||
        ua.os.toLowerCase().includes(q) ||
        ua.browser.toLowerCase().includes(q)
    );
  }, [uaSearch]);

  const activeShieldCount = useMemo(() => {
    let count = 0;
    if (ipv6LeakProtection) count += 1;
    if (webrtcLeakShield) count += 1;
    if (fingerprintProtection?.canvasNoise) count += 1;
    if (fingerprintProtection?.webglMask) count += 1;
    if (fingerprintProtection?.audioContextSpoof) count += 1;
    if (fingerprintProtection?.timezoneSync) count += 1;
    return count;
  }, [ipv6LeakProtection, webrtcLeakShield, fingerprintProtection]);

  return (
    <div className="space-y-6">
      {/* Top Section: Public Gateway & Morphing Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Public Gateway Card */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Identité réseau &amp; passerelle publique
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isConnected
                    ? 'Tunnel actif — chiffrement AEAD 256 bits vérifié'
                    : 'Pré-configuration active — prête pour ouverture du tunnel'}
                </p>
              </div>
            </div>

            <div className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
              Session{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                #{sessionFingerprintTag}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Adresse IPv4 virtuelle exposée
            </span>
            <div className="flex items-center justify-between gap-4">
              <div className="text-3xl sm:text-4xl md:text-5xl font-mono tabular-nums font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                {isRotating || isMasking
                  ? scrambleText.slice(0, 15)
                  : identity.ip}
              </div>
              <button
                type="button"
                onClick={() => handleCopy('ip', identity.ip)}
                title="Copier l'adresse IP virtuelle"
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer shrink-0"
              >
                {copiedField === 'ip' ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Metrics + Direct IPv6 & WebRTC Shields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Indice d&apos;entropie
              </span>
              <span className="font-mono tabular-nums text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5 block">
                {entropyIndex} / 10
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Latence sortie
              </span>
              <span className="font-mono tabular-nums text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {identity.latency} ms
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  Bouclier IPv6
                </span>
                <span
                  className={`text-xs font-bold mt-0.5 block ${
                    ipv6LeakProtection
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {ipv6LeakProtection ? 'Confiné' : 'Ouvert'}
                </span>
              </div>
              {onIpv6Toggle && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={ipv6LeakProtection}
                  onClick={() => onIpv6Toggle(!ipv6LeakProtection)}
                  title="Basculer la protection contre les fuites IPv6"
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                    ipv6LeakProtection
                      ? 'bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      ipv6LeakProtection ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  WebRTC ICE
                </span>
                <span
                  className={`text-xs font-bold mt-0.5 block ${
                    webrtcLeakShield
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {webrtcLeakShield ? 'Masqué' : 'Exposé'}
                </span>
              </div>
              {onWebrtcToggle && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={webrtcLeakShield}
                  onClick={() => onWebrtcToggle(!webrtcLeakShield)}
                  title="Basculer le masquage des candidats locaux WebRTC STUN/ICE"
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                    webrtcLeakShield
                      ? 'bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      webrtcLeakShield ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Morphing Engine & Anti-Fingerprinting Card */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Moteur de re-numérotation</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Obfuscation :{' '}
                <span className="font-semibold capitalize text-slate-700 dark:text-slate-200">
                  {obfuscationLevel}
                </span>{' '}
                · {activeShieldCount}/6 boucliers actifs
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowWarpTuning((v) => !v)}
              title="Configurer le niveau d'obfuscation et les protections d'empreinte"
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showWarpTuning
                  ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {showWarpTuning ? (
                <X className="w-4 h-4" />
              ) : (
                <Settings2 className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-[172px]">
            {!showWarpTuning ? (
              <div className="w-full flex flex-col items-center gap-5 py-2">
                <EntropyRadar
                  isMasking={isMasking}
                  level={obfuscationLevel}
                  fingerprintProtection={fingerprintProtection}
                />
                <div className="w-full space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Synchronisation d&apos;empreinte
                    </span>
                    <span className="font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                      {Math.round(warpProgress)}%
                    </span>
                  </div>
                  <svg className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 block">
                    <rect
                      x="0"
                      y="0"
                      width={`${warpProgress}%`}
                      height="100%"
                      rx="3"
                      fill="#06b6d4"
                    />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Niveau d&apos;obfuscation
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['standard', 'high', 'ultra'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onObfuscationLevelChange?.(lvl)}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-colors cursor-pointer ${
                          obfuscationLevel === lvl
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {fingerprintProtection && onToggleFingerprint && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                      Boucliers anti-pistage navigateur
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { key: 'canvasNoise', label: 'Bruit Canvas' },
                          { key: 'webglMask', label: 'Masque WebGL' },
                          { key: 'audioContextSpoof', label: 'AudioContext' },
                          { key: 'timezoneSync', label: 'Fuseau auto' },
                        ] as const
                      ).map((fp) => {
                        const enabled = fingerprintProtection[fp.key];
                        return (
                          <button
                            key={fp.key}
                            type="button"
                            onClick={() => onToggleFingerprint(fp.key)}
                            className={`px-2.5 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                              enabled
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                            }`}
                          >
                            <span className="truncate">{fp.label}</span>
                            {enabled && (
                              <Check className="w-3.5 h-3.5 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onMask}
            disabled={isMasking}
            className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isMasking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>
              {isMasking
                ? 'Morphing en cours...'
                : "Renouveler l'identité complète"}
            </span>
          </button>
        </div>
      </div>

      {/* 3 Identity Facet Cards: Geo Location, Virtual MAC, Browser User-Agent */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Geo Location Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Localisation virtuelle
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenHistory?.()}
              title="Historique des passerelles"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LucideHistory className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 py-1">
            <span className="text-5xl">
              {COUNTRIES_WITH_FLAGS[identity.country] || '🌍'}
            </span>
            <div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {identity.country}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                {identity.timezone} · {localTime}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCityModal(true)}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Ville de sortie
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {identity.city}
              </span>
            </div>
            <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              Changer
            </span>
          </button>
        </div>

        {/* Hardware MAC Scrambler Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <Binary className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Adresse MAC virtuelle
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('mac', identity.mac)}
              title="Copier l'adresse MAC"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copiedField === 'mac' ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-wider">
              {isMasking ? scrambleText.slice(0, 17) : identity.mac}
            </div>
            {onFormatChange && (
              <div className="inline-flex items-center gap-1 pt-1">
                {(['standard', 'hyphen', 'cisco', 'random'] as const).map(
                  (fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => onFormatChange(fmt)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                        macFormat === fmt
                          ? 'bg-cyan-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {fmt === 'standard'
                        ? 'AA:BB'
                        : fmt === 'hyphen'
                          ? 'AA-BB'
                          : fmt === 'cisco'
                            ? 'aaaa.bb'
                            : 'Auto'}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onScrambleMac}
            disabled={isMasking}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-cyan-600 dark:hover:bg-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isMasking ? 'animate-spin' : ''}`}
            />
            <span>Re-numéroter l&apos;adresse MAC</span>
          </button>
        </div>

        {/* Browser User-Agent Footprint Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Chrome className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Signature User-Agent
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('ua', currentUAData.full)}
              title="Copier l'en-tête HTTP User-Agent complet"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copiedField === 'ua' ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                OS simulé
              </span>
              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                {currentUAData.os}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 line-clamp-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800">
              {isMasking ? scrambleText.repeat(2) : currentUAData.full}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={onScrambleUA}
              disabled={isMasking}
              className="col-span-4 py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isMasking ? 'animate-spin' : ''}`}
              />
              <span>Permuter l&apos;agent</span>
            </button>
            <button
              type="button"
              onClick={() => setShowUAModal(true)}
              title="Parcourir le catalogue User-Agent"
              className="col-span-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Browser Surface & WebRTC Forensics Lab */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/25 text-cyan-600 dark:text-cyan-400 shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Laboratoire d&apos;empreinte navigateur &amp; surface WebRTC
                </h4>
                {surfaceTelemetry && (
                  <>
                    <span className="text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      Mesuré à {surfaceTelemetry.scannedAt}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspection locale des API DOM réelles (Canvas 2D SHA-256, GPU WebGL, candidats ICE WebRTC et cohérence temporelle).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReseedCanvasSalt}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Générer un nouveau sel cryptographique pour le bruit Canvas 2D"
            >
              <Fingerprint className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Sel Canvas #{canvasSaltNonce}</span>
            </button>

            <button
              type="button"
              onClick={runSurfaceForensicScan}
              disabled={isScanningSurface}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isScanningSurface ? 'animate-spin text-cyan-500' : ''}`}
              />
              <span>Rescanner</span>
            </button>

            {onHarmonizeFingerprints && activeShieldCount < 6 && (
              <button
                type="button"
                onClick={onHarmonizeFingerprints}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Activer les 6 boucliers</span>
              </button>
            )}
          </div>
        </div>

        {surfaceTelemetry && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            {/* 1. Canvas 2D Hash */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Signature Canvas 2D
                </span>
                <span
                  className={`font-semibold ${
                    fingerprintProtection?.canvasNoise
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {fingerprintProtection?.canvasNoise ? 'Bruitée' : 'Brute'}
                </span>
              </div>
              <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white truncate">
                {surfaceTelemetry.exposedCanvasHash}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 truncate">
                Matériel : {surfaceTelemetry.rawCanvasHash}
              </div>
            </div>

            {/* 2. WebGL Renderer */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Pilote WebGL
                </span>
                <span
                  className={`font-semibold ${
                    fingerprintProtection?.webglMask
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {fingerprintProtection?.webglMask ? 'Masqué' : 'Exposé'}
                </span>
              </div>
              <div
                className="font-mono text-slate-900 dark:text-white font-semibold truncate"
                title={surfaceTelemetry.exposedWebglRenderer}
              >
                {surfaceTelemetry.exposedWebglRenderer}
              </div>
              <div
                className="text-[11px] text-slate-500 truncate"
                title={surfaceTelemetry.rawWebglRenderer}
              >
                GPU local : {surfaceTelemetry.rawWebglRenderer}
              </div>
            </div>

            {/* 3. WebRTC ICE Candidate Probe */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  Sonde WebRTC ICE
                </span>
                <span
                  className={`font-semibold ${
                    surfaceTelemetry.webrtcMdnsMasked
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {surfaceTelemetry.webrtcMdnsMasked ? 'Étanche' : 'Fuite LAN'}
                </span>
              </div>
              <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {surfaceTelemetry.webrtcCandidatesDetected} candidat(s) visibles
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                Cœurs exposés : {surfaceTelemetry.exposedThreads}/
                {surfaceTelemetry.hardwareThreads}
              </div>
            </div>

            {/* 4. Timezone & Locale Alignment */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Alignement horaire
                </span>
                <span
                  className={`font-semibold ${
                    surfaceTelemetry.timezoneAligned
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {surfaceTelemetry.timezoneAligned ? 'Aligné' : 'Décalage'}
                </span>
              </div>
              <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white truncate">
                Sortie {surfaceTelemetry.gatewayTimezone}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 truncate">
                Système : {surfaceTelemetry.browserUtcOffset} (
                {fingerprintProtection?.timezoneSync ? 'Synchronisé' : 'Brut'})
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Security Report Accordion */}
      {securityReport && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRecs(!showRecs)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                <Brain className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Synthèse d&apos;audit de session
                  </h4>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {securityReport.engine === 'local-heuristic'
                      ? 'Moteur heuristique local'
                      : 'Analyse IA Sentinel'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1 font-mono tabular-nums">
                    <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Score : {securityReport.score}/100
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      securityReport.score >= 80
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    Menace : {securityReport.threatLevel}
                  </span>
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showRecs ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''
              }`}
            />
          </button>

          {showRecs && (
            <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {securityReport.quotaNotice && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{securityReport.quotaNotice}</span>
                </div>
              )}

              <div className="p-4 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {securityReport.analysis}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {securityReport.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2"
                  >
                    <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 block">
                      0{i + 1}. Recommandation
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {rec}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {onRefreshSecurity && (
                  <button
                    type="button"
                    onClick={onRefreshSecurity}
                    disabled={isRefreshingSecurity}
                    className="px-4 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 disabled:opacity-50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/25 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isRefreshingSecurity ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isRefreshingSecurity
                        ? 'Analyse en cours...'
                        : 'Actualiser l’analyse'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportAuditReport}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter le rapport JSON</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Sélecteur de Région & Ville Virtuelle */}
      {showCityModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setShowCityModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Passerelle de sortie &amp; ville virtuelle
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sélectionnez votre point de présence géographique et fuseau horaire.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCityModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[380px] overflow-y-auto space-y-2">
              {availableIdentities.map((preset) => {
                const isSelected =
                  preset.city === identity.city &&
                  preset.country === identity.country;
                return (
                  <button
                    key={`${preset.country}-${preset.city}`}
                    type="button"
                    onClick={() => {
                      onSelectIdentity?.(preset);
                      setShowCityModal(false);
                    }}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-500 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-2xl">
                        {COUNTRIES_WITH_FLAGS[preset.country] || '🌍'}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {preset.city}, {preset.country}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {preset.ip} · {preset.timezone}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      <span>{preset.latency} ms</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Catalogue d'Empreintes User-Agent */}
      {showUAModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setShowUAModal(false)}
          />
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Catalogue de signatures User-Agent
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Injectez une empreinte navigateur/OS réaliste dans les en-têtes sortants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUAModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={uaSearch}
                  onChange={(e) => setUaSearch(e.target.value)}
                  placeholder="Filtrer par OS ou navigateur (macOS, Linux, Android, Brave...)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="p-4 max-h-[360px] overflow-y-auto space-y-2">
              {filteredUserAgents.map((ua) => {
                const active = ua.short === identity.userAgentShort;
                return (
                  <button
                    key={ua.short}
                    type="button"
                    onClick={() => {
                      onSelectUA?.(ua.short);
                      setShowUAModal(false);
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-500'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {ua.short}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ua.os} · {ua.engine}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {ua.full}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
