import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Copy,
  FileSearch,
  Layers,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import {
  AppSettings,
  ConnectionMode,
  IntrusionDefenseAction,
  IntrusionSeverity,
  SecurityReport,
} from '../types';
import {
  analyzeSecurity,
  DeepAuditResult,
  performDeepAudit,
} from '../services/geminiService';

export interface PacketFlowSample {
  id: string;
  seq: number;
  timeLabel: string;
  sourceIp: string;
  sourceCountry: string;
  targetPort: number;
  protocol: 'TCP' | 'UDP' | 'DNS' | 'ARP' | 'ICMP';
  category:
    | 'nominal'
    | 'port_scan'
    | 'replay_attack'
    | 'c2_beacon'
    | 'webrtc_leak'
    | 'brute_force'
    | 'dns_hijack';
  categoryLabel: string;
  severity: IntrusionSeverity | 'nominal';
  signatureRule: string;
  mitreId: string;
  anomalyScore: number;
  confidencePct: number;
  shannonEntropy: number;
  packetRatePps: number;
  payloadKbps: number;
  actionTaken: IntrusionDefenseAction | 'allow_tunnel';
  quarantined: boolean;
  featureWeights: {
    entropyDelta: number;
    burstRatio: number;
    periodicity: number;
    signatureMatch: number;
  };
}

export interface MatchedThreatSignatureInfo {
  id: string;
  ruleCode: string;
  label: string;
  mitreId: string;
  protocol: string;
  port: number;
  severity: IntrusionSeverity;
  description: string;
  matchPct: number;
}

export interface PacketInspectionModalProps {
  isOpen: boolean;
  sample: PacketFlowSample | null;
  destinationIp: string;
  mode: ConnectionMode;
  settings: AppSettings;
  matchedSignatures: MatchedThreatSignatureInfo[];
  onClose: () => void;
  onQuarantineSample?: (sampleId: string) => void;
  onHardenIds?: () => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type HexLayerFocus = 'all' | 'ip' | 'l4' | 'payload';

interface HexRow {
  offsetHex: string;
  startIndex: number;
  bytes: number[];
  ascii: string;
}

function parseIpv4Octets(ip: string, fallback: [number, number, number, number]): [number, number, number, number] {
  const parts = ip.split('.').map((n) => Number.parseInt(n, 10));
  if (
    parts.length === 4 &&
    parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)
  ) {
    return [parts[0], parts[1], parts[2], parts[3]];
  }
  return fallback;
}

function computeIpv4Checksum(header20: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 20; i += 2) {
    if (i === 10) continue; // checksum field
    sum += (header20[i] << 8) | header20[i + 1];
  }
  while (sum >> 16) {
    sum = (sum & 0xffff) + (sum >> 16);
  }
  return (~sum) & 0xffff;
}

