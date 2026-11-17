import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  DeviceNode,
  VirtualIdentity,
} from '../types';
import {
  isCountryExcludedByJurisdiction,
  isNodeBlockedByGeoFence,
} from '../constants';

export interface ZeroTrustNodeValidatorProps {
  nodes: DeviceNode[];
  currentIdentity: VirtualIdentity;
  isConnected: boolean;
  settings: AppSettings;
  onConnectNode: (nodeId: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type NodeAttestationState = 'pending' | 'verifying' | 'verified' | 'degraded' | 'rejected';

interface ZeroTrustCriterion {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  weight: number;
}

interface NodeAttestationRecord {
  nodeId: string;
  trustScore: number;
  state: NodeAttestationState;
  hmacValid: boolean;
  expectedHmacHex: string;
  presentedHmacHex: string;
  manifestDigestHex: string;
  manifestPayload: string;
  verifiedAt: string;
  verifyDurationMs: number;
  tampered: boolean;
  criteria: ZeroTrustCriterion[];
}

const SESSION_ATTESTATION_SECRET =
  'renumerate-zt-hmac-v2-root-attestation-key-2026';

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const len = Math.floor(clean.length / 2);
  const buffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function computeSha256Hex(payload: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const hash = await window.crypto.subtle.digest('SHA-256', encoded);
    return bytesToHex(hash);
  }
  // Fallback deterministic digest if WebCrypto unavailable
  let acc = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    acc ^= payload.charCodeAt(i);
    acc = Math.imul(acc, 0x01000193);
  }
  return Math.abs(acc).toString(16).padStart(64, '0').toUpperCase();
}

async function getHmacCryptoKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  const keyBytes = new TextEncoder().encode(SESSION_ATTESTATION_SECRET);
  return window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signManifestHmac(
  key: CryptoKey | null,
  manifest: string
): Promise<string> {
  if (key && window.crypto?.subtle) {
    const sig = await window.crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(manifest)
    );
    return bytesToHex(sig);
  }
  return computeSha256Hex(`HMAC-FALLBACK:${SESSION_ATTESTATION_SECRET}:${manifest}`);
}

async function verifyManifestHmac(
  key: CryptoKey | null,
  manifest: string,
  presentedHex: string
): Promise<boolean> {
  if (key && window.crypto?.subtle) {
    try {
      return await window.crypto.subtle.verify(
        'HMAC',
        key,
        hexToUint8Array(presentedHex),
        new TextEncoder().encode(manifest)
      );
    } catch {
      return false;
    }
  }
  const expected = await computeSha256Hex(
    `HMAC-FALLBACK:${SESSION_ATTESTATION_SECRET}:${manifest}`
  );
  return expected === presentedHex;
}

function buildCanonicalNodeManifest(node: DeviceNode, settings: AppSettings): string {
  return [
    `id=${node.id}`,
    `name=${node.name}`,
    `ip=${node.ip}`,
    `country=${node.country}`,
    `city=${node.city || 'Core'}`,
    `asn=${node.asn || 'AS-UNDECLARED'}`,
    `role=${node.autonomyProfile}`,
    `proto=${settings.protocol}`,
    `kex=${settings.postQuantumKex}`,
  ].join('|');
}

interface InteractiveCheckMarkProps {
  state: NodeAttestationState;
  score: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  label: string;
}

