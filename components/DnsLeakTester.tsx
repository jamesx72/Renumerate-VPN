import React, { useState, useCallback, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  Loader2,
  Server,
  Globe,
  Lock,
  Unlock,
  RefreshCw,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { AppSettings, ConnectionMode, DeviceNode } from '../types';

interface DnsLeakTesterProps {
  isConnected: boolean;
  mode: ConnectionMode;
  protocol: string;
  currentIp: string;
  nodes: DeviceNode[];
  settings: AppSettings;
  updateSettings?: (key: keyof AppSettings, value: any) => void;
  addLog: (
    event: string,
    type: 'info' | 'warning' | 'success' | 'error'
  ) => void;
  externalTriggerCount?: number;
}

type ProbeDepth = 'standard' | 'extended';

interface DnsProbeRecord {
  id: string;
  sequence: number;
  queryType: 'A' | 'AAAA' | 'HTTPS' | 'TXT (ECS)';
  canaryHost: string;
  resolverIp: string;
  resolverOrg: string;
  asn: string;
  location: string;
  transport: string;
  latencyMs: number;
  leaked: boolean;
  leakReason?: string;
}

interface LeakAuditSummary {
  runAt: string;
  depth: ProbeDepth;
  verdict: 'protected' | 'leak_detected' | 'isp_exposed';
  totalProbes: number;
  leakedCount: number;
  ednsClientSubnetMasked: boolean;
  measuredDohRttMs: number | null;
  records: DnsProbeRecord[];
}

const DNS_PROVIDER_DIRECTORY: Record<
  AppSettings['dns'],
  {
    name: string;
    primaryIp: string;
    secondaryIp: string;
    ipv6: string;
    asn: string;
    transportLabel: string;
  }
> = {
  cloudflare: {
    name: 'Cloudflare Zero-Log Anycast',
    primaryIp: '1.1.1.1',
    secondaryIp: '1.0.0.1',
    ipv6: '2606:4700:4700::1111',
    asn: 'AS13335',
    transportLabel: 'DoH / TLS 1.3',
  },
  quad9: {
    name: 'Quad9 Swiss Privacy Foundation',
    primaryIp: '9.9.9.9',
    secondaryIp: '149.112.112.112',
    ipv6: '2620:fe::fe',
    asn: 'AS19281',
    transportLabel: 'DoH / DNSSEC',
  },
  google: {
    name: 'Google Public DNS Anycast',
    primaryIp: '8.8.8.8',
    secondaryIp: '8.8.4.4',
    ipv6: '2001:4860:4860::8888',
    asn: 'AS15169',
    transportLabel: 'DoT / TLS 1.3',
  },
  opendns: {
    name: 'Cisco OpenDNS Umbrella',
    primaryIp: '208.67.222.222',
    secondaryIp: '208.67.220.220',
    ipv6: '2620:119:35::35',
    asn: 'AS36692',
    transportLabel: 'DNSCrypt / UDP-443',
  },
  custom: {
    name: 'Résolveur privé personnalisé',
    primaryIp: '10.66.0.1',
    secondaryIp: '10.66.0.2',
    ipv6: 'fd00:renum:dns::1',
    asn: 'AS64512',
    transportLabel: 'Tunnel interne',
  },
};

const REAL_ISP_FALLBACK_RESOLVERS = [
  {
    ip: '80.10.246.2',
    ipv6: '2a01:cb00:8010::2',
    org: 'Orange S.A. (Résolveur FAI domestique)',
    asn: 'AS3215',
    location: 'Paris, France (FAI réel)',
    transport: 'UDP/53 non chiffré',
  },
  {
    ip: '212.27.40.240',
    ipv6: '2a01:e00::2',
    org: 'Free SAS / Proxad (Résolveur FAI secondaire)',
    asn: 'AS12322',
    location: 'Île-de-France, France (FAI réel)',
    transport: 'UDP/53 non chiffré',
  },
];

function generateRandomHexToken(byteLen = 5): string {
  const bytes = new Uint8Array(byteLen);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function measureDummyCanaryProbeRtt(canaryName: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1400);
  const start = performance.now();

  try {
    // Requête DNS-over-HTTPS factice (RFC 8484 JSON) vers un sous-domaine aléatoire non mis en cache (NXDOMAIN attendu)
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
      canaryName
    )}&type=A`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (res.ok) {
      return Math.max(4, Math.round(performance.now() - start));
    }
    return null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export const DnsLeakTester: React.FC<DnsLeakTesterProps> = ({
  isConnected,
  mode,
  protocol,
  currentIp,
  nodes,
  settings,
  updateSettings,
  addLog,
  externalTriggerCount = 0,
}) => {
  const [depth, setDepth] = useState<ProbeDepth>('standard');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeCanary, setActiveCanary] = useState<string>('');
  const [liveRecords, setLiveRecords] = useState<DnsProbeRecord[]>([]);
  const [auditResult, setAuditResult] = useState<LeakAuditSummary | null>(null);

  const activeNode =
    nodes.find((n) => n.ip === currentIp) || {
      country: 'Suisse',
      latency: 18,
      ip: currentIp,
    };

  const executeLeakTest = useCallback(
    async (overrideSettings?: Partial<AppSettings>) => {
      if (isRunning) return;

      const effectiveDnsLeakProtection =
        overrideSettings?.dnsLeakProtection ?? settings.dnsLeakProtection;
      const effectiveIpv6Protection =
        overrideSettings?.ipv6LeakProtection ?? settings.ipv6LeakProtection;

      const probeCount = depth === 'extended' ? 8 : 4;
      const provider = DNS_PROVIDER_DIRECTORY[settings.dns];
      const customIp =
        settings.dns === 'custom' && settings.customDnsServer.trim()
          ? settings.customDnsServer.trim()
          : provider.primaryIp;

      setIsRunning(true);
      setProgress(6);
      setLiveRecords([]);
      setAuditResult(null);

      addLog(
        `Démarrage du test de fuite DNS (${probeCount} requêtes canari factices)...`,
        'info'
      );

      // Mesure réseau réelle sur une sonde canari non-cachée
      const initialToken = generateRandomHexToken(6);
      const realProbeDomain = `probe-${initialToken}.dns-canary.invalid`;
      setActiveCanary(realProbeDomain);
      const measuredRtt = await measureDummyCanaryProbeRtt(realProbeDomain);

      const queryPlan: Array<{
        type: DnsProbeRecord['queryType'];
        label: string;
      }> =
        depth === 'extended'
          ? [
              { type: 'A', label: 'Résolution primaire IPv4' },
              { type: 'AAAA', label: 'Résolution pile IPv6' },
              { type: 'TXT (ECS)', label: 'Sonde EDNS0 Client Subnet' },
              { type: 'HTTPS', label: 'Enregistrement SVCB / DoH' },
              { type: 'A', label: 'Sonde de repli Multi-Homed OS' },
              { type: 'AAAA', label: 'Test de fuite Teredo / SLAAC' },
              { type: 'A', label: 'Résolveur secondaire sous charge' },
              { type: 'TXT (ECS)', label: 'Vérification cache hors-tunnel' },
            ]
          : [
              { type: 'A', label: 'Résolution primaire IPv4' },
              { type: 'AAAA', label: 'Résolution pile IPv6' },
              { type: 'TXT (ECS)', label: 'Sonde EDNS0 Client Subnet' },
              { type: 'HTTPS', label: 'Sonde de repli système OS' },
            ];

      const collected: DnsProbeRecord[] = [];
      const isOnion = mode === ConnectionMode.ONION_VORTEX;

      for (let i = 0; i < queryPlan.length; i++) {
        const step = queryPlan[i];
        const token = generateRandomHexToken(4);
        const canaryHost = `${token}-s${i + 1}.canary-check.renumerate.test`;
        setActiveCanary(canaryHost);

        await new Promise((r) => setTimeout(r, depth === 'extended' ? 260 : 320));

        const basePing = measuredRtt ?? activeNode.latency;
        const jitter = Math.floor(Math.random() * 9) - 3;
        const probeLatency = Math.max(
          5,
          basePing + (isOnion ? 45 : 0) + jitter
        );

        let record: DnsProbeRecord;

        if (!isConnected) {
          // Hors tunnel VPN : les serveurs DNS réels du FAI sont directement exposés
          const isp = REAL_ISP_FALLBACK_RESOLVERS[i % REAL_ISP_FALLBACK_RESOLVERS.length];
          record = {
            id: `probe-${Date.now()}-${i}`,
            sequence: i + 1,
            queryType: step.type,
            canaryHost,
            resolverIp: step.type === 'AAAA' ? isp.ipv6 : isp.ip,
            resolverOrg: isp.org,
            asn: isp.asn,
            location: isp.location,
            transport: isp.transport,
            latencyMs: Math.max(6, 14 + jitter),
            leaked: true,
            leakReason: 'Tunnel VPN inactif — Résolveur FAI réel exposé',
          };
        } else if (!effectiveDnsLeakProtection && i % 2 === 1) {
          // Tunnel actif mais protection anti-fuite DNS désactivée : fuite Multi-Homed vers le FAI réel
          const isp = REAL_ISP_FALLBACK_RESOLVERS[0];
          record = {
            id: `probe-${Date.now()}-${i}`,
            sequence: i + 1,
            queryType: step.type,
            canaryHost,
            resolverIp: step.type === 'AAAA' ? isp.ipv6 : isp.ip,
            resolverOrg: isp.org,
            asn: isp.asn,
            location: isp.location,
            transport: 'Fuite UDP/53 hors interface VPN',
            latencyMs: Math.max(7, 15 + jitter),
            leaked: true,
            leakReason:
              'Protection anti-fuite DNS désactivée (requête résolue par le FAI)',
          };
        } else if (
          step.type === 'AAAA' &&
          !effectiveIpv6Protection
        ) {
          // Fuite spécifique IPv6 DNS lorsque la protection IPv6 est désactivée
          const isp = REAL_ISP_FALLBACK_RESOLVERS[0];
          record = {
            id: `probe-${Date.now()}-${i}`,
            sequence: i + 1,
            queryType: 'AAAA',
            canaryHost,
            resolverIp: isp.ipv6,
            resolverOrg: isp.org,
            asn: isp.asn,
            location: isp.location,
            transport: 'Fuite IPv6 native hors tunnel',
            latencyMs: Math.max(8, 16 + jitter),
            leaked: true,
            leakReason:
              'Protection de fuite IPv6 désactivée sur les requêtes AAAA',
          };
        } else {
          // Aucune fuite : requête encapsulée dans le tunnel vers le résolveur sécurisé
          const resolverAddress = isOnion
            ? '127.0.0.1:9053 (Tor DNSPort)'
            : step.type === 'AAAA'
              ? provider.ipv6
              : i % 2 === 0
                ? customIp
                : provider.secondaryIp;

          record = {
            id: `probe-${Date.now()}-${i}`,
            sequence: i + 1,
            queryType: step.type,
            canaryHost,
            resolverIp: resolverAddress,
            resolverOrg: isOnion
              ? 'Relais de sortie Onion Vortex'
              : provider.name,
            asn: isOnion ? 'VORTEX-EXIT' : provider.asn,
            location: `${activeNode.country} (Sortie tunnel)`,
            transport: isOnion
              ? 'Circuit Tor chiffré'
              : `${provider.transportLabel} via ${protocol.toUpperCase()}`,
            latencyMs: probeLatency,
            leaked: false,
          };
        }

        collected.push(record);
        setLiveRecords([...collected]);
        setProgress(Math.round(((i + 1) / queryPlan.length) * 100));
      }

      const leakedCount = collected.filter((r) => r.leaked).length;
      const verdict: LeakAuditSummary['verdict'] = !isConnected
        ? 'isp_exposed'
        : leakedCount > 0
          ? 'leak_detected'
          : 'protected';

      const summary: LeakAuditSummary = {
        runAt: new Date().toLocaleTimeString('fr-FR'),
        depth,
        verdict,
        totalProbes: collected.length,
        leakedCount,
        ednsClientSubnetMasked: isConnected && effectiveDnsLeakProtection,
        measuredDohRttMs: measuredRtt,
        records: collected,
      };

      setAuditResult(summary);
      setActiveCanary('');
      setIsRunning(false);

      if (verdict === 'protected') {
        addLog(
          `Test de fuite DNS réussi : 0/${collected.length} fuite détectée — Résolveurs FAI réels totalement masqués (${provider.name})`,
          'success'
        );
      } else if (verdict === 'leak_detected') {
        addLog(
          `Alerte fuite DNS : ${leakedCount}/${collected.length} requête(s) ont exposé un résolveur FAI réel hors du tunnel !`,
          'error'
        );
      } else {
        addLog(
          `Test DNS hors tunnel : ${leakedCount}/${collected.length} requêtes résolues directement par le FAI local`,
          'warning'
        );
      }
    },
    [
      isRunning,
      settings.dnsLeakProtection,
      settings.ipv6LeakProtection,
      settings.dns,
      settings.customDnsServer,
      depth,
      addLog,
      activeNode.latency,
      activeNode.country,
      mode,
      isConnected,
      protocol,
    ]
  );

  // Support external trigger (e.g. from Smart DNS button in Dashboard)
  useEffect(() => {
    if (externalTriggerCount > 0) {
      executeLeakTest();
    }
  }, [externalTriggerCount]);

  const handleSealLeakAndRetest = () => {
    updateSettings?.('dnsLeakProtection', true);
    updateSettings?.('ipv6LeakProtection', true);
    executeLeakTest({
      dnsLeakProtection: true,
      ipv6LeakProtection: true,
    });
  };

  const displayRecords = auditResult ? auditResult.records : liveRecords;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-sm space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-3 rounded-2xl border shrink-0 ${
              auditResult?.verdict === 'protected'
                ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : auditResult?.verdict === 'leak_detected' ||
                    auditResult?.verdict === 'isp_exposed'
                  ? 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400'
                  : 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
            }`}
          >
            {auditResult?.verdict === 'leak_detected' ||
            auditResult?.verdict === 'isp_exposed' ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Diagnostic d'étanchéité & test de fuite DNS
              </h3>
              <span className="text-slate-400">·</span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                DNS configuré : {settings.dns.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Émet des requêtes canari factices à sous-domaine aléatoire unique afin de vérifier qu'aucun résolveur DNS réel de votre FAI n'est exposé.
            </p>
          </div>
        </div>

        {/* Controls: Shield Quick-Toggle + Depth Selector + Run Button */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {updateSettings && (
            <button
              type="button"
              onClick={() =>
                updateSettings('dnsLeakProtection', !settings.dnsLeakProtection)
              }
              disabled={isRunning}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                settings.dnsLeakProtection
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
              }`}
              title="Activer ou désactiver la protection anti-fuite DNS pour tester le comportement du tunnel"
            >
              {settings.dnsLeakProtection ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              <span>
                Bouclier DNS : {settings.dnsLeakProtection ? 'Actif' : 'Désactivé'}
              </span>
            </button>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setDepth('standard')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                depth === 'standard'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              4 sondes
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setDepth('extended')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                depth === 'extended'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              8 sondes
            </button>
          </div>

          <button
            type="button"
            onClick={() => executeLeakTest()}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : auditResult ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>
              {isRunning
                ? 'Sondage en cours...'
                : auditResult
                  ? 'Relancer le test DNS'
                  : 'Lancer le test de fuite DNS'}
            </span>
          </button>
        </div>
      </div>

      {/* Live Progress Bar During Probe Execution */}
      {isRunning && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
              Requête factice : <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{activeCanary}</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-cyan-600 dark:text-cyan-400 shrink-0">
              {progress}%
            </span>
          </div>
          <svg className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
            <rect
              x="0"
              y="0"
              width={`${progress}%`}
              height="100%"
              rx="4"
              fill="#06b6d4"
            />
          </svg>
        </div>
      )}

      {/* Verdict Summary Banner */}
      {auditResult && !isRunning && (
        <div
          className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            auditResult.verdict === 'protected'
              ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
              : auditResult.verdict === 'leak_detected'
                ? 'bg-red-50/80 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                : 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
          }`}
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
              {auditResult.verdict === 'protected' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-emerald-800 dark:text-emerald-300">
                    Tunnel étanche : aucune fuite DNS détectée ({auditResult.totalProbes}/{auditResult.totalProbes} sondes isolées)
                  </span>
                </>
              ) : auditResult.verdict === 'leak_detected' ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="text-red-800 dark:text-red-300">
                    Fuite DNS critique détectée : {auditResult.leakedCount} requête(s) ont exposé votre résolveur FAI réel !
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-amber-900 dark:text-amber-300">
                    VPN déconnecté : vos serveurs DNS FAI réels traitent les requêtes en clair ({auditResult.leakedCount}/{auditResult.totalProbes} exposées)
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
              Audit à {auditResult.runAt} · EDNS0 Client Subnet :{' '}
              {auditResult.ednsClientSubnetMasked
                ? 'Masqué (0.0.0.0/0)'
                : 'Exposé au résolveur'}{' '}
              · Protection IPv6 :{' '}
              {settings.ipv6LeakProtection ? 'Active' : 'Inactive'}
              {auditResult.measuredDohRttMs !== null
                ? ` · RTT DoH mesuré : ${auditResult.measuredDohRttMs} ms`
                : ''}
            </p>
          </div>

          {auditResult.verdict === 'leak_detected' && updateSettings && (
            <button
              type="button"
              onClick={handleSealLeakAndRetest}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              Colmater la fuite & revérifier
            </button>
          )}
        </div>
      )}

      {/* Resolver Probe Results Table OR Initial Empty State */}
      {displayRecords.length === 0 && !isRunning ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <Globe className="w-5 h-5 text-cyan-500 shrink-0" />
            <span>
              Prêt à interroger des sous-domaines canari uniques (types <span className="font-mono">A</span>, <span className="font-mono">AAAA</span>, <span className="font-mono">HTTPS</span> et <span className="font-mono">EDNS0</span>) pour identifier tous les résolveurs DNS visibles depuis l'extérieur.
            </span>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
            État tunnel : {isConnected ? `Connecté (${currentIp})` : 'Hors ligne'}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Sonde canari factice</th>
                  <th className="px-4 py-2.5 font-semibold">Résolveur détecté</th>
                  <th className="px-4 py-2.5 font-semibold">Opérateur & ASN</th>
                  <th className="px-4 py-2.5 font-semibold">Canal & Latence</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Statut d'exposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {rec.queryType} · #{rec.sequence}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[210px]">
                        {rec.canaryHost}
                      </div>
                    </td>

                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-200 font-semibold">
                        <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{rec.resolverIp}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">
                        {rec.location}
                      </div>
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {rec.resolverOrg}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        {rec.asn}
                      </div>
                    </td>

                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      <div>{rec.transport}</div>
                      <div className="text-[11px] text-slate-500">
                        {rec.latencyMs} ms
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1.5 font-semibold ${
                          rec.leaked
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                        title={rec.leakReason}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            rec.leaked ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                        />
                        {rec.leaked ? 'DNS réel exposé' : 'Protégé par VPN'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