function buildOffendingPacketBytes(
  sample: PacketFlowSample,
  destinationIp: string
): {
  bytes: Uint8Array;
  decoded: {
    versionIhl: string;
    totalLength: number;
    ttl: number;
    ipProtoHex: string;
    ipProtoName: string;
    checksumHex: string;
    srcPort: number;
    dstPort: number;
    flagsLabel: string;
  };
} {
  const srcOctets = parseIpv4Octets(sample.sourceIp, [185, 220, 101, 45]);
  const dstOctets = parseIpv4Octets(destinationIp, [10, 66, 0, 1]);

  let payloadAscii = 'GET /gate?sid=beacon HTTP/1.1\r\n';
  let flagsLabel = 'PSH, ACK (0x18)';
  let tcpFlagsByte = 0x18;
  let ipProtoByte = 0x06;
  let ipProtoName = 'TCP (0x06)';

  if (sample.protocol === 'UDP' || sample.protocol === 'DNS') {
    ipProtoByte = 0x11;
    ipProtoName = 'UDP (0x11)';
    flagsLabel = sample.protocol === 'DNS' ? 'DNS QR=0 RD=1' : 'UDP Datagrame';
  } else if (sample.protocol === 'ICMP') {
    ipProtoByte = 0x01;
    ipProtoName = 'ICMP (0x01)';
    flagsLabel = 'Echo Request (0x08)';
  }

  switch (sample.category) {
    case 'port_scan':
      tcpFlagsByte = 0x02;
      flagsLabel = 'SYN Furtif (0x02)';
      payloadAscii = 'SYN-SWEEP::MSS=1460;WSCALE=7;SACK_PERM\x00';
      break;
    case 'replay_attack':
      flagsLabel = 'WG Transport (0x04) Rejeu';
      payloadAscii = '\x04\x00\x00\x00WG-PQC-REPLAY-CTR=0000001A\x9e\xfa\xc1\x19';
      break;
    case 'c2_beacon':
      payloadAscii = `\x8a\x14\x01\x00\x00\x01\x07x9k2mqa\x04c2beacon\x03net\x00\x00\x10\x00\x01`;
      break;
    case 'webrtc_leak':
      flagsLabel = 'STUN Binding Req (0x0001)';
      payloadAscii = '\x00\x01\x00\x08\x21\x12\xa4\x42STUN-ICE-PROBE\x00\x03\x00\x04';
      break;
    case 'brute_force':
      tcpFlagsByte = 0x18;
      flagsLabel = 'PSH, ACK (0x18) Auth';
      payloadAscii = 'SSH-2.0-libssh_0.9.6\r\nUSER root PASS ****\x00';
      break;
    case 'dns_hijack':
      payloadAscii = '\x4f\x21\x81\x80\x00\x01\x00\x01KAMINSKY-TXID-MISMATCH\x00';
      break;
    default:
      payloadAscii = 'PQC-TUNNEL-FRAME-VERIFIED\x00';
      break;
  }

  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payloadAscii);
  const headerLen = 40; // 20B IPv4 + 20B L4 header
  const totalLen = Math.min(80, Math.max(64, headerLen + payloadBytes.length));
  const frame = new Uint8Array(totalLen);

  // 1. IPv4 Header (0x00..0x13)
  frame[0] = 0x45; // Version 4, IHL 5 (20 bytes)
  frame[1] = 0x00; // DSCP / ECN
  frame[2] = (totalLen >> 8) & 0xff;
  frame[3] = totalLen & 0xff;
  const ipId = (0x4a00 + (sample.seq & 0x0fff)) & 0xffff;
  frame[4] = (ipId >> 8) & 0xff;
  frame[5] = ipId & 0xff;
  frame[6] = 0x40; // Don't Fragment
  frame[7] = 0x00;
  frame[8] = 0x38; // TTL 56
  frame[9] = ipProtoByte;
  frame[10] = 0x00;
  frame[11] = 0x00;
  frame[12] = srcOctets[0];
  frame[13] = srcOctets[1];
  frame[14] = srcOctets[2];
  frame[15] = srcOctets[3];
  frame[16] = dstOctets[0];
  frame[17] = dstOctets[1];
  frame[18] = dstOctets[2];
  frame[19] = dstOctets[3];

  const checksum = computeIpv4Checksum(frame);
  frame[10] = (checksum >> 8) & 0xff;
  frame[11] = checksum & 0xff;

  // 2. L4 Transport Header (0x14..0x27)
  const srcPort = 41000 + ((sample.seq * 37) % 20000);
  const dstPort = sample.targetPort & 0xffff;
  frame[20] = (srcPort >> 8) & 0xff;
  frame[21] = srcPort & 0xff;
  frame[22] = (dstPort >> 8) & 0xff;
  frame[23] = dstPort & 0xff;

  if (ipProtoByte === 0x11) {
    // UDP header padded to 20 bytes boundary for clean alignment with tunnel encapsulation header
    const udpLen = totalLen - 20;
    frame[24] = (udpLen >> 8) & 0xff;
    frame[25] = udpLen & 0xff;
    frame[26] = 0x9b;
    frame[27] = 0x4e;
    // Pseudo-encapsulation / Tunnel header bytes (0x1C..0x27)
    frame[28] = 0x04;
    frame[29] = 0x00;
    frame[30] = (sample.seq >> 8) & 0xff;
    frame[31] = sample.seq & 0xff;
    for (let i = 32; i < 40; i++) {
      frame[i] = ((sample.seq + i * 19) ^ 0x5a) & 0xff;
    }
  } else {
    // TCP 20-byte header
    frame[24] = (sample.seq >> 24) & 0xff;
    frame[25] = (sample.seq >> 16) & 0xff;
    frame[26] = (sample.seq >> 8) & 0xff;
    frame[27] = sample.seq & 0xff;
    frame[28] = 0x00;
    frame[29] = 0x00;
    frame[30] = 0x00;
    frame[31] = 0x01;
    frame[32] = 0x50; // Data offset = 5 (20 bytes)
    frame[33] = tcpFlagsByte;
    frame[34] = 0xfa; // Window 64240
    frame[35] = 0xf0;
    frame[36] = 0xc3; // Checksum
    frame[37] = 0x71;
    frame[38] = 0x00;
    frame[39] = 0x00;
  }

  // 3. Payload bytes (0x28..)
  for (let i = headerLen; i < totalLen; i++) {
    const pIdx = i - headerLen;
    frame[i] =
      pIdx < payloadBytes.length
        ? payloadBytes[pIdx]
        : ((sample.seq * 13 + i * 7) & 0x7e) | 0x20;
  }

  return {
    bytes: frame,
    decoded: {
      versionIhl: '0x45 (IPv4 · 20 o)',
      totalLength: totalLen,
      ttl: 56,
      ipProtoHex: `0x${ipProtoByte.toString(16).padStart(2, '0').toUpperCase()}`,
      ipProtoName,
      checksumHex: `0x${checksum.toString(16).padStart(4, '0').toUpperCase()}`,
      srcPort,
      dstPort,
      flagsLabel,
    },
  };
}

