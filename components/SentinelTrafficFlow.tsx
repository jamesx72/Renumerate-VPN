import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import {
  Activity,
  AlertTriangle,
  Download,
  FileSearch,
  Filter,
  Pause,
  Play,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  ConnectionMode,
  IntrusionAttempt,
  IntrusionDefenseAction,
  IntrusionSeverity,
  IntrusionVector,
  VirtualIdentity,
} from '../types';
import {
  INITIAL_INTRUSION_ATTEMPTS,
  resolveThreatGeoposition,
} from '../constants';
import { DnsBreachTester } from './DnsBreachTester';
import { DataExfiltrationRadar } from './DataExfiltrationRadar';
import {
  MatchedThreatSignatureInfo,
  PacketFlowSample,
  PacketInspectionModal,
} from './PacketInspectionModal';

export interface SentinelTrafficFlowProps {
  isConnected: boolean;
  mode: ConnectionMode;
  currentIdentity: VirtualIdentity;
  throughput: { up: number; down: number };
  settings: AppSettings;
  onApplyPatch?: (patch: Partial<AppSettings>, reason?: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type ThreatCategory =
  | 'nominal'
  | 'port_scan'
  | 'replay_attack'
  | 'c2_beacon'
  | 'webrtc_leak'
  | 'brute_force'
  | 'dns_hijack';

interface KnownThreatSignature {
  id: string;
  ruleCode: string;
  label: string;
  category: Exclude<ThreatCategory, 'nominal'>;
  mitreId: string;
  protocol: 'TCP' | 'UDP' | 'DNS' | 'ARP';
  port: number;
  severity: IntrusionSeverity;
  defaultAction: IntrusionDefenseAction;
  entropyRange: [number, number];
  scoreBaseline: number;
  description: string;
}

interface TrafficFlowEvent {
  id: string;
  seq: number;
  timestamp: number;
  timeLabel: string;
  sourceIp: string;
  sourceCountry: string;
  targetPort: number;
  protocol: 'TCP' | 'UDP' | 'DNS' | 'ARP' | 'ICMP';
  category: ThreatCategory;
  severity: IntrusionSeverity | 'nominal';
  signatureRule: string;
  mitreId: string;
  anomalyScore: number; // 0-100
  confidencePct: number; // 0-100
  shannonEntropy: number; // 0.0 - 8.0 bits/byte
  packetRatePps: number;
  payloadKbps: number;
  actionTaken: IntrusionDefenseAction | 'allow_tunnel';
  quarantined: boolean;
  featureWeights: {
    entropyDelta: number;
    burstRatio: number;
    periodicity: number;
    signatureMatch: number;
  };
}

interface FlowTimelinePoint {
  seq: number;
  timestamp: number;
  timeLabel: string;
  totalKbps: number;
  anomalyScore: number;
  shannonEntropy: number;
  baselineEntropy: number;
  event?: TrafficFlowEvent;
}

const KNOWN_THREAT_SIGNATURES: KnownThreatSignature[] = [
  {
    id: 'sig-scan-syn',
    ruleCode: 'SURICATA-ET-SCAN-SYN-SWEEP-v2',
    label: 'Balayage furtif TCP SYN',
    category: 'port_scan',
    mitreId: 'T1046',
    protocol: 'TCP',
    port: 51820,
    severity: 'high',
    defaultAction: 'drop_xdp',
    entropyRange: [2.4, 3.8],
    scoreBaseline: 79,
    description:
      'Rafale de paquets SYN demi-ouverts balayant la surface du tunnel sans acquittement.',
  },
  {
    id: 'sig-wg-replay',
    ruleCode: 'WG-REPLAY-SLIDING-WINDOW-VIOLATION',
    label: 'Violation anti-rejeu PQC',
    category: 'replay_attack',
    mitreId: 'T1557',
    protocol: 'UDP',
    port: 51820,
    severity: 'critical',
    defaultAction: 'tunnel_rekey',
    entropyRange: [7.45, 7.98],
    scoreBaseline: 93,
    description:
      'Compteur de séquence chiffré déjà consommé injecté sur l’interface wg0.',
  },
  {
    id: 'sig-c2-beacon',
    ruleCode: 'AI-DPI-C2-PERIODIC-BEACON',
    label: 'Balise C2 / Exfiltration DNS',
    category: 'c2_beacon',
    mitreId: 'T1071.004',
    protocol: 'DNS',
    port: 53,
    severity: 'critical',
    defaultAction: 'sinkhole',
    entropyRange: [6.4, 7.3],
    scoreBaseline: 88,
    description:
      'Périodicité régulière de sous-domaines à forte entropie caractéristique d’un canal C2.',
  },
  {
    id: 'sig-stun-leak',
    ruleCode: 'NETFILTER-WEBRTC-UNSOLICITED-STUN',
    label: 'Sonde de fuite WebRTC / STUN',
    category: 'webrtc_leak',
    mitreId: 'T1590',
    protocol: 'UDP',
    port: 3478,
    severity: 'medium',
    defaultAction: 'sinkhole',
    entropyRange: [3.9, 5.1],
    scoreBaseline: 64,
    description:
      'Requête STUN Binding non encapsulée tentant de révéler l’adresse IP WAN d’origine.',
  },
  {
    id: 'sig-brute-socks',
    ruleCode: 'HIDS-BRUTEFORCE-RATE-LIMIT-EXCEEDED',
    label: 'Force brute SOCKS5 / SSH',
    category: 'brute_force',
    mitreId: 'T1110',
    protocol: 'TCP',
    port: 1080,
    severity: 'high',
    defaultAction: 'nft_quarantine',
    entropyRange: [4.6, 5.9],
    scoreBaseline: 82,
    description:
      'Cadence anormale d’échecs d’authentification automatisés par dictionnaire.',
  },
  {
    id: 'sig-dns-poison',
    ruleCode: 'DNS-POISONING-TRANSACTION-ID-MISMATCH',
    label: 'Injection DNS Kaminsky',
    category: 'dns_hijack',
    mitreId: 'T1557.002',
    protocol: 'DNS',
    port: 53,
    severity: 'high',
    defaultAction: 'sinkhole',
    entropyRange: [4.2, 5.5],
    scoreBaseline: 76,
    description:
      'Réponses DNS forgées hors fenêtre de requête interceptées avant le résolveur local.',
  },
];

const HOSTILE_ORIGINS = [
  { ip: '185.220.101.45', country: 'Allemagne' },
  { ip: '91.240.118.82', country: 'Russie' },
  { ip: '162.142.125.44', country: 'Chine' },
  { ip: '45.33.32.156', country: 'États-Unis' },
  { ip: '194.26.29.112', country: 'Pays-Bas' },
  { ip: '5.160.23.109', country: 'Iran' },
  { ip: '89.40.181.12', country: 'Roumanie' },
];

const MAX_TIMELINE_POINTS = 48;
const MAX_FLOW_EVENTS = 60;

function secureRandomUnit(): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function getCategoryLabel(cat: ThreatCategory): string {
  switch (cat) {
    case 'port_scan':
      return 'Scan de ports';
    case 'replay_attack':
      return 'Anti-rejeu PQC';
    case 'c2_beacon':
      return 'Balise C2 / DNS';
    case 'webrtc_leak':
      return 'Fuite STUN';
    case 'brute_force':
      return 'Force brute';
    case 'dns_hijack':
      return 'Hijack DNS';
    default:
      return 'Trafic nominal';
  }
}

function getActionLabel(action: TrafficFlowEvent['actionTaken']): string {
  switch (action) {
    case 'drop_xdp':
      return 'Drop XDP';
    case 'nft_quarantine':
      return 'Quarantaine nftables';
    case 'tunnel_rekey':
      return 'Rekey PQC';
    case 'sinkhole':
      return 'Sinkhole DNS/STUN';
    case 'identity_scramble':
      return 'Re-numérotation';
    default:
      return 'Routage sain';
  }
}

function getSeverityColor(sev: TrafficFlowEvent['severity']): string {
  switch (sev) {
    case 'critical':
      return '#f43f5e'; // rose-500
    case 'high':
      return '#f97316'; // orange-500
    case 'medium':
      return '#f59e0b'; // amber-500
    case 'low':
      return '#38bdf8'; // sky-400
    default:
      return '#10b981'; // emerald-500
  }
}

function mapAttemptToFlowEvent(
  att: IntrusionAttempt,
  seq: number
): TrafficFlowEvent {
  const matchedSig =
    KNOWN_THREAT_SIGNATURES.find((s) => s.category === att.vector) ||
    KNOWN_THREAT_SIGNATURES[0];
  const scoreMap: Record<IntrusionSeverity, number> = {
    critical: 94,
    high: 81,
    medium: 63,
    low: 45,
  };
  const baseEntropy =
    (matchedSig.entropyRange[0] + matchedSig.entropyRange[1]) / 2;
  const ts = Date.parse(att.timestamp) || Date.now();

  return {
    id: `flow-${att.id}-${seq}`,
    seq,
    timestamp: ts,
    timeLabel: new Date(ts).toLocaleTimeString('fr-FR', {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    }),
    sourceIp: att.sourceIp,
    sourceCountry: att.sourceCountry || 'Origine externe',
    targetPort: att.targetPort,
    protocol: att.protocol,
    category:
      att.vector === 'arp_poisoning'
        ? 'dns_hijack'
        : (att.vector as ThreatCategory),
    severity: att.severity,
    signatureRule: att.signatureRule || matchedSig.ruleCode,
    mitreId: matchedSig.mitreId,
    anomalyScore: scoreMap[att.severity],
    confidencePct: att.severity === 'critical' ? 98 : 92,
    shannonEntropy: Number(baseEntropy.toFixed(2)),
    packetRatePps: att.severity === 'critical' ? 1420 : 680,
    payloadKbps: att.severity === 'critical' ? 940 : 410,
    actionTaken: att.actionTaken,
    quarantined: att.quarantined,
    featureWeights: {
      entropyDelta: att.vector === 'replay_attack' ? 0.94 : 0.72,
      burstRatio: att.vector === 'port_scan' ? 0.96 : 0.65,
      periodicity: att.vector === 'c2_beacon' ? 0.95 : 0.44,
      signatureMatch: 0.97,
    },
  };
}

export const SentinelTrafficFlow: React.FC<SentinelTrafficFlowProps> = ({
  isConnected,
  mode,
  currentIdentity,
  throughput,
  settings,
  onApplyPatch,
  addLog,
}) => {
  const [chartTab, setChartTab] = useState<'stream' | 'sankey' | 'scatter'>(
    'stream'
  );
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'critical_high' | 'c2_dns' | 'scan_brute' | 'nominal'
  >('all');
  const [isPaused, setIsPaused] = useState(false);

  const seqRef = useRef(100);

  // Initialize from real IDS records + baseline nominal traffic
  const [flowEvents, setFlowEvents] = useState<TrafficFlowEvent[]>(() => {
    let attempts: IntrusionAttempt[] = INITIAL_INTRUSION_ATTEMPTS;
    try {
      const saved = localStorage.getItem('renumerate_ids_attempts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          attempts = parsed;
        }
      }
    } catch {
      // Fallback cleanly to INITIAL_INTRUSION_ATTEMPTS
    }

    const seededAnomalies = attempts
      .slice(0, 8)
      .map((att, idx) => mapAttemptToFlowEvent(att, 10 + idx));

    const nominalSeed: TrafficFlowEvent[] = Array.from({ length: 6 }).map(
      (_, i) => {
        const ts = Date.now() - (6 - i) * 2000;
        return {
          id: `flow-nom-${i}`,
          seq: i + 1,
          timestamp: ts,
          timeLabel: new Date(ts).toLocaleTimeString('fr-FR', {
            hour12: false,
            minute: '2-digit',
            second: '2-digit',
          }),
          sourceIp: currentIdentity.ip,
          sourceCountry: currentIdentity.country,
          targetPort: settings.tunnelPort,
          protocol: settings.protocol === 'wireguard' ? 'UDP' : 'TCP',
          category: 'nominal',
          severity: 'nominal',
          signatureRule: 'TRAFFIC-BASELINE-TUNNEL-NOMINAL',
          mitreId: 'AUCUN',
          anomalyScore: Math.round(7 + i * 1.4),
          confidencePct: 99,
          shannonEntropy: Number((7.84 + (i % 3) * 0.03).toFixed(2)),
          packetRatePps: 240 + i * 28,
          payloadKbps: 1200 + i * 180,
          actionTaken: 'allow_tunnel',
          quarantined: false,
          featureWeights: {
            entropyDelta: 0.06,
            burstRatio: 0.12,
            periodicity: 0.09,
            signatureMatch: 0.02,
          },
        };
      }
    );

    return [...seededAnomalies, ...nominalSeed].sort(
      (a, b) => b.timestamp - a.timestamp
    );
  });

  const [timeline, setTimeline] = useState<FlowTimelinePoint[]>(() => {
    const now = Date.now();
    const points: FlowTimelinePoint[] = [];
    for (let i = 0; i < 32; i++) {
      const ts = now - (32 - i) * 1100;
      const isSpike = i === 11 || i === 23;
      const u = (i * 37) % 10;
      points.push({
        seq: i + 1,
        timestamp: ts,
        timeLabel: new Date(ts).toLocaleTimeString('fr-FR', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
        totalKbps: isConnected ? 1850 + u * 210 + (isSpike ? 980 : 0) : 280 + u * 35,
        anomalyScore: isSpike ? (i === 23 ? 88 : 74) : 11 + (u % 7) * 2.1,
        shannonEntropy: Number(
          (isSpike ? 6.65 : isConnected ? 7.82 : 5.42).toFixed(2)
        ),
        baselineEntropy: isConnected ? 7.85 : 5.5,
      });
    }
    return points;
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredTimelinePoint, setHoveredTimelinePoint] =
    useState<FlowTimelinePoint | null>(null);
  const [inspectedFlow, setInspectedFlow] = useState<TrafficFlowEvent | null>(
    null
  );
  const [autoInspectOnAnomaly, setAutoInspectOnAnomaly] =
    useState<boolean>(true);
  const autoInspectRef = useRef<boolean>(true);
  autoInspectRef.current = autoInspectOnAnomaly;
  const inspectedOpenRef = useRef<boolean>(false);
  inspectedOpenRef.current = Boolean(inspectedFlow);
  const lastAutoInspectAtRef = useRef<number>(0);

  const selectedEvent = useMemo(
    () =>
      flowEvents.find((e) => e.id === selectedEventId) ||
      flowEvents.find((e) => e.category !== 'nominal') ||
      flowEvents[0] ||
      null,
    [flowEvents, selectedEventId]
  );

  // Active anomaly alert threshold driven by user's real IDS sensitivity setting
  const anomalyThreshold = useMemo(() => {
    if (settings.idsSensitivity === 'paranoid') return 40;
    if (settings.idsSensitivity === 'high') return 55;
    return 70;
  }, [settings.idsSensitivity]);

  // Listen for real-time IDS intrusion broadcasts across the application
  useEffect(() => {
    const handleIdsEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<IntrusionAttempt>;
      if (!customEv.detail) return;
      seqRef.current += 1;
      const mapped = mapAttemptToFlowEvent(customEv.detail, seqRef.current);

      setFlowEvents((prev) => [mapped, ...prev].slice(0, MAX_FLOW_EVENTS));
      setTimeline((prev) => [
        ...prev.slice(-(MAX_TIMELINE_POINTS - 1)),
        {
          seq: seqRef.current,
          timestamp: mapped.timestamp,
          timeLabel: mapped.timeLabel,
          totalKbps: mapped.payloadKbps + (throughput.down + throughput.up) * 120,
          anomalyScore: mapped.anomalyScore,
          shannonEntropy: mapped.shannonEntropy,
          baselineEntropy: isConnected ? 7.85 : 5.5,
          event: mapped,
        },
      ]);

      const isExplicitProbe = customEv.detail.id.startsWith('ids-sentinel-');
      if (isExplicitProbe || (autoInspectRef.current && !inspectedOpenRef.current)) {
        lastAutoInspectAtRef.current = Date.now();
        setSelectedEventId(mapped.id);
        setInspectedFlow(mapped);
      }
    };

    window.addEventListener('renumerate_intrusion_blocked', handleIdsEvent);
    return () =>
      window.removeEventListener('renumerate_intrusion_blocked', handleIdsEvent);
  }, [throughput.down, throughput.up, isConnected]);

  // Continuous real-time D3 telemetry sampling correlated with tunnel throughput & IDS sensitivity
  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      seqRef.current += 1;
      const seq = seqRef.current;
      const now = Date.now();
      const timeLabel = new Date(now).toLocaleTimeString('fr-FR', {
        hour12: false,
        minute: '2-digit',
        second: '2-digit',
      });

      const u0 = secureRandomUnit();
      const u1 = secureRandomUnit();
      const u2 = secureRandomUnit();

      // Anomaly probability scales modestly with traffic & IDS sensitivity
      const triggerRate =
        settings.idsSensitivity === 'paranoid'
          ? 0.22
          : settings.idsSensitivity === 'high'
            ? 0.16
            : 0.11;

      const activeMbps = Math.max(0.2, throughput.down + throughput.up);
      const baseKbps = isConnected
        ? Math.round(activeMbps * 1024 * (0.85 + u1 * 0.32))
        : Math.round(140 + u1 * 210);

      let emittedEvent: TrafficFlowEvent | undefined;
      let pointScore = Number((8 + u2 * 14).toFixed(1));
      let pointEntropy = Number(
        ((isConnected ? 7.86 : 5.45) + (u1 - 0.5) * 0.24).toFixed(2)
      );

      if (u0 < triggerRate) {
        const sig =
          KNOWN_THREAT_SIGNATURES[
            Math.floor(u1 * KNOWN_THREAT_SIGNATURES.length) %
              KNOWN_THREAT_SIGNATURES.length
          ];
        const origin =
          HOSTILE_ORIGINS[
            Math.floor(u2 * HOSTILE_ORIGINS.length) % HOSTILE_ORIGINS.length
          ];
        const jitterScore = Math.round((u2 - 0.5) * 10);
        const computedScore = Math.max(
          38,
          Math.min(99, sig.scoreBaseline + jitterScore)
        );
        const entropySpan = sig.entropyRange[1] - sig.entropyRange[0];
        const computedEntropy = Number(
          (sig.entropyRange[0] + u1 * entropySpan).toFixed(2)
        );

        emittedEvent = {
          id: `flow-live-${seq}-${now}`,
          seq,
          timestamp: now,
          timeLabel,
          sourceIp: origin.ip,
          sourceCountry: origin.country,
          targetPort: sig.port,
          protocol: sig.protocol,
          category: sig.category,
          severity: sig.severity,
          signatureRule: sig.ruleCode,
          mitreId: sig.mitreId,
          anomalyScore: computedScore,
          confidencePct: Math.round(87 + u2 * 12),
          shannonEntropy: computedEntropy,
          packetRatePps: Math.round(380 + u1 * 1250),
          payloadKbps: Math.round(220 + u2 * 850),
          actionTaken: settings.idsEnabled ? sig.defaultAction : 'allow_tunnel',
          quarantined: settings.idsEnabled && settings.idsAutoQuarantine,
          featureWeights: {
            entropyDelta: Number((0.55 + u0 * 0.4).toFixed(2)),
            burstRatio: Number((0.45 + u1 * 0.5).toFixed(2)),
            periodicity: Number((0.35 + u2 * 0.6).toFixed(2)),
            signatureMatch: Number((0.86 + u1 * 0.13).toFixed(2)),
          },
        };

        pointScore = emittedEvent.anomalyScore;
        pointEntropy = emittedEvent.shannonEntropy;

        setFlowEvents((prev) =>
          [emittedEvent!, ...prev].slice(0, MAX_FLOW_EVENTS)
        );

        if (
          autoInspectRef.current &&
          !inspectedOpenRef.current &&
          emittedEvent.anomalyScore >= anomalyThreshold &&
          (emittedEvent.severity === 'high' ||
            emittedEvent.severity === 'critical') &&
          now - lastAutoInspectAtRef.current > 45_000
        ) {
          lastAutoInspectAtRef.current = now;
          setSelectedEventId(emittedEvent.id);
          setInspectedFlow(emittedEvent);
        }
      } else if (seq % 4 === 0) {
        // Record periodic baseline nominal flow sample for scatter & filter completeness
        emittedEvent = {
          id: `flow-nom-${seq}`,
          seq,
          timestamp: now,
          timeLabel,
          sourceIp: currentIdentity.ip,
          sourceCountry: currentIdentity.country,
          targetPort: settings.tunnelPort,
          protocol: settings.protocol === 'wireguard' ? 'UDP' : 'TCP',
          category: 'nominal',
          severity: 'nominal',
          signatureRule: `BASELINE-${mode.toUpperCase().replace(/\s+/g, '_')}`,
          mitreId: 'AUCUN',
          anomalyScore: Math.round(pointScore),
          confidencePct: 99,
          shannonEntropy: pointEntropy,
          packetRatePps: Math.round(180 + activeMbps * 45),
          payloadKbps: baseKbps,
          actionTaken: 'allow_tunnel',
          quarantined: false,
          featureWeights: {
            entropyDelta: 0.05,
            burstRatio: 0.1,
            periodicity: 0.08,
            signatureMatch: 0.01,
          },
        };
        setFlowEvents((prev) =>
          [emittedEvent!, ...prev].slice(0, MAX_FLOW_EVENTS)
        );
      }

      setTimeline((prev) => [
        ...prev.slice(-(MAX_TIMELINE_POINTS - 1)),
        {
          seq,
          timestamp: now,
          timeLabel,
          totalKbps: baseKbps + (emittedEvent ? emittedEvent.payloadKbps : 0),
          anomalyScore: pointScore,
          shannonEntropy: pointEntropy,
          baselineEntropy: isConnected ? 7.85 : 5.45,
          event: emittedEvent?.category !== 'nominal' ? emittedEvent : undefined,
        },
      ]);
    }, 1050);

