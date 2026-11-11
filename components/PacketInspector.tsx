import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Network,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Play,
  Pause,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Zap,
  Filter,
  Eye,
  Layers,
  ArrowUpDown,
  Radio,
  FileCode2,
  Trash2,
  Download,
  Info,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import { AppSettings, VirtualIdentity } from '../types';

export interface PacketInspectorProps {
  settings: AppSettings;
  updateSettings?: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  patchSettings?: (patch: Partial<AppSettings>, reason?: string) => void;
  currentIdentity?: VirtualIdentity;
  isConnected?: boolean;
  addLog?: (event: string, type?: 'info' | 'warning' | 'success' | 'error', ip?: string) => void;
  className?: string;
}

export type PacketVerdict = 'ACCEPT' | 'DROP' | 'REJECT' | 'BYPASS' | 'CORRELATION_ALERT';
export type PacketProtocol = 'WireGuard' | 'DoH' | 'DNS' | 'TCP-TLS' | 'QUIC' | 'ICMP';

export interface RawPacketRecord {
  id: string;
  timestamp: number;
  timeStr: string;
  iface: 'wg0' | 'eth0' | 'sinkhole0';
  direction: 'in' | 'out';
  protocol: PacketProtocol;
  source: string;
  destination: string;
  port: number;
  lengthBytes: number;
  entropyBits: number;
  verdict: PacketVerdict;
  ruleTag: string;
  correlationRisk: number; // 0 to 100%
  timingBurstId?: string;
}

export interface CorrelationAlertRecord {
  id: string;
  timestamp: string;
  riskScore: number;
  ingressBurstLength: number;
  egressBurstLength: number;
  timeDeltaMs: number;
  adversaryNode: string;
  description: string;
  status: 'mitigated' | 'active';
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({
  settings,
  updateSettings,
  patchSettings,
  currentIdentity,
  isConnected = true,
  addLog,
  className = '',
}) => {
  // États de capture et contrôles
  const [isPaused, setIsPaused] = useState(false);
  const [filterVerdict, setFilterVerdict] = useState<string>('all');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [sampleRateMs, setSampleRateMs] = useState<number>(800);
  const [selectedPacket, setSelectedPacket] = useState<RawPacketRecord | null>(null);
  const [hoveredPacket, setHoveredPacket] = useState<RawPacketRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'correlation' | 'breakdown'>('timeline');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Données des paquets
  const [packets, setPackets] = useState<RawPacketRecord[]>(() => {
    const now = Date.now();
    return Array.from({ length: 28 }, (_, i) => {
      const timeOffset = (28 - i) * 800;
      const t = now - timeOffset;
      const d = new Date(t);
      const isFirewallBlocked = i % 7 === 0;
      const isCorrelation = i % 11 === 0;
      const lengthBytes = Math.floor(Math.random() * 1100) + 90;
      return {
        id: `pkt-${t}-${i}`,
        timestamp: t,
        timeStr: d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0'),
        iface: i % 3 === 0 ? 'eth0' : 'wg0',
        direction: i % 2 === 0 ? 'out' : 'in',
        protocol: (['WireGuard', 'TCP-TLS', 'DoH', 'QUIC', 'DNS'] as PacketProtocol[])[i % 5],
        source: i % 2 === 0 ? (currentIdentity?.ip || '10.84.0.2') : '185.220.101.5',
        destination: i % 2 === 0 ? '194.26.29.112' : (currentIdentity?.ip || '10.84.0.2'),
        port: [51820, 443, 853, 53, 9001][i % 5],
        lengthBytes,
        entropyBits: Number((7.4 + Math.random() * 0.58).toFixed(2)),
        verdict: isCorrelation
          ? 'CORRELATION_ALERT'
          : isFirewallBlocked
          ? 'DROP'
          : 'ACCEPT',
        ruleTag: isCorrelation
          ? 'sentinel:timing_correlation_suspect'
          : isFirewallBlocked
          ? 'nftables:drop_unauthorized_egress'
          : 'wireguard:fast_path_accept',
        correlationRisk: isCorrelation ? Math.floor(Math.random() * 25) + 75 : Math.floor(Math.random() * 30),
      };
    });
  });

  // Alertes de corrélation actives
  const [correlationAlerts, setCorrelationAlerts] = useState<CorrelationAlertRecord[]>([
    {
      id: 'corr-01',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      riskScore: 88,
      ingressBurstLength: 1420,
      egressBurstLength: 1420,
      timeDeltaMs: 1.4,
      adversaryNode: 'AS3320 (Deutsche Telekom Surveillance Tap)',
      description: 'Alignement de paquets Ingress eth0 ↔ Egress wg0 détecté par analyse de débit différentiel.',
      status: 'active',
    },
  ]);

  // Références SVG pour les graphiques D3
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);
  const correlationSvgRef = useRef<SVGSVGElement | null>(null);
  const donutSvgRef = useRef<SVGSVGElement | null>(null);

