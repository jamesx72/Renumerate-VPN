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
  Pause,
  Play,
  Radio,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  SentinelRfSpectrumFrame,
  VirtualIdentity,
  WifiDirectBindingState,
} from '../types';

export interface SentinelNoiseGeneratorProps {
  isConnected: boolean;
  currentIdentity: VirtualIdentity;
  throughput: { up: number; down: number };
  settings: AppSettings;
  activeWifiBinding: WifiDirectBindingState | null;
  onApplyPatch: (patch: Partial<AppSettings>, reason?: string) => void;
  onSpectrumFrame?: (frame: SentinelRfSpectrumFrame) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type RfNoiseProfile = AppSettings['sentinelRfNoiseProfile'];

interface SubcarrierBin {
  idx: number;
  freqOffsetMhz: number;
  txSignalDbm: number;
  injectedNoiseDbm: number;
  effectiveFloorDbm: number;
  residualSnrDb: number;
}

interface SnrHistorySample {
  seq: number;
  timeLabel: string;
  unmaskedSnrDb: number;
  maskedSnrDb: number;
  noiseFloorDbm: number;
  maskingGainPct: number;
}

const SUBCARRIER_COUNT = 56;
const MAX_TIMELINE_POINTS = 30;
const PASSIVE_DETECTION_SNR_THRESHOLD_DB = 6.0;

function cryptoUnit(): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function resolveAdapterLabel(
  binding: WifiDirectBindingState | null,
  preferredId: string
): {
  iface: string;
  band: string;
  channel: number;
  centerFreqMhz: number;
  driverHint: string;
} {
  if (binding?.bound) {
    const centerFreqMhz =
      binding.band === '6 GHz'
        ? 5950 + binding.channel * 5
        : binding.channel <= 14
          ? 2407 + binding.channel * 5
          : 5000 + binding.channel * 5;
    return {
      iface: binding.ifaceName,
      band: binding.band,
      channel: binding.channel,
      centerFreqMhz,
      driverHint: binding.chipset,
    };
  }
  if (preferredId.includes('wlp3s0')) {
    return {
      iface: 'wlp3s0',
      band: '5 GHz',
      channel: 149,
      centerFreqMhz: 5745,
      driverHint: 'MediaTek MT7922',
    };
  }
  if (preferredId.includes('wlan1')) {
    return {
      iface: 'wlan1',
      band: '2.4/5 GHz',
      channel: 6,
      centerFreqMhz: 2437,
      driverHint: 'Alfa AWUS036AXM',
    };
  }
  return {
    iface: 'wlan0',
    band: '6 GHz',
    channel: 37,
    centerFreqMhz: 6135,
    driverHint: 'Intel Wi-Fi 6E AX210',
  };
}

function getProfileSpec(profile: RfNoiseProfile): {
  label: string;
  shortLabel: string;
  entropyBonus: number;
} {
  switch (profile) {
    case 'awgn':
      return {
        label: 'Bruit Blanc Gaussien (AWGN)',
        shortLabel: 'AWGN',
        entropyBonus: 0.9,
      };
    case 'fhss_burst':
      return {
        label: 'Sauts de Spectre FHSS + Leurres TX',
        shortLabel: 'FHSS Burst',
        entropyBonus: 1.55,
      };
    default:
      return {
        label: 'Dispersion OFDM Multi-Porteuses',
        shortLabel: 'OFDM Spread',
        entropyBonus: 1.25,
      };
  }
}

export const SentinelNoiseGenerator: React.FC<SentinelNoiseGeneratorProps> = ({
  isConnected,
  currentIdentity,
  throughput,
  settings,
  activeWifiBinding,
  onApplyPatch,
  onSpectrumFrame,
  addLog,
}) => {
  const noiseEnabled = settings.sentinelRfNoiseEnabled;
  const noiseProfile = settings.sentinelRfNoiseProfile;

  const [chartTab, setChartTab] = useState<'spectrum' | 'timeline'>('spectrum');
  const [targetNoiseFloorDbm, setTargetNoiseFloorDbm] = useState(-74);
  const [isPaused, setIsPaused] = useState(false);
  const [burstTicks, setBurstTicks] = useState(0);
  const [hoveredBin, setHoveredBin] = useState<SubcarrierBin | null>(null);
  const [hoveredSnr, setHoveredSnr] = useState<SnrHistorySample | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const spectrumSvgRef = useRef<SVGSVGElement | null>(null);
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState(720);

  const seqRef = useRef(0);
  const burstTicksRef = useRef(0);

  useEffect(() => {
    burstTicksRef.current = burstTicks;
  }, [burstTicks]);

  const adapterMeta = useMemo(
    () => resolveAdapterLabel(activeWifiBinding, settings.preferredWifiAdapterId),
    [activeWifiBinding, settings.preferredWifiAdapterId]
  );

  const generateSpectrumSnapshot = useCallback(
    (seq: number, isBurst = false): {
      bins: SubcarrierBin[];
      summary: SnrHistorySample;
    } => {
      const bins: SubcarrierBin[] = [];
      const activeLoadFactor = isConnected
        ? Math.min(1.3, 0.72 + (throughput.up + throughput.down) / 180)
        : 0.45;
      const thermalFloor = -95;
      const burstBoostDb = isBurst || burstTicksRef.current > 0 ? 7.5 : 0;

      let sumUnmaskedSnr = 0;
      let sumMaskedSnr = 0;
      let sumNoiseFloor = 0;

      for (let i = 0; i < SUBCARRIER_COUNT; i++) {
        const norm = (i / (SUBCARRIER_COUNT - 1)) * 2 - 1; // [-1, 1] across 40 MHz channel
        const freqOffsetMhz = Number((norm * 20).toFixed(1));
        const u0 = cryptoUnit();
        const u1 = cryptoUnit();

        // Realistic Wi-Fi OFDM TX spectral mask: strong central pilots + data subcarriers + roll-off at guard bands
        const pilotBoost = i % 7 === 0 ? 4.2 : 0;
        const channelEnvelope = Math.exp(-Math.pow(norm * 1.18, 2) * 1.9);
        const txSignalDbm = Number(
          Math.max(
            -92,
            Math.min(
              -52,
              -86 +
                24 * channelEnvelope * activeLoadFactor +
                pilotBoost +
                (u0 - 0.5) * 4.4
            )
          ).toFixed(1)
        );

        let injectedNoiseDbm = thermalFloor;
        if (noiseEnabled) {
          let shapeDb = 0;
          if (noiseProfile === 'awgn') {
            shapeDb = (u1 - 0.5) * 3.8;
          } else if (noiseProfile === 'ofdm_spread') {
            // Match & exceed the active OFDM TX lobe to flatten correlation ridges
            shapeDb = 6.5 * channelEnvelope + (u1 - 0.5) * 5.2;
          } else {
            // FHSS randomized hopping narrowband bursts across subcarriers
            const hopCenter = ((seq * 11) % SUBCARRIER_COUNT) / SUBCARRIER_COUNT * 2 - 1;
            const hopPeak = Math.exp(-Math.pow((norm - hopCenter) * 4.5, 2));
            shapeDb = 9.5 * hopPeak + (u1 - 0.5) * 6.5;
          }
          injectedNoiseDbm = Number(
            Math.max(
              -94,
              Math.min(-56, targetNoiseFloorDbm + shapeDb + burstBoostDb)
            ).toFixed(1)
          );
        }

        const effectiveFloorDbm = Math.max(thermalFloor, injectedNoiseDbm);
        const unmaskedSnr = Math.max(0, txSignalDbm - thermalFloor);
        const residualSnrDb = Number(
          Math.max(0.4, txSignalDbm - effectiveFloorDbm).toFixed(1)
        );

        sumUnmaskedSnr += unmaskedSnr;
        sumMaskedSnr += residualSnrDb;
        sumNoiseFloor += effectiveFloorDbm;

        bins.push({
          idx: i,
          freqOffsetMhz,
          txSignalDbm,
          injectedNoiseDbm,
          effectiveFloorDbm,
          residualSnrDb,
        });
      }

      const avgUnmasked = Number((sumUnmaskedSnr / SUBCARRIER_COUNT).toFixed(1));
      const avgMasked = Number((sumMaskedSnr / SUBCARRIER_COUNT).toFixed(1));
      const avgFloor = Number((sumNoiseFloor / SUBCARRIER_COUNT).toFixed(1));
      const maskingGainPct = noiseEnabled
        ? Math.max(
            0,
            Math.min(
              99,
              Math.round((1 - avgMasked / Math.max(1, avgUnmasked)) * 100)
            )
          )
        : 0;

      return {
        bins,
        summary: {
          seq,
          timeLabel: new Date().toLocaleTimeString('fr-FR', {
            hour12: false,
            minute: '2-digit',
            second: '2-digit',
          }),
          unmaskedSnrDb: avgUnmasked,
          maskedSnrDb: avgMasked,
          noiseFloorDbm: avgFloor,
          maskingGainPct,
        },
      };
    },
    [
      isConnected,
      throughput.up,
      throughput.down,
      noiseEnabled,
      noiseProfile,
      targetNoiseFloorDbm,
    ]
  );

  const [bins, setBins] = useState<SubcarrierBin[]>(
    () => generateSpectrumSnapshot(1, false).bins
  );
  const [snrHistory, setSnrHistory] = useState<SnrHistorySample[]>(() => {
    const arr: SnrHistorySample[] = [];
    for (let i = 0; i < 18; i++) {
      seqRef.current = i + 1;
      arr.push(generateSpectrumSnapshot(i + 1, false).summary);
    }
    return arr;
  });

  // Emit current spectrum frame whenever bins or noise parameters update
  useEffect(() => {
    if (!onSpectrumFrame || bins.length === 0 || snrHistory.length === 0) return;
    const latest = snrHistory[snrHistory.length - 1];
    onSpectrumFrame({
      seq: latest.seq,
      timestampMs: Date.now(),
      iface: adapterMeta.iface,
      band: adapterMeta.band,
      channel: adapterMeta.channel,
      centerFreqMhz: adapterMeta.centerFreqMhz,
      noiseEnabled,
      profile: noiseProfile,
      targetFloorDbm: targetNoiseFloorDbm,
      effectiveFloorDbm: latest.noiseFloorDbm,
      unmaskedSnrDb: latest.unmaskedSnrDb,
      maskedSnrDb: latest.maskedSnrDb,
      maskingGainPct: latest.maskingGainPct,
      isBurstActive: burstTicks > 0,
      bins,
    });
  }, [
    onSpectrumFrame,
    bins,
    snrHistory,
    adapterMeta.iface,
    adapterMeta.band,
    adapterMeta.channel,
    adapterMeta.centerFreqMhz,
    noiseEnabled,
    noiseProfile,
    targetNoiseFloorDbm,
    burstTicks,
  ]);

  // Periodic RF noise injection loop
  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      seqRef.current += 1;
      const snap = generateSpectrumSnapshot(seqRef.current, false);
      setBins(snap.bins);
      setSnrHistory((prev) => [
        ...prev.slice(-(MAX_TIMELINE_POINTS - 1)),
        snap.summary,
      ]);

      if (burstTicksRef.current > 0) {
        const nextBurst = Math.max(0, burstTicksRef.current - 1);
        burstTicksRef.current = nextBurst;
        setBurstTicks(nextBurst);
      }
    }, 900);

    return () => window.clearInterval(timer);
  }, [isPaused, generateSpectrumSnapshot]);

  // Immediate refresh when user toggles noise, changes profile, or drags noise floor slider
  useEffect(() => {
    seqRef.current += 1;
    const snap = generateSpectrumSnapshot(seqRef.current, false);
    setBins(snap.bins);
    setSnrHistory((prev) => [
      ...prev.slice(-(MAX_TIMELINE_POINTS - 1)),
      snap.summary,
    ]);
  }, [noiseEnabled, noiseProfile, targetNoiseFloorDbm, generateSpectrumSnapshot]);

  // Responsive container observer
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

  const latestSummary = snrHistory[snrHistory.length - 1];
  const profileSpec = getProfileSpec(noiseProfile);
  const spectralEntropyBits = useMemo(() => {
    if (!noiseEnabled) return 2.15;
    const powerRatio = Math.max(0, (targetNoiseFloorDbm + 95) / 33);
    return Number(
      Math.min(7.92, 4.4 + powerRatio * 2.1 + profileSpec.entropyBonus).toFixed(2)
    );
  }, [noiseEnabled, targetNoiseFloorDbm, profileSpec.entropyBonus]);

  const isProbeSafe =
    noiseEnabled &&
    (latestSummary?.maskedSnrDb ?? 0) <= PASSIVE_DETECTION_SNR_THRESHOLD_DB;

  const handleToggleNoise = useCallback(() => {
    const next = !noiseEnabled;
    onApplyPatch(
      { sentinelRfNoiseEnabled: next },
      next
        ? `Sentinel-IA Noise Generator activé sur ${adapterMeta.iface} (${profileSpec.shortLabel})`
        : `Sentinel-IA Noise Generator désactivé sur ${adapterMeta.iface}`
    );
    addLog?.(
      next
        ? `[Sentinel-IA Noise] Injection RF ${profileSpec.shortLabel} active sur ${adapterMeta.iface} (plancher ${targetNoiseFloorDbm} dBm)`
        : `[Sentinel-IA Noise] Injection RF suspendue — signature TX de ${adapterMeta.iface} exposée aux sondes passives`,
      next ? 'success' : 'warning',
      currentIdentity.ip
    );
  }, [
    noiseEnabled,
    onApplyPatch,
    adapterMeta.iface,
    profileSpec.shortLabel,
    targetNoiseFloorDbm,
    addLog,
    currentIdentity.ip,
  ]);

  const handleTriggerAntiProbeBurst = useCallback(() => {
    if (!noiseEnabled) {
      onApplyPatch(
        { sentinelRfNoiseEnabled: true },
        `Activation Sentinel-IA Noise Generator via rafale anti-sonde sur ${adapterMeta.iface}`
      );
    }
    burstTicksRef.current = 5;
    setBurstTicks(5);
    seqRef.current += 1;
    const snap = generateSpectrumSnapshot(seqRef.current, true);
    setBins(snap.bins);
    setSnrHistory((prev) => [
      ...prev.slice(-(MAX_TIMELINE_POINTS - 1)),
      snap.summary,
    ]);
    addLog?.(
      `[Sentinel-IA Noise] Rafale de brouillage RF injectée sur ${adapterMeta.iface} (${adapterMeta.band} Ch ${adapterMeta.channel}) · Gain masquage ${snap.summary.maskingGainPct}%`,
      'info',
      currentIdentity.ip
    );
  }, [
    noiseEnabled,
    onApplyPatch,
    adapterMeta.iface,
    adapterMeta.band,
    adapterMeta.channel,
    generateSpectrumSnapshot,
    addLog,
    currentIdentity.ip,
  ]);

  // =========================================================================
  // D3 CHART 1: OFDM Subcarrier RF Spectrum & Injected Noise Curtain
  // =========================================================================
  useEffect(() => {
    if (chartTab !== 'spectrum' || !spectrumSvgRef.current || bins.length === 0) {
      return;
    }

    const svg = d3.select(spectrumSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 240;
    const margin = { top: 22, right: 20, bottom: 28, left: 52 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(85, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([-20, 20]).range([0, innerW]);
    const y = d3.scaleLinear().domain([-100, -48]).range([innerH, 0]);

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
          .attr('stroke-opacity', 0.32)
          .attr('stroke-dasharray', '2,3')
      );

    // Thermal floor reference (-95 dBm)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(-95))
      .attr('y2', y(-95))
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // TX signal envelope (amber/rose)
    const txArea = d3
      .area<SubcarrierBin>()
      .x((d) => x(d.freqOffsetMhz))
      .y0(y(-100))
      .y1((d) => y(d.txSignalDbm))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bins)
      .attr('fill', noiseEnabled ? '#f59e0b' : '#f43f5e')
      .attr('fill-opacity', noiseEnabled ? 0.12 : 0.24)
      .attr('d', txArea);

    const txLine = d3
      .line<SubcarrierBin>()
      .x((d) => x(d.freqOffsetMhz))
      .y((d) => y(d.txSignalDbm))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bins)
      .attr('fill', 'none')
      .attr('stroke', noiseEnabled ? '#f59e0b' : '#fb7185')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', noiseEnabled ? '4,3' : 'none')
      .attr('d', txLine);

    // Injected RF noise curtain
    if (noiseEnabled) {
      const noiseArea = d3
        .area<SubcarrierBin>()
        .x((d) => x(d.freqOffsetMhz))
        .y0(y(-100))
        .y1((d) => y(d.injectedNoiseDbm))
        .curve(d3.curveBasis);

      g.append('path')
        .datum(bins)
        .attr('fill', '#22d3ee')
        .attr('fill-opacity', 0.22)
        .attr('d', noiseArea);

      const noiseLine = d3
        .line<SubcarrierBin>()
        .x((d) => x(d.freqOffsetMhz))
        .y((d) => y(d.injectedNoiseDbm))
        .curve(d3.curveBasis);

      g.append('path')
        .datum(bins)
        .attr('fill', 'none')
        .attr('stroke', '#22d3ee')
        .attr('stroke-width', 2)
        .attr('d', noiseLine);
    }

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(8)
          .tickFormat((d) => `${Number(d) > 0 ? '+' : ''}${d} MHz`)
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
          .tickFormat((d) => `${d} dBm`)
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
        label: `Bruit RF injecté (${adapterMeta.iface})`,
        color: noiseEnabled ? '#22d3ee' : '#475569',
        x: 0,
      },
      {
        label: 'Signature TX Wi-Fi',
        color: noiseEnabled ? '#f59e0b' : '#fb7185',
        x: 196,
      },
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

    // Hover focus
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
        const freqVal = x.invert(mx);
        const nearest = bins.reduce((best, cur) =>
          Math.abs(cur.freqOffsetMhz - freqVal) <
          Math.abs(best.freqOffsetMhz - freqVal)
            ? cur
            : best
        );
        focusLine
          .style('display', null)
          .attr('x1', x(nearest.freqOffsetMhz))
          .attr('x2', x(nearest.freqOffsetMhz));
        setHoveredBin(nearest);
      })
      .on('mouseleave', () => {
        focusLine.style('display', 'none');
        setHoveredBin(null);
      });
  }, [chartTab, bins, svgWidth, noiseEnabled, adapterMeta.iface]);

  // =========================================================================
  // D3 CHART 2: Passive Probe SNR Exposure Timeline
  // =========================================================================
  useEffect(() => {
    if (
      chartTab !== 'timeline' ||
      !timelineSvgRef.current ||
      snrHistory.length === 0
    ) {
      return;
    }

    const svg = d3.select(timelineSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 240;
    const margin = { top: 22, right: 20, bottom: 28, left: 48 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(85, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, snrHistory.length - 1)])
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([0, 32]).range([innerH, 0]);

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

    // Safe stealth threshold (<= 6 dB SNR)
    g.append('rect')
      .attr('x', 0)
      .attr('y', y(PASSIVE_DETECTION_SNR_THRESHOLD_DB))
      .attr('width', innerW)
      .attr(
        'height',
        Math.max(0, y(0) - y(PASSIVE_DETECTION_SNR_THRESHOLD_DB))
      )
      .attr('fill', '#10b981')
      .attr('opacity', 0.09);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(PASSIVE_DETECTION_SNR_THRESHOLD_DB))
      .attr('y2', y(PASSIVE_DETECTION_SNR_THRESHOLD_DB))
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', innerW - 4)
      .attr('y', y(PASSIVE_DETECTION_SNR_THRESHOLD_DB) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#34d399')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`Seuil détection sonde passive (${PASSIVE_DETECTION_SNR_THRESHOLD_DB} dB)`);

    // Unmasked baseline line
    const unmaskedLine = d3
      .line<SnrHistorySample>()
      .x((_, i) => x(i))
      .y((d) => y(d.unmaskedSnrDb))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(snrHistory)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3')
      .attr('d', unmaskedLine);

    // Effective masked SNR
    const maskedArea = d3
      .area<SnrHistorySample>()
      .x((_, i) => x(i))
      .y0(y(0))
      .y1((d) => y(d.maskedSnrDb))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(snrHistory)
      .attr('fill', isProbeSafe ? '#22d3ee' : '#f43f5e')
      .attr('fill-opacity', 0.2)
      .attr('d', maskedArea);

    const maskedLine = d3
      .line<SnrHistorySample>()
      .x((_, i) => x(i))
      .y((d) => y(d.maskedSnrDb))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(snrHistory)
      .attr('fill', 'none')
      .attr('stroke', isProbeSafe ? '#22d3ee' : '#fb7185')
      .attr('stroke-width', 2)
      .attr('d', maskedLine);

    const tickIdx = [
      0,
      Math.floor((snrHistory.length - 1) * 0.33),
      Math.floor((snrHistory.length - 1) * 0.66),
      snrHistory.length - 1,
    ];

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickIdx)
          .tickFormat((val) => snrHistory[Number(val)]?.timeLabel || '')
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
          .tickFormat((d) => `${d} dB`)
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
          snrHistory.length - 1,
          Math.max(0, Math.round(x.invert(mx)))
        );
        const pt = snrHistory[idx];
        if (!pt) return;
        focusLine
          .style('display', null)
          .attr('x1', x(idx))
          .attr('x2', x(idx));
        setHoveredSnr(pt);
      })
      .on('mouseleave', () => {
        focusLine.style('display', 'none');
        setHoveredSnr(null);
      });
  }, [chartTab, snrHistory, svgWidth, isProbeSafe]);

  return (
    <section
      id="sentinel-noise-generator"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Sentinel-IA Noise Generator (Brouillage RF Anti-Géolocalisation)
            </h2>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className={`text-xs font-mono tabular-nums font-semibold flex items-center gap-1 ${
                isProbeSafe
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isProbeSafe ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              <span>
                {noiseEnabled
                  ? `SNR sonde ${latestSummary?.maskedSnrDb ?? 0} dB`
                  : 'Signature TX exposée'}
              </span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Injection simulée de bruit radioélectrique sur la carte Wi-Fi{' '}
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {adapterMeta.iface}
            </span>{' '}
            ({adapterMeta.band} · Ch {adapterMeta.channel}) pour masquer l’empreinte TX aux sondes passives TDOA/RSSI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setChartTab('spectrum')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                chartTab === 'spectrum'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Spectre RF
            </button>
            <button
              type="button"
              onClick={() => setChartTab('timeline')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                chartTab === 'timeline'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Exposition SNR
            </button>
          </div>

          <button
            type="button"
            onClick={handleTriggerAntiProbeBurst}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Injecter une rafale de bruit radioélectrique haute entropie"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Rafale Anti-Sonde</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={isPaused ? 'Reprendre l’analyse RF' : 'Mettre en pause'}
            aria-label={isPaused ? 'Reprendre l’analyse RF' : 'Mettre en pause'}
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={noiseEnabled}
            aria-label="Activer l'injection de bruit RF sur la carte Wi-Fi"
            onClick={handleToggleNoise}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              noiseEnabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                noiseEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Modulation Profile & Noise Floor Controls */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
            Carte cible : {adapterMeta.iface} ({adapterMeta.driverHint})
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {(
              [
                { id: 'awgn', label: 'AWGN' },
                { id: 'ofdm_spread', label: 'OFDM Spread' },
                { id: 'fhss_burst', label: 'FHSS Burst' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onApplyPatch(
                    { sentinelRfNoiseProfile: p.id },
                    `Profil Sentinel-IA Noise défini sur ${p.label}`
                  )
                }
                className={`px-2 py-1 rounded text-[11px] font-mono font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  noiseProfile === p.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
            Plancher bruit :
          </span>
          <input
            type="range"
            min={-86}
            max={-62}
            step={1}
            value={targetNoiseFloorDbm}
            onChange={(e) => setTargetNoiseFloorDbm(Number(e.target.value))}
            disabled={!noiseEnabled}
            className="w-28 accent-cyan-600 cursor-pointer disabled:opacity-45"
            aria-label="Puissance du plancher de bruit RF injecté en dBm"
          />
          <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 w-16 text-right">
            {noiseEnabled ? `${targetNoiseFloorDbm} dBm` : '-95 dBm'}
          </span>
        </div>
      </div>

      {/* Key RF Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Plancher Bruit Effectif
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {latestSummary?.noiseFloorDbm ?? -95} dBm
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {profileSpec.shortLabel} · {adapterMeta.band}
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            SNR Résiduel Sonde Passive
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono tabular-nums ${
              isProbeSafe
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {latestSummary?.maskedSnrDb ?? 0} dB
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Sans bruit : {latestSummary?.unmaskedSnrDb ?? 0} dB
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Atténuation Signature TX
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {latestSummary?.maskingGainPct ?? 0}%
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Corrélation TDOA/RSSI brouillée
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Entropie Spectrale
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400">
            {spectralEntropyBits} b/sc
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {burstTicks > 0
              ? `Rafale active (${burstTicks} ticks)`
              : `${SUBCARRIER_COUNT} sous-porteuses`}
          </div>
        </div>
      </div>

      {/* D3 RF Spectrum / SNR Timeline */}
      <div className="p-4 sm:p-5 bg-slate-950">
        <div ref={containerRef} className="w-full relative">
          {chartTab === 'spectrum' ? (
            <svg
              ref={spectrumSvgRef}
              className="w-full h-[240px] block select-none"
              role="img"
              aria-label="Spectre radioélectrique D3.js du bruit simulé par Sentinel-IA sur la carte Wi-Fi active"
            />
          ) : (
            <svg
              ref={timelineSvgRef}
              className="w-full h-[240px] block select-none"
              role="img"
              aria-label="Chronologie D3.js de l'exposition SNR face aux sondes de géolocalisation passives"
            />
          )}

          <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400">
            {chartTab === 'spectrum' && hoveredBin ? (
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span>
                  Sous-porteuse #{hoveredBin.idx} (
                  {hoveredBin.freqOffsetMhz > 0 ? '+' : ''}
                  {hoveredBin.freqOffsetMhz} MHz)
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-amber-400">
                  TX {hoveredBin.txSignalDbm} dBm
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-cyan-400">
                  Bruit {hoveredBin.injectedNoiseDbm} dBm
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-emerald-400">
                  SNR résiduel {hoveredBin.residualSnrDb} dB
                </span>
              </div>
            ) : chartTab === 'timeline' && hoveredSnr ? (
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span>{hoveredSnr.timeLabel}</span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-cyan-400">
                  SNR masqué {hoveredSnr.maskedSnrDb} dB
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-amber-400">
                  Brut {hoveredSnr.unmaskedSnrDb} dB
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span>Gain {hoveredSnr.maskingGainPct}%</span>
              </div>
            ) : (
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  {chartTab === 'spectrum'
                    ? 'Survolez les sous-porteuses pour comparer puissance TX et bruit injecté.'
                    : 'Survolez la courbe pour vérifier le passage sous le seuil de détection passive.'}
                </span>
              </span>
            )}
            <span>
              {activeWifiBinding?.bound
                ? `Liaison directe : ${activeWifiBinding.ifaceName} (${activeWifiBinding.ssid})`
                : `Profil carte : ${adapterMeta.iface}`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