function buildHexRows(bytes: Uint8Array): HexRow[] {
  const rows: HexRow[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const slice = Array.from(bytes.slice(offset, offset + 16));
    const ascii = slice
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    rows.push({
      offsetHex: `0x${offset.toString(16).padStart(4, '0').toUpperCase()}`,
      startIndex: offset,
      bytes: slice,
      ascii,
    });
  }
  return rows;
}

export const PacketInspectionModal: React.FC<PacketInspectionModalProps> = ({
  isOpen,
  sample,
  destinationIp,
  mode,
  settings,
  matchedSignatures,
  onClose,
  onQuarantineSample,
  onHardenIds,
  addLog,
}) => {
  const [layerFocus, setLayerFocus] = useState<HexLayerFocus>('all');
  const [copiedHex, setCopiedHex] = useState<boolean>(false);
  const [sampleSha256, setSampleSha256] = useState<string>('');
  const [isSubmittingDeepAnalysis, setIsSubmittingDeepAnalysis] =
    useState<boolean>(false);
  const [deepAnalysisData, setDeepAnalysisData] = useState<{
    deepAudit: DeepAuditResult;
    securityReport: SecurityReport;
    submittedAt: string;
  } | null>(null);

  useEffect(() => {
    setDeepAnalysisData(null);
    setLayerFocus('all');
    setCopiedHex(false);
  }, [sample?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const packet = useMemo(() => {
    if (!sample) return null;
    return buildOffendingPacketBytes(sample, destinationIp);
  }, [sample, destinationIp]);

  const hexRows = useMemo(() => {
    if (!packet) return [];
    return buildHexRows(packet.bytes);
  }, [packet]);

  useEffect(() => {
    if (!packet) {
      setSampleSha256('');
      return;
    }
    let cancelled = false;
    const computeDigest = async () => {
      try {
        if (window.crypto?.subtle) {
          const copyBuf = new Uint8Array(packet.bytes).buffer;
          const hash = await window.crypto.subtle.digest('SHA-256', copyBuf);
          const hex = Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
          if (!cancelled) setSampleSha256(hex);
          return;
        }
      } catch {
        // Fallback below
      }
      if (!cancelled) {
        setSampleSha256(
          Array.from(packet.bytes.slice(0, 16))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
        );
      }
    };
    void computeDigest();
    return () => {
      cancelled = true;
    };
  }, [packet]);

  if (!isOpen || !sample || !packet) return null;

  const handleCopyHex = async () => {
    const formatted = hexRows
      .map(
        (r) =>
          `${r.offsetHex}  ${r.bytes
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ')
            .padEnd(47, ' ')}  |${r.ascii}|`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedHex(true);
      window.setTimeout(() => setCopiedHex(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleSubmitDeepSecurityAnalysis = async () => {
    setIsSubmittingDeepAnalysis(true);
    try {
      const locationLabel = `${sample.sourceCountry} · ${sample.protocol}/${sample.targetPort}`;
      const [deepAudit, securityReport] = await Promise.all([
        performDeepAudit(sample.sourceIp, locationLabel),
        analyzeSecurity(mode, locationLabel, sample.sourceIp, {
          protocol: settings.protocol,
          killSwitch: settings.killSwitch,
          ipv6LeakProtection: settings.ipv6LeakProtection,
          forceRefresh: true,
        }),
      ]);

      setDeepAnalysisData({
        deepAudit,
        securityReport,
        submittedAt: new Date().toLocaleTimeString('fr-FR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });

      addLog?.(
        `[Sentinel-IA · DPI] Échantillon ${sample.signatureRule} (${sample.sourceIp}) soumis à l'analyse approfondie — Niveau ${securityReport.threatLevel}`,
        deepAudit.isBlacklisted || securityReport.score < 70 ? 'error' : 'info',
        sample.sourceIp
      );
    } finally {
      setIsSubmittingDeepAnalysis(false);
    }
  };

  const getByteColorClass = (byteIndex: number): string => {
    const isIp = byteIndex < 20;
    const isL4 = byteIndex >= 20 && byteIndex < 40;
    const isPayload = byteIndex >= 40;

    if (layerFocus !== 'all') {
      if (layerFocus === 'ip' && !isIp) return 'text-slate-600 opacity-35';
      if (layerFocus === 'l4' && !isL4) return 'text-slate-600 opacity-35';
      if (layerFocus === 'payload' && !isPayload) return 'text-slate-600 opacity-35';
    }

    if (isIp) return 'text-cyan-300';
    if (isL4) return 'text-amber-300';
    return 'text-rose-300 font-semibold';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="packet-inspection-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/60">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileSearch className="w-4 h-4 text-rose-500 shrink-0" />
              <h3
                id="packet-inspection-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate"
              >
                Inspection Paquet DPI en Temps Réel — {sample.categoryLabel}
              </h3>
              <span className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400">
                Score {sample.anomalyScore}% · {sample.severity.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              {sample.sourceIp} ({sample.sourceCountry}) → {destinationIp}:
              {sample.targetPort} · {sample.protocol} · {sample.timeLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l’inspection de paquets"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Decoded Header Fields Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
            <div className="p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                En-tête IPv4
              </div>
              <div className="mt-0.5 font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                {packet.decoded.versionIhl}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                TTL {packet.decoded.ttl} · CSUM {packet.decoded.checksumHex}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Transport L4
              </div>
              <div className="mt-0.5 font-mono font-semibold text-amber-700 dark:text-amber-400">
                {packet.decoded.ipProtoName}
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate">
                {packet.decoded.srcPort} → {packet.decoded.dstPort}
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Fanions &amp; Taille
              </div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white truncate">
                {packet.decoded.flagsLabel}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {packet.decoded.totalLength} octets · {sample.shannonEntropy} b/o
              </div>
            </div>

            <div className="p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Empreinte SHA-256
              </div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white truncate">
                {sampleSha256 ? `${sampleSha256.slice(0, 14)}…` : 'Calcul...'}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Confiance {sample.confidencePct}% · {sample.mitreId}
              </div>
            </div>
          </div>

          {/* Hexadecimal Headers & Payload Dissector */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                <span>En-têtes hexadécimaux &amp; charge capturée</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'Trame complète' },
                    { id: 'ip', label: 'IPv4 (0x00–0x13)' },
                    { id: 'l4', label: 'L4 (0x14–0x27)' },
                    { id: 'payload', label: 'Signature (0x28+)' },
                  ] as const
                ).map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setLayerFocus(layer.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      layerFocus === layer.id
                        ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {layer.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => void handleCopyHex()}
                  className="px-2 py-1 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedHex ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedHex ? 'Copié' : 'Copier Hex'}</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 overflow-x-auto font-mono text-[11px] leading-relaxed">
              <div className="flex items-center gap-4 text-[10px] text-slate-500 border-b border-slate-800 pb-2 mb-2 min-w-[600px]">
                <span className="w-16 shrink-0">OFFSET</span>
                <span className="flex-1">
                  00 01 02 03 04 05 06 07 · 08 09 0A 0B 0C 0D 0E 0F
                </span>
                <span className="w-36 shrink-0 text-right">ASCII</span>
              </div>

              <div className="space-y-1 min-w-[600px]">
                {hexRows.map((row) => (
                  <div
                    key={row.offsetHex}
                    className="flex items-center gap-4 hover:bg-slate-900/80 px-1 rounded"
                  >
                    <span className="w-16 shrink-0 text-slate-500 select-none">
                      {row.offsetHex}
                    </span>

                    <div className="flex-1 flex flex-wrap items-center gap-x-1.5">
                      {row.bytes.map((b, i) => {
                        const absIdx = row.startIndex + i;
                        return (
                          <React.Fragment key={absIdx}>
                            {i === 8 && (
                              <span className="text-slate-700 select-none">·</span>
                            )}
                            <span className={getByteColorClass(absIdx)}>
                              {b.toString(16).padStart(2, '0').toUpperCase()}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <span className="w-36 shrink-0 text-right text-slate-400 tracking-wider">
                      {row.ascii}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Matching Threat Signatures */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Layers className="w-3.5 h-3.5 text-rose-500" />
              <span>
                Signatures de menaces correspondantes ({matchedSignatures.length})
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
              {matchedSignatures.map((sig) => (
                <div
                  key={sig.id}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {sig.label}
                      </span>
                      <span className="font-mono text-[11px] text-cyan-700 dark:text-cyan-400">
                        {sig.ruleCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {sig.description}
                    </p>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums text-[11px]">
                    <div
                      className={`font-bold ${
                        sig.severity === 'critical'
                          ? 'text-rose-600 dark:text-rose-400'
                          : sig.severity === 'high'
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      Correspondance {sig.matchPct}%
                    </div>
                    <div className="text-slate-500">
                      MITRE {sig.mitreId} · {sig.protocol}/{sig.port}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deep Security Analysis Result */}
          {deepAnalysisData && (
            <div className="border border-cyan-500/35 bg-cyan-50/50 dark:bg-cyan-950/25 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Rapport d’analyse de sécurité approfondie</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {deepAnalysisData.submittedAt} · Niveau menace{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {deepAnalysisData.securityReport.threatLevel}
                  </span>{' '}
                  · Score {deepAnalysisData.securityReport.score}/100
                </div>
              </div>

              <div className="text-slate-700 dark:text-slate-200 leading-relaxed space-y-1.5">
                <p>{deepAnalysisData.deepAudit.analysis}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {deepAnalysisData.securityReport.analysis}
                </p>
              </div>

              {deepAnalysisData.securityReport.recommendations.length > 0 && (
                <div className="border-t border-cyan-500/20 pt-2.5 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    Recommandations de remédiation :
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                    {deepAnalysisData.securityReport.recommendations
                      .slice(0, 3)
                      .map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                  </ul>
                </div>
              )}

              {deepAnalysisData.deepAudit.sources.length > 0 && (
                <div className="border-t border-cyan-500/20 pt-2 text-[11px] font-mono text-slate-500">
                  Sources vérifiées :{' '}
                  {deepAnalysisData.deepAudit.sources
                    .slice(0, 3)
                    .map((s) => s.title)
                    .join(' · ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {onQuarantineSample && (
              <button
                type="button"
                onClick={() => onQuarantineSample(sample.id)}
                disabled={sample.quarantined}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  sample.quarantined
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 cursor-default'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {sample.quarantined ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                <span>
                  {sample.quarantined
                    ? 'Hôte isolé (nftables)'
                    : 'Isoler hôte (nftables)'}
                </span>
              </button>
            )}

            {onHardenIds && (
              <button
                type="button"
                onClick={onHardenIds}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
              >
                Durcir IDS (Paranoïaque)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => void handleSubmitDeepSecurityAnalysis()}
              disabled={isSubmittingDeepAnalysis}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isSubmittingDeepAnalysis ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5" />
              )}
              <span>
                {isSubmittingDeepAnalysis
                  ? 'Analyse approfondie...'
                  : 'Soumettre à l’analyse approfondie'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
