import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Activity,
  Shield,
  Ghost,
  Layers,
  Globe,
  Server,
  MapPin,
  Search,
  Orbit,
  Globe2,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Tv,
  Radio,
  Database,
  Box,
  ChevronDown,
  Zap,
  Power,
  RefreshCw,
  ShieldHalf,
  Key,
  Link2,
  Settings2,
  Sliders,
  History,
  Clock,
  Calendar,
  ArrowUpDown,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { TrafficMonitor, AnonymityScore } from './DashboardCharts';
import { DnsLeakTester } from './DnsLeakTester';
import {
  SecurityReport,
  PlanTier,
  ConnectionMode,
  DeviceNode,
  AppSettings,
  ConnectionSession,
} from '../types';
import { isCountryExcludedByJurisdiction } from '../constants';

interface DashboardProps {
  isDark: boolean;
  protocol: string;
  isEmergency: boolean;
  securityReport: SecurityReport | null;
  isConnected: boolean;
  userPlan: PlanTier;
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  nodes: DeviceNode[];
  onConnectNode: (id: string) => void;
  onDisconnect?: () => void;
  currentIp: string;
  throughput?: { up: number; down: number };
  baseLatency?: number;
  settings: AppSettings;
  addLog: (
    event: string,
    type: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
  updateSettings?: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  history?: ConnectionSession[];
}

const VERIFIED_ONION_SERVICES = [
  {
    name: 'Vortex Search',
    url: 'vortex4deedp3i2jcy.onion',
    category: 'Recherche anonyme',
    security: 'Élevée',
  },
  {
    name: 'SecureDrop Library',
    url: 'sdlibgg777secure.onion',
    category: "Lanceurs d'alerte",
    security: 'Maximale',
  },
  {
    name: 'Archive Renumerate',
    url: 'renumlib777vortex.onion',
    category: 'Documentation',
    security: 'Vérifiée',
  },
  {
    name: 'OnionShare Hub',
    url: 'onionsharev3hub77.onion',
    category: 'Partage P2P',
    security: 'Élevée',
  },
  {
    name: 'DuckDuckGo Onion',
    url: 'duckduckgogg42xj.onion',
    category: 'Moteur privé',
    security: 'Standard',
  },
  {
    name: 'Presse Internationale',
    url: 'nytimes3xbfgragh.onion',
    category: 'Journalisme',
    security: 'Vérifiée',
  },
  {
    name: 'Relais Annuaire Vortex',
    url: 'relvxnode01auth7.onion',
    category: 'Infrastructure',
    security: 'Maximale',
  },
  {
    name: 'Encyclopédie Chiffrée',
    url: 'swikicore77vault.onion',
    category: 'Base de savoir',
    security: 'Élevée',
  },
];

const STREAMING_REGIONS = [
  {
    id: 'us',
    name: 'Catalogue USA',
    service: 'Streaming Amérique du Nord',
    flag: '🇺🇸',
    resolverIp: '198.54.131.70',
    baseDelay: 76,
    status: '4K HDR',
  },
  {
    id: 'uk',
    name: 'Royaume-Uni',
    service: 'BBC iPlayer & UK TV',
    flag: '🇬🇧',
    resolverIp: '185.199.108.42',
    baseDelay: 28,
    status: 'Stable',
  },
  {
    id: 'de',
    name: 'Allemagne',
    service: 'ZDF & ARD Mediathek',
    flag: '🇩🇪',
    resolverIp: '91.198.174.66',
    baseDelay: 16,
    status: 'Ultra HD',
  },
  {
    id: 'ch',
    name: 'Suisse Romande',
    service: 'RTS / Play Suisse',
    flag: '🇨🇭',
    resolverIp: '179.43.168.24',
    baseDelay: 21,
    status: 'Optimal',
  },
  {
    id: 'jp',
    name: 'Japon (Tokyo)',
    service: ' Abema & Simulcast JP',
    flag: '🇯🇵',
    resolverIp: '103.253.41.90',
    baseDelay: 145,
    status: 'Actif',
  },
];

const COUNTRIES_WITH_FLAGS: Record<string, string> = {
  France: '🇫🇷',
  Suisse: '🇨🇭',
  Singapour: '🇸🇬',
  Islande: '🇮🇸',
  Estonie: '🇪🇪',
  Panama: '🇵🇦',
  USA: '🇺🇸',
  Allemagne: '🇩🇪',
  Tous: '🌍',
};

export const Dashboard: React.FC<DashboardProps> = ({
  isDark,
  protocol,
  isEmergency,
  securityReport,
  isConnected,
  userPlan,
  mode,
  onModeChange,
  nodes,
  onConnectNode,
  onDisconnect,
  currentIp,
  throughput = { up: 0, down: 0 },
  baseLatency = 18,
  settings,
  addLog,
  updateSettings,
  history = [],
}) => {
  const [countryFilter, setCountryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'latency' | 'rate' | 'signal'>('latency');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [isProbingNodes, setIsProbingNodes] = useState(false);
  const [probedLatencies, setProbedLatencies] = useState<Record<string, number>>({});

  const [onionUrl, setOnionUrl] = useState('');
  const [isOnionResolving, setIsOnionResolving] = useState(false);
  const [resolvedOnionEndpoint, setResolvedOnionEndpoint] = useState<{
    url: string;
    rttMs: number;
  } | null>(null);
  const [circuitSeed, setCircuitSeed] = useState(0);

  const [selectedRegion, setSelectedRegion] = useState('de');
  const [isDnsTesting, setIsDnsTesting] = useState(false);
  const [dnsTestTrigger, setDnsTestTrigger] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOnionMode = mode === ConnectionMode.ONION_VORTEX;
  const isSmartDNS = mode === ConnectionMode.SMART_DNS;
  const isWireGuard = protocol.toLowerCase() === 'wireguard';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const excludedNodesCount = useMemo(
    () =>
      nodes.filter((n) =>
        isCountryExcludedByJurisdiction(
          n.country,
          settings.excludeEyesJurisdictions
        )
      ).length,
    [nodes, settings.excludeEyesJurisdictions]
  );

  const getEffectiveLatency = (node: DeviceNode) =>
    probedLatencies[node.id] ?? node.latency;

  const filteredNodes = useMemo(() => {
    return nodes
      .filter((node) => {
        if (
          isCountryExcludedByJurisdiction(
            node.country,
            settings.excludeEyesJurisdictions
          )
        ) {
          return false;
        }
        const matchesCountry =
          countryFilter === 'Tous' || node.country === countryFilter;
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          node.name.toLowerCase().includes(q) ||
          node.country.toLowerCase().includes(q) ||
          (node.city && node.city.toLowerCase().includes(q)) ||
          node.ip.includes(q);
        return matchesCountry && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'latency') {
          return (probedLatencies[a.id] ?? a.latency) - (probedLatencies[b.id] ?? b.latency);
        }
        if (sortBy === 'rate') {
          return b.transferRate - a.transferRate;
        }
        return b.signalStrength - a.signalStrength;
      });
  }, [
    nodes,
    countryFilter,
    searchQuery,
    sortBy,
    settings.excludeEyesJurisdictions,
    probedLatencies,
  ]);

  // Build deterministic multi-hop Vortex circuit from available nodes + circuitSeed
  const vortexCircuitHops = useMemo(() => {
    const hopCount = Math.max(3, Math.min(6, settings.vortexCircuitLength));
    const pool = nodes.filter(
      (n) =>
        !isCountryExcludedByJurisdiction(
          n.country,
          settings.excludeEyesJurisdictions
        )
    );
    const source = pool.length >= 3 ? pool : nodes;
    if (source.length === 0) return [];

    const hops: { role: string; node: DeviceNode }[] = [];
    for (let i = 0; i < hopCount; i++) {
      let picked = source[(i * 3 + circuitSeed * 2) % source.length];
      if (
        i === 0 &&
        settings.vortexEntryNodeCountry !== 'auto'
      ) {
        const match = source.find(
          (n) => n.country === settings.vortexEntryNodeCountry
        );
        if (match) picked = match;
      } else if (
        i === hopCount - 1 &&
        settings.vortexExitNodeCountry !== 'auto'
      ) {
        const match = source.find(
          (n) => n.country === settings.vortexExitNodeCountry
        );
        if (match) picked = match;
      }
      const role =
        i === 0
          ? 'Garde Entrée'
          : i === hopCount - 1
            ? 'Nœud de Sortie'
            : `Relais Intermédiaire #${i}`;
      hops.push({ role, node: picked });
    }
    return hops;
  }, [
    nodes,
    settings.vortexCircuitLength,
    settings.vortexEntryNodeCountry,
    settings.vortexExitNodeCountry,
    settings.excludeEyesJurisdictions,
    circuitSeed,
  ]);

  const handleProbeLatencies = () => {
    if (isProbingNodes) return;
    setIsProbingNodes(true);
    addLog('Mesure ICMP/UDP temps réel lancée sur la matrice des relais...', 'info');
    setTimeout(() => {
      const nextMap: Record<string, number> = {};
      nodes.forEach((n) => {
        const jitter = Math.round((Math.random() - 0.45) * 6);
        nextMap[n.id] = Math.max(6, n.latency + jitter);
      });
      setProbedLatencies(nextMap);
      setIsProbingNodes(false);
      const best = [...filteredNodes].sort(
        (a, b) => (nextMap[a.id] ?? a.latency) - (nextMap[b.id] ?? b.latency)
      )[0];
      if (best) {
        addLog(
          `Sondage terminé : relais optimal détecté sur ${best.name} (${nextMap[best.id] ?? best.latency} ms)`,
          'success',
          best.ip
        );
      }
    }, 650);
  };

  const handleConnectFastestNode = () => {
    if (filteredNodes.length === 0) return;
    const fastest = [...filteredNodes].sort(
      (a, b) => getEffectiveLatency(a) - getEffectiveLatency(b)
    )[0];
    if (fastest) {
      onConnectNode(fastest.id);
    }
  };

  const handleRebuildVortexCircuit = () => {
    setCircuitSeed((s) => s + 1);
    setResolvedOnionEndpoint(null);
    addLog(
      `Nouveau circuit Onion Vortex (${settings.vortexCircuitLength} sauts) négocié avec isolation de flux`,
      'success'
    );
  };

  const handleResolveOnion = (e?: React.FormEvent, directUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = (directUrl || onionUrl).trim();
    if (!targetUrl.toLowerCase().endsWith('.onion')) {
      addLog("Adresse invalide : le domaine cible doit se terminer par .onion", 'error');
      return;
    }
    if (!isConnected) {
      addLog(
        'Activez d’abord le tunnel VPN pour router les requêtes .onion via Vortex.',
        'warning'
      );
      return;
    }
    setIsOnionResolving(true);
    addLog(`Négociation du point de rendez-vous Vortex pour ${targetUrl}...`, 'info');
    setTimeout(() => {
      const totalRtt =
        vortexCircuitHops.reduce((sum, h) => sum + h.node.latency, 0) +
        Math.floor(Math.random() * 28 + 18);
      setIsOnionResolving(false);
      setOnionUrl('');
      setResolvedOnionEndpoint({ url: targetUrl, rttMs: totalRtt });
      addLog(
        `Circuit établi vers ${targetUrl} (${vortexCircuitHops.length} sauts · RTT ${totalRtt} ms)`,
        'success'
      );
    }, 1100);
  };

  const getNodeStatusBadge = (node: DeviceNode) => {
    const lat = getEffectiveLatency(node);
    if (lat <= 25 && node.signalStrength >= 90) {
      return {
        label: 'Faible latence',
        color:
          'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
      };
    }
    if (node.tags.includes('stealth') || node.tags.includes('exit')) {
      return {
        label: 'Furtif / Sortie',
        color:
          'text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/25',
      };
    }
    return {
      label: 'Stable',
      color: 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/25',
    };
  };

  const modes = [
    {
      id: ConnectionMode.STANDARD,
      icon: Shield,
      label: 'Standard',
      desc: 'Vitesse & sécurité',
    },
    {
      id: ConnectionMode.STEALTH,
      icon: Ghost,
      label: 'Furtif',
      desc: 'Anti-DPI obfusqué',
    },
    {
      id: ConnectionMode.DOUBLE_HOP,
      icon: Layers,
      label: 'Double Saut',
      desc: '2 juridictions',
    },
    {
      id: ConnectionMode.SMART_DNS,
      icon: Globe,
      label: 'Smart DNS',
      desc: 'Streaming direct',
    },
    {
      id: ConnectionMode.ONION_VORTEX,
      icon: Orbit,
      label: 'Vortex',
      desc: 'Circuit multi-relais',
    },
  ];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeScore =
    isOnionMode && isConnected
      ? 100
      : isEmergency
        ? 15
        : securityReport?.score ||
          (isConnected ? (userPlan === 'free' ? 74 : 95) : 28);

  const selectedStreamingObj =
    STREAMING_REGIONS.find((r) => r.id === selectedRegion) || STREAMING_REGIONS[0];

  return (
    <div className="space-y-6">
      {/* Architecture Mode Selector (Live-Switchable) */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            const isVortex = m.id === ConnectionMode.ONION_VORTEX;
            const isDNS = m.id === ConnectionMode.SMART_DNS;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (mode !== m.id) {
                    onModeChange(m.id);
                    addLog(
                      `Architecture de routage basculée sur ${m.label}${isConnected ? ' (renégociation à chaud)' : ''}`,
                      'info'
                    );
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isActive
                    ? isVortex
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : isDNS
                        ? 'bg-amber-500 text-white border-amber-400 shadow-sm'
                        : 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                    : 'bg-slate-50/70 dark:bg-slate-950/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive
                      ? 'text-white'
                      : isVortex
                        ? 'text-purple-500'
                        : isDNS
                          ? 'text-amber-500'
                          : 'text-cyan-600 dark:text-cyan-400'
                  }`}
                />
                <span className="text-xs font-bold leading-tight">{m.label}</span>
                <span
                  className={`text-[10px] leading-tight hidden sm:block ${
                    isActive ? 'text-white/85' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {m.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Telemetry & Anonymity Posture Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Moniteur de transmission chiffrée
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Flux temps réel, gigue réseau et volume de session
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-xs font-mono tabular-nums font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  isOnionMode
                    ? 'text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/25'
                    : isSmartDNS
                      ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25'
                      : 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/25'
                }`}
              >
                {isWireGuard && !isOnionMode && !isSmartDNS && (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {isOnionMode
                  ? `Vortex (${settings.vortexCircuitLength} sauts)`
                  : isSmartDNS
                    ? 'Relais Smart DNS'
                    : `${protocol.toUpperCase()} :${settings.tunnelPort}`}
              </span>

              {settings.splitTunneling && (
                <span className="text-[11px] font-mono tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Split Tunnel ({settings.splitTunnelRules.filter((r) => r.enabled).length})
                </span>
              )}

              {settings.socks5Enabled && (
                <span className="text-[11px] font-mono tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  SOCKS5 :{settings.socks5Port}
                </span>
              )}
            </div>
          </div>

          <TrafficMonitor
            isDark={isDark}
            isConnected={isConnected}
            isEmergency={isEmergency}
            throughput={throughput}
            baseLatency={baseLatency}
            mode={mode}
          />
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Indice de confidentialité
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Évaluation continue du périmètre
              </p>
            </div>
          </div>

          <AnonymityScore
            score={activeScore}
            isDark={isDark}
            isConnected={isConnected}
            settings={settings}
          />
        </div>
      </div>

      {/* DNS Leak Diagnostic Tool */}
      <DnsLeakTester
        isConnected={isConnected}
        mode={mode}
        protocol={protocol}
        currentIp={currentIp}
        nodes={nodes}
        settings={settings}
        updateSettings={updateSettings}
        addLog={addLog}
        externalTriggerCount={dnsTestTrigger}
      />

      {/* Onion Vortex Multi-Hop Hub */}
      {isOnionMode && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-500/30 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-4">
            {/* Left Circuit Configuration Sidebar */}
            <div className="xl:col-span-1 p-6 bg-slate-50 dark:bg-slate-950/60 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex items-center gap-2.5">
                <Settings2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Paramètres du circuit
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                  Pont de transport (Bridge)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['none', 'obfs4', 'snowflake', 'meek-azure'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => updateSettings?.('vortexBridge', b)}
                      className={`py-2 px-2 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                        settings.vortexBridge === b
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-400'
                      }`}
                    >
                      {b === 'none' ? 'Direct' : b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                  Longueur du chaînage
                </label>
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings?.(
                        'vortexCircuitLength',
                        Math.max(3, settings.vortexCircuitLength - 1)
                      )
                    }
                    className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-mono tabular-nums text-xs font-bold text-purple-600 dark:text-purple-400">
                    {settings.vortexCircuitLength} sauts chiffrés
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings?.(
                        'vortexCircuitLength',
                        Math.min(6, settings.vortexCircuitLength + 1)
                      )
                    }
                    className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Mode strict NoScript
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Bloque les vecteurs actifs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings?.('vortexNoScript', !settings.vortexNoScript)
                  }
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    settings.vortexNoScript
                      ? 'bg-purple-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.vortexNoScript ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={handleRebuildVortexCircuit}
                className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Nouvelle route Vortex</span>
              </button>
            </div>

            {/* Right Main Onion Hub */}
            <div className="xl:col-span-3 p-6 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                    <Orbit className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span>Passerelle Onion Vortex (.onion)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isConnected
                      ? 'Isolation de flux active — chaque domaine .onion emprunte un circuit dédié.'
                      : 'Activez le tunnel VPN principal pour ouvrir les circuits .onion.'}
                  </p>
                </div>

                <form
                  onSubmit={handleResolveOnion}
                  className="flex items-center gap-2 w-full lg:w-auto"
                >
                  <div className="relative flex-1 lg:w-72">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                    <input
                      type="text"
                      placeholder="adresse-service.onion"
                      value={onionUrl}
                      onChange={(e) => setOnionUrl(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      isOnionResolving || !onionUrl.trim().toLowerCase().endsWith('.onion')
                    }
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {isOnionResolving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Ouvrir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {resolvedOnionEndpoint && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Rendez-vous chiffré actif vers{' '}
                      <span className="font-mono font-bold">
                        {resolvedOnionEndpoint.url}
                      </span>
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold">
                    Latence circuit : {resolvedOnionEndpoint.rttMs} ms
                  </span>
                </div>
              )}

              {/* Live Multi-Hop Node Chain */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <div className="flex items-center justify-between min-w-[520px] gap-2">
                  {vortexCircuitHops.map((hop, idx) => (
                    <React.Fragment key={`${hop.node.id}-${idx}`}>
                      <div className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                          <span>{hop.role}</span>
                          {idx === 0 ? (
                            <Key className="w-3.5 h-3.5 text-emerald-500" />
                          ) : idx === vortexCircuitHops.length - 1 ? (
                            <Globe2 className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <ShieldHalf className="w-3.5 h-3.5 text-cyan-500" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{COUNTRIES_WITH_FLAGS[hop.node.country] || '🌍'}</span>
                          <span className="truncate">{hop.node.name}</span>
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-500 flex items-center justify-between">
                          <span>{hop.node.ip}</span>
                          <span className="text-purple-600 dark:text-purple-400 font-semibold">
                            {hop.node.latency} ms
                          </span>
                        </div>
                      </div>
                      {idx < vortexCircuitHops.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Verified Onion Services Directory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {VERIFIED_ONION_SERVICES.map((svc) => (
                  <button
                    key={svc.url}
                    type="button"
                    onClick={() => handleResolveOnion(undefined, svc.url)}
                    disabled={!isConnected || isOnionResolving}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 hover:border-purple-500/50 text-left transition-all disabled:opacity-50 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <Box className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        {svc.security}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                      {svc.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {svc.category}
                    </p>
                    <div className="mt-3 font-mono text-[10px] text-purple-700 dark:text-purple-300 truncate bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      {svc.url}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Node Acquisition Matrix (Standard / Stealth / Double Hop) */}
      {!isOnionMode && !isSmartDNS && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            {/* Matrix Header & Controls */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Matrice des relais VPN ({filteredNodes.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 pl-5">
                  Sélectionnez un relais pour établir ou basculer le tunnel chiffré à chaud.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleConnectFastestNode}
                  disabled={filteredNodes.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Relais optimal auto</span>
                </button>

                <button
                  type="button"
                  onClick={handleProbeLatencies}
                  disabled={isProbingNodes}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isProbingNodes ? 'animate-spin text-cyan-500' : ''}`}
                  />
                  <span>Sonder les pings</span>
                </button>
              </div>
            </div>

            {/* Filter & Sort Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par pays, ville, code ou IP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 min-w-[175px] cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-cyan-500" />
                      <span>
                        {countryFilter === 'Tous' ? 'Tous les pays' : countryFilter}
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full mt-1.5 right-0 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 max-h-72 overflow-y-auto">
                      {(
                        [
                          'Tous',
                          ...Array.from(new Set(nodes.map((n) => n.country))).sort(),
                        ] as string[]
                      ).map((country) => (
                        <button
                          key={country}
                          type="button"
                          onClick={() => {
                            setCountryFilter(country);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            countryFilter === country
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-base">
                            {COUNTRIES_WITH_FLAGS[country] || '🌍'}
                          </span>
                          <span>{country}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sort Segmented Control */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
                {(
                  [
                    { id: 'latency', label: 'Latence' },
                    { id: 'rate', label: 'Débit' },
                    { id: 'signal', label: 'Signal' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSortBy(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      sortBy === s.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {settings.excludeEyesJurisdictions !== 'none' && (
              <div className="px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-purple-800 dark:text-purple-200 font-semibold font-mono tabular-nums">
                  Exclusion juridictionnelle {settings.excludeEyesJurisdictions.toUpperCase()} active ·{' '}
                  {excludedNodesCount} relais masqués
                </span>
                {updateSettings && (
                  <button
                    type="button"
                    onClick={() => updateSettings('excludeEyesJurisdictions', 'none')}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Afficher tous les pays
                  </button>
                )}
              </div>
            )}

            {/* Relay Cards Grid */}
            {filteredNodes.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Aucun relais ne correspond aux filtres sélectionnés
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCountryFilter('Tous');
                  }}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold cursor-pointer"
                >
                  Réinitialiser la recherche
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
                {filteredNodes.map((node) => {
                  const isActive = node.ip === currentIp && isConnected;
                  const isSelectedOffline = node.ip === currentIp && !isConnected;
                  const effLatency = getEffectiveLatency(node);
                  const statusInfo = getNodeStatusBadge(node);

                  return (
                    <div
                      key={node.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                        isActive
                          ? 'bg-emerald-500/[0.06] dark:bg-emerald-500/10 border-emerald-500/50'
                          : isSelectedOffline
                            ? 'bg-cyan-500/[0.04] dark:bg-cyan-500/5 border-cyan-500/40'
                            : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">
                            {COUNTRIES_WITH_FLAGS[node.country] || '📍'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {node.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{node.city || node.country}</span>
                              <span>·</span>
                              <span className="font-mono tabular-nums">{node.ip}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Latence</span>
                          <span
                            className={`font-mono tabular-nums font-bold ${
                              effLatency <= 35
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : effLatency <= 85
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {effLatency} ms
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Capacité</span>
                          <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                            {node.transferRate} Mo/s
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Signal</span>
                          <span className="font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                            {node.signalStrength}%
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isActive && onDisconnect) {
                            onDisconnect();
                          } else {
                            onConnectNode(node.id);
                          }
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-emerald-600 hover:bg-red-600 text-white'
                            : isConnected
                              ? 'bg-slate-900 dark:bg-slate-800 hover:bg-cyan-600 dark:hover:bg-cyan-600 text-white'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>
                          {isActive
                            ? 'Connecté · Déconnecter'
                            : isConnected
                              ? 'Basculer vers ce relais'
                              : 'Connecter ce relais'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collapsible Recent Sessions Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <History className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Journaux de liaisons récentes
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {history.length} session{history.length > 1 ? 's' : ''} enregistrée
                    {history.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  showHistory ? 'rotate-180 text-cyan-500' : ''
                }`}
              />
            </button>

            {showHistory && (
              <div className="px-6 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800">
                {history.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    Aucune session archivée pour le moment.
                  </p>
                ) : (
                  <div className="space-y-2 mt-3">
                    {history.slice(0, 5).map((session) => (
                      <div
                        key={session.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {COUNTRIES_WITH_FLAGS[session.serverCountry] || '📍'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {session.serverCountry}
                              </span>
                              <span className="text-[11px] font-mono tabular-nums text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                {session.serverIp}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(session.startTime)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                {session.protocol.toUpperCase()} · {session.mode}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono tabular-nums text-xs font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{session.durationString}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart DNS Streaming Regions */}
      {isSmartDNS && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-amber-500/30 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                <Tv className="w-5 h-5 text-amber-500" />
                <span>Passerelles multimédias Smart DNS</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Résolution géo-optimisée sans surcharge de chiffrement complet pour le streaming UHD.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums px-3 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-semibold">
              Résolveur actif : {selectedStreamingObj.resolverIp}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {STREAMING_REGIONS.map((region) => {
              const active = selectedRegion === region.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => {
                    setSelectedRegion(region.id);
                    addLog(
                      `Relais Smart DNS orienté vers ${region.name} (${region.resolverIp})`,
                      'info',
                      region.resolverIp
                    );
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl">{region.flag}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      {region.status}
                    </span>
                  </div>
                  <h4
                    className={`text-xs font-bold ${
                      active
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {region.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {region.service}
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                    <span>{region.baseDelay} ms</span>
                    <span>{region.resolverIp}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Routage DNS sélectif vers {selectedStreamingObj.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vérifiez l’absence de fuite FAI vers votre résolveur local via l’outil d’audit ci-dessus.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsDnsTesting(true);
                setDnsTestTrigger((c) => c + 1);
                setTimeout(() => setIsDnsTesting(false), 1800);
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {isDnsTesting ? 'Audit DNS en cours...' : 'Tester le relais DNS'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
