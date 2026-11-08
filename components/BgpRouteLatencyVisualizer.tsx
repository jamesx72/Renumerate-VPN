import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Zap,
  Route,
  RefreshCw,
  Server,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Power,
  Compass,
  ArrowRight,
  Maximize2,
  Minimize2,
  Radio,
  Clock,
  ShieldCheck,
  Search,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Sparkles,
  RotateCcw,
  Check,
} from 'lucide-react';
import { DeviceNode, ConnectionMode } from '../types';

export type BgpIncidentId = 'none' | 'transatlantic_cut' | 'decix_congestion' | 'pqc_sanctuary';

export interface BgpIncidentMeta {
  id: BgpIncidentId;
  label: string;
  badge: string;
  shortDesc: string;
  detail: string;
  severity: 'normal' | 'critical' | 'warning' | 'info';
  affectedNodes: string[];
  convergenceTimeMs: number;
  rerouteMechanism: string;
}

export const BGP_INCIDENTS: Record<BgpIncidentId, BgpIncidentMeta> = {
  none: {
    id: 'none',
    label: 'Routage BGP Nominal',
    badge: 'SLA 100% Nominal',
    shortDesc: 'Peering IXP et câbles sous-marins stables sans perte',
    detail: 'Topologie BGP convergée. Tous les liens directs Tier-1 et câbles sous-marins opèrent à pleine capacité nominale.',
    severity: 'normal',
    affectedNodes: [],
    convergenceTimeMs: 0,
    rerouteMechanism: 'Annonces BGP directes Tier-1 (MED standard)',
  },
  transatlantic_cut: {
    id: 'transatlantic_cut',
    label: 'Panne Câble Sous-Marin TAT-14',
    badge: 'Coupure Subsea Atlantique',
    shortDesc: 'Rupture physique TAT-14 / Dunant vers US-NYC & PA-PTY',
    detail: 'Rupture physique sous-marine à 320 km au large de la Bretagne. Retrait BGP immédiat (AS3356 Lumen). Reroutage automatique d\'urgence via le câble sous-marin Hibernia / Londres (AS174 Cogent) avec latence accrue de +58 ms.',
    severity: 'critical',
    affectedNodes: ['US-NYC-01', 'PA-PTY-01'],
    convergenceTimeMs: 840,
    rerouteMechanism: 'Failover BGP Subsea Hibernia/Londres (AS174 Cogent)',
  },
  decix_congestion: {
    id: 'decix_congestion',
    label: 'Congestion IXP DE-CIX Francfort',
    badge: 'Saturation 14 Tbit/s & DDoS',
    shortDesc: 'Saturation des tampons DE-CIX et perte de 8.2% de paquets',
    detail: 'Pic de trafic de 14.2 Tbit/s et attaque d\'amplification volumétrique ciblant le point d\'échange DE-CIX. Les annonces BGP locales sont retirées au profit d\'un contournement via France-IX Paris (AS1299 Arelion).',
    severity: 'warning',
    affectedNodes: ['DE-FRA-01', 'EE-TAL-01'],
    convergenceTimeMs: 520,
    rerouteMechanism: 'Multi-homing failover via France-IX Paris (AS1299 Arelion)',
  },
  pqc_sanctuary: {
    id: 'pqc_sanctuary',
    label: 'Sanctuarisation Post-Quantique',
    badge: 'Zero 14-Eyes & ML-KEM',
    shortDesc: 'Révocation stricte BGP de tout transit sous juridiction 14-Eyes',
    detail: 'Activation de la politique BGP NO-EXPORT (Community 65001:0) pour isoler le trafic des juridictions sous écoute massive. Basculement exclusif sur les backbones helvétique (Bahnhof) et islandais (Verne Global) protégés par ML-KEM-768.',
    severity: 'info',
    affectedNodes: ['FR-PAR-01', 'FR-LYO-02', 'DE-FRA-01', 'EE-TAL-01', 'US-NYC-01', 'PA-PTY-01', 'SG-SIN-01'],
    convergenceTimeMs: 310,
    rerouteMechanism: 'BGP Community 65001:0 (NO-EXPORT 14-Eyes) + Clé PQC',
  },
};

export interface BgpRouteData {
  nodeId: string;
  nodeName: string;
  ip: string;
  country: string;
  city: string;
  flag: string;
  asn: string;
  asPath: string[];
  peeringIxp: string;
  bgpCommunity: string;
  med: number;
  localPref: number;
  latencyHistory: number[]; // Last 20 probe points
  currentLatency: number;
  jitter: number;
  packetLoss: number;
  flapScore: number; // 0 - 100
  routeStatus: 'optimal' | 'stable' | 'congested' | 'diverted';
}

interface BgpRouteLatencyVisualizerProps {
  nodes: DeviceNode[];
  currentIp?: string;
  isConnected?: boolean;
  isDark?: boolean;
  onConnectNode?: (nodeId: string) => void;
  onAssignHopRole?: (nodeId: string, role: 'entry' | 'relay' | 'exit') => void;
}

type VisualizerMode = 'radial' | 'spectrum' | 'aspath';

const COUNTRY_FLAGS: Record<string, string> = {
  France: '🇫🇷',
  Suisse: '🇨🇭',
  Allemagne: '🇩🇪',
  Islande: '🇮🇸',
  Estonie: '🇪🇪',
  USA: '🇺🇸',
  Panama: '🇵🇦',
  Singapour: '🇸🇬',
};