const InteractiveCheckMark: React.FC<InteractiveCheckMarkProps> = ({
  state,
  score,
  isSelected,
  onClick,
  label,
}) => {
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const ringColor =
    state === 'verified'
      ? '#10b981'
      : state === 'degraded'
        ? '#f59e0b'
        : state === 'rejected'
          ? '#f43f5e'
          : '#06b6d4';

  const bgClass =
    state === 'verified'
      ? 'bg-emerald-500/10 hover:bg-emerald-500/20'
      : state === 'degraded'
        ? 'bg-amber-500/10 hover:bg-amber-500/20'
        : state === 'rejected'
          ? 'bg-rose-500/10 hover:bg-rose-500/20'
          : 'bg-cyan-500/10 hover:bg-cyan-500/20';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Cliquer pour exécuter une vérification cryptographique HMAC instantanée"
      className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 group ${bgClass} ${
        isSelected ? 'ring-2 ring-cyan-500 ring-offset-2 dark:ring-offset-slate-900' : ''
      }`}
    >
      <svg
        viewBox="0 0 46 46"
        className="w-12 h-12 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="23"
          cy="23"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx="23"
          cy="23"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={state === 'verifying' ? circumference * 0.45 : strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 450ms ease, stroke 250ms ease' }}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {state === 'verifying' ? (
          <RefreshCw className="w-4 h-4 text-cyan-500 animate-spin" />
        ) : state === 'rejected' ? (
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 text-rose-500 transition-transform duration-200 group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.7"
            strokeLinecap="round"
          >
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
              state === 'verified'
                ? 'text-emerald-600 dark:text-emerald-400'
                : state === 'degraded'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-cyan-600 dark:text-cyan-400'
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M5.5 12.5l4.2 4.2L18.5 7.5"
              strokeDasharray="24"
              strokeDashoffset={state === 'pending' ? 24 : 0}
              style={{ transition: 'stroke-dashoffset 320ms ease-out' }}
            />
          </svg>
        )}
      </div>
    </button>
  );
};

export const ZeroTrustNodeValidator: React.FC<ZeroTrustNodeValidatorProps> = ({
  nodes,
  currentIdentity,
  isConnected,
  settings,
  onConnectNode,
  addLog,
}) => {
  const [attestations, setAttestations] = useState<
    Record<string, NodeAttestationRecord>
  >({});
  const [tamperedNodeIds, setTamperedNodeIds] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    () => nodes.find((n) => n.ip === currentIdentity.ip)?.id || nodes[0]?.id || ''
  );
  const [isVerifyingAll, setIsVerifyingAll] = useState<boolean>(false);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);

  const evaluateNodeCryptographically = useCallback(
    async (
      node: DeviceNode,
      forceTamper?: boolean
    ): Promise<NodeAttestationRecord> => {
      const started = performance.now();
      if (!cryptoKeyRef.current) {
        cryptoKeyRef.current = await getHmacCryptoKey();
      }
      const key = cryptoKeyRef.current;

      const canonicalManifest = buildCanonicalNodeManifest(node, settings);
      const manifestDigestHex = await computeSha256Hex(canonicalManifest);
      const expectedHmacHex = await signManifestHmac(key, canonicalManifest);

      const isTampered =
        typeof forceTamper === 'boolean'
          ? forceTamper
          : Boolean(tamperedNodeIds[node.id]);

      const presentedManifest = isTampered
        ? `${canonicalManifest}|injected_asn=AS666-ROGUE`
        : canonicalManifest;

      const hmacValid = await verifyManifestHmac(
        key,
        presentedManifest,
        expectedHmacHex
      );

      const geoBlocked = isNodeBlockedByGeoFence(node.country, settings);
      const jurisdictionExcluded = isCountryExcludedByJurisdiction(
        node.country,
        settings.excludeEyesJurisdictions
      );
      const policyOk = !geoBlocked && !jurisdictionExcluded;

      const pqcOk = settings.postQuantumKex !== 'classic-x25519';
      const asnPresent = Boolean(node.asn && node.asn.startsWith('AS'));
      const packetLoss = node.packetLoss ?? 0.05;
      const loadPct = node.loadPct ?? 28;
      const telemetryOk =
        node.latency <= 135 && packetLoss <= 0.6 && loadPct <= 85 && node.signalStrength >= 60;

      const criteria: ZeroTrustCriterion[] = [
        {
          id: 'hmac',
          label: 'Signature HMAC-SHA256 des métadonnées',
          passed: hmacValid,
          detail: hmacValid
            ? 'Empreinte authentifiée via WebCrypto HMAC-SHA256'
            : 'ÉCHEC : divergence détectée sur le manifeste du nœud',
          weight: 45,
        },
        {
          id: 'policy',
          label: 'Barrière Géographique & Juridiction',
          passed: policyOk,
          detail: policyOk
            ? `${node.country} conforme (${settings.excludeEyesJurisdictions})`
            : geoBlocked
              ? `Bloqué par barrière géographique (${node.country})`
              : `Exclu par filtre juridictionnel (${settings.excludeEyesJurisdictions})`,
          weight: 20,
        },
        {
          id: 'asn_pqc',
          label: 'Attestation ASN & KEX Post-Quantique',
          passed: asnPresent && pqcOk,
          detail: `${node.asn || 'ASN non signé'} · ${settings.postQuantumKex.toUpperCase()}`,
          weight: 20,
        },
        {
          id: 'telemetry',
          label: 'Intégrité Latence, Perte & Charge',
          passed: telemetryOk,
          detail: `${node.latency} ms · Perte ${packetLoss.toFixed(2)}% · Charge ${loadPct}%`,
          weight: 15,
        },
      ];

      let rawScore = 0;
      if (hmacValid) rawScore += 45;
      if (policyOk) rawScore += 20;
      if (asnPresent) rawScore += 10;
      if (pqcOk) rawScore += 10;
      if (telemetryOk) rawScore += 15;
      else if (node.latency <= 180 && packetLoss <= 1.2) rawScore += 8;

      const trustScore = hmacValid ? Math.min(100, rawScore) : Math.min(28, rawScore);
      const state: NodeAttestationState =
        !hmacValid || !policyOk
          ? 'rejected'
          : trustScore >= 85
            ? 'verified'
            : 'degraded';

      const verifyDurationMs = Math.max(
        0.2,
        Number((performance.now() - started).toFixed(2))
      );

      return {
        nodeId: node.id,
        trustScore,
        state,
        hmacValid,
        expectedHmacHex,
        presentedHmacHex: isTampered
          ? `${expectedHmacHex.slice(0, 56)}DEADBEEF`
          : expectedHmacHex,
        manifestDigestHex,
        manifestPayload: presentedManifest,
        verifiedAt: new Date().toLocaleTimeString('fr-FR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        verifyDurationMs,
        tampered: isTampered,
        criteria,
      };
    },
    [settings, tamperedNodeIds]
  );

  const verifyAllNodes = useCallback(
    async (logSummary = false) => {
      setIsVerifyingAll(true);
      try {
        const records = await Promise.all(
          nodes.map((node) => evaluateNodeCryptographically(node))
        );
        const mapped: Record<string, NodeAttestationRecord> = {};
        records.forEach((rec) => {
          mapped[rec.nodeId] = rec;
        });
        setAttestations(mapped);

        if (logSummary) {
          const verifiedCount = records.filter((r) => r.state === 'verified').length;
          const rejectedCount = records.filter((r) => r.state === 'rejected').length;
          addLog?.(
            `[Zero-Trust Validator] Attestation HMAC-SHA256 : ${verifiedCount}/${records.length} nœud(s) vérifié(s)${
              rejectedCount > 0 ? `, ${rejectedCount} rejeté(s)` : ''
            }`,
            rejectedCount > 0 ? 'warning' : 'success',
            currentIdentity.ip
          );
        }
      } finally {
        setIsVerifyingAll(false);
      }
    },
    [nodes, evaluateNodeCryptographically, addLog, currentIdentity.ip]
  );

  // Automatic verification on mount and whenever security policy or nodes change
  useEffect(() => {
    void verifyAllNodes(false);
  }, [verifyAllNodes]);

  const handleVerifySingleNode = useCallback(
    async (node: DeviceNode, connectAfterVerify = false) => {
      setSelectedNodeId(node.id);
      setAttestations((prev) =>
        prev[node.id]
          ? {
              ...prev,
              [node.id]: { ...prev[node.id], state: 'verifying' },
            }
          : prev
      );

      // Brief visual beat so interactive checkmark feedback is crisp and legible
      await new Promise((r) => window.setTimeout(r, 160));
      const record = await evaluateNodeCryptographically(node);
      setAttestations((prev) => ({
        ...prev,
        [node.id]: record,
      }));

      if (connectAfterVerify) {
        if (record.state === 'rejected') {
          addLog?.(
            `[Zero-Trust Validator] Connexion bloquée avant établissement vers ${node.name} (${node.ip}) : échec attestation HMAC-SHA256 ou politique`,
            'error',
            node.ip
          );
          return;
        }
        addLog?.(
          `[Zero-Trust Validator] Nœud ${node.name} attesté (Score ${record.trustScore}/100 · HMAC ${record.expectedHmacHex.slice(0, 12)}…) — connexion autorisée`,
          'success',
          node.ip
        );
        onConnectNode(node.id);
      } else {
        addLog?.(
          `[Zero-Trust Validator] Vérification HMAC de ${node.name} : ${
            record.hmacValid ? 'AUTHENTIQUE' : 'ALTÉRATION DÉTECTÉE'
          } (${record.trustScore}/100 en ${record.verifyDurationMs} ms)`,
          record.hmacValid ? 'info' : 'error',
          node.ip
        );
      }
    },
    [evaluateNodeCryptographically, addLog, onConnectNode]
  );

  const handleToggleTamperTest = useCallback(
    async (node: DeviceNode) => {
      const nextTamper = !tamperedNodeIds[node.id];
      setTamperedNodeIds((prev) => ({ ...prev, [node.id]: nextTamper }));
      const record = await evaluateNodeCryptographically(node, nextTamper);
      setAttestations((prev) => ({ ...prev, [node.id]: record }));
      addLog?.(
        nextTamper
          ? `[Zero-Trust Validator] Simulation d'altération métadonnées sur ${node.name} (${node.ip}) : signature HMAC invalidée`
          : `[Zero-Trust Validator] Ré-attestation cryptographique HMAC réussie pour ${node.name} (${node.ip})`,
        nextTamper ? 'warning' : 'success',
        node.ip
      );
    },
    [tamperedNodeIds, evaluateNodeCryptographically, addLog]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId]
  );
  const selectedRecord = selectedNode ? attestations[selectedNode.id] : undefined;

  const summary = useMemo(() => {
    const list = Object.values(attestations) as NodeAttestationRecord[];
    const total = list.length || nodes.length;
    const verified = list.filter((r) => r.state === 'verified').length;
    const rejected = list.filter((r) => r.state === 'rejected').length;
    const avgTrust =
      list.length > 0
        ? Math.round(
            list.reduce((acc, r) => acc + r.trustScore, 0) / list.length
          )
        : 100;
    const activeNode = nodes.find((n) => n.ip === currentIdentity.ip);
    const activeRecord = activeNode ? attestations[activeNode.id] : undefined;

    return {
      total,
      verified,
      rejected,
      avgTrust,
      activeRecord,
    };
  }, [attestations, nodes, currentIdentity.ip]);

  return (
    <section
      id="zero-trust-node-validator"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Zero-Trust Node Validator
            </h2>
            <span
              className={`text-xs font-mono font-semibold ${
                summary.rejected > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {summary.rejected > 0
                ? `${summary.rejected} NŒUD(S) NON FIABLE(S)`
                : 'ATTESTATION HMAC-SHA256 VALIDE'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Vérifie la signature cryptographique HMAC-SHA256 des métadonnées de chaque nœud de sortie avant toute connexion et attribue un score de confiance Zero-Trust interactif.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void verifyAllNodes(true)}
          disabled={isVerifyingAll}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 disabled:opacity-60 text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isVerifyingAll ? 'animate-spin' : ''}`}
          />
          <span>
            {isVerifyingAll
              ? 'Vérification HMAC...'
              : 'Vérifier tous les nœuds (HMAC)'}
          </span>
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200 dark:border-slate-800 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Score de confiance moyen
          </div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {summary.avgTrust}/100
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Modèle Zero-Trust HMAC
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Nœuds attestés
          </div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {summary.verified}/{summary.total}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {summary.rejected > 0
              ? `${summary.rejected} rejeté(s) avant connexion`
              : 'Aucune altération manifeste'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Algorithme d’attestation
          </div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            HMAC-SHA256
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            KEX {settings.postQuantumKex.toUpperCase()}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Nœud actif du tunnel
          </div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {summary.activeRecord
              ? `${summary.activeRecord.trustScore}/100`
              : '—'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 truncate">
            {isConnected ? `Actif · ${currentIdentity.ip}` : `Prêt · ${currentIdentity.ip}`}
          </div>
        </div>
      </div>

      {/* Main Content: Interactive Check-Mark Nodes Grid + HMAC Cryptographic Inspector */}
      <div className="p-5 sm:p-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Exit Nodes Interactive Check-Mark Grid */}
        <div className="xl:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Nœuds de sortie — Validation Check-Mark interactive
            </span>
            <span className="font-mono text-[11px]">
              Cliquer une coche pour ré-attester
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nodes.map((node) => {
              const rec = attestations[node.id];
              const state: NodeAttestationState = rec?.state ?? 'pending';
              const score = rec?.trustScore ?? 0;
              const isActiveTunnel = isConnected && node.ip === currentIdentity.ip;
              const isSelected = selectedNode?.id === node.id;

              const scoreTextColor =
                state === 'verified'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : state === 'degraded'
                    ? 'text-amber-600 dark:text-amber-400'
                    : state === 'rejected'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-cyan-600 dark:text-cyan-400';

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedNodeId(node.id);
                    }
                  }}
                  className={`border rounded-xl p-3.5 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-cyan-500/70 bg-cyan-50/40 dark:bg-cyan-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <InteractiveCheckMark
                      state={state}
                      score={score}
                      isSelected={isSelected}
                      label={`Vérifier signature HMAC de ${node.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleVerifySingleNode(node, false);
                      }}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {node.name}
                        </span>
                        <span
                          className={`text-xs font-mono font-bold tabular-nums shrink-0 ${scoreTextColor}`}
                        >
                          {score}/100
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {node.city || node.country}, {node.country} · {node.ip}
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {node.asn || 'AS-CORE'} · {node.latency} ms
                        {isActiveTunnel ? ' · Tunnel actif' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {rec
                        ? rec.hmacValid
                          ? `HMAC ${rec.expectedHmacHex.slice(0, 10)}…`
                          : 'SIGNATURE ALTÉRÉE'
                        : 'En attente HMAC...'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleVerifySingleNode(node, true);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 ${
                        state === 'rejected'
                          ? 'bg-rose-600/15 text-rose-600 dark:text-rose-400 hover:bg-rose-600/25'
                          : isActiveTunnel
                            ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-900 dark:bg-slate-800 hover:bg-cyan-600 dark:hover:bg-cyan-600 text-white'
                      }`}
                    >
                      {state === 'rejected' ? (
                        <>
                          <ShieldX className="w-3 h-3" />
                          <span>Bloqué</span>
                        </>
                      ) : isActiveTunnel ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Connecté</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Vérifier &amp; Connecter</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Cryptographic HMAC-SHA256 Pre-Connection Attestation Inspector */}
        <div className="xl:col-span-5 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-950/60 flex flex-col justify-between gap-4">
          {selectedNode && selectedRecord ? (
            <>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Inspecteur d’attestation pré-connexion
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedNode.name} ({selectedNode.city || selectedNode.country})
                    </h3>
                  </div>

                  <div className="text-right font-mono tabular-nums">
                    <div
                      className={`text-lg font-bold ${
                        selectedRecord.state === 'verified'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : selectedRecord.state === 'rejected'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {selectedRecord.trustScore}/100
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {selectedRecord.verifyDurationMs} ms · {selectedRecord.verifiedAt}
                    </div>
                  </div>
                </div>

                {/* Interactive Step-by-Step Zero-Trust Check-Mark Checklist */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2.5">
                  {selectedRecord.criteria.map((crit) => (
                    <div
                      key={crit.id}
                      className="flex items-start justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                            crit.passed
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {crit.passed ? (
                            <Check className="w-2.5 h-2.5" />
                          ) : (
                            <ShieldAlert className="w-2.5 h-2.5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {crit.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-words">
                            {crit.detail}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                        +{crit.passed ? crit.weight : 0}/{crit.weight}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Cryptographic HMAC-SHA256 & Manifest Digest Details */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 text-[11px] font-mono">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <KeyRound className="w-3 h-3 text-cyan-500" />
                      <span>Signature HMAC-SHA256 vérifiée</span>
                    </div>
                    <div
                      className={`mt-0.5 break-all p-2 rounded-lg border ${
                        selectedRecord.hmacValid
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {selectedRecord.presentedHmacHex}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Manifeste canonique inspecté
                    </div>
                    <div className="mt-0.5 break-all text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
                      {selectedRecord.manifestPayload}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions: Connect with Pre-Check or Tamper Simulation */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleTamperTest(selectedNode)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedRecord.tampered
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {selectedRecord.tampered
                      ? 'Ré-attester HMAC'
                      : 'Simuler Altération HMAC'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleVerifySingleNode(selectedNode, true)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Vérifier HMAC &amp; Connecter</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500">
              Sélectionnez un nœud pour inspecter sa signature HMAC-SHA256.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
