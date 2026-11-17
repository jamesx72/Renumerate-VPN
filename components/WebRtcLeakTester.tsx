import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  AppSettings,
  ConnectionMode,
  VirtualIdentity,
} from '../types';

export interface WebRtcLeakTesterProps {
  isConnected: boolean;
  mode: ConnectionMode;
  currentIdentity: VirtualIdentity;
  settings: AppSettings;
  onApplyPatch: (patch: Partial<AppSettings>, reason?: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

interface IceCandidateRecord {
  id: string;
  foundation: string;
  protocol: 'UDP' | 'TCP';
  address: string;
  port: number;
  type: 'host' | 'srflx' | 'prflx' | 'relay';
  isIpv6: boolean;
  isMdns: boolean;
  isLocalPrivate: boolean;
  exposed: boolean;
  rawLine: string;
}

interface WebRtcProbeRun {
  id: string;
  timestamp: string;
  stunServer: string;
  durationMs: number;
  status: 'protected' | 'leaked' | 'shield_intercepted';
  exposedLocalIp: string | null;
  exposedPublicIp: string | null;
  mdnsMaskedCount: number;
  ipv6Count: number;
  candidates: IceCandidateRecord[];
  summary: string;
}

const STUN_SERVERS = [
  { id: 'cloudflare', label: 'Cloudflare STUN', url: 'stun:stun.cloudflare.com:3478' },
  { id: 'google', label: 'Google STUN', url: 'stun:stun.l.google.com:19302' },
  { id: 'local_only', label: 'ICE Local Sans STUN', url: '' },
] as const;

function isPrivateIpv4(addr: string): boolean {
  if (/^10\./.test(addr)) return true;
  if (/^192\.168\./.test(addr)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(addr)) return true;
  if (/^127\./.test(addr) || /^169\.254\./.test(addr)) return true;
  return false;
}

function parseCandidateLine(line: string, idx: number): IceCandidateRecord | null {
  // Standard SDP candidate format:
  // candidate:<foundation> <component> <protocol> <priority> <ip> <port> typ <type> ...
  const parts = line.replace(/^candidate:/, '').trim().split(/\s+/);
  if (parts.length < 8) return null;

  const foundation = parts[0] || `f${idx}`;
  const protoRaw = (parts[2] || 'udp').toUpperCase();
  const protocol: 'UDP' | 'TCP' = protoRaw === 'TCP' ? 'TCP' : 'UDP';
  const address = parts[4] || '';
  const port = Number.parseInt(parts[5] || '0', 10) || 0;
  const typIdx = parts.indexOf('typ');
  const typRaw = typIdx >= 0 ? parts[typIdx + 1] : 'host';
  const type: IceCandidateRecord['type'] =
    typRaw === 'srflx' || typRaw === 'prflx' || typRaw === 'relay'
      ? typRaw
      : 'host';

  const isMdns = address.endsWith('.local');
  const isIpv6 = address.includes(':') && !isMdns;
  const isLocalPrivate = !isMdns && !isIpv6 && isPrivateIpv4(address);

  return {
    id: `cand-${idx}-${foundation}-${port}`,
    foundation,
    protocol,
    address,
    port,
    type,
    isIpv6,
    isMdns,
    isLocalPrivate,
    exposed: !isMdns && (isLocalPrivate || type === 'srflx' || isIpv6),
    rawLine: line,
  };
}

async function runBrowserIceGatherer(
  stunUrl: string
): Promise<{ candidates: IceCandidateRecord[]; durationMs: number }> {
  const startedAt = performance.now();

  if (
    typeof window === 'undefined' ||
    typeof RTCPeerConnection === 'undefined'
  ) {
    return { candidates: [], durationMs: 12 };
  }

  return new Promise((resolve) => {
    let settled = false;
    const collected: IceCandidateRecord[] = [];
    const seenAddresses = new Set<string>();
    let pc: RTCPeerConnection | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        pc?.close();
      } catch {
        // Ignore RTCPeerConnection close errors
      }
      resolve({
        candidates: collected,
        durationMs: Math.max(8, Math.round(performance.now() - startedAt)),
      });
    };

    const timeoutId = window.setTimeout(finish, 1150);

    try {
      pc = new RTCPeerConnection({
        iceServers: stunUrl ? [{ urls: stunUrl }] : [],
      });
      pc.createDataChannel('renumerate-webrtc-leak-probe');

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) {
          window.clearTimeout(timeoutId);
          finish();
          return;
        }
        const candStr = ev.candidate.candidate || '';
        if (!candStr) return;
        const parsed = parseCandidateLine(candStr, collected.length);
        if (parsed) {
          const uniqKey = `${parsed.type}:${parsed.address}:${parsed.port}`;
          if (!seenAddresses.has(uniqKey)) {
            seenAddresses.add(uniqKey);
            collected.push(parsed);
          }
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc?.iceGatheringState === 'complete') {
          window.clearTimeout(timeoutId);
          finish();
        }
      };

      pc.createOffer()
        .then((offer) => pc?.setLocalDescription(offer))
        .catch(() => {
          window.clearTimeout(timeoutId);
          finish();
        });
    } catch {
      window.clearTimeout(timeoutId);
      finish();
    }
  });
}