// Canonical BGP AS-Path and IXP Peering specifications per regional node
const BGP_PROFILES: Record<
  string,
  {
    asPath: string[];
    peeringIxp: string;
    bgpCommunity: string;
    med: number;
    localPref: number;
  }
> = {
  'FR-PAR-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS1299 (Arelion IX)', 'AS12876 (Scaleway Core)'],
    peeringIxp: 'France-IX Paris',
    bgpCommunity: '65001:100 (Tier-1 Direct)',
    med: 10,
    localPref: 140,
  },
  'FR-LYO-02': {
    asPath: ['AS-LOCAL (eth0)', 'AS3215 (Orange Core)', 'AS12876 (Lyon-IX Peering)'],
    peeringIxp: 'Lyon-IX Interconnect',
    bgpCommunity: '65001:120 (Regional Backup)',
    med: 20,
    localPref: 120,
  },
  'CH-ZUR-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS13030 (SwissIX Core)', 'AS51395 (Bahnhof Sanctuary)'],
    peeringIxp: 'SwissIX Zürich',
    bgpCommunity: '65001:150 (Privacy Sanctuary)',
    med: 5,
    localPref: 150,
  },
  'CH-GEN-02': {
    asPath: ['AS-LOCAL (eth0)', 'AS20965 (Proton Transit)', 'AS51395 (CERN Geneva Ring)'],
    peeringIxp: 'CIXP Geneva',
    bgpCommunity: '65001:140 (Encrypted Backbone)',
    med: 15,
    localPref: 135,
  },
  'DE-FRA-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS6939 (Hurricane Electric)', 'AS24940 (Hetzner DE-CIX)'],
    peeringIxp: 'DE-CIX Frankfurt (Global IX)',
    bgpCommunity: '65001:100 (Tier-1 Ultra-Peer)',
    med: 8,
    localPref: 160,
  },
  'IS-REY-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS174 (Cogent CANTAT-3 Subsea)', 'AS48685 (Verne Global Geothermal)'],
    peeringIxp: 'RIX Reykjavik',
    bgpCommunity: '65001:180 (Subsea Cantat-3)',
    med: 25,
    localPref: 130,
  },
  'EE-TAL-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS1299 (Arelion Baltic Ring)', 'AS3249 (Telia Estonia Peering)'],
    peeringIxp: 'TLLIX Tallinn',
    bgpCommunity: '65001:110 (Nordic-Baltic Loop)',
    med: 18,
    localPref: 125,
  },
  'US-NYC-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS3356 (Lumen Transatlantic TAT-14)', 'AS20473 (NYIIX 60 Hudson)'],
    peeringIxp: 'NYIIX New York',
    bgpCommunity: '65001:220 (Transatlantic Subsea Cable)',
    med: 45,
    localPref: 110,
  },
  'PA-PTY-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS2914 (NTT America Maya-1)', 'AS52275 (Cable Onda Panama-IX)'],
    peeringIxp: 'INTERRED Panama',
    bgpCommunity: '65001:250 (LatAm Trans-isthmus)',
    med: 50,
    localPref: 105,
  },
  'SG-SIN-01': {
    asPath: ['AS-LOCAL (eth0)', 'AS6453 (Tata SEA-ME-WE 5)', 'AS135377 (Equinix SG1 Peering)'],
    peeringIxp: 'Equinix SG1 / SGIX',
    bgpCommunity: '65001:280 (APAC SEA-ME-WE-5)',
    med: 60,
    localPref: 100,
  },
};

