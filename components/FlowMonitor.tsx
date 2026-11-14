import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Activity,
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  Wifi,
  WifiOff,
  ShieldAlert,
  Lock,
  Cpu,
  Zap,
  Copy,
  Check,
  FileCode2,
  Eye,
} from 'lucide-react';
import { AppSettings, VirtualIdentity } from '../types';

export interface FlowMonitorProps {
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

export interface LiveStreamPacket {
  id: string;
  seq: number;
  timestampMs: number;
  timeStr: string;
  iface: 'wg0' | 'tun0' | 'eth0' | 'sinkhole0';
  direction: 'out' | 'in';
  srcIp: string;
  dstIp: string;
  srcPort: number;
  dstPort: number;
  protocol: string;
  lengthBytes: number;
  ttl: number;
  flags: string;
  verdict: 'ACCEPT' | 'DROP' | 'QUARANTINE' | 'BYPASS';
  info: string;
  hexDump: string;
  asciiDump: string;
}

type WsConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export const FlowMonitor: React.FC<FlowMonitorProps> = ({
  settings,
  currentIdentity,
  isConnected = true,
  addLog,
  className = '',
}) => {
  const [wsState, setWsState] = useState<WsConnectionState>('connecting');
  const [wsSessionId, setWsSessionId] = useState<string>('—');
  const [wsRttMs, setWsRttMs] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [intervalMs, setIntervalMs] = useState<number>(500);
  const [autoScroll, setAutoScroll] = useState(true);

  const [packets, setPackets] = useState<LiveStreamPacket[]>([]);
  const [totalCaptured, setTotalCaptured] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [droppedCount, setDroppedCount] = useState<number>(0);

  const [selectedPacket, setSelectedPacket] = useState<LiveStreamPacket | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [copiedDump, setCopiedDump] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const isUnmountedRef = useRef(false);

  const appendPacketsIdempotent = useCallback((incoming: LiveStreamPacket[]) => {
    const fresh: LiveStreamPacket[] = [];
    for (const pkt of incoming) {
      if (!seenIdsRef.current.has(pkt.id)) {
        seenIdsRef.current.add(pkt.id);
        fresh.push(pkt);
      }
    }
    if (fresh.length === 0) return;

    // Cap seen set memory size
    if (seenIdsRef.current.size > 1500) {
      const recentSlice = Array.from(seenIdsRef.current).slice(-600);
      seenIdsRef.current = new Set(recentSlice);
    }

    const addedBytes = fresh.reduce((sum, p) => sum + p.lengthBytes, 0);
    const addedDrops = fresh.filter(
      (p) => p.verdict === 'DROP' || p.verdict === 'QUARANTINE'
    ).length;

    setTotalCaptured((c) => c + fresh.length);
    setTotalBytes((b) => b + addedBytes);
    setDroppedCount((d) => d + addedDrops);
    setPackets((prev) => [...prev, ...fresh].slice(-250));
  }, []);

  const connectWebSocket = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    setWsState((prev) => (prev === 'closed' ? 'reconnecting' : 'connecting'));

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      ip: currentIdentity?.ip || '10.84.0.2',
      protocol: settings.protocol,
      pqc: settings.postQuantumKex,
      connected: String(isConnected),
      country: currentIdentity?.country || 'Suisse',
    });
    const url = `${wsProto}//${window.location.host}/api/ws/packet-stream?${params.toString()}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmountedRef.current) return;
      setWsState('open');
      ws.send(JSON.stringify({ action: 'ping', clientTs: Date.now() }));
      if (isPaused) {
        ws.send(JSON.stringify({ action: 'pause' }));
      }
      if (intervalMs !== 500) {
        ws.send(JSON.stringify({ action: 'set_rate', intervalMs }));
      }
    };

    ws.onmessage = (event) => {
      if (isUnmountedRef.current) return;
      try {
        const msg = JSON.parse(event.data) as {
          type?: string;
          sessionId?: string;
          intervalMs?: number;
          paused?: boolean;
          recentPackets?: LiveStreamPacket[];
          packet?: LiveStreamPacket;
          packets?: LiveStreamPacket[];
          clientTs?: number;
        };

        if (msg.type === 'init') {
          if (msg.sessionId) setWsSessionId(msg.sessionId);
          if (Array.isArray(msg.recentPackets)) {
            appendPacketsIdempotent(msg.recentPackets);
          }
        } else if (msg.type === 'packet' && msg.packet) {
          appendPacketsIdempotent([msg.packet]);
        } else if (msg.type === 'burst' && Array.isArray(msg.packets)) {
          appendPacketsIdempotent(msg.packets);
        } else if (msg.type === 'pong' && typeof msg.clientTs === 'number') {
          setWsRttMs(Math.max(1, Date.now() - msg.clientTs));
        } else if (msg.type === 'cleared') {
          seenIdsRef.current.clear();
          setPackets([]);
          setSelectedPacket(null);
          setTotalCaptured(0);
          setTotalBytes(0);
          setDroppedCount(0);
        }
      } catch {
        // Ignore malformed frame
      }
    };

    ws.onclose = () => {
      if (isUnmountedRef.current) return;
      setWsState('reconnecting');
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 2200);
    };

    ws.onerror = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [
    currentIdentity?.ip,
    currentIdentity?.country,
    settings.protocol,
    settings.postQuantumKex,
    isConnected,
    isPaused,
    intervalMs,
    appendPacketsIdempotent,
  ]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connectWebSocket();

    pingIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'ping', clientTs: Date.now() }));
      }
    }, 5000);

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) window.clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Auto-scroll packet table when receiving new frames
  useEffect(() => {
    if (autoScroll && tableContainerRef.current) {
      tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
    }
  }, [packets.length, autoScroll]);

  const sendWsControl = (payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    sendWsControl({ action: nextPaused ? 'pause' : 'resume' });
  };

  const handleChangeRate = (ms: number) => {
    setIntervalMs(ms);
    sendWsControl({ action: 'set_rate', intervalMs: ms });
  };

  const handleClearBuffer = () => {
    seenIdsRef.current.clear();
    setPackets([]);
    setSelectedPacket(null);
    setTotalCaptured(0);
    setTotalBytes(0);
    setDroppedCount(0);
    sendWsControl({ action: 'clear' });
  };

  const handleInjectBurst = (
    kind: 'https' | 'dns_leak' | 'port_scan' | 'pqc_handshake'
  ) => {
    sendWsControl({ action: 'inject_burst', kind });
    if (addLog) {
      const labels: Record<typeof kind, string> = {
        https: 'Rafale TLSv1.3 injectée sur le flux WebSocket',
        dns_leak: 'Tentative de fuite DNS UDP/53 simulée via WebSocket (DROP)',
        port_scan: 'Sonde Xmas/SYN suspecte injectée sur eth0 (QUARANTINE)',
        pqc_handshake: `Renégociation Post-Quantique ${settings.postQuantumKex.toUpperCase()} émise`,
      };
      addLog(
        `[Moniteur de Flux] ${labels[kind]}`,
        kind === 'port_scan' || kind === 'dns_leak' ? 'warning' : 'info',
        currentIdentity?.ip
      );
    }
  };

  const filteredPackets = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return packets.filter((pkt) => {
      if (protocolFilter !== 'ALL' && pkt.protocol !== protocolFilter) return false;
      if (verdictFilter === 'BLOCKED') {
        if (pkt.verdict !== 'DROP' && pkt.verdict !== 'QUARANTINE') return false;
      } else if (verdictFilter !== 'ALL' && pkt.verdict !== verdictFilter) {
        return false;
      }
      if (!q) return true;
      return (
        pkt.srcIp.toLowerCase().includes(q) ||
        pkt.dstIp.toLowerCase().includes(q) ||
        pkt.protocol.toLowerCase().includes(q) ||
        pkt.info.toLowerCase().includes(q) ||
        pkt.iface.toLowerCase().includes(q) ||
        String(pkt.dstPort).includes(q) ||
        String(pkt.srcPort).includes(q)
      );
    });
  }, [packets, searchFilter, protocolFilter, verdictFilter]);

  const protocolStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pkt of packets) {
      counts.set(pkt.protocol, (counts.get(pkt.protocol) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [packets]);

  const dominantProtocol = protocolStats[0]?.[0] || 'WireGuard';

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'Renumerate FlowMonitor WebSocket Tap (/api/ws/packet-stream)',
      wsSessionId,
      totalCaptured,
      packets: filteredPackets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wireshark-flow-${wsSessionId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTxt = () => {
    const header = [
      `# Renumerate VPN · Moniteur de Flux WebSocket (${wsSessionId})`,
      `# Exporté le ${new Date().toISOString()} · ${filteredPackets.length} trames`,
      'No.\tTime\t\tSource\t\t\tDestination\t\tProtocol\tLength\tVerdict\tInfo',
      '-------------------------------------------------------------------------------------------------------------',
    ];
    const lines = filteredPackets.map(
      (p) =>
        `${p.seq}\t${p.timeStr}\t${p.srcIp}:${p.srcPort}\t-> ${p.dstIp}:${p.dstPort}\t${p.protocol}\t\t${p.lengthBytes}B\t${p.verdict}\t${p.info}`
    );
    const blob = new Blob([[...header, ...lines].join('\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capture-flux-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyHexDump = () => {
    if (!selectedPacket) return;
    const text = `Frame #${selectedPacket.seq} (${selectedPacket.lengthBytes} bytes) on ${selectedPacket.iface}\n${selectedPacket.srcIp}:${selectedPacket.srcPort} -> ${selectedPacket.dstIp}:${selectedPacket.dstPort} [${selectedPacket.protocol}]\n\n${selectedPacket.hexDump}`;
    navigator.clipboard.writeText(text);
    setCopiedDump(true);
    setTimeout(() => setCopiedDump(false), 1800);
  };

  const getRowColorClasses = (pkt: LiveStreamPacket, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-cyan-500/15 dark:bg-cyan-500/20 text-slate-900 dark:text-white';
    }
    if (pkt.verdict === 'QUARANTINE') {
      return 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-900 dark:text-rose-200';
    }
    if (pkt.verdict === 'DROP') {
      return 'bg-amber-500/10 hover:bg-amber-500/15 text-amber-900 dark:text-amber-200';
    }
    if (pkt.protocol === 'DNS/DoH') {
      return 'bg-sky-500/5 hover:bg-sky-500/10 text-slate-800 dark:text-slate-200';
    }
    if (pkt.protocol === 'TLSv1.3' || pkt.protocol === 'WireGuard') {
      return 'bg-emerald-500/5 hover:bg-emerald-500/10 text-slate-800 dark:text-slate-200';
    }
    return 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200';
  };

  const formatBytesHuman = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs ${className}`}
    >
      {/* En-tête Moniteur de Flux */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Moniteur de Flux · Capture Paquets WebSocket
              </h2>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border inline-flex items-center gap-1.5 ${
                  wsState === 'open' && !isPaused
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : wsState === 'open' && isPaused
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                {wsState === 'open' ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                <span>
                  {wsState === 'open'
                    ? isPaused
                      ? 'WS Connecté (Pause)'
                      : 'WS Live'
                    : wsState === 'reconnecting'
                    ? 'Reconnexion WS...'
                    : 'Connexion WS...'}
                </span>
              </span>
              {wsRttMs !== null && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  RTT WS : {wsRttMs} ms · {wsSessionId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Flux bidirectionnel temps réel via <code className="font-mono text-cyan-600 dark:text-cyan-400">/api/ws/packet-stream</code> : inspection type Wireshark des protocoles, adresses IP source/destination, ports, tailles et verdicts Netfilter.
            </p>
          </div>
        </div>

        {/* Contrôles WebSocket & Export */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700/70 text-[11px] font-mono">
            {[
              { label: '200ms', ms: 200 },
              { label: '500ms', ms: 500 },
              { label: '1.2s', ms: 1200 },
            ].map((opt) => (
              <button
                key={opt.ms}
                type="button"
                onClick={() => handleChangeRate(opt.ms)}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  intervalMs === opt.ms
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={`Cadence d'échantillonnage serveur : ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleTogglePause}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Reprendre WS</span>
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
            onClick={handleClearBuffer}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:text-rose-500 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Réinitialiser la capture et la séquence serveur"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={filteredPackets.length === 0}
            className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exporter la capture au format JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportTxt}
            disabled={filteredPackets.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exporter le journal texte Wireshark (.txt)"
          >
            <FileCode2 className="w-3.5 h-3.5 text-cyan-500" />
            <span>TXT</span>
          </button>
        </div>
      </div>

      {/* Bandeau Métriques Live */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 font-bold">TRAMES CAPTURÉES</div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {totalCaptured}{' '}
            <span className="text-[11px] font-normal text-slate-400">
              ({packets.length} en tampon)
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 font-bold">VOLUME TRANSFÉRÉ</div>
          <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 mt-0.5">
            {formatBytesHuman(totalBytes)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 font-bold">BLOQUÉS / PARE-FEU</div>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {droppedCount}{' '}
            <span className="text-[11px] font-normal text-slate-400">DROP / XDP</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 font-bold">PROTOCOLE DOMINANT</div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {dominantProtocol}
          </div>
        </div>
      </div>

      {/* Barre de Filtres type Wireshark & Injections WebSocket */}
      <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtre d'affichage (ex: 1.1.1.1, wg0, 443, DoH, DROP, WireGuard)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'WireGuard', 'TLSv1.3', 'DNS/DoH', 'QUIC', 'TCP', 'SSH'].map((proto) => (
              <button
                key={proto}
                type="button"
                onClick={() => setProtocolFilter(proto)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  protocolFilter === proto
                    ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-cyan-500'
                }`}
              >
                {proto === 'ALL' ? 'Tous protocoles' : proto}
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setVerdictFilter((v) => (v === 'BLOCKED' ? 'ALL' : 'BLOCKED'))
              }
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer border ${
                verdictFilter === 'BLOCKED'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 hover:border-rose-500'
              }`}
            >
              Uniquement DROP / Bloqué
            </button>
          </div>
        </div>

        {/* Tests d'injection côté serveur via WebSocket */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">
              Émettre via WebSocket :
            </span>
            <button
              type="button"
              onClick={() => handleInjectBurst('https')}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>+ Rafale TLSv1.3</span>
            </button>
            <button
              type="button"
              onClick={() => handleInjectBurst('pqc_handshake')}
              className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/25 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Cpu className="w-3 h-3" />
              <span>+ Handshake PQC</span>
            </button>
            <button
              type="button"
              onClick={() => handleInjectBurst('dns_leak')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              <span>+ Fuite DNS (DROP)</span>
            </button>
            <button
              type="button"
              onClick={() => handleInjectBurst('port_scan')}
              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/25 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ShieldAlert className="w-3 h-3" />
              <span>+ Scan Xmas (Quarantaine)</span>
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded accent-cyan-500"
            />
            <span>Défilement auto</span>
          </label>
        </div>
      </div>

      {/* Tableau Liste de Paquets (Wireshark Packet List) */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse font-mono text-[11px] tabular-nums">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 px-2.5 font-semibold">N°</th>
                <th className="py-2 px-2.5 font-semibold">Horodatage</th>
                <th className="py-2 px-2 font-semibold">If</th>
                <th className="py-2 px-2.5 font-semibold">Source IP:Port</th>
                <th className="py-2 px-2.5 font-semibold">Destination IP:Port</th>
                <th className="py-2 px-2.5 font-semibold">Protocole</th>
                <th className="py-2 px-2 font-semibold text-right">Taille</th>
                <th className="py-2 px-2 font-semibold text-center">Verdict</th>
                <th className="py-2 px-3 font-semibold">Info / Drapeaux</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredPackets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Aucune trame ne correspond aux critères de capture actuels.
                  </td>
                </tr>
              ) : (
                filteredPackets.map((pkt) => {
                  const isSelected = selectedPacket?.id === pkt.id;
                  return (
                    <tr
                      key={pkt.id}
                      onClick={() => setSelectedPacket(pkt)}
                      className={`cursor-pointer transition-colors ${getRowColorClasses(
                        pkt,
                        isSelected
                      )}`}
                    >
                      <td className="py-1.5 px-2.5 text-slate-500 font-semibold">
                        {pkt.seq}
                      </td>
                      <td className="py-1.5 px-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {pkt.timeStr}
                      </td>
                      <td className="py-1.5 px-2 font-bold text-slate-700 dark:text-slate-300">
                        {pkt.iface}
                      </td>
                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                        {pkt.srcIp}
                        <span className="text-slate-400">:{pkt.srcPort}</span>
                      </td>
                      <td className="py-1.5 px-2.5 whitespace-nowrap font-semibold">
                        {pkt.dstIp}
                        <span className="text-slate-400 font-normal">:{pkt.dstPort}</span>
                      </td>
                      <td className="py-1.5 px-2.5 font-bold whitespace-nowrap">
                        <span
                          className={
                            pkt.protocol === 'WireGuard'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : pkt.protocol === 'TLSv1.3'
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : pkt.protocol === 'DNS/DoH'
                              ? 'text-sky-600 dark:text-sky-400'
                              : pkt.protocol === 'QUIC'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-purple-600 dark:text-purple-400'
                          }
                        >
                          {pkt.protocol}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {pkt.lengthBytes} o
                      </td>
                      <td className="py-1.5 px-2 text-center whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            pkt.verdict === 'QUARANTINE'
                              ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400'
                              : pkt.verdict === 'DROP'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {pkt.verdict}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 truncate max-w-[300px] text-slate-600 dark:text-slate-300">
                        <span className="text-[10px] px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mr-1.5">
                          {pkt.flags}
                        </span>
                        {pkt.info}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panneau Inspecteur Détaillé & Hex/ASCII (Wireshark Packet Bytes) */}
      {selectedPacket && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-500" />
              <span className="font-bold text-slate-900 dark:text-white">
                Trame #{selectedPacket.seq} · {selectedPacket.protocol} ({selectedPacket.lengthBytes} octets)
              </span>
              <span className="font-mono text-slate-400 text-[11px]">
                [{selectedPacket.timeStr}]
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyHexDump}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500 flex items-center gap-1 cursor-pointer"
              >
                {copiedDump ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copier Hex</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPacket(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer px-1.5"
              >
                Fermer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px]">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold">COUCHE LIAISON &amp; RÉSEAU</div>
              <div className="text-slate-800 dark:text-slate-200">
                Interface : <b>{selectedPacket.iface}</b> ({selectedPacket.direction === 'out' ? 'Sortant' : 'Entrant'})
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                TTL : {selectedPacket.ttl} · Longueur : {selectedPacket.lengthBytes} o
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold">TRANSPORT &amp; EXTRÉMITÉS</div>
              <div className="text-slate-800 dark:text-slate-200 truncate">
                Src : <b>{selectedPacket.srcIp}:{selectedPacket.srcPort}</b>
              </div>
              <div className="text-slate-800 dark:text-slate-200 truncate">
                Dst : <b>{selectedPacket.dstIp}:{selectedPacket.dstPort}</b>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold">VERDICT NETFILTER</div>
              <div className="font-bold text-cyan-600 dark:text-cyan-400">
                {selectedPacket.verdict} · Drapeaux [{selectedPacket.flags}]
              </div>
              <div className="text-slate-500 text-[10px] truncate">{selectedPacket.info}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            <pre className="p-3 bg-slate-950 text-cyan-400 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed">
              {selectedPacket.hexDump}
            </pre>
            <pre className="p-3 bg-slate-950 text-slate-300 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed">
              {selectedPacket.asciiDump}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
