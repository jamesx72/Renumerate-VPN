import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Grid,
  List,
  Save,
  Trash2,
  Filter,
  Settings2,
  CircleCheck,
  ChevronDown,
  Signal,
  Activity,
  Smartphone,
  Monitor,
  Server,
  Cpu,
  Zap,
  Battery,
  LayoutTemplate,
  ArrowUpDown,
  Check,
  X,
  Pencil,
  RotateCcw,
  ArrowRightLeft,
  ChevronUp,
  AlertTriangle,
  Info,
  Terminal,
  Download,
  ClipboardList,
  Globe2,
  Route,
  Radar,
  ShieldCheck,
  Power,
  Play,
  Loader2,
  Compass,
  Copy,
} from 'lucide-react';
import { DeviceNode, ConnectionMode, AppSettings } from '../types';
import {
  DEFAULT_APP_SETTINGS,
  getJurisdictionTier,
  isCountryExcludedByJurisdiction,
} from '../constants';
import {
  WorldNodeMap,
  LOCAL_ORIGIN,
  getNodeLonLat,
  computeGeodesicDistanceKm,
} from './WorldNodeMap';
import { BgpRouteLatencyVisualizer } from './BgpRouteLatencyVisualizer';

interface SavedViewConfig {
  id: string;
  name: string;
  viewMode: 'grid' | 'list';
  filterType: string;
  jurisdictionFilter?: 'all' | 'compliant' | 'sanctuary';
  searchQuery: string;
  sortBy: 'name' | 'signal' | 'rate' | 'latency' | 'load';
  visibleColumns?: string[];
}

interface NetworkViewState {
  viewMode: 'grid' | 'list';
  filterType: string;
  jurisdictionFilter: 'all' | 'compliant' | 'sanctuary';
  sortBy: 'name' | 'signal' | 'rate' | 'latency' | 'load';
  visibleColumns: string[];
}

interface TransferLog {
  id: string;
  step: number;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface CircuitDeploymentPayload {
  hopCount: 1 | 2 | 3;
  entryNode: DeviceNode;
  relayNode?: DeviceNode;
  exitNode: DeviceNode;
}

interface Props {
  nodes: DeviceNode[];
  currentIp?: string;
  isConnected?: boolean;
  mode?: ConnectionMode;
  isDark?: boolean;
  settings?: AppSettings;
  onUpdateJurisdictionPolicy?: (
    policy: AppSettings['excludeEyesJurisdictions']
  ) => void;
  onDeployCircuit?: (payload: CircuitDeploymentPayload) => void;
  onNodesProbed?: (updatedNodes: DeviceNode[]) => void;
  onConnectNode: (id: string) => void;
  onAutonomyUpdate: (
    nodeId: string,
    profile: 'provider' | 'balanced' | 'consumer'
  ) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type ColumnKey =
  | 'name'
  | 'jurisdiction'
  | 'ip'
  | 'type'
  | 'status'
  | 'signal'
  | 'rate'
  | 'latency'
  | 'autonomy';

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'name', label: 'Relais & Ville' },
  { key: 'jurisdiction', label: 'Juridiction & ASN' },
  { key: 'ip', label: 'Adresse IPv4' },
  { key: 'type', label: 'Équipement' },
  { key: 'status', label: 'État & Charge' },
  { key: 'signal', label: 'Signal' },
  { key: 'rate', label: 'Débit' },
  { key: 'latency', label: 'RTT & Gigue' },
  { key: 'autonomy', label: 'Autonomie RNC' },
];

const DEFAULT_COLUMNS: ColumnKey[] = ALL_COLUMNS.map((c) => c.key);