  // Génération dynamique de paquets en temps réel
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const d = new Date(now);
      const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');

      const isCorrelation = Math.random() < 0.12;
      const isFirewallBlocked = !isCorrelation && Math.random() < 0.18;
      const isBypass = !isCorrelation && !isFirewallBlocked && Math.random() < 0.1;

      const verdict: PacketVerdict = isCorrelation
        ? 'CORRELATION_ALERT'
        : isFirewallBlocked
        ? 'DROP'
        : isBypass
        ? 'BYPASS'
        : 'ACCEPT';

      const ruleTag = isCorrelation
        ? 'sentinel:timing_correlation_burst'
        : isFirewallBlocked
        ? (['nftables:anti_dns_leak_sinkhole', 'nftables:drop_unauthorized_egress', 'nftables:quarantine_scan'][
            Math.floor(Math.random() * 3)
          ])
        : isBypass
        ? 'policy_routing:bypass_local_lan'
        : 'wireguard:fast_path_accept';

      const correlationRisk = isCorrelation
        ? Math.floor(Math.random() * 20) + 80
        : isFirewallBlocked
        ? Math.floor(Math.random() * 30) + 30
        : Math.floor(Math.random() * 25);

      const lengthBytes = isCorrelation
        ? 1420
        : Math.floor(Math.random() * 1250) + 64;

      const newPacket: RawPacketRecord = {
        id: `pkt-${now}-${Math.floor(Math.random() * 1000)}`,
        timestamp: now,
        timeStr,
        iface: Math.random() > 0.4 ? 'wg0' : 'eth0',
        direction: Math.random() > 0.5 ? 'out' : 'in',
        protocol: (['WireGuard', 'DoH', 'DNS', 'TCP-TLS', 'QUIC'] as PacketProtocol[])[
          Math.floor(Math.random() * 5)
        ],
        source: Math.random() > 0.5 ? (currentIdentity?.ip || '10.84.0.2') : '198.51.100.42',
        destination: Math.random() > 0.5 ? '194.26.29.112' : (currentIdentity?.ip || '10.84.0.2'),
        port: [51820, 443, 853, 53, 9001][Math.floor(Math.random() * 5)],
        lengthBytes,
        entropyBits: Number((7.3 + Math.random() * 0.68).toFixed(2)),
        verdict,
        ruleTag,
        correlationRisk,
      };

      setPackets((prev) => [...prev.slice(-44), newPacket]);

