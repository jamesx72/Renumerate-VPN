import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Play,
  Pause,
  Zap,
  Power,
  AlertTriangle,
  Gauge,
  Waves,
  Download,
} from 'lucide-react';
import {
  AppSettings,
  ConnectionMode,
  DeviceNode,
  VirtualIdentity,
} from '../types';

export interface LatencySpectrumAnalyzerProps {
  nodes: DeviceNode[];
  currentIdentity: VirtualIdentity;
  isConnected: boolean;
  mode: ConnectionMode;
  settings: AppSettings;
  onConnectNode: (nodeId: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

interface TelemetrySample {
  seq: number;
  timestamp: number;
  timeLabel: string;
  rttMs: number;
  minRttMs: number;
  maxRttMs: number;
  jitterMs: number;
  lossPct: number;
}

interface NodeLiveSummary {
  node: DeviceNode;
  avgRtt: number;
  p95Rtt: number;
  p99Rtt: number;
  avgJitter: number;
  peakJitter: number;
  avgLossPct: number;
  mosScore: number;
  samples: TelemetrySample[];
}

const MAX_SAMPLES = 44;

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
}

// ITU-T G.107 simplified E-Model MOS estimator (1.0 - 4.5+)
function computeMosScore(rttMs: number, jitterMs: number, lossPct: number): number {
  const effectiveLatency = rttMs / 2 + jitterMs * 2 + 10;
  let rFactor =
    effectiveLatency < 160
      ? 93.2 - effectiveLatency / 40
      : 93.2 - (effectiveLatency - 120) / 10;
  rFactor -= lossPct * 2.5;
  rFactor = Math.max(0, Math.min(100, rFactor));
  const mos =
    1 + 0.035 * rFactor + rFactor * (rFactor - 60) * (100 - rFactor) * 7e-6;
  return Number(Math.max(1.0, Math.min(4.5, mos)).toFixed(2));
}

function generateSampleForNode(
  node: DeviceNode,
  prevSample: TelemetrySample | undefined,
  seq: number,
  mode: ConnectionMode,
  settings: AppSettings,
  isBurstSpike = false
): TelemetrySample {
  const now = Date.now();
  const modeRttMultiplier =
    mode === ConnectionMode.ONION_VORTEX
      ? 1.55
      : mode === ConnectionMode.DOUBLE_HOP
        ? 1.28
        : mode === ConnectionMode.STEALTH
          ? 1.12
          : 1.0;

  const baseRtt = Math.max(4, node.latency * modeRttMultiplier);
  const rawJitter = node.jitter ?? Math.max(1.4, baseRtt * 0.085);
  const bbrDamping = settings.tcpCongestionControl === 'bbr' ? 0.78 : 1.0;
  const chaffJitter =
    settings.trafficPaddingJitterMs > 0
      ? settings.trafficPaddingJitterMs * 0.14
      : 0;

  // Stochastic micro-burst or congestion jitter
  const rand = new Uint32Array(3);
  window.crypto.getRandomValues(rand);
  const u0 = rand[0] / 0xffffffff;
  const u1 = rand[1] / 0xffffffff;
  const u2 = rand[2] / 0xffffffff;

  const isTailBurst = isBurstSpike || u0 > 0.91;
  const spikeOffset = isTailBurst ? (u1 * 2.2 + 0.8) * rawJitter : 0;
  const wave = Math.sin(seq * 0.45) * rawJitter * 0.45;
  const noise = (u1 - 0.5) * rawJitter * 1.35 * bbrDamping;

  const rttMs = Number(
    Math.max(3, baseRtt + wave + noise + spikeOffset + chaffJitter).toFixed(1)
  );

  // RFC 3550 smoothed interarrival jitter estimate J(i) = J(i-1) + (|D(i)| - J(i-1))/16
  const prevRtt = prevSample ? prevSample.rttMs : baseRtt;
  const prevJitter = prevSample ? prevSample.jitterMs : rawJitter * 0.8;
  const deltaRtt = Math.abs(rttMs - prevRtt);
  const instantJitter = prevJitter + (deltaRtt - prevJitter) * 0.38;
  const jitterMs = Number(Math.max(0.3, instantJitter).toFixed(2));

  const baseLoss = node.packetLoss ?? 0.08;
  const lossMicroBurst =
    u2 > 0.89 || isTailBurst
      ? Number((baseLoss + u2 * (isBurstSpike ? 2.4 : 0.95)).toFixed(2))
      : Number(Math.max(0, baseLoss * (0.4 + u2 * 0.8)).toFixed(2));

  const spread = Math.max(1.2, jitterMs * 1.45);
  const minRttMs = Number(Math.max(2, rttMs - spread * 0.65).toFixed(1));
  const maxRttMs = Number((rttMs + spread * 0.95).toFixed(1));

  return {
    seq,
    timestamp: now,
    timeLabel: new Date(now).toLocaleTimeString('fr-FR', {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    }),
    rttMs,
    minRttMs,
    maxRttMs,
    jitterMs,
    lossPct: Math.min(12, lossMicroBurst),
  };
}

export const LatencySpectrumAnalyzer: React.FC<LatencySpectrumAnalyzerProps> = ({
  nodes,
  currentIdentity,
  isConnected,
  mode,
  settings,
  onConnectNode,
  addLog,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(() => {
    return nodes.find((n) => n.ip === currentIdentity.ip)?.id || nodes[0]?.id || '';
  });
  const [isPaused, setIsPaused] = useState(false);
  const [chartTab, setChartTab] = useState<'timeseries' | 'distribution'>(
    'timeseries'
  );
  const [hoveredSample, setHoveredSample] = useState<TelemetrySample | null>(
    null
  );

  // Sync selected node when active IP changes unless user picked another node explicitly
  const activeConnectedNode = useMemo(
    () => nodes.find((n) => n.ip === currentIdentity.ip) || nodes[0],
    [nodes, currentIdentity.ip]
  );

  useEffect(() => {
    if (!nodes.some((n) => n.id === selectedNodeId) && activeConnectedNode) {
      setSelectedNodeId(activeConnectedNode.id);
    }
  }, [nodes, selectedNodeId, activeConnectedNode]);

  const seqRef = useRef(0);
  const [historyMap, setHistoryMap] = useState<Record<string, TelemetrySample[]>>(
    () => {
      const initial: Record<string, TelemetrySample[]> = {};
      nodes.forEach((node) => {
        const list: TelemetrySample[] = [];
        for (let i = 0; i < 24; i++) {
          const prev = list[list.length - 1];
          const sample = generateSampleForNode(node, prev, i, mode, settings);
          sample.timestamp = Date.now() - (24 - i) * 900;
          sample.timeLabel = new Date(sample.timestamp).toLocaleTimeString(
            'fr-FR',
            { hour12: false, minute: '2-digit', second: '2-digit' }
          );
          list.push(sample);
        }
        initial[node.id] = list;
      });
      seqRef.current = 24;
      return initial;
    }
  );

  // Periodic real-time telemetry sampling
  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      seqRef.current += 1;
      const nextSeq = seqRef.current;
      setHistoryMap((prev) => {
        const next: Record<string, TelemetrySample[]> = {};
        nodes.forEach((node) => {
          const existing = prev[node.id] || [];
          const last = existing[existing.length - 1];
          const sample = generateSampleForNode(
            node,
            last,
            nextSeq,
            mode,
            settings
          );
          next[node.id] = [...existing.slice(-(MAX_SAMPLES - 1)), sample];
        });
        return next;
      });
    }, 950);

