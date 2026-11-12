import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Radio,
  Activity,
  Zap,
  Sliders,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Play,
  Pause,
  Download,
  Info,
  Layers,
  Sparkles,
  Wifi,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { AppSettings, VirtualIdentity } from '../types';

export interface RadioSpectrumVisualizerProps {
  settings: AppSettings;
  currentIdentity?: VirtualIdentity;
  isConnected?: boolean;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
  className?: string;
}

export type SpectrumBand = 'wifi' | 'cellular' | 'tempest' | 'subghz';

interface FrequencyBin {
  freqMhz: number;
  powerDbm: number;
  peakHoldDbm: number;
}

const BANDS_CONFIG = {
  wifi: {
    label: 'Wi-Fi 2.4 & 5 GHz (802.11ax)',
    startFreq: 2400,
    endFreq: 2484,
    centerFreq: 2442,
    unit: 'MHz',
    nominalNoiseFloor: -98,
    carrierCenter: 2442,
    carrierWidth: 20,
    description: 'Surveillance des canaux Wi-Fi, fuites de trames balises (Beacons) et congestion RF locale.',
  },
  cellular: {
    label: 'Cellulaire 4G / 5G NR (Sub-6)',
    startFreq: 3400,
    endFreq: 3800,
    centerFreq: 3600,
    unit: 'MHz',
    nominalNoiseFloor: -102,
    carrierCenter: 3600,
    carrierWidth: 60,
    description: 'Analyse des ondes porteuses station de base (eNodeB / gNodeB) et détection d’IMSI-Catchers.',
  },
  tempest: {
    label: 'Émissions Parasites TEMPEST (Bus RAM & CPU)',
    startFreq: 10,
    endFreq: 450,
    centerFreq: 220,
    unit: 'MHz',
    nominalNoiseFloor: -110,
    carrierCenter: 133,
    carrierWidth: 15,
    description: 'Rayonnement électromagnétique compromettant émis par les cycles d’horloge mémoire et les rondes de chiffrement AEAD.',
  },
  subghz: {
    label: 'Bande Sub-GHz ISM (868 / 915 MHz)',
    startFreq: 860,
    endFreq: 880,
    centerFreq: 868,
    unit: 'MHz',
    nominalNoiseFloor: -105,
    carrierCenter: 868.3,
    carrierWidth: 2,
    description: 'Signaux télémétriques LoRa, balises radio et sondes d’interception passives.',
  },
};

