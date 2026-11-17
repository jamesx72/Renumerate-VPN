import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import {
  AlertOctagon,
  ArrowUpRight,
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
  VirtualIdentity,
} from '../types';

export interface DataExfiltrationRadarProps {
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

type ExfilSensitivity = 'strict' | 'balanced' | 'paranoid';
type ExfilStatus = 'nominal' | 'elevated' | 'exfiltration';

interface ExfilSample {
  seq: number;
  timestamp: number;
  timeLabel: string;
  outboundKbps: number;
  inboundKbps: number;
  baselineKbps: number;
  thresholdKbps: number;
  excessKbps: number;
  httpsKbps: number;
  dnsTunnelKbps: number;
  rawSocketKbps: number;
  zScore: number;
  upDownRatio: number;
  entropyBits: number;
  isAnomaly: boolean;
  suspectedDestination: string;
  suspectedPort: number;
}

interface ExfilAlertRecord {
  id: string;
  timeLabel: string;
  peakKbps: number;
  zScore: number;
  upDownRatio: number;
  vectorLabel: string;
  destination: string;
  port: number;
  status: 'active' | 'mitigated';
}

const MAX_SAMPLES = 48;

const SUSPECT_ENDPOINTS = [
  { host: '185.220.101.42', asn: 'AS205100', port: 443, vector: 'Exfiltration TLS chiffrée (HTTPS)' },
  { host: '91.132.147.88', asn: 'AS49877', port: 53, vector: 'Tunneling DNS TXT haute cadence' },
  { host: '45.141.215.119', asn: 'AS209854', port: 8443, vector: 'Flux sortant brut asymétrique (C2)' },
  { host: '193.142.146.37', asn: 'AS49505', port: 22, vector: 'Transfert SFTP massif non sollicité' },
] as const;

function secureUnitRandom(): number {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] / 0xffffffff;
  }
  return Math.random();
}

