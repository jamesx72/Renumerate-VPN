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
  EyeOff,
  Ghost,
  Radio,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  TrafficPaddingJitterMs,
  VirtualIdentity,
} from '../types';

export interface GhostProtocolToggleProps {
  isConnected: boolean;
  currentIdentity: VirtualIdentity;
  throughput: { up: number; down: number };
  settings: AppSettings;
  onApplyPatch: (patch: Partial<AppSettings>, reason?: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

interface SignalNoiseSample {
  seq: number;
  timeLabel: string;
  signalKbps: number;
  chaffKbps: number;
  chaffPacketsCount: number;
  snrDb: number;
}

const STORAGE_PREF_KEY = 'renumerate_ghost_preferred_jitter';
const MAX_SAMPLES = 28;

function cryptoUnit(): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function generateSignalNoiseSample(
  seq: number,
  upMbps: number,
  isConnected: boolean,
  jitterMs: TrafficPaddingJitterMs,
  manualBurst = false
): SignalNoiseSample {
  const u0 = cryptoUnit();
  const u1 = cryptoUnit();
  const u2 = cryptoUnit();

  // Outbound real signal volume (kb/s)
  const baseSignal = isConnected
    ? Math.max(95, upMbps * 880 + (u0 - 0.35) * 260)
    : 42 + u0 * 38;
  // Simulate realistic web/RPC burst patterns when unprotected
  const signalSpike = seq % 7 === 0 || seq % 11 === 0 ? 180 + u1 * 340 : 0;
  const signalKbps = Math.round(Math.max(24, baseSignal + signalSpike));

  // Random Chaff noise injection correlated with Ghost Protocol jitter profile
  let chaffKbps = 0;
  let chaffPacketsCount = 0;
  if (jitterMs > 0) {
    const targetDensity =
      jitterMs === 85 ? 1.55 : jitterMs === 40 ? 0.92 : 0.45;
    // Compensate troughs + inject stochastic random noise packets (128B - 1420B)
    const antiPatternFloor = Math.max(80, 420 * targetDensity - signalKbps * 0.25);
    const randomChaff = (antiPatternFloor + u2 * 380 * targetDensity) * (manualBurst ? 1.85 : 1);
    chaffKbps = Math.round(Math.max(45, randomChaff));
    chaffPacketsCount = Math.round(chaffKbps / (4.2 + u1 * 5.6));
  }

  // Signal-to-Noise Ratio in dB: 10 * log10(Signal / Noise)
  const snrDb =
    chaffKbps > 0
      ? Number((10 * Math.log10(signalKbps / Math.max(1, chaffKbps))).toFixed(1))
      : 24.0;

  return {
    seq,
    timeLabel: new Date().toLocaleTimeString('fr-FR', {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    }),
    signalKbps,
    chaffKbps,
    chaffPacketsCount,
    snrDb,
  };
}

export const GhostProtocolToggle: React.FC<GhostProtocolToggleProps> = ({
  isConnected,
  currentIdentity,
  throughput,
  settings,
  onApplyPatch,
  addLog,
}) => {
  const isGhostActive = settings.trafficPaddingJitterMs > 0;

  const [preferredJitter, setPreferredJitter] =
    useState<Exclude<TrafficPaddingJitterMs, 0>>(() => {
      try {
        const saved = Number(localStorage.getItem(STORAGE_PREF_KEY));
        if (saved === 15 || saved === 40 || saved === 85) return saved;
      } catch {
        // Ignore storage read failure
      }
      return settings.trafficPaddingJitterMs > 0
        ? (settings.trafficPaddingJitterMs as Exclude<TrafficPaddingJitterMs, 0>)
        : 40;
    });

  useEffect(() => {
    if (settings.trafficPaddingJitterMs > 0) {
      const activeJ = settings.trafficPaddingJitterMs as Exclude<
        TrafficPaddingJitterMs,
        0
      >;
      setPreferredJitter(activeJ);
      try {
        localStorage.setItem(STORAGE_PREF_KEY, String(activeJ));
      } catch {
        // Ignore storage write failure
      }
    }
  }, [settings.trafficPaddingJitterMs]);

  const [chartView, setChartView] = useState<'stream' | 'ratio'>('stream');
  const [hoveredSample, setHoveredSample] =
    useState<SignalNoiseSample | null>(null);

  const seqRef = useRef(0);
  const [samples, setSamples] = useState<SignalNoiseSample[]>(() => {
    const initial: SignalNoiseSample[] = [];
    for (let i = 0; i < 20; i++) {
      initial.push(
        generateSignalNoiseSample(
          i + 1,
          throughput.up,
          isConnected,
          settings.trafficPaddingJitterMs
        )
      );
    }
    seqRef.current = 20;
    return initial;
  });

  // Periodic chaff stream sampling
  useEffect(() => {
    const timer = window.setInterval(() => {
      seqRef.current += 1;
      const sample = generateSignalNoiseSample(
        seqRef.current,
        throughput.up,
        isConnected,
        settings.trafficPaddingJitterMs
      );
      setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), sample]);
    }, 950);

    return () => window.clearInterval(timer);
  }, [throughput.up, isConnected, settings.trafficPaddingJitterMs]);

  const handleToggleGhost = useCallback(() => {
    if (isGhostActive) {
      onApplyPatch(
        { trafficPaddingJitterMs: 0 },
        'Ghost Protocol désactivé : injection de paquets Chaff interrompue'
      );
      addLog?.(
        '[Ghost Protocol] Désactivé · Flux sortant sans bourrage Chaff (empreinte DPI exposée)',
        'warning',
        currentIdentity.ip
      );
    } else {
      onApplyPatch(
        {
          trafficPaddingJitterMs: preferredJitter,
          tlsClientHelloFragmentation: true,
        },
        `Ghost Protocol activé : injection aléatoire de paquets Chaff (+${preferredJitter} ms jitter)`
      );
      addLog?.(
        `[Ghost Protocol] Activé · Injection Chaff aléatoire (+${preferredJitter} ms) pour masquer les motifs ISP/DPI`,
        'success',
        currentIdentity.ip
      );
    }
  }, [
    isGhostActive,
    preferredJitter,
    onApplyPatch,
    addLog,
    currentIdentity.ip,
  ]);

  const handleSelectJitter = useCallback(
    (level: Exclude<TrafficPaddingJitterMs, 0>) => {
      setPreferredJitter(level);
      try {
        localStorage.setItem(STORAGE_PREF_KEY, String(level));
      } catch {
        // Ignore
      }
      if (isGhostActive) {
        onApplyPatch(
          { trafficPaddingJitterMs: level },
          `Intensité Ghost Protocol ajustée à +${level} ms`
        );
      }
    },
    [isGhostActive, onApplyPatch]
  );

  const handleInjectChaffBurst = useCallback(() => {
    if (!isGhostActive) {
      onApplyPatch(
        {
          trafficPaddingJitterMs: preferredJitter,
          tlsClientHelloFragmentation: true,
        },
        `Ghost Protocol activé via rafale Chaff (+${preferredJitter} ms)`
      );
    }
    seqRef.current += 1;
    const burst = generateSignalNoiseSample(
      seqRef.current,
      throughput.up,
      isConnected,
      isGhostActive
        ? (settings.trafficPaddingJitterMs as TrafficPaddingJitterMs)
        : preferredJitter,
      true
    );
    setSamples((prev) => [...prev.slice(-(MAX_SAMPLES - 1)), burst]);
    addLog?.(
      `[Ghost Protocol] Rafale aléatoire de ${burst.chaffPacketsCount} paquets Chaff (${burst.chaffKbps} kb/s) injectée dans le tunnel`,
      'info',
      currentIdentity.ip
    );
  }, [
    isGhostActive,
    onApplyPatch,
    preferredJitter,
    throughput.up,
    isConnected,
    settings.trafficPaddingJitterMs,
    addLog,
    currentIdentity.ip,
  ]);

  // Signal-to-Noise Aggregate Metrics
  const stats = useMemo(() => {
    const recent = samples.slice(-16);
    const totalSignal = recent.reduce((acc, s) => acc + s.signalKbps, 0);
    const totalChaff = recent.reduce((acc, s) => acc + s.chaffKbps, 0);
    const total = Math.max(1, totalSignal + totalChaff);
    const signalSharePct = Math.round((totalSignal / total) * 100);
    const noiseSharePct = 100 - signalSharePct;
    const avgSnrDb =
      totalChaff > 0
        ? Number((10 * Math.log10(totalSignal / totalChaff)).toFixed(1))
        : 24.0;
    const latestPps = samples[samples.length - 1]?.chaffPacketsCount ?? 0;

    // Estimated resistance against ISP/DPI packet-size & inter-arrival fingerprinting
    const dpiResistancePct =
      settings.trafficPaddingJitterMs === 85
        ? 96
        : settings.trafficPaddingJitterMs === 40
          ? 88
          : settings.trafficPaddingJitterMs === 15
            ? 72
            : 18;

    return {
      signalSharePct,
      noiseSharePct,
      avgSnrDb,
      latestPps,
      dpiResistancePct,
    };
  }, [samples, settings.trafficPaddingJitterMs]);

  // Responsive D3 SVG measurement
  const chartBoxRef = useRef<HTMLDivElement | null>(null);
  const streamSvgRef = useRef<SVGSVGElement | null>(null);
  const ratioSvgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(340);

  useEffect(() => {
    const el = chartBoxRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 140) setChartWidth(w);
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

  // D3 Visualization 1: Signal vs Chaff Noise Stacked Waveform + ISP Observed Envelope
  useEffect(() => {
    if (chartView !== 'stream' || !streamSvgRef.current || samples.length < 2) {
      return;
    }

    const svg = d3.select(streamSvgRef.current);
    svg.selectAll('*').remove();

    const width = chartWidth;
    const height = 166;
    const margin = { top: 12, right: 10, bottom: 22, left: 36 };
    const innerW = Math.max(100, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, samples.length - 1])
      .range([0, innerW]);

    const maxTotal = Math.max(
      450,
      (d3.max(samples, (d) => d.signalKbps + d.chaffKbps) || 800) * 1.15
    );
    const y = d3.scaleLinear().domain([0, maxTotal]).nice().range([innerH, 0]);

    // Subtle grid
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(3)
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

    // 1. Real Signal Area (Bottom layer)
    const signalArea = d3
      .area<SignalNoiseSample>()
      .x((_, i) => x(i))
      .y0(innerH)
      .y1((d) => y(d.signalKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', '#06b6d4')
      .attr('fill-opacity', 0.32)
      .attr('d', signalArea);

    const signalLine = d3
      .line<SignalNoiseSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.signalKbps))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 1.6)
      .attr('d', signalLine);

    // 2. Random Chaff Noise Layer (Stacked above Signal)
    const chaffArea = d3
      .area<SignalNoiseSample>()
      .x((_, i) => x(i))
      .y0((d) => y(d.signalKbps))
      .y1((d) => y(d.signalKbps + d.chaffKbps))
      .curve(d3.curveStepAfter);

    g.append('path')
      .datum(samples)
      .attr('fill', '#8b5cf6')
      .attr('fill-opacity', 0.38)
      .attr('d', chaffArea);

    // 3. Observed ISP / DPI Envelope Line (Signal + Chaff)
    const observedLine = d3
      .line<SignalNoiseSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.signalKbps + d.chaffKbps))
      .curve(d3.curveStepAfter);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr('stroke', isGhostActive ? '#c4b5fd' : '#f43f5e')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', isGhostActive ? '3,2' : 'none')
      .attr('d', observedLine);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues([0, Math.floor((samples.length - 1) / 2), samples.length - 1])
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
          .ticks(3)
          .tickFormat((d) => `${Math.round(Number(d))}`)
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

    // Interactive Hover Readout
    const hoverLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#e2e8f0')
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
        hoverLine
          .style('display', null)
          .attr('x1', x(idx))
          .attr('x2', x(idx));
        setHoveredSample(pt);
      })
      .on('mouseleave', () => {
        hoverLine.style('display', 'none');
        setHoveredSample(null);
      });
  }, [chartView, samples, chartWidth, isGhostActive]);

  // D3 Visualization 2: Signal vs Noise Arc Gauge (D3 Pie / Arc)
  useEffect(() => {
    if (chartView !== 'ratio' || !ratioSvgRef.current) return;

    const svg = d3.select(ratioSvgRef.current);
    svg.selectAll('*').remove();

    const width = chartWidth;
    const height = 166;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const cx = width * 0.34;
    const cy = height * 0.52;
    const outerR = Math.min(height * 0.42, width * 0.22);
    const innerR = outerR * 0.64;

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    const pieData = d3.pie<{ label: string; value: number; color: string }>()
      .sort(null)
      .value((d) => d.value)([
      {
        label: 'Signal réel',
        value: Math.max(1, stats.signalSharePct),
        color: '#22d3ee',
      },
      {
        label: 'Bruit Chaff',
        value: Math.max(0, stats.noiseSharePct),
        color: '#8b5cf6',
      },
    ]);

    const arc = d3
      .arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .padAngle(0.03)
      .cornerRadius(4);

    g.selectAll('.snr-arc')
      .data(pieData)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('opacity', 0.9);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.1em')
      .attr('fill', '#f8fafc')
      .attr('font-size', '14px')
      .attr('font-weight', '700')
      .attr('font-family', 'monospace')
      .text(isGhostActive ? `${stats.avgSnrDb} dB` : 'EXPOSÉ');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.3em')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text('SNR SORTANT');

    // Right side breakdown labels inside SVG
    const lx = width * 0.62;
    const legend = svg.append('g').attr('transform', `translate(${lx},36)`);

    [
      {
        label: `Signal réel (${stats.signalSharePct}%)`,
        color: '#22d3ee',
        y: 0,
      },
      {
        label: `Bruit Chaff (${stats.noiseSharePct}%)`,
        color: '#8b5cf6',
        y: 28,
      },
      {
        label: `Anti-DPI (${stats.dpiResistancePct}%)`,
        color: isGhostActive ? '#10b981' : '#f43f5e',
        y: 56,
      },
      {
        label: `Paquets/s (${stats.latestPps} pps)`,
        color: '#f59e0b',
        y: 84,
      },
    ].forEach((row) => {
      legend
        .append('rect')
        .attr('x', 0)
        .attr('y', row.y)
        .attr('width', 8)
        .attr('height', 8)
        .attr('rx', 2)
        .attr('fill', row.color);

      legend
        .append('text')
        .attr('x', 14)
        .attr('y', row.y + 7.5)
        .attr('fill', '#e2e8f0')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(row.label);
    });
  }, [chartView, chartWidth, stats, isGhostActive]);

  return (
    <section
      id="ghost-protocol-toggle"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
    >
      {/* Header + Dedicated Main Switch */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Ghost
              className={`w-4 h-4 shrink-0 ${
                isGhostActive
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-slate-400'
              }`}
            />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Ghost Protocol Toggle
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Injecte aléatoirement des paquets de bruit <span className="font-mono">chaff</span> dans le flux sortant pour brouiller les empreintes ISP/DPI.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isGhostActive}
          aria-label="Basculer Ghost Protocol (Injection Chaff)"
          onClick={handleToggleGhost}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            isGhostActive
              ? 'bg-violet-600'
              : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
              isGhostActive ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Status + SNR Quantitative Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono border-y border-slate-200 dark:border-slate-800 py-2.5">
        <div className="flex items-center gap-1.5">
          {isGhostActive ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          )}
          <span
            className={`font-semibold ${
              isGhostActive
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isGhostActive
              ? `Chaff actif (+${settings.trafficPaddingJitterMs} ms)`
              : 'Signal nu (0% bruit)'}
          </span>
        </div>

        <span className="tabular-nums text-slate-600 dark:text-slate-300">
          SNR {isGhostActive ? `${stats.avgSnrDb} dB` : '+24.0 dB'} · Anti-DPI{' '}
          {stats.dpiResistancePct}%
        </span>
      </div>

      {/* Chaff Intensity Selector + Burst Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { ms: 15, label: '15 ms' },
              { ms: 40, label: '40 ms' },
              { ms: 85, label: '85 ms' },
            ] as const
          ).map((tier) => (
            <button
              key={tier.ms}
              type="button"
              onClick={() => handleSelectJitter(tier.ms)}
              className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium cursor-pointer transition-colors ${
                preferredJitter === tier.ms
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleInjectChaffBurst}
          className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          title="Injecter immédiatement une rafale aléatoire de paquets Chaff"
        >
          <Zap className="w-3 h-3" />
          <span>Rafale Chaff</span>
        </button>
      </div>

      {/* D3 Signal-to-Noise Visualization Stage */}
      <div
        ref={chartBoxRef}
        className="bg-slate-950 border border-slate-800 rounded-xl p-2 overflow-hidden space-y-1"
      >
        <div className="flex items-center justify-between gap-2 px-1.5 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-cyan-400 rounded-xs inline-block" />
              <span>Signal</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-violet-500 rounded-xs inline-block" />
              <span>Chaff</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setChartView('stream')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                chartView === 'stream'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Onde D3
            </button>
            <button
              type="button"
              onClick={() => setChartView('ratio')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                chartView === 'ratio'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ratio SNR
            </button>
          </div>
        </div>

        {chartView === 'stream' ? (
          <svg ref={streamSvgRef} className="w-full h-[166px] block" />
        ) : (
          <svg ref={ratioSvgRef} className="w-full h-[166px] block" />
        )}

        <div className="px-1.5 pt-0.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
          {hoveredSample && chartView === 'stream' ? (
            <span className="text-cyan-300 truncate">
              {hoveredSample.timeLabel} · Réel {hoveredSample.signalKbps} kb/s + Chaff{' '}
              {hoveredSample.chaffKbps} kb/s ({hoveredSample.snrDb} dB)
            </span>
          ) : (
            <span className="truncate flex items-center gap-1">
              <Radio className="w-3 h-3 text-violet-400 shrink-0" />
              <span>
                {isGhostActive
                  ? `${stats.noiseSharePct}% bruit Chaff (${stats.latestPps} pkt/s)`
                  : 'Enveloppe DPI non masquée'}
              </span>
            </span>
          )}
          <span className="shrink-0 text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span>{samples[samples.length - 1]?.signalKbps ?? 0} kb/s</span>
          </span>
        </div>
      </div>
    </section>
  );
};
