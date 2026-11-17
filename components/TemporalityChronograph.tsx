import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import {
  AlertTriangle,
  Clock,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  ConnectionMode,
  VirtualIdentity,
} from '../types';

export interface TemporalityChronographProps {
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

interface DriftSample {
  seq: number;
  timestampMs: number;
  timeLabel: string;
  driftMs: number; // Signed offset vs exit node NTS reference (+ ahead, - behind)
  monotonicDeltaUs: number;
  stratum: 1 | 2 | 3;
}

const SAFE_THRESHOLD_MS = 25;
const CRITICAL_THRESHOLD_MS = 120;
const MAX_POINTS = 40;

function cryptoUnit(): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function parseUtcOffsetHours(tzLabel: string): number {
  const match = tzLabel.match(/UTC([+-]?\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  const val = Number.parseFloat(match[1]);
  return Number.isFinite(val) ? val : 0;
}

export const TemporalityChronograph: React.FC<TemporalityChronographProps> = ({
  isConnected,
  mode,
  currentIdentity,
  settings,
  onApplyPatch,
  addLog,
}) => {
  const [chartTab, setChartTab] = useState<'chronogram' | 'dial'>('chronogram');
  const [isPaused, setIsPaused] = useState(false);
  const [simulatedSkewMs, setSimulatedSkewMs] = useState(0);
  const [hoveredSample, setHoveredSample] = useState<DriftSample | null>(null);
  const lastAlertLevelRef = useRef<'ok' | 'warn' | 'crit'>('ok');

  // Measure real browser monotonic clock vs wall-clock delta across ticks
  const lastWallRef = useRef<number>(Date.now());
  const lastPerfRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  const seqRef = useRef(0);

  const [samples, setSamples] = useState<DriftSample[]>(() => {
    const now = Date.now();
    const list: DriftSample[] = [];
    for (let i = 0; i < 24; i++) {
      const ts = now - (24 - i) * 1000;
      const baseJitter = settings.ntpDriftProtection ? 3.5 : 18.0;
      const drift = Number(
        (Math.sin(i * 0.42) * baseJitter + (i % 5 === 0 ? 2.4 : -1.1)).toFixed(
          2
        )
      );
      list.push({
        seq: i + 1,
        timestampMs: ts,
        timeLabel: new Date(ts).toLocaleTimeString('fr-FR', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
        driftMs: drift,
        monotonicDeltaUs: Math.round(140 + (i % 4) * 35),
        stratum: settings.ntpDriftProtection ? 1 : 2,
      });
    }
    seqRef.current = 24;
    return list;
  });

  // Periodic clock drift & monotonic measurement tick
  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      seqRef.current += 1;
      const nowWall = Date.now();
      const nowPerf =
        typeof performance !== 'undefined' ? performance.now() : nowWall;

      const wallElapsed = nowWall - lastWallRef.current;
      const perfElapsed = nowPerf - lastPerfRef.current;
      lastWallRef.current = nowWall;
      lastPerfRef.current = nowPerf;

      // Real wall-vs-monotonic discrepancy (microseconds / ms)
      const realClockDeltaMs = wallElapsed - perfElapsed;
      const monotonicDeltaUs = Math.round(
        Math.min(4500, Math.abs(realClockDeltaMs) * 1000)
      );

      const u0 = cryptoUnit() - 0.5;
      const u1 = cryptoUnit() - 0.5;

      // Natural oscillator + network asymmetry scaled by ntpDriftProtection & route hops
      const hopAsymmetry =
        mode === ConnectionMode.ONION_VORTEX
          ? 7.5
          : mode === ConnectionMode.DOUBLE_HOP
            ? 4.2
            : 1.8;

      const baseDrift = settings.ntpDriftProtection
        ? u0 * (3.8 + hopAsymmetry * 0.45) + realClockDeltaMs * 0.15
        : (u0 * 38 + Math.sin(seqRef.current * 0.35) * 26 + hopAsymmetry * 2.5) +
          realClockDeltaMs * 0.6;

      // Decay simulated skew gently unless freshly injected, or keep above threshold until resynced
      const totalDrift = Number(
        (baseDrift + simulatedSkewMs + u1 * 1.4).toFixed(2)
      );

      const nextSample: DriftSample = {
        seq: seqRef.current,
        timestampMs: nowWall,
        timeLabel: new Date(nowWall).toLocaleTimeString('fr-FR', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
        driftMs: Math.max(-280, Math.min(280, totalDrift)),
        monotonicDeltaUs,
        stratum: settings.ntpDriftProtection && isConnected ? 1 : 2,
      };

      setSamples((prev) => [...prev.slice(-(MAX_POINTS - 1)), nextSample]);

      const absD = Math.abs(nextSample.driftMs);
      const nextLevel: 'ok' | 'warn' | 'crit' =
        absD > CRITICAL_THRESHOLD_MS
          ? 'crit'
          : absD > SAFE_THRESHOLD_MS
            ? 'warn'
            : 'ok';

      if (nextLevel !== lastAlertLevelRef.current) {
        lastAlertLevelRef.current = nextLevel;
        if (nextLevel === 'crit') {
          addLog?.(
            `[Chronographe] Désynchronisation NTP critique (${nextSample.driftMs > 0 ? '+' : ''}${nextSample.driftMs} ms) par rapport à ${currentIdentity.city} — risque rejet TAI64N`,
            'error',
            currentIdentity.ip
          );
        } else if (nextLevel === 'warn') {
          addLog?.(
            `[Chronographe] Dérive horloge détectée (${nextSample.driftMs > 0 ? '+' : ''}${nextSample.driftMs} ms > seuil ${SAFE_THRESHOLD_MS} ms)`,
            'warning',
            currentIdentity.ip
          );
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    isPaused,
    mode,
    settings.ntpDriftProtection,
    isConnected,
    simulatedSkewMs,
    currentIdentity.city,
    currentIdentity.ip,
    addLog,
  ]);

  const latest = samples[samples.length - 1];
  const latestDriftMs = latest?.driftMs ?? 0;
  const absDrift = Math.abs(latestDriftMs);

  // Browser vs Exit Node timezone alignment check
  const tzStatus = useMemo(() => {
    const offsetMin = -new Date().getTimezoneOffset();
    const browserHours = Number((offsetMin / 60).toFixed(1));
    const exitHours = parseUtcOffsetHours(currentIdentity.timezone || 'UTC+0');
    const diffHours = Math.abs(browserHours - exitHours);
    const aligned =
      Boolean(settings.fingerprintProtection?.timezoneSync) || diffHours < 0.1;

    return {
      browserLabel:
        browserHours >= 0 ? `UTC+${browserHours}` : `UTC${browserHours}`,
      exitLabel: currentIdentity.timezone || 'UTC+0',
      aligned,
      diffHours,
    };
  }, [
    currentIdentity.timezone,
    settings.fingerprintProtection?.timezoneSync,
  ]);

  const alertState: 'nominal' | 'warning' | 'critical' = useMemo(() => {
    if (absDrift > CRITICAL_THRESHOLD_MS) return 'critical';
    if (absDrift > SAFE_THRESHOLD_MS || !settings.ntpDriftProtection) {
      return 'warning';
    }
    return 'nominal';
  }, [absDrift, settings.ntpDriftProtection]);

  const handleSimulateDrift = useCallback(() => {
    const sign = cryptoUnit() > 0.45 ? 1 : -1;
    const spike = Number((sign * (145 + cryptoUnit() * 65)).toFixed(1));
    setSimulatedSkewMs(spike);
    addLog?.(
      `[Chronographe] Dérive NTP injectée (${spike > 0 ? '+' : ''}${spike} ms) pour validation des seuils de sécurité`,
      'warning',
      currentIdentity.ip
    );
  }, [addLog, currentIdentity.ip]);

  const handleResyncNts = useCallback(() => {
    setSimulatedSkewMs(0);
    lastAlertLevelRef.current = 'ok';

    onApplyPatch(
      {
        ntpDriftProtection: true,
        fingerprintProtection: {
          ...settings.fingerprintProtection,
          timezoneSync: true,
        },
      },
      'Resynchronisation NTS (RFC 8915) et alignement de fuseau horaire appliqués.'
    );

    const now = Date.now();
    const cleanDrift = Number(((cryptoUnit() - 0.5) * 3.2).toFixed(2));
    seqRef.current += 1;
    setSamples((prev) => [
      ...prev.slice(-(MAX_POINTS - 1)),
      {
        seq: seqRef.current,
        timestampMs: now,
        timeLabel: new Date(now).toLocaleTimeString('fr-FR', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
        driftMs: cleanDrift,
        monotonicDeltaUs: 95,
        stratum: 1,
      },
    ]);

    addLog?.(
      `[Chronographe] Horloge resynchronisée via NTS Stratum-1 sur ${currentIdentity.city} (${cleanDrift > 0 ? '+' : ''}${cleanDrift} ms)`,
      'success',
      currentIdentity.ip
    );
  }, [
    onApplyPatch,
    settings.fingerprintProtection,
    addLog,
    currentIdentity.city,
    currentIdentity.ip,
  ]);

  // Responsive SVG Sizing
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const chronoSvgRef = useRef<SVGSVGElement | null>(null);
  const dialSvgRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState(680);

  useEffect(() => {
    const el = wrapperRef.current;
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
  // D3 CHART 1: Symmetric Zero-Centered NTP Drift Chronogram
  // =========================================================================
  useEffect(() => {
    if (
      chartTab !== 'chronogram' ||
      !chronoSvgRef.current ||
      samples.length < 2
    ) {
      return;
    }

    const svg = d3.select(chronoSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 228;
    const margin = { top: 18, right: 24, bottom: 26, left: 52 };
    const innerW = Math.max(140, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxAbsObserved = d3.max(samples, (d) => Math.abs(d.driftMs)) || 40;
    const yBound = Math.max(60, Math.min(260, Math.ceil(maxAbsObserved * 1.25 / 10) * 10));

    const x = d3
      .scaleLinear()
      .domain([0, samples.length - 1])
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([-yBound, yBound]).range([innerH, 0]);

    // Safe tolerance band [-25ms, +25ms]
    const safeTop = y(Math.min(yBound, SAFE_THRESHOLD_MS));
    const safeBot = y(Math.max(-yBound, -SAFE_THRESHOLD_MS));
    g.append('rect')
      .attr('x', 0)
      .attr('y', safeTop)
      .attr('width', innerW)
      .attr('height', Math.max(0, safeBot - safeTop))
      .attr('fill', '#10b981')
      .attr('opacity', 0.09);

    // Critical regions if within yBound
    if (yBound > CRITICAL_THRESHOLD_MS) {
      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerW)
        .attr('height', y(CRITICAL_THRESHOLD_MS))
        .attr('fill', '#f43f5e')
        .attr('opacity', 0.08);

      g.append('rect')
        .attr('x', 0)
        .attr('y', y(-CRITICAL_THRESHOLD_MS))
        .attr('width', innerW)
        .attr('height', Math.max(0, innerH - y(-CRITICAL_THRESHOLD_MS)))
        .attr('fill', '#f43f5e')
        .attr('opacity', 0.08);
    }

    // Threshold dashed lines (±25ms and ±120ms)
    [SAFE_THRESHOLD_MS, -SAFE_THRESHOLD_MS].forEach((val) => {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', y(val))
        .attr('y2', y(val))
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.7);
    });

    if (yBound > CRITICAL_THRESHOLD_MS) {
      [CRITICAL_THRESHOLD_MS, -CRITICAL_THRESHOLD_MS].forEach((val) => {
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerW)
          .attr('y1', y(val))
          .attr('y2', y(val))
          .attr('stroke', '#f43f5e')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3')
          .attr('opacity', 0.75);
      });
    }

    // Center 0.0 ms NTS Exit Node Reference Line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.65);

    g.append('text')
      .attr('x', 6)
      .attr('y', y(0) - 4)
      .attr('fill', '#38bdf8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`0.0 ms (NTS ${currentIdentity.city})`);

    // Drift area relative to 0 ms
    const driftArea = d3
      .area<DriftSample>()
      .x((_, i) => x(i))
      .y0(y(0))
      .y1((d) => y(d.driftMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr(
        'fill',
        alertState === 'critical'
          ? '#f43f5e'
          : alertState === 'warning'
            ? '#f59e0b'
            : '#22d3ee'
      )
      .attr('fill-opacity', 0.2)
      .attr('d', driftArea);

    // Drift line
    const driftLine = d3
      .line<DriftSample>()
      .x((_, i) => x(i))
      .y((d) => y(d.driftMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(samples)
      .attr('fill', 'none')
      .attr(
        'stroke',
        alertState === 'critical'
          ? '#fb7185'
          : alertState === 'warning'
            ? '#fbbf24'
            : '#22d3ee'
      )
      .attr('stroke-width', 2)
      .attr('d', driftLine);

    // Threshold breach dots
    g.selectAll('.breach-dot')
      .data(
        samples
          .map((s, idx) => ({ s, idx }))
          .filter(({ s }) => Math.abs(s.driftMs) > SAFE_THRESHOLD_MS)
      )
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.idx))
      .attr('cy', (d) => y(d.s.driftMs))
      .attr('r', 3.2)
      .attr('fill', (d) =>
        Math.abs(d.s.driftMs) > CRITICAL_THRESHOLD_MS ? '#f43f5e' : '#f59e0b'
      )
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.2);

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
          .tickFormat((d) => `${Number(d) > 0 ? '+' : ''}${d}ms`)
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

    // Crosshair hover overlay
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
  }, [chartTab, samples, svgWidth, currentIdentity.city, alertState]);

  // =========================================================================
  // D3 CHART 2: Radial Polar Clock-Skew Chronograph Dial
  // =========================================================================
  useEffect(() => {
    if (chartTab !== 'dial' || !dialSvgRef.current) return;

    const svg = d3.select(dialSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 228;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const cx = width * 0.42;
    const cy = height * 0.54;
    const radius = Math.min(height * 0.39, width * 0.28);

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Map [-150ms, +150ms] onto [-135°, +135°] in radians
    const angleScale = d3
      .scaleLinear()
      .domain([-150, 150])
      .range([(-3 * Math.PI) / 4, (3 * Math.PI) / 4])
      .clamp(true);

    const arcGen = d3.arc<{ start: number; end: number }>();

    // Dial Background Track & Zones
    const zones = [
      { start: -150, end: -CRITICAL_THRESHOLD_MS, color: '#e11d48' },
      { start: -CRITICAL_THRESHOLD_MS, end: -SAFE_THRESHOLD_MS, color: '#d97706' },
      { start: -SAFE_THRESHOLD_MS, end: SAFE_THRESHOLD_MS, color: '#10b981' },
      { start: SAFE_THRESHOLD_MS, end: CRITICAL_THRESHOLD_MS, color: '#d97706' },
      { start: CRITICAL_THRESHOLD_MS, end: 150, color: '#e11d48' },
    ];

    zones.forEach((z) => {
      const dPath = arcGen({
        start: z.start,
        end: z.end,
        innerRadius: radius - 14,
        outerRadius: radius,
        startAngle: angleScale(z.start),
        endAngle: angleScale(z.end),
      } as unknown as { start: number; end: number });

      if (dPath) {
        g.append('path')
          .attr('d', dPath)
          .attr('fill', z.color)
          .attr('opacity', 0.78);
      }
    });

    // Precision tick marks around dial
    [-150, -120, -75, -25, 0, 25, 75, 120, 150].forEach((msVal) => {
      const ang = angleScale(msVal) - Math.PI / 2;
      const rIn = radius - 20;
      const rOut = radius + 3;
      g.append('line')
        .attr('x1', Math.cos(ang) * rIn)
        .attr('y1', Math.sin(ang) * rIn)
        .attr('x2', Math.cos(ang) * rOut)
        .attr('y2', Math.sin(ang) * rOut)
        .attr('stroke', msVal === 0 ? '#38bdf8' : '#64748b')
        .attr('stroke-width', msVal === 0 ? 2 : 1);

      const rLbl = radius + 16;
      g.append('text')
        .attr('x', Math.cos(ang) * rLbl)
        .attr('y', Math.sin(ang) * rLbl + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', '8.5px')
        .attr('font-family', 'monospace')
        .text(`${msVal > 0 ? '+' : ''}${msVal}`);
    });

    // Chronograph Needle for Current System Clock Drift
    const needleAng = angleScale(latestDriftMs) - Math.PI / 2;
    const needleColor =
      alertState === 'critical'
        ? '#f43f5e'
        : alertState === 'warning'
          ? '#f59e0b'
          : '#22d3ee';

    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', Math.cos(needleAng) * (radius - 16))
      .attr('y2', Math.sin(needleAng) * (radius - 16))
      .attr('stroke', needleColor)
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round');

    g.append('circle')
      .attr('r', 5)
      .attr('fill', needleColor)
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5);

    g.append('text')
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f8fafc')
      .attr('font-size', '14px')
      .attr('font-weight', '700')
      .attr('font-family', 'monospace')
      .text(`${latestDriftMs > 0 ? '+' : ''}${latestDriftMs} ms`);

    g.append('text')
      .attr('y', 42)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text('ÉCART NTS STRATUM-1');

    // Right side specifications inside dial SVG
    const rx = width * 0.68;
    const spec = svg.append('g').attr('transform', `translate(${rx},48)`);
    [
      { label: `Tolérance TAI64N : ±${SAFE_THRESHOLD_MS} ms`, color: '#10b981', y: 0 },
      { label: `Seuil Critique : ±${CRITICAL_THRESHOLD_MS} ms`, color: '#f43f5e', y: 26 },
      {
        label: `Fuseau Local : ${tzStatus.browserLabel}`,
        color: '#22d3ee',
        y: 52,
      },
      {
        label: `Sortie VPN : ${tzStatus.exitLabel}`,
        color: '#a78bfa',
        y: 78,
      },
      {
        label: `Gigue horloge : ${latest?.monotonicDeltaUs ?? 0} μs`,
        color: '#f59e0b',
        y: 104,
      },
    ].forEach((row) => {
      spec
        .append('rect')
        .attr('x', 0)
        .attr('y', row.y)
        .attr('width', 8)
        .attr('height', 8)
        .attr('rx', 2)
        .attr('fill', row.color);

      spec
        .append('text')
        .attr('x', 14)
        .attr('y', row.y + 7.5)
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(row.label);
    });
  }, [chartTab, svgWidth, latestDriftMs, alertState, tzStatus, latest?.monotonicDeltaUs]);

  return (
    <section
      id="chronographe-temporalite"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Chronographe de Temporalité (Dérive NTP &amp; Horloge D3.js)
            </h2>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className={`text-xs font-mono tabular-nums font-semibold ${
                alertState === 'critical'
                  ? 'text-rose-600 dark:text-rose-400'
                  : alertState === 'warning'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {latestDriftMs > 0 ? '+' : ''}
              {latestDriftMs} ms · Stratum {latest?.stratum ?? 1}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Surveillance de la dérive temporelle entre l’horloge système locale et le nœud de sortie ({currentIdentity.city}, {tzStatus.exitLabel}) pour prévenir la désynchronisation NTP/TAI64N.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setChartTab('chronogram')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                chartTab === 'chronogram'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Chronogramme
            </button>
            <button
              type="button"
              onClick={() => setChartTab('dial')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                chartTab === 'dial'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cadran Polaire
            </button>
          </div>

          <button
            type="button"
            onClick={handleSimulateDrift}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Tester le déclenchement d'alerte de désynchronisation NTP"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Tester Dérive</span>
          </button>

          <button
            type="button"
            onClick={handleResyncNts}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync NTS</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={
              isPaused ? 'Reprendre le chronographe' : 'Mettre en pause'
            }
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Alert Banner when NTP drift exceeds thresholds or protection disabled */}
        {alertState !== 'nominal' ? (
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              alertState === 'critical'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/70'
                : 'bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/60'
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              {alertState === 'critical' ? (
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div
                  className={`font-bold ${
                    alertState === 'critical'
                      ? 'text-rose-900 dark:text-rose-200'
                      : 'text-amber-900 dark:text-amber-200'
                  }`}
                >
                  {alertState === 'critical'
                    ? `Désynchronisation NTP critique (${latestDriftMs > 0 ? '+' : ''}${latestDriftMs} ms > ±${CRITICAL_THRESHOLD_MS} ms)`
                    : !settings.ntpDriftProtection
                      ? 'Protection NTP Drift désactivée (horloge exposée aux attaques par décalage)'
                      : `Dérive temporelle hors tolérance (${latestDriftMs > 0 ? '+' : ''}${latestDriftMs} ms > ±${SAFE_THRESHOLD_MS} ms)`}
                </div>
                <p
                  className={
                    alertState === 'critical'
                      ? 'text-rose-700 dark:text-rose-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }
                >
                  Un décalage supérieur à ±{SAFE_THRESHOLD_MS} ms fragilise la fenêtre anti-rejeu WireGuard TAI64N et expose l’horodatage des certificats.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResyncNts}
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resynchroniser NTS</span>
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Synchronisation temporelle nominale : dérive contenue dans la fenêtre de sécurité (±{SAFE_THRESHOLD_MS} ms) par rapport au nœud {currentIdentity.city}.
              </span>
            </div>
            <span className="font-mono tabular-nums text-[11px]">
              NTS RFC 8915 · {tzStatus.aligned ? 'Fuseau aligné' : 'Décalage fuseau'}
            </span>
          </div>
        )}

        {/* 4-Column Horological Telemetry Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Dérive Instantanée
            </div>
            <div
              className={`text-base font-bold tabular-nums ${
                alertState === 'critical'
                  ? 'text-rose-600 dark:text-rose-400'
                  : alertState === 'warning'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-cyan-600 dark:text-cyan-400'
              }`}
            >
              {latestDriftMs > 0 ? '+' : ''}
              {latestDriftMs} ms
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              Seuil ±{SAFE_THRESHOLD_MS} ms
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Stabilité Monotonique
            </div>
            <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
              {latest?.monotonicDeltaUs ?? 0} μs
            </div>
            <div className="text-[11px] text-slate-500">
              Horloge noyau POSIX
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Alignement Fuseau
            </div>
            <div
              className={`text-base font-bold ${
                tzStatus.aligned
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {tzStatus.aligned ? 'Synchronisé' : `Écart ${tzStatus.diffHours}h`}
            </div>
            <div className="text-[11px] text-slate-500">
              {tzStatus.browserLabel} → {tzStatus.exitLabel}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Protection NTP
            </div>
            <div
              className={`text-base font-bold ${
                settings.ntpDriftProtection
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {settings.ntpDriftProtection ? 'NTS Actif' : 'Non protégé'}
            </div>
            <div className="text-[11px] text-slate-500">
              Stratum {latest?.stratum ?? 1} · {mode}
            </div>
          </div>
        </div>

        {/* D3 Canvas */}
        <div
          ref={wrapperRef}
          className="relative w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                <span>Dérive horloge (ms)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                <span>Seuil ±{SAFE_THRESHOLD_MS} ms</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-rose-500 inline-block" />
                <span>Critique ±{CRITICAL_THRESHOLD_MS} ms</span>
              </span>
            </div>

            {hoveredSample && chartTab === 'chronogram' ? (
              <span className="text-cyan-300 tabular-nums">
                {hoveredSample.timeLabel} · Dérive{' '}
                {hoveredSample.driftMs > 0 ? '+' : ''}
                {hoveredSample.driftMs} ms · Gigue {hoveredSample.monotonicDeltaUs} μs
              </span>
            ) : (
              <span className="text-slate-500">
                Référence : {currentIdentity.city} ({currentIdentity.ip})
              </span>
            )}
          </div>

          {chartTab === 'chronogram' ? (
            <svg ref={chronoSvgRef} className="w-full h-[228px] block" />
          ) : (
            <svg ref={dialSvgRef} className="w-full h-[228px] block" />
          )}
        </div>
      </div>
    </section>
  );
};
