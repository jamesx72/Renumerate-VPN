import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Radio,
  Activity,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Play,
  Pause,
  Download,
  Info,
  Wifi,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { AppSettings, VirtualIdentity } from '../types';

export interface ThroughputMetrics {
  up: number;
  down: number;
}

export interface RadioSpectrumVisualizerProps {
  settings: AppSettings;
  currentIdentity?: VirtualIdentity;
  isConnected?: boolean;
  throughput?: ThroughputMetrics;
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

interface BandDefinition {
  label: string;
  startFreq: number;
  endFreq: number;
  centerFreq: number;
  unit: string;
  nominalNoiseFloor: number;
  carrierCenter: number;
  carrierWidth: number;
  txSubcarrierFreq: number;
  description: string;
}

const BANDS_CONFIG: Record<SpectrumBand, BandDefinition> = {
  wifi: {
    label: 'Wi-Fi 2.4 & 5 GHz (802.11ax)',
    startFreq: 2400,
    endFreq: 2484,
    centerFreq: 2442,
    unit: 'MHz',
    nominalNoiseFloor: -98,
    carrierCenter: 2437,
    carrierWidth: 20,
    txSubcarrierFreq: 2462,
    description:
      'Surveillance des canaux Wi-Fi, sous-porteuses OFDM RX/TX et congestion électromagnétique locale.',
  },
  cellular: {
    label: 'Cellulaire 4G / 5G NR (Sub-6)',
    startFreq: 3400,
    endFreq: 3800,
    centerFreq: 3600,
    unit: 'MHz',
    nominalNoiseFloor: -102,
    carrierCenter: 3560,
    carrierWidth: 55,
    txSubcarrierFreq: 3710,
    description:
      'Analyse des porteuses station de base (eNodeB / gNodeB), enveloppes TDD RX/TX et détection d’IMSI-Catchers.',
  },
  tempest: {
    label: 'Émissions Parasites TEMPEST (Bus RAM & CPU)',
    startFreq: 10,
    endFreq: 450,
    centerFreq: 220,
    unit: 'MHz',
    nominalNoiseFloor: -110,
    carrierCenter: 133,
    carrierWidth: 16,
    txSubcarrierFreq: 295,
    description:
      'Rayonnement électromagnétique émis par les cycles d’horloge mémoire et la modulation AEAD corrélée au débit réseau.',
  },
  subghz: {
    label: 'Bande Sub-GHz ISM (868 / 915 MHz)',
    startFreq: 860,
    endFreq: 880,
    centerFreq: 868,
    unit: 'MHz',
    nominalNoiseFloor: -105,
    carrierCenter: 868.3,
    carrierWidth: 2.2,
    txSubcarrierFreq: 873.5,
    description:
      'Signaux télémétriques ISM, harmoniques d’horloge NIC et sondes RF passives à proximité.',
  },
};

const BIN_COUNT = 96;

function buildInitialBins(band: BandDefinition): FrequencyBin[] {
  const step = (band.endFreq - band.startFreq) / (BIN_COUNT - 1);
  return Array.from({ length: BIN_COUNT }, (_, i) => ({
    freqMhz: Number((band.startFreq + i * step).toFixed(2)),
    powerDbm: Number((band.nominalNoiseFloor + (Math.random() * 4 - 2)).toFixed(1)),
    peakHoldDbm: band.nominalNoiseFloor,
  }));
}

export const RadioSpectrumVisualizer: React.FC<RadioSpectrumVisualizerProps> = ({
  settings,
  currentIdentity,
  isConnected = true,
  throughput = { up: 0, down: 0 },
  addLog,
  className = '',
}) => {
  const [selectedBand, setSelectedBand] = useState<SpectrumBand>('tempest');
  const [isPaused, setIsPaused] = useState(false);
  const [gainDb, setGainDb] = useState(24);
  const [showPeakHold, setShowPeakHold] = useState(true);
  const [showWaterfall, setShowWaterfall] = useState(true);
  const [isSimulatingTempestAttack, setIsSimulatingTempestAttack] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    freq: number;
    power: number;
    x: number;
    y: number;
  } | null>(null);

  const bandConfig = BANDS_CONFIG[selectedBand];