export const DataExfiltrationRadar: React.FC<DataExfiltrationRadarProps> = ({
  isConnected,
  mode,
  currentIdentity,
  throughput,
  settings,
  onApplyPatch,
  addLog,
}) => {
  const [sensitivity, setSensitivity] = useState<ExfilSensitivity>('balanced');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [hoveredSeq, setHoveredSeq] = useState<number | null>(null);
  const [activeBurstRemaining, setActiveBurstRemaining] = useState<number>(0);
  const [burstProfileIdx, setBurstProfileIdx] = useState<number>(0);
  const [alerts, setAlerts] = useState<ExfilAlertRecord[]>([]);

  const seqRef = useRef<number>(48);
  const lastLoggedAlertAtRef = useRef<number>(0);

  const zThreshold = useMemo(() => {
    if (sensitivity === 'paranoid') return 1.8;
    if (sensitivity === 'strict') return 3.1;
    return 2.4;
  }, [sensitivity]);

  // Seed initial rolling outbound telemetry window
  const [samples, setSamples] = useState<ExfilSample[]>(() => {
    const now = Date.now();
    const initial: ExfilSample[] = [];
    for (let i = 0; i < MAX_SAMPLES; i++) {
      const ts = now - (MAX_SAMPLES - i) * 1000;
      const u1 = secureUnitRandom();
      const u2 = secureUnitRandom();
      const base = isConnected ? 185 + Math.sin(i * 0.28) * 32 : 75;
      const up = Math.max(24, Math.round(base + (u1 - 0.5) * 62));
      const down = Math.max(120, Math.round(780 + u2 * 440));
      const thresh = Math.round(base * 1.95 + 140);
      const https = Math.round(up * 0.74);
      const dnsT = Math.round(up * 0.1);
      const rawS = Math.max(0, up - https - dnsT);
      initial.push({
        seq: i + 1,
        timestamp: ts,
        timeLabel: new Date(ts).toLocaleTimeString('fr-FR', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
        outboundKbps: up,
        inboundKbps: down,
        baselineKbps: Math.round(base),
        thresholdKbps: thresh,
        excessKbps: 0,
        httpsKbps: https,
        dnsTunnelKbps: dnsT,
        rawSocketKbps: rawS,
        zScore: Number(((u1 - 0.5) * 1.1).toFixed(2)),
        upDownRatio: Number((up / Math.max(1, down)).toFixed(2)),
        entropyBits: Number((6.7 + u2 * 0.7).toFixed(2)),
        isAnomaly: false,
        suspectedDestination: currentIdentity.ip,
        suspectedPort: settings.tunnelPort,
      });
    }
    return initial;
  });

  // Correlate IDS intrusion broadcasts (C2 / DNS hijack) directly onto the Exfiltration Radar
  useEffect(() => {
    const onIdsBlocked = (ev: Event) => {
      const customEv = ev as CustomEvent<IntrusionAttempt>;
      if (!customEv.detail) return;
      if (
        customEv.detail.vector === 'c2_beacon' ||
        customEv.detail.vector === 'dns_hijack' ||
        customEv.detail.vector === 'webrtc_leak'
      ) {
        setBurstProfileIdx(
          customEv.detail.vector === 'dns_hijack'
            ? 1
            : customEv.detail.vector === 'c2_beacon'
              ? 2
              : 0
        );
        setActiveBurstRemaining((prev) => Math.max(prev, 4));
      }
    };
    window.addEventListener('renumerate_intrusion_blocked', onIdsBlocked);
    return () =>
      window.removeEventListener('renumerate_intrusion_blocked', onIdsBlocked);
  }, []);

  // Real-time outbound sampling loop coupled to live throughput & active exfiltration bursts
  const samplesRef = useRef<ExfilSample[]>(samples);
  samplesRef.current = samples;

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

      const u0 = secureUnitRandom();
      const u1 = secureUnitRandom();
      const u2 = secureUnitRandom();

      const liveUpKbps = Math.max(32, Math.round(throughput.up * 128));
      const liveDownKbps = Math.max(140, Math.round(throughput.down * 128));

      const prev = samplesRef.current;
      const nominalHistory = prev.filter((p) => !p.isAnomaly).slice(-24);
      const meanBase =
        nominalHistory.length > 0
          ? nominalHistory.reduce((acc, s) => acc + s.outboundKbps, 0) /
            nominalHistory.length
          : 190;
      const variance =
        nominalHistory.length > 2
          ? nominalHistory.reduce(
              (acc, s) => acc + Math.pow(s.outboundKbps - meanBase, 2),
              0
            ) / nominalHistory.length
          : 900;
      const stdDev = Math.max(26, Math.sqrt(variance));

      const baselineKbps = Math.round(
        meanBase * 0.72 + (isConnected ? liveUpKbps : 85) * 0.28
      );
      const thresholdKbps = Math.round(baselineKbps + zThreshold * stdDev + 75);

      let outboundKbps = Math.round(
        baselineKbps + (u0 - 0.48) * stdDev * 1.4
      );
      let inboundKbps = Math.round(liveDownKbps * (0.88 + u1 * 0.24));
      let httpsShare = 0.72;
      let dnsShare = 0.1;
      let entropyBits = Number((6.8 + u2 * 0.65).toFixed(2));
      let destHost = currentIdentity.ip;
      let destPort: number = settings.tunnelPort;
      let vectorLabel = 'Trafic nominal chiffré';

      const isManualOrTriggeredBurst = activeBurstRemaining > 0;
      const spontaneousRareSpike = !isManualOrTriggeredBurst && u0 > 0.968;

      if (isManualOrTriggeredBurst || spontaneousRareSpike) {
        const endpoint =
          SUSPECT_ENDPOINTS[
            (isManualOrTriggeredBurst
              ? burstProfileIdx
              : Math.floor(u1 * SUSPECT_ENDPOINTS.length)) %
              SUSPECT_ENDPOINTS.length
          ];
        const spikeMultiplier = isManualOrTriggeredBurst
          ? 3.1 + u1 * 1.4
          : 2.3 + u1 * 0.9;
        outboundKbps = Math.round(thresholdKbps + stdDev * spikeMultiplier + 180);
        inboundKbps = Math.max(45, Math.round(inboundKbps * 0.35));
        entropyBits = Number((7.78 + u2 * 0.2).toFixed(2));
        destHost = `${endpoint.host} (${endpoint.asn})`;
        destPort = endpoint.port;
        vectorLabel = endpoint.vector;

        if (endpoint.port === 53) {
          httpsShare = 0.22;
          dnsShare = 0.66;
        } else if (endpoint.port === 8443 || endpoint.port === 22) {
          httpsShare = 0.24;
          dnsShare = 0.08;
        } else {
          httpsShare = 0.84;
          dnsShare = 0.06;
        }
      }

      const zScore = Number(
        ((outboundKbps - baselineKbps) / Math.max(20, stdDev)).toFixed(2)
      );
      const upDownRatio = Number(
        (outboundKbps / Math.max(40, inboundKbps)).toFixed(2)
      );
      const excessKbps = Math.max(0, outboundKbps - thresholdKbps);
      const isAnomaly =
        excessKbps > 0 || (zScore >= zThreshold && upDownRatio >= 1.15);

      const httpsKbps = Math.round(outboundKbps * httpsShare);
      const dnsTunnelKbps = Math.round(outboundKbps * dnsShare);
      const rawSocketKbps = Math.max(0, outboundKbps - httpsKbps - dnsTunnelKbps);

      const nextSample: ExfilSample = {
        seq,
        timestamp: now,
        timeLabel,
        outboundKbps,
        inboundKbps,
        baselineKbps,
        thresholdKbps,
        excessKbps,
        httpsKbps,
        dnsTunnelKbps,
        rawSocketKbps,
        zScore,
        upDownRatio,
        entropyBits,
        isAnomaly,
        suspectedDestination: destHost,
        suspectedPort: destPort,
      };

      const updated = [...prev.slice(-(MAX_SAMPLES - 1)), nextSample];
      samplesRef.current = updated;
      setSamples(updated);

      if (isAnomaly) {
        setAlerts((prevAlerts) => {
          const top = prevAlerts[0];
          if (
            top &&
            top.status === 'active' &&
            top.destination === destHost &&
            prevAlerts.length > 0
          ) {
            return [
              {
                ...top,
                timeLabel,
                peakKbps: Math.max(top.peakKbps, outboundKbps),
                zScore: Math.max(top.zScore, zScore),
                upDownRatio: Math.max(top.upDownRatio, upDownRatio),
              },
              ...prevAlerts.slice(1),
            ];
          }
          return [
            {
              id: `exfil-${seq}-${now}`,
              timeLabel,
              peakKbps: outboundKbps,
              zScore,
              upDownRatio,
              vectorLabel,
              destination: destHost,
              port: destPort,
              status: 'active' as const,
            },
            ...prevAlerts,
          ].slice(0, 6);
        });

        if (now - lastLoggedAlertAtRef.current > 4500) {
          lastLoggedAlertAtRef.current = now;
          addLog?.(
            `[Sentinel-IA · Exfiltration Radar] Pic sortant anormal (${outboundKbps} Ko/s · Z=${zScore}σ · ${vectorLabel}) vers ${destHost}:${destPort}`,
            'error',
            currentIdentity.ip
          );
        }
      }

      if (activeBurstRemaining > 0) {
        setActiveBurstRemaining((n) => Math.max(0, n - 1));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    isPaused,
    isConnected,
    throughput.up,
    throughput.down,
    zThreshold,
    activeBurstRemaining,
    burstProfileIdx,
    currentIdentity.ip,
    settings.tunnelPort,
    addLog,
  ]);

  const handleSimulateExfiltration = useCallback(() => {
    setBurstProfileIdx((idx) => (idx + 1) % SUSPECT_ENDPOINTS.length);
    setActiveBurstRemaining(5);
    addLog?.(
      '[Sentinel-IA · Exfiltration Radar] Test de rafale sortante massive déclenché pour validation des seuils',
      'warning',
      currentIdentity.ip
    );
  }, [addLog, currentIdentity.ip]);

  const handleMitigateActiveExfil = useCallback(() => {
    setActiveBurstRemaining(0);
    setAlerts((prev) =>
      prev.map((a) =>
        a.status === 'active' ? { ...a, status: 'mitigated' } : a
      )
    );
    onApplyPatch?.(
      {
        killSwitch: true,
        idsEnabled: true,
        idsAutoQuarantine: true,
        idsSensitivity: 'paranoid',
      },
      'Isolation immédiate Data Exfiltration (Kill Switch + IDS Paranoïaque)'
    );
    addLog?.(
      '[Sentinel-IA · Exfiltration Radar] Flux sortant suspect coupé (Quarantaine nftables & Kill Switch activés)',
      'success',
      currentIdentity.ip
    );
  }, [onApplyPatch, addLog, currentIdentity.ip]);

  const metrics = useMemo(() => {
    const latest = samples[samples.length - 1];
    const recentAnomalies = samples.filter((s) => s.isAnomaly);
    const activeAlerts = alerts.filter((a) => a.status === 'active');
    const peakKbps = Math.max(...samples.map((s) => s.outboundKbps), 0);
    const maxZ = Math.max(...samples.map((s) => s.zScore), 0);

    let status: ExfilStatus = 'nominal';
    if (latest?.isAnomaly || activeAlerts.length > 0) {
      status = 'exfiltration';
    } else if ((latest?.zScore ?? 0) >= zThreshold * 0.72) {
      status = 'elevated';
    }

    return {
      latest,
      recentAnomalyCount: recentAnomalies.length,
      activeAlertCount: activeAlerts.length,
      peakKbps,
      maxZ: Number(maxZ.toFixed(2)),
      status,
    };
  }, [samples, alerts, zThreshold]);

  // Responsive SVG measurement
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const mainAreaSvgRef = useRef<SVGSVGElement | null>(null);
  const stackAreaSvgRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState<number>(680);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 180) setSvgWidth(el.clientWidth);
    };
    measure();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // =========================================================================
  // D3 CHART A: Outbound Volume Area vs Dynamic Threshold & Exfiltration Excess Area
  // =========================================================================
  useEffect(() => {
    if (!mainAreaSvgRef.current || samples.length < 2) return;

    const svg = d3.select(mainAreaSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 228;
    const margin = { top: 18, right: 16, bottom: 26, left: 48 };
    const innerW = Math.max(140, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');

    const outboundGrad = defs
      .append('linearGradient')
      .attr('id', 'exfil-outbound-area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    outboundGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', 0.36);
    outboundGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', 0.03);

    const excessGrad = defs
      .append('linearGradient')
      .attr('id', 'exfil-excess-area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    excessGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f43f5e')
      .attr('stop-opacity', 0.62);
    excessGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f43f5e')
      .attr('stop-opacity', 0.14);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, samples.length - 1])
      .range([0, innerW]);

    const maxY = Math.max(
      600,
      (d3.max(samples, (d) => Math.max(d.outboundKbps, d.thresholdKbps)) || 600) *
        1.14
    );
    const y = d3.scaleLinear().domain([0, maxY]).range([innerH, 0]);

    // Horizontal grid
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((grid) => grid.select('.domain').remove())
      .call((grid) =>
        grid
          .selectAll('line')
          .attr('stroke', '#334155')
          .attr('stroke-opacity', 0.32)
          .attr('stroke-dasharray', '2,3')
      );

    // Baseline nominal envelope area (0 -> baselineKbps)
    const baselineArea = d3
      .area<ExfilSample>()
      .x((_, i) => x(i))
      .y0(innerH)
      .y1((d) => y(d.baselineKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', '#64748b')
      .attr('fill-opacity', 0.1)
      .attr('d', baselineArea);

    // Outbound volume area (0 -> outboundKbps)
    const outboundArea = d3
      .area<ExfilSample>()
      .x((_, i) => x(i))
      .y0(innerH)
      .y1((d) => y(d.outboundKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'url(#exfil-outbound-area-grad)')
      .attr('d', outboundArea);

    // Anomaly excess area above dynamic threshold (thresholdKbps -> max(outboundKbps, thresholdKbps))
    const excessArea = d3
      .area<ExfilSample>()
      .x((_, i) => x(i))
      .y0((d) => y(d.thresholdKbps))
      .y1((d) => y(Math.max(d.outboundKbps, d.thresholdKbps)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'url(#exfil-excess-area-grad)')
      .attr('d', excessArea);

    // Dynamic exfiltration threshold dashed line
    const thresholdLine = d3
      .line<ExfilSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.thresholdKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.35)
      .attr('stroke-dasharray', '4,4')
      .attr('d', thresholdLine);

    // Outbound main contour line
    const outboundLine = d3
      .line<ExfilSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.outboundKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2)
      .attr('d', outboundLine);

    // Anomaly spike nodes
    samples.forEach((s, idx) => {
      if (!s.isAnomaly) return;
      g.append('circle')
        .attr('cx', x(idx))
        .attr('cy', y(s.outboundKbps))
        .attr('r', hoveredSeq === s.seq ? 5.5 : 3.8)
        .attr('fill', '#f43f5e')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.2);
    });

    // Hover crosshair indicator
    if (hoveredSeq !== null) {
      const hIdx = samples.findIndex((s) => s.seq === hoveredSeq);
      if (hIdx >= 0) {
        const s = samples[hIdx];
        g.append('line')
          .attr('x1', x(hIdx))
          .attr('x2', x(hIdx))
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');
        g.append('circle')
          .attr('cx', x(hIdx))
          .attr('cy', y(s.outboundKbps))
          .attr('r', 4.5)
          .attr('fill', s.isAnomaly ? '#f43f5e' : '#06b6d4')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5);
      }
    }

    // Y Axis
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((d) => `${Math.round(Number(d))}`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .style('font-size', '10px')
          .style('font-family', 'monospace')
      );

    // Y Axis Unit Label
    g.append('text')
      .attr('x', -margin.left + 4)
      .attr('y', -6)
      .attr('fill', '#64748b')
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .text('Ko/s');

    // X Axis sparse labels
    const tickIndices = [
      0,
      Math.floor(samples.length * 0.33),
      Math.floor(samples.length * 0.66),
      samples.length - 1,
    ];
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickIndices)
          .tickFormat((val) => samples[Math.round(Number(val))]?.timeLabel || '')
      )
      .call((ax) => ax.select('.domain').attr('stroke', '#334155'))
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .style('font-size', '10px')
          .style('font-family', 'monospace')
      );

    // Interactive invisible overlay for hover inspection
    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const idx = Math.max(
          0,
          Math.min(samples.length - 1, Math.round(x.invert(mx)))
        );
        setHoveredSeq(samples[idx]?.seq ?? null);
      })
      .on('mouseleave', () => setHoveredSeq(null));
  }, [samples, svgWidth, hoveredSeq]);

  // =========================================================================
  // D3 CHART B: Stacked Vector Area Breakdown (HTTPS vs DNS Tunnel vs Raw C2)
  // =========================================================================
  useEffect(() => {
    if (!stackAreaSvgRef.current || samples.length < 2) return;

    const svg = d3.select(stackAreaSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 148;
    const margin = { top: 14, right: 16, bottom: 22, left: 48 };
    const innerW = Math.max(140, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const stackGen = d3
      .stack<ExfilSample>()
      .keys(['httpsKbps', 'dnsTunnelKbps', 'rawSocketKbps']);

    const layers = stackGen(samples);

    const x = d3
      .scaleLinear()
      .domain([0, samples.length - 1])
      .range([0, innerW]);

    const maxStackY = Math.max(
      400,
      d3.max(layers[layers.length - 1] || [], (d) => d[1]) || 400
    );
    const y = d3.scaleLinear().domain([0, maxStackY * 1.08]).range([innerH, 0]);

    const layerStyles: Record<string, { fill: string; stroke: string }> = {
      httpsKbps: { fill: 'rgba(14, 165, 233, 0.25)', stroke: '#0ea5e9' },
      dnsTunnelKbps: { fill: 'rgba(245, 158, 11, 0.42)', stroke: '#f59e0b' },
      rawSocketKbps: { fill: 'rgba(244, 63, 94, 0.45)', stroke: '#f43f5e' },
    };

    const areaGen = d3
      .area<d3.SeriesPoint<ExfilSample>>()
      .x((_, i) => x(i))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX);

    const lineGen = d3
      .line<d3.SeriesPoint<ExfilSample>>()
      .x((_, i) => x(i))
      .y((d) => y(d[1]))
      .curve(d3.curveMonotoneX);

    layers.forEach((layer) => {
      const style = layerStyles[layer.key] || layerStyles.httpsKbps;
      g.append('path')
        .datum(layer)
        .attr('fill', style.fill)
        .attr('d', areaGen);

      g.append('path')
        .datum(layer)
        .attr('fill', 'none')
        .attr('stroke', style.stroke)
        .attr('stroke-width', 1.2)
        .attr('d', lineGen);
    });

    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(3)
          .tickFormat((d) => `${Math.round(Number(d))}`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .style('font-size', '10px')
          .style('font-family', 'monospace')
      );

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(0).tickSize(0))
      .call((ax) => ax.select('.domain').attr('stroke', '#334155'));
  }, [samples, svgWidth]);

  const inspectedSample = useMemo(() => {
    if (hoveredSeq !== null) {
      return samples.find((s) => s.seq === hoveredSeq) ?? samples[samples.length - 1];
    }
    return samples[samples.length - 1];
  }, [samples, hoveredSeq]);

  const activeExfilAlert = useMemo(
    () => alerts.find((a) => a.status === 'active') ?? null,
    [alerts]
  );

  return (
    <div
      id="data-exfiltration-radar"
      className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-5"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Radar
              className={`w-4 h-4 shrink-0 ${
                metrics.status === 'exfiltration'
                  ? 'text-rose-500'
                  : 'text-cyan-600 dark:text-cyan-400'
              }`}
            />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Data Exfiltration Radar (Diagrammes en aires D3.js)
            </h3>
            <span
              className={`text-[11px] font-mono font-semibold ${
                metrics.status === 'exfiltration'
                  ? 'text-rose-600 dark:text-rose-400'
                  : metrics.status === 'elevated'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {metrics.status === 'exfiltration'
                ? 'ALERTE DATA EXFILTRATION'
                : metrics.status === 'elevated'
                  ? 'SURVEILLANCE ASYMÉTRIE'
                  : 'FLUX SORTANT NOMINAL'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Modélise la ligne de base sortante (Ko/s, Z-score et ratio Upload/Download) via aires D3.js superposées et déclenche une alerte en cas de comportement de type Data Exfiltration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg">
            {(
              [
                { id: 'paranoid', label: 'Sensible 1.8σ' },
                { id: 'balanced', label: 'Équilibré 2.4σ' },
                { id: 'strict', label: 'Strict 3.1σ' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSensitivity(opt.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  sensitivity === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Pause className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={handleSimulateExfiltration}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simuler Exfiltration</span>
          </button>
        </div>
      </div>

      {/* Real-Time Exfiltration Alert Banner */}
      {activeExfilAlert && (
        <div
          role="alert"
          className="border border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/35 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
                Comportement « Data Exfiltration » détecté — {activeExfilAlert.vectorLabel}
              </div>
              <div className="text-[11px] font-mono text-rose-700 dark:text-rose-300/90">
                Pic {activeExfilAlert.peakKbps} Ko/s · Z-score +{activeExfilAlert.zScore}σ · Ratio Up/Down {activeExfilAlert.upDownRatio}x · Cible {activeExfilAlert.destination}:{activeExfilAlert.port}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleMitigateActiveExfil}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Isoler flux sortant</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setAlerts((prev) =>
                  prev.map((a) =>
                    a.id === activeExfilAlert.id
                      ? { ...a, status: 'mitigated' }
                      : a
                  )
                )
              }
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer whitespace-nowrap shrink-0"
            >
              Acquitter
            </button>
          </div>
        </div>
      )}

      {/* Telemetry Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/40 dark:bg-slate-950/30">
        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Débit sortant instantané
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>{metrics.latest?.outboundKbps ?? 0} Ko/s</span>
            <ArrowUpRight className="w-4 h-4 text-cyan-500 shrink-0" />
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Seuil {metrics.latest?.thresholdKbps ?? 0} Ko/s · Pic {metrics.peakKbps} Ko/s
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Écart Z-Score &amp; Asymétrie
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono tabular-nums ${
              (metrics.latest?.zScore ?? 0) >= zThreshold
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-cyan-600 dark:text-cyan-400'
            }`}
          >
            {metrics.latest ? `${metrics.latest.zScore}σ` : '0σ'} ·{' '}
            {metrics.latest ? `${metrics.latest.upDownRatio}x` : '0x'}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Seuil {zThreshold}σ · Max {metrics.maxZ}σ
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Entropie sortante (Shannon)
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {metrics.latest?.entropyBits ?? 7.1} b/o
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {mode} · Tunnel {isConnected ? 'ACTIF' : 'INACTIF'}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Rafales suspectes (48s)
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono tabular-nums ${
              metrics.recentAnomalyCount > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {metrics.recentAnomalyCount}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {metrics.activeAlertCount > 0
              ? `${metrics.activeAlertCount} alerte(s) active(s)`
              : 'Aucune fuite active'}
          </div>
        </div>
      </div>

      {/* D3.js Layered Area Charts Container */}
      <div
        ref={chartContainerRef}
        className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/60 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500/70 inline-block" />
              Flux sortant (Ko/s)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/70 inline-block" />
              Surplus Data Exfiltration
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-dashed border-amber-500 inline-block" />
              Seuil dynamique ({zThreshold}σ)
            </span>
          </div>

          {inspectedSample && (
            <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {inspectedSample.timeLabel} · {inspectedSample.outboundKbps} Ko/s (Base{' '}
              {inspectedSample.baselineKbps}) · {inspectedSample.suspectedDestination}:
              {inspectedSample.suspectedPort}
            </div>
          )}
        </div>

        {/* Primary D3 Area Diagram */}
        <svg
          ref={mainAreaSvgRef}
          className="w-full h-[228px] overflow-visible select-none"
          aria-label="Diagramme en aires D3.js des pics de transfert sortant et exfiltration de données"
        />

        {/* Secondary Stacked Protocol Area Breakdown */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Répartition empilée des vecteurs sortants (D3.js)
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500/60 inline-block" />
                HTTPS/443 ({inspectedSample?.httpsKbps ?? 0} Ko/s)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/70 inline-block" />
                DNS TXT/53 ({inspectedSample?.dnsTunnelKbps ?? 0} Ko/s)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/70 inline-block" />
                Socket brut / C2 ({inspectedSample?.rawSocketKbps ?? 0} Ko/s)
              </span>
            </div>
          </div>

          <svg
            ref={stackAreaSvgRef}
            className="w-full h-[148px] overflow-visible select-none"
            aria-label="Diagramme en aires empilées D3.js par protocole sortant"
          />
        </div>
      </div>

      {/* Recent Exfiltration Incident History */}
      {alerts.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
          {alerts.slice(0, 4).map((alert) => (
            <div
              key={alert.id}
              className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span
                    className={
                      alert.status === 'active'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {alert.status === 'active' ? (
                      <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                    )}
                    {alert.vectorLabel}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {alert.timeLabel} · {alert.destination}:{alert.port}
                </div>
              </div>

              <div className="font-mono tabular-nums text-right shrink-0 text-[11px]">
                <span className="font-bold text-slate-900 dark:text-white">
                  {alert.peakKbps} Ko/s
                </span>{' '}
                <span className="text-slate-500">
                  · Z={alert.zScore}σ ·{' '}
                  {alert.status === 'active' ? 'Actif' : 'Neutralisé'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
