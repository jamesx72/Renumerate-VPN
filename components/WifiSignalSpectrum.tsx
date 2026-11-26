import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import {
  Activity,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AppSettings,
  SentinelRfSpectrumFrame,
  SentinelRfSubcarrierBin,
  WifiDirectBindingState,
} from '../types';

export interface WifiSignalSpectrumProps {
  frame: SentinelRfSpectrumFrame | null;
  settings: AppSettings;
  isConnected: boolean;
  activeWifiBinding: WifiDirectBindingState | null;
  onApplyPatch: (patch: Partial<AppSettings>, reason?: string) => void;
  onJumpToGenerator?: () => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

const MAX_WATERFALL_ROWS = 22;
const MAX_HISTORY_BUFFER = 48;
const PASSIVE_PROBE_SNR_LIMIT_DB = 6.0;

function formatSampleClock(timestampMs: number): string {
  try {
    return new Date(timestampMs).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

export const WifiSignalSpectrum: React.FC<WifiSignalSpectrumProps> = ({
  frame,
  settings,
  isConnected,
  activeWifiBinding,
  onApplyPatch,
  onJumpToGenerator,
  addLog,
}) => {
  const [viewMode, setViewMode] = useState<'fft' | 'waterfall' | 'snr'>('fft');
  const [showPeakHold, setShowPeakHold] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [exportedTrace, setExportedTrace] = useState(false);
  const [hoveredBin, setHoveredBin] =
    useState<SentinelRfSubcarrierBin | null>(null);
  const [hoveredSnrIndex, setHoveredSnrIndex] = useState<number | null>(null);
  const [historyBuffer, setHistoryBuffer] = useState<SentinelRfSpectrumFrame[]>(
    []
  );
  const [peakHoldFloor, setPeakHoldFloor] = useState<number[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fftSvgRef = useRef<SVGSVGElement | null>(null);
  const waterfallSvgRef = useRef<SVGSVGElement | null>(null);
  const snrSvgRef = useRef<SVGSVGElement | null>(null);
  const [svgWidth, setSvgWidth] = useState(720);

  // Record bounded rolling history buffer & Peak-Hold envelope while live
  useEffect(() => {
    if (!frame || isFrozen) return;

    setHistoryBuffer((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].seq === frame.seq) {
        return prev;
      }
      const next = [...prev, frame];
      if (next.length > MAX_HISTORY_BUFFER) {
        return next.slice(next.length - MAX_HISTORY_BUFFER);
      }
      return next;
    });

    setPeakHoldFloor((prev) => {
      if (prev.length !== frame.bins.length) {
        return frame.bins.map((b) => b.effectiveFloorDbm);
      }
      return frame.bins.map((b, idx) =>
        Math.max(
          prev[idx] * 0.992 + b.effectiveFloorDbm * 0.008,
          b.effectiveFloorDbm
        )
      );
    });
  }, [frame, isFrozen]);

  // Keep pinned historical seq valid if older samples roll out of the buffer
  const selectedIndex = useMemo(() => {
    if (historyBuffer.length === 0) return 0;
    if (selectedSeq === null) return historyBuffer.length - 1;
    const idx = historyBuffer.findIndex((item) => item.seq === selectedSeq);
    return idx >= 0 ? idx : 0;
  }, [historyBuffer, selectedSeq]);

  useEffect(() => {
    if (selectedSeq === null || historyBuffer.length === 0) return;
    const stillPresent = historyBuffer.some((item) => item.seq === selectedSeq);
    if (!stillPresent) {
      setSelectedSeq(historyBuffer[0].seq);
    }
  }, [historyBuffer, selectedSeq]);

  const activeFrame = useMemo(() => {
    if (historyBuffer.length === 0) return frame;
    if (selectedSeq === null) {
      return isFrozen
        ? historyBuffer[historyBuffer.length - 1]
        : (frame ?? historyBuffer[historyBuffer.length - 1]);
    }
    return historyBuffer[selectedIndex] ?? frame;
  }, [historyBuffer, selectedSeq, selectedIndex, isFrozen, frame]);

  const isScrubbingHistorical =
    selectedSeq !== null &&
    historyBuffer.length > 0 &&
    selectedIndex < historyBuffer.length - 1;

  const waterfallRows = useMemo(() => {
    if (historyBuffer.length === 0) return [];
    if (
      selectedSeq === null ||
      selectedIndex >= historyBuffer.length - MAX_WATERFALL_ROWS
    ) {
      return historyBuffer.slice(-MAX_WATERFALL_ROWS);
    }
    const half = Math.floor(MAX_WATERFALL_ROWS / 2);
    const start = Math.max(
      0,
      Math.min(
        selectedIndex - half,
        historyBuffer.length - MAX_WATERFALL_ROWS
      )
    );
    return historyBuffer.slice(start, start + MAX_WATERFALL_ROWS);
  }, [historyBuffer, selectedSeq, selectedIndex]);

  // Responsive container width observer
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

  const validationStats = useMemo(() => {
    if (!activeFrame || activeFrame.bins.length === 0) {
      return {
        maskedBinsCount: 0,
        totalBins: 0,
        maskedBinsPct: 0,
        avgTxDbm: -80,
        peakTxDbm: -68,
        marginDb: 0,
        avgSnrDb: 0,
        peakSnrDb: 0,
        snrReductionDb: 0,
        snrGaugePct: 0,
        snrQualityTier: 'idle' as 'optimal' | 'moderate' | 'exposed' | 'idle',
        snrQualityLabel: 'En attente',
        verdict: 'idle' as 'validated' | 'partial' | 'exposed' | 'idle',
      };
    }

    const totalBins = activeFrame.bins.length;
    const maskedBinsCount = activeFrame.bins.filter(
      (b) => b.residualSnrDb <= PASSIVE_PROBE_SNR_LIMIT_DB
    ).length;
    const maskedBinsPct = Math.round((maskedBinsCount / totalBins) * 100);
    const avgTxDbm = Number(
      (
        activeFrame.bins.reduce((sum, b) => sum + b.txSignalDbm, 0) / totalBins
      ).toFixed(1)
    );
    const peakTxDbm = Number(
      Math.max(...activeFrame.bins.map((b) => b.txSignalDbm)).toFixed(1)
    );
    const marginDb = Number(
      (activeFrame.effectiveFloorDbm - avgTxDbm).toFixed(1)
    );

    const avgSnrDb = Number(
      (
        activeFrame.bins.reduce((sum, b) => sum + b.residualSnrDb, 0) / totalBins
      ).toFixed(1)
    );
    const peakSnrDb = Number(
      Math.max(...activeFrame.bins.map((b) => b.residualSnrDb)).toFixed(1)
    );
    const snrReductionDb = Number(
      Math.max(0, activeFrame.unmaskedSnrDb - avgSnrDb).toFixed(1)
    );
    const snrGaugePct = Math.round(
      Math.max(0, Math.min(100, (avgSnrDb / 24) * 100))
    );

    const snrQualityTier: 'optimal' | 'moderate' | 'exposed' =
      !activeFrame.noiseEnabled || avgSnrDb > 10.0
        ? 'exposed'
        : avgSnrDb <= PASSIVE_PROBE_SNR_LIMIT_DB
          ? 'optimal'
          : 'moderate';

    const snrQualityLabel =
      snrQualityTier === 'optimal'
        ? 'Optimal'
        : snrQualityTier === 'moderate'
          ? 'Modéré'
          : 'Exposé';

    const verdict: 'validated' | 'partial' | 'exposed' =
      !activeFrame.noiseEnabled
        ? 'exposed'
        : maskedBinsPct >= 85
          ? 'validated'
          : maskedBinsPct >= 45
            ? 'partial'
            : 'exposed';

    return {
      maskedBinsCount,
      totalBins,
      maskedBinsPct,
      avgTxDbm,
      peakTxDbm,
      marginDb,
      avgSnrDb,
      peakSnrDb,
      snrReductionDb,
      snrGaugePct,
      snrQualityTier,
      snrQualityLabel,
      verdict,
    };
  }, [activeFrame]);

  const handleToggleFreeze = () => {
    if (!isFrozen) {
      if (selectedSeq === null && historyBuffer.length > 0) {
        setSelectedSeq(historyBuffer[historyBuffer.length - 1].seq);
      }
      setIsFrozen(true);
    } else {
      setIsFrozen(false);
      setSelectedSeq(null);
    }
  };

  const handleScrubToIndex = (index: number) => {
    if (historyBuffer.length === 0) return;
    const clamped = Math.max(0, Math.min(historyBuffer.length - 1, index));
    if (clamped === historyBuffer.length - 1 && !isFrozen) {
      setSelectedSeq(null);
    } else {
      setSelectedSeq(historyBuffer[clamped].seq);
    }
  };

  const handleStepBack = () => {
    if (historyBuffer.length === 0) return;
    const target = Math.max(0, selectedIndex - 1);
    setSelectedSeq(historyBuffer[target].seq);
  };

  const handleStepForward = () => {
    if (historyBuffer.length === 0) return;
    const target = Math.min(historyBuffer.length - 1, selectedIndex + 1);
    if (target === historyBuffer.length - 1 && !isFrozen) {
      setSelectedSeq(null);
    } else {
      setSelectedSeq(historyBuffer[target].seq);
    }
  };

  const handleReturnLive = () => {
    setIsFrozen(false);
    setSelectedSeq(null);
  };

  const worstBufferSample = useMemo(() => {
    if (historyBuffer.length === 0) return null;
    let worstIdx = 0;
    let worstSnr = -Infinity;
    historyBuffer.forEach((sample, idx) => {
      const sampleAvgSnr =
        sample.bins.length > 0
          ? sample.bins.reduce((s, b) => s + b.residualSnrDb, 0) /
            sample.bins.length
          : sample.maskedSnrDb;
      if (sampleAvgSnr >= worstSnr) {
        worstSnr = sampleAvgSnr;
        worstIdx = idx;
      }
    });
    return {
      index: worstIdx,
      seq: historyBuffer[worstIdx].seq,
      avgSnrDb: Number(worstSnr.toFixed(1)),
    };
  }, [historyBuffer]);

  const handleJumpToWorstSnr = () => {
    if (!worstBufferSample) return;
    handleScrubToIndex(worstBufferSample.index);
  };

  const handleExportTrace = () => {
    if (!activeFrame) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      adapter: activeWifiBinding?.bound
        ? `${activeWifiBinding.ifaceName} (${activeWifiBinding.ssid})`
        : activeFrame.iface,
      channel: activeFrame.channel,
      centerFreqMhz: activeFrame.centerFreqMhz,
      activeSample: {
        seq: activeFrame.seq,
        timestampIso: new Date(activeFrame.timestampMs).toISOString(),
        noiseEnabled: activeFrame.noiseEnabled,
        profile: activeFrame.profile,
        effectiveFloorDbm: activeFrame.effectiveFloorDbm,
        isBurstActive: activeFrame.isBurstActive,
        snrSummary: {
          avgSnrDb: validationStats.avgSnrDb,
          peakSnrDb: validationStats.peakSnrDb,
          snrReductionDb: validationStats.snrReductionDb,
          qualityTier: validationStats.snrQualityTier,
          maskedBinsPct: validationStats.maskedBinsPct,
          verdict: validationStats.verdict,
        },
        subcarriers: activeFrame.bins.map((b) => ({
          idx: b.idx,
          freqMhz: Number(
            (activeFrame.centerFreqMhz + b.freqOffsetMhz).toFixed(2)
          ),
          txSignalDbm: b.txSignalDbm,
          effectiveFloorDbm: b.effectiveFloorDbm,
          residualSnrDb: b.residualSnrDb,
        })),
      },
      rollingBufferSummary: historyBuffer.map((sample) => ({
        seq: sample.seq,
        timestampIso: new Date(sample.timestampMs).toISOString(),
        noiseEnabled: sample.noiseEnabled,
        profile: sample.profile,
        maskedSnrDb: sample.maskedSnrDb,
        effectiveFloorDbm: sample.effectiveFloorDbm,
        isBurstActive: sample.isBurstActive,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wifi-rf-spectrum-${activeFrame.iface}-seq${activeFrame.seq}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportedTrace(true);
    window.setTimeout(() => setExportedTrace(false), 1800);

    addLog?.(
      `[WiFi Signal Spectrum] Export trace RF JSON (seq #${activeFrame.seq} · SNR ${validationStats.avgSnrDb} dB · ${activeFrame.bins.length} sous-porteuses)`,
      'info'
    );
  };

  const latestTimestampMs =
    historyBuffer[historyBuffer.length - 1]?.timestampMs ??
    activeFrame?.timestampMs ??
    Date.now();
  const sampleAgeSec = activeFrame
    ? Math.max(0, Math.round((latestTimestampMs - activeFrame.timestampMs) / 1000))
    : 0;

  // =========================================================================
  // D3 CHART 1: Real-Time WiFi Signal Spectrum FFT & Obfuscation Validation
  // =========================================================================
  useEffect(() => {
    if (
      viewMode !== 'fft' ||
      !fftSvgRef.current ||
      !activeFrame ||
      activeFrame.bins.length === 0
    ) {
      return;
    }

    const bins = activeFrame.bins;
    const svg = d3.select(fftSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 248;
    const margin = { top: 24, right: 20, bottom: 30, left: 52 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(90, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const minFreq = activeFrame.centerFreqMhz - 20;
    const maxFreq = activeFrame.centerFreqMhz + 20;

    const x = d3.scaleLinear().domain([minFreq, maxFreq]).range([0, innerW]);
    const y = d3.scaleLinear().domain([-100, -48]).range([innerH, 0]);

    // Horizontal grid
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
          .attr('stroke-opacity', 0.34)
          .attr('stroke-dasharray', '2,3')
      );

    // Center channel line
    g.append('line')
      .attr('x1', x(activeFrame.centerFreqMhz))
      .attr('x2', x(activeFrame.centerFreqMhz))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#475569')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // TX signal envelope (amber/rose)
    const txArea = d3
      .area<SentinelRfSubcarrierBin>()
      .x((d) => x(activeFrame.centerFreqMhz + d.freqOffsetMhz))
      .y0(y(-100))
      .y1((d) => y(d.txSignalDbm))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bins)
      .attr('fill', activeFrame.noiseEnabled ? '#f59e0b' : '#f43f5e')
      .attr('fill-opacity', activeFrame.noiseEnabled ? 0.14 : 0.25)
      .attr('d', txArea);

    const txLine = d3
      .line<SentinelRfSubcarrierBin>()
      .x((d) => x(activeFrame.centerFreqMhz + d.freqOffsetMhz))
      .y((d) => y(d.txSignalDbm))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(bins)
      .attr('fill', 'none')
      .attr('stroke', activeFrame.noiseEnabled ? '#f59e0b' : '#fb7185')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', activeFrame.noiseEnabled ? '4,3' : 'none')
      .attr('d', txLine);

    // Peak-Hold Noise Trace (if active)
    if (showPeakHold && peakHoldFloor.length === bins.length) {
      const peakLine = d3
        .line<SentinelRfSubcarrierBin>()
        .x((d) => x(activeFrame.centerFreqMhz + d.freqOffsetMhz))
        .y((_, i) => y(peakHoldFloor[i]))
        .curve(d3.curveBasis);

      g.append('path')
        .datum(bins)
        .attr('fill', 'none')
        .attr('stroke', '#818cf8')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '2,3')
        .attr('opacity', 0.85)
        .attr('d', peakLine);
    }

    // Active Sentinel-IA Injected RF Noise Floor Area & Curve
    const noiseArea = d3
      .area<SentinelRfSubcarrierBin>()
      .x((d) => x(activeFrame.centerFreqMhz + d.freqOffsetMhz))
      .y0(y(-100))
      .y1((d) => y(d.effectiveFloorDbm))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(bins)
      .attr('fill', activeFrame.noiseEnabled ? '#10b981' : '#64748b')
      .attr('fill-opacity', activeFrame.noiseEnabled ? 0.24 : 0.08)
      .attr('d', noiseArea);

    const noiseLine = d3
      .line<SentinelRfSubcarrierBin>()
      .x((d) => x(activeFrame.centerFreqMhz + d.freqOffsetMhz))
      .y((d) => y(d.effectiveFloorDbm))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(bins)
      .attr('fill', 'none')
      .attr('stroke', activeFrame.noiseEnabled ? '#22d3ee' : '#64748b')
      .attr('stroke-width', 2.2)
      .attr('d', noiseLine);

    // Highlight any exposed subcarriers exceeding passive probe SNR threshold
    const exposedBins = bins.filter(
      (b) => b.residualSnrDb > PASSIVE_PROBE_SNR_LIMIT_DB
    );
    g.selectAll('.exposed-marker')
      .data(exposedBins)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(activeFrame.centerFreqMhz + d.freqOffsetMhz))
      .attr('cy', (d) => y(d.txSignalDbm))
      .attr('r', 2.7)
      .attr('fill', '#f43f5e')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(7)
          .tickFormat((d) => `${Number(d).toFixed(0)} MHz`)
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
    const legend = g.append('g').attr('transform', 'translate(6, -13)');
    [
      {
        label: 'Bruit Sentinel-IA',
        color: activeFrame.noiseEnabled ? '#22d3ee' : '#64748b',
        x: 0,
      },
      {
        label: 'Signal TX Wi-Fi',
        color: activeFrame.noiseEnabled ? '#f59e0b' : '#fb7185',
        x: 132,
      },
      ...(showPeakHold
        ? [{ label: 'Peak-Hold', color: '#818cf8', x: 252 }]
        : []),
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

    // Crosshair hover inspection
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
        const targetFreq = x.invert(mx);
        const nearest = bins.reduce((best, cur) =>
          Math.abs(activeFrame.centerFreqMhz + cur.freqOffsetMhz - targetFreq) <
          Math.abs(activeFrame.centerFreqMhz + best.freqOffsetMhz - targetFreq)
            ? cur
            : best
        );
        focusLine
          .style('display', null)
          .attr('x1', x(activeFrame.centerFreqMhz + nearest.freqOffsetMhz))
          .attr('x2', x(activeFrame.centerFreqMhz + nearest.freqOffsetMhz));
        setHoveredBin(nearest);
      })
      .on('mouseleave', () => {
        focusLine.style('display', 'none');
        setHoveredBin(null);
      });
  }, [viewMode, activeFrame, svgWidth, showPeakHold, peakHoldFloor]);

  // =========================================================================
  // D3 CHART 2: Real-Time Waterfall RF Spectrogram (Time × Frequency)
  // =========================================================================
  useEffect(() => {
    if (
      viewMode !== 'waterfall' ||
      !waterfallSvgRef.current ||
      waterfallRows.length === 0
    ) {
      return;
    }

    const svg = d3.select(waterfallSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 248;
    const margin = { top: 24, right: 20, bottom: 30, left: 52 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(90, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const latestRow = waterfallRows[waterfallRows.length - 1];
    const colCount = latestRow.bins.length;
    const rowCount = MAX_WATERFALL_ROWS;
    const cellW = innerW / colCount;
    const cellH = innerH / rowCount;

    const colorScale = d3
      .scaleSequential(
        d3.interpolateRgbBasis([
          '#090d16',
          '#0f3b57',
          '#0891b2',
          '#22d3ee',
          '#34d399',
          '#fbbf24',
          '#f43f5e',
        ])
      )
      .domain([-96, -54]);

    // Render newest slice of window at top row (y = 0) scrolling downward
    const orderedRows = [...waterfallRows].reverse();
    const highlightedSeq = activeFrame?.seq ?? null;

    orderedRows.forEach((rowFrame, rIdx) => {
      const rowGroup = g
        .append('g')
        .style('cursor', 'pointer')
        .on('click', () => {
          if (
            historyBuffer.length > 0 &&
            rowFrame.seq === historyBuffer[historyBuffer.length - 1].seq &&
            !isFrozen
          ) {
            setSelectedSeq(null);
          } else {
            setSelectedSeq(rowFrame.seq);
          }
        });

      rowFrame.bins.forEach((bin, cIdx) => {
        // Combine injected noise floor & residual exposed TX spike to show contrast clearly
        const observablePowerDbm = Math.max(
          bin.effectiveFloorDbm,
          bin.txSignalDbm
        );
        rowGroup
          .append('rect')
          .attr('x', cIdx * cellW)
          .attr('y', rIdx * cellH)
          .attr('width', Math.ceil(cellW))
          .attr('height', Math.ceil(cellH))
          .attr('fill', colorScale(observablePowerDbm))
          .attr('opacity', rowFrame.noiseEnabled ? 0.94 : 0.88);
      });

      if (selectedSeq !== null && highlightedSeq === rowFrame.seq) {
        rowGroup
          .append('rect')
          .attr('x', 0.5)
          .attr('y', rIdx * cellH + 0.5)
          .attr('width', Math.max(1, innerW - 1))
          .attr('height', Math.max(1, cellH - 1))
          .attr('fill', 'none')
          .attr('stroke', '#22d3ee')
          .attr('stroke-width', 1.5);
      }
    });

    const minFreq = latestRow.centerFreqMhz - 20;
    const maxFreq = latestRow.centerFreqMhz + 20;
    const x = d3.scaleLinear().domain([minFreq, maxFreq]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, MAX_WATERFALL_ROWS]).range([0, innerH]);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(7)
          .tickFormat((d) => `${Number(d).toFixed(0)} MHz`)
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
          .ticks(4)
          .tickFormat((d) => {
            const rowIdx = Math.round(Number(d));
            const targetRow = orderedRows[rowIdx];
            if (!targetRow) return '';
            const ageSec = Math.max(
              0,
              Math.round((latestTimestampMs - targetRow.timestampMs) / 1000)
            );
            return ageSec === 0 ? 'Direct' : `-${ageSec}s`;
          })
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

    // Legend strip
    const legend = g.append('g').attr('transform', 'translate(6, -13)');
    [
      { label: '-95 dBm (Calme)', color: '#0f3b57', x: 0 },
      { label: '-72 dBm (Rideau Bruit IA)', color: '#22d3ee', x: 124 },
      { label: '>-58 dBm (Pic / Rafale)', color: '#fbbf24', x: 286 },
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
  }, [
    viewMode,
    waterfallRows,
    svgWidth,
    activeFrame?.seq,
    selectedSeq,
    historyBuffer,
    isFrozen,
    latestTimestampMs,
  ]);

  const snrSeries = useMemo(() => {
    return historyBuffer.map((sample, idx) => {
      const avgSnrDb =
        sample.bins.length > 0
          ? Number(
              (
                sample.bins.reduce((sum, b) => sum + b.residualSnrDb, 0) /
                sample.bins.length
              ).toFixed(1)
            )
          : sample.maskedSnrDb;
      return {
        idx,
        seq: sample.seq,
        timestampMs: sample.timestampMs,
        timeLabel: formatSampleClock(sample.timestampMs),
        avgSnrDb,
        unmaskedSnrDb: sample.unmaskedSnrDb,
        noiseEnabled: sample.noiseEnabled,
        isBurstActive: sample.isBurstActive,
      };
    });
  }, [historyBuffer]);

  // =========================================================================
  // D3 CHART 3: Rolling Buffer SNR Trajectory (Synced with Scrubber)
  // =========================================================================
  useEffect(() => {
    if (
      viewMode !== 'snr' ||
      !snrSvgRef.current ||
      snrSeries.length === 0
    ) {
      return;
    }

    const svg = d3.select(snrSvgRef.current);
    svg.selectAll('*').remove();

    const width = svgWidth;
    const height = 248;
    const margin = { top: 24, right: 20, bottom: 30, left: 52 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = Math.max(90, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxSnr = Math.max(
      26,
      d3.max(snrSeries, (d) => Math.max(d.avgSnrDb, d.unmaskedSnrDb)) ?? 26
    );
    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, snrSeries.length - 1)])
      .range([0, innerW]);
    const y = d3.scaleLinear().domain([0, maxSnr]).range([innerH, 0]);

    // Horizontal grid
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
          .attr('stroke-opacity', 0.34)
          .attr('stroke-dasharray', '2,3')
      );

    // Passive probe stealth zone (<= 6 dB SNR)
    g.append('rect')
      .attr('x', 0)
      .attr('y', y(PASSIVE_PROBE_SNR_LIMIT_DB))
      .attr('width', innerW)
      .attr('height', Math.max(0, y(0) - y(PASSIVE_PROBE_SNR_LIMIT_DB)))
      .attr('fill', '#10b981')
      .attr('opacity', 0.1);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(PASSIVE_PROBE_SNR_LIMIT_DB))
      .attr('y2', y(PASSIVE_PROBE_SNR_LIMIT_DB))
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', innerW - 4)
      .attr('y', y(PASSIVE_PROBE_SNR_LIMIT_DB) - 5)
      .attr('text-anchor', 'end')
      .attr('fill', '#34d399')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text(`Seuil sonde passive (${PASSIVE_PROBE_SNR_LIMIT_DB} dB)`);

    // Unmasked baseline SNR
    const baselineLine = d3
      .line<(typeof snrSeries)[number]>()
      .x((d) => x(d.idx))
      .y((d) => y(d.unmaskedSnrDb))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(snrSeries)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.85)
      .attr('d', baselineLine);

    // Live masked SNR area & line
    const snrArea = d3
      .area<(typeof snrSeries)[number]>()
      .x((d) => x(d.idx))
      .y0(y(0))
      .y1((d) => y(d.avgSnrDb))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(snrSeries)
      .attr('fill', '#22d3ee')
      .attr('fill-opacity', 0.2)
      .attr('d', snrArea);

    const snrLine = d3
      .line<(typeof snrSeries)[number]>()
      .x((d) => x(d.idx))
      .y((d) => y(d.avgSnrDb))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(snrSeries)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2.1)
      .attr('d', snrLine);

    // Selected scrubbed index marker
    const activePoint = snrSeries[selectedIndex] ?? snrSeries[snrSeries.length - 1];
    if (activePoint) {
      g.append('line')
        .attr('x1', x(activePoint.idx))
        .attr('x2', x(activePoint.idx))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#22d3ee')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '2,2');

      g.append('circle')
        .attr('cx', x(activePoint.idx))
        .attr('cy', y(activePoint.avgSnrDb))
        .attr('r', 4.5)
        .attr('fill', activePoint.avgSnrDb <= PASSIVE_PROBE_SNR_LIMIT_DB ? '#10b981' : '#f43f5e')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);
    }

    const tickIdx = Array.from(
      new Set([
        0,
        Math.floor((snrSeries.length - 1) * 0.33),
        Math.floor((snrSeries.length - 1) * 0.66),
        snrSeries.length - 1,
      ])
    );

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickIdx)
          .tickFormat((val) => snrSeries[Number(val)]?.timeLabel ?? '')
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

    // Legend
    const legend = g.append('g').attr('transform', 'translate(6, -13)');
    [
      { label: 'SNR Résiduel', color: '#22d3ee', x: 0 },
      { label: 'SNR Sans Bruit', color: '#f59e0b', x: 112 },
      { label: 'Zone Furtive <=6 dB', color: '#10b981', x: 230 },
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

    // Click & hover scrubbing directly on SNR timeline
    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const idx = Math.max(
          0,
          Math.min(snrSeries.length - 1, Math.round(x.invert(mx)))
        );
        setHoveredSnrIndex(idx);
      })
      .on('click', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const idx = Math.max(
          0,
          Math.min(snrSeries.length - 1, Math.round(x.invert(mx)))
        );
        handleScrubToIndex(idx);
      })
      .on('mouseleave', () => setHoveredSnrIndex(null));
  }, [viewMode, snrSeries, svgWidth, selectedIndex]);

  return (
    <section
      id="wifi-signal-spectrum"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              WiFi Signal Spectrum (Validation Obfuscation RF D3.js)
            </h2>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className={`text-xs font-mono tabular-nums font-semibold flex items-center gap-1 ${
                validationStats.verdict === 'validated'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : validationStats.verdict === 'partial'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {validationStats.verdict === 'validated' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              <span>
                {validationStats.verdict === 'validated'
                  ? `Obfuscation RF Validée (${validationStats.maskedBinsPct}%)`
                  : validationStats.verdict === 'partial'
                    ? `Couverture Partielle (${validationStats.maskedBinsPct}%)`
                    : 'Signature TX Exposée'}
              </span>
            </span>
            <span
              className="text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className={`text-xs font-mono tabular-nums font-semibold ${
                validationStats.snrQualityTier === 'optimal'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : validationStats.snrQualityTier === 'moderate'
                    ? 'text-amber-600 dark:text-amber-400'
                    : validationStats.snrQualityTier === 'exposed'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
              }`}
              title="Ratio Signal/Bruit moyen calculé sur la trame RF active (seuil furtif ≤ 6 dB)"
            >
              SNR {validationStats.avgSnrDb} dB ({validationStats.snrQualityLabel})
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Analyse spectrale en direct du bruit généré par{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Sentinel-IA Noise Generator
            </span>{' '}
            sur{' '}
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {activeFrame?.iface ?? 'wlan0'}
            </span>{' '}
            ({activeFrame?.centerFreqMhz ?? 6135} MHz · Ch{' '}
            {activeFrame?.channel ?? 37}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('fft')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'fft'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Spectre FFT
            </button>
            <button
              type="button"
              onClick={() => setViewMode('waterfall')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'waterfall'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Waterfall Temps×Fréq
            </button>
            <button
              type="button"
              onClick={() => setViewMode('snr')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'snr'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Historique SNR
            </button>
          </div>

          {viewMode === 'fft' && (
            <button
              type="button"
              onClick={() => setShowPeakHold((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                showPeakHold
                  ? 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Peak-Hold
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onApplyPatch(
                { sentinelRfNoiseEnabled: !settings.sentinelRfNoiseEnabled },
                !settings.sentinelRfNoiseEnabled
                  ? 'Bruit RF activé depuis WiFi Signal Spectrum'
                  : 'Bruit RF suspendu depuis WiFi Signal Spectrum pour contrôle visuel'
              )
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              settings.sentinelRfNoiseEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
            title="Activer ou couper le générateur de bruit pour comparer le spectre TX"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>
              {settings.sentinelRfNoiseEnabled
                ? 'Bruit RF : ACTIF'
                : 'Activer Bruit RF'}
            </span>
          </button>

          {onJumpToGenerator && (
            <button
              type="button"
              onClick={onJumpToGenerator}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title="Régler le profil ou le plancher dans Sentinel-IA Noise Generator"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-500" />
              <span>Générateur</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportTrace}
            disabled={!activeFrame}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-45 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Exporter la capture spectrale et le tampon RF au format JSON"
          >
            {exportedTrace ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Download className="w-3.5 h-3.5 text-cyan-500" />
            )}
            <span>{exportedTrace ? 'Exporté' : 'Exporter JSON'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFreeze}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={isFrozen ? 'Reprendre le spectre en direct' : 'Geler la capture'}
            aria-label={
              isFrozen ? 'Reprendre le spectre en direct' : 'Geler la capture'
            }
          >
            {isFrozen ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Live Validation Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Ratio Signal/Bruit (SNR)
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className={`text-lg font-bold font-mono tabular-nums ${
                validationStats.snrQualityTier === 'optimal'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : validationStats.snrQualityTier === 'moderate'
                    ? 'text-amber-600 dark:text-amber-400'
                    : validationStats.snrQualityTier === 'exposed'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {validationStats.avgSnrDb} dB
            </span>
            <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">
              {validationStats.snrQualityLabel}
            </span>
          </div>
          <div
            className="mt-1.5 relative h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
            title={`Seuil détection sonde passive : ${PASSIVE_PROBE_SNR_LIMIT_DB} dB (ligne verticale à 25%)`}
          >
            <div
              className={`h-full transition-all duration-200 ${
                validationStats.snrQualityTier === 'optimal'
                  ? 'bg-emerald-500'
                  : validationStats.snrQualityTier === 'moderate'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${validationStats.snrGaugePct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-slate-900 dark:bg-white/80"
              style={{ left: `${(PASSIVE_PROBE_SNR_LIMIT_DB / 24) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Pic {validationStats.peakSnrDb} dB · −{validationStats.snrReductionDb} dB
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Sous-Porteuses Masquées
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono tabular-nums ${
              validationStats.maskedBinsPct >= 85
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {validationStats.maskedBinsCount}/{validationStats.totalBins}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {validationStats.maskedBinsPct}% sous seuil 6 dB
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Marge Obfuscation Moy.
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {validationStats.marginDb > 0 ? '+' : ''}
            {validationStats.marginDb} dB
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Bruit {activeFrame?.effectiveFloorDbm ?? -95} dBm vs TX{' '}
            {validationStats.avgTxDbm} dBm
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Modulation Noise Generator
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {activeFrame?.noiseEnabled
              ? activeFrame.profile.toUpperCase()
              : 'DÉSACTIVÉ'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Gain global {activeFrame?.maskingGainPct ?? 0}%
          </div>
        </div>

        <div className="px-4 py-3 col-span-2 sm:col-span-1">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Verdict Sonde Passive
          </div>
          <div
            className={`mt-0.5 text-sm font-bold font-mono tabular-nums ${
              validationStats.verdict === 'validated'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {validationStats.verdict === 'validated'
              ? 'INDÉTECTABLE TDOA'
              : validationStats.verdict === 'partial'
                ? 'FUITE PARTIELLE'
                : 'PIC TX CORRÉLABLE'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Pic TX {validationStats.peakTxDbm} dBm
          </div>
        </div>
      </div>

      {/* D3 Spectrum Canvas */}
      <div className="p-4 sm:p-5 bg-slate-950">
        <div ref={containerRef} className="w-full relative">
          {viewMode === 'fft' ? (
            <svg
              ref={fftSvgRef}
              className="w-full h-[248px] block select-none"
              role="img"
              aria-label="Spectre FFT Wi-Fi D3.js validant l'obfuscation RF du Sentinel-IA Noise Generator"
            />
          ) : viewMode === 'waterfall' ? (
            <svg
              ref={waterfallSvgRef}
              className="w-full h-[248px] block select-none"
              role="img"
              aria-label="Spectrogramme Waterfall D3.js du signal Wi-Fi et du bruit RF Sentinel-IA"
            />
          ) : (
            <svg
              ref={snrSvgRef}
              className="w-full h-[248px] block select-none"
              role="img"
              aria-label="Chronologie D3.js du Signal-to-Noise Ratio (SNR) sur les 48 derniers échantillons"
            />
          )}

          {/* Rolling History Buffer Scrubber */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2">
            {/* Clickable pattern overview ticks across the rolling buffer */}
            {historyBuffer.length > 0 && (
              <div
                className="flex items-end gap-[2px] h-3.5 w-full"
                role="group"
                aria-label="Aperçu visuel des motifs passés dans le tampon spectre RF"
              >
                {historyBuffer.map((sample, idx) => {
                  const isActiveSample = idx === selectedIndex;
                  const toneClass = !sample.noiseEnabled
                    ? 'bg-rose-500/75 hover:bg-rose-400'
                    : sample.isBurstActive
                      ? 'bg-amber-400/90 hover:bg-amber-300'
                      : sample.maskingGainPct >= 75
                        ? 'bg-emerald-500/70 hover:bg-emerald-400'
                        : 'bg-cyan-500/70 hover:bg-cyan-400';

                  return (
                    <button
                      key={sample.seq}
                      type="button"
                      onClick={() => handleScrubToIndex(idx)}
                      className={`flex-1 rounded-[1px] transition-all cursor-pointer ${
                        isActiveSample
                          ? 'h-3.5 bg-cyan-300 ring-1 ring-white/90'
                          : `h-2 ${toneClass}`
                      }`}
                      title={`Éch. ${idx + 1}/${historyBuffer.length} · ${formatSampleClock(sample.timestampMs)} · ${
                        sample.noiseEnabled ? sample.profile.toUpperCase() : 'TX Exposé'
                      }${sample.isBurstActive ? ' (Rafale)' : ''}`}
                      aria-label={`Aller à l'échantillon ${idx + 1} (${formatSampleClock(sample.timestampMs)})`}
                    />
                  );
                })}
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-300 shrink-0">
                <History className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-400">Tampon RF</span>
                <span className="font-semibold text-white">
                  {historyBuffer.length > 0
                    ? `${selectedIndex + 1}/${historyBuffer.length}`
                    : '0/0'}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span>
                  {activeFrame ? formatSampleClock(activeFrame.timestampMs) : '--:--:--'}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span
                  className={
                    isScrubbingHistorical
                      ? 'text-amber-400 font-semibold'
                      : isFrozen
                        ? 'text-cyan-400 font-semibold'
                        : 'text-emerald-400 font-semibold'
                  }
                >
                  {isScrubbingHistorical
                    ? `-${sampleAgeSec}s`
                    : isFrozen
                      ? 'Gelé'
                      : 'Direct'}
                </span>
                {activeFrame?.isBurstActive && (
                  <>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-amber-400">Rafale</span>
                  </>
                )}
              </div>

              <div className="flex-1 flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={handleStepBack}
                  disabled={historyBuffer.length <= 1 || selectedIndex <= 0}
                  className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title="Échantillon précédent"
                  aria-label="Échantillon précédent"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, historyBuffer.length - 1)}
                  value={selectedIndex}
                  disabled={historyBuffer.length <= 1}
                  onChange={(e) => handleScrubToIndex(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
                  aria-label="Parcourir l'historique du spectre de bruit Wi-Fi"
                />

                <button
                  type="button"
                  onClick={handleStepForward}
                  disabled={
                    historyBuffer.length <= 1 ||
                    selectedIndex >= historyBuffer.length - 1
                  }
                  className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title="Échantillon suivant"
                  aria-label="Échantillon suivant"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {worstBufferSample && historyBuffer.length > 1 && (
                  <button
                    type="button"
                    onClick={handleJumpToWorstSnr}
                    className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      selectedIndex === worstBufferSample.index
                        ? 'bg-amber-500/25 border border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-amber-400'
                    }`}
                    title={`Aller directement à l'échantillon ayant le SNR résiduel le plus élevé du tampon (${worstBufferSample.avgSnrDb} dB)`}
                  >
                    <span>Pic {worstBufferSample.avgSnrDb} dB</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReturnLive}
                  disabled={!isScrubbingHistorical && !isFrozen}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    isScrubbingHistorical || isFrozen
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-default'
                  }`}
                  title="Revenir au dernier échantillon en direct"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Direct</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400">
            {viewMode === 'fft' && hoveredBin && activeFrame ? (
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span>
                  {(activeFrame.centerFreqMhz + hoveredBin.freqOffsetMhz).toFixed(
                    1
                  )}{' '}
                  MHz
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-cyan-400">
                  Bruit {hoveredBin.effectiveFloorDbm} dBm
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
                <span
                  className={
                    hoveredBin.residualSnrDb <= PASSIVE_PROBE_SNR_LIMIT_DB
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  SNR {hoveredBin.residualSnrDb} dB (
                  {hoveredBin.residualSnrDb <= PASSIVE_PROBE_SNR_LIMIT_DB
                    ? 'Masquée'
                    : 'Exposée'}
                  )
                </span>
              </div>
            ) : viewMode === 'snr' &&
              hoveredSnrIndex !== null &&
              snrSeries[hoveredSnrIndex] ? (
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span>
                  Éch. {hoveredSnrIndex + 1}/{snrSeries.length} (
                  {snrSeries[hoveredSnrIndex].timeLabel})
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span
                  className={
                    snrSeries[hoveredSnrIndex].avgSnrDb <=
                    PASSIVE_PROBE_SNR_LIMIT_DB
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  SNR {snrSeries[hoveredSnrIndex].avgSnrDb} dB
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-amber-400">
                  Brut {snrSeries[hoveredSnrIndex].unmaskedSnrDb} dB
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span>Cliquez pour inspecter</span>
              </div>
            ) : (
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  {isScrubbingHistorical
                    ? `Lecture historique (${selectedIndex + 1}/${historyBuffer.length}) — cliquez sur Direct pour revenir au flux temps réel.`
                    : isFrozen
                      ? 'Capture spectrale gelée — cliquez sur Reprendre ou Direct pour suivre les rafales en direct.'
                      : viewMode === 'fft'
                        ? 'Points rouges = sous-porteuses exposées (> 6 dB SNR). Utilisez le curseur ci-dessus pour inspecter les motifs passés.'
                        : viewMode === 'waterfall'
                          ? 'Waterfall temps réel : cliquez sur une ligne ou utilisez le curseur ci-dessus pour inspecter un motif passé.'
                          : 'Historique SNR sur 48 échantillons : cliquez sur la courbe pour examiner la trame correspondante.'}
                </span>
              </span>
            )}
            <span>
              {activeWifiBinding?.bound
                ? `${activeWifiBinding.ifaceName} (${activeWifiBinding.ssid})`
                : activeFrame?.iface ?? 'wlan0'}{' '}
              · {isConnected ? 'Tunnel chiffré actif' : 'Veille'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