  // Live reactive simulation state updated smoothly on animation frames (~30 FPS)
  const [bins, setBins] = useState<FrequencyBin[]>(() =>
    buildInitialBins(BANDS_CONFIG.tempest)
  );
  const [waterfallHistory, setWaterfallHistory] = useState<number[][]>([]);
  const [smoothedFlow, setSmoothedFlow] = useState<ThroughputMetrics>({
    up: throughput.up,
    down: throughput.down,
  });

  const peakHoldRef = useRef<number[]>(
    Array.from({ length: BIN_COUNT }, () => BANDS_CONFIG.tempest.nominalNoiseFloor)
  );
  const waterfallRef = useRef<number[][]>([]);
  const binsRef = useRef<FrequencyBin[]>(bins);

  // Refs for smooth interpolation without restarting animation loop on every throughput tick
  const throughputTargetRef = useRef<ThroughputMetrics>(throughput);
  const throughputSmoothRef = useRef<ThroughputMetrics>({
    up: throughput.up,
    down: throughput.down,
  });
  const settingsRef = useRef(settings);
  const isConnectedRef = useRef(isConnected);
  const gainDbRef = useRef(gainDb);
  const attackActiveRef = useRef(isSimulatingTempestAttack);
  const animFrameRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [svgDimensions, setSvgDimensions] = useState({ width: 700, height: 240 });