export const BgpRouteLatencyVisualizer: React.FC<BgpRouteLatencyVisualizerProps> = ({
  nodes,
  currentIp,
  isConnected = false,
  isDark = true,
  onConnectNode,
  onAssignHopRole,
}) => {
  const [mode, setMode] = useState<VisualizerMode>('radial');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [autoProbe, setAutoProbe] = useState(true);
  const [isManualProbing, setIsManualProbing] = useState(false);
  const [probeTick, setProbeTick] = useState(0);
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<'all' | 'europe' | 'americas' | 'asia'>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeIncident, setActiveIncident] = useState<BgpIncidentId>('none');
  const [convergenceTimer, setConvergenceTimer] = useState<number>(0);
  const [isConverging, setIsConverging] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize and maintain live rolling BGP route latency history
  const [bgpRoutes, setBgpRoutes] = useState<BgpRouteData[]>(() => {
    return nodes.map((node) => {
      const baseLatency = node.latency || 25;
      const history = Array.from({ length: 20 }, (_, i) => {
        const jitter = (Math.random() - 0.5) * 2.8;
        return Math.max(4, parseFloat((baseLatency + jitter).toFixed(1)));
      });

      const profile = BGP_PROFILES[node.name] || {
        asPath: ['AS-LOCAL (eth0)', 'AS1299 (Transit Tier-1)', `${node.asn || 'AS-REMOTE'}`],
        peeringIxp: `${node.city || node.country} IXP`,
        bgpCommunity: '65001:100 (Standard Peer)',
        med: 20,
        localPref: 110,
      };

      return {
        nodeId: node.id,
        nodeName: node.name,
        ip: node.ip,
        country: node.country,
        city: node.city || node.country,
        flag: COUNTRY_FLAGS[node.country] || '🌐',
        asn: node.asn || 'AS0 BGP Backbone',
        asPath: profile.asPath,
        peeringIxp: profile.peeringIxp,
        bgpCommunity: profile.bgpCommunity,
        med: profile.med,
        localPref: profile.localPref,
        latencyHistory: history,
        currentLatency: history[history.length - 1],
        jitter: node.jitter || 1.8,
        packetLoss: node.packetLoss || 0,
        flapScore: Math.floor(94 + Math.random() * 6),
        routeStatus: baseLatency < 30 ? 'optimal' : baseLatency < 75 ? 'stable' : 'congested',
      };
    });
  });

  // Keep route data synchronized when node list changes
  useEffect(() => {
    setBgpRoutes((prev) => {
      return nodes.map((node) => {
        const existing = prev.find((p) => p.nodeId === node.id);
        if (existing) return existing;

        const baseLatency = node.latency || 25;
        const history = Array.from({ length: 20 }, () => baseLatency);
        const profile = BGP_PROFILES[node.name] || {
          asPath: ['AS-LOCAL (eth0)', 'AS1299 (Transit Tier-1)', `${node.asn || 'AS-REMOTE'}`],
          peeringIxp: `${node.city || node.country} IXP`,
          bgpCommunity: '65001:100 (Standard Peer)',
          med: 20,
          localPref: 110,
        };

        return {
          nodeId: node.id,
          nodeName: node.name,
          ip: node.ip,
          country: node.country,
          city: node.city || node.country,
          flag: COUNTRY_FLAGS[node.country] || '🌐',
          asn: node.asn || 'AS0 BGP Backbone',
          asPath: profile.asPath,
          peeringIxp: profile.peeringIxp,
          bgpCommunity: profile.bgpCommunity,
          med: profile.med,
          localPref: profile.localPref,
          latencyHistory: history,
          currentLatency: baseLatency,
          jitter: node.jitter || 1.8,
          packetLoss: node.packetLoss || 0,
          flapScore: 98,
          routeStatus: baseLatency < 30 ? 'optimal' : baseLatency < 75 ? 'stable' : 'congested',
        };
      });
    });
  }, [nodes]);

  // Real-time jitter and probing ticker
  useEffect(() => {
    if (!autoProbe && !isManualProbing) return;

    const interval = window.setInterval(() => {
      setBgpRoutes((prev) =>
        prev.map((route) => {
          // Dynamic BGP micro-jitter (-1.2ms to +1.2ms)
          const base =
            activeIncident !== 'none'
              ? route.currentLatency
              : nodes.find((n) => n.id === route.nodeId)?.latency || route.currentLatency;
          const fluctuation = (Math.random() - 0.48) * (route.jitter * 1.4);
          const nextVal = Math.max(3.8, parseFloat((base + fluctuation).toFixed(1)));
          const nextHistory = [...route.latencyHistory.slice(1), nextVal];

          return {
            ...route,
            currentLatency: nextVal,
            latencyHistory: nextHistory,
            flapScore: Math.min(100, Math.max(88, route.flapScore + (Math.random() > 0.8 ? -1 : 1))),
          };
        })
      );
      setProbeTick((t) => t + 1);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [autoProbe, isManualProbing, nodes, activeIncident]);

  // Manual Ping Sweep Handler
  const handleManualSweep = useCallback(() => {
    setIsManualProbing(true);
    setTimeout(() => {
      setBgpRoutes((prev) =>
        prev.map((r) => {
          const delta = (Math.random() - 0.5) * 1.5;
          const updated = Math.max(3.5, parseFloat((r.currentLatency + delta).toFixed(1)));
          return {
            ...r,
            currentLatency: updated,
            latencyHistory: [...r.latencyHistory.slice(1), updated],
          };
        })
      );
      setIsManualProbing(false);
      setProbeTick((t) => t + 1);
    }, 850);
  }, []);

  // Incident & Failover Simulator Handler
  const handleSelectIncident = useCallback(
    (incidentId: BgpIncidentId) => {
      setActiveIncident(incidentId);
      const incident = BGP_INCIDENTS[incidentId];

      if (incident.convergenceTimeMs > 0) {
        setIsConverging(true);
        setConvergenceTimer(incident.convergenceTimeMs);
        const startTime = Date.now();
        const duration = incident.convergenceTimeMs;
        const timer = window.setInterval(() => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, duration - elapsed);
          setConvergenceTimer(remaining);
          if (remaining <= 0) {
            window.clearInterval(timer);
            setIsConverging(false);
          }
        }, 60);
      } else {
        setIsConverging(false);
        setConvergenceTimer(0);
      }

      setBgpRoutes((prev) => {
        return prev.map((route) => {
          const originalNode = nodes.find((n) => n.id === route.nodeId);
          const nominalLatency = originalNode?.latency || 25;
          const defaultProfile = BGP_PROFILES[route.nodeName] || {
            asPath: ['AS-LOCAL (eth0)', 'AS1299 (Transit Tier-1)', route.asn],
            peeringIxp: `${route.city} IXP`,
            bgpCommunity: '65001:100 (Standard Peer)',
            med: 20,
            localPref: 110,
          };

          if (incidentId === 'none') {
            return {
              ...route,
              asPath: defaultProfile.asPath,
              peeringIxp: defaultProfile.peeringIxp,
              bgpCommunity: defaultProfile.bgpCommunity,
              med: defaultProfile.med,
              localPref: defaultProfile.localPref,
              currentLatency: nominalLatency,
              latencyHistory: Array.from({ length: 20 }, () => nominalLatency),
              jitter: originalNode?.jitter || 1.8,
              packetLoss: 0,
              flapScore: 98,
              routeStatus: nominalLatency < 30 ? 'optimal' : nominalLatency < 75 ? 'stable' : 'congested',
            };
          }

          if (incidentId === 'transatlantic_cut') {
            if (route.nodeName === 'US-NYC-01') {
              const cutLatency = 136.4;
              return {
                ...route,
                asPath: [
                  'AS-LOCAL (eth0)',
                  'AS174 (Cogent Subsea Failover Londres)',
                  'AS13030 (SwissIX Inter-IX)',
                  'AS20473 (NYIIX 60 Hudson Backup)',
                ],
                peeringIxp: 'London LINX / NYIIX Failover',
                bgpCommunity: '65001:666 (Subsea Rerouted)',
                med: 85,
                localPref: 90,
                currentLatency: cutLatency,
                latencyHistory: [...route.latencyHistory.slice(1), cutLatency],
                jitter: 4.8,
                packetLoss: 2.1,
                flapScore: 62,
                routeStatus: 'diverted',
              };
            }
            if (route.nodeName === 'PA-PTY-01') {
              const cutLatency = 154.2;
              return {
                ...route,
                asPath: [
                  'AS-LOCAL (eth0)',
                  'AS174 (Cogent Subsea Failover)',
                  'AS2914 (NTT America)',
                  'AS52275 (Cable Onda Panama-IX)',
                ],
                peeringIxp: 'London LINX / Maya-1 Subsea',
                bgpCommunity: '65001:666 (Subsea Rerouted)',
                med: 95,
                localPref: 85,
                currentLatency: cutLatency,
                latencyHistory: [...route.latencyHistory.slice(1), cutLatency],
                jitter: 5.4,
                packetLoss: 1.6,
                flapScore: 68,
                routeStatus: 'diverted',
              };
            }
          }

          if (incidentId === 'decix_congestion') {
            if (route.nodeName === 'DE-FRA-01') {
              const congLatency = 94.6;
              return {
                ...route,
                asPath: [
                  'AS-LOCAL (eth0)',
                  'AS1299 (Arelion Paris Bypass)',
                  'AS24940 (Hetzner Core Reroute)',
                ],
                peeringIxp: 'France-IX Paris (Bypass DE-CIX)',
                bgpCommunity: '65001:500 (DE-CIX Congestion Egress)',
                med: 70,
                localPref: 95,
                currentLatency: congLatency,
                latencyHistory: [...route.latencyHistory.slice(1), congLatency],
                jitter: 7.2,
                packetLoss: 8.4,
                flapScore: 54,
                routeStatus: 'congested',
              };
            }
            if (route.nodeName === 'EE-TAL-01') {
              const congLatency = 62.8;
              return {
                ...route,
                asPath: [
                  'AS-LOCAL (eth0)',
                  'AS3249 (Telia Nordic Backup)',
                  'AS1299 (Arelion Baltic Ring)',
                ],
                peeringIxp: 'Stockholm Netnod / TLLIX',
                bgpCommunity: '65001:500 (DE-CIX Ripple Bypass)',
                currentLatency: congLatency,
                latencyHistory: [...route.latencyHistory.slice(1), congLatency],
                jitter: 3.8,
                packetLoss: 1.9,
                flapScore: 74,
                routeStatus: 'diverted',
              };
            }
          }

          if (incidentId === 'pqc_sanctuary') {
            const isSanctuary = ['CH-ZUR-01', 'CH-GEN-02', 'IS-REY-01'].includes(route.nodeName);
            if (isSanctuary) {
              const sanctuaryLatency = Math.min(route.currentLatency, 24);
              return {
                ...route,
                asPath: [
                  'AS-LOCAL (eth0)',
                  'AS13030 (SwissIX PQC Quantum Ring)',
                  'AS51395 (Bahnhof Post-Quantum Vault)',
                ],
                peeringIxp: `${route.city} Sovereign IX`,
                bgpCommunity: '65001:777 (PQC ML-KEM-768 Encapsulated)',
                med: 1,
                localPref: 200,
                currentLatency: sanctuaryLatency,
                latencyHistory: [...route.latencyHistory.slice(1), sanctuaryLatency],
                packetLoss: 0,
                flapScore: 99,
                routeStatus: 'optimal',
              };
            } else {
              const divertedLatency = nominalLatency + 38;
              return {
                ...route,
                asPath: [
                  'AS-LOCAL (eth0)',
                  'AS-FILTERED (14-Eyes Revocation)',
                  'SANCTUARY-DETOUR-CH',
                ],
                peeringIxp: 'Swiss PQC Detour Proxy',
                bgpCommunity: '65001:0 (NO-EXPORT 14-Eyes Denied)',
                med: 99,
                localPref: 50,
                currentLatency: divertedLatency,
                latencyHistory: [...route.latencyHistory.slice(1), divertedLatency],
                routeStatus: 'diverted',
                flapScore: 78,
              };
            }
          }

          return route;
        });
      });
      setProbeTick((t) => t + 1);
    },
    [nodes]
  );

  // Filter routes by region
  const filteredRoutes = useMemo(() => {
    return bgpRoutes.filter((r) => {
      if (selectedRegionFilter === 'europe') {
        return ['France', 'Suisse', 'Allemagne', 'Islande', 'Estonie'].includes(r.country);
      }
      if (selectedRegionFilter === 'americas') {
        return ['USA', 'Panama'].includes(r.country);
      }
      if (selectedRegionFilter === 'asia') {
        return ['Singapour'].includes(r.country);
      }
      return true;
    });
  }, [bgpRoutes, selectedRegionFilter]);

  // Optimal / Fastest route
  const optimalRoute = useMemo(() => {
    if (filteredRoutes.length === 0) return null;
    return [...filteredRoutes].sort((a, b) => a.currentLatency - b.currentLatency)[0];
  }, [filteredRoutes]);

  // Selected route data
  const activeRoute = useMemo(() => {
    return bgpRoutes.find((r) => r.nodeId === selectedNodeId) || optimalRoute || bgpRoutes[0];
  }, [bgpRoutes, selectedNodeId, optimalRoute]);

  // ============================================================================
  // D3 RENDERING ENGINE: RADIAL LATENCY ORBIT RADAR
  // ============================================================================
  useEffect(() => {
    if (!svgRef.current || mode !== 'radial') return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 840;
    const height = 480;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = 205;

    // Defs for filters and glow
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'radarGlow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    filter.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', (d) => d);

    // Radial gradient for local core
    const coreGrad = defs.append('radialGradient').attr('id', 'coreGradient').attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
    coreGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.9);
    coreGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.1);

    const mainG = svg.append('g').attr('transform', `translate(${centerX}, ${centerY})`);

    // Concentric Latency Orbit Rings (15ms, 30ms, 60ms, 120ms, 160ms)
    const orbitThresholds = [
      { ms: 20, label: '20 ms · Peering Local Direct', color: '#10b981' },
      { ms: 40, label: '40 ms · Métro & Régional', color: '#06b6d4' },
      { ms: 80, label: '80 ms · Transcontinental', color: '#3b82f6' },
      { ms: 130, label: '130 ms · Subsea Cables Inter-IX', color: '#f59e0b' },
      { ms: 170, label: '170+ ms · Transpacifique', color: '#f43f5e' },
    ];

    // Radial scale: maps latency (0 to 180ms) to radius in pixels (30 to maxRadius)
    const radiusScale = d3.scaleSqrt().domain([0, 180]).range([38, maxRadius]);

    // Draw Orbit Circles
    orbitThresholds.forEach((thresh) => {
      const r = radiusScale(thresh.ms);
      mainG
        .append('circle')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', isDark ? '#334155' : '#cbd5e1')
        .attr('stroke-width', 0.8)
        .attr('stroke-dasharray', '3,4')
        .attr('opacity', 0.6);

      // Latency ring label
      mainG
        .append('text')
        .attr('x', 6)
        .attr('y', -r + 11)
        .attr('fill', thresh.color)
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', '600')
        .attr('opacity', 0.8)
        .text(`${thresh.ms}ms · ${thresh.label}`);
    });

    // Radial Azimuth Axes (Crosshair guides)
    [0, 45, 90, 135, 180, 225, 270, 315].forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      mainG
        .append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', Math.cos(rad) * (maxRadius + 15))
        .attr('y2', Math.sin(rad) * (maxRadius + 15))
        .attr('stroke', isDark ? '#1e293b' : '#e2e8f0')
        .attr('stroke-width', 0.6)
        .attr('stroke-dasharray', '2,4');
    });

    // Angle distribution for nodes
    const routeAngleStep = (2 * Math.PI) / Math.max(1, filteredRoutes.length);

    // Compute node coordinates on radial chart
    const nodeCoords = filteredRoutes.map((route, i) => {
      const angle = i * routeAngleStep - Math.PI / 2;
      const dist = radiusScale(Math.min(175, route.currentLatency));
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      return { route, x, y, angle, dist };
    });

    // Draw animated BGP link paths from Gateway to Relays
    nodeCoords.forEach((item) => {
      const isSelected = selectedNodeId === item.route.nodeId;
      const isHovered = hoveredNodeId === item.route.nodeId;
      const isFastest = optimalRoute?.nodeId === item.route.nodeId;
      const strokeColor =
        item.route.routeStatus === 'congested'
          ? '#f43f5e'
          : item.route.routeStatus === 'diverted'
          ? '#f59e0b'
          : item.route.currentLatency < 25
          ? '#10b981'
          : item.route.currentLatency < 60
          ? '#06b6d4'
          : item.route.currentLatency < 100
          ? '#3b82f6'
          : '#f43f5e';

      // Spline curve via intermediate control point (simulates IXP peering hop)
      const midDist = item.dist * 0.55;
      const midAngle = item.angle + 0.18;
      const midX = Math.cos(midAngle) * midDist;
      const midY = Math.sin(midAngle) * midDist;

      const pathData = `M 0,0 Q ${midX},${midY} ${item.x},${item.y}`;

      // Base route path
      mainG
        .append('path')
        .attr('d', pathData)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', isSelected || isHovered ? 2.5 : isFastest ? 1.8 : 1)
        .attr('stroke-opacity', isSelected || isHovered ? 0.95 : isFastest ? 0.75 : 0.4)
        .attr('stroke-linecap', 'round');

      // Animated particle dash overlay
      mainG
        .append('path')
        .attr('d', pathData)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', isSelected ? 3 : 1.6)
        .attr('stroke-dasharray', '4,10')
        .attr('stroke-opacity', 0.9)
        .attr('class', 'bgp-particle-stream');
    });

    // Draw Central Gateway Node (AS-LOCAL / Brussels IX)
    const centralGroup = mainG.append('g').attr('class', 'gateway-center cursor-pointer');

    centralGroup.append('circle').attr('r', 28).attr('fill', 'url(#coreGradient)');
    centralGroup
      .append('circle')
      .attr('r', 16)
      .attr('fill', '#090d16')
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 2);
    centralGroup.append('circle').attr('r', 6).attr('fill', '#06b6d4');

    centralGroup
      .append('text')
      .attr('y', 36)
      .attr('text-anchor', 'middle')
      .attr('fill', isDark ? '#e2e8f0' : '#1e293b')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text('PASSERELLE (eth0)');

    centralGroup
      .append('text')
      .attr('y', 48)
      .attr('text-anchor', 'middle')
      .attr('fill', '#06b6d4')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .text('BGP LOCAL IX');

    // Draw Destination Relay Nodes
    nodeCoords.forEach((item) => {
      const isSelected = selectedNodeId === item.route.nodeId;
      const isHovered = hoveredNodeId === item.route.nodeId;
      const isCurrent = isConnected && item.route.ip === currentIp;
      const strokeColor =
        item.route.routeStatus === 'congested'
          ? '#f43f5e'
          : item.route.routeStatus === 'diverted'
          ? '#f59e0b'
          : item.route.currentLatency < 25
          ? '#10b981'
          : item.route.currentLatency < 60
          ? '#06b6d4'
          : item.route.currentLatency < 100
          ? '#3b82f6'
          : '#f43f5e';

      const nodeG = mainG
        .append('g')
        .attr('transform', `translate(${item.x}, ${item.y})`)
        .attr('class', 'relay-node cursor-pointer group')
        .on('click', () => {
          setSelectedNodeId(item.route.nodeId);
        })
        .on('mouseenter', () => {
          setHoveredNodeId(item.route.nodeId);
        })
        .on('mouseleave', () => {
          setHoveredNodeId(null);
        });

      // Halo on active or selected
      if (isSelected || isCurrent) {
        nodeG
          .append('circle')
          .attr('r', 22)
          .attr('fill', strokeColor)
          .attr('opacity', 0.25)
          .attr('filter', 'url(#radarGlow)');
      }

      // Outer circle
      nodeG
        .append('circle')
        .attr('r', 12)
        .attr('fill', isDark ? '#0f172a' : '#ffffff')
        .attr('stroke', isCurrent ? '#10b981' : strokeColor)
        .attr('stroke-width', isSelected ? 2.5 : 1.8);

      // Core point
      nodeG
        .append('circle')
        .attr('r', 5)
        .attr('fill', strokeColor);

      // Node Name Label
      nodeG
        .append('text')
        .attr('y', -16)
        .attr('text-anchor', 'middle')
        .attr('fill', isDark ? '#f8fafc' : '#0f172a')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(`${item.route.flag} ${item.route.nodeName}`);

      // Latency Bubble Badge below node
      const isSpecialStatus = item.route.routeStatus === 'diverted' || item.route.routeStatus === 'congested';
      const badgeWidth = isSpecialStatus ? 68 : 48;
      nodeG
        .append('rect')
        .attr('x', -badgeWidth / 2)
        .attr('y', 14)
        .attr('width', badgeWidth)
        .attr('height', 15)
        .attr('rx', 4)
        .attr('fill', isDark ? '#090d16' : '#f1f5f9')
        .attr('stroke', strokeColor)
        .attr('stroke-width', 0.8)
        .attr('opacity', 0.95);

      nodeG
        .append('text')
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('fill', strokeColor)
        .attr('font-size', '8.5px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(
          item.route.routeStatus === 'diverted'
            ? `${item.route.currentLatency}m 🔀`
            : item.route.routeStatus === 'congested'
            ? `${item.route.currentLatency}m ⚠️`
            : `${item.route.currentLatency}ms`
        );
    });
  }, [mode, filteredRoutes, selectedNodeId, hoveredNodeId, isDark, isConnected, currentIp, optimalRoute, probeTick, activeIncident]);

  // ============================================================================
  // D3 RENDERING ENGINE: TEMPORAL JITTER & LATENCY SPECTRUM (STREAM)
  // ============================================================================
  useEffect(() => {
    if (!svgRef.current || mode !== 'spectrum') return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 840;
    const height = 440;
    const margin = { top: 35, right: 120, bottom: 45, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Top 4 routes to compare on spectrum
    const routesToDisplay = [
      activeRoute,
      ...filteredRoutes.filter((r) => r.nodeId !== activeRoute.nodeId).slice(0, 3),
    ].filter(Boolean);

    // X scale: probe tick indices (0 to 19)
    const xScale = d3.scaleLinear().domain([0, 19]).range([0, innerWidth]);

    // Y scale: latency range in ms
    const maxLatency = Math.max(120, d3.max(routesToDisplay.flatMap((r) => r.latencyHistory)) || 100);
    const yScale = d3.scaleLinear().domain([0, maxLatency * 1.15]).range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yScale.ticks(6))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', isDark ? '#1e293b' : '#e2e8f0')
      .attr('stroke-dasharray', '2,4');

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat((d) => `-${(20 - Number(d)) * 2.4}s`);
    const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d} ms`);

    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .attr('color', isDark ? '#64748b' : '#94a3b8')
      .selectAll('text')
      .attr('font-family', 'monospace')
      .attr('font-size', '9px');

    g.append('g')
      .call(yAxis)
      .attr('color', isDark ? '#64748b' : '#94a3b8')
      .selectAll('text')
      .attr('font-family', 'monospace')
      .attr('font-size', '9px');

    // Color palette for curves
    const colorMap: Record<number, string> = {
      0: '#06b6d4', // Primary selected
      1: '#10b981', // Peer 2
      2: '#f59e0b', // Peer 3
      3: '#ec4899', // Peer 4
    };

    // Draw curves and shaded jitter areas for each route
    routesToDisplay.forEach((route, idx) => {
      const color = colorMap[idx] || '#3b82f6';
      const isPrimary = idx === 0;

      // Area generator (Jitter envelope band)
      const areaGen = d3
        .area<number>()
        .x((_, i) => xScale(i))
        .y0((d) => yScale(Math.max(0, d - route.jitter)))
        .y1((d) => yScale(d + route.jitter))
        .curve(d3.curveMonotoneX);

      // Line generator
      const lineGen = d3
        .line<number>()
        .x((_, i) => xScale(i))
        .y((d) => yScale(d))
        .curve(d3.curveMonotoneX);

      // Shaded jitter envelope
      g.append('path')
        .datum(route.latencyHistory)
        .attr('fill', color)
        .attr('fill-opacity', isPrimary ? 0.16 : 0.08)
        .attr('d', areaGen);

      // Real-time latency line
      g.append('path')
        .datum(route.latencyHistory)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', isPrimary ? 2.8 : 1.6)
        .attr('stroke-linecap', 'round')
        .attr('d', lineGen);

      // Current probe point at end
      const lastVal = route.latencyHistory[route.latencyHistory.length - 1];
      g.append('circle')
        .attr('cx', xScale(19))
        .attr('cy', yScale(lastVal))
        .attr('r', isPrimary ? 5 : 3.5)
        .attr('fill', color)
        .attr('stroke', isDark ? '#090d16' : '#ffffff')
        .attr('stroke-width', 1.5);

      // Right-side legend label
      g.append('text')
        .attr('x', innerWidth + 12)
        .attr('y', yScale(lastVal) + 4)
        .attr('fill', color)
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('font-weight', isPrimary ? 'bold' : 'normal')
        .text(`${route.flag} ${route.nodeName} (${lastVal}ms)`);
    });
  }, [mode, activeRoute, filteredRoutes, isDark, probeTick]);

  return (
    <div
      ref={containerRef}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl transition-all overflow-hidden ${
        isExpanded ? 'fixed inset-4 z-50 overflow-y-auto' : 'relative'
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-850/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
            <Route className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Télémétrie BGP en Temps Réel · Latence des Routes &amp; Chemins AS
              </h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>SONDE ACTIVE</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visualisation vectorielle D3 des sauts BGP, dispersion de gigue ICMP et arbitrage automatique du chemin optimal.
            </p>
          </div>
        </div>

        {/* View Mode Controls & Probing Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('radial')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                mode === 'radial'
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Orbite Radiale</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('spectrum')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                mode === 'spectrum'
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Spectre Temporel</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('aspath')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                mode === 'aspath'
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Chemins AS-Path</span>
            </button>
          </div>

          {/* Region Filter */}
          <select
            value={selectedRegionFilter}
            onChange={(e) => setSelectedRegionFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Toutes régions ({bgpRoutes.length})</option>
            <option value="europe">Europe (Tier-1 IXP)</option>
            <option value="americas">Amériques (Subsea)</option>
            <option value="asia">Asie-Pacifique (SG1)</option>
          </select>

          {/* Manual Sweep Ping */}
          <button
            type="button"
            onClick={handleManualSweep}
            disabled={isManualProbing}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Envoyer une salve de requêtes BGP ping pour calibrer les latences"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualProbing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sonder</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
            title={isExpanded ? 'Réduire' : 'Plein écran'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. BGP Incident & Failover Simulator Toolbar */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Simulateur d'Incidents BGP &amp; Reroutage Failover :
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(
            [
              { id: 'none' as const, label: 'Nominal (Standard)', icon: Check, color: 'text-emerald-500' },
              { id: 'transatlantic_cut' as const, label: 'Panne Câble TAT-14', icon: AlertOctagon, color: 'text-rose-500' },
              { id: 'decix_congestion' as const, label: 'Congestion DE-CIX', icon: AlertTriangle, color: 'text-amber-500' },
              { id: 'pqc_sanctuary' as const, label: 'Sanctuarisation PQC', icon: ShieldAlert, color: 'text-purple-500' },
            ]
          ).map((item) => {
            const isActive = activeIncident === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectIncident(item.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-xs border border-slate-700'
                    : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2b. Active Incident Live Banner */}
      {activeIncident !== 'none' && (
        <div
          className={`px-5 py-3 border-b text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
            activeIncident === 'transatlantic_cut'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200'
              : activeIncident === 'decix_congestion'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
              : 'bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5">
              {activeIncident === 'transatlantic_cut' ? (
                <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 animate-pulse" />
              ) : activeIncident === 'decix_congestion' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <span>{BGP_INCIDENTS[activeIncident].label}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-900/10 dark:bg-slate-800/80">
                  {BGP_INCIDENTS[activeIncident].badge}
                </span>
                {isConverging ? (
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono animate-pulse">
                    ⏳ Convergence BGP en cours ({convergenceTimer} ms)...
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Failover convergé en {BGP_INCIDENTS[activeIncident].convergenceTimeMs} ms
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 font-normal">
                {BGP_INCIDENTS[activeIncident].detail}
              </p>
              <div className="text-[10px] font-mono mt-1 opacity-80">
                Mécanisme de basculement : <strong>{BGP_INCIDENTS[activeIncident].rerouteMechanism}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSelectIncident('none')}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Rétablir Nominal</span>
          </button>
        </div>
      )}

      {/* 2c. Top Optimal Route Telemetry Banner */}
      {optimalRoute && (
        <div className="px-5 py-2.5 bg-cyan-500/5 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <span className="text-cyan-500 font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Chemin BGP Optimal Actuel :</span>
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {optimalRoute.flag} {optimalRoute.nodeName} ({optimalRoute.city})
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {optimalRoute.currentLatency} ms
            </span>
            <span className="text-slate-400 text-[10px]">
              (Gigue: ±{optimalRoute.jitter}ms · Peering: {optimalRoute.peeringIxp})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              Convergence BGP : <strong className="text-emerald-500">{optimalRoute.flapScore}%</strong>
            </span>
            {onConnectNode && (
              <button
                type="button"
                onClick={() => onConnectNode(optimalRoute.nodeId)}
                className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Connecter via ce chemin
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Main Visualization Deck (D3 Canvas + Telemetry Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left: D3 SVG Canvas (8 cols on lg) */}
        <div className="lg:col-span-8 p-4 relative bg-slate-950 flex flex-col justify-center items-center min-h-[460px] overflow-hidden select-none">
          <style>{`
            @keyframes bgpParticleFlow {
              from { stroke-dashoffset: 28; }
              to { stroke-dashoffset: 0; }
            }
            .bgp-particle-stream {
              animation: bgpParticleFlow 1.6s linear infinite;
            }
          `}</style>

          {mode === 'aspath' ? (
            /* AS-PATH Tree / Hierarchical Sankey-Like Link Diagram */
            <div className="w-full h-full p-4 space-y-3 overflow-y-auto max-h-[460px]">
              <div className="text-xs font-mono text-slate-400 mb-2">
                Topologie des Sauts Autonomes BGP (AS-Hop Paths de la Passerelle vers les Relais) :
              </div>
              <div className="space-y-2.5">
                {filteredRoutes.map((r) => {
                  const isSelected = selectedNodeId === r.nodeId;
                  return (
                    <div
                      key={r.nodeId}
                      onClick={() => setSelectedNodeId(r.nodeId)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span>{r.flag}</span>
                          <span>{r.nodeName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({r.city})</span>
                          {r.routeStatus === 'diverted' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                              FAILOVER BGP
                            </span>
                          )}
                          {r.routeStatus === 'congested' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                              CONGESTION
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              r.routeStatus === 'diverted'
                                ? 'text-amber-400'
                                : r.routeStatus === 'congested'
                                ? 'text-rose-400'
                                : 'text-cyan-400'
                            }`}
                          >
                            {r.currentLatency} ms
                          </span>
                          <span className="text-[10px] text-slate-500">MED: {r.med}</span>
                        </div>
                      </div>

                      {/* Path Hops */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        {r.asPath.map((hop, hIdx) => (
                          <React.Fragment key={hIdx}>
                            <span
                              className={`px-2 py-0.5 rounded-md border ${
                                hIdx === 0
                                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                                  : hIdx === r.asPath.length - 1
                                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold'
                                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              }`}
                            >
                              {hop}
                            </span>
                            {hIdx < r.asPath.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-slate-600" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* D3 Radial Radar or Temporal Spectrum SVG */
            <svg
              ref={svgRef}
              viewBox={mode === 'radial' ? '0 0 840 480' : '0 0 840 440'}
              className="w-full h-auto max-h-[460px]"
              preserveAspectRatio="xMidYMid meet"
            />
          )}

          {/* Quick Indicator Overlay (Bottom Left) */}
          <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono">
            <span className="px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300 backdrop-blur-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>D3 RADAR BGP · {filteredRoutes.length} NOEUDS</span>
            </span>
          </div>
        </div>

        {/* Right: Selected Node BGP Telemetry Drawer (4 cols on lg) */}
        <div className="lg:col-span-4 p-5 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeRoute.flag}</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeRoute.nodeName}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400">
                    {activeRoute.city}, {activeRoute.country}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-bold">
                {activeRoute.currentLatency} ms
              </span>
            </div>

            {/* BGP Route Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Gigue BGP (Jitter)</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                  ±{activeRoute.jitter} ms
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Perte de Paquets</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {activeRoute.packetLoss}%
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Local-Preference</div>
                <div className="font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                  {activeRoute.localPref}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">MED (Metric)</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeRoute.med}
                </div>
              </div>
            </div>

            {/* BGP Peering Exchange and Community */}
            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">Point d'Échange Internet (IXP) :</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {activeRoute.peeringIxp}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">BGP Community Tag :</div>
                <div className="font-semibold text-cyan-600 dark:text-cyan-400 text-[11px] truncate">
                  {activeRoute.bgpCommunity}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">Système Autonome Destination (ASN) :</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {activeRoute.asn}
                </div>
              </div>
            </div>

            {/* AS-Path sequence */}
            <div className="space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-400">Séquence du Chemin AS-Path :</span>
              <div className="p-2.5 rounded-xl bg-slate-950 text-slate-300 text-[11px] space-y-1">
                {activeRoute.asPath.map((step, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-1.5 truncate">
                    <span className="text-cyan-400 font-bold">#{sIdx + 1}</span>
                    <span className="truncate">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {onConnectNode && (
              <button
                type="button"
                onClick={() => onConnectNode(activeRoute.nodeId)}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Routage Immédiat vers {activeRoute.nodeName}</span>
              </button>
            )}

            {onAssignHopRole && (
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onAssignHopRole(activeRoute.nodeId, 'entry')}
                  className="py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Entrée (Hop 1)
                </button>
                <button
                  type="button"
                  onClick={() => onAssignHopRole(activeRoute.nodeId, 'relay')}
                  className="py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Relais (Hop 2)
                </button>
                <button
                  type="button"
                  onClick={() => onAssignHopRole(activeRoute.nodeId, 'exit')}
                  className="py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Sortie (Hop 3)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