      if (isCorrelation) {
        const newAlert: CorrelationAlertRecord = {
          id: `corr-${now}`,
          timestamp: timeStr,
          riskScore: correlationRisk,
          ingressBurstLength: lengthBytes,
          egressBurstLength: lengthBytes,
          timeDeltaMs: Number((Math.random() * 2.5 + 0.4).toFixed(1)),
          adversaryNode: 'Sonde Passive ASN Externe / Surveillance Tap',
          description: `Tentative de corrélation de taille (${lengthBytes} o) et cadence temporelle interceptée.`,
          status: 'active',
        };
        setCorrelationAlerts((prev) => [newAlert, ...prev.slice(0, 9)]);
        if (addLog) {
          addLog(
            `[Corrélation] Tentative de corrélation temporelle détectée (Risque: ${correlationRisk}%, Taille: ${lengthBytes}o).`,
            'warning',
            newPacket.source
          );
        }
      }
    }, sampleRateMs);

    return () => clearInterval(timer);
  }, [isPaused, sampleRateMs, currentIdentity, addLog]);

  // Filtrage des paquets
  const filteredPackets = useMemo(() => {
    return packets.filter((pkt) => {
      if (filterVerdict !== 'all' && pkt.verdict !== filterVerdict) return false;
      if (filterProtocol !== 'all' && pkt.protocol !== filterProtocol) return false;
      return true;
    });
  }, [packets, filterVerdict, filterProtocol]);

  // Simulation d'une attaque par corrélation temporelle
  const handleSimulateCorrelationAttack = useCallback(() => {
    const now = Date.now();
    const d = new Date(now);
    const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
    const burstPackets: RawPacketRecord[] = Array.from({ length: 4 }, (_, i) => ({
      id: `corr-pkt-${now}-${i}`,
      timestamp: now + i * 20,
      timeStr,
      iface: (i % 2 === 0 ? 'eth0' : 'wg0') as 'eth0' | 'wg0',
      direction: (i % 2 === 0 ? 'out' : 'in') as 'out' | 'in',
      protocol: 'WireGuard' as PacketProtocol,
      source: i % 2 === 0 ? (currentIdentity?.ip || '10.84.0.2') : '198.51.100.77',
      destination: i % 2 === 0 ? '198.51.100.77' : (currentIdentity?.ip || '10.84.0.2'),
      port: 51820,
      lengthBytes: 1420,
      entropyBits: 7.95,
      verdict: 'CORRELATION_ALERT',
      ruleTag: 'sentinel:timing_burst_synchronization',
      correlationRisk: 94,
    }));

    setPackets((prev) => [...prev.slice(-40), ...burstPackets]);
    setCorrelationAlerts((prev) => [
      {
        id: `alert-manual-${now}`,
        timestamp: timeStr,
        riskScore: 94,
        ingressBurstLength: 1420,
        egressBurstLength: 1420,
        timeDeltaMs: 0.8,
        adversaryNode: 'Sonde Passive ASN Simulée (Attaque par Corrélation)',
        description: 'Synchronisation de 4 paquets MTU 1420 Ingress/Egress en moins de 1 ms.',
        status: 'active',
      },
      ...prev.slice(0, 8),
    ]);

    if (addLog) {
      addLog(
        '[Corrélation] Simulation d’attaque par corrélation de débit exécutée (Risque 94%).',
        'warning'
      );
    }
  }, [currentIdentity, addLog]);

  // Simulation d'une fuite DNS bloquée par le pare-feu
  const handleSimulateDnsLeakBlock = useCallback(() => {
    const now = Date.now();
    const d = new Date(now);
    const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
    const dropPacket: RawPacketRecord = {
      id: `dns-leak-${now}`,
      timestamp: now,
      timeStr,
      iface: 'eth0',
      direction: 'out',
      protocol: 'DNS',
      source: currentIdentity?.ip || '10.84.0.2',
      destination: '8.8.8.8',
      port: 53,
      lengthBytes: 84,
      entropyBits: 5.8,
      verdict: 'DROP',
      ruleTag: 'nftables:anti_dns_leak_sinkhole',
      correlationRisk: 12,
    };
    setPackets((prev) => [...prev.slice(-43), dropPacket]);
    if (addLog) {
      addLog(
        '[Pare-Feu] Fuite DNS directe vers 8.8.8.8:53 bloquée et redirigée vers sinkhole0.',
        'warning',
        '8.8.8.8'
      );
    }
  }, [currentIdentity, addLog]);

  // Simulation d'une rafale de trafic chiffré normal WireGuard
  const handleSimulateWireGuardBurst = useCallback(() => {
    const now = Date.now();
    const d = new Date(now);
    const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
    const burst = Array.from({ length: 3 }, (_, i) => ({
      id: `wg-pkt-${now}-${i}`,
      timestamp: now + i * 10,
      timeStr,
      iface: 'wg0' as const,
      direction: (i % 2 === 0 ? 'out' : 'in') as 'out' | 'in',
      protocol: 'WireGuard' as PacketProtocol,
      source: currentIdentity?.ip || '10.84.0.2',
      destination: '194.26.29.112',
      port: 51820,
      lengthBytes: 1040 + i * 120,
      entropyBits: 7.91,
      verdict: 'ACCEPT' as PacketVerdict,
      ruleTag: 'wireguard:fast_path_accept',
      correlationRisk: 15,
    }));
    setPackets((prev) => [...prev.slice(-42), ...burst]);
  }, [currentIdentity]);

  // Export PCAP-JSON
  const handleExportPcapJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(packets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pcap-inspection-dump-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [packets]);

  // ============================================================================
  // GRAPHIQUE 1 : D3.JS TIMELINE EN TEMPS RÉEL (FLUX TEMPOREL & VOLUME)
  // ============================================================================
  useEffect(() => {
    if (!timelineSvgRef.current || packets.length === 0) return;

    const svg = d3.select(timelineSvgRef.current);
    svg.selectAll('*').remove();

    const width = timelineSvgRef.current.clientWidth || 700;
    const height = 180;
    const margin = { top: 15, right: 25, bottom: 25, left: 45 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(packets, (d) => d.timestamp) as [number, number];
    const xScale = d3
      .scaleTime()
      .domain([xExtent[0] || Date.now() - 30000, xExtent[1] || Date.now()])
      .range([0, innerWidth]);

    const yMax = d3.max(packets, (d) => d.lengthBytes) || 1500;
    const yScale = d3.scaleLinear().domain([0, yMax * 1.15]).range([innerHeight, 0]);

    // Lignes de grille horizontales
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.12)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      );

    // Axe X
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date))
      )
      .attr('color', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Axe Y
    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickFormat((d) => `${d} o`)
      )
      .attr('color', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Définition des dégradés et filtres de brillance
    const defs = svg.append('defs');
    const pulseFilter = defs.append('filter').attr('id', 'glow');
    pulseFilter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const feMerge = pulseFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Barres temporelles / Tranches de paquets
    g.selectAll('.packet-bar')
      .data(packets)
      .enter()
      .append('rect')
      .attr('class', 'packet-bar')
      .attr('x', (d) => xScale(d.timestamp) - 3)
      .attr('y', (d) => yScale(d.lengthBytes))
      .attr('width', 6)
      .attr('height', (d) => Math.max(3, innerHeight - yScale(d.lengthBytes)))
      .attr('rx', 2)
      .attr('fill', (d) => {
        if (d.verdict === 'CORRELATION_ALERT') return '#f43f5e'; // Rose écarlate (Alerte Corrélation)
        if (d.verdict === 'DROP' || d.verdict === 'REJECT') return '#f59e0b'; // Ambre (Bloqué Pare-feu)
        if (d.verdict === 'BYPASS') return '#38bdf8'; // Cyan clair (Bypass)
        return '#10b981'; // Émeraude (Accepté)
      })
      .attr('opacity', (d) => (d.verdict === 'CORRELATION_ALERT' ? 1 : 0.8))
      .attr('filter', (d) => (d.verdict === 'CORRELATION_ALERT' ? 'url(#glow)' : null))
      .attr('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHoveredPacket(d))
      .on('mouseleave', () => setHoveredPacket(null))
      .on('click', (_, d) => {
        setSelectedPacket(d);
      });

    // Ligne courbe reliant les sommets de paquets
    const lineGenerator = d3
      .line<RawPacketRecord>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d.lengthBytes))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(packets)
      .attr('fill', 'none')
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .attr('d', lineGenerator);
  }, [packets, windowWidth]);

  // ============================================================================
  // GRAPHIQUE 2 : D3.JS SCATTER PLOT MATRICE DE CORRÉLATION (INGRESS VS EGRESS)
  // ============================================================================
  useEffect(() => {
    if (!correlationSvgRef.current || packets.length === 0) return;

    const svg = d3.select(correlationSvgRef.current);
    svg.selectAll('*').remove();

    const width = correlationSvgRef.current.clientWidth || 340;
    const height = 180;
    const margin = { top: 15, right: 20, bottom: 25, left: 40 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, 1500]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    // Grille
    g.append('g')
      .attr('opacity', 0.1)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(3)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      );

    // Axe X (Taille paquet)
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(4).tickFormat((d) => `${d}o`))
      .attr('color', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    // Axe Y (Indice de corrélation %)
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat((d) => `${d}%`))
      .attr('color', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    // Zone rouge de danger (Corrélation > 70%)
    g.append('rect')
      .attr('x', 0)
      .attr('y', yScale(100))
      .attr('width', innerWidth)
      .attr('height', yScale(70) - yScale(100))
      .attr('fill', '#f43f5e')
      .attr('fill-opacity', 0.08);

    // Ligne seuil d'alerte à 70%
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(70))
      .attr('y2', yScale(70))
      .attr('stroke', '#f43f5e')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1);

    // Points de dispersion (Scatter Points)
    g.selectAll('.correlation-dot')
      .data(packets)
      .enter()
      .append('circle')
      .attr('class', 'correlation-dot')
      .attr('cx', (d) => xScale(d.lengthBytes))
      .attr('cy', (d) => yScale(d.correlationRisk))
      .attr('r', (d) => (d.correlationRisk > 70 ? 5 : 3.5))
      .attr('fill', (d) => {
        if (d.correlationRisk > 70) return '#f43f5e';
        if (d.verdict === 'DROP') return '#f59e0b';
        return '#06b6d4';
      })
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1)
      .attr('opacity', 0.85)
      .attr('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHoveredPacket(d))
      .on('mouseleave', () => setHoveredPacket(null))
      .on('click', (_, d) => setSelectedPacket(d));
  }, [packets, windowWidth]);

  // ============================================================================
  // GRAPHIQUE 3 : D3.JS DONUT CHART RÉPARTITION DES VERDICTS NETFILTER
  // ============================================================================
  useEffect(() => {
    if (!donutSvgRef.current || packets.length === 0) return;

    const svg = d3.select(donutSvgRef.current);
    svg.selectAll('*').remove();

    const width = donutSvgRef.current.clientWidth || 180;
    const height = 180;
    const radius = Math.min(width, height) / 2 - 10;

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const counts = d3.rollup(
      packets,
      (v) => v.length,
      (d) => d.verdict
    );

    const data = Array.from(counts, ([key, value]) => ({ verdict: key, count: value }));

    const pie = d3
      .pie<{ verdict: string; count: number }>()
      .value((d) => d.count)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<{ verdict: string; count: number }>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius);

    const colorMap: Record<string, string> = {
      ACCEPT: '#10b981',
      DROP: '#f59e0b',
      REJECT: '#ef4444',
      BYPASS: '#38bdf8',
      CORRELATION_ALERT: '#f43f5e',
    };

    g.selectAll('.donut-slice')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('class', 'donut-slice')
      .attr('d', arc)
      .attr('fill', (d) => colorMap[d.data.verdict] || '#64748b')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2);

    // Texte central au cœur du donut
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.1em')
      .attr('fill', '#ffffff')
      .attr('font-size', '15px')
      .attr('font-weight', 'bold')
      .text(packets.length);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text('TRAMES');
  }, [packets, windowWidth]);

  // Action d'injection de trafic chaff / padding pour casser la corrélation
  const handleMitigateCorrelation = useCallback(() => {
    if (patchSettings) {
      patchSettings(
        {
          trafficPaddingJitterMs: 40,
          tlsClientHelloFragmentation: true,
        },
        'Activation du brouillage temporel anti-corrélation (Traffic Padding 40ms + Fragmentation TLS)'
      );
    }
    setCorrelationAlerts((prev) =>
      prev.map((a) => ({ ...a, status: 'mitigated' }))
    );
    if (addLog) {
      addLog(
        `[Contre-Mesure] Brouillage temporel eBPF déployé : Traffic Padding 40ms + gigue artificielle pour casser la corrélation.`,
        'success'
      );
    }
  }, [patchSettings, addLog]);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs relative overflow-hidden ${className}`}
    >
      {/* Background glow décoratif */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* En-tête PacketInspector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Inspecteur de Trames Réseau &amp; Détection de Corrélation
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300">
                Tap eBPF / D3.js Live
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  isPaused
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {isPaused ? 'Flux en Pause' : 'Écoute Temps Réel'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Visualisation vectorielle D3.js du flux réseau brut transitant par{' '}
              <code className="text-slate-700 dark:text-slate-300 font-mono">wg0</code> et{' '}
              <code className="text-slate-700 dark:text-slate-300 font-mono">eth0</code>. Mise en évidence des paquets
              bloqués par le pare-feu et des attaques passives par corrélation de trafic Ingress/Egress.
            </p>
          </div>
        </div>

        {/* Contrôles d'écoute, simulations et export */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Actions de simulation en direct */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              onClick={handleSimulateCorrelationAttack}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Injecter une salve de paquets synchronisés Ingress/Egress simulant une sonde passive de corrélation"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simuler</span> Corrélation
            </button>

            <button
              type="button"
              onClick={handleSimulateDnsLeakBlock}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Simuler une requête DNS directe vers 8.8.8.8 bloquée par la règle nftables anti-fuite"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simuler</span> Fuite DNS
            </button>

            <button
              type="button"
              onClick={handleSimulateWireGuardBurst}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Injecter une rafale de trafic chiffré WireGuard standard (Fast Path)"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Rafale WG</span>
            </button>
          </div>

          {/* Export PCAP-JSON */}
          <button
            type="button"
            onClick={handleExportPcapJson}
            disabled={packets.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Exporter la capture de trames au format PCAP-JSON pour analyse Wireshark / Zeek"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export</span> PCAP
          </button>

          {/* Figer / Reprendre */}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Reprendre</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Figer</span>
              </>
            )}
          </button>

          {/* Vider */}
          <button
            type="button"
            onClick={() => {
              setPackets([]);
              setSelectedPacket(null);
              setHoveredPacket(null);
            }}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:text-red-500 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Effacer le tampon de capture"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider</span>
          </button>
        </div>
      </div>

      {/* Bannière Alerte Corrélation de Trafic si détectée */}
      {correlationAlerts.some((a) => a.status === 'active') && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Tentative d’Analyse &amp; Corrélation de Trafic Détectée !</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-400 font-bold">
                  Indice de Corrélation : 88%
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Une sonde passive tente de corréler la taille et les intervalles d’arrivée des paquets Ingress (FAI) avec
                ceux du tunnel WireGuard. Risque de désanonymisation par analyse statistique des rafales de données.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMitigateCorrelation}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shrink-0 shadow-md shadow-rose-600/25 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Activer Brouillage &amp; Traffic Padding (40ms)</span>
          </button>
        </div>
      )}

      {/* Barre de navigation d'onglets de visualisation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'timeline', label: 'Flux Temporel D3.js (Volume & Verdicts)', icon: Activity },
            { id: 'correlation', label: 'Matrice de Corrélation Ingress/Egress', icon: Radio },
            { id: 'breakdown', label: 'Répartition Protocoles & Pare-Feu', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Légende rapide des couleurs D3 */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span>Accepté (Tunnel)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span>Bloqué Pare-feu</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span>Alerte Corrélation</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
            <span>Bypass LAN</span>
          </span>
        </div>
      </div>

      {/* HUD interactif d'inspection au survol D3 */}
      {hoveredPacket && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-100 border border-cyan-500/40 text-xs font-mono shadow-md animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full animate-ping bg-cyan-400" />
            <span className="font-bold text-cyan-300">{hoveredPacket.protocol}</span>
            <span className="text-slate-300">{hoveredPacket.lengthBytes} octets</span>
            <span className="text-slate-400 hidden sm:inline">
              {hoveredPacket.source} → {hoveredPacket.destination}:{hoveredPacket.port}
            </span>
            <span className="text-slate-400 text-[10px]">({hoveredPacket.iface})</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                hoveredPacket.verdict === 'CORRELATION_ALERT'
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                  : hoveredPacket.verdict === 'DROP' || hoveredPacket.verdict === 'REJECT'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                  : hoveredPacket.verdict === 'BYPASS'
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                  : 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {hoveredPacket.verdict}
            </span>
            <span className="text-slate-300 text-[11px]">
              Risque Corrélation:{' '}
              <b className={hoveredPacket.correlationRisk > 70 ? 'text-rose-400' : 'text-slate-200'}>
                {hoveredPacket.correlationRisk}%
              </b>
            </span>
            <span className="text-slate-400 text-[10px] hidden md:inline truncate max-w-[220px]">
              {hoveredPacket.ruleTag}
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          VUE 1 : GRAPHIQUE TEMPOREL D3.JS
      ====================================================================== */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-500" />
              Historique des Trames Réseau Capturées (Taille des Paquets en octets)
            </span>
            <span className="font-mono text-[11px]">
              {packets.length} trames en mémoire · Cliquez sur une barre pour inspecter
            </span>
          </div>

          <div className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 overflow-hidden shadow-inner">
            <svg ref={timelineSvgRef} className="w-full h-44" />
          </div>
        </div>
      )}

      {/* =====================================================================
          VUE 2 : MATRICE DE CORRÉLATION INGRESS / EGRESS
      ====================================================================== */}
      {activeTab === 'correlation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-500" />
                Matrice de Dispersion D3 : Taille de Trame vs Risque de Corrélation
              </span>
              <span className="font-mono text-rose-500 font-bold text-[10px]">Zone Rouge = Risque &gt; 70%</span>
            </div>

            <div className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 overflow-hidden shadow-inner">
              <svg ref={correlationSvgRef} className="w-full h-44" />
            </div>
          </div>

          {/* Panneau d'explication pédagogique sur les attaques par corrélation */}
          <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3 text-xs">
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-500" />
                <span>Comment fonctionne la Corrélation de Trafic ?</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                Même si un tunnel VPN est chiffré mathématiquement (WireGuard ChaCha20), un adversaire passif observant
                votre ligne FAI et simultanément la sortie du serveur VPN peut comparer la taille des paquets et les
                intervalles d&apos;émission.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
              <div>Traffic Padding actif : {settings.trafficPaddingJitterMs} ms</div>
              <div>Fragmentation TLS : {settings.tlsClientHelloFragmentation ? 'Active' : 'Désactivée'}</div>
              <div>Protection Anti-DPI : {settings.blockCaptivePortalProbes ? 'Renforcée' : 'Standard'}</div>
            </div>

            <button
              type="button"
              onClick={handleMitigateCorrelation}
              className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Forcer Padding Constant-Time</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          VUE 3 : RÉPARTITION PROTOCOLAIRE ET VERDICTS
      ====================================================================== */}
      {activeTab === 'breakdown' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-4 flex flex-col items-center justify-center p-3">
            <svg ref={donutSvgRef} className="w-44 h-44" />
          </div>

          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">ACCEPTÉ (TUNNEL)</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {packets.filter((p) => p.verdict === 'ACCEPT').length}
              </div>
              <div className="text-[10px] text-slate-500">Trames chiffrées WireGuard</div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">BLOQUÉ PARE-FEU</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {packets.filter((p) => p.verdict === 'DROP' || p.verdict === 'REJECT').length}
              </div>
              <div className="text-[10px] text-slate-500">Filtrage nftables / Netfilter</div>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1">
              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">CORRÉLATION SUSPECTE</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {packets.filter((p) => p.verdict === 'CORRELATION_ALERT').length}
              </div>
              <div className="text-[10px] text-slate-500">Timing bursts anormaux</div>
            </div>

            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 space-y-1">
              <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">SPLIT-TUNNEL (BYPASS)</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {packets.filter((p) => p.verdict === 'BYPASS').length}
              </div>
              <div className="text-[10px] text-slate-500">Routage local autorisé</div>
            </div>
          </div>
        </div>
      )}

      {/* Barre de filtres pour la table des paquets */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtrer par verdict :</span>
          {['all', 'ACCEPT', 'DROP', 'CORRELATION_ALERT', 'BYPASS'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterVerdict(v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterVerdict === v
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {v === 'all'
                ? 'Tous'
                : v === 'ACCEPT'
                ? 'Acceptés'
                : v === 'DROP'
                ? 'Bloqués Pare-Feu'
                : v === 'CORRELATION_ALERT'
                ? 'Alertes Corrélation'
                : 'Bypass'}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Affichage de {filteredPackets.length} trames
        </div>
      </div>

      {/* Tableau des Trames Réseau Détaillées */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 backdrop-blur-xs text-slate-500">
              <tr>
                <th className="py-2 px-3 font-semibold">Horodatage</th>
                <th className="py-2 px-2 font-semibold">Interface</th>
                <th className="py-2 px-2 font-semibold">Dir</th>
                <th className="py-2 px-3 font-semibold">Protocole</th>
                <th className="py-2 px-3 font-semibold">Source → Cible</th>
                <th className="py-2 px-2 font-semibold text-right">Taille</th>
                <th className="py-2 px-2 font-semibold text-center">Verdict</th>
                <th className="py-2 px-3 font-semibold">Règle Appliquée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 tabular-nums text-[11px]">
              {filteredPackets.slice(-15).reverse().map((pkt) => {
                const isSelected = selectedPacket?.id === pkt.id;
                const isAlert = pkt.verdict === 'CORRELATION_ALERT';
                const isDrop = pkt.verdict === 'DROP' || pkt.verdict === 'REJECT';

                return (
                  <tr
                    key={pkt.id}
                    onClick={() => setSelectedPacket(pkt)}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/10'
                        : isAlert
                        ? 'bg-rose-500/5'
                        : isDrop
                        ? 'bg-amber-500/5'
                        : ''
                    }`}
                  >
                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{pkt.timeStr}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-800 dark:text-slate-200">{pkt.iface}</td>
                    <td className="py-1.5 px-2 font-bold text-center">
                      {pkt.direction === 'out' ? (
                        <span className="text-cyan-500">↑</span>
                      ) : (
                        <span className="text-purple-500">↓</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900 dark:text-white">{pkt.protocol}</td>
                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                      <span>{pkt.source}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {pkt.destination}:{pkt.port}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right">{pkt.lengthBytes} o</td>
                    <td className="py-1.5 px-2 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          isAlert
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                            : isDrop
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                            : pkt.verdict === 'BYPASS'
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {pkt.verdict}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-slate-500 truncate max-w-[180px]">{pkt.ruleTag}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspecteur Détaillé de Trame sélectionnée */}
      {selectedPacket && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-500" />
              <span className="font-bold text-slate-900 dark:text-white">
                Inspection de Trame eBPF : {selectedPacket.id}
              </span>
              <span className="font-mono text-slate-400 text-[11px]">({selectedPacket.timeStr})</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPacket(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Interface &amp; Direction :</div>
              <div className="font-bold text-slate-900 dark:text-white">
                {selectedPacket.iface} · {selectedPacket.direction === 'out' ? 'Sortant (Egress)' : 'Entrant (Ingress)'}
              </div>
              <div className="text-slate-500 text-[10px]">Protocole: {selectedPacket.protocol} (Port {selectedPacket.port})</div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Indice de Corrélation &amp; Entropie :</div>
              <div
                className={`font-bold ${
                  selectedPacket.correlationRisk > 70
                    ? 'text-rose-500'
                    : selectedPacket.correlationRisk > 40
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}
              >
                Risque : {selectedPacket.correlationRisk}% (Shannon: {selectedPacket.entropyBits} b/o)
              </div>
              <div className="text-slate-500 text-[10px]">
                {selectedPacket.correlationRisk > 70
                  ? 'Vulnérable à la désanonymisation passive'
                  : 'Furtivité statistique conforme'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Règle Pare-feu / Netfilter :</div>
              <div className="font-bold text-cyan-600 dark:text-cyan-400 truncate">{selectedPacket.ruleTag}</div>
              <div className="text-slate-500 text-[10px]">Verdict : {selectedPacket.verdict}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
