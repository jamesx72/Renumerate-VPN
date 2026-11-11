import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Gauge,
  Activity,
  Play,
  Square,
  RefreshCw,
  Download,
  Upload,
  ArrowUpDown,
  Server,
  Zap,
  Radio,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Shield,
  Wifi,
  FileCode2,
} from 'lucide-react';
import { AppSettings, ConnectionMode, DeviceNode } from '../types';

export interface IperfSpeedTesterProps {
  isConnected: boolean;
  mode: ConnectionMode;
  protocol: string;
  currentIp: string;
  currentCountry?: string;
  baseLatency?: number;
  activeNode?: DeviceNode;
  nodes?: DeviceNode[];
  settings: AppSettings;
  addLog: (
    event: string,
    type: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
  className?: string;
}

export type IperfTransport = 'tcp' | 'udp';
export type IperfDirection = 'download' | 'upload' | 'bidirectional';
export type IperfPreset = 'standard' | 'fast' | 'udp_stress' | 'full_duplex';

export interface IperfIntervalRecord {
  intervalIndex: number;
  timeRange: string;
  transferMBytes: number;
  bitrateMbps: number;
  retransmits: number;
  congestionWindowMBytes: number;
  rttMs: number;
}

export interface IperfTestReport {
  id: string;
  timestamp: string;
  targetServer: string;
  targetHost: string;
  targetPort: number;
  transport: IperfTransport;
  direction: IperfDirection;
  parallelStreams: number;
  durationSeconds: number;
  avgThroughputMbps: number;
  peakThroughputMbps: number;
  totalTransferredMBytes: number;
  retransmissionsCount: number;
  minRttMs: number;
  avgRttMs: number;
  maxRttMs: number;
  jitterMs: number;
  packetLossPercent: number;
  cryptoOverheadPercent: number;
  qualityRating: 'A+' | 'A' | 'B' | 'C' | 'D';
  verdictText: string;
  intervals: IperfIntervalRecord[];
  rawCliOutput: string;
}

export const IperfSpeedTester: React.FC<IperfSpeedTesterProps> = ({
  isConnected,
  mode,
  protocol,
  currentIp,
  currentCountry = 'Suisse',
  baseLatency = 24,
  activeNode,
  nodes = [],
  settings,
  addLog,
  className = '',
}) => {
  // Paramètres du test iPerf3
  const [selectedPreset, setSelectedPreset] = useState<IperfPreset>('standard');
  const [transport, setTransport] = useState<IperfTransport>('tcp');
  const [direction, setDirection] = useState<IperfDirection>('download');
  const [parallelStreams, setParallelStreams] = useState<number>(4);
  const [durationSec, setDurationSec] = useState<number>(10);
  const [targetServerId, setTargetServerId] = useState<string>('auto_active_node');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [showTerminalConsole, setShowTerminalConsole] = useState<boolean>(true);

  // État d'exécution en temps réel
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentSecond, setCurrentSecond] = useState<number>(0);
  const [liveBitrateMbps, setLiveBitrateMbps] = useState<number>(0);
  const [liveRttMs, setLiveRttMs] = useState<number>(baseLatency);
  const [liveTransferredMB, setLiveTransferredMB] = useState<number>(0);
  const [liveIntervals, setLiveIntervals] = useState<IperfIntervalRecord[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [lastReport, setLastReport] = useState<IperfTestReport | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const testTimerRef = useRef<NodeJS.Timeout | null>(null);
  const terminalScrollRef = useRef<HTMLPreElement | null>(null);

  // Serveurs iPerf3 disponibles
  const availableServers = useMemo(() => {
    const list = [
      {
        id: 'auto_active_node',
        label: isConnected
          ? `Passerelle VPN Active (${activeNode?.name || currentCountry} · 10.84.0.1)`
          : `Nœud local simulé (127.0.0.1)`,
        host: isConnected ? (activeNode?.ip || '10.84.0.1') : '127.0.0.1',
        port: 5201,
        location: isConnected
          ? activeNode?.city
            ? `${activeNode.city}, ${activeNode.country}`
            : activeNode?.country || currentCountry
          : 'Localhost',
      },
      {
        id: 'gw_zurich',
        label: 'Mire Renumerate Core 10G (Zurich, CH)',
        host: 'ch-zrh-speed01.renumerate.net',
        port: 5201,
        location: 'Zurich, Suisse',
      },
      {
        id: 'gw_frankfurt',
        label: 'Mire DE-CIX Backbone (Francfort, DE)',
        host: 'de-fra-iperf.renumerate.net',
        port: 5201,
        location: 'Francfort, Allemagne',
      },
      {
        id: 'gw_reykjavik',
        label: 'Mire Sanctuarisée 10G (Reykjavik, IS)',
        host: 'is-rjk-iperf.renumerate.net',
        port: 5201,
        location: 'Reykjavik, Islande',
      },
    ];
    return list;
  }, [isConnected, activeNode, currentCountry]);

  // Synchronisation des presets
  const handleSelectPreset = (preset: IperfPreset) => {
    setSelectedPreset(preset);
    if (preset === 'standard') {
      setTransport('tcp');
      setDirection('download');
      setParallelStreams(4);
      setDurationSec(10);
    } else if (preset === 'fast') {
      setTransport('tcp');
      setDirection('download');
      setParallelStreams(1);
      setDurationSec(5);
    } else if (preset === 'udp_stress') {
      setTransport('udp');
      setDirection('download');
      setParallelStreams(1);
      setDurationSec(10);
    } else if (preset === 'full_duplex') {
      setTransport('tcp');
      setDirection('bidirectional');
      setParallelStreams(4);
      setDurationSec(10);
    }
  };

  // Scroll automatique du terminal
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Arrêt au démontage
  useEffect(() => {
    return () => {
      if (testTimerRef.current) {
        clearInterval(testTimerRef.current);
      }
    };
  }, []);

  // Calcul du débit de base attendu selon le nœud et protocole
  const targetHostSpec = useMemo(() => {
    const s = availableServers.find((x) => x.id === targetServerId) || availableServers[0];
    return s;
  }, [availableServers, targetServerId]);

  // Déclenchement du test iPerf3
  const handleStartIperfTest = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    setCurrentSecond(0);
    setLiveIntervals([]);
    setLiveTransferredMB(0);

    const target = targetHostSpec;
    const baseRtt = Math.max(8, isConnected ? (activeNode?.latency || baseLatency || 26) : 18);
    const estimatedMaxThroughput = isConnected
      ? protocol === 'WireGuard'
        ? 820 + Math.floor(Math.random() * 120)
        : protocol === 'OpenVPN'
        ? 450 + Math.floor(Math.random() * 80)
        : 680 + Math.floor(Math.random() * 100)
      : 940 + Math.floor(Math.random() * 50);

    // Initialisation bannière terminal
    const cliHeader = [
      `-----------------------------------------------------------`,
      `Renumerate iPerf 3.14 (cJSON 1.7.15) — Tunnel Benchmark Suite`,
      `Interface: ${isConnected ? 'wg0 (Kernel Module)' : 'eth0 (Direct FAI)'} · Chiffrement: ${isConnected ? 'ChaCha20-Poly1305 AEAD' : 'Aucun (Clair)'}`,
      `Connecting to host ${target.host}, port ${target.port}`,
      `[  5] local ${currentIp || '10.84.0.2'} port 49152 connected to ${target.host} port ${target.port}`,
      `[ ID] Interval           Transfer     Bitrate         Retr  Cwnd`,
    ].join('\n');

    setTerminalOutput(cliHeader);

    let sec = 0;
    let accumulatedMB = 0;
    let totalRetr = 0;
    const recordedIntervals: IperfIntervalRecord[] = [];

    testTimerRef.current = setInterval(() => {
      sec += 1;
      setCurrentSecond(sec);

      // Calcul progressif avec slow-start TCP
      const rampFactor = sec === 1 ? 0.72 : sec === 2 ? 0.88 : 1.0;
      const noise = (Math.random() - 0.5) * 45;
      const streamMultiplier = parallelStreams === 1 ? 0.75 : parallelStreams === 2 ? 0.9 : 1.05;
      const currentSpeedMbps = Math.round(Math.max(100, (estimatedMaxThroughput * rampFactor + noise) * streamMultiplier));

      const intervalMB = Number(((currentSpeedMbps * 1000000) / 8 / 1024 / 1024).toFixed(1));
      accumulatedMB = Number((accumulatedMB + intervalMB).toFixed(1));

      const retrThisSec = transport === 'tcp' && Math.random() < 0.18 ? Math.floor(Math.random() * 2) + 1 : 0;
      totalRetr += retrThisSec;

      const cwndMB = Number((1.2 + Math.min(2.5, sec * 0.18) + (Math.random() * 0.1)).toFixed(2));
      const instantRtt = Math.max(6, Math.round(baseRtt + (Math.random() - 0.5) * 4));

      const intervalRec: IperfIntervalRecord = {
        intervalIndex: sec,
        timeRange: `${(sec - 1).toFixed(2)}-${sec.toFixed(2)} sec`,
        transferMBytes: intervalMB,
        bitrateMbps: currentSpeedMbps,
        retransmits: retrThisSec,
        congestionWindowMBytes: cwndMB,
        rttMs: instantRtt,
      };

      recordedIntervals.push(intervalRec);
      setLiveIntervals([...recordedIntervals]);
      setLiveBitrateMbps(currentSpeedMbps);
      setLiveRttMs(instantRtt);
      setLiveTransferredMB(accumulatedMB);

      // Ligne CLI formatée iPerf3 standard
      const streamId = `[  5]`;
      const timeStr = `${(sec - 1).toFixed(2).padStart(4, ' ')}-${sec.toFixed(2).padStart(4, ' ')} sec`;
      const transferStr = `${intervalMB.toFixed(1).padStart(6, ' ')} MBytes`;
      const bitrateStr = `${currentSpeedMbps.toString().padStart(5, ' ')} Mbits/sec`;
      const retrStr = transport === 'tcp' ? `${retrThisSec.toString().padStart(4, ' ')}` : `   -`;
      const cwndStr = transport === 'tcp' ? `${cwndMB.toFixed(2)} MBytes` : `   -`;

      const cliLine = `${streamId}   ${timeStr}   ${transferStr}   ${bitrateStr}   ${retrStr}   ${cwndStr}`;
      setTerminalOutput((prev) => `${prev}\n${cliLine}`);

      // Fin du test
      if (sec >= durationSec) {
        if (testTimerRef.current) clearInterval(testTimerRef.current);
        setIsRunning(false);

        // Bilan consolidé
        const avgThroughput = Math.round(
          recordedIntervals.reduce((acc, curr) => acc + curr.bitrateMbps, 0) / recordedIntervals.length
        );
        const peakThroughput = Math.max(...recordedIntervals.map((i) => i.bitrateMbps));
        const rttValues = recordedIntervals.map((i) => i.rttMs);
        const minRtt = Math.min(...rttValues);
        const maxRtt = Math.max(...rttValues);
        const avgRtt = Math.round(rttValues.reduce((a, b) => a + b, 0) / rttValues.length);
        const jitter = Number((Math.abs(maxRtt - minRtt) / 2.8).toFixed(1));
        const packetLoss = transport === 'udp' ? Number((Math.random() * 0.4).toFixed(2)) : 0;
        const cryptoOverhead = isConnected ? 4.8 : 0;

        let quality: IperfTestReport['qualityRating'] = 'A+';
        let verdict = 'Bande passante exceptionnelle — Débit saturé optimal pour le streaming 4K HDR, gaming et PQC.';

        if (avgThroughput < 350 || avgRtt > 80) {
          quality = 'B';
          verdict = 'Débit modéré — Latence liée à l’éloignement géographique ou à la congestion BGP.';
        } else if (avgThroughput < 600 || totalRetr > 10) {
          quality = 'A';
          verdict = 'Très bon débit chiffré — Zéro gigue sensible, tunnel stable et résilient.';
        }

        const summaryCli = [
          `- - - - - - - - - - - - - - - - - - - - - - - - -`,
          `[ ID] Interval           Transfer     Bitrate         Retr`,
          `[  5]   0.00-${durationSec.toFixed(2)}  sec   ${accumulatedMB} MBytes   ${avgThroughput} Mbits/sec   ${totalRetr}   sender`,
          `[  5]   0.00-${durationSec.toFixed(2)}  sec   ${accumulatedMB} MBytes   ${Math.round(avgThroughput * 0.998)} Mbits/sec        receiver`,
          ``,
          `iPerf Done. RTT min/avg/max = ${minRtt}/${avgRtt}/${maxRtt} ms, Jitter = ${jitter} ms.`,
          `Overhead Chiffrement ${protocol}: ~${cryptoOverhead}% · Verdict Qualité: [Grade ${quality}]`,
        ].join('\n');

        setTerminalOutput((prev) => `${prev}\n${summaryCli}`);

        const finalReport: IperfTestReport = {
          id: `iperf-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fr-FR'),
          targetServer: target.label,
          targetHost: target.host,
          targetPort: target.port,
          transport,
          direction,
          parallelStreams,
          durationSeconds: durationSec,
          avgThroughputMbps: avgThroughput,
          peakThroughputMbps: peakThroughput,
          totalTransferredMBytes: accumulatedMB,
          retransmissionsCount: totalRetr,
          minRttMs: minRtt,
          avgRttMs: avgRtt,
          maxRttMs: maxRtt,
          jitterMs: jitter,
          packetLossPercent: packetLoss,
          cryptoOverheadPercent: cryptoOverhead,
          qualityRating: quality,
          verdictText: verdict,
          intervals: recordedIntervals,
          rawCliOutput: `${cliHeader}\n${recordedIntervals
            .map((rec) => `[  5]   ${rec.timeRange}   ${rec.transferMBytes} MBytes   ${rec.bitrateMbps} Mbits/sec`)
            .join('\n')}\n${summaryCli}`,
        };

        setLastReport(finalReport);

        addLog(
          `[iPerf3] Benchmark terminé : ${avgThroughput} Mbps moyen (${peakThroughput} Mbps crête), RTT ${avgRtt} ms, ${totalRetr} retransmissions.`,
          'success',
          target.host
        );
      }
    }, 1000);
  }, [
    isRunning,
    targetHostSpec,
    baseLatency,
    isConnected,
    activeNode,
    protocol,
    currentIp,
    parallelStreams,
    transport,
    direction,
    durationSec,
    addLog,
  ]);

  const handleStopIperfTest = useCallback(() => {
    if (testTimerRef.current) {
      clearInterval(testTimerRef.current);
    }
    setIsRunning(false);
    setTerminalOutput((prev) => `${prev}\n\n[!] Test interrompu manuellement par l'opérateur.`);
  }, []);

  const copyCliToClipboard = () => {
    navigator.clipboard.writeText(terminalOutput);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const exportReportJson = () => {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iperf3-report-${lastReport.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs relative overflow-hidden ${className}`}
    >
      {/* Background glow décoratif */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* En-tête principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Test de Débit &amp; Latence iPerf3
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300">
                RFC 5348 · v3.14
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  isConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                {isConnected ? 'Tunnel Actif' : 'FAI Direct'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Mesure en temps réel de la bande passante saturée, de la gigue et de la latence RTT à travers
              l&apos;encapsulation cryptographique {protocol} ({settings.protocol === 'openvpn' ? 'AES-256-GCM' : 'ChaCha20-Poly1305 AEAD'}).
            </p>
          </div>
        </div>

        {/* Boutons d'action démarrer / stopper */}
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <button
              type="button"
              onClick={handleStopIperfTest}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Arrêter le Test</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartIperfTest}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Lancer Test iPerf3</span>
            </button>
          )}
        </div>
      </div>

      {/* Sélecteur de Presets & Serveur cible */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Presets rapides */}
        <div className="md:col-span-8 flex flex-wrap gap-2">
          {[
            { id: 'standard', label: 'Standard (TCP 4 flux, 10s)', icon: Zap },
            { id: 'fast', label: 'Rapide (TCP 1 flux, 5s)', icon: Activity },
            { id: 'udp_stress', label: 'Stress UDP (Gigue & Perte)', icon: Radio },
            { id: 'full_duplex', label: 'Bidirectionnel Full Duplex', icon: ArrowUpDown },
          ].map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={isRunning}
                onClick={() => handleSelectPreset(preset.id as IperfPreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sélection de serveur cible */}
        <div className="md:col-span-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={targetServerId}
            disabled={isRunning}
            onChange={(e) => setTargetServerId(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            {availableServers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Jauge centrale et métriques en temps réel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Carte principale de Débit (Speedometer / Jauge Live) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              Débit Mesuré ({direction.toUpperCase()})
            </span>
            {isRunning && (
              <span className="flex items-center gap-1.5 text-emerald-500 font-mono font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Échantillonnage {currentSecond}/{durationSec}s
              </span>
            )}
          </div>

          <div className="text-center py-2 space-y-1">
            <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-mono tabular-nums">
              {isRunning
                ? liveBitrateMbps
                : lastReport
                ? lastReport.avgThroughputMbps
                : '---'}
              <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400 ml-2">Mbps</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {isRunning
                ? `Volume transféré : ${liveTransferredMB} Mo`
                : lastReport
                ? `Total transféré : ${lastReport.totalTransferredMBytes} Mo (Crête : ${lastReport.peakThroughputMbps} Mbps)`
                : 'Prêt pour le benchmark de socket'}
            </div>
          </div>

          {/* Mini barre de saturation */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>0 Mbps</span>
              <span>500 Mbps</span>
              <span>1000 Mbps (Lien 1 Gbps)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((isRunning
                      ? liveBitrateMbps
                      : lastReport
                      ? lastReport.avgThroughputMbps
                      : 0) /
                      1000) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Grille de 4 métriques de performance */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Latence RTT */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
              <span>Latence RTT</span>
              <Activity className="w-3.5 h-3.5 text-cyan-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {isRunning ? liveRttMs : lastReport ? lastReport.avgRttMs : baseLatency}
                <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {lastReport ? `Min: ${lastReport.minRttMs}ms · Max: ${lastReport.maxRttMs}ms` : 'RTT WireGuard'}
              </div>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              {baseLatency < 35 ? 'Latence Optimale' : 'Latence Normale'}
            </div>
          </div>

          {/* Gigue / Jitter */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
              <span>Gigue (Jitter)</span>
              <Radio className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {lastReport ? lastReport.jitterMs : '1.2'}
                <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Variance RTT</div>
            </div>
            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
              Pas de variation brusque
            </div>
          </div>

          {/* Retransmissions TCP / Perte */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
              <span>{transport === 'tcp' ? 'Retransmissions' : 'Perte UDP'}</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {lastReport
                  ? transport === 'tcp'
                    ? lastReport.retransmissionsCount
                    : `${lastReport.packetLossPercent}%`
                  : '0'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {transport === 'tcp' ? 'Paquets Retr TCP' : 'Paquets Droppés'}
              </div>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              0% perte mesurée
            </div>
          </div>

          {/* Note / Grade de qualité */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
              <span>Verdict Tunnel</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {lastReport ? lastReport.qualityRating : isConnected ? 'A+' : 'B+'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Overhead : {isConnected ? '~4.8%' : '0%'}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 truncate" title="Chiffrement matériel AEAD">
              AEAD Accéléré
            </div>
          </div>
        </div>
      </div>

      {/* Bannières de diagnostic & Rapport de fin de test */}
      {lastReport && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                Rapport de Test iPerf3 — Grade {lastReport.qualityRating}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{lastReport.verdictText}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={exportReportJson}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter Rapport JSON</span>
            </button>
          </div>
        </div>
      )}

      {/* Accordéon Réglages Avancés iPerf3 */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Paramètres avancés du benchmark iPerf3</span>
          {showAdvancedSettings ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showAdvancedSettings && (
          <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Protocole :</label>
              <select
                value={transport}
                disabled={isRunning}
                onChange={(e) => setTransport(e.target.value as IperfTransport)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
              >
                <option value="tcp">TCP (Fiable / Fenêtrage CUBIC)</option>
                <option value="udp">UDP (Datagramme / Gigue)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">Direction :</label>
              <select
                value={direction}
                disabled={isRunning}
                onChange={(e) => setDirection(e.target.value as IperfDirection)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
              >
                <option value="download">Download (Entrant)</option>
                <option value="upload">Upload (Sortant)</option>
                <option value="bidirectional">Bidirectionnel simultané</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">Flux Parallèles (-P) :</label>
              <select
                value={parallelStreams}
                disabled={isRunning}
                onChange={(e) => setParallelStreams(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
              >
                <option value={1}>1 flux (Mono-thread)</option>
                <option value={2}>2 flux parallèles</option>
                <option value={4}>4 flux (Standard)</option>
                <option value={8}>8 flux (Saturation 10G)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-semibold mb-1">Durée du test (-t) :</label>
              <select
                value={durationSec}
                disabled={isRunning}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
              >
                <option value={5}>5 secondes (Rapide)</option>
                <option value={10}>10 secondes (Recommandé)</option>
                <option value={20}>20 secondes (Endurance)</option>
                <option value={30}>30 secondes (Audit approfondi)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Console Terminal iPerf3 */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowTerminalConsole(!showTerminalConsole)}
            className="font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-500" />
            <span>Console CLI iPerf3 en direct</span>
            {showTerminalConsole ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {terminalOutput && (
            <button
              type="button"
              onClick={copyCliToClipboard}
              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copiedCli ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copié dans le presse-papiers</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier log CLI</span>
                </>
              )}
            </button>
          )}
        </div>

        {showTerminalConsole && (
          <pre
            ref={terminalScrollRef}
            className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-cyan-400 border border-slate-800 overflow-x-auto max-h-56 select-all leading-relaxed whitespace-pre"
          >
            {terminalOutput ||
              '# Console iPerf3 inactive. Cliquez sur "Lancer Test iPerf3" pour initialiser les sockets.'}
          </pre>
        )}
      </div>
    </div>
  );
};
