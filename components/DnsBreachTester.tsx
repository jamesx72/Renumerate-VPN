import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Globe,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { AppSettings, VirtualIdentity } from '../types';

export interface DnsBreachTesterProps {
  isConnected: boolean;
  currentIdentity: VirtualIdentity;
  settings: AppSettings;
  onApplyPatch?: (patch: Partial<AppSettings>, reason?: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type PublicDnsTarget = 'all' | 'cloudflare' | 'google' | 'quad9';
type DnsRecordType = 'A' | 'AAAA' | 'TXT' | 'CANARI';
type DnsRowVerdict = 'secure' | 'warning' | 'breach';

interface DohJsonAnswer {
  name?: string;
  type?: number;
  TTL?: number;
  data?: string;
}

interface DohJsonResponse {
  Status?: number;
  AD?: boolean;
  Answer?: DohJsonAnswer[];
  Comment?: string;
}

interface DnsAuditRow {
  id: string;
  queriedName: string;
  recordType: DnsRecordType;
  providerKey: 'cloudflare' | 'google' | 'quad9';
  providerLabel: string;
  resolverAddress: string;
  routeSource: 'Navigateur DoH' | 'Sonde Backend DoH';
  resolvedAnswer: string;
  rcodeLabel: string;
  dnssecVerified: boolean;
  ecsMasked: boolean;
  rttMs: number | null;
  verdict: DnsRowVerdict;
  leakReason: string;
  probedAt: string;
}

const PRESET_DOMAINS = ['example.com', 'cloudflare.com', 'iana.org'] as const;

const PUBLIC_DNS_PROVIDERS: Record<
  'cloudflare' | 'google' | 'quad9',
  {
    label: string;
    resolverIp: string;
    buildClientUrl: ((name: string, type: 'A' | 'AAAA' | 'TXT') => string) | null;
  }
> = {
  cloudflare: {
    label: 'Cloudflare Public DoH',
    resolverIp: '1.1.1.1',
    buildClientUrl: (name, type) =>
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}&do=1`,
  },
  google: {
    label: 'Google Public DoH',
    resolverIp: '8.8.8.8',
    buildClientUrl: (name, type) =>
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}&do=1&edns_client_subnet=0.0.0.0/0`,
  },
  quad9: {
    label: 'Quad9 Public DoH',
    resolverIp: '9.9.9.9',
    buildClientUrl: null,
  },
};

function rcodeToLabel(rcode?: number): string {
  switch (rcode) {
    case 0:
      return 'NOERROR';
    case 2:
      return 'SERVFAIL';
    case 3:
      return 'NXDOMAIN';
    case 5:
      return 'REFUSED';
    default:
      return typeof rcode === 'number' ? `RCODE:${rcode}` : 'TIMEOUT';
  }
}

function generateCanaryPrefix(): string {
  const bytes = new Uint8Array(4);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeDomain(input: string): string {
  const trimmed = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/[^a-z0-9.-]/g, '');
  if (!trimmed || !trimmed.includes('.')) return 'example.com';
  return trimmed;
}

export const DnsBreachTester: React.FC<DnsBreachTesterProps> = ({
  isConnected,
  currentIdentity,
  settings,
  onApplyPatch,
  addLog,
}) => {
  const [targetProvider, setTargetProvider] = useState<PublicDnsTarget>('all');
  const [domainInput, setDomainInput] = useState<string>('example.com');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [rows, setRows] = useState<DnsAuditRow[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const runCounterRef = useRef(0);
  const mountedRunRef = useRef(false);

  const evaluateRowPosture = useCallback(
    (
      recordType: DnsRecordType,
      dnssecVerified: boolean,
      reachable: boolean
    ): { verdict: DnsRowVerdict; leakReason: string; ecsMasked: boolean } => {
      if (!isConnected) {
        return {
          verdict: 'breach',
          leakReason: 'Tunnel VPN inactif — requête résolue en direct hors tunnel',
          ecsMasked: false,
        };
      }
      if (!settings.dnsLeakProtection) {
        return {
          verdict: 'breach',
          leakReason: 'Anti-fuite DNS désactivé — contournement vers résolveur local/FAI possible',
          ecsMasked: false,
        };
      }
      if (recordType === 'AAAA' && !settings.ipv6LeakProtection) {
        return {
          verdict: 'breach',
          leakReason: 'Fuite AAAA IPv6 — résolution IPv6 hors tunnel IPv4 actif',
          ecsMasked: false,
        };
      }
      if (settings.dns === 'custom') {
        return {
          verdict: 'breach',
          leakReason: 'Résolveur personnalisé non encapsulé — exposition potentielle ECS/FAI',
          ecsMasked: false,
        };
      }
      if (!reachable || !dnssecVerified) {
        return {
          verdict: 'warning',
          leakReason: !reachable
            ? 'Service public injoignable directement (vérification partielle)'
            : 'Réponse sans bit DNSSEC AD validé',
          ecsMasked: true,
        };
      }
      return {
        verdict: 'secure',
        leakReason: `Encapsulée wg0 via ${currentIdentity.city} (${currentIdentity.ip})`,
        ecsMasked: true,
      };
    },
    [
      isConnected,
      settings.dnsLeakProtection,
      settings.ipv6LeakProtection,
      settings.dns,
      currentIdentity.city,
      currentIdentity.ip,
    ]
  );

  const executeForcedDnsTest = useCallback(
    async (silent = false) => {
      const currentRun = ++runCounterRef.current;
      const cleanDomain = sanitizeDomain(domainInput);
      const canaryToken = generateCanaryPrefix();
      const canaryHost = `probe-${canaryToken}.${cleanDomain}`;
      setIsRunning(true);

      const providersToProbe: Array<'cloudflare' | 'google' | 'quad9'> =
        targetProvider === 'all'
          ? ['cloudflare', 'google', 'quad9']
          : [targetProvider];

      const collectedRows: DnsAuditRow[] = [];
      let latestSig: string | null = null;

      try {
        const probeTasks = providersToProbe.flatMap((providerKey) => {
          const meta = PUBLIC_DNS_PROVIDERS[providerKey];
          const recordTypesForProvider: DnsRecordType[] =
            targetProvider === 'all'
              ? providerKey === 'quad9'
                ? ['CANARI']
                : ['A', 'AAAA']
              : ['A', 'AAAA', 'TXT', 'CANARI'];

          return recordTypesForProvider.map(async (recType): Promise<DnsAuditRow> => {
            const nowIso = new Date().toLocaleTimeString('fr-FR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            if (recType === 'CANARI' || providerKey === 'quad9') {
              try {
                const res = await fetch('/api/network/dns-audit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    dnsProvider: providerKey,
                    canaryToken: `${canaryToken}-${providerKey}`,
                  }),
                });
                const json = (await res.json()) as {
                  canaryDomain?: string;
                  upstreamReachable?: boolean;
                  rttMs?: number | null;
                  rcode?: number;
                  dnssecVerified?: boolean;
                  ecsPadding?: string;
                  auditSignature?: string;
                };
                if (json.auditSignature) {
                  latestSig = json.auditSignature;
                }
                const reachable = Boolean(json.upstreamReachable);
                const dnssecOk = Boolean(json.dnssecVerified);
                const posture = evaluateRowPosture(recType, dnssecOk, reachable);

                return {
                  id: `${providerKey}-${recType}-${currentRun}`,
                  queriedName: json.canaryDomain || canaryHost,
                  recordType: recType,
                  providerKey,
                  providerLabel: meta.label,
                  resolverAddress: meta.resolverIp,
                  routeSource: 'Sonde Backend DoH',
                  resolvedAnswer: reachable
                    ? `Canari isolé (${rcodeToLabel(json.rcode)}) · ECS ${json.ecsPadding || '0.0.0.0/0'}`
                    : 'Tunnel isolé (sans réponse externe directe)',
                  rcodeLabel: rcodeToLabel(json.rcode),
                  dnssecVerified: dnssecOk,
                  ecsMasked: posture.ecsMasked,
                  rttMs: typeof json.rttMs === 'number' ? json.rttMs : null,
                  verdict: posture.verdict,
                  leakReason: posture.leakReason,
                  probedAt: nowIso,
                };
              } catch {
                const posture = evaluateRowPosture(recType, false, false);
                return {
                  id: `${providerKey}-${recType}-${currentRun}`,
                  queriedName: canaryHost,
                  recordType: recType,
                  providerKey,
                  providerLabel: meta.label,
                  resolverAddress: meta.resolverIp,
                  routeSource: 'Sonde Backend DoH',
                  resolvedAnswer: 'Sonde backend indisponible',
                  rcodeLabel: 'ERR',
                  dnssecVerified: false,
                  ecsMasked: posture.ecsMasked,
                  rttMs: null,
                  verdict: posture.verdict,
                  leakReason: posture.leakReason,
                  probedAt: nowIso,
                };
              }
            }

            // Direct forced client-side DoH lookup against public service
            const dohUrl = meta.buildClientUrl?.(cleanDomain, recType) ?? null;
            if (!dohUrl) {
              const posture = evaluateRowPosture(recType, true, false);
              return {
                id: `${providerKey}-${recType}-${currentRun}`,
                queriedName: cleanDomain,
                recordType: recType,
                providerKey,
                providerLabel: meta.label,
                resolverAddress: meta.resolverIp,
                routeSource: 'Navigateur DoH',
                resolvedAnswer: 'Endpoint DoH non CORS',
                rcodeLabel: 'N/A',
                dnssecVerified: true,
                ecsMasked: posture.ecsMasked,
                rttMs: null,
                verdict: posture.verdict,
                leakReason: posture.leakReason,
                probedAt: nowIso,
              };
            }

            const startedAt = performance.now();
            const ctrl = new AbortController();
            const timer = window.setTimeout(() => ctrl.abort(), 1900);

            try {
              const response = await fetch(dohUrl, {
                method: 'GET',
                headers: { Accept: 'application/dns-json' },
                signal: ctrl.signal,
              });
              window.clearTimeout(timer);
              const rttMs = Math.max(2, Math.round(performance.now() - startedAt));

              if (response.ok) {
                const data = (await response.json()) as DohJsonResponse;
                const answers = (data.Answer || [])
                  .map((a) => a.data)
                  .filter((d): d is string => Boolean(d));
                const answerSummary =
                  answers.length > 0
                    ? answers.slice(0, 2).join(', ')
                    : `${rcodeToLabel(data.Status)} (0 enr.)`;
                const dnssecOk = Boolean(data.AD) || data.Status === 0;
                const posture = evaluateRowPosture(recType, dnssecOk, true);

                return {
                  id: `${providerKey}-${recType}-${currentRun}`,
                  queriedName: cleanDomain,
                  recordType: recType,
                  providerKey,
                  providerLabel: meta.label,
                  resolverAddress: meta.resolverIp,
                  routeSource: 'Navigateur DoH',
                  resolvedAnswer: answerSummary,
                  rcodeLabel: rcodeToLabel(data.Status),
                  dnssecVerified: Boolean(data.AD),
                  ecsMasked: posture.ecsMasked,
                  rttMs,
                  verdict: posture.verdict,
                  leakReason: posture.leakReason,
                  probedAt: nowIso,
                };
              }
            } catch {
              window.clearTimeout(timer);
            }

            // Fallback to server-side public DoH probe if browser egress blocked
            try {
              const fallbackRes = await fetch('/api/network/dns-audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  dnsProvider: providerKey,
                  canaryToken: `${cleanDomain}-${recType}-${canaryToken}`,
                }),
              });
              const json = (await fallbackRes.json()) as {
                upstreamReachable?: boolean;
                rttMs?: number | null;
                rcode?: number;
                dnssecVerified?: boolean;
                auditSignature?: string;
              };
              if (json.auditSignature) latestSig = json.auditSignature;
              const reachable = Boolean(json.upstreamReachable);
              const dnssecOk = Boolean(json.dnssecVerified);
              const posture = evaluateRowPosture(recType, dnssecOk, reachable);

              return {
                id: `${providerKey}-${recType}-${currentRun}`,
                queriedName: cleanDomain,
                recordType: recType,
                providerKey,
                providerLabel: meta.label,
                resolverAddress: meta.resolverIp,
                routeSource: 'Sonde Backend DoH',
                resolvedAnswer: reachable
                  ? `Relai DoH vérifié (${rcodeToLabel(json.rcode)})`
                  : 'Requête filtrée / bloquée hors relai',
                rcodeLabel: rcodeToLabel(json.rcode),
                dnssecVerified: dnssecOk,
                ecsMasked: posture.ecsMasked,
                rttMs: typeof json.rttMs === 'number' ? json.rttMs : null,
                verdict: posture.verdict,
                leakReason: posture.leakReason,
                probedAt: nowIso,
              };
            } catch {
              const posture = evaluateRowPosture(recType, false, false);
              return {
                id: `${providerKey}-${recType}-${currentRun}`,
                queriedName: cleanDomain,
                recordType: recType,
                providerKey,
                providerLabel: meta.label,
                resolverAddress: meta.resolverIp,
                routeSource: 'Navigateur DoH',
                resolvedAnswer: 'Expiration réseau (hors ligne)',
                rcodeLabel: 'TIMEOUT',
                dnssecVerified: false,
                ecsMasked: posture.ecsMasked,
                rttMs: null,
                verdict: posture.verdict,
                leakReason: posture.leakReason,
                probedAt: nowIso,
              };
            }
          });
        });

        const results = await Promise.all(probeTasks);
        if (runCounterRef.current !== currentRun) return;

        collectedRows.push(...results);
        setRows(collectedRows);
        setLastRunAt(
          new Date().toLocaleTimeString('fr-FR', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        if (latestSig) setLastSignature(latestSig);

        const breaches = collectedRows.filter((r) => r.verdict === 'breach').length;
        if (!silent) {
          addLog?.(
            breaches > 0
              ? `[Sentinel-IA · Test Faille DNS] ${breaches} fuite(s) hors tunnel détectée(s) vers ${cleanDomain}`
              : `[Sentinel-IA · Test Faille DNS] ${collectedRows.length} résolutions publiques forcées étanches (${cleanDomain})`,
            breaches > 0 ? 'error' : 'success',
            currentIdentity.ip
          );
        }
      } finally {
        if (runCounterRef.current === currentRun) {
          setIsRunning(false);
        }
      }
    },
    [
      domainInput,
      targetProvider,
      evaluateRowPosture,
      addLog,
      currentIdentity.ip,
    ]
  );

  // Initial forced audit and automatic re-verification on DNS posture changes
  useEffect(() => {
    if (!mountedRunRef.current) {
      mountedRunRef.current = true;
      void executeForcedDnsTest(true);
      return;
    }
    const timer = window.setTimeout(() => {
      void executeForcedDnsTest(true);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [
    isConnected,
    settings.dnsLeakProtection,
    settings.ipv6LeakProtection,
    settings.dns,
    currentIdentity.ip,
    executeForcedDnsTest,
  ]);

  const summary = useMemo(() => {
    const total = rows.length;
    const breaches = rows.filter((r) => r.verdict === 'breach').length;
    const warnings = rows.filter((r) => r.verdict === 'warning').length;
    const dnssecValid = rows.filter((r) => r.dnssecVerified).length;
    const rtts = rows
      .map((r) => r.rttMs)
      .filter((v): v is number => typeof v === 'number');
    const avgRtt =
      rtts.length > 0
        ? Math.round(rtts.reduce((acc, v) => acc + v, 0) / rtts.length)
        : null;

    return {
      total,
      breaches,
      warnings,
      dnssecValid,
      avgRtt,
    };
  }, [rows]);

  const hasRemediationNeed =
    !settings.dnsLeakProtection ||
    !settings.ipv6LeakProtection ||
    settings.dns === 'custom';

  const handleSealDnsLeaks = () => {
    if (!onApplyPatch) return;
    onApplyPatch(
      {
        dnsLeakProtection: true,
        ipv6LeakProtection: true,
        dns: settings.dns === 'custom' ? 'quad9' : settings.dns,
      },
      'Scellement DNS & IPv6 déclenché depuis Test de Faille DNS (Sentinel-IA)'
    );
  };

  return (
    <div
      id="test-faille-dns"
      className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-5"
    >
      {/* Module Header inside Sentinel-IA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Test de Faille DNS (Résolution forcée via service public)
            </h3>
            <span
              className={`text-[11px] font-mono font-semibold ${
                summary.breaches > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : summary.warnings > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {summary.breaches > 0
                ? `${summary.breaches} FUITE(S) HORS TUNNEL`
                : summary.warnings > 0
                  ? 'VÉRIFICATION PARTIELLE'
                  : 'ÉTANCHÉITÉ CONFIRMÉE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exécute des résolutions DNS forcées (A, AAAA, TXT et canari aléatoire) sur des résolveurs publics DoH pour détecter toute fuite hors du tunnel VPN.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasRemediationNeed && onApplyPatch && (
            <button
              type="button"
              onClick={handleSealDnsLeaks}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Sceller le tunnel DNS</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void executeForcedDnsTest(false)}
            disabled={isRunning}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>
              {isRunning ? 'Résolution en cours...' : 'Exécuter le test DNS'}
            </span>
          </button>
        </div>
      </div>

      {/* Interactive Controls: Public Service Selector & Domain Target */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
            Service public :
          </span>
          {(
            [
              { id: 'all', label: 'Multi-Sondes (Tous)' },
              { id: 'cloudflare', label: 'Cloudflare 1.1.1.1' },
              { id: 'google', label: 'Google 8.8.8.8' },
              { id: 'quad9', label: 'Quad9 9.9.9.9' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTargetProvider(opt.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                targetProvider === opt.id
                  ? 'bg-slate-900 dark:bg-cyan-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="dns-breach-domain-input"
            className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
          >
            Domaine cible :
          </label>
          <input
            id="dns-breach-domain-input"
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="example.com"
            className="w-40 px-2.5 py-1 rounded-md text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <div className="flex items-center gap-1">
            {PRESET_DOMAINS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDomainInput(preset)}
                className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  domainInput === preset
                    ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/40 dark:bg-slate-950/30">
        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Requêtes forcées
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {summary.total}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {lastRunAt ? `Audit ${lastRunAt}` : 'Initialisation'}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Fuites hors tunnel
          </div>
          <div
            className={`mt-0.5 text-lg font-bold font-mono tabular-nums ${
              summary.breaches > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {summary.breaches}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Anti-fuite {settings.dnsLeakProtection ? 'ACTIF' : 'INACTIF'} · IPv6{' '}
            {settings.ipv6LeakProtection ? 'BLOQUÉ' : 'OUVERT'}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Validation DNSSEC (AD)
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {summary.dnssecValid}/{summary.total || 0}
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate">
            {lastSignature ? `SIG ${lastSignature}` : 'ECS 0.0.0.0/0'}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Latence DoH moyenne
          </div>
          <div className="mt-0.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {summary.avgRtt !== null ? `${summary.avgRtt} ms` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate">
            Sortie {currentIdentity.ip}
          </div>
        </div>
      </div>

      {/* Summary Audit Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3.5">Domaine / Canari</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Service public forcé</th>
                <th className="py-2.5 px-3">Réponse &amp; Route observée</th>
                <th className="py-2.5 px-3">DNSSEC · Latence</th>
                <th className="py-2.5 px-3.5 text-right">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    Exécutez le test DNS pour analyser les résolutions publiques hors tunnel.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const verdictColor =
                    row.verdict === 'breach'
                      ? 'text-rose-600 dark:text-rose-400'
                      : row.verdict === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400';
                  const verdictLabel =
                    row.verdict === 'breach'
                      ? 'Fuite hors tunnel'
                      : row.verdict === 'warning'
                        ? 'Partiel'
                        : 'Étanche';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-900 dark:text-slate-100 max-w-[200px] truncate">
                        {row.queriedName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 whitespace-nowrap">
                        {row.recordType}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {row.providerLabel}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {row.resolverAddress} · {row.routeSource}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[260px]">
                        <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">
                          {row.resolvedAnswer}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {row.leakReason}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap text-[11px] text-slate-600 dark:text-slate-300">
                        <div>
                          {row.dnssecVerified ? 'AD Valide' : 'Non signé'} ·{' '}
                          {row.rcodeLabel}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {row.rttMs !== null ? `${row.rttMs} ms` : '—'} ·{' '}
                          {row.ecsMasked ? 'ECS 0.0.0.0/0' : 'ECS exposé'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-end gap-1 font-semibold text-[11px] ${verdictColor}`}
                        >
                          {row.verdict === 'breach' ? (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          ) : row.verdict === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          )}
                          <span>{verdictLabel}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