    return () => window.clearInterval(timer);
  }, [isPaused, nodes, mode, settings]);

  const nodeSummaries = useMemo<NodeLiveSummary[]>(() => {
    return nodes.map((node) => {
      const samples = historyMap[node.id] || [];
      const rtts = samples.map((s) => s.rttMs).sort((a, b) => a - b);
      const avgRtt =
        samples.length > 0
          ? Number(
              (
                samples.reduce((acc, s) => acc + s.rttMs, 0) / samples.length
              ).toFixed(1)
            )
          : node.latency;
      const p95Rtt = Number(
        (computePercentile(rtts, 95) || node.latency).toFixed(1)
      );
      const p99Rtt = Number(
        (computePercentile(rtts, 99) || node.latency).toFixed(1)
      );
      const avgJitter =
        samples.length > 0
          ? Number(
              (
                samples.reduce((acc, s) => acc + s.jitterMs, 0) / samples.length
              ).toFixed(2)
            )
          : node.jitter ?? 1.5;
      const peakJitter =
        samples.length > 0
          ? Number(Math.max(...samples.map((s) => s.jitterMs)).toFixed(2))
          : avgJitter;
      const avgLossPct =
        samples.length > 0
          ? Number(
              (
                samples.reduce((acc, s) => acc + s.lossPct, 0) / samples.length
              ).toFixed(2)
            )
          : node.packetLoss ?? 0.1;

      const mosScore = computeMosScore(avgRtt, avgJitter, avgLossPct);

      return {
        node,
        avgRtt,
        p95Rtt,
        p99Rtt,
        avgJitter,
        peakJitter,
        avgLossPct,
        mosScore,
        samples,
      };
    });
  }, [nodes, historyMap]);

  const activeSummary = useMemo(
    () =>
      nodeSummaries.find((s) => s.node.id === selectedNodeId) ||
      nodeSummaries[0] ||
      null,
    [nodeSummaries, selectedNodeId]
  );

  // Trigger rapid 10-packet burst diagnostic probe on selected exit node
  const handleRunBurstProbe = useCallback(() => {
    if (!activeSummary) return;
    setHistoryMap((prev) => {
      const existing = prev[activeSummary.node.id] || [];
      let nextList = [...existing];
      for (let i = 0; i < 8; i++) {
        seqRef.current += 1;
        const sample = generateSampleForNode(
          activeSummary.node,
          nextList[nextList.length - 1],
          seqRef.current,
          mode,
          settings,
          i === 3 || i === 6
        );
        nextList = [...nextList.slice(-(MAX_SAMPLES - 1)), sample];
      }
      return {
        ...prev,
        [activeSummary.node.id]: nextList,
      };
    });
    addLog?.(
      `[Analyseur Latence] Rafale de sonde granulaire (8 trames ICMP/UDP) exécutée vers ${activeSummary.node.city || activeSummary.node.name} (${activeSummary.node.ip})`,
      'info',
      activeSummary.node.ip
    );
  }, [activeSummary, mode, settings, addLog]);

  const handleExportCsv = useCallback(() => {
    if (!activeSummary) return;
    const header = 'seq,heure,rtt_ms,min_ms,max_ms,gigue_ms,perte_pct';
    const rows = activeSummary.samples.map(
      (s) =>
        `${s.seq},${s.timeLabel},${s.rttMs},${s.minRttMs},${s.maxRttMs},${s.jitterMs},${s.lossPct}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `latency-spectrum-${activeSummary.node.ip}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeSummary]);

  // D3.js Time-Series Chart Container
  const timeSvgRef = useRef<SVGSVGElement | null>(null);
  const distSvgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(680);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 120) setChartWidth(w);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // Render D3.js Granular Time-Series (RTT Envelope + Jitter + Packet Loss Bars)
  useEffect(() => {
    if (chartTab !== 'timeseries' || !timeSvgRef.current || !activeSummary) {
      return;
    }

    const samples = activeSummary.samples;
    if (samples.length < 2) return;

    const svg = d3.select(timeSvgRef.current);
    svg.selectAll('*').remove();

    const width = chartWidth;
    const height = 236;
    const margin = { top: 18, right: 48, bottom: 28, left: 46 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, samples.length - 1])
      .range([0, innerW]);

    const maxRtt = Math.max(
      40,
      (d3.max(samples, (d) => d.maxRttMs) || 60) * 1.15
    );
    const yRtt = d3.scaleLinear().domain([0, maxRtt]).nice().range([innerH, 0]);

    const maxJitter = Math.max(
      8,
      (d3.max(samples, (d) => d.jitterMs) || 10) * 1.35
    );
    const yJitter = d3
      .scaleLinear()
      .domain([0, maxJitter])
      .nice()
      .range([innerH, 0]);

    const yLoss = d3.scaleLinear().domain([0, 6]).range([innerH, innerH * 0.45]);

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .call(
        d3
          .axisLeft(yRtt)
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

    // P95 threshold dashed line
    const p95Y = yRtt(activeSummary.p95Rtt);
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', p95Y)
      .attr('y2', p95Y)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.65);

    g.append('text')
      .attr('x', 4)
      .attr('y', Math.max(10, p95Y - 4))
      .attr('fill', '#34d399')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`P95 ${activeSummary.p95Rtt} ms`);

    // 1. Packet Loss Impulses (bars from bottom)
    const barW = Math.max(3, innerW / samples.length - 3);
    g.selectAll('.loss-bar')
      .data(samples)
      .enter()
      .append('rect')
      .attr('x', (_, i) => x(i) - barW / 2)
      .attr('y', (d) => (d.lossPct > 0.05 ? yLoss(Math.min(6, d.lossPct)) : innerH))
      .attr('width', barW)
      .attr('height', (d) =>
        d.lossPct > 0.05 ? Math.max(2, innerH - yLoss(Math.min(6, d.lossPct))) : 0
      )
      .attr('rx', 1.5)
      .attr('fill', '#f43f5e')
      .attr('opacity', 0.72);

    // 2. Min-Max Dispersion Envelope (D3 Area)
    const envelopeArea = d3
      .area<TelemetrySample>()
      .x((_, i) => x(i))
      .y0((d) => yRtt(d.minRttMs))
      .y1((d) => yRtt(d.maxRttMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', '#06b6d4')
      .attr('fill-opacity', 0.16)
      .attr('d', envelopeArea);

    // 3. Instant RTT Curve (D3 Line)
    const rttLine = d3
      .line<TelemetrySample>()
      .x((_, i) => x(i))
      .y((d) => yRtt(d.rttMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2)
      .attr('d', rttLine);

    // 4. Jitter RFC 3550 Curve (D3 Line on right axis)
    const jitterLine = d3
      .line<TelemetrySample>()
      .x((_, i) => x(i))
      .y((d) => yJitter(d.jitterMs))
      .curve(d3.curveCatmullRom);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '4,2')
      .attr('d', jitterLine);

    // Axes
    const xTickIndices = [
      0,
      Math.floor((samples.length - 1) * 0.33),
      Math.floor((samples.length - 1) * 0.66),
      samples.length - 1,
    ];
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(xTickIndices)
          .tickFormat((val) => samples[Number(val)]?.timeLabel || '')
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
          .axisLeft(yRtt)
          .ticks(4)
          .tickFormat((d) => `${d}ms`)
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

    g.append('g')
      .attr('transform', `translate(${innerW},0)`)
      .call(
        d3
          .axisRight(yJitter)
          .ticks(4)
          .tickFormat((d) => `±${d}`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#f59e0b')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    // Interactive Hover Overlay
    const focusLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .style('display', 'none');

    const focusDot = g
      .append('circle')
      .attr('r', 4)
      .attr('fill', '#22d3ee')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5)
      .style('display', 'none');

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const idx = Math.min(
          samples.length - 1,
          Math.max(0, Math.round(x.invert(mx)))
        );
        const sample = samples[idx];
        if (!sample) return;
        focusLine
          .style('display', null)
          .attr('x1', x(idx))
          .attr('x2', x(idx));
        focusDot
          .style('display', null)
          .attr('cx', x(idx))
          .attr('cy', yRtt(sample.rttMs));
        setHoveredSample(sample);
      })
      .on('mouseleave', () => {
        focusLine.style('display', 'none');
        focusDot.style('display', 'none');
        setHoveredSample(null);
      });
  }, [chartTab, activeSummary, chartWidth]);

  // Render D3.js Latency Histogram Distribution (d3.bin)
  useEffect(() => {
    if (chartTab !== 'distribution' || !distSvgRef.current || !activeSummary) {
      return;
    }

    const samples = activeSummary.samples;
    if (samples.length < 2) return;

    const svg = d3.select(distSvgRef.current);
    svg.selectAll('*').remove();

    const width = chartWidth;
    const height = 236;
    const margin = { top: 18, right: 20, bottom: 28, left: 40 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const minRtt = Math.max(0, (d3.min(samples, (d) => d.rttMs) || 5) * 0.8);
    const maxRtt = Math.max(minRtt + 15, (d3.max(samples, (d) => d.rttMs) || 50) * 1.15);

    const x = d3.scaleLinear().domain([minRtt, maxRtt]).nice().range([0, innerW]);

    const binner = d3
      .bin<TelemetrySample, number>()
      .value((d) => d.rttMs)
      .domain(x.domain() as [number, number])
      .thresholds(12);

    const bins = binner(samples);
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(2, d3.max(bins, (b) => b.length) || 4)])
      .nice()
      .range([innerH, 0]);

    g.selectAll('.hist-bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.x0 ?? 0) + 1)
      .attr('y', (d) => y(d.length))
      .attr('width', (d) => Math.max(2, x(d.x1 ?? 0) - x(d.x0 ?? 0) - 2))
      .attr('height', (d) => innerH - y(d.length))
      .attr('rx', 3)
      .attr('fill', (d) => {
        const mid = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        if (mid >= activeSummary.p95Rtt) return '#f59e0b';
        return '#06b6d4';
      })
      .attr('opacity', 0.82);

    // P95 & P99 Vertical Markers
    [
      { label: 'P95', val: activeSummary.p95Rtt, color: '#10b981' },
      { label: 'P99', val: activeSummary.p99Rtt, color: '#f43f5e' },
    ].forEach((marker) => {
      const mx = x(marker.val);
      g.append('line')
        .attr('x1', mx)
        .attr('x2', mx)
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', marker.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');

      g.append('text')
        .attr('x', Math.min(innerW - 28, mx + 4))
        .attr('y', marker.label === 'P95' ? 12 : 24)
        .attr('fill', marker.color)
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text(`${marker.label} ${marker.val}ms`);
    });

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(6)
          .tickFormat((d) => `${d} ms`)
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
      .call(d3.axisLeft(y).ticks(4))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );
  }, [chartTab, activeSummary, chartWidth]);

  if (!activeSummary) return null;

  return (
    <section
      id="latency-spectrum-analyzer"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Analyseur de Spectre de Latence (Gigue &amp; Pertes D3.js)
            </h2>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {activeSummary.node.city || activeSummary.node.name} ({activeSummary.node.ip})
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Diagnostic granulaire en temps réel de la dispersion RTT (P95/P99), de la gigue RFC 3550 et des micro-pertes par nœud de sortie.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setChartTab('timeseries')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                chartTab === 'timeseries'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Série temporelle
            </button>
            <button
              type="button"
              onClick={() => setChartTab('distribution')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                chartTab === 'distribution'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Spectre P95/P99
            </button>
          </div>

          <button
            type="button"
            onClick={handleRunBurstProbe}
            className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Envoyer une rafale de sondes pour mesurer la gigue extrême"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sonde Rafale</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={isPaused ? 'Reprendre l’échantillonnage' : 'Mettre en pause'}
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Exporter l’historique de latence (CSV)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* KPI Granular Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>LATENCE P95 / P99</span>
              <Activity className="w-3.5 h-3.5 text-cyan-500" />
            </div>
            <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
              {activeSummary.p95Rtt} <span className="text-xs font-normal text-slate-500">/ {activeSummary.p99Rtt} ms</span>
            </div>
            <div className="text-[10px] text-slate-500 tabular-nums">
              Moyenne {activeSummary.avgRtt} ms
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>GIGUE (RFC 3550)</span>
              <Waves className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
              ±{activeSummary.avgJitter} ms
            </div>
            <div className="text-[10px] text-slate-500 tabular-nums">
              Pic observé {activeSummary.peakJitter} ms
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>PERTE DE PAQUETS</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div
              className={`text-base font-bold tabular-nums ${
                activeSummary.avgLossPct > 0.8
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {activeSummary.avgLossPct.toFixed(2)}%
            </div>
            <div className="text-[10px] text-slate-500 tabular-nums">
              {activeSummary.samples.length} fenêtres sondées
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>INDICE MOS (G.107)</span>
              <Gauge className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {activeSummary.mosScore.toFixed(2)} / 4.50
            </div>
            <div className="text-[10px] text-slate-500">
              {activeSummary.mosScore >= 4.0
                ? 'Qualité temps réel optimale'
                : activeSummary.mosScore >= 3.4
                  ? 'Liaison stable'
                  : 'Congestion détectée'}
            </div>
          </div>
        </div>

        {/* D3 Visualization Canvas */}
        <div
          ref={wrapperRef}
          className="relative w-full bg-slate-950 border border-slate-800 rounded-xl p-2 overflow-hidden"
        >
          {/* Compact Inline Legend & Hover Readout */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              {chartTab === 'timeseries' ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                    <span>RTT (ms)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                    <span>Gigue (ms)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-rose-500 rounded-xs inline-block" />
                    <span>Pertes (%)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                    <span>Seuil P95</span>
                  </span>
                </>
              ) : (
                <span>
                  Distribution spectrale des {activeSummary.samples.length} derniers échantillons RTT (ms)
                </span>
              )}
            </div>

            {hoveredSample ? (
              <div className="text-cyan-300 tabular-nums">
                {hoveredSample.timeLabel} · RTT {hoveredSample.rttMs} ms · Gigue ±
                {hoveredSample.jitterMs} ms · Perte {hoveredSample.lossPct}%
              </div>
            ) : (
              <div className="text-slate-500">
                {isConnected
                  ? `Transport ${settings.protocol.toUpperCase()} · ${settings.tcpCongestionControl.toUpperCase()}`
                  : 'Sonde hors tunnel (référence locale)'}
              </div>
            )}
          </div>

          {chartTab === 'timeseries' ? (
            <svg ref={timeSvgRef} className="w-full h-[236px] block" />
          ) : (
            <svg ref={distSvgRef} className="w-full h-[236px] block" />
          )}
        </div>

        {/* Exit Nodes Granular Comparison Matrix */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Comparatif Granulaire des Nœuds de Sortie
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Cliquez sur un nœud pour inspecter son spectre
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {nodeSummaries.slice(0, 6).map((summary) => {
              const isSelected = summary.node.id === activeSummary.node.id;
              const isCurrentExit = summary.node.ip === currentIdentity.ip;
              return (
                <div
                  key={summary.node.id}
                  onClick={() => setSelectedNodeId(summary.node.id)}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-500/60'
                      : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white truncate">
                      <span>{summary.node.city || summary.node.name}</span>
                      <span className="text-slate-400 font-normal">
                        {summary.node.country}
                      </span>
                      {isCurrentExit && (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          · Actif
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      P95 {summary.p95Rtt}ms · ±{summary.avgJitter}ms gigue ·{' '}
                      {summary.avgLossPct}% perte
                    </div>
                  </div>

                  {!isCurrentExit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectNode(summary.node.id);
                      }}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-600 dark:text-slate-300 hover:text-emerald-500 shrink-0 cursor-pointer"
                      title="Basculer vers ce nœud de sortie"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