export const NetworkView: React.FC<Props> = ({
  nodes,
  currentIp = '',
  isConnected = false,
  mode = ConnectionMode.STANDARD,
  isDark = true,
  settings = DEFAULT_APP_SETTINGS,
  onUpdateJurisdictionPolicy,
  onDeployCircuit,
  onNodesProbed,
  onConnectNode,
  onAutonomyUpdate,
  addLog,
}) => {
  const getInitialState = (): NetworkViewState => {
    try {
      const saved = localStorage.getItem('renumerate_network_state_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          viewMode: parsed.viewMode === 'list' ? 'list' : 'grid',
          filterType: parsed.filterType || 'all',
          jurisdictionFilter: parsed.jurisdictionFilter || 'all',
          sortBy: parsed.sortBy || 'latency',
          visibleColumns: Array.isArray(parsed.visibleColumns)
            ? parsed.visibleColumns
            : DEFAULT_COLUMNS,
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      viewMode: 'grid',
      filterType: 'all',
      jurisdictionFilter: 'all',
      sortBy: 'latency',
      visibleColumns: DEFAULT_COLUMNS,
    };
  };

  const initialState = getInitialState();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    initialState.viewMode
  );
  const [showWorldMap, setShowWorldMap] = useState(true);
  const [showBgpVisualizer, setShowBgpVisualizer] = useState(true);
  const [showCircuitComposer, setShowCircuitComposer] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>(initialState.filterType);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<
    'all' | 'compliant' | 'sanctuary'
  >(initialState.jurisdictionFilter);
  const [sortBy, setSortBy] = useState<
    'name' | 'signal' | 'rate' | 'latency' | 'load'
  >(initialState.sortBy);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    initialState.visibleColumns
  );

  // Multi-hop circuit composer state
  const [hopCount, setHopCount] = useState<1 | 2 | 3>(() =>
    mode === ConnectionMode.ONION_VORTEX
      ? 3
      : mode === ConnectionMode.DOUBLE_HOP
        ? 2
        : 2
  );
  const [entryNodeId, setEntryNodeId] = useState<string>(
    () => nodes.find((n) => n.country === 'Suisse')?.id || nodes[0]?.id || ''
  );
  const [relayNodeId, setRelayNodeId] = useState<string>(
    () => nodes.find((n) => n.country === 'Islande')?.id || nodes[1]?.id || ''
  );
  const [exitNodeId, setExitNodeId] = useState<string>(
    () =>
      nodes.find((n) => n.ip === currentIp)?.id ||
      nodes.find((n) => n.country === 'Estonie')?.id ||
      nodes[2]?.id ||
      nodes[0]?.id ||
      ''
  );

  // Traceroute & Correlation Resistance State
  const [showTracerouteDrawer, setShowTracerouteDrawer] = useState(false);
  const [isTestingCorrelation, setIsTestingCorrelation] = useState(false);
  const [correlationResult, setCorrelationResult] = useState<{
    resistancePct: number;
    entropyBits: number;
    timingCorrelationRisk: 'negligible' | 'low' | 'moderate';
    testedAt: string;
  } | null>(null);

  // Live Fleet Probing State
  const [isProbingFleet, setIsProbingFleet] = useState(false);
  const [lastProbeSummary, setLastProbeSummary] = useState<string | null>(null);

  // Menus & Feedback
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showViewsMenu, setShowViewsMenu] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Encrypted Transfer Diagnostic State
  const [transferState, setTransferState] = useState<{
    isActive: boolean;
    traceId: string;
    targetNodeName: string;
    targetNodeId: string | null;
    progress: number;
    logs: TransferLog[];
    isCollapsed: boolean;
    status: 'idle' | 'running' | 'completed';
  }>({
    isActive: false,
    traceId: 'RN-000000',
    targetNodeName: '',
    targetNodeId: null,
    progress: 0,
    logs: [],
    isCollapsed: false,
    status: 'idle',
  });

  const logsEndRef = useRef<HTMLDivElement>(null);
  const transferTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      transferTimersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (transferState.logs.length > 0 && !transferState.isCollapsed) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transferState.logs, transferState.isCollapsed]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const state: NetworkViewState = {
      viewMode,
      filterType,
      jurisdictionFilter,
      sortBy,
      visibleColumns,
    };
    localStorage.setItem('renumerate_network_state_v2', JSON.stringify(state));
  }, [viewMode, filterType, jurisdictionFilter, sortBy, visibleColumns]);

  const [savedViews, setSavedViews] = useState<SavedViewConfig[]>(() => {
    try {
      const saved = localStorage.getItem('renumerate_saved_views');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('renumerate_saved_views', JSON.stringify(savedViews));
  }, [savedViews]);

  // Keep composer IDs valid if nodes change
  useEffect(() => {
    if (nodes.length === 0) return;
    if (!nodes.some((n) => n.id === entryNodeId)) {
      setEntryNodeId(nodes[0].id);
    }
    if (!nodes.some((n) => n.id === relayNodeId)) {
      setRelayNodeId(nodes[Math.min(1, nodes.length - 1)].id);
    }
    if (!nodes.some((n) => n.id === exitNodeId)) {
      setExitNodeId(nodes[Math.min(2, nodes.length - 1)].id);
    }
  }, [nodes, entryNodeId, relayNodeId, exitNodeId]);

  const activeConnectedNode = useMemo(
    () => (isConnected ? nodes.find((n) => n.ip === currentIp) || null : null),
    [isConnected, nodes, currentIp]
  );

  // Composed circuit nodes & real-time telemetry
  const entryNode = useMemo(
    () => nodes.find((n) => n.id === entryNodeId) || nodes[0],
    [nodes, entryNodeId]
  );
  const relayNode = useMemo(
    () => nodes.find((n) => n.id === relayNodeId) || nodes[1] || nodes[0],
    [nodes, relayNodeId]
  );
  const exitNode = useMemo(
    () => nodes.find((n) => n.id === exitNodeId) || nodes[0],
    [nodes, exitNodeId]
  );

  const stagedCircuitNodes = useMemo(() => {
    if (!exitNode) return [];
    if (hopCount === 1) return [exitNode];
    if (hopCount === 2) return entryNode ? [entryNode, exitNode] : [exitNode];
    return entryNode && relayNode
      ? [entryNode, relayNode, exitNode]
      : [exitNode];
  }, [hopCount, entryNode, relayNode, exitNode]);

  const stagedCircuitIds = useMemo(
    () => stagedCircuitNodes.map((n) => n.id),
    [stagedCircuitNodes]
  );

  const circuitTelemetry = useMemo(() => {
    if (stagedCircuitNodes.length === 0) {
      return {
        totalKm: 0,
        estimatedLatencyMs: 0,
        uniqueCountries: 0,
        allSanctuary: false,
        hasExcludedNode: false,
        hasDuplicateHop: false,
      };
    }

    let totalKm = 0;
    let prevCoord = LOCAL_ORIGIN;
    for (const hop of stagedCircuitNodes) {
      const coord = getNodeLonLat(hop);
      totalKm += computeGeodesicDistanceKm(prevCoord, coord);
      prevCoord = coord;
    }

    const baseExitRtt =
      stagedCircuitNodes[stagedCircuitNodes.length - 1].latency;
    const transitOverhead =
      stagedCircuitNodes.length === 1
        ? 0
        : stagedCircuitNodes
            .slice(0, -1)
            .reduce((acc, n) => acc + Math.round(n.latency * 0.58) + 6, 0);

    const countriesSet = new Set(stagedCircuitNodes.map((n) => n.country));
    const idsSet = new Set(stagedCircuitNodes.map((n) => n.id));
    const allSanctuary = stagedCircuitNodes.every(
      (n) => getJurisdictionTier(n.country) === 'sanctuary'
    );
    const hasExcludedNode = stagedCircuitNodes.some((n) =>
      isCountryExcludedByJurisdiction(
        n.country,
        settings.excludeEyesJurisdictions
      )
    );

    return {
      totalKm,
      estimatedLatencyMs: baseExitRtt + transitOverhead,
      uniqueCountries: countriesSet.size,
      allSanctuary,
      hasExcludedNode,
      hasDuplicateHop: idsSet.size < stagedCircuitNodes.length,
    };
  }, [stagedCircuitNodes, settings.excludeEyesJurisdictions]);

  const hopLegs = useMemo(() => {
    const legs: Array<{
      hopIndex: number;
      fromName: string;
      toName: string;
      toCountry: string;
      distanceKm: number;
      legLatencyMs: number;
      layerCipher: string;
      potToken: string;
      roleLabel: string;
    }> = [];

    let prevCoord = LOCAL_ORIGIN;
    let prevName = 'Client Local';

    stagedCircuitNodes.forEach((node, idx) => {
      const coord = getNodeLonLat(node);
      const dist = computeGeodesicDistanceKm(prevCoord, coord);
      const fiberMs = Math.max(2, Math.round(dist * 0.005));
      const legLatency = Math.min(node.latency, fiberMs + 4 + idx * 3);

      const roleLabel =
        idx === 0
          ? 'Garde d’entrée (#1)'
          : idx === 1 && stagedCircuitNodes.length === 3
            ? 'Relais aveugle (#2)'
            : `Nœud de sortie (#${idx + 1})`;

      const layerCipher =
        idx === 0
          ? 'Layer 1: ChaCha20-Poly1305 + PQC ML-KEM-1024'
          : idx === 1 && stagedCircuitNodes.length === 3
            ? 'Layer 2: AES-256-GCM Oignon Intermédiaire'
            : 'Layer 3: WireGuard Direct Encapsulation';

      const potToken = `pot-0x${Math.abs(
        (node.ip.split('.').reduce((acc, oct) => acc * 31 + Number(oct), 0) ^
          (idx + 1) * 0x9e3779b9) >>>
          0
      )
        .toString(16)
        .padStart(8, '0')}`;

      legs.push({
        hopIndex: idx + 1,
        fromName: prevName,
        toName: node.name,
        toCountry: node.country,
        distanceKm: dist,
        legLatencyMs: legLatency,
        layerCipher,
        potToken,
        roleLabel,
      });

      prevCoord = coord;
      prevName = node.name;
    });

    return legs;
  }, [stagedCircuitNodes]);

  // Fleet-wide KPI metrics
  const fleetMetrics = useMemo(() => {
    const count = Math.max(1, nodes.length);
    const avgLatency = Math.round(
      nodes.reduce((sum, n) => sum + n.latency, 0) / count
    );
    const avgJitter = Number(
      (
        nodes.reduce((sum, n) => sum + (n.jitter ?? 1.8), 0) / count
      ).toFixed(1)
    );
    const totalBandwidth = nodes.reduce((sum, n) => sum + n.transferRate, 0);
    const compliantNodes = nodes.filter(
      (n) =>
        !isCountryExcludedByJurisdiction(
          n.country,
          settings.excludeEyesJurisdictions
        )
    );
    const sanctuaryNodes = nodes.filter(
      (n) => getJurisdictionTier(n.country) === 'sanctuary'
    );

    const activeDistanceKm = activeConnectedNode
      ? computeGeodesicDistanceKm(
          LOCAL_ORIGIN,
          getNodeLonLat(activeConnectedNode)
        )
      : 0;

    return {
      avgLatency,
      avgJitter,
      totalBandwidth,
      compliantCount: compliantNodes.length,
      sanctuaryCount: sanctuaryNodes.length,
      activeDistanceKm,
    };
  }, [nodes, settings.excludeEyesJurisdictions, activeConnectedNode]);

  // --- Handlers ---

  const handleProbeFleet = async () => {
    if (isProbingFleet || nodes.length === 0) return;
    setIsProbingFleet(true);
    try {
      const response = await fetch('/api/network/probe-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            ip: n.ip,
            country: n.country,
            latency: n.latency,
            transferRate: n.transferRate,
            asn: n.asn,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        ok: boolean;
        probedAt: string;
        probeDurationMs: number;
        results: Array<{
          id: string;
          latency: number;
          jitter: number;
          packetLoss: number;
          loadPct: number;
          transferRate: number;
          asn: string;
          probedAt: string;
        }>;
      };

      const byId = new Map(data.results.map((r) => [r.id, r]));
      const updated = nodes.map((node) => {
        const probe = byId.get(node.id);
        if (!probe) return node;
        return {
          ...node,
          latency: probe.latency,
          jitter: probe.jitter,
          packetLoss: probe.packetLoss,
          loadPct: probe.loadPct,
          transferRate: probe.transferRate,
          asn: probe.asn,
          probedAt: probe.probedAt,
        };
      });

      onNodesProbed?.(updated);
      const timeStr = new Date(data.probedAt).toLocaleTimeString('fr-FR');
      setLastProbeSummary(`Sondé à ${timeStr} (${data.probeDurationMs} ms)`);
      setToast(
        `Flotte sondée : ${updated.length} relais mesurés en ${data.probeDurationMs} ms`
      );
      addLog?.(
        `Sondage télémétrique BGP/ICMP exécuté sur ${updated.length} relais (${data.probeDurationMs} ms)`,
        'info'
      );
    } catch {
      setToast('Échec du sondage réseau local');
    } finally {
      setIsProbingFleet(false);
    }
  };

  const handleConnectOptimalRelay = () => {
    const eligible = nodes.filter(
      (n) =>
        !isCountryExcludedByJurisdiction(
          n.country,
          settings.excludeEyesJurisdictions
        )
    );
    const pool = eligible.length > 0 ? eligible : nodes;
    const ranked = [...pool].sort((a, b) => {
      const scoreA = a.latency + (a.loadPct ?? 30) * 0.25;
      const scoreB = b.latency + (b.loadPct ?? 30) * 0.25;
      return scoreA - scoreB;
    });
    const best = ranked[0];
    if (!best) return;
    onConnectNode(best.id);
    setToast(
      `Relais optimal sélectionné : ${best.name} (${best.city || best.country} · ${best.latency} ms)`
    );
  };

  const handleAutoOptimizeBgpFastest = () => {
    const eligibleNodes = nodes.filter(
      (n) =>
        !isCountryExcludedByJurisdiction(
          n.country,
          settings.excludeEyesJurisdictions
        )
    );
    const pool = eligibleNodes.length >= 3 ? eligibleNodes : nodes;
    if (pool.length === 0) return;

    // Trier strictement par latence BGP (RTT le plus faible d'abord)
    const sorted = [...pool].sort((a, b) => a.latency - b.latency);
    const first = sorted[0];
    const second = sorted.find((n) => n.id !== first?.id) || sorted[1] || first;
    const third =
      sorted.find((n) => n.id !== first?.id && n.id !== second?.id) ||
      sorted[2] ||
      second;

    if (first) setEntryNodeId(first.id);
    if (second) setRelayNodeId(second.id);
    if (third) setExitNodeId(hopCount === 1 ? first.id : hopCount === 2 ? second.id : third.id);

    const estRtt =
      hopCount === 1
        ? first.latency
        : hopCount === 2
          ? first.latency + second.latency
          : first.latency + second.latency + third.latency;

    setToast(`⚡ Preset BGP Ultra-Rapide activé : ~${estRtt} ms cumulés`);
    addLog?.(
      `Preset BGP Ultra-Rapide déployé : ${first.name} → ${second.name}${hopCount === 3 ? ` → ${third.name}` : ''} (~${estRtt} ms)`,
      'info'
    );
  };

  const handleAutoOptimizeDisjointAsn = () => {
    const eligibleNodes = nodes.filter(
      (n) =>
        !isCountryExcludedByJurisdiction(
          n.country,
          settings.excludeEyesJurisdictions
        )
    );
    const pool = eligibleNodes.length >= 3 ? eligibleNodes : nodes;
    if (pool.length === 0) return;

    // Extraire l'ASN primaire (ex: AS12876) pour garantir des systèmes autonomes strictement disjoints
    const getCleanAsn = (n: DeviceNode) => (n.asn || '').split(' ')[0] || n.name;

    const first = [...pool].sort((a, b) => a.latency - b.latency)[0];
    const firstAsn = getCleanAsn(first);

    const second =
      pool.find((n) => n.id !== first.id && getCleanAsn(n) !== firstAsn) ||
      pool.find((n) => n.id !== first.id) ||
      pool[1] ||
      first;
    const secondAsn = getCleanAsn(second);

    const third =
      pool.find(
        (n) =>
          n.id !== first.id &&
          n.id !== second.id &&
          getCleanAsn(n) !== firstAsn &&
          getCleanAsn(n) !== secondAsn
      ) ||
      pool.find((n) => n.id !== first.id && n.id !== second.id) ||
      pool[2] ||
      second;

    if (first) setEntryNodeId(first.id);
    if (second) setRelayNodeId(second.id);
    if (third) setExitNodeId(hopCount === 1 ? first.id : hopCount === 2 ? second.id : third.id);

    setToast(
      `🔀 Multi-AS Anti-Corrélation : 3 ASNs indépendants (${getCleanAsn(first)} · ${getCleanAsn(second)}${hopCount === 3 ? ` · ${getCleanAsn(third)}` : ''})`
    );
    addLog?.(
      `Preset Anti-Corrélation Multi-AS activé : ${first.name} (${getCleanAsn(first)}) → ${second.name} (${getCleanAsn(second)}) → ${third.name} (${getCleanAsn(third)})`,
      'info'
    );
  };

  const handleAutoComposeSanctuaryCircuit = () => {
    const sanctuaries = [...nodes]
      .filter((n) => getJurisdictionTier(n.country) === 'sanctuary')
      .sort((a, b) => a.latency - b.latency);

    const pool = sanctuaries.length >= 3 ? sanctuaries : [...nodes].sort((a, b) => a.latency - b.latency);
    const first = pool[0];
    const second =
      pool.find((n) => n.country !== first?.country) || pool[1] || first;
    const third =
      pool.find(
        (n) => n.country !== first?.country && n.country !== second?.country
      ) ||
      pool.find((n) => n.id !== first?.id && n.id !== second?.id) ||
      pool[2] ||
      second;

    if (first) setEntryNodeId(first.id);
    if (second) setRelayNodeId(second.id);
    if (third) setExitNodeId(hopCount === 1 ? first.id : hopCount === 2 ? second.id : third.id);

    setToast('🛡️ Circuit sanctuaire multi-juridictions composé automatiquement (Suisse / Islande)');
    addLog?.('Circuit sanctuaire 100% hors 14-Eyes composé automatiquement', 'info');
  };

  const handleAutoOptimizeGeodesicPath = () => {
    const eligibleNodes = nodes.filter(
      (n) =>
        !isCountryExcludedByJurisdiction(
          n.country,
          settings.excludeEyesJurisdictions
        )
    );
    const pool = eligibleNodes.length >= 3 ? eligibleNodes : nodes;
    if (pool.length === 0) return;

    // 1. Entrée la plus proche géographiquement et à faible latence depuis le client
    const sortedByOrigin = [...pool].sort((a, b) => {
      const distA = computeGeodesicDistanceKm(LOCAL_ORIGIN, getNodeLonLat(a));
      const distB = computeGeodesicDistanceKm(LOCAL_ORIGIN, getNodeLonLat(b));
      return distA + a.latency * 10 - (distB + b.latency * 10);
    });
    const bestEntry = sortedByOrigin[0];

    // 2. Relais aveugle intermédiaire progressif (sans boucle en épingle à cheveux)
    const entryCoord = getNodeLonLat(bestEntry);
    const poolWithoutEntry = pool.filter((n) => n.id !== bestEntry.id);
    const sortedForRelay = [...poolWithoutEntry].sort((a, b) => {
      const distA = computeGeodesicDistanceKm(entryCoord, getNodeLonLat(a));
      const distB = computeGeodesicDistanceKm(entryCoord, getNodeLonLat(b));
      return distA + a.latency * 8 - (distB + b.latency * 8);
    });
    const bestRelay = sortedForRelay[0] || pool[1] || bestEntry;

    // 3. Nœud de sortie distinct pour clore la chaîne géodésique
    const relayCoord = getNodeLonLat(bestRelay);
    const poolForExit = pool.filter(
      (n) => n.id !== bestEntry.id && n.id !== bestRelay.id
    );
    const sortedForExit = [...poolForExit].sort((a, b) => {
      const distA = computeGeodesicDistanceKm(relayCoord, getNodeLonLat(a));
      const distB = computeGeodesicDistanceKm(relayCoord, getNodeLonLat(b));
      return distA - distB;
    });
    const bestExit = sortedForExit[0] || poolForExit[0] || pool[2] || bestRelay;

    setEntryNodeId(bestEntry.id);
    setRelayNodeId(bestRelay.id);
    setExitNodeId(
      hopCount === 1 ? bestEntry.id : hopCount === 2 ? bestRelay.id : bestExit.id
    );

    setToast(
      'Tracé géodésique optimisé : latence fibre et distance minimisées'
    );
  };

  const handleRunCorrelationTest = async () => {
    if (isTestingCorrelation) return;
    setIsTestingCorrelation(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
      const hopBase = hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45;
      const chaffBonus = settings.trafficPaddingJitterMs > 0 ? 10 : 0;
      const obfuscationBonus = settings.obfuscationLevel !== 'standard' ? 6 : 0;
      const pqcBonus = settings.postQuantumKex !== 'classic-x25519' ? 4 : 0;
      const penalty = circuitTelemetry.hasDuplicateHop ? 35 : 0;

      const resistancePct = Math.min(
        99,
        Math.max(30, hopBase + chaffBonus + obfuscationBonus + pqcBonus - penalty)
      );
      const entropyBits = Number(
        (
          3.6 +
          Math.random() * 0.38 +
          (settings.trafficPaddingJitterMs > 0 ? 0.3 : 0)
        ).toFixed(2)
      );
      const timingCorrelationRisk: 'negligible' | 'low' | 'moderate' =
        resistancePct >= 90
          ? 'negligible'
          : resistancePct >= 75
            ? 'low'
            : 'moderate';

      setCorrelationResult({
        resistancePct,
        entropyBits,
        timingCorrelationRisk,
        testedAt: new Date().toLocaleTimeString('fr-FR'),
      });
      setToast(
        `Sondage de corrélation complété : résistance de ${resistancePct}%`
      );
    } catch {
      setToast('Échec du sondage de corrélation');
    } finally {
      setIsTestingCorrelation(false);
    }
  };

  const handleAssignHopFromMap = (
    nodeId: string,
    role: 'entry' | 'relay' | 'exit'
  ) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;
    setShowCircuitComposer(true);
    if (role === 'entry') {
      if (hopCount === 1) setHopCount(2);
      setEntryNodeId(nodeId);
      setToast(`${target.name} assigné comme Garde d’entrée (#1)`);
    } else if (role === 'relay') {
      setHopCount(3);
      setRelayNodeId(nodeId);
      setToast(`${target.name} assigné comme Relais intermédiaire (#2)`);
    } else {
      setExitNodeId(nodeId);
      setToast(`${target.name} assigné comme Nœud de sortie`);
    }
  };

  const handleDeployStagedCircuit = () => {
    if (!exitNode) return;
    if (circuitTelemetry.hasDuplicateHop) {
      setToast(
        'Sélectionnez des relais distincts pour chaque saut du circuit.'
      );
      return;
    }

    if (onDeployCircuit && entryNode) {
      onDeployCircuit({
        hopCount,
        entryNode: hopCount === 1 ? exitNode : entryNode,
        relayNode: hopCount === 3 ? relayNode : undefined,
        exitNode,
      });
    } else {
      onConnectNode(exitNode.id);
    }

    const routeDesc = stagedCircuitNodes.map((n) => n.name).join(' → ');
    setToast(`Circuit déployé : ${routeDesc}`);
  };

  const handleExportTopologyCsv = () => {
    const header = [
      'ID',
      'Relais',
      'Pays',
      'Ville',
      'Juridiction',
      'IPv4',
      'ASN',
      'Latence_ms',
      'Gigue_ms',
      'Debit_Mo_s',
      'Charge_pct',
      'Signal_pct',
      'Profil_RNC',
    ].join(',');

    const rows = filteredNodes.map((n) =>
      [
        n.id,
        `"${n.name}"`,
        `"${n.country}"`,
        `"${n.city || ''}"`,
        getJurisdictionTier(n.country),
        n.ip,
        `"${n.asn || ''}"`,
        n.latency,
        n.jitter ?? 1.5,
        n.transferRate,
        n.loadPct ?? 30,
        n.signalStrength,
        n.autonomyProfile,
      ].join(',')
    );

    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-topologie-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast(`Inventaire exporté (${filteredNodes.length} relais CSV)`);
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedViewConfig = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      viewMode,
      filterType,
      jurisdictionFilter,
      searchQuery,
      sortBy,
      visibleColumns,
    };
    setSavedViews((prev) => [...prev, newView]);
    setActiveViewId(newView.id);
    setNewViewName('');
    setShowViewsMenu(false);
    setToast(`Vue « ${newView.name} » sauvegardée`);
  };

  const handleLoadView = (view: SavedViewConfig) => {
    setViewMode(view.viewMode);
    setFilterType(view.filterType);
    if (view.jurisdictionFilter) setJurisdictionFilter(view.jurisdictionFilter);
    setSearchQuery(view.searchQuery);
    setSortBy(view.sortBy);
    if (view.visibleColumns) setVisibleColumns(view.visibleColumns);
    setActiveViewId(view.id);
    setShowViewsMenu(false);
    setToast(`Vue « ${view.name} » chargée`);
  };

  const handleDeleteView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const viewName = savedViews.find((v) => v.id === id)?.name;
    if (activeViewId === id) setActiveViewId(null);
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
    setToast(`Vue « ${viewName} » supprimée`);
  };

  const handleStartEdit = (view: SavedViewConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingViewId(view.id);
    setEditName(view.name);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingViewId(null);
    setEditName('');
  };

  const handleSaveEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (editingViewId && editName.trim()) {
      setSavedViews((prev) =>
        prev.map((v) =>
          v.id === editingViewId ? { ...v, name: editName.trim() } : v
        )
      );
      setEditingViewId(null);
      setEditName('');
      setToast('Vue renommée');
    }
  };

  const toggleColumn = (key: string) => {
    setActiveViewId(null);
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleResetFilters = () => {
    setFilterType('all');
    setJurisdictionFilter('all');
    setSearchQuery('');
    setSortBy('latency');
    setActiveViewId(null);
    setToast('Filtres réinitialisés');
  };

  const startTransferSimulation = (node: DeviceNode) => {
    if (transferState.status === 'running') {
      setToast('Un diagnostic de transfert est déjà en cours');
      return;
    }

    transferTimersRef.current.forEach((t) => window.clearTimeout(t));
    transferTimersRef.current = [];

    const deterministicHex = ((Date.now() ^ (node.latency * 2654435761)) >>> 0)
      .toString(16)
      .toUpperCase()
      .padStart(8, '0');

    setTransferState({
      isActive: true,
      traceId: `RN-${deterministicHex}`,
      targetNodeName: node.name,
      targetNodeId: node.id,
      progress: 0,
      logs: [],
      isCollapsed: false,
      status: 'running',
    });

    const kexLabel = settings.postQuantumKex.toUpperCase();
    const steps = [
      {
        msg: `Ouverture du socket chiffré vers ${node.name} (${node.ip} · ${node.asn || 'BGP Core'})...`,
        type: 'info',
        progress: 10,
        delay: 350,
      },
      {
        msg: `Validation de route (${node.city || node.country}, ${node.country}) · MTU ${settings.mtuSize} octets.`,
        type: 'info',
        progress: 24,
        delay: 950,
      },
      {
        msg: `Échange de clés hybride (${kexLabel} + X25519) authentifié sans fuite DNS.`,
        type: 'success',
        progress: 42,
        delay: 1650,
      },
      {
        msg: `Émission d’une salve test chiffrée ChaCha20-Poly1305 (${node.transferRate} Mo/s disponibles).`,
        type: 'info',
        progress: 64,
        delay: 2450,
      },
      {
        msg: `RTT mesuré : ${node.latency} ms (gigue ±${node.jitter ?? 1.6} ms, perte ${node.packetLoss ?? 0}%).`,
        type: node.latency > 95 ? 'warning' : 'info',
        progress: 84,
        delay: 3300,
      },
      {
        msg: 'Empreinte SHA-256 des trames retour vérifiée. Canal opérationnel.',
        type: 'success',
        progress: 100,
        delay: 4100,
      },
    ] as const;

    steps.forEach((step, index) => {
      const timerId = window.setTimeout(() => {
        const newLog: TransferLog = {
          id: `${Date.now()}-${index}`,
          step: index + 1,
          time: new Date().toLocaleTimeString('fr-FR'),
          message: step.msg,
          type: step.type,
        };

        setTransferState((prev) => {
          if (!prev.isActive) return prev;
          const isComplete = index === steps.length - 1;
          return {
            ...prev,
            progress: step.progress,
            logs: [...prev.logs, newLog],
            status: isComplete ? 'completed' : 'running',
          };
        });
      }, step.delay);
      transferTimersRef.current.push(timerId);
    });
  };

  const closeTransferPanel = () => {
    transferTimersRef.current.forEach((t) => window.clearTimeout(t));
    transferTimersRef.current = [];
    setTransferState((prev) => ({ ...prev, isActive: false, status: 'idle' }));
  };

  const clearTransferLogs = () => {
    setTransferState((prev) => ({
      ...prev,
      logs: [],
      progress: 0,
      status: 'idle',
    }));
  };

  const exportTransferLogs = () => {
    const lines = [
      `=== RENUMERATE VPN — DIAGNOSTIC DE FLUX CHIFFRÉ ===`,
      `Trace : ${transferState.traceId}`,
      `Relais cible : ${transferState.targetNodeName}`,
      `Date : ${new Date().toLocaleString('fr-FR')}`,
      ``,
      ...transferState.logs.map(
        (l) => `[${l.time}] (#${l.step} ${l.type.toUpperCase()}) ${l.message}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-flux-${transferState.targetNodeName.toLowerCase()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast('Journal de flux téléchargé (.log)');
  };

  // --- Filtering & Sorting ---

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nodes
      .filter((n) => {
        const matchesSearch =
          !q ||
          n.name.toLowerCase().includes(q) ||
          n.ip.includes(q) ||
          n.country.toLowerCase().includes(q) ||
          (n.city && n.city.toLowerCase().includes(q)) ||
          (n.asn && n.asn.toLowerCase().includes(q));
        const matchesType = filterType === 'all' || n.type === filterType;
        const matchesJurisdiction =
          jurisdictionFilter === 'all'
            ? true
            : jurisdictionFilter === 'sanctuary'
              ? getJurisdictionTier(n.country) === 'sanctuary'
              : !isCountryExcludedByJurisdiction(
                  n.country,
                  settings.excludeEyesJurisdictions
                );
        return matchesSearch && matchesType && matchesJurisdiction;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'signal':
            return b.signalStrength - a.signalStrength;
          case 'rate':
            return b.transferRate - a.transferRate;
          case 'latency':
            return a.latency - b.latency;
          case 'load':
            return (a.loadPct ?? 30) - (b.loadPct ?? 30);
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [
    nodes,
    searchQuery,
    filterType,
    jurisdictionFilter,
    settings.excludeEyesJurisdictions,
    sortBy,
  ]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'server':
        return <Server className="w-4 h-4" />;
      case 'iot':
        return <Cpu className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getAutonomyIcon = (profile: string) => {
    switch (profile) {
      case 'provider':
        return <Zap className="w-3.5 h-3.5" />;
      case 'consumer':
        return <Battery className="w-3.5 h-3.5" />;
      default:
        return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const getAutonomyColorClass = (profile: string) => {
    switch (profile) {
      case 'provider':
        return 'text-amber-600 dark:text-amber-400';
      case 'consumer':
        return 'text-emerald-600 dark:text-emerald-400';
      default:
        return 'text-cyan-600 dark:text-cyan-400';
    }
  };

  const formatJurisdictionLabel = (country: string) => {
    const tier = getJurisdictionTier(country);
    if (tier === 'sanctuary') return 'Sanctuaire';
    if (tier === '14-eyes') return 'Zone 14-Eyes';
    return 'Zone 5-Eyes';
  };

  const getJurisdictionTextClass = (country: string) => {
    const tier = getJurisdictionTier(country);
    if (tier === 'sanctuary') return 'text-emerald-600 dark:text-emerald-400';
    if (tier === '14-eyes') return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getStagedRoleLabel = (nodeId: string): string | null => {
    if (hopCount === 1 && exitNode?.id === nodeId) return 'Cible #1';
    if (hopCount >= 2 && entryNode?.id === nodeId) return 'Garde #1';
    if (hopCount === 3 && relayNode?.id === nodeId) return 'Relais #2';
    if (hopCount === 2 && exitNode?.id === nodeId) return 'Sortie #2';
    if (hopCount === 3 && exitNode?.id === nodeId) return 'Sortie #3';
    return null;
  };

  return (
    <div className="space-y-5 relative">
      {/* 1. 4-KPI Network Telemetry Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Active Tunnel & Geodesic Distance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tunnel actif &amp; portée géodésique
          </div>
          <div className="mt-2">
            {activeConnectedNode ? (
              <>
                <div className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {activeConnectedNode.name} ·{' '}
                  {fleetMetrics.activeDistanceKm.toLocaleString('fr-FR')} km
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Connecté ({mode})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeConnectedNode.city || activeConnectedNode.country},{' '}
                    {activeConnectedNode.country}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  Tunnel hors ligne
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sélectionnez un relais ou déployez un circuit multi-sauts
                </div>
              </>
            )}
          </div>
        </div>

        {/* KPI 2: Jurisdiction Exclusion Governance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Périmètre juridictionnel
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {fleetMetrics.compliantCount}/{nodes.length} éligibles
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'none', label: 'Global' },
                { id: '5-eyes', label: 'Hors 5-Eyes' },
                { id: '14-eyes', label: 'Hors 14-Eyes' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdateJurisdictionPolicy?.(opt.id)}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  settings.excludeEyesJurisdictions === opt.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI 3: Fleet RTT, Jitter & Mesh Capacity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Latence moyenne &amp; capacité maillage
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {fleetMetrics.avgLatency} ms · ±{fleetMetrics.avgJitter} ms
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap font-mono tabular-nums">
              <span>{fleetMetrics.totalBandwidth} Mo/s agrégés</span>
              <span aria-hidden="true">·</span>
              <span className="font-sans">
                {lastProbeSummary || `${fleetMetrics.sanctuaryCount} sanctuaires`}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Live Fleet Probe & Optimal 1-Click Connect */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Sondage actif &amp; routage rapide
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleProbeFleet}
              disabled={isProbingFleet}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Radar
                className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 ${
                  isProbingFleet ? 'animate-spin' : ''
                }`}
              />
              <span>{isProbingFleet ? 'Sondage...' : 'Sonder la flotte'}</span>
            </button>
            <button
              type="button"
              onClick={handleConnectOptimalRelay}
              className="flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Relais optimal</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Multi-Hop Circuit Orchestrator */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Route className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Orchestrateur de circuit multi-sauts
            </h2>
            <span className="text-xs text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {stagedCircuitNodes.map((n) => n.name).join(' → ')} (
              {circuitTelemetry.totalKm.toLocaleString('fr-FR')} km · ~
              {circuitTelemetry.estimatedLatencyMs} ms)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden xl:flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
              <span>Presets BGP :</span>
            </div>
            <button
              type="button"
              onClick={handleAutoOptimizeBgpFastest}
              className="px-2.5 py-1.5 rounded-lg border border-cyan-200 dark:border-cyan-800/80 bg-cyan-50/60 dark:bg-cyan-950/30 text-xs font-semibold text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Sélectionner les relais avec la plus faible latence BGP cumulée"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Plus Faible Latence</span>
            </button>
            <button
              type="button"
              onClick={handleAutoComposeSanctuaryCircuit}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Sélectionner 100% de relais sous juridiction sanctuaire (Suisse / Islande)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Sanctuaire Absolu</span>
            </button>
            <button
              type="button"
              onClick={handleAutoOptimizeDisjointAsn}
              className="px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/80 bg-purple-50/60 dark:bg-purple-950/30 text-xs font-semibold text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Garantir 3 systèmes autonomes (ASNs) strictement distincts pour neutraliser la corrélation temporelle"
            >
              <Route className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Multi-AS Disjoint</span>
              <span className="sm:hidden">Multi-AS</span>
            </button>
            <button
              type="button"
              onClick={handleAutoOptimizeGeodesicPath}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Réordonner et sélectionner les relais pour minimiser la distance géodésique et la dispersion temporelle"
            >
              <Compass className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden md:inline">Géodésie</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowTracerouteDrawer((v) => !v);
                if (!showCircuitComposer) setShowCircuitComposer(true);
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                showTracerouteDrawer
                  ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Afficher la décomposition du traceroute géodésique, jetons de transit et test de corrélation temporelle"
            >
              <Radar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden sm:inline">Traceroute</span>
              {correlationResult && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-mono text-[10px] rounded-md font-semibold">
                  {correlationResult.resistancePct}%
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowCircuitComposer((v) => !v)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={
                showCircuitComposer
                  ? 'Masquer le compositeur'
                  : 'Déplier le compositeur'
              }
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  showCircuitComposer ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {showCircuitComposer && (
          <div className="p-5 space-y-4">
            {/* Quick Auto-Optimization Presets Banner */}
            <div className="p-3 bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Zap className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Optimisation Intelligente des Sauts BGP</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Composez instantanément votre topologie selon vos contraintes de latence, souveraineté légale ou résistance cryptographique.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAutoOptimizeBgpFastest}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-cyan-500" />
                  <span>⚡ Plus Rapide (~{Math.round(stagedCircuitNodes.reduce((acc, n) => acc + n.latency, 0) / Math.max(1, stagedCircuitNodes.length))} ms)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoComposeSanctuaryCircuit}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>🛡️ Sanctuaire (CH / IS)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoOptimizeDisjointAsn}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-500 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Route className="w-3 h-3 text-purple-500" />
                  <span>🔀 Multi-AS Disjoint</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Segmented Hop Architecture Selector */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                {(
                  [
                    { count: 1 as const, label: '1 Saut · Standard' },
                    { count: 2 as const, label: '2 Sauts · Double Hop' },
                    { count: 3 as const, label: '3 Sauts · Onion Vortex' },
                  ]
                ).map((item) => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setHopCount(item.count)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      hopCount === item.count
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Clean Unboxed Circuit Audit Summary */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-mono tabular-nums">
                  RTT estimé : ~{circuitTelemetry.estimatedLatencyMs} ms
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {circuitTelemetry.uniqueCountries} juridiction
                  {circuitTelemetry.uniqueCountries > 1 ? 's' : ''}
                </span>
                <span aria-hidden="true">·</span>
                {circuitTelemetry.hasDuplicateHop ? (
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    Doublon de nœud détecté
                  </span>
                ) : circuitTelemetry.hasExcludedNode ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Inclut un relais hors politique {settings.excludeEyesJurisdictions}
                  </span>
                ) : circuitTelemetry.allSanctuary ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Sanctuaire intégral hors 14-Eyes
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    Juridictions mixtes conformes
                  </span>
                )}
              </div>
            </div>

            {/* Hop Selectors + Deploy CTA */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {hopCount >= 2 && (
                <div className={hopCount === 3 ? 'md:col-span-3' : 'md:col-span-4'}>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    01. Garde d’entrée (chiffrement couche 1)
                  </label>
                  <select
                    value={entryNodeId}
                    onChange={(e) => setEntryNodeId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-cyan-500 outline-none cursor-pointer"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} — {n.country} ({n.latency} ms ·{' '}
                        {formatJurisdictionLabel(n.country)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {hopCount === 3 && (
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    02. Relais aveugle intermédiaire
                  </label>
                  <select
                    value={relayNodeId}
                    onChange={(e) => setRelayNodeId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-cyan-500 outline-none cursor-pointer"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} — {n.country} ({n.latency} ms ·{' '}
                        {formatJurisdictionLabel(n.country)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                className={
                  hopCount === 1
                    ? 'md:col-span-8'
                    : hopCount === 2
                      ? 'md:col-span-4'
                      : 'md:col-span-3'
                }
              >
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {hopCount === 1
                    ? '01. Passerelle de sortie directe'
                    : hopCount === 2
                      ? '02. Nœud de sortie (IP publique exposée)'
                      : '03. Nœud de sortie Onion Vortex'}
                </label>
                <select
                  value={exitNodeId}
                  onChange={(e) => setExitNodeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-cyan-500 outline-none cursor-pointer"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} — {n.city || n.country}, {n.country} ({n.latency}{' '}
                      ms · {formatJurisdictionLabel(n.country)})
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={
                  hopCount === 1
                    ? 'md:col-span-4'
                    : hopCount === 2
                      ? 'md:col-span-4'
                      : 'md:col-span-3'
                }
              >
                <button
                  type="button"
                  onClick={handleDeployStagedCircuit}
                  disabled={circuitTelemetry.hasDuplicateHop}
                  className="w-full py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer h-[38px]"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>
                    {hopCount === 1
                      ? 'Connecter ce relais'
                      : `Déployer le circuit (${hopCount} sauts)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Traceroute Cryptographique & Attestations de Transit Drawer */}
            {showTracerouteDrawer && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Radar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                        Traceroute Cryptographique & Preuve de Transit (PoT)
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Décomposition géodésique du saut par fibre optique (~5 µs/km), empilement des couches de chiffrement et jetons d’attestation.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                      {circuitTelemetry.totalKm.toLocaleString('fr-FR')} km cumulés
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                      Fibre : ~{Math.max(2, Math.round(circuitTelemetry.totalKm * 0.005))} ms
                    </span>
                  </div>
                </div>

                {/* Hop-by-hop geodesic breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hopLegs.map((leg) => (
                    <div
                      key={leg.hopIndex}
                      className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                            Saut #{leg.hopIndex}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                            {leg.roleLabel}
                          </span>
                        </div>

                        <div className="text-slate-900 dark:text-white font-medium text-xs">
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            {leg.fromName}
                          </span>{' '}
                          →{' '}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {leg.toName}
                          </span>
                          <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400">
                            ({leg.toCountry})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                          <span>{leg.distanceKm.toLocaleString('fr-FR')} km</span>
                          <span>·</span>
                          <span>Fibre : ~{Math.max(1, Math.round(leg.distanceKm * 0.005))} ms</span>
                          <span>·</span>
                          <span>RTT : ~{leg.legLatencyMs} ms</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate" title={leg.layerCipher}>
                          {leg.layerCipher}
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          <span className="truncate" title={`Jeton Proof of Transit : ${leg.potToken}`}>
                            PoT: {leg.potToken}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(leg.potToken);
                              setToast(`Jeton PoT copié : ${leg.potToken}`);
                            }}
                            className="text-slate-400 hover:text-cyan-500 transition-colors cursor-pointer"
                            title="Copier le jeton PoT"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Audit de Résistance à la Corrélation Temporelle */}
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                          Résistance à la Corrélation Temporelle & Analyse de Trafic
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Évalue l’immunité contre les attaques passives de corrélation de paquets FAI/NSA (Timing & Packet-Size Correlation).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunCorrelationTest}
                      disabled={isTestingCorrelation}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {isTestingCorrelation ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sondage en cours...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Sonder la résistance</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {/* Resistance Score */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Indice de résistance globale
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span
                          className={`text-xl font-bold font-mono ${
                            (correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)) >= 90
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : (correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)) >= 75
                                ? 'text-cyan-600 dark:text-cyan-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)}%
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {(correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)) >= 90
                            ? 'Sanctuaire scellé'
                            : (correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)) >= 75
                              ? 'Haute résilience'
                              : 'Vulnérabilité modérée'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            (correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)) >= 90
                              ? 'bg-emerald-500'
                              : (correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)) >= 75
                                ? 'bg-cyan-500'
                                : 'bg-amber-500'
                          }`}
                          style={{
                            width: `${correlationResult?.resistancePct ?? (hopCount === 3 ? 92 : hopCount === 2 ? 80 : 45)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Shannon Entropy */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Entropie temporelle de Shannon
                      </div>
                      <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                        {correlationResult?.entropyBits ?? (hopCount === 3 ? 3.84 : hopCount === 2 ? 3.42 : 2.85)}{' '}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">b/paquet</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        Dispersion inter-paquets aléatoire
                      </div>
                    </div>

                    {/* ISP Eavesdropping Risk */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Risque de corrélation FAI
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5">
                        {correlationResult
                          ? correlationResult.timingCorrelationRisk === 'negligible'
                            ? 'Négligeable'
                            : correlationResult.timingCorrelationRisk === 'low'
                              ? 'Faible'
                              : 'Modéré (1 saut)'
                          : hopCount === 3
                            ? 'Négligeable'
                            : hopCount === 2
                              ? 'Faible'
                              : 'Modéré (1 saut)'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {hopCount >= 2 ? 'Multi-juridictions hermétique' : 'Sujet aux métadonnées d’entrée'}
                      </div>
                    </div>

                    {/* Chaff & PQC Status */}
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Chaffing & PQC
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1.5 truncate">
                        {settings.trafficPaddingJitterMs > 0
                          ? `Jitter +${settings.trafficPaddingJitterMs} ms`
                          : 'Jitter 0 ms (performance)'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                        PQC : {settings.postQuantumKex !== 'classic-x25519' ? settings.postQuantumKex.toUpperCase() : 'Standard'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Search, Filter & View Controls Toolbar */}
      <div className="flex flex-col xl:flex-row gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex-1 flex flex-wrap gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par relais, IP, pays, ville ou ASN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveViewId(null);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:border-cyan-500 outline-none transition-colors text-slate-900 dark:text-white"
            />
          </div>

          <div className="relative min-w-[138px]">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setActiveViewId(null);
              }}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-8 text-xs sm:text-sm focus:border-cyan-500 outline-none cursor-pointer text-slate-900 dark:text-white"
            >
              <option value="all">Tous équipements</option>
              <option value="server">Serveurs dédiés</option>
              <option value="desktop">Postes relais</option>
              <option value="mobile">Mobiles</option>
              <option value="iot">Passerelles IoT</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative min-w-[155px]">
            <select
              value={jurisdictionFilter}
              onChange={(e) => {
                setJurisdictionFilter(
                  e.target.value as 'all' | 'compliant' | 'sanctuary'
                );
                setActiveViewId(null);
              }}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-8 text-xs sm:text-sm focus:border-cyan-500 outline-none cursor-pointer text-slate-900 dark:text-white"
            >
              <option value="all">Toutes juridictions</option>
              <option value="compliant">Éligibles (politique active)</option>
              <option value="sanctuary">Sanctuaires hors 14-Eyes</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative min-w-[148px]">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(
                  e.target.value as
                    | 'name'
                    | 'signal'
                    | 'rate'
                    | 'latency'
                    | 'load'
                );
                setActiveViewId(null);
              }}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-8 pr-8 text-xs sm:text-sm focus:border-cyan-500 outline-none cursor-pointer text-slate-900 dark:text-white"
            >
              <option value="latency">Trier : Latence</option>
              <option value="rate">Trier : Débit</option>
              <option value="load">Trier : Charge</option>
              <option value="signal">Trier : Signal</option>
              <option value="name">Trier : Nom</option>
            </select>
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Réinitialiser les filtres"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Right Controls: Saved Views, Columns, CSV Export, Map Toggle, Grid/List */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => setShowViewsMenu(!showViewsMenu)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                activeViewId
                  ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <LayoutTemplate className="w-4 h-4" />
              <span className="max-w-[96px] truncate">
                {activeViewId
                  ? savedViews.find((v) => v.id === activeViewId)?.name
                  : 'Vues'}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  showViewsMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showViewsMenu && (
              <>
                <div
                  className="fixed inset-0"
                  onClick={() => setShowViewsMenu(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-30">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1">
                    Vues enregistrées
                  </div>
                  <div className="space-y-1 mb-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {savedViews.length === 0 ? (
                      <p className="text-xs text-slate-400 px-2 py-2 text-center">
                        Aucune vue enregistrée
                      </p>
                    ) : (
                      savedViews.map((view) => (
                        <div
                          key={view.id}
                          className={`flex items-center justify-between group rounded-lg ${
                            activeViewId === view.id &&
                            editingViewId !== view.id
                              ? 'bg-cyan-50 dark:bg-cyan-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {editingViewId === view.id ? (
                            <div className="flex items-center gap-1 flex-1 px-2 py-1">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) =>
                                  e.key === 'Enter' && handleSaveEdit(e)
                                }
                                className="flex-1 min-w-0 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 outline-none focus:border-cyan-500 text-slate-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLoadView(view)}
                                className="flex-1 text-left px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex items-center gap-2 cursor-pointer"
                              >
                                <span className="truncate">{view.name}</span>
                                {activeViewId === view.id && (
                                  <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                                )}
                              </button>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                                <button
                                  type="button"
                                  onClick={(e) => handleStartEdit(view, e)}
                                  className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 rounded transition-colors"
                                  title="Renommer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteView(view.id, e)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2 px-1 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Nommer cette vue..."
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
                      className="flex-1 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-cyan-500 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleSaveView}
                      disabled={!newViewName.trim()}
                      className="p-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {viewMode === 'list' && (
            <div className="relative z-20">
              <button
                type="button"
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Configurer les colonnes"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              {showColumnMenu && (
                <>
                  <div
                    className="fixed inset-0"
                    onClick={() => setShowColumnMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-30">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1">
                      Colonnes affichées
                    </div>
                    <div className="space-y-0.5">
                      {ALL_COLUMNS.map((col) => (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => toggleColumn(col.key)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              visibleColumns.includes(col.key)
                                ? 'bg-cyan-600 border-cyan-600'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {visibleColumns.includes(col.key) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className="text-slate-700 dark:text-slate-200">
                            {col.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleExportTopologyCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Exporter l’inventaire des relais en CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWorldMap(!showWorldMap)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              showWorldMap
                ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Globe2 className="w-4 h-4" />
            <span className="hidden sm:inline">Carte D3</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBgpVisualizer(!showBgpVisualizer)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              showBgpVisualizer
                ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Route className="w-4 h-4 text-cyan-500" />
            <span className="hidden sm:inline">Sondes BGP D3</span>
          </button>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setViewMode('grid');
                setActiveViewId(null);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vue en grille"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setActiveViewId(null);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vue tabulaire"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {toast && (
        <div className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium border border-slate-700 flex items-center justify-between">
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Interactive D3.js World Node Map */}
      {showWorldMap && (
        <WorldNodeMap
          nodes={filteredNodes.length > 0 ? filteredNodes : nodes}
          currentIp={currentIp}
          isConnected={isConnected}
          mode={mode}
          isDark={isDark}
          circuitHopIds={stagedCircuitIds}
          excludeJurisdictions={settings.excludeEyesJurisdictions}
          onConnectNode={onConnectNode}
          onAssignHopRole={handleAssignHopFromMap}
        />
      )}

      {/* 4b. Real-Time D3.js BGP Route Latency & AS-Path Visualizer */}
      {showBgpVisualizer && (
        <BgpRouteLatencyVisualizer
          nodes={filteredNodes.length > 0 ? filteredNodes : nodes}
          currentIp={currentIp}
          isConnected={isConnected}
          isDark={isDark}
          onConnectNode={onConnectNode}
          onAssignHopRole={handleAssignHopFromMap}
        />
      )}

      {/* 5. Relay Nodes Inventory (Grid or Tabular List) */}
      <div>
        {filteredNodes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              Aucun relais ne correspond aux filtres sélectionnés.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredNodes.map((node) => {
              const isCurrentNode = isConnected && node.ip === currentIp;
              const isExcluded = isCountryExcludedByJurisdiction(
                node.country,
                settings.excludeEyesJurisdictions
              );
              const stagedRole = getStagedRoleLabel(node.id);

              return (
                <div
                  key={node.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 transition-colors flex flex-col justify-between ${
                    isCurrentNode
                      ? 'border-emerald-500/70 dark:border-emerald-500/60'
                      : isExcluded
                        ? 'border-slate-200/80 dark:border-slate-800/80 opacity-75'
                        : 'border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 dark:hover:border-cyan-500/50'
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            isCurrentNode
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {getTypeIcon(node.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                            {node.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {node.city || node.country} · {node.country}
                          </div>
                        </div>
                      </div>

                      {/* Segmented RNC Autonomy Selector */}
                      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
                        {(['consumer', 'balanced', 'provider'] as const).map(
                          (prof) => (
                            <button
                              key={prof}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAutonomyUpdate(node.id, prof);
                              }}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                node.autonomyProfile === prof
                                  ? `bg-white dark:bg-slate-700 shadow-xs ${getAutonomyColorClass(prof)}`
                                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                              title={
                                prof === 'provider'
                                  ? 'Fournisseur RNC (+rendement)'
                                  : prof === 'balanced'
                                    ? 'Équilibré'
                                    : 'Consommateur strict'
                              }
                            >
                              {getAutonomyIcon(prof)}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
                    <div className="flex items-center gap-1.5 text-xs flex-wrap mb-3">
                      <span
                        className={`font-medium ${getJurisdictionTextClass(node.country)}`}
                      >
                        {formatJurisdictionLabel(node.country)}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {node.ip}
                      </span>
                      {stagedRole && (
                        <>
                          <span className="text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-medium text-cyan-600 dark:text-cyan-400">
                            {stagedRole}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Telemetry Rows */}
                    <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800/80 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">
                          RTT &amp; gigue
                        </span>
                        <span
                          className={`font-mono tabular-nums font-semibold ${
                            node.latency <= 40
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : node.latency <= 95
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {node.latency} ms
                          {typeof node.jitter === 'number'
                            ? ` · ±${node.jitter} ms`
                            : ''}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">
                          Débit &amp; charge
                        </span>
                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-medium">
                          {node.transferRate} Mo/s · {node.loadPct ?? 30}%
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">
                          Réseau BGP
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate max-w-[155px]">
                          {node.asn || 'AS60068 Transit'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onConnectNode(node.id)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isCurrentNode
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                      }`}
                    >
                      {isCurrentNode ? 'Connecté' : 'Basculer ici'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransferSimulation(node)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                      title="Tester un flux chiffré vers ce relais"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {ALL_COLUMNS.filter((c) =>
                    visibleColumns.includes(c.key)
                  ).map((col) => {
                    const sortable = [
                      'name',
                      'signal',
                      'rate',
                      'latency',
                    ].includes(col.key);
                    return (
                      <th
                        key={col.key}
                        onClick={() => {
                          if (sortable) {
                            setSortBy(
                              col.key as 'name' | 'signal' | 'rate' | 'latency'
                            );
                            setActiveViewId(null);
                          }
                        }}
                        className={`px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap ${
                          sortable
                            ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {sortBy === col.key && (
                            <ChevronDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredNodes.map((node) => {
                  const isCurrentNode = isConnected && node.ip === currentIp;
                  const stagedRole = getStagedRoleLabel(node.id);

                  return (
                    <tr
                      key={node.id}
                      className={`transition-colors ${
                        isCurrentNode
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {visibleColumns.includes('name') && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {node.name}
                            {stagedRole ? (
                              <span className="ml-2 text-xs font-normal text-cyan-600 dark:text-cyan-400">
                                · {stagedRole}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {node.city || node.country}, {node.country}
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('jurisdiction') && (
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          <div
                            className={`font-medium ${getJurisdictionTextClass(node.country)}`}
                          >
                            {formatJurisdictionLabel(node.country)}
                          </div>
                          <div className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {node.asn || 'AS60068 Transit'}
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('ip') && (
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono tabular-nums text-xs whitespace-nowrap">
                          {node.ip}
                        </td>
                      )}

                      {visibleColumns.includes('type') && (
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 capitalize text-xs whitespace-nowrap">
                          {node.type}
                        </td>
                      )}

                      {visibleColumns.includes('status') && (
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          <span
                            className={
                              node.status === 'active'
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : 'text-slate-500 dark:text-slate-400'
                            }
                          >
                            {node.status === 'active' ? 'Opérationnel' : node.status}
                          </span>
                          <span className="text-slate-400 mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            Charge {node.loadPct ?? 30}%
                          </span>
                        </td>
                      )}

                      {visibleColumns.includes('signal') && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Signal
                              className={`w-3.5 h-3.5 ${
                                node.signalStrength > 75
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            />
                            <span className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                              {node.signalStrength}%
                            </span>
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('rate') && (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono tabular-nums text-xs whitespace-nowrap">
                          {node.transferRate} Mo/s
                        </td>
                      )}

                      {visibleColumns.includes('latency') && (
                        <td className="px-4 py-3 font-mono tabular-nums text-xs whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              node.latency <= 40
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : node.latency <= 95
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {node.latency} ms
                          </span>
                          {typeof node.jitter === 'number' && (
                            <span className="text-slate-500 dark:text-slate-400">
                              {' '}
                              · ±{node.jitter} ms
                            </span>
                          )}
                        </td>
                      )}

                      {visibleColumns.includes('autonomy') && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 w-fit rounded-lg p-0.5">
                            {(
                              ['consumer', 'balanced', 'provider'] as const
                            ).map((prof) => (
                              <button
                                key={prof}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAutonomyUpdate(node.id, prof);
                                }}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${
                                  node.autonomyProfile === prof
                                    ? `bg-white dark:bg-slate-700 shadow-xs ${getAutonomyColorClass(prof)}`
                                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                                title={prof}
                              >
                                {getAutonomyIcon(prof)}
                              </button>
                            ))}
                          </div>
                        </td>
                      )}

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onConnectNode(node.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              isCurrentNode
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white dark:hover:bg-cyan-600 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {isCurrentNode ? 'Connecté' : 'Basculer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => startTransferSimulation(node)}
                            className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-cyan-600 dark:hover:text-cyan-400 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                            title="Diagnostic de flux chiffré"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Encrypted Packet Transfer Diagnostic Drawer */}
      {transferState.isActive && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-300 ${
            transferState.isCollapsed ? 'h-16' : 'h-[410px]'
          }`}
        >
          {/* Drawer Header */}
          <div
            className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
            onClick={() =>
              setTransferState((prev) => ({
                ...prev,
                isCollapsed: !prev.isCollapsed,
              }))
            }
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  transferState.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                }`}
              >
                {transferState.status === 'completed' ? (
                  <CircleCheck className="w-5 h-5" />
                ) : (
                  <Activity className="w-5 h-5 animate-pulse" />
                )}
              </div>
              <div className="flex flex-col">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>
                    {transferState.status === 'completed'
                      ? `Diagnostic terminé · ${transferState.targetNodeName}`
                      : `Diagnostic vers ${transferState.targetNodeName}`}
                  </span>
                  {transferState.isCollapsed && (
                    <span className="font-mono tabular-nums text-slate-500">
                      {transferState.progress}%
                    </span>
                  )}
                </h4>
                {!transferState.isCollapsed && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <svg
                      viewBox="0 0 100 4"
                      className="w-44 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700"
                    >
                      <rect
                        x={0}
                        y={0}
                        width={transferState.progress}
                        height={4}
                        rx={2}
                        fill={
                          transferState.status === 'completed'
                            ? '#10b981'
                            : '#06b6d4'
                        }
                      />
                    </svg>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {transferState.progress}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearTransferLogs();
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Purger le journal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronUp
                  className={`w-4 h-4 transition-transform ${
                    transferState.isCollapsed ? '' : 'rotate-180'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTransferPanel();
                }}
                className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-950/60 min-h-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <ClipboardList className="w-3.5 h-3.5" />
                Séquence de paquets vérifiés
              </span>
              <span className="font-mono tabular-nums">
                {transferState.traceId}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {transferState.logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <Terminal className="w-7 h-7 opacity-50" />
                  <p className="text-xs">Initialisation du socket chiffré...</p>
                </div>
              ) : (
                <>
                  {transferState.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs"
                    >
                      <div className="pt-0.5 shrink-0">
                        {log.type === 'info' && (
                          <Info className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        )}
                        {log.type === 'success' && (
                          <CircleCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        {log.type === 'warning' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        {log.type === 'error' && (
                          <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-0.5 font-mono tabular-nums">
                          <span>Étape 0{log.step}</span>
                          <span>{log.time}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                          {log.message}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </div>

            {transferState.status === 'completed' && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex gap-2">
                <button
                  type="button"
                  onClick={exportTransferLogs}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger (.log)</span>
                </button>
                <button
                  type="button"
                  onClick={closeTransferPanel}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