    return () => window.clearInterval(timer);
  }, [
    isPaused,
    isConnected,
    mode,
    currentIdentity.ip,
    currentIdentity.country,
    throughput.up,
    throughput.down,
    settings.idsSensitivity,
    settings.idsEnabled,
    settings.idsAutoQuarantine,
    settings.tunnelPort,
    settings.protocol,
  ]);

  // Trigger a targeted signature test anomaly (also dispatches to IDS + Planetarium)
  const handleInjectSignatureProbe = useCallback(() => {
    const idx = Math.floor(secureRandomUnit() * KNOWN_THREAT_SIGNATURES.length);
    const sig = KNOWN_THREAT_SIGNATURES[idx];
    const origin =
      HOSTILE_ORIGINS[Math.floor(secureRandomUnit() * HOSTILE_ORIGINS.length)];
    const geo = resolveThreatGeoposition(origin.country, origin.ip);

    const probeAttempt: IntrusionAttempt = {
      id: `ids-sentinel-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: sig.severity,
      vector: sig.category as IntrusionVector,
      title: `${sig.label} (Sonde Sentinel-IA)`,
      description: sig.description,
      sourceIp: origin.ip,
      sourceCountry: geo.country,
      sourceCity: geo.city,
      sourceCoords: geo.coords,
      sourceAsn: geo.defaultAsn,
      targetPort: sig.port,
      targetInterface: sig.port === 51820 ? 'wg0' : 'eth0',
      protocol: sig.protocol,
      signatureRule: sig.ruleCode,
      actionTaken: sig.defaultAction,
      quarantined: settings.idsAutoQuarantine,
      remediationAdvice: `Classification Sentinel-IA (${sig.mitreId}) : règle ${sig.ruleCode} appliquée automatiquement.`,
    };

    try {
      const existingRaw = localStorage.getItem('renumerate_ids_attempts');
      const existing: IntrusionAttempt[] = existingRaw
        ? JSON.parse(existingRaw)
        : INITIAL_INTRUSION_ATTEMPTS;
      localStorage.setItem(
        'renumerate_ids_attempts',
        JSON.stringify([probeAttempt, ...existing].slice(0, 40))
      );
    } catch {
      // Ignore storage quota errors
    }

    window.dispatchEvent(
      new CustomEvent('renumerate_intrusion_blocked', { detail: probeAttempt })
    );

    addLog?.(
      `[Sentinel-IA] Anomalie catégorisée : ${sig.label} (${sig.ruleCode}, ${sig.mitreId}) depuis ${origin.ip}`,
      sig.severity === 'critical' ? 'error' : 'warning',
      origin.ip
    );
  }, [settings.idsAutoQuarantine, addLog]);

  const handleQuarantineFlow = useCallback(
    (flow: TrafficFlowEvent) => {
      setFlowEvents((prev) =>
        prev.map((item) =>
          item.id === flow.id
            ? { ...item, quarantined: true, actionTaken: 'nft_quarantine' }
            : item
        )
      );
      addLog?.(
        `[Sentinel-IA] Hôte ${flow.sourceIp} isolé via quarantaine nftables (${flow.signatureRule})`,
        'success',
        flow.sourceIp
      );
    },
    [addLog]
  );

  const handleExportReport = useCallback(() => {
    const anomalies = flowEvents.filter((f) => f.category !== 'nominal');
    const payload = {
      exportedAt: new Date().toISOString(),
      tunnelNode: currentIdentity.ip,
      sensitivity: settings.idsSensitivity,
      anomalyThreshold,
      totalCategorizedAnomalies: anomalies.length,
      events: anomalies,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-ia-flow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [flowEvents, currentIdentity.ip, settings.idsSensitivity, anomalyThreshold]);

  // Filtered list for inspection matrix
  const filteredEvents = useMemo(() => {
    return flowEvents.filter((f) => {
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'critical_high') {
        return f.severity === 'critical' || f.severity === 'high';
      }
      if (categoryFilter === 'c2_dns') {
        return (
          f.category === 'c2_beacon' ||
          f.category === 'dns_hijack' ||
          f.category === 'webrtc_leak'
        );
      }
      if (categoryFilter === 'scan_brute') {
        return (
          f.category === 'port_scan' ||
          f.category === 'brute_force' ||
          f.category === 'replay_attack'
        );
      }
      return f.category === 'nominal';
    });
  }, [flowEvents, categoryFilter]);

  // Summary KPIs computed from live classified flows
  const metrics = useMemo(() => {
    const anomalies = flowEvents.filter((f) => f.category !== 'nominal');
    const criticalCount = anomalies.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    ).length;
    const quarantinedCount = anomalies.filter((f) => f.quarantined).length;
    const latestEntropy =
      timeline[timeline.length - 1]?.shannonEntropy ?? 7.82;
    const avgScore =
      anomalies.length > 0
        ? Math.round(
            anomalies.reduce((acc, f) => acc + f.anomalyScore, 0) /
              anomalies.length
          )
        : 0;
    const containmentPct =
      anomalies.length > 0
        ? Math.round((quarantinedCount / anomalies.length) * 100)
        : 100;

    return {
      totalAnomalies: anomalies.length,
      criticalCount,
      latestEntropy,
      avgScore,
      containmentPct,
    };
  }, [flowEvents, timeline]);

  // Responsive D3 canvas measurement
  const canvasBoxRef = useRef<HTMLDivElement | null>(null);
  const streamSvgRef = useRef<SVGSVGElement | null>(null);
  const sankeySvgRef = useRef<SVGSVGElement | null>(null);
  const scatterSvgRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState(720);

  useEffect(() => {
    const el = canvasBoxRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 160) setSvgWidth(w);
    };
    update();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // =========================================================================
  // D3 CHART 1: Real-Time Traffic Volume, Anomaly Score & Categorized Spikes
  // =========================================================================
  useEffect(() => {
    if (chartTab !== 'stream' || !streamSvgRef.current || timeline.length < 2) {
      return;
    }

    const svg = d3.select(streamSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 252;
    const margin = { top: 20, right: 48, bottom: 28, left: 48 };
    const innerW = Math.max(140, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');
    const scoreGrad = defs
      .append('linearGradient')
      .attr('id', 'sentinel-score-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    scoreGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f43f5e')
      .attr('stop-opacity', 0.35);
    scoreGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f43f5e')
      .attr('stop-opacity', 0.02);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, timeline.length - 1])
      .range([0, innerW]);

    const yScore = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);
    const maxKbps = Math.max(1200, (d3.max(timeline, (d) => d.totalKbps) || 3000) * 1.15);
    const yKbps = d3.scaleLinear().domain([0, maxKbps]).range([innerH, innerH * 0.35]);

    // Grid lines
    g.append('g')
      .call(
        d3
          .axisLeft(yScore)
          .ticks(4)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((grid) => grid.select('.domain').remove())
      .call((grid) =>
        grid
          .selectAll('line')
          .attr('stroke', '#334155')
          .attr('stroke-opacity', 0.35)
          .attr('stroke-dasharray', '2,3')
      );

    // Detection threshold band & dashed line
    const threshY = yScore(anomalyThreshold);
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerW)
      .attr('height', threshY)
      .attr('fill', '#f43f5e')
      .attr('opacity', 0.05);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', threshY)
      .attr('y2', threshY)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '5,4');

    g.append('text')
      .attr('x', 6)
      .attr('y', Math.max(11, threshY - 5))
      .attr('fill', '#fbbf24')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`SEUIL SENTINEL (${settings.idsSensitivity.toUpperCase()} ≥ ${anomalyThreshold})`);

    // Traffic throughput area (background context)
    const throughputArea = d3
      .area<FlowTimelinePoint>()
      .x((_, i) => x(i))
      .y0(innerH)
      .y1((d) => yKbps(d.totalKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(timeline)
      .attr('fill', '#06b6d4')
      .attr('fill-opacity', 0.14)
      .attr('d', throughputArea);

    const throughputLine = d3
      .line<FlowTimelinePoint>()
      .x((_, i) => x(i))
      .y((d) => yKbps(d.totalKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(timeline)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 1.4)
      .attr('stroke-opacity', 0.65)
      .attr('d', throughputLine);

    // Anomaly Score area + curve
    const scoreArea = d3
      .area<FlowTimelinePoint>()
      .x((_, i) => x(i))
      .y0(innerH)
      .y1((d) => yScore(d.anomalyScore))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(timeline)
      .attr('fill', 'url(#sentinel-score-grad)')
      .attr('d', scoreArea);

    const scoreLine = d3
      .line<FlowTimelinePoint>()
      .x((_, i) => x(i))
      .y((d) => yScore(d.anomalyScore))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(timeline)
      .attr('fill', 'none')
      .attr('stroke', '#fb7185')
      .attr('stroke-width', 2)
      .attr('d', scoreLine);

    // Classified Threat Event Symbols (D3 shape-coded for accessibility)
    const symbolGen = d3.symbol();
    const spikePoints = timeline
      .map((pt, idx) => ({ pt, idx }))
      .filter(({ pt }) => pt.event && pt.event.category !== 'nominal');

    g.selectAll('.anomaly-marker')
      .data(spikePoints)
      .enter()
      .append('path')
      .attr('transform', (d) => `translate(${x(d.idx)},${yScore(d.pt.anomalyScore)})`)
      .attr('d', (d) => {
        const sev = d.pt.event?.severity;
        if (sev === 'critical') {
          return symbolGen.type(d3.symbolTriangle).size(85)() || '';
        }
        if (sev === 'high') {
          return symbolGen.type(d3.symbolDiamond).size(75)() || '';
        }
        return symbolGen.type(d3.symbolCircle).size(55)() || '';
      })
      .attr('fill', (d) => getSeverityColor(d.pt.event?.severity || 'nominal'))
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        if (d.pt.event) setSelectedEventId(d.pt.event.id);
      });

    // Axes
    const tickIndices = [
      0,
      Math.floor((timeline.length - 1) * 0.33),
      Math.floor((timeline.length - 1) * 0.66),
      timeline.length - 1,
    ];
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickIndices)
          .tickFormat((val) => timeline[Number(val)]?.timeLabel || '')
      )
      .call((ax) => ax.select('.domain').attr('stroke', '#334155'))
      .call((ax) => ax.selectAll('line').attr('stroke', '#334155'))
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    g.append('g')
      .call(
        d3
          .axisLeft(yScore)
          .ticks(4)
          .tickFormat((d) => `${d}%`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#fb7185')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    g.append('g')
      .attr('transform', `translate(${innerW},0)`)
      .call(
        d3
          .axisRight(yKbps)
          .ticks(3)
          .tickFormat((d) => `${(Number(d) / 1000).toFixed(1)}M`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#22d3ee')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    // Interactive Crosshair
    const crosshair = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .style('display', 'none');

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const idx = Math.min(
          timeline.length - 1,
          Math.max(0, Math.round(x.invert(mx)))
        );
        const pt = timeline[idx];
        if (!pt) return;
        crosshair
          .style('display', null)
          .attr('x1', x(idx))
          .attr('x2', x(idx));
        setHoveredTimelinePoint(pt);
      })
      .on('mouseleave', () => {
        crosshair.style('display', 'none');
        setHoveredTimelinePoint(null);
      })
      .on('click', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const idx = Math.min(
          timeline.length - 1,
          Math.max(0, Math.round(x.invert(mx)))
        );
        const pt = timeline[idx];
        if (pt?.event) {
          setSelectedEventId(pt.event.id);
        }
      });
  }, [chartTab, timeline, svgWidth, anomalyThreshold, settings.idsSensitivity]);

  // =========================================================================
  // D3 CHART 2: Signature Attribution Flow Diagram (Protocol -> Signature -> Verdict)
  // =========================================================================
  useEffect(() => {
    if (chartTab !== 'sankey' || !sankeySvgRef.current) return;

    const svg = d3.select(sankeySvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 252;
    const margin = { top: 18, right: 16, bottom: 16, left: 16 };
    const innerW = Math.max(240, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const anomalies = flowEvents.filter((f) => f.category !== 'nominal');
    const nominalCount = Math.max(
      1,
      flowEvents.filter((f) => f.category === 'nominal').length
    );

    const protoBuckets = [
      { id: 'UDP', label: 'UDP :51820 / STUN', color: '#22d3ee' },
      { id: 'TCP', label: 'TCP :22 / 1080 / 443', color: '#818cf8' },
      { id: 'DNS', label: 'DNS :53', color: '#f59e0b' },
    ];

    const sigBuckets = [
      { id: 'nominal', label: 'Baseline Saine', color: '#10b981' },
      { id: 'port_scan', label: 'Scan SYN', color: '#f97316' },
      { id: 'replay_attack', label: 'Anti-Rejeu PQC', color: '#f43f5e' },
      { id: 'c2_beacon', label: 'Balise C2 / DNS', color: '#ec4899' },
      { id: 'brute_force', label: 'Force Brute', color: '#fb923c' },
      { id: 'webrtc_leak', label: 'Fuite STUN / Hijack', color: '#eab308' },
    ];

    const verdictBuckets = [
      { id: 'allow_tunnel', label: 'Tunnel Chiffré', color: '#10b981' },
      { id: 'drop_xdp', label: 'Rejet eBPF/XDP', color: '#38bdf8' },
      { id: 'nft_quarantine', label: 'Quarantaine nft', color: '#f43f5e' },
      { id: 'sinkhole', label: 'Sinkhole Isolé', color: '#f59e0b' },
      { id: 'tunnel_rekey', label: 'Rekey Éphémère', color: '#a855f7' },
    ];

    const colX = [10, innerW * 0.44, innerW - 148];
    const nodeW = 132;

    const placeColumn = <T extends { id: string; label: string; color: string }>(
      items: T[],
      xPos: number
    ) => {
      const gap = 8;
      const boxH = Math.max(
        22,
        Math.floor((innerH - gap * (items.length - 1)) / items.length)
      );
      return items.map((item, idx) => ({
        ...item,
        x: xPos,
        y: idx * (boxH + gap),
        h: boxH,
      }));
    };

    const protoNodes = placeColumn(protoBuckets, colX[0]);
    const sigNodes = placeColumn(sigBuckets, colX[1]);
    const verdictNodes = placeColumn(verdictBuckets, colX[2]);

    // Aggregate link counts
    const links: Array<{
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      weight: number;
      color: string;
      category?: ThreatCategory;
    }> = [];

    // Nominal flow link
    const udpNode = protoNodes.find((p) => p.id === 'UDP')!;
    const nomSig = sigNodes.find((s) => s.id === 'nominal')!;
    const allowVer = verdictNodes.find((v) => v.id === 'allow_tunnel')!;

    links.push(
      {
        x0: udpNode.x + nodeW,
        y0: udpNode.y + udpNode.h * 0.35,
        x1: nomSig.x,
        y1: nomSig.y + nomSig.h / 2,
        weight: nominalCount,
        color: '#10b981',
        category: 'nominal',
      },
      {
        x0: nomSig.x + nodeW,
        y0: nomSig.y + nomSig.h / 2,
        x1: allowVer.x,
        y1: allowVer.y + allowVer.h / 2,
        weight: nominalCount,
        color: '#10b981',
        category: 'nominal',
      }
    );

    // Anomaly flow links
    anomalies.forEach((evt) => {
      const pId = evt.protocol === 'DNS' ? 'DNS' : evt.protocol === 'TCP' ? 'TCP' : 'UDP';
      const sId =
        evt.category === 'dns_hijack' ? 'webrtc_leak' : evt.category;
      const vId =
        evt.actionTaken === 'identity_scramble'
          ? 'tunnel_rekey'
          : evt.actionTaken;

      const pNode = protoNodes.find((p) => p.id === pId) || udpNode;
      const sNode = sigNodes.find((s) => s.id === sId) || sigNodes[1];
      const vNode = verdictNodes.find((v) => v.id === vId) || verdictNodes[1];

      links.push(
        {
          x0: pNode.x + nodeW,
          y0: pNode.y + pNode.h * 0.65,
          x1: sNode.x,
          y1: sNode.y + sNode.h / 2,
          weight: 1,
          color: sNode.color,
          category: evt.category,
        },
        {
          x0: sNode.x + nodeW,
          y0: sNode.y + sNode.h / 2,
          x1: vNode.x,
          y1: vNode.y + vNode.h / 2,
          weight: 1,
          color: vNode.color,
          category: evt.category,
        }
      );
    });

    // Deduplicate & aggregate link weights
    const mergedMap = new Map<
      string,
      {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
        weight: number;
        color: string;
        category?: ThreatCategory;
      }
    >();
    links.forEach((lk) => {
      const key = `${lk.x0}:${lk.y0}->${lk.x1}:${lk.y1}`;
      const prev = mergedMap.get(key);
      if (prev) {
        prev.weight += lk.weight;
      } else {
        mergedMap.set(key, { ...lk });
      }
    });

    const mergedLinks = Array.from(mergedMap.values());
    const strokeScale = d3
      .scaleSqrt()
      .domain([1, Math.max(4, d3.max(mergedLinks, (l) => l.weight) || 6)])
      .range([2.2, 11]);

    // Draw smooth cubic Bezier links using d3.path()
    g.selectAll('.sankey-link')
      .data(mergedLinks)
      .enter()
      .append('path')
      .attr('d', (d) => {
        const path = d3.path();
        const midX = (d.x0 + d.x1) / 2;
        path.moveTo(d.x0, d.y0);
        path.bezierCurveTo(midX, d.y0, midX, d.y1, d.x1, d.y1);
        return path.toString();
      })
      .attr('fill', 'none')
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => strokeScale(d.weight))
      .attr('stroke-opacity', 0.42)
      .style('cursor', 'pointer')
      .on('mouseenter', function () {
        d3.select(this).attr('stroke-opacity', 0.88);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke-opacity', 0.42);
      })
      .on('click', (_, d) => {
        const match = flowEvents.find((f) => f.category === d.category);
        if (match) setSelectedEventId(match.id);
      });

    // Render nodes across all 3 columns
    const renderColNodes = (
      colItems: Array<{
        id: string;
        label: string;
        color: string;
        x: number;
        y: number;
        h: number;
      }>,
      countFn: (id: string) => number
    ) => {
      const grp = g
        .selectAll(`.col-node-${colItems[0]?.x || 0}`)
        .data(colItems)
        .enter()
        .append('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      grp
        .append('rect')
        .attr('width', nodeW)
        .attr('height', (d) => d.h)
        .attr('rx', 6)
        .attr('fill', '#0f172a')
        .attr('stroke', (d) => d.color)
        .attr('stroke-opacity', 0.65)
        .attr('stroke-width', 1.2);

      grp
        .append('text')
        .attr('x', 8)
        .attr('y', (d) => d.h / 2 + 3)
        .attr('fill', '#e2e8f0')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text((d) => `${d.label} (${countFn(d.id)})`);
    };

    renderColNodes(protoNodes, (id) =>
      flowEvents.filter((f) =>
        id === 'DNS' ? f.protocol === 'DNS' : id === 'TCP' ? f.protocol === 'TCP' : f.protocol === 'UDP'
      ).length
    );

    renderColNodes(sigNodes, (id) =>
      flowEvents.filter((f) =>
        id === 'webrtc_leak'
          ? f.category === 'webrtc_leak' || f.category === 'dns_hijack'
          : f.category === id
      ).length
    );

    renderColNodes(verdictNodes, (id) =>
      flowEvents.filter((f) =>
        id === 'tunnel_rekey'
          ? f.actionTaken === 'tunnel_rekey' || f.actionTaken === 'identity_scramble'
          : f.actionTaken === id
      ).length
    );
  }, [chartTab, flowEvents, svgWidth]);

  // =========================================================================
  // D3 CHART 3: Shannon Entropy vs AI Anomaly Score Scatterplot
  // =========================================================================
  useEffect(() => {
    if (chartTab !== 'scatter' || !scatterSvgRef.current) return;

    const svg = d3.select(scatterSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 252;
    const margin = { top: 18, right: 24, bottom: 32, left: 48 };
    const innerW = Math.max(140, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([2.0, 8.2]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    // Decision boundary zone
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerW)
      .attr('height', y(anomalyThreshold))
      .attr('fill', '#f43f5e')
      .attr('opacity', 0.06);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(anomalyThreshold))
      .attr('y2', y(anomalyThreshold))
      .attr('stroke', '#f59e0b')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1.2);

    g.append('text')
      .attr('x', innerW - 145)
      .attr('y', Math.max(12, y(anomalyThreshold) - 6))
      .attr('fill', '#fbbf24')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`Zone d'anomalie ≥ ${anomalyThreshold}`);

    // Optimal encrypted WireGuard entropy reference band (7.5 - 8.0 bits/byte)
    g.append('rect')
      .attr('x', x(7.5))
      .attr('y', 0)
      .attr('width', x(8.0) - x(7.5))
      .attr('height', innerH)
      .attr('fill', '#10b981')
      .attr('opacity', 0.08);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(6)
          .tickFormat((d) => `${d} b/o`)
      )
      .call((ax) => ax.select('.domain').attr('stroke', '#334155'))
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((d) => `${d}%`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    const symbolGen = d3.symbol();
    g.selectAll('.scatter-node')
      .data(flowEvents.slice(0, 36))
      .enter()
      .append('path')
      .attr(
        'transform',
        (d) => `translate(${x(d.shannonEntropy)},${y(d.anomalyScore)})`
      )
      .attr('d', (d) => {
        if (d.severity === 'critical') {
          return symbolGen.type(d3.symbolTriangle).size(90)() || '';
        }
        if (d.severity === 'high') {
          return symbolGen.type(d3.symbolDiamond).size(80)() || '';
        }
        return symbolGen.type(d3.symbolCircle).size(55)() || '';
      })
      .attr('fill', (d) => getSeverityColor(d.severity))
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d) =>
        selectedEvent?.id === d.id ? '#ffffff' : '#0f172a'
      )
      .attr('stroke-width', (d) => (selectedEvent?.id === d.id ? 2.2 : 1.2))
      .style('cursor', 'pointer')
      .on('click', (_, d) => setSelectedEventId(d.id));
  }, [chartTab, flowEvents, svgWidth, anomalyThreshold, selectedEvent?.id]);

  return (
    <section
      id="sentinel-ia-traffic-flow"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Radar className="w-4 h-4 text-rose-500 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Sentinel-IA Traffic Flow (Détection &amp; Classification D3.js)
            </h2>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Sensibilité {settings.idsSensitivity} · Seuil {anomalyThreshold}%
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Corrélation en temps réel des flux réseau, de l’entropie de Shannon et des signatures de menaces connues ({KNOWN_THREAT_SIGNATURES.length} modèles actifs).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'stream', label: 'Flux temporel' },
                { id: 'sankey', label: 'Flux Signatures' },
                { id: 'scatter', label: 'Nuage Entropie' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartTab(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  chartTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAutoInspectOnAnomaly((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              autoInspectOnAnomaly
                ? 'bg-cyan-600/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/35'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
            title="Ouvrir automatiquement la modale d’inspection DPI hexadécimale lorsqu’une anomalie est détectée"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>DPI Auto {autoInspectOnAnomaly ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleInjectSignatureProbe}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Tester une anomalie contre les signatures Sentinel-IA et ouvrir l’inspecteur DPI"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Tester Signature</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={isPaused ? 'Reprendre l’analyse' : 'Mettre en pause'}
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleExportReport}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Exporter les anomalies catégorisées (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* 4-Column Telemetry Metrics Strip (clean hairline borders, tabular numerals) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Anomalies classées</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
              {metrics.totalAnomalies}{' '}
              <span className="text-xs font-normal text-rose-600 dark:text-rose-400">
                / {metrics.criticalCount} critiques
              </span>
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              Confinement {metrics.containmentPct}%
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Entropie Shannon</span>
              <Activity className="w-3.5 h-3.5 text-cyan-500" />
            </div>
            <div className="text-base font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
              {metrics.latestEntropy.toFixed(2)} b/o
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {isConnected ? 'Cible PQC 7.85 b/o' : 'Référence locale 5.45 b/o'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Score moyen d’écart</span>
              <Radar className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {metrics.avgScore} / 100
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              Débit actif {(throughput.down + throughput.up).toFixed(1)} Mb/s
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Défense Sentinel-IA</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {settings.idsEnabled ? 'Active (XDP)' : 'En veille'}
            </div>
            <div className="text-[11px] text-slate-500">
              {settings.idsAutoQuarantine
                ? 'Quarantaine automatique'
                : 'Alerte manuelle'}
            </div>
          </div>
        </div>

        {/* D3 Visualization Stage */}
        <div
          ref={canvasBoxRef}
          className="relative w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1.5 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              {chartTab === 'stream' && (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-rose-400 inline-block" />
                    <span>Score Anomalie (%)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                    <span>Volume Trafic (Mb/s)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                    <span>Seuil ({anomalyThreshold}%)</span>
                  </span>
                </>
              )}
              {chartTab === 'sankey' && (
                <span>
                  Attribution en flux D3 : Protocole → Signature connue → Verdict pare-feu
                </span>
              )}
              {chartTab === 'scatter' && (
                <span>
                  Corrélation Entropie Shannon (b/o) vs Score d’Anomalie IA (%) · Cliquez un point pour inspecter
                </span>
              )}
            </div>

            {hoveredTimelinePoint && chartTab === 'stream' ? (
              <div className="text-cyan-300 tabular-nums">
                {hoveredTimelinePoint.timeLabel} · Score{' '}
                {hoveredTimelinePoint.anomalyScore}% · Entropie{' '}
                {hoveredTimelinePoint.shannonEntropy} b/o
                {hoveredTimelinePoint.event
                  ? ` · ${getCategoryLabel(hoveredTimelinePoint.event.category)}`
                  : ''}
              </div>
            ) : (
              <div className="text-slate-500">
                {isPaused ? 'Flux en pause' : 'Analyse temps réel active'}
              </div>
            )}
          </div>

          {chartTab === 'stream' && (
            <svg ref={streamSvgRef} className="w-full h-[252px] block" />
          )}
          {chartTab === 'sankey' && (
            <svg ref={sankeySvgRef} className="w-full h-[252px] block" />
          )}
          {chartTab === 'scatter' && (
            <svg ref={scatterSvgRef} className="w-full h-[252px] block" />
          )}
        </div>

        {/* Lower Split: Categorized Flow Queue + Signature Inference Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Flow Queue */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Flux classifiés ({filteredEvents.length})</span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'all', label: 'Tous' },
                    { id: 'critical_high', label: 'Critique / Élevé' },
                    { id: 'c2_dns', label: 'C2 / DNS / STUN' },
                    { id: 'scan_brute', label: 'Scan / Brute' },
                    { id: 'nominal', label: 'Nominal' },
                  ] as const
                ).map((flt) => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setCategoryFilter(flt.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      categoryFilter === flt.id
                        ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 max-h-[250px] overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Aucun flux correspondant à ce filtre pour le moment.
                </div>
              ) : (
                filteredEvents.slice(0, 14).map((evt) => {
                  const isSel = selectedEvent?.id === evt.id;
                  const sevTextColor =
                    evt.severity === 'critical'
                      ? 'text-rose-600 dark:text-rose-400'
                      : evt.severity === 'high'
                        ? 'text-orange-600 dark:text-orange-400'
                        : evt.severity === 'medium'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400';

                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => setSelectedEventId(evt.id)}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-cyan-50/70 dark:bg-cyan-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white truncate">
                          <span className={sevTextColor}>
                            {getCategoryLabel(evt.category)}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {evt.sourceIp}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {evt.protocol}:{evt.targetPort}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {evt.timeLabel} · {evt.signatureRule} · MITRE{' '}
                          {evt.mitreId}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div className={`text-xs font-bold ${sevTextColor}`}>
                          {evt.anomalyScore}%
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {getActionLabel(evt.actionTaken)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Anomaly Signature Inspector */}
          <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-950/50 flex flex-col justify-between gap-3">
            {selectedEvent ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {getCategoryLabel(selectedEvent.category)}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      Confiance {selectedEvent.confidencePct}% · {selectedEvent.mitreId}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-cyan-700 dark:text-cyan-400 break-all">
                    {selectedEvent.signatureRule}
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Origine &amp; Port
                      </span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {selectedEvent.sourceIp} ({selectedEvent.sourceCountry}) ·{' '}
                        {selectedEvent.protocol}/{selectedEvent.targetPort}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Entropie &amp; Cadence
                      </span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {selectedEvent.shannonEntropy} b/o ·{' '}
                        {selectedEvent.packetRatePps} pkt/s
                      </span>
                    </div>
                  </div>

                  {/* Feature attribution weights */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Vecteurs d’attribution Sentinel-IA
                    </div>
                    {(
                      [
                        {
                          label: 'Correspondance signature',
                          val: selectedEvent.featureWeights.signatureMatch,
                          color: 'bg-rose-500',
                        },
                        {
                          label: 'Dérive d’entropie Shannon',
                          val: selectedEvent.featureWeights.entropyDelta,
                          color: 'bg-cyan-500',
                        },
                        {
                          label: 'Ratio de rafale (Burst)',
                          val: selectedEvent.featureWeights.burstRatio,
                          color: 'bg-amber-500',
                        },
                        {
                          label: 'Périodicité C2',
                          val: selectedEvent.featureWeights.periodicity,
                          color: 'bg-purple-500',
                        },
                      ] as const
                    ).map((feat) => (
                      <div key={feat.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                          <span>{feat.label}</span>
                          <span className="font-mono tabular-nums">
                            {Math.round(feat.val * 100)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${feat.color} rounded-full`}
                            style={{ width: `${Math.round(feat.val * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectedFlow(selectedEvent)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>Inspecter Paquet (Hex)</span>
                  </button>

                  {selectedEvent.category !== 'nominal' && (
                    <button
                      type="button"
                      onClick={() => handleQuarantineFlow(selectedEvent)}
                      disabled={selectedEvent.quarantined}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        selectedEvent.quarantined
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 cursor-default'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>
                        {selectedEvent.quarantined
                          ? 'Hôte en quarantaine'
                          : 'Isoler (nftables)'}
                      </span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">
                Sélectionnez un flux dans la liste ou le graphique D3 pour inspecter sa signature.
              </div>
            )}
          </div>
        </div>

        <DnsBreachTester
          isConnected={isConnected}
          currentIdentity={currentIdentity}
          settings={settings}
          onApplyPatch={onApplyPatch}
          addLog={addLog}
        />

        <DataExfiltrationRadar
          isConnected={isConnected}
          mode={mode}
          currentIdentity={currentIdentity}
          throughput={throughput}
          settings={settings}
          onApplyPatch={onApplyPatch}
          addLog={addLog}
        />
      </div>

      {(() => {
        const activeModalFlow = inspectedFlow
          ? flowEvents.find((f) => f.id === inspectedFlow.id) ?? inspectedFlow
          : null;
        if (!activeModalFlow) return null;

        const modalSample: PacketFlowSample = {
          id: activeModalFlow.id,
          seq: activeModalFlow.seq,
          timeLabel: activeModalFlow.timeLabel,
          sourceIp: activeModalFlow.sourceIp,
          sourceCountry: activeModalFlow.sourceCountry,
          targetPort: activeModalFlow.targetPort,
          protocol: activeModalFlow.protocol,
          category: activeModalFlow.category,
          categoryLabel: getCategoryLabel(activeModalFlow.category),
          severity: activeModalFlow.severity,
          signatureRule: activeModalFlow.signatureRule,
          mitreId: activeModalFlow.mitreId,
          anomalyScore: activeModalFlow.anomalyScore,
          confidencePct: activeModalFlow.confidencePct,
          shannonEntropy: activeModalFlow.shannonEntropy,
          packetRatePps: activeModalFlow.packetRatePps,
          payloadKbps: activeModalFlow.payloadKbps,
          actionTaken: activeModalFlow.actionTaken,
          quarantined: activeModalFlow.quarantined,
          featureWeights: activeModalFlow.featureWeights,
        };

        const primarySig = KNOWN_THREAT_SIGNATURES.find(
          (s) =>
            s.category === activeModalFlow.category ||
            s.ruleCode === activeModalFlow.signatureRule
        );
        const correlatedSigs = KNOWN_THREAT_SIGNATURES.filter(
          (s) =>
            s.id !== primarySig?.id &&
            (s.protocol === activeModalFlow.protocol ||
              s.port === activeModalFlow.targetPort)
        );

        const matchedSignatures: MatchedThreatSignatureInfo[] = [
          ...(primarySig
            ? [
                {
                  id: primarySig.id,
                  ruleCode: activeModalFlow.signatureRule,
                  label: primarySig.label,
                  mitreId: primarySig.mitreId,
                  protocol: primarySig.protocol,
                  port: primarySig.port,
                  severity: primarySig.severity,
                  description: primarySig.description,
                  matchPct: activeModalFlow.confidencePct,
                },
              ]
            : []),
          ...correlatedSigs.slice(0, 2).map((s, idx) => ({
            id: s.id,
            ruleCode: s.ruleCode,
            label: s.label,
            mitreId: s.mitreId,
            protocol: s.protocol,
            port: s.port,
            severity: s.severity,
            description: s.description,
            matchPct: Math.max(64, activeModalFlow.confidencePct - 18 - idx * 7),
          })),
        ];

        return (
          <PacketInspectionModal
            isOpen={Boolean(activeModalFlow)}
            sample={modalSample}
            destinationIp={currentIdentity.ip}
            mode={mode}
            settings={settings}
            matchedSignatures={matchedSignatures}
            onClose={() => {
              lastAutoInspectAtRef.current = Date.now();
              setInspectedFlow(null);
            }}
            onQuarantineSample={() => handleQuarantineFlow(activeModalFlow)}
            onHardenIds={() => {
              onApplyPatch?.(
                {
                  idsEnabled: true,
                  idsSensitivity: 'paranoid',
                  idsAutoQuarantine: true,
                },
                'Durcissement IDS déclenché depuis l’inspection de paquets DPI'
              );
            }}
            addLog={addLog}
          />
        );
      })()}
    </section>
  );
};