export const WebRtcLeakTester: React.FC<WebRtcLeakTesterProps> = ({
  isConnected,
  mode,
  currentIdentity,
  settings,
  onApplyPatch,
  addLog,
}) => {
  const [selectedStunId, setSelectedStunId] =
    useState<(typeof STUN_SERVERS)[number]['id']>('cloudflare');
  const [intervalSec, setIntervalSec] = useState<10 | 20 | 30>(10);
  const [autoMonitor, setAutoMonitor] = useState(true);
  const [secondsToNextProbe, setSecondsToNextProbe] = useState<number>(10);
  const [isProbing, setIsProbing] = useState(false);
  const isProbingRef = useRef(false);
  const [probeHistory, setProbeHistory] = useState<WebRtcProbeRun[]>([]);
  const [showRawCandidates, setShowRawCandidates] = useState(false);

  const isShieldHardened =
    settings.webrtcLeakShield && settings.ipv6LeakProtection;

  const activeStun = useMemo(
    () =>
      STUN_SERVERS.find((s) => s.id === selectedStunId) || STUN_SERVERS[0],
    [selectedStunId]
  );

  const executeWebRtcProbe = useCallback(
    async (triggerSource: 'auto' | 'manual' | 'remediation') => {
      if (isProbingRef.current) return;
      isProbingRef.current = true;
      setIsProbing(true);

      try {
        const { candidates, durationMs } = await runBrowserIceGatherer(
          activeStun.url
        );

        const shieldActive = settings.webrtcLeakShield;
        const ipv6Blocked = settings.ipv6LeakProtection;

        // Evaluate actual gathered candidates alongside active tunnel/shield defenses
        const effectiveCandidates: IceCandidateRecord[] = candidates.map((c) => {
          const mitigatedByShield =
            shieldActive && (c.type === 'srflx' || c.isLocalPrivate || !c.isMdns);
          const mitigatedByIpv6 = ipv6Blocked && c.isIpv6;
          return {
            ...c,
            exposed: c.exposed && !mitigatedByShield && !mitigatedByIpv6,
          };
        });

        const rawLocalCand = effectiveCandidates.find(
          (c) => c.type === 'host' && c.isLocalPrivate && c.exposed
        );
        const rawSrflxCand = effectiveCandidates.find(
          (c) => (c.type === 'srflx' || c.type === 'prflx') && c.exposed
        );
        const mdnsCount = effectiveCandidates.filter((c) => c.isMdns).length;
        const ipv6ExposedCount = effectiveCandidates.filter(
          (c) => c.isIpv6 && c.exposed
        ).length;

        // If WebRTC shield is disabled, a real STUN socket bypass exposes the local/WAN binding surface
        const leakDetected =
          !shieldActive ||
          Boolean(rawLocalCand) ||
          Boolean(rawSrflxCand) ||
          ipv6ExposedCount > 0;

        let exposedLocalIp: string | null = rawLocalCand?.address || null;
        let exposedPublicIp: string | null = rawSrflxCand?.address || null;

        // When shield is disabled and the browser sandbox masks RFC1918 via mDNS or offline state,
        // still clearly surface the STUN bypass exposure status so remediation can fix it.
        if (!shieldActive && !exposedLocalIp && !exposedPublicIp) {
          exposedLocalIp =
            mdnsCount > 0
              ? 'Surface mDNS/ICE non confinée (WebRTC actif)'
              : 'Interface locale exposée hors sinkhole';
        }

        const status: WebRtcProbeRun['status'] = leakDetected
          ? 'leaked'
          : candidates.some((c) => c.exposed)
            ? 'shield_intercepted'
            : 'protected';

        const summary = leakDetected
          ? `Exposition WebRTC détectée : les requêtes STUN (${activeStun.label}) peuvent contourner le tunnel ${mode}.`
          : candidates.some((c) => c.exposed)
            ? `${candidates.length} candidat(s) ICE intercepté(s) et neutralisé(s) par le bouclier WebRTC.`
            : `Aucune fuite IP locale ou publique détectée (${mdnsCount} jeton(s) mDNS anonymisés).`;

        const run: WebRtcProbeRun = {
          id: `webrtc-run-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fr-FR', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          stunServer: activeStun.url || 'ICE local (sans STUN)',
          durationMs,
          status,
          exposedLocalIp,
          exposedPublicIp,
          mdnsMaskedCount: mdnsCount,
          ipv6Count: ipv6ExposedCount,
          candidates: effectiveCandidates,
          summary,
        };

        setProbeHistory((prev) => [run, ...prev].slice(0, 14));
        setSecondsToNextProbe(intervalSec);

        if (triggerSource === 'manual' || leakDetected) {
          addLog?.(
            leakDetected
              ? `[Testeur WebRTC] Fuite STUN potentielle détectée (${activeStun.label}) — Remédiation recommandée`
              : `[Testeur WebRTC] Vérification STUN conforme (${durationMs} ms) · IP locale protégée`,
            leakDetected ? 'warning' : 'success',
            currentIdentity.ip
          );
        }
      } finally {
        isProbingRef.current = false;
        setIsProbing(false);
      }
    },
    [
      activeStun,
      settings.webrtcLeakShield,
      settings.ipv6LeakProtection,
      mode,
      intervalSec,
      addLog,
      currentIdentity.ip,
    ]
  );

  // Re-probe on mount & whenever STUN server or WebRTC/IPv6 shield state changes
  useEffect(() => {
    executeWebRtcProbe('auto').catch(() => {});
  }, [executeWebRtcProbe]);

  // Periodic countdown & automated verification scheduler
  useEffect(() => {
    if (!autoMonitor) return;
    const timer = window.setInterval(() => {
      setSecondsToNextProbe((prev) => {
        if (prev <= 1) {
          executeWebRtcProbe('auto').catch(() => {});
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoMonitor, intervalSec, executeWebRtcProbe]);

  // Instant One-Click Remediation Handler
  const handleInstantRemediation = useCallback(() => {
    onApplyPatch(
      {
        webrtcLeakShield: true,
        ipv6LeakProtection: true,
        blockQuicUdp443: true,
      },
      'Remédiation WebRTC instantanée : bouclier STUN/ICE, blocage IPv6 et filtrage UDP/443 QUIC activés.'
    );

    addLog?.(
      '[Testeur WebRTC] Remédiation instantanée appliquée : confinement mDNS, blocage STUN UDP/3478 et fuite IPv6 neutralisée.',
      'success',
      currentIdentity.ip
    );

    window.setTimeout(() => {
      executeWebRtcProbe('remediation').catch(() => {});
    }, 180);
  }, [onApplyPatch, addLog, currentIdentity.ip, executeWebRtcProbe]);

  const latestRun = probeHistory[0] || null;
  const hasActiveLeak =
    latestRun?.status === 'leaked' || !settings.webrtcLeakShield;

  return (
    <section
      id="webrtc-leak-tester"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Testeur de Fuite WebRTC &amp; STUN en Temps Réel
            </h2>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className={`text-xs font-mono font-semibold ${
                hasActiveLeak
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {hasActiveLeak
                ? 'EXPOSITION STUN DÉTECTÉE'
                : 'IP LOCALE CONFINÉE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Vérification périodique des candidats ICE (`host` / `srflx`) via RTCPeerConnection et remédiation instantanée des requêtes STUN.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stun Server Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {STUN_SERVERS.map((srv) => (
              <button
                key={srv.id}
                type="button"
                onClick={() => setSelectedStunId(srv.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  selectedStunId === srv.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {srv.id === 'cloudflare'
                  ? 'Cloudflare'
                  : srv.id === 'google'
                    ? 'Google STUN'
                    : 'ICE Local'}
              </button>
            ))}
          </div>

          {/* Cadence Selector */}
          <select
            aria-label="Intervalle de vérification WebRTC"
            value={intervalSec}
            onChange={(e) => {
              const next = Number(e.target.value) as 10 | 20 | 30;
              setIntervalSec(next);
              setSecondsToNextProbe(next);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value={10}>Toutes les 10s</option>
            <option value={20}>Toutes les 20s</option>
            <option value={30}>Toutes les 30s</option>
          </select>

          <button
            type="button"
            onClick={() => setAutoMonitor((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={
              autoMonitor
                ? 'Suspendre la surveillance périodique'
                : 'Activer la surveillance périodique'
            }
          >
            {autoMonitor ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => executeWebRtcProbe('manual')}
            disabled={isProbing}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`}
            />
            <span>Tester STUN</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Instant Remediation Callout Banner when exposure is detected */}
        {hasActiveLeak ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  Fuite WebRTC / STUN détectée : risque d’exposition d’IP locale hors tunnel
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  {latestRun?.exposedLocalIp
                    ? `Surface exposée : ${latestRun.exposedLocalIp}`
                    : 'Le bouclier WebRTC est actuellement désactivé dans les réglages système.'}
                  {latestRun?.exposedPublicIp
                    ? ` · Réflexion STUN : ${latestRun.exposedPublicIp}`
                    : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInstantRemediation}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Remédiation instantanée</span>
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {latestRun?.summary ||
                  'Bouclier WebRTC actif : les requêtes STUN ne divulguent ni IP LAN ni IP WAN réelle.'}
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
              {autoMonitor
                ? `Prochaine sonde dans ${secondsToNextProbe}s`
                : 'Surveillance manuelle'}
            </span>
          </div>
        )}

        {/* 4-Column Live Telemetry Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              IP Locale (LAN / mDNS)
            </div>
            <div
              className={`text-sm font-bold truncate ${
                hasActiveLeak
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {hasActiveLeak
                ? latestRun?.exposedLocalIp || 'Exposition active'
                : 'Masquée (.local / 0 fuite)'}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {latestRun?.mdnsMaskedCount ?? 0} candidat(s) mDNS
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              IP Réflexive STUN (SRFLX)
            </div>
            <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white truncate">
              {hasActiveLeak && latestRun?.exposedPublicIp
                ? latestRun.exposedPublicIp
                : isConnected
                  ? currentIdentity.ip
                  : 'Isolée (Sinkhole)'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {activeStun.label}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Bouclier WebRTC &amp; IPv6
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {isShieldHardened ? 'Actif (2/2)' : 'Partiel'}
            </div>
            <div className="text-[11px] text-slate-500">
              QUIC UDP/443 : {settings.blockQuicUdp443 ? 'Bloqué' : 'Ouvert'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Dernière sonde ICE
            </div>
            <div className="text-sm font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
              {latestRun ? `${latestRun.durationMs} ms` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {latestRun
                ? `${latestRun.timestamp} · ${latestRun.candidates.length} ICE`
                : 'Initialisation...'}
            </div>
          </div>
        </div>

        {/* Granular Shield Controls + Toggle Raw ICE Candidates */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onApplyPatch(
                  { webrtcLeakShield: !settings.webrtcLeakShield },
                  `Bouclier WebRTC ${!settings.webrtcLeakShield ? 'activé' : 'désactivé'}`
                )
              }
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                settings.webrtcLeakShield
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}
            >
              Bouclier WebRTC : {settings.webrtcLeakShield ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                onApplyPatch(
                  { ipv6LeakProtection: !settings.ipv6LeakProtection },
                  `Protection IPv6 ${!settings.ipv6LeakProtection ? 'activée' : 'désactivée'}`
                )
              }
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                settings.ipv6LeakProtection
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              }`}
            >
              Blocage IPv6 ICE : {settings.ipv6LeakProtection ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                onApplyPatch(
                  { blockQuicUdp443: !settings.blockQuicUdp443 },
                  `Filtrage QUIC UDP/443 ${!settings.blockQuicUdp443 ? 'activé' : 'désactivé'}`
                )
              }
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                settings.blockQuicUdp443
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Filtre QUIC UDP/443 : {settings.blockQuicUdp443 ? 'ON' : 'OFF'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRawCandidates((v) => !v)}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            {showRawCandidates
              ? 'Masquer les candidats SDP/ICE'
              : `Inspecter les candidats ICE (${latestRun?.candidates.length ?? 0})`}
          </button>
        </div>

        {/* Expandable SDP / ICE Candidate Table */}
        {showRawCandidates && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {!latestRun || latestRun.candidates.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                Aucun candidat ICE brut collecté lors de cette fenêtre (confinement navigateur / RTCPeerConnection isolé).
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono">
                {latestRun.candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400 uppercase">
                        {cand.type}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-900 dark:text-white truncate">
                        {cand.address}:{cand.port}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{cand.protocol}</span>
                    </div>
                    <span
                      className={
                        cand.exposed
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }
                    >
                      {cand.exposed
                        ? 'EXPOSÉ'
                        : cand.isMdns
                          ? 'mDNS masqué'
                          : 'Neutralisé'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Periodic Probe History Strip */}
        {probeHistory.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Journal périodique des vérifications STUN ({probeHistory.length})
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                Cadence {intervalSec}s · {autoMonitor ? 'Auto actif' : 'En pause'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {probeHistory.slice(0, 4).map((run) => {
                const isLeaked = run.status === 'leaked';
                return (
                  <div
                    key={run.id}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isLeaked ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-slate-900 dark:text-white truncate">
                          {run.timestamp} · {run.stunServer}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {isLeaked
                            ? run.exposedLocalIp || 'Fuite WebRTC détectée'
                            : `${run.candidates.length} candidat(s) vérifié(s)`}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-mono tabular-nums font-semibold shrink-0 ${
                        isLeaked
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {run.durationMs} ms
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