export const RadioSpectrumVisualizer: React.FC<RadioSpectrumVisualizerProps> = ({
  settings,
  currentIdentity,
  isConnected = true,
  addLog,
  className = '',
}) => {
  const [selectedBand, setSelectedBand] = useState<SpectrumBand>('tempest');
  const [isPaused, setIsPaused] = useState(false);
  const [gainDb, setGainDb] = useState(24);
  const [showPeakHold, setShowPeakHold] = useState(true);
  const [showWaterfall, setShowWaterfall] = useState(true);
  const [isSimulatingTempestAttack, setIsSimulatingTempestAttack] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ freq: number; power: number; x: number; y: number } | null>(null);

  const binCount = 96;
  const binsRef = useRef<FrequencyBin[]>([]);
  const peakHoldRef = useRef<number[]>([]);
  const waterfallHistoryRef = useRef<number[][]>([]);
  const animFrameRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [svgDimensions, setSvgDimensions] = useState({ width: 700, height: 240 });

  const bandConfig = BANDS_CONFIG[selectedBand];

  // Initialize bins
  useEffect(() => {
    const { startFreq, endFreq, nominalNoiseFloor } = bandConfig;
    const step = (endFreq - startFreq) / (binCount - 1);
    binsRef.current = Array.from({ length: binCount }, (_, i) => ({
      freqMhz: Number((startFreq + i * step).toFixed(2)),
      powerDbm: nominalNoiseFloor + (Math.random() * 4 - 2),
      peakHoldDbm: nominalNoiseFloor,
    }));
    peakHoldRef.current = Array.from({ length: binCount }, () => nominalNoiseFloor);
    waterfallHistoryRef.current = [];
  }, [selectedBand, bandConfig]);

  // Handle responsive resize of the SVG container
  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current) {
        setSvgDimensions({
          width: svgRef.current.clientWidth || 700,
          height: 240,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Real-time smooth animation loop simulating RF physics
  useEffect(() => {
    if (isPaused) return;

    let time = 0;
    const { startFreq, endFreq, nominalNoiseFloor, carrierCenter, carrierWidth } = bandConfig;
    const step = (endFreq - startFreq) / (binCount - 1);

    const updatePhysics = () => {
      time += 0.05;
      const hasPadding = settings.trafficPaddingJitterMs > 0;
      const isChaCha = settings.protocol === 'wireguard';

      const currentBins: FrequencyBin[] = [];
      const newWaterfallRow: number[] = [];

      for (let i = 0; i < binCount; i++) {
        const freq = startFreq + i * step;

        // Base atmospheric thermal noise
        let power = nominalNoiseFloor + gainDb * 0.25;
        power += Math.sin(i * 0.4 + time * 2) * 2.5;
        power += (Math.random() - 0.5) * 4;

        // Active Connection Carrier Wave
        if (isConnected) {
          const distFromCarrier = Math.abs(freq - carrierCenter);
          if (distFromCarrier < carrierWidth) {
            const bell = Math.exp(-Math.pow(distFromCarrier / (carrierWidth * 0.4), 2));
            const signalBoost = 45 + Math.sin(time * 6) * 5;
            power += bell * signalBoost;
          }
        }

        // TEMPEST Cryptographic Clock Harmonics
        if (selectedBand === 'tempest') {
          // Bus clock leakage (133 MHz, 266 MHz, 400 MHz harmonics)
          [133, 266, 400].forEach((harmonic) => {
            const dist = Math.abs(freq - harmonic);
            if (dist < 8) {
              const spike = Math.exp(-Math.pow(dist / 3, 2)) * (hasPadding ? 14 : 32);
              power += spike;
            }
          });

          // Simulated exfiltration attack: distinct pulsed peak
          if (isSimulatingTempestAttack) {
            const dist = Math.abs(freq - 315);
            if (dist < 10) {
              const attackSpike = Math.exp(-Math.pow(dist / 4, 2)) * (48 + Math.sin(time * 12) * 10);
              power += attackSpike;
            }
          }

          // Anti-TEMPEST Chaff Brouillage Flattening
          if (hasPadding) {
            // Adds broadband pseudorandom dithering that hides distinct leakage peaks
            power += (Math.sin(freq * 1.8 + time * 8) * 8) - 4;
          }
        }

        // Clamp power between -125 dBm and -10 dBm
        power = Math.max(-125, Math.min(-15, power));

        // Peak Hold logic
        const prevPeak = peakHoldRef.current[i] ?? -125;
        const newPeak = Math.max(power, prevPeak - 0.15); // Slow decay
        peakHoldRef.current[i] = newPeak;

        currentBins.push({
          freqMhz: Number(freq.toFixed(2)),
          powerDbm: Number(power.toFixed(1)),
          peakHoldDbm: Number(newPeak.toFixed(1)),
        });

        newWaterfallRow.push(power);
      }

      binsRef.current = currentBins;

      // Update waterfall history (keep 24 recent rows)
      waterfallHistoryRef.current = [newWaterfallRow, ...waterfallHistoryRef.current.slice(0, 23)];

      animFrameRef.current = requestAnimationFrame(updatePhysics);
    };

    animFrameRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isPaused,
    selectedBand,
    bandConfig,
    gainDb,
    isConnected,
    settings.trafficPaddingJitterMs,
    settings.protocol,
    isSimulatingTempestAttack,
  ]);

  // Derived telemetry metrics
  const activeMetrics = useMemo(() => {
    const bins = binsRef.current;
    if (bins.length === 0) {
      return { peakDbm: -95, avgDbm: -100, snrDb: 18, tempestShielded: true };
    }
    const powers = bins.map((b) => b.powerDbm);
    const peakDbm = Math.max(...powers);
    const avgDbm = Number((powers.reduce((a, b) => a + b, 0) / powers.length).toFixed(1));
    const noiseFloor = bandConfig.nominalNoiseFloor;
    const snrDb = Math.max(0, Number((peakDbm - noiseFloor).toFixed(1)));
    const tempestShielded = settings.trafficPaddingJitterMs > 0;

    return { peakDbm, avgDbm, snrDb, tempestShielded };
  }, [bandConfig.nominalNoiseFloor, settings.trafficPaddingJitterMs]);

  // Generate SVG path points
  const { pathData, peakHoldPathData } = useMemo(() => {
    const bins = binsRef.current;
    if (bins.length === 0) return { pathData: '', peakHoldPathData: '' };

    const { width, height } = svgDimensions;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const minDbm = -120;
    const maxDbm = -20;

    const getX = (idx: number) => paddingLeft + (idx / (bins.length - 1)) * plotWidth;
    const getY = (dbm: number) => {
      const clamped = Math.max(minDbm, Math.min(maxDbm, dbm));
      const ratio = (clamped - minDbm) / (maxDbm - minDbm);
      return paddingTop + (1 - ratio) * plotHeight;
    };

    // Smooth curve path
    let d = `M ${getX(0)} ${getY(bins[0].powerDbm)}`;
    for (let i = 1; i < bins.length; i++) {
      const prevX = getX(i - 1);
      const prevY = getY(bins[i - 1].powerDbm);
      const curX = getX(i);
      const curY = getY(bins[i].powerDbm);
      const midX = (prevX + curX) / 2;
      d += ` Q ${prevX} ${prevY}, ${midX} ${(prevY + curY) / 2}`;
    }
    const lastX = getX(bins.length - 1);
    const lastY = getY(bins[bins.length - 1].powerDbm);
    d += ` L ${lastX} ${lastY}`;

    // Peak hold path
    let peakD = `M ${getX(0)} ${getY(bins[0].peakHoldDbm)}`;
    for (let i = 1; i < bins.length; i++) {
      peakD += ` L ${getX(i)} ${getY(bins[i].peakHoldDbm)}`;
    }

    return { pathData: d, peakHoldPathData: peakD };
  }, [svgDimensions]);

  // Closed polygon for the gradient fill under the spectrum curve
  const fillPathData = useMemo(() => {
    if (!pathData) return '';
    const { width, height } = svgDimensions;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingBottom = 30;
    const plotBottomY = height - paddingBottom;
    const lastX = width - paddingRight;

    return `${pathData} L ${lastX} ${plotBottomY} L ${paddingLeft} ${plotBottomY} Z`;
  }, [pathData, svgDimensions]);

  // Handle click on canvas / hover detection
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || binsRef.current.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const paddingLeft = 45;
    const paddingRight = 15;
    const plotWidth = svgDimensions.width - paddingLeft - paddingRight;

    if (mouseX < paddingLeft || mouseX > svgDimensions.width - paddingRight) {
      setHoveredPoint(null);
      return;
    }

    const ratio = (mouseX - paddingLeft) / plotWidth;
    const binIdx = Math.min(
      binsRef.current.length - 1,
      Math.max(0, Math.round(ratio * (binsRef.current.length - 1)))
    );
    const bin = binsRef.current[binIdx];

    setHoveredPoint({
      freq: bin.freqMhz,
      power: bin.powerDbm,
      x: mouseX,
      y: mouseY,
    });
  };

  const handleSimulateAttack = () => {
    setIsSimulatingTempestAttack(true);
    if (addLog) {
      addLog(
        '[TEMPEST] Simulation d’exfiltration par canal auxiliaire électromagnétique (315 MHz) lancée.',
        'warning'
      );
    }
    setTimeout(() => {
      setIsSimulatingTempestAttack(false);
      if (addLog) {
        addLog(
          '[TEMPEST] Simulation d’émission parasite terminée. Spectre RF stabilisé.',
          'info'
        );
      }
    }, 9000);
  };

  const handleExportData = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      band: selectedBand,
      bandConfig,
      metrics: activeMetrics,
      bins: binsRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rf-spectrum-${selectedBand}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedBand, bandConfig, activeMetrics]);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs relative overflow-hidden ${className}`}
    >
      {/* Background glow décoratif */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Visualiseur de Spectre Radio */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Visualiseur de Spectre Radio &amp; Bruit Électromagnétique
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300">
                DSP SDR · FFT 96 Bins
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  isPaused
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {isPaused ? 'Écoute Suspendue' : 'Balayage Live 60 FPS'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Modélisation spectrale en temps réel des émissions RF résiduelles, fuites TEMPEST du bus mémoire et bruit
              électromagnétique de la liaison réseau active.
            </p>
          </div>
        </div>

        {/* Contrôles d'animation & export */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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

          <button
            type="button"
            onClick={handleExportData}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exporter les données spectrales (JSON/IQ)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export IQ</span>
          </button>
        </div>
      </div>

      {/* Sélecteur de Bande RF */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(BANDS_CONFIG) as SpectrumBand[]).map((bKey) => {
            const b = BANDS_CONFIG[bKey];
            const isActive = selectedBand === bKey;
            return (
              <button
                key={bKey}
                type="button"
                onClick={() => setSelectedBand(bKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bouton de simulation TEMPEST */}
        <div className="flex items-center gap-2">
          {selectedBand === 'tempest' && (
            <button
              type="button"
              onClick={handleSimulateAttack}
              disabled={isSimulatingTempestAttack}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSimulatingTempestAttack
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isSimulatingTempestAttack ? 'Attaque en cours (315 MHz)...' : 'Simuler Fuite TEMPEST'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>Gain LNA :</span>
            <input
              type="range"
              min="0"
              max="45"
              value={gainDb}
              onChange={(e) => setGainDb(Number(e.target.value))}
              className="w-20 accent-purple-500 cursor-pointer"
            />
            <span className="font-bold text-slate-700 dark:text-slate-300">{gainDb} dB</span>
          </div>
        </div>
      </div>

      {/* Description de la bande */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 font-mono">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-500 shrink-0" />
          <span>{bandConfig.description}</span>
        </div>
        <div className="text-[11px] shrink-0 font-bold text-slate-700 dark:text-slate-300">
          Plage : {bandConfig.startFreq} – {bandConfig.endFreq} {bandConfig.unit}
        </div>
      </div>

      {/* =====================================================================
          GRAPHIQUE DU SPECTRE SVG FLUIDE
      ====================================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-500" />
            Courbe Spectrale FFT (Puissance en dBm vs Fréquence en {bandConfig.unit})
          </span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showPeakHold}
                onChange={(e) => setShowPeakHold(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Pic Max (Hold)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showWaterfall}
                onChange={(e) => setShowWaterfall(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Cascade (Waterfall)</span>
            </label>
          </div>
        </div>

        {/* SVG Container */}
        <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2 overflow-hidden shadow-2xl relative select-none">
          <svg
            ref={svgRef}
            className="w-full h-60 cursor-crosshair block"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              {/* Gradient pour l'aire spectrale */}
              <linearGradient id="spectrumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
              </linearGradient>

              {/* Filtre de lueur */}
              <filter id="spectrumGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Lignes de grille horizontales (dBm) */}
            {[-120, -100, -80, -60, -40, -20].map((dbm) => {
              const paddingTop = 20;
              const paddingBottom = 30;
              const plotHeight = svgDimensions.height - paddingTop - paddingBottom;
              const ratio = (dbm - -120) / 100;
              const y = paddingTop + (1 - ratio) * plotHeight;

              return (
                <g key={dbm}>
                  <line
                    x1="45"
                    y1={y}
                    x2={svgDimensions.width - 15}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray={dbm === -100 ? 'none' : '2,4'}
                  />
                  <text
                    x="40"
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {dbm}
                  </text>
                </g>
              );
            })}

            {/* Lignes de repères verticaux (Fréquence) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const paddingLeft = 45;
              const paddingRight = 15;
              const plotWidth = svgDimensions.width - paddingLeft - paddingRight;
              const x = paddingLeft + ratio * plotWidth;
              const freq = bandConfig.startFreq + ratio * (bandConfig.endFreq - bandConfig.startFreq);

              return (
                <g key={ratio}>
                  <line
                    x1={x}
                    y1="20"
                    x2={x}
                    y2={svgDimensions.height - 30}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="2,4"
                  />
                  <text
                    x={x}
                    y={svgDimensions.height - 12}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {freq.toFixed(0)} {bandConfig.unit}
                  </text>
                </g>
              );
            })}

            {/* Aire remplie sous la courbe */}
            {fillPathData && (
              <path d={fillPathData} fill="url(#spectrumGradient)" />
            )}

            {/* Courbe Pic Max (Hold) */}
            {showPeakHold && peakHoldPathData && (
              <path
                d={peakHoldPathData}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.6"
              />
            )}

            {/* Courbe Spectrale Principale */}
            {pathData && (
              <path
                d={pathData}
                fill="none"
                stroke="#c084fc"
                strokeWidth="2"
                filter="url(#spectrumGlow)"
              />
            )}

            {/* Point de repère interactif au survol */}
            {hoveredPoint && (
              <g>
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="4"
                  fill="#f43f5e"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <line
                  x1={hoveredPoint.x}
                  y1="20"
                  x2={hoveredPoint.x}
                  y2={svgDimensions.height - 30}
                  stroke="#f43f5e"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              </g>
            )}
          </svg>

          {/* Badge interactif au survol */}
          {hoveredPoint && (
            <div
              className="absolute top-4 right-4 bg-slate-900/90 border border-purple-500/40 rounded-xl px-3 py-1.5 text-[11px] font-mono text-white shadow-xl backdrop-blur-xs pointer-events-none"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-purple-400">
                  {hoveredPoint.freq} {bandConfig.unit}
                </span>
                <span className="text-slate-300">
                  Puissance : <b className="text-emerald-400">{hoveredPoint.power} dBm</b>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Cascade RF (Waterfall Spectrogram Display) */}
        {showWaterfall && waterfallHistoryRef.current.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>Spectrogramme Waterfall Temporel (Densité spectrale sur 24 tranches)</span>
              <span>Plus récent ↓</span>
            </div>
            <div className="w-full bg-slate-950 rounded-xl p-1.5 border border-slate-800 space-y-0.5 overflow-hidden">
              {waterfallHistoryRef.current.map((row, rowIdx) => (
                <div key={rowIdx} className="flex h-1.5 w-full gap-px">
                  {row.map((val, colIdx) => {
                    const norm = Math.max(0, Math.min(1, (val - -110) / 70));
                    // Color from deep navy to cyan to purple to bright yellow/red
                    const bg =
                      norm > 0.8
                        ? '#f43f5e'
                        : norm > 0.6
                        ? '#eab308'
                        : norm > 0.4
                        ? '#a855f7'
                        : norm > 0.2
                        ? '#06b6d4'
                        : '#0f172a';
                    return (
                      <div
                        key={colIdx}
                        className="flex-1"
                        style={{ backgroundColor: bg, opacity: 1 - rowIdx * 0.035 }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cartes de Télémétrie RF & Sécurité TEMPEST */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-1">
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold flex items-center justify-between">
            <span>PUISSANCE MAX</span>
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {activeMetrics.peakDbm} dBm
          </div>
          <div className="text-[10px] text-slate-500">Émission de crête détectée</div>
        </div>

        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 space-y-1">
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-between">
            <span>RAPPORT SNR</span>
            <Wifi className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            +{activeMetrics.snrDb} dB
          </div>
          <div className="text-[10px] text-slate-500">Marge signal / bruit thermique</div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between">
            <span>PLANCHER BRUIT</span>
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {bandConfig.nominalNoiseFloor} dBm
          </div>
          <div className="text-[10px] text-slate-500">Sensibilité récepteur SDR</div>
        </div>

        <div
          className={`p-3 rounded-xl border space-y-1 ${
            activeMetrics.tempestShielded
              ? 'bg-emerald-500/10 border-emerald-500/25'
              : 'bg-amber-500/10 border-amber-500/25'
          }`}
        >
          <div
            className={`text-[10px] font-bold flex items-center justify-between ${
              activeMetrics.tempestShielded
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            <span>BLINDAGE TEMPEST</span>
            {activeMetrics.tempestShielded ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {activeMetrics.tempestShielded ? 'Chaff Actif (40ms)' : 'Vulnérable'}
          </div>
          <div className="text-[10px] text-slate-500">
            {activeMetrics.tempestShielded
              ? 'Brouillage anti-side-channel'
              : 'Émissions parasites visibles'}
          </div>
        </div>
      </div>
    </div>
  );
};