  useEffect(() => {
    throughputTargetRef.current = throughput;
  }, [throughput]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    gainDbRef.current = gainDb;
  }, [gainDb]);

  useEffect(() => {
    attackActiveRef.current = isSimulatingTempestAttack;
  }, [isSimulatingTempestAttack]);

  // Reset spectral buffers cleanly on band switch
  useEffect(() => {
    const initial = buildInitialBins(bandConfig);
    binsRef.current = initial;
    peakHoldRef.current = Array.from(
      { length: BIN_COUNT },
      () => bandConfig.nominalNoiseFloor
    );
    waterfallRef.current = [];
    setBins(initial);
    setWaterfallHistory([]);
  }, [bandConfig]);

  // Responsive SVG measurement via ResizeObserver + window resize fallback
  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current) {
        const w = svgRef.current.clientWidth;
        if (w > 0) {
          setSvgDimensions({ width: w, height: 240 });
        }
      }
    };
    updateSize();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && svgRef.current) {
      observer = new ResizeObserver(updateSize);
      observer.observe(svgRef.current);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Real-time continuous animation loop driven by actual throughput (up/down)
  useEffect(() => {
    if (isPaused) return;

    let phase = 0;
    let lastUiCommit = 0;
    let lastWaterfallPush = 0;
    let burstSeed = 0;
    const {
      startFreq,
      endFreq,
      nominalNoiseFloor,
      carrierCenter,
      carrierWidth,
      txSubcarrierFreq,
    } = bandConfig;
    const step = (endFreq - startFreq) / (BIN_COUNT - 1);

    const tick = (now: number) => {
      // Smooth exponential follower for real throughput metrics (up & down)
      const target = throughputTargetRef.current;
      const connected = isConnectedRef.current;
      const targetDown = connected ? Math.max(0, target.down) : 0;
      const targetUp = connected ? Math.max(0, target.up) : 0;

      const curSmooth = throughputSmoothRef.current;
      curSmooth.down += (targetDown - curSmooth.down) * 0.14;
      curSmooth.up += (targetUp - curSmooth.up) * 0.16;

      // Normalized activity factors [0..1+] from real network load
      const downNorm = Math.min(1.25, curSmooth.down / 55);
      const upNorm = Math.min(1.25, curSmooth.up / 3.8);
      const combinedLoad = Math.min(1.2, downNorm * 0.72 + upNorm * 0.28);

      // Speed of electromagnetic phase oscillation accelerates with traffic
      phase += 0.055 + combinedLoad * 0.085;
      burstSeed += 0.19 + upNorm * 0.35;

      // Commit UI frames at ~30 FPS (every 33ms) for buttery-smooth SVG without overhead
      if (now - lastUiCommit >= 33) {
        lastUiCommit = now;

        const curSettings = settingsRef.current;
        const currentGain = gainDbRef.current;
        const hasPadding = curSettings.trafficPaddingJitterMs > 0;
        const isChaCha = curSettings.protocol === 'wireguard';
        const isAttack = attackActiveRef.current;

        // Jitter & broadband noise floor rise slightly under heavy RX/TX load
        const emNoiseLift = combinedLoad * (hasPadding ? 4.5 : 10.5);
        const dynamicJitterAmp = 2.6 + combinedLoad * 5.2 + (hasPadding ? 2.4 : 0);

        const nextBins: FrequencyBin[] = [];
        const newWaterfallRow: number[] = [];

        for (let i = 0; i < BIN_COUNT; i++) {
          const freq = startFreq + i * step;

          // 1. Base thermal noise + LNA gain + throughput-induced broadband EMI lift
          let power = nominalNoiseFloor + currentGain * 0.24 + emNoiseLift;
          power +=
            Math.sin(i * 0.36 + phase * 1.9) * (2.0 + downNorm * 2.6) +
            Math.cos(i * 0.85 - burstSeed) * (1.1 + upNorm * 2.2);
          power += (Math.random() - 0.5) * dynamicJitterAmp;

          // 2. Downlink (RX) Main Carrier & OFDM Sidebands correlated to throughput.down
          if (connected) {
            const distFromRx = Math.abs(freq - carrierCenter);
            const activeWidth = carrierWidth * (0.75 + downNorm * 0.65);
            if (distFromRx < activeWidth * 1.6) {
              const bell = Math.exp(-Math.pow(distFromRx / (activeWidth * 0.45), 2));
              // Modulation ripple speeds up and deepens as down Mb/s climbs
              const qamRipple =
                Math.sin(phase * 4.5 + i * 0.65) * (2.2 + downNorm * 4.8) +
                Math.cos(phase * 8.2 - i * 1.1) * (downNorm * 2.4);
              const rxBoost = 16 + downNorm * 34 + qamRipple;
              power += bell * Math.max(4, rxBoost);

              // Orthogonal sub-carrier spurs proportional to throughput.down
              if (downNorm > 0.08) {
                const subLobe =
                  Math.abs(Math.sin(((freq - carrierCenter) / activeWidth) * Math.PI * 3)) *
                  downNorm *
                  7;
                power += bell * subLobe;
              }
            }

            // 3. Uplink (TX) Harmonic Subcarrier correlated to throughput.up
            const distFromTx = Math.abs(freq - txSubcarrierFreq);
            const txWidth = carrierWidth * (0.45 + upNorm * 0.35);
            if (distFromTx < txWidth * 1.8) {
              const txBell = Math.exp(-Math.pow(distFromTx / (txWidth * 0.42), 2));
              // Packet burst envelope driven by TX stream
              const txBurst =
                0.7 + 0.3 * Math.sin(burstSeed * 3.1 + Math.sin(phase * 2.2));
              const txBoost = (10 + upNorm * 32) * txBurst;
              power += txBell * txBoost;
            }
          }

          // 4. TEMPEST Bus Clock & AEAD Encryption Cycle Harmonics (intensified by throughput)
          if (selectedBand === 'tempest') {
            const cryptoMultiplier = isChaCha ? 0.92 : 1.18;
            const loadScale = connected ? 0.55 + combinedLoad * 0.95 : 0.35;
            [133, 266, 400].forEach((harmonic, idx) => {
              const dist = Math.abs(freq - harmonic);
              if (dist < 10) {
                const harmonicPulse =
                  1 + Math.sin(phase * (4 + idx * 2.3)) * (0.12 + upNorm * 0.25);
                const rawSpike =
                  Math.exp(-Math.pow(dist / 3.2, 2)) *
                  (hasPadding ? 11 : 28) *
                  loadScale *
                  cryptoMultiplier *
                  harmonicPulse;
                power += rawSpike;
              }
            });

            // Simulated Side-Channel Exfiltration Spike at 315 MHz
            if (isAttack) {
              const dist = Math.abs(freq - 315);
              if (dist < 11) {
                const attackSpike =
                  Math.exp(-Math.pow(dist / 4, 2)) *
                  (48 + Math.sin(phase * 9) * 11);
                power += attackSpike;
              }
            }

            // Anti-TEMPEST Chaff Padding masks throughput-correlated clock side-channels
            if (hasPadding) {
              const chaffStrength = Math.min(
                10,
                3 + curSettings.trafficPaddingJitterMs * 0.14
              );
              power +=
                Math.sin(freq * 1.9 + phase * 6.5) * chaffStrength +
                Math.cos(freq * 0.7 - phase * 4.2) * (chaffStrength * 0.5) -
                2.5;
            }
          }

          // 5. Broadband TX Switching Transient Ripple during high uplink peaks
          if (connected && upNorm > 0.15) {
            const transient =
              Math.pow(Math.max(0, Math.sin(i * 0.27 - burstSeed * 2.4)), 4) *
              upNorm *
              (hasPadding ? 3.5 : 7.5);
            power += transient;
          }

          power = Math.max(-125, Math.min(-15, power));

          const prevPeak = peakHoldRef.current[i] ?? nominalNoiseFloor;
          const newPeak = Math.max(power, prevPeak - 0.18);
          peakHoldRef.current[i] = newPeak;

          nextBins.push({
            freqMhz: Number(freq.toFixed(2)),
            powerDbm: Number(power.toFixed(1)),
            peakHoldDbm: Number(newPeak.toFixed(1)),
          });
          newWaterfallRow.push(power);
        }

        binsRef.current = nextBins;
        setBins(nextBins);
        setSmoothedFlow({
          up: Number(curSmooth.up.toFixed(2)),
          down: Number(curSmooth.down.toFixed(2)),
        });

        // Push waterfall spectrogram row every ~95ms for legible temporal scroll
        if (now - lastWaterfallPush >= 95) {
          lastWaterfallPush = now;
          waterfallRef.current = [
            newWaterfallRow,
            ...waterfallRef.current.slice(0, 23),
          ];
          setWaterfallHistory(waterfallRef.current);
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPaused, selectedBand, bandConfig]);

  // Derived telemetry metrics updated continuously with animated bins
  const activeMetrics = useMemo(() => {
    if (bins.length === 0) {
      return {
        peakDbm: -95,
        avgDbm: -100,
        snrDb: 18,
        tempestShielded: settings.trafficPaddingJitterMs > 0,
        emiIndex: 0,
      };
    }
    const powers = bins.map((b) => b.powerDbm);
    const peakDbm = Math.max(...powers);
    const avgDbm = Number(
      (powers.reduce((a, b) => a + b, 0) / powers.length).toFixed(1)
    );
    const noiseFloor = bandConfig.nominalNoiseFloor;
    const snrDb = Math.max(0, Number((peakDbm - noiseFloor).toFixed(1)));
    const tempestShielded = settings.trafficPaddingJitterMs > 0;
    const emiRaw =
      ((smoothedFlow.down / 60) * 0.65 + (smoothedFlow.up / 4) * 0.35) * 100;
    const emiIndex = isConnected
      ? Math.max(4, Math.min(100, Math.round(emiRaw)))
      : 0;

    return { peakDbm, avgDbm, snrDb, tempestShielded, emiIndex };
  }, [
    bins,
    bandConfig.nominalNoiseFloor,
    settings.trafficPaddingJitterMs,
    smoothedFlow.down,
    smoothedFlow.up,
    isConnected,
  ]);

  // Generate SVG curve paths & carrier markers
  const { pathData, peakHoldPathData, rxMarkerX, txMarkerX } = useMemo(() => {
    if (bins.length === 0) {
      return { pathData: '', peakHoldPathData: '', rxMarkerX: 0, txMarkerX: 0 };
    }

    const { width, height } = svgDimensions;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const minDbm = -120;
    const maxDbm = -20;

    const getX = (idx: number) =>
      paddingLeft + (idx / (bins.length - 1)) * plotWidth;
    const getY = (dbm: number) => {
      const clamped = Math.max(minDbm, Math.min(maxDbm, dbm));
      const ratio = (clamped - minDbm) / (maxDbm - minDbm);
      return paddingTop + (1 - ratio) * plotHeight;
    };

    const freqToX = (freq: number) => {
      const ratio =
        (freq - bandConfig.startFreq) /
        (bandConfig.endFreq - bandConfig.startFreq);
      return paddingLeft + Math.max(0, Math.min(1, ratio)) * plotWidth;
    };

    // Smooth quadratic Bezier curve
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

    let peakD = `M ${getX(0)} ${getY(bins[0].peakHoldDbm)}`;
    for (let i = 1; i < bins.length; i++) {
      peakD += ` L ${getX(i)} ${getY(bins[i].peakHoldDbm)}`;
    }

    return {
      pathData: d,
      peakHoldPathData: peakD,
      rxMarkerX: freqToX(bandConfig.carrierCenter),
      txMarkerX: freqToX(bandConfig.txSubcarrierFreq),
    };
  }, [bins, svgDimensions, bandConfig]);

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

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || bins.length === 0) return;
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
      bins.length - 1,
      Math.max(0, Math.round(ratio * (bins.length - 1)))
    );
    const bin = bins[binIdx];

    setHoveredPoint({
      freq: bin.freqMhz,
      power: bin.powerDbm,
      x: mouseX,
      y: mouseY,
    });
  };

  const handleSimulateAttack = () => {
    setIsSimulatingTempestAttack(true);
    addLog?.(
      '[TEMPEST] Simulation d’exfiltration par canal auxiliaire électromagnétique (315 MHz) lancée.',
      'warning'
    );
    setTimeout(() => {
      setIsSimulatingTempestAttack(false);
      addLog?.(
        '[TEMPEST] Simulation d’émission parasite terminée. Spectre RF stabilisé.',
        'info'
      );
    }, 9000);
  };

  const handleExportData = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      identityIp: currentIdentity?.ip,
      band: selectedBand,
      bandConfig,
      throughput,
      metrics: activeMetrics,
      bins: binsRef.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rf-spectrum-${selectedBand}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedBand, bandConfig, activeMetrics, throughput, currentIdentity?.ip]);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs relative overflow-hidden ${className}`}
    >
      {/* Header Visualiseur de Spectre Radio */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Visualiseur de Spectre Radio &amp; Bruit Électromagnétique
              </h2>
              <span className="text-xs font-mono text-purple-700 dark:text-purple-300 font-semibold">
                DSP SDR · FFT 96 Bins
              </span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span
                className={`text-xs font-semibold ${
                  isPaused
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isPaused ? 'Écoute Suspendue' : 'Balayage Corrélé au Débit'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Modélisation spectrale SVG en direct réagissant au débit réseau actuel (RX ↓ / TX ↑), aux harmoniques TEMPEST du bus mémoire et au chiffrement de session.
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

      {/* Live Throughput <-> EM Correlation Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs font-mono">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
            <span>Porteuse RX (Down)</span>
          </span>
          <span className="font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
            {isConnected ? `${smoothedFlow.down.toFixed(2)} Mb/s` : '0.00 Mb/s'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 sm:border-x sm:border-slate-200 dark:sm:border-slate-800 sm:px-3">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ArrowUp className="w-3.5 h-3.5 text-purple-500" />
            <span>Harmonique TX (Up)</span>
          </span>
          <span className="font-bold tabular-nums text-purple-600 dark:text-purple-400">
            {isConnected ? `${smoothedFlow.up.toFixed(2)} Mb/s` : '0.00 Mb/s'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400">
            Modulation EMI
          </span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-150"
                style={{ width: `${activeMetrics.emiIndex}%` }}
              />
            </div>
            <span className="font-bold tabular-nums text-slate-900 dark:text-white">
              {activeMetrics.emiIndex}%
            </span>
          </div>
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

        {/* Bouton de simulation TEMPEST & Gain LNA */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedBand === 'tempest' && (
            <button
              type="button"
              onClick={handleSimulateAttack}
              disabled={isSimulatingTempestAttack}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSimulatingTempestAttack
                  ? 'bg-rose-500 text-white'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {isSimulatingTempestAttack
                  ? 'Fuite simulée (315 MHz)...'
                  : 'Simuler Fuite TEMPEST'}
              </span>
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
            <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">
              {gainDb} dB
            </span>
          </div>
        </div>
      </div>

      {/* Description de la bande */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 font-mono">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-500 shrink-0" />
          <span>{bandConfig.description}</span>
        </div>
        <div className="text-[11px] shrink-0 font-bold tabular-nums text-slate-700 dark:text-slate-300">
          Plage : {bandConfig.startFreq} – {bandConfig.endFreq} {bandConfig.unit}
        </div>
      </div>

      {/* GRAPHIQUE DU SPECTRE SVG FLUIDE */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-semibold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-500" />
            <span>
              Courbe Spectrale FFT (Puissance dBm vs Fréquence en {bandConfig.unit})
            </span>
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
        <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2 overflow-hidden shadow-xl relative select-none">
          <svg
            ref={svgRef}
            className="w-full h-60 cursor-crosshair block"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="spectrumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="#c084fc"
                  stopOpacity={isConnected ? 0.45 + Math.min(0.25, activeMetrics.emiIndex / 300) : 0.25}
                />
                <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
              </linearGradient>

              <filter id="spectrumGlow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
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
              const freq =
                bandConfig.startFreq +
                ratio * (bandConfig.endFreq - bandConfig.startFreq);

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

            {/* Marqueurs Porteuse RX (Downlink) & TX (Uplink) */}
            {isConnected && rxMarkerX > 0 && (
              <g>
                <line
                  x1={rxMarkerX}
                  y1="22"
                  x2={rxMarkerX}
                  y2={svgDimensions.height - 30}
                  stroke="#06b6d4"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                  opacity="0.5"
                />
                <text
                  x={rxMarkerX + 4}
                  y="30"
                  fill="#22d3ee"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  RX ↓ {smoothedFlow.down.toFixed(1)} Mb/s
                </text>

                <line
                  x1={txMarkerX}
                  y1="22"
                  x2={txMarkerX}
                  y2={svgDimensions.height - 30}
                  stroke="#a855f7"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                  opacity="0.5"
                />
                <text
                  x={txMarkerX + 4}
                  y="42"
                  fill="#c084fc"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  TX ↑ {smoothedFlow.up.toFixed(2)} Mb/s
                </text>
              </g>
            )}

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
                opacity="0.65"
              />
            )}

            {/* Courbe Spectrale Principale */}
            {pathData && (
              <path
                d={pathData}
                fill="none"
                stroke={isSimulatingTempestAttack ? '#fb7185' : '#c084fc'}
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
            <div className="absolute top-4 right-4 bg-slate-900/90 border border-purple-500/40 rounded-xl px-3 py-1.5 text-[11px] font-mono text-white shadow-xl backdrop-blur-xs pointer-events-none">
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
        {showWaterfall && waterfallHistory.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>
                Spectrogramme Waterfall Temporel (Densité spectrale sur {waterfallHistory.length} tranches)
              </span>
              <span>Plus récent ↓</span>
            </div>
            <div className="w-full bg-slate-950 rounded-xl p-1.5 border border-slate-800 space-y-0.5 overflow-hidden">
              {waterfallHistory.map((row, rowIdx) => (
                <div key={rowIdx} className="flex h-1.5 w-full gap-px">
                  {row.map((val, colIdx) => {
                    const norm = Math.max(0, Math.min(1, (val - -110) / 70));
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
                        style={{
                          backgroundColor: bg,
                          opacity: Math.max(0.15, 1 - rowIdx * 0.035),
                        }}
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
          <div className="text-[10px] text-slate-500">
            Crête modulée par le débit
          </div>
        </div>

        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 space-y-1">
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-between">
            <span>RAPPORT SNR</span>
            <Wifi className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            +{activeMetrics.snrDb} dB
          </div>
          <div className="text-[10px] text-slate-500">
            Marge signal / bruit thermique
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between">
            <span>MOYENNE SPECTRALE</span>
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {activeMetrics.avgDbm} dBm
          </div>
          <div className="text-[10px] text-slate-500">
            Plancher nominal {bandConfig.nominalNoiseFloor} dBm
          </div>
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
            {activeMetrics.tempestShielded
              ? `Chaff Actif (${settings.trafficPaddingJitterMs}ms)`
              : 'Corrélation exposée'}
          </div>
          <div className="text-[10px] text-slate-500">
            {activeMetrics.tempestShielded
              ? 'Masquage du débit RX/TX'
              : 'Harmoniques corrélées au trafic'}
          </div>
        </div>
      </div>
    </div>
  );
};
