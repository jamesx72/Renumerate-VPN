import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Pause,
  Play,
  Download,
  ArrowDown,
  ArrowUp,
  Activity,
  Gauge,
  ShieldCheck,
  Lock,
  Fingerprint,
} from 'lucide-react';
import { AppSettings, ConnectionMode } from '../types';
import { computeSettingsHardeningScore } from '../constants';

interface TelemetryPoint {
  time: string;
  download: number;
  upload: number;
  latency: number;
  jitter: number;
}

interface TrafficMonitorProps {
  isDark: boolean;
  isConnected?: boolean;
  isEmergency?: boolean;
  throughput?: { up: number; down: number };
  baseLatency?: number;
  mode?: ConnectionMode;
}

function createInitialSeries(count: number, baseLatency: number): TelemetryPoint[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, idx) => {
    const t = new Date(now - (count - 1 - idx) * 2000);
    return {
      time: t.toLocaleTimeString('fr-FR', {
        minute: '2-digit',
        second: '2-digit',
      }),
      download: 0,
      upload: 0,
      latency: baseLatency,
      jitter: 0,
    };
  });
}

export const TrafficMonitor: React.FC<TrafficMonitorProps> = ({
  isDark,
  isConnected = false,
  isEmergency = false,
  throughput = { up: 0, down: 0 },
  baseLatency = 18,
  mode = ConnectionMode.STANDARD,
}) => {
  const [metricView, setMetricView] = useState<'bandwidth' | 'latency'>('bandwidth');
  const [windowSize, setWindowSize] = useState<15 | 30>(30);
  const [isPaused, setIsPaused] = useState(false);
  const [series, setSeries] = useState<TelemetryPoint[]>(() =>
    createInitialSeries(30, baseLatency)
  );
  const [totalsMB, setTotalsMB] = useState<{ down: number; up: number; peakDown: number }>({
    down: 0,
    up: 0,
    peakDown: 0,
  });

  useEffect(() => {
    if (isPaused) return;

    const tick = () => {
      const nowLabel = new Date().toLocaleTimeString('fr-FR', {
        minute: '2-digit',
        second: '2-digit',
      });

      const active = isConnected && !isEmergency;
      const modeLatencyFactor =
        mode === ConnectionMode.ONION_VORTEX
          ? 2.1
          : mode === ConnectionMode.DOUBLE_HOP
            ? 1.45
            : 1.0;

      const downVal = active
        ? Math.max(0.2, Number((throughput.down + (Math.random() * 3.2 - 1.6)).toFixed(2)))
        : 0;
      const upVal = active
        ? Math.max(0.1, Number((throughput.up + (Math.random() * 0.6 - 0.3)).toFixed(2)))
        : 0;

      const jitterVal = active
        ? Number((Math.random() * (mode === ConnectionMode.ONION_VORTEX ? 6.5 : 2.8) + 0.4).toFixed(1))
        : 0;
      const rttVal = active
        ? Math.round(baseLatency * modeLatencyFactor + jitterVal)
        : 0;

      setSeries((prev) => {
        const next = [
          ...prev,
          {
            time: nowLabel,
            download: downVal,
            upload: upVal,
            latency: rttVal,
            jitter: jitterVal,
          },
        ];
        return next.slice(-30);
      });

      if (active) {
        // 2-second interval: Mb/s * 2s / 8 bits = Mo transferred in 2s
        const deltaDownMB = (downVal * 2) / 8;
        const deltaUpMB = (upVal * 2) / 8;
        setTotalsMB((prev) => ({
          down: prev.down + deltaDownMB,
          up: prev.up + deltaUpMB,
          peakDown: Math.max(prev.peakDown, downVal),
        }));
      }
    };

    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [isConnected, isEmergency, throughput.down, throughput.up, baseLatency, mode, isPaused]);

  const visibleSeries = useMemo(
    () => series.slice(-windowSize),
    [series, windowSize]
  );

  const avgJitter = useMemo(() => {
    const activePoints = visibleSeries.filter((p) => p.jitter > 0);
    if (activePoints.length === 0) return 0;
    const sum = activePoints.reduce((acc, p) => acc + p.jitter, 0);
    return Number((sum / activePoints.length).toFixed(1));
  }, [visibleSeries]);

  const latestPoint = visibleSeries[visibleSeries.length - 1] || {
    download: 0,
    upload: 0,
    latency: 0,
    jitter: 0,
  };

  const handleExportCsv = () => {
    const header = 'Horodatage,Reception_Mbps,Emission_Mbps,Latence_ms,Gigue_ms';
    const rows = visibleSeries.map(
      (pt) => `${pt.time},${pt.download},${pt.upload},${pt.latency},${pt.jitter}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-telemetrie-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70">
          <button
            type="button"
            onClick={() => setMetricView('bandwidth')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              metricView === 'bandwidth'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Débit (Mb/s)
          </button>
          <button
            type="button"
            onClick={() => setMetricView('latency')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              metricView === 'latency'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Latence &amp; Gigue (ms)
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono tabular-nums">
            {([15, 30] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindowSize(w)}
                className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  windowSize === w
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {w * 2}s
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            title={isPaused ? 'Reprendre le flux temps réel' : 'Figer le graphique'}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              isPaused
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            title="Exporter la série télémétrique (CSV)"
            className="p-1.5 rounded-lg border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Réception</span>
            <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="mt-1 font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white">
            {isConnected && !isEmergency ? latestPoint.download.toFixed(2) : '0.00'}{' '}
            <span className="text-xs font-normal text-slate-500">Mb/s</span>
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            Cumul : {totalsMB.down.toFixed(1)} Mo
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Émission</span>
            <ArrowUp className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="mt-1 font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white">
            {isConnected && !isEmergency ? latestPoint.upload.toFixed(2) : '0.00'}{' '}
            <span className="text-xs font-normal text-slate-500">Mb/s</span>
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            Cumul : {totalsMB.up.toFixed(1)} Mo
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Crête session</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-1 font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white">
            {totalsMB.peakDown.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">Mb/s</span>
          </div>
          <div className="text-[10px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
            Perte : 0.00%
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Latence / Gigue</span>
            <Activity className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-1 font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white">
            {isConnected && !isEmergency ? `${latestPoint.latency} ms` : '—'}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            Gigue moy. : ±{avgJitter} ms
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="w-full h-52 min-h-[208px] rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 p-3 relative overflow-hidden">
        {!isConnected || isEmergency ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/75 dark:bg-slate-950/75 backdrop-blur-[2px] text-center px-4">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {isEmergency
                ? 'Coupe-circuit actif — interfaces réseau verrouillées'
                : 'Tunnel en veille — aucun trafic chiffré en transit'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Activez le tunnel VPN pour visualiser le débit et la gigue en temps réel.
            </span>
          </div>
        ) : null}

        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={184}>
          <AreaChart data={visibleSeries} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="gradDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradLatency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradJitter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? '#1e293b' : '#e2e8f0'}
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
                color: isDark ? '#f8fafc' : '#0f172a',
                borderRadius: '12px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
            {metricView === 'bandwidth' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="download"
                  name="Réception (Mb/s)"
                  stroke="#06b6d4"
                  fillOpacity={1}
                  fill="url(#gradDown)"
                  strokeWidth={2.2}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="upload"
                  name="Émission (Mb/s)"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#gradUp)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="latency"
                  name="Latence RTT (ms)"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#gradLatency)"
                  strokeWidth={2.2}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="jitter"
                  name="Gigue (ms)"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#gradJitter)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface AnonymityScoreProps {
  score: number;
  isDark: boolean;
  isConnected?: boolean;
  settings?: AppSettings;
}

export const AnonymityScore: React.FC<AnonymityScoreProps> = ({
  score,
  isDark,
  isConnected = false,
  settings,
}) => {
  const hardeningScore = settings ? computeSettingsHardeningScore(settings) : 75;
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  const shieldPillars = useMemo(() => {
    const leakScore = settings
      ? [
          settings.dnsLeakProtection,
          settings.ipv6LeakProtection,
          settings.webrtcLeakShield,
          settings.killSwitch,
        ].filter(Boolean).length * 25
      : 75;

    const morphScore = settings
      ? Math.min(
          100,
          40 +
            (settings.obfuscationLevel === 'ultra'
              ? 30
              : settings.obfuscationLevel === 'high'
                ? 20
                : 10) +
            (settings.fingerprintProtection.canvasNoise ? 15 : 0) +
            (settings.fingerprintProtection.webglMask ? 15 : 0)
        )
      : 70;

    return [
      {
        label: 'Chiffrement tunnel',
        value: isConnected ? 100 : 0,
        icon: Lock,
      },
      {
        label: 'Boucliers anti-fuite',
        value: leakScore,
        icon: ShieldCheck,
      },
      {
        label: 'Masquage empreinte',
        value: morphScore,
        icon: Fingerprint,
      },
    ];
  }, [isConnected, settings]);

  const strokeColor =
    clampedScore >= 80 ? '#10b981' : clampedScore >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="w-full flex flex-col items-center justify-between gap-5">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
          <circle
            cx="72"
            cy="72"
            r="60"
            stroke={isDark ? '#1e293b' : '#e2e8f0'}
            strokeWidth="9"
            fill="transparent"
          />
          <circle
            cx="72"
            cy="72"
            r="60"
            stroke={strokeColor}
            strokeWidth="9"
            fill="transparent"
            strokeDasharray={376.99}
            strokeDashoffset={376.99 - (376.99 * clampedScore) / 100}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
            {clampedScore}
          </span>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            / 100
          </span>
        </div>
      </div>

      <div className="text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            clampedScore >= 80
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
              : clampedScore >= 50
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              clampedScore >= 80
                ? 'bg-emerald-500'
                : clampedScore >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
          />
          {clampedScore >= 80
            ? 'Anonymat optimal'
            : clampedScore >= 50
              ? 'Protection partielle'
              : isConnected
                ? 'Surface exposée'
                : 'Tunnel hors ligne'}
        </span>
        <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
          Durcissement config : {hardeningScore}%
        </p>
      </div>

      {/* Posture Sub-Bars */}
      <div className="w-full space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        {shieldPillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div key={pillar.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  <Icon className="w-3.5 h-3.5 text-cyan-500" />
                  {pillar.label}
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {pillar.value}%
                </span>
              </div>
              <svg className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 block">
                <rect
                  x="0"
                  y="0"
                  width={`${pillar.value}%`}
                  height="100%"
                  rx="3"
                  fill={
                    pillar.value >= 80
                      ? '#10b981'
                      : pillar.value >= 50
                        ? '#06b6d4'
                        : '#94a3b8'
                  }
                />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
};
