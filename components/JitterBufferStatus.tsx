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
  Cpu,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  ConnectionMode,
  DeviceNode,
  VirtualIdentity,
} from '../types';

export interface JitterBufferStatusProps {
  nodes: DeviceNode[];
  currentIdentity: VirtualIdentity;
  isConnected: boolean;
  mode: ConnectionMode;
  settings: AppSettings;
  onApplyPatch: (patch: Partial<AppSettings>, reason?: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type BufferAiAction = 'holding' | 'expanding' | 'compressing' | 'burst_absorb';

interface JitterBufferSample {
  seq: number;
  timestampMs: number;
  timeLabel: string;
  rawJitterMs: number;
  bufferDepthMs: number;
  residualJitterMs: number;
  occupancyPct: number;
  underrunRiskPct: number;
  compensatedLossPct: number;
  aiAction: BufferAiAction;
}

interface RemoteNodeProfile {
  id: string;
  label: string;
  country: string;
  ip: string;
  rawJitterMs: number;
  aiBufferTargetMs: number;
  residualJitterMs: number;
  compensationPct: number;
  isActiveExit: boolean;
}

const MAX_SAMPLES = 36;
const SLA_RESIDUAL_LIMIT_MS = 8;

function cryptoUnit(): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function getActionLabel(action: BufferAiAction, aiEnabled: boolean): string {
  if (!aiEnabled) return 'Mode manuel verrouillé';
  switch (action) {
    case 'burst_absorb':
      return 'Absorption rafale IA';
    case 'expanding':
      return 'Élargissement tampon IA';
    case 'compressing':
      return 'Compression latence IA';
    default:
      return 'Maintien nominal IA';
  }
}

export const JitterBufferStatus: React.FC<JitterBufferStatusProps> = ({
  nodes,
  currentIdentity,
  isConnected,
  mode,
  settings,
  onApplyPatch,
  addLog,
}) => {
  const [chartTab, setChartTab] = useState<'stream' | 'nodes'>('stream');
  const [aiAutoTune, setAiAutoTune] = useState(true);
  const [manualBufferMs, setManualBufferMs] = useState(24);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('exit-node');
  const [burstRemainingTicks, setBurstRemainingTicks] = useState(0);
  const [hoveredSample, setHoveredSample] =
    useState<JitterBufferSample | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamSvgRef = useRef<SVGSVGElement | null>(null);
  const nodesSvgRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState(720);

  // Build selectable remote endpoints (active exit tunnel + remote nodes)
  const selectableTargets = useMemo(() => {
    const activeExitBaseJitter =
      mode === ConnectionMode.ONION_VORTEX
        ? 14.5
        : mode === ConnectionMode.DOUBLE_HOP
          ? 9.2
          : 4.8;

    const exitTarget = {
      id: 'exit-node',
      label: `${currentIdentity.city} (${currentIdentity.country})`,
      ip: currentIdentity.ip,
      baseJitterMs: Number(
        Math.max(
          2.2,
          activeExitBaseJitter +
            (currentIdentity.latency > 90 ? 5.5 : 1.4) +
            settings.trafficPaddingJitterMs * 0.14
        ).toFixed(1)
      ),
      rttMs: currentIdentity.latency,
      isExit: true,
    };

    const remoteTargets = nodes
      .filter((n) => n.status !== 'disconnected')
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        label: `${n.city || n.name} (${n.country})`,
        ip: n.ip,
        baseJitterMs: Number(
          Math.max(
            2.4,
            (n.jitter ?? Math.max(3.2, n.latency * 0.12)) +
              (mode === ConnectionMode.ONION_VORTEX ? 4.2 : 0)
          ).toFixed(1)
        ),
        rttMs: n.latency,
        isExit: false,
      }));

    return [exitTarget, ...remoteTargets];
  }, [
    nodes,
    currentIdentity.city,
    currentIdentity.country,
    currentIdentity.ip,
    currentIdentity.latency,
    mode,
    settings.trafficPaddingJitterMs,
  ]);

  const activeTarget = useMemo(
    () =>
      selectableTargets.find((t) => t.id === selectedTargetId) ??
      selectableTargets[0],
    [selectableTargets, selectedTargetId]
  );

  // Refs for deterministic Pure React interval simulation without side effects in state updaters
  const seqRef = useRef(0);
  const ewmaJitterRef = useRef(activeTarget.baseJitterMs);
  const currentBufferRef = useRef(
    Math.max(16, Math.round(activeTarget.baseJitterMs * 2.15))
  );
  const burstTicksRef = useRef(0);
  const lastLogActionRef = useRef<BufferAiAction>('holding');

  useEffect(() => {
    burstTicksRef.current = burstRemainingTicks;
  }, [burstRemainingTicks]);

  const computeNextSample = useCallback(
    (
      seq: number,
      timestampMs: number,
      forceSpike = false
    ): JitterBufferSample => {
      const u0 = cryptoUnit();
      const u1 = cryptoUnit();
      const u2 = cryptoUnit();

      const hasSpike = forceSpike || burstTicksRef.current > 0;
      const waveComponent =
        Math.sin(seq * 0.34) * (activeTarget.baseJitterMs * 0.36) +
        (u0 - 0.38) * (activeTarget.baseJitterMs * 0.65);

      const spikeBoost = hasSpike
        ? 18 + u1 * 21 + (burstTicksRef.current > 4 ? 8 : 0)
        : seq % 13 === 0
          ? 7.5 + u1 * 8.5
          : 0;

      const xdpStabilizer = settings.ebpfXdpAcceleration ? 0.84 : 1.0;
      const bbrStabilizer =
        settings.tcpCongestionControl === 'bbr' ? 0.88 : 1.04;

      const rawJitterMs = Number(
        Math.max(
          1.4,
          Math.min(
            78,
            (activeTarget.baseJitterMs + waveComponent + spikeBoost) *
              xdpStabilizer *
              bbrStabilizer
          )
        ).toFixed(1)
      );

      // Update EWMA + peak headroom estimator
      const prevEwma = ewmaJitterRef.current;
      const nextEwma = prevEwma * 0.62 + rawJitterMs * 0.38;
      ewmaJitterRef.current = nextEwma;

      const prevBuf = currentBufferRef.current;
      let nextBuffer = prevBuf;
      let aiAction: BufferAiAction = 'holding';

      if (aiAutoTune) {
        // Asymmetric fast-attack, smooth-release AI controller (RFC 3550 + predictive headroom)
        const targetHeadroom = isConnected ? 1.75 : 1.45;
        const desiredBuffer = Math.max(
          12,
          Math.min(
            90,
            Math.max(rawJitterMs * 1.42, nextEwma * targetHeadroom) +
              (settings.trafficPaddingJitterMs > 0 ? 4.5 : 1.5)
          )
        );

        if (desiredBuffer > prevBuf + 2.2) {
          // Fast expansion to avoid packet underrun during burst
          nextBuffer = prevBuf + (desiredBuffer - prevBuf) * 0.72;
          aiAction = rawJitterMs > prevEwma * 1.45 ? 'burst_absorb' : 'expanding';
        } else if (desiredBuffer < prevBuf - 2.6) {
          // Gradual release to reclaim end-to-end latency
          nextBuffer = prevBuf - (prevBuf - desiredBuffer) * 0.28;
          aiAction = 'compressing';
        } else {
          nextBuffer = prevBuf * 0.85 + desiredBuffer * 0.15;
          aiAction = 'holding';
        }
      } else {
        nextBuffer = manualBufferMs;
        aiAction = 'holding';
      }

      nextBuffer = Number(Math.max(10, Math.min(92, nextBuffer)).toFixed(1));
      currentBufferRef.current = nextBuffer;

      // Residual jitter left after buffer compensation
      const unbufferedOverflow = Math.max(0, rawJitterMs - nextBuffer * 0.82);
      const dampingRatio = aiAutoTune ? 0.14 : 0.32;
      const residualJitterMs = Number(
        Math.max(
          0.6,
          Math.min(
            rawJitterMs,
            rawJitterMs * dampingRatio +
              unbufferedOverflow * 0.85 +
              (u2 - 0.5) * 0.9
          )
        ).toFixed(1)
      );

      const occupancyPct = Math.round(
        Math.max(
          14,
          Math.min(98, (rawJitterMs / Math.max(8, nextBuffer)) * 78)
        )
      );

      const underrunRiskPct = Number(
        Math.max(
          0,
          Math.min(
            95,
            rawJitterMs > nextBuffer
              ? ((rawJitterMs - nextBuffer) / Math.max(4, rawJitterMs)) * 100 +
                  8
              : Math.max(0, (rawJitterMs / Math.max(8, nextBuffer) - 0.72) * 35)
          )
        ).toFixed(1)
      );

      const compensatedLossPct = Number(
        Math.max(
          0,
          Math.min(
            4.5,
            rawJitterMs > nextBuffer
              ? (rawJitterMs - nextBuffer) * 0.08
              : u1 * 0.25
          )
        ).toFixed(2)
      );

      return {
        seq,
        timestampMs,
        timeLabel: new Date(timestampMs).toLocaleTimeString('fr-FR', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
        rawJitterMs,
        bufferDepthMs: nextBuffer,
        residualJitterMs,
        occupancyPct,
        underrunRiskPct,
        compensatedLossPct,
        aiAction,
      };
    },
    [
      activeTarget.baseJitterMs,
      aiAutoTune,
      isConnected,
      manualBufferMs,
      settings.ebpfXdpAcceleration,
      settings.tcpCongestionControl,
      settings.trafficPaddingJitterMs,
    ]
  );

  const [samples, setSamples] = useState<JitterBufferSample[]>(() => {
    const now = Date.now();
    const list: JitterBufferSample[] = [];
    for (let i = 0; i < 24; i++) {
      seqRef.current = i + 1;
      list.push(computeNextSample(i + 1, now - (24 - i) * 900, false));
    }
    return list;
  });

  // Real-time periodic sampler
  useEffect(() => {
    if (isPaused) return;

    const interval = window.setInterval(() => {
      seqRef.current += 1;
      const next = computeNextSample(seqRef.current, Date.now(), false);
      setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), next]);

      if (burstTicksRef.current > 0) {
        const decremented = Math.max(0, burstTicksRef.current - 1);
        burstTicksRef.current = decremented;
        setBurstRemainingTicks(decremented);
      }

      if (
        aiAutoTune &&
        next.aiAction !== lastLogActionRef.current &&
        next.aiAction === 'burst_absorb'
      ) {
        lastLogActionRef.current = next.aiAction;
        addLog?.(
          `[Jitter Buffer IA] Pic de gigue sur ${activeTarget.label} (${next.rawJitterMs} ms) — tampon élargi dynamiquement à ${next.bufferDepthMs} ms`,
          'info',
          activeTarget.ip
        );
      } else if (next.aiAction === 'holding') {
        lastLogActionRef.current = 'holding';
      }
    }, 900);

    return () => window.clearInterval(interval);
  }, [
    isPaused,
    computeNextSample,
    aiAutoTune,
    activeTarget.label,
    activeTarget.ip,
    addLog,
  ]);

  // Responsive SVG width observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 260) {
        setSvgWidth(Math.floor(w));
      }
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const latest = samples[samples.length - 1];

  const stats = useMemo(() => {
    if (samples.length === 0) {
      return {
        avgRaw: 0,
        avgBuffer: 0,
        avgResidual: 0,
        compensationPct: 0,
        aiAdjustmentsCount: 0,
      };
    }
    const avgRaw =
      samples.reduce((sum, s) => sum + s.rawJitterMs, 0) / samples.length;
    const avgBuffer =
      samples.reduce((sum, s) => sum + s.bufferDepthMs, 0) / samples.length;
    const avgResidual =
      samples.reduce((sum, s) => sum + s.residualJitterMs, 0) / samples.length;
    const compensationPct =
      avgRaw > 0
        ? Math.max(0, Math.min(99, Math.round((1 - avgResidual / avgRaw) * 100)))
        : 0;
    const aiAdjustmentsCount = samples.filter(
      (s) => s.aiAction !== 'holding'
    ).length;

    return {
      avgRaw: Number(avgRaw.toFixed(1)),
      avgBuffer: Number(avgBuffer.toFixed(1)),
      avgResidual: Number(avgResidual.toFixed(1)),
      compensationPct,
      aiAdjustmentsCount,
    };
  }, [samples]);

  // Build remote node profiles synchronized with active live telemetry
  const remoteNodeProfiles = useMemo<RemoteNodeProfile[]>(() => {
    const latestRatio =
      latest && activeTarget.baseJitterMs > 0
        ? latest.rawJitterMs / activeTarget.baseJitterMs
        : 1;

    return selectableTargets.map((t) => {
      const raw = Number(
        Math.max(1.8, Math.min(76, t.baseJitterMs * (t.id === activeTarget.id ? latestRatio : 1))).toFixed(1)
      );
      const targetBuf = aiAutoTune
        ? Number(Math.max(12, Math.min(90, raw * 1.68 + 4)).toFixed(1))
        : manualBufferMs;
      const residual = Number(
        Math.max(
          0.7,
          raw * (aiAutoTune ? 0.16 : 0.34) + Math.max(0, raw - targetBuf * 0.82) * 0.8
        ).toFixed(1)
      );
      const compPct = Math.max(
        0,
        Math.min(98, Math.round((1 - residual / Math.max(1, raw)) * 100))
      );

      return {
        id: t.id,
        label: t.label,
        country: t.isExit ? 'Sortie VPN' : 'Relais distant',
        ip: t.ip,
        rawJitterMs: raw,
        aiBufferTargetMs: targetBuf,
        residualJitterMs: residual,
        compensationPct: compPct,
        isActiveExit: t.isExit,
      };
    });
  }, [selectableTargets, latest, activeTarget.baseJitterMs, activeTarget.id, aiAutoTune, manualBufferMs]);

  const bufferHealth: 'nominal' | 'adjusting' | 'degraded' = useMemo(() => {
    if (!latest) return 'nominal';
    if (
      latest.residualJitterMs > SLA_RESIDUAL_LIMIT_MS ||
      latest.underrunRiskPct > 25
    ) {
      return 'degraded';
    }
    if (
      latest.aiAction === 'expanding' ||
      latest.aiAction === 'burst_absorb' ||
      latest.aiAction === 'compressing'
    ) {
      return 'adjusting';
    }
    return 'nominal';
  }, [latest]);

  const handleToggleAiMode = useCallback(() => {
    const nextAi = !aiAutoTune;
    setAiAutoTune(nextAi);
    addLog?.(
      nextAi
        ? `[Jitter Buffer IA] Contrôleur adaptatif activé sur ${activeTarget.label} — compensation automatique de gigue active`
        : `[Jitter Buffer] Basculé en mode manuel (${manualBufferMs} ms fixe) sur ${activeTarget.label}`,
      nextAi ? 'success' : 'warning',
      activeTarget.ip
    );
  }, [aiAutoTune, activeTarget.label, activeTarget.ip, manualBufferMs, addLog]);

  const handleInjectJitterBurst = useCallback(() => {
    burstTicksRef.current = 6;
    setBurstRemainingTicks(6);
    seqRef.current += 1;
    const spiked = computeNextSample(seqRef.current, Date.now(), true);
    setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), spiked]);
    addLog?.(
      `[Jitter Buffer] Pic de gigue réseau simulé (${spiked.rawJitterMs} ms) sur ${activeTarget.label} · ${aiAutoTune ? `tampon IA porté à ${spiked.bufferDepthMs} ms` : `tampon manuel fixe à ${spiked.bufferDepthMs} ms`}`,
      aiAutoTune ? 'info' : 'warning',
      activeTarget.ip
    );
  }, [computeNextSample, activeTarget.label, activeTarget.ip, aiAutoTune, addLog]);

  const handleOptimizeTransport = useCallback(() => {
    if (!aiAutoTune) setAiAutoTune(true);
    burstTicksRef.current = 0;
    setBurstRemainingTicks(0);
    onApplyPatch(
      {
        ebpfXdpAcceleration: true,
        tcpCongestionControl: 'bbr',
      },
      'Optimisation transport Jitter Buffer IA (eBPF/XDP + BBR)'
    );
    seqRef.current += 1;
    const recalibrated = computeNextSample(seqRef.current, Date.now(), false);
    setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), recalibrated]);
    addLog?.(
      `[Jitter Buffer IA] Recalibrage eBPF/BBR effectué sur ${activeTarget.label} (gigue résiduelle ${recalibrated.residualJitterMs} ms)`,
      'success',
      activeTarget.ip
    );
  }, [
    aiAutoTune,
    onApplyPatch,
    computeNextSample,
    activeTarget.label,
    activeTarget.ip,
    addLog,
  ]);

  // =========================================================================
  // D3 CHART 1: Real-Time Adaptive Buffer Envelope vs Raw & Residual Jitter
  // =========================================================================
  useEffect(() => {
    if (chartTab !== 'stream' || !streamSvgRef.current || samples.length === 0) {
      return;
    }

    const svg = d3.select(streamSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 248;
    const margin = { top: 20, right: 20, bottom: 28, left: 48 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(90, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxYVal = Math.max(
      45,
      d3.max(samples, (d) => Math.max(d.bufferDepthMs, d.rawJitterMs)) ?? 45
    );
    const yMax = Math.ceil((maxYVal * 1.15) / 10) * 10;

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, samples.length - 1)])
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

    // Horizontal grid lines
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax
          .selectAll('line')
          .attr('stroke', '#334155')
          .attr('stroke-opacity', 0.32)
          .attr('stroke-dasharray', '2,3')
      );

    // SLA target floor zone [0, 8ms]
    g.append('rect')
      .attr('x', 0)
      .attr('y', y(SLA_RESIDUAL_LIMIT_MS))
      .attr('width', innerW)
      .attr('height', Math.max(0, y(0) - y(SLA_RESIDUAL_LIMIT_MS)))
      .attr('fill', '#10b981')
      .attr('opacity', 0.08);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(SLA_RESIDUAL_LIMIT_MS))
      .attr('y2', y(SLA_RESIDUAL_LIMIT_MS))
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.65);

    g.append('text')
      .attr('x', innerW - 4)
      .attr('y', y(SLA_RESIDUAL_LIMIT_MS) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#34d399')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`Cible résiduelle ≤ ${SLA_RESIDUAL_LIMIT_MS} ms`);

    // 1. Adaptive AI Buffer Envelope Area [0 -> bufferDepthMs]
    const bufferArea = d3
      .area<JitterBufferSample>()
      .x((_, i) => x(i))
      .y0(y(0))
      .y1((d) => y(d.bufferDepthMs))
      .curve(d3.curveStepAfter);

    g.append('path')
      .datum(samples)
      .attr('fill', aiAutoTune ? '#38bdf8' : '#94a3b8')
      .attr('fill-opacity', aiAutoTune ? 0.16 : 0.12)
      .attr('d', bufferArea);

    const bufferLine = d3
      .line<JitterBufferSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.bufferDepthMs))
      .curve(d3.curveStepAfter);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', aiAutoTune ? '#38bdf8' : '#94a3b8')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', aiAutoTune ? 'none' : '5,3')
      .attr('d', bufferLine);

    // 2. Raw Network Jitter Line + soft fill
    const rawLine = d3
      .line<JitterBufferSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.rawJitterMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.9)
      .attr('d', rawLine);

    // Highlight overflow segments where raw jitter exceeds active buffer depth
    samples.forEach((s, idx) => {
      if (s.rawJitterMs > s.bufferDepthMs) {
        g.append('circle')
          .attr('cx', x(idx))
          .attr('cy', y(s.rawJitterMs))
          .attr('r', 3.4)
          .attr('fill', '#f43f5e')
          .attr('stroke', '#0f172a')
          .attr('stroke-width', 1.2);
      } else if (
        aiAutoTune &&
        (s.aiAction === 'burst_absorb' || s.aiAction === 'expanding')
      ) {
        g.append('circle')
          .attr('cx', x(idx))
          .attr('cy', y(s.bufferDepthMs))
          .attr('r', 2.8)
          .attr('fill', '#38bdf8')
          .attr('stroke', '#0f172a')
          .attr('stroke-width', 1);
      }
    });

    // 3. Residual Compensated Jitter Line
    const residualLine = d3
      .line<JitterBufferSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.residualJitterMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.2)
      .attr('d', residualLine);

    // Axes
    const tickIdx = [
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
          .tickValues(tickIdx)
          .tickFormat((val) => samples[Number(val)]?.timeLabel || '')
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
          .ticks(5)
          .tickFormat((d) => `${d}ms`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    // Legend top-left inside plot
    const legend = g.append('g').attr('transform', 'translate(6, -10)');
    [
      {
        label: aiAutoTune ? 'Tampon IA (ms)' : 'Tampon manuel (ms)',
        color: aiAutoTune ? '#38bdf8' : '#94a3b8',
        x: 0,
      },
      { label: 'Gigue brute réseau', color: '#f59e0b', x: 132 },
      { label: 'Gigue résiduelle', color: '#10b981', x: 268 },
    ].forEach((item) => {
      legend
        .append('rect')
        .attr('x', item.x)
        .attr('y', 0)
        .attr('width', 8)
        .attr('height', 8)
        .attr('rx', 2)
        .attr('fill', item.color);
      legend
        .append('text')
        .attr('x', item.x + 12)
        .attr('y', 7.5)
        .attr('fill', '#cbd5e1')
        .attr('font-size', '9.5px')
        .attr('font-family', 'monospace')
        .text(item.label);
    });

    // Interactive Crosshair Hover
    const focusLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#cbd5e1')
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
          samples.length - 1,
          Math.max(0, Math.round(x.invert(mx)))
        );
        const pt = samples[idx];
        if (!pt) return;
        focusLine
          .style('display', null)
          .attr('x1', x(idx))
          .attr('x2', x(idx));
        setHoveredSample(pt);
      })
      .on('mouseleave', () => {
        focusLine.style('display', 'none');
        setHoveredSample(null);
      });
  }, [chartTab, samples, svgWidth, aiAutoTune]);

  // =========================================================================
  // D3 CHART 2: Multi-Node Remote Jitter vs AI Buffer Compensation Matrix
  // =========================================================================
  useEffect(() => {
    if (
      chartTab !== 'nodes' ||
      !nodesSvgRef.current ||
      remoteNodeProfiles.length === 0
    ) {
      return;
    }

    const svg = d3.select(nodesSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 248;
    const margin = { top: 22, right: 20, bottom: 42, left: 48 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(90, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x0 = d3
      .scaleBand<string>()
      .domain(remoteNodeProfiles.map((d) => d.id))
      .range([0, innerW])
      .paddingInner(0.24)
      .paddingOuter(0.12);

    const metrics = ['buffer', 'raw', 'residual'] as const;
    const x1 = d3
      .scaleBand<(typeof metrics)[number]>()
      .domain([...metrics])
      .range([0, x0.bandwidth()])
      .padding(0.12);

    const maxVal = Math.max(
      40,
      d3.max(remoteNodeProfiles, (d) =>
        Math.max(d.aiBufferTargetMs, d.rawJitterMs)
      ) ?? 40
    );
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil((maxVal * 1.15) / 10) * 10])
      .range([innerH, 0]);

    // Grid
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax
          .selectAll('line')
          .attr('stroke', '#334155')
          .attr('stroke-opacity', 0.3)
          .attr('stroke-dasharray', '2,3')
      );

    const colorMap: Record<(typeof metrics)[number], string> = {
      buffer: aiAutoTune ? '#38bdf8' : '#94a3b8',
      raw: '#f59e0b',
      residual: '#10b981',
    };

    const nodeGroups = g
      .selectAll('.node-group')
      .data(remoteNodeProfiles)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${x0(d.id) ?? 0},0)`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        setSelectedTargetId(d.id);
      });

    // Active node subtle frame
    nodeGroups
      .filter((d) => d.id === activeTarget.id)
      .append('rect')
      .attr('x', -4)
      .attr('y', 0)
      .attr('width', x0.bandwidth() + 8)
      .attr('height', innerH)
      .attr('rx', 6)
      .attr('fill', '#38bdf8')
      .attr('fill-opacity', 0.08)
      .attr('stroke', '#38bdf8')
      .attr('stroke-opacity', 0.35);

    nodeGroups
      .selectAll('rect.bar')
      .data((d) => [
        { key: 'buffer' as const, val: d.aiBufferTargetMs },
        { key: 'raw' as const, val: d.rawJitterMs },
        { key: 'residual' as const, val: d.residualJitterMs },
      ])
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (m) => x1(m.key) ?? 0)
      .attr('y', (m) => y(m.val))
      .attr('width', x1.bandwidth())
      .attr('height', (m) => Math.max(0, innerH - y(m.val)))
      .attr('rx', 3)
      .attr('fill', (m) => colorMap[m.key]);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x0).tickFormat((id) => {
          const item = remoteNodeProfiles.find((p) => p.id === id);
          if (!item) return id;
          const short = item.label.split('(')[0].trim();
          return short.length > 13 ? `${short.slice(0, 12)}…` : short;
        })
      )
      .call((ax) => ax.select('.domain').attr('stroke', '#334155'))
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#cbd5e1')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `${d}ms`)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('line').remove())
      .call((ax) =>
        ax
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
      );

    // Legend
    const legend = g.append('g').attr('transform', 'translate(6, -12)');
    [
      {
        label: aiAutoTune ? 'Tampon alloué IA' : 'Tampon manuel',
        color: aiAutoTune ? '#38bdf8' : '#94a3b8',
        x: 0,
      },
      { label: 'Gigue brute', color: '#f59e0b', x: 132 },
      { label: 'Gigue résiduelle', color: '#10b981', x: 230 },
    ].forEach((item) => {
      legend
        .append('rect')
        .attr('x', item.x)
        .attr('y', 0)
        .attr('width', 8)
        .attr('height', 8)
        .attr('rx', 2)
        .attr('fill', item.color);
      legend
        .append('text')
        .attr('x', item.x + 12)
        .attr('y', 7.5)
        .attr('fill', '#cbd5e1')
        .attr('font-size', '9.5px')
        .attr('font-family', 'monospace')
        .text(item.label);
    });
  }, [chartTab, remoteNodeProfiles, svgWidth, aiAutoTune, activeTarget.id]);

  return (
    <section
      id="jitter-buffer-status"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Jitter Buffer Status (Compensation IA Temps Réel D3.js)
            </h2>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className={`text-xs font-mono tabular-nums font-semibold ${
                bufferHealth === 'degraded'
                  ? 'text-rose-600 dark:text-rose-400'
                  : bufferHealth === 'adjusting'
                    ? 'text-cyan-600 dark:text-cyan-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {getActionLabel(latest?.aiAction ?? 'holding', aiAutoTune)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ajustement dynamique du tampon de dé-gigue par l’IA pour stabiliser le flux sur{' '}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {activeTarget.label}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setChartTab('stream')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                chartTab === 'stream'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Flux Tampon D3
            </button>
            <button
              type="button"
              onClick={() => setChartTab('nodes')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                chartTab === 'nodes'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Nœuds Distants
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleAiMode}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              aiAutoTune
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Basculer entre le pilotage adaptatif par IA et un tampon manuel fixe"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{aiAutoTune ? 'IA Adaptative : ON' : 'Mode Manuel'}</span>
          </button>

          <button
            type="button"
            onClick={handleInjectJitterBurst}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Injecter un pic de gigue réseau sur le nœud sélectionné"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Simuler Pic</span>
          </button>

          <button
            type="button"
            onClick={handleOptimizeTransport}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Activer eBPF/XDP + BBR et recalibrer le tampon IA"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
            <span>Recalibrer</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={isPaused ? 'Reprendre la télémétrie' : 'Mettre en pause'}
            aria-label={isPaused ? 'Reprendre la télémétrie' : 'Mettre en pause'}
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Node Selector & Manual Buffer Control Strip */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Nœud surveillé :
          </span>
          <select
            value={activeTarget.id}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            className="text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            aria-label="Sélectionner le nœud distant à surveiller"
          >
            {selectableTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.isExit ? 'Sortie tunnel · ' : 'Relais · '}
                {t.label} ({t.rttMs} ms)
              </option>
            ))}
          </select>
        </div>

        {!aiAutoTune ? (
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Profondeur fixe :
            </span>
            <input
              type="range"
              min={10}
              max={75}
              step={2}
              value={manualBufferMs}
              onChange={(e) => setManualBufferMs(Number(e.target.value))}
              className="w-24 accent-cyan-600 cursor-pointer"
              aria-label="Profondeur manuelle du tampon de gigue en millisecondes"
            />
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 w-12 text-right">
              {manualBufferMs} ms
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Modèle IA : EWMA asymétrique</span>
            <span aria-hidden="true">·</span>
            <span>
              Transport : {settings.tcpCongestionControl.toUpperCase()}
              {settings.ebpfXdpAcceleration ? ' + XDP' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span>{stats.aiAdjustmentsCount} ajustements / fenêtre</span>
          </div>
        )}
      </div>

      {/* Live Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Tampon Actif ({aiAutoTune ? 'IA' : 'Manuel'})
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {latest?.bufferDepthMs ?? 0} ms
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Remplissage {latest?.occupancyPct ?? 0}% · Moy {stats.avgBuffer} ms
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Gigue Brute Réseau
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {latest?.rawJitterMs ?? 0} ms
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Moy {stats.avgRaw} ms sur {activeTarget.ip}
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Gigue Résiduelle Sortie
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono tabular-nums ${
              (latest?.residualJitterMs ?? 0) > SLA_RESIDUAL_LIMIT_MS
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {latest?.residualJitterMs ?? 0} ms
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Compensation {stats.compensationPct}% · Cible ≤ {SLA_RESIDUAL_LIMIT_MS} ms
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Risque Sous-Débit / Pertes
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono tabular-nums ${
              (latest?.underrunRiskPct ?? 0) > 25
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {latest?.underrunRiskPct ?? 0}%
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Pertes corrigées {latest?.compensatedLossPct ?? 0}%
          </div>
        </div>
      </div>

      {/* D3 Visualization Canvas */}
      <div className="p-4 sm:p-5 bg-slate-950">
        <div ref={containerRef} className="w-full relative">
          {chartTab === 'stream' ? (
            <svg
              ref={streamSvgRef}
              className="w-full h-[248px] block select-none"
              role="img"
              aria-label="Graphique D3.js en temps réel du Jitter Buffer Status et de la compensation IA"
            />
          ) : (
            <svg
              ref={nodesSvgRef}
              className="w-full h-[248px] block select-none"
              role="img"
              aria-label="Comparatif D3.js du Jitter Buffer sur les nœuds distants"
            />
          )}

          {/* Hover Readout Strip */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400">
            {hoveredSample && chartTab === 'stream' ? (
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span>Échantillon {hoveredSample.timeLabel}</span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-cyan-400">
                  Tampon {hoveredSample.bufferDepthMs} ms
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-amber-400">
                  Brute {hoveredSample.rawJitterMs} ms
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-emerald-400">
                  Résiduelle {hoveredSample.residualJitterMs} ms
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span>
                  {getActionLabel(hoveredSample.aiAction, aiAutoTune)}
                </span>
              </div>
            ) : (
              <span>
                {chartTab === 'stream'
                  ? 'Survolez la courbe pour inspecter la décision instantanée du contrôleur de tampon IA.'
                  : 'Cliquez sur un groupe de barres pour basculer la télémétrie en direct vers ce nœud distant.'}
              </span>
            )}
            <span>
              {isConnected ? 'Tunnel actif' : 'Tunnel en veille'} · Port{' '}
              {settings.tunnelPort}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
