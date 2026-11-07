import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  geoNaturalEarth1,
  geoPath,
  geoGraticule10,
  geoInterpolate,
  zoom,
  zoomIdentity,
  select,
} from 'd3';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import {
  Globe2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Zap,
  Crosshair,
  Filter,
  Eye,
  SlidersVertical,
  Layers,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  Play,
  X,
  Compass,
  Terminal,
  ExternalLink,
  Flame,
} from 'lucide-react';
import {
  IntrusionAttempt,
  IntrusionSeverity,
  IntrusionVector,
  IdsFilterRule,
} from '../types';
import {
  CYBER_THREAT_REGION_PROFILES,
  resolveThreatGeoposition,
  ThreatRegionProfile,
} from '../constants';

interface IdsThreatMapProps {
  attempts: IntrusionAttempt[];
  onInspectAttempt: (attempt: IntrusionAttempt) => void;
  onAddRuleFromCountry?: (country: string, ipRange?: string) => void;
  onSimulateVector?: (vector: IntrusionVector) => void;
  targetCoords?: [number, number]; // Default [2.3522, 48.8566] (Paris / Local Core)
  targetLabel?: string;
}

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 480;
const DEFAULT_GATEWAY_COORDS: [number, number] = [2.3522, 48.8566]; // Paris Gateway

interface AggregatedRegionThreat {
  country: string;
  iso: string;
  flag: string;
  city: string;
  coords: [number, number];
  region: string;
  asn: string;
  riskIndex: number;
  attemptsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  dominantVector: IntrusionVector;
  latestAttempt: IntrusionAttempt;
  percentage: number;
}

export const IdsThreatMap: React.FC<IdsThreatMapProps> = ({
  attempts,
  onInspectAttempt,
  onAddRuleFromCountry,
  onSimulateVector,
  targetCoords = DEFAULT_GATEWAY_COORDS,
  targetLabel = 'Passerelle Renumerate (eth0/wg0)',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);

  const [transformStr, setTransformStr] = useState('translate(0,0) scale(1)');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredThreat, setHoveredThreat] = useState<AggregatedRegionThreat | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Filters & Toggles
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterVector, setFilterVector] = useState<string>('all');
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [showPulses, setShowPulses] = useState(true);
  const [showGraticule, setShowGraticule] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState<
    'density' | 'persistence' | 'concentrated'
  >('density');
  const [showHeatmapContours, setShowHeatmapContours] = useState(true);

  // D3 Map Projections
  const projection = useMemo(() => {
    return geoNaturalEarth1()
      .scale(155)
      .translate([VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2]);
  }, []);

  const pathGenerator = useMemo(() => {
    return geoPath().projection(projection);
  }, [projection]);

  // World topojson land features
  const countriesGeoData = useMemo(() => {
    try {
      const atlas = worldAtlas as unknown as {
        objects: { countries: Parameters<typeof feature>[1] };
      };
      return feature(
        worldAtlas as unknown as Parameters<typeof feature>[0],
        atlas.objects.countries
      );
    } catch {
      return null;
    }
  }, []);

  const graticuleLines = useMemo(() => {
    return geoGraticule10();
  }, []);

  // Filtered attempts based on user controls
  const filteredAttempts = useMemo(() => {
    return attempts.filter((att) => {
      if (filterSeverity !== 'all' && att.severity !== filterSeverity) return false;
      if (filterVector !== 'all' && att.vector !== filterVector) return false;
      return true;
    });
  }, [attempts, filterSeverity, filterVector]);

  // Aggregate threats by country / region
  const aggregatedRegions = useMemo<AggregatedRegionThreat[]>(() => {
    const totalCount = filteredAttempts.length || 1;
    const regionMap: Record<string, {
      attempts: IntrusionAttempt[];
      profile: ThreatRegionProfile;
    }> = {};

    filteredAttempts.forEach((att) => {
      const country = att.sourceCountry || 'Russie';
      const profile = resolveThreatGeoposition(country, att.sourceIp);

      if (!regionMap[profile.country]) {
        regionMap[profile.country] = {
          attempts: [],
          profile,
        };
      }
      regionMap[profile.country].attempts.push(att);
    });

    return Object.values(regionMap)
      .map(({ attempts: attList, profile }) => {
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        const vectorCounts: Record<string, number> = {};

        attList.forEach((a) => {
          if (a.severity === 'critical') criticalCount++;
          else if (a.severity === 'high') highCount++;
          else if (a.severity === 'medium') mediumCount++;
          else lowCount++;

          vectorCounts[a.vector] = (vectorCounts[a.vector] || 0) + 1;
        });

        // Determine dominant attack vector
        let topVector: IntrusionVector = 'port_scan';
        let topCount = 0;
        Object.entries(vectorCounts).forEach(([v, c]) => {
          if (c > topCount) {
            topCount = c;
            topVector = v as IntrusionVector;
          }
        });

        return {
          country: profile.country,
          iso: profile.iso,
          flag: profile.flag,
          city: profile.city,
          coords: profile.coords,
          region: profile.region,
          asn: profile.defaultAsn,
          riskIndex: profile.riskIndex,
          attemptsCount: attList.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          dominantVector: topVector,
          latestAttempt: attList[0],
          percentage: Math.round((attList.length / totalCount) * 100),
        };
      })
      .sort((a, b) => b.attemptsCount - a.attemptsCount);
  }, [filteredAttempts]);

  // Target Gateway Projected Coordinates
  const targetProjected = useMemo(() => {
    return projection(targetCoords) || [VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2];
  }, [projection, targetCoords]);

  // Trajectory Arcs from each aggressive region to target gateway
  const attackTrajectories = useMemo(() => {
    if (!showTrajectories) return [];

    return aggregatedRegions
      .map((region) => {
        const fromCoords = region.coords;
        const toCoords = targetCoords;
        const startPt = projection(fromCoords);
        const endPt = projection(toCoords);

        if (!startPt || !endPt) return null;

        // Generate interpolated points along the geodesic great circle
        const interpolator = geoInterpolate(fromCoords, toCoords);
        const steps = 30;
        const points: [number, number][] = [];
        for (let i = 0; i <= steps; i++) {
          const pt = interpolator(i / steps);
          const projPt = projection(pt);
          if (projPt) points.push(projPt);
        }

        if (points.length < 2) return null;

        const pathStr = points.reduce((acc, [x, y], idx) => {
          return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
        }, '');

        const isCritical = region.criticalCount > 0;
        const strokeColor = isCritical
          ? '#f43f5e' // Crimson rose
          : region.highCount > 0
          ? '#f59e0b' // Amber
          : '#06b6d4'; // Cyan

        return {
          country: region.country,
          pathStr,
          strokeColor,
          isCritical,
          attemptsCount: region.attemptsCount,
        };
      })
      .filter(Boolean) as Array<{
        country: string;
        pathStr: string;
        strokeColor: string;
        isCritical: boolean;
        attemptsCount: number;
      }>;
  }, [aggregatedRegions, projection, targetCoords, showTrajectories]);

  interface HeatmapClusterPoint {
    id: string;
    country: string;
    coords: [number, number];
    projected: [number, number];
    densityScore: number;
    radius: number;
    intensityColor: string;
    weight: number;
    attemptsCount: number;
    persistenceLevel: 'ultra' | 'high' | 'moderate' | 'low';
  }

  // Geographic Heatmap Density Layer Points Calculation
  const heatmapPoints = useMemo<HeatmapClusterPoint[]>(() => {
    if (!showHeatmap || aggregatedRegions.length === 0) return [];

    const weightedItems = aggregatedRegions.map((region) => {
      let weight = region.attemptsCount;
      if (heatmapMode === 'persistence') {
        weight =
          region.criticalCount * 4 +
          region.highCount * 2.5 +
          region.attemptsCount;
      } else if (heatmapMode === 'concentrated') {
        weight = region.attemptsCount * 1.5 + region.criticalCount * 2;
      } else {
        weight =
          region.attemptsCount * 2 +
          region.criticalCount * 3 +
          region.highCount * 1.5;
      }
      return { region, weight };
    });

    const maxWeight = Math.max(1, ...weightedItems.map((w) => w.weight));

    return weightedItems
      .map(({ region, weight }) => {
        const pt = projection(region.coords);
        if (!pt) return null;

        const densityScore = Math.min(
          100,
          Math.round((weight / maxWeight) * 100)
        );

        let baseRadius = 40 + (densityScore / 100) * 58;
        if (heatmapMode === 'concentrated') {
          baseRadius = 28 + (densityScore / 100) * 36;
        }

        let persistenceLevel: 'ultra' | 'high' | 'moderate' | 'low' = 'low';
        let intensityColor = '#06b6d4';

        if (densityScore >= 75 || region.criticalCount >= 2) {
          persistenceLevel = 'ultra';
          intensityColor = '#f43f5e';
        } else if (densityScore >= 45 || region.criticalCount >= 1) {
          persistenceLevel = 'high';
          intensityColor = '#f59e0b';
        } else if (densityScore >= 20) {
          persistenceLevel = 'moderate';
          intensityColor = '#38bdf8';
        }

        return {
          id: region.country,
          country: region.country,
          coords: region.coords,
          projected: pt,
          densityScore,
          radius: baseRadius,
          intensityColor,
          weight,
          attemptsCount: region.attemptsCount,
          persistenceLevel,
        };
      })
      .filter(Boolean) as HeatmapClusterPoint[];
  }, [showHeatmap, aggregatedRegions, projection, heatmapMode]);

  // D3 Zoom configuration
  useEffect(() => {
    if (!svgRef.current) return;
    const svgSelection = select(svgRef.current);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .translateExtent([
        [-100, -100],
        [VIEWBOX_WIDTH + 100, VIEWBOX_HEIGHT + 100],
      ])
      .on('zoom', (event) => {
        setTransformStr(event.transform.toString());
      });

    svgSelection.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svgSelection.on('.zoom', null);
    };
  }, []);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.35);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.74);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.transform, zoomIdentity);
    setSelectedCountry(null);
  };

  const handleFocusCountry = (region: AggregatedRegionThreat) => {
    setSelectedCountry(region.country);
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const pt = projection(region.coords);
    if (!pt) return;
    const scale = 2.4;
    const x = VIEWBOX_WIDTH / 2 - pt[0] * scale;
    const y = VIEWBOX_HEIGHT / 2 - pt[1] * scale;
    select(svgRef.current)
      .transition()
      .duration(450)
      .call(zoomBehaviorRef.current.transform, zoomIdentity.translate(x, y).scale(scale));
  };

  const handleSimulateRandomHotspot = () => {
    if (!onSimulateVector) return;
    const vectors: IntrusionVector[] = [
      'port_scan',
      'arp_poisoning',
      'webrtc_leak',
      'replay_attack',
      'brute_force',
      'dns_hijack',
    ];
    const rand = vectors[Math.floor(Math.random() * vectors.length)];
    onSimulateVector(rand);
  };

  const selectedRegionData = useMemo(() => {
    if (!selectedCountry) return null;
    return aggregatedRegions.find((r) => r.country === selectedCountry) || null;
  }, [selectedCountry, aggregatedRegions]);

  return (
    <div className="space-y-4">
      {/* Top Threat Deck Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shrink-0">
              <Globe2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Cartographie Mondiale des Intrusions &amp; Vecteurs Hostiles
                </h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-md font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                  Live Geolocation Radar
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Visualisation spatiale en temps réel des sondes et attaques bloquées par Renumerate VPN.
                Identifiez les foyers d'agression géographiques, les blocs d'adresses ASN hostiles et neutralisez les plages régionales suspectes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSimulateVector && (
              <button
                type="button"
                onClick={handleSimulateRandomHotspot}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simuler Attaque Géographique</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Regional KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/70">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Régions Hostiles Actives</div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {aggregatedRegions.length}{' '}
              <span className="text-xs font-normal text-slate-400">pays cartographiés</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Foyer d'Attaque #1</div>
            <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5 truncate">
              <span>{aggregatedRegions[0]?.flag || '🌍'}</span>
              <span className="truncate">{aggregatedRegions[0]?.country || 'Aucun'}</span>
              <span className="text-xs font-normal text-slate-400">({aggregatedRegions[0]?.percentage || 0}%)</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Trajectoires Interceptées</div>
            <div className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">
              {filteredAttempts.length.toLocaleString('fr-FR')}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Point d'Arrivée Sécurisé</div>
            <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">eth0 / wg0 (Europe IX)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Layers and Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity selector */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Toutes gravités</option>
            <option value="critical">Critiques uniquement</option>
            <option value="high">Élevées</option>
            <option value="medium">Moyennes</option>
          </select>

          {/* Vector selector */}
          <select
            value={filterVector}
            onChange={(e) => setFilterVector(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Tous vecteurs d'attaque</option>
            <option value="port_scan">Scans de ports</option>
            <option value="arp_poisoning">Usurpation ARP</option>
            <option value="replay_attack">Rejeu WireGuard</option>
            <option value="brute_force">Force Brute Auth</option>
            <option value="dns_hijack">Empoisonnement DNS</option>
            <option value="webrtc_leak">Fuites STUN/WebRTC</option>
          </select>

          {/* Toggle Trajectories */}
          <button
            type="button"
            onClick={() => setShowTrajectories(!showTrajectories)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              showTrajectories
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Trajectoires</span>
          </button>

          {/* Toggle Pulses */}
          <button
            type="button"
            onClick={() => setShowPulses(!showPulses)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              showPulses
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Ondes Radar</span>
          </button>

          {/* Toggle Heatmap Density Layer */}
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              showHeatmap
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Heatmap Densité</span>
          </button>

          {/* Heatmap Mode Selector */}
          {showHeatmap && (
            <select
              value={heatmapMode}
              onChange={(e) => setHeatmapMode(e.target.value as any)}
              className="bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 outline-none cursor-pointer"
            >
              <option value="density">Densité Fréquence</option>
              <option value="persistence">Haute Persistance</option>
              <option value="concentrated">Foyers Concentrés</option>
            </select>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom avant"
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom arrière"
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Réinitialiser la vue de la carte"
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Map (Left/Center) + Aggressive Regions Leaderboard (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* World Map Viewport (8 cols on lg) */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden relative shadow-2xl flex flex-col min-h-[460px]">
          {/* Map Status Badge Overlay */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
            <span className="bg-slate-900/90 border border-slate-700 text-cyan-400 font-mono text-[10px] px-2.5 py-1 rounded-md backdrop-blur-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>RADAR eBPF ACTIF</span>
            </span>

            {selectedCountry && (
              <span className="bg-slate-900/90 border border-slate-700 text-white font-mono text-[10px] px-2.5 py-1 rounded-md backdrop-blur-xs flex items-center gap-1.5 pointer-events-auto">
                <span>Région ciblée : {selectedCountry}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCountry(null)}
                  className="hover:text-rose-400 ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* SVG Map Canvas */}
          <div className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="w-full h-full select-none"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Radial Glow Filters */}
                <radialGradient id="gatewayGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="threatGlowCritical" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="threatGlowHigh" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>

                {/* Heatmap Density Gradients */}
                <radialGradient id="heatUltra" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff0055" stopOpacity="0.88" />
                  <stop offset="25%" stopColor="#f43f5e" stopOpacity="0.68" />
                  <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="80%" stopColor="#06b6d4" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heatHigh" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                  <stop offset="35%" stopColor="#ea580c" stopOpacity="0.58" />
                  <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heatModerate" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.75" />
                  <stop offset="45%" stopColor="#0284c7" stopOpacity="0.45" />
                  <stop offset="80%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>

                <filter id="heatBlur" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="9" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* Animated dasharray pattern for ballistic trajectory arcs */}
                <style>{`
                  @keyframes flowTrajectory {
                    from { stroke-dashoffset: 40; }
                    to { stroke-dashoffset: 0; }
                  }
                  .trajectory-line {
                    animation: flowTrajectory 1.8s linear infinite;
                  }
                  @keyframes pulseRipple {
                    0% { r: 5px; opacity: 0.9; }
                    100% { r: 24px; opacity: 0; }
                  }
                  .threat-ripple {
                    animation: pulseRipple 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
                  }
                `}</style>
              </defs>

              <g transform={transformStr}>
                {/* Ocean Background */}
                <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#090d16" />

                {/* Graticule Grid */}
                {showGraticule && (
                  <path
                    d={pathGenerator(graticuleLines) || ''}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="0.5"
                    strokeDasharray="2,3"
                    opacity="0.6"
                  />
                )}

                {/* Landmasses / Countries */}
                {countriesGeoData && (
                  <g className="countries-layer">
                    {/* Render all country features */}
                    {((countriesGeoData as any).features || []).map((featureItem: any, idx: number) => {
                      const d = pathGenerator(featureItem) || '';
                      return (
                        <path
                          key={idx}
                          d={d}
                          fill="#131c2e"
                          stroke="#1e2d45"
                          strokeWidth="0.6"
                          className="transition-colors hover:fill-[#1a263d]"
                        />
                      );
                    })}
                  </g>
                )}

                {/* 2. Cyber Threat Heatmap Density Layer */}
                {showHeatmap && (
                  <g className="heatmap-density-layer" style={{ mixBlendMode: 'screen' }} filter="url(#heatBlur)">
                    {heatmapPoints.map((pt) => {
                      const gradId =
                        pt.persistenceLevel === 'ultra'
                          ? 'url(#heatUltra)'
                          : pt.persistenceLevel === 'high'
                          ? 'url(#heatHigh)'
                          : 'url(#heatModerate)';

                      return (
                        <g key={`heat-${pt.id}`} pointerEvents="none">
                          {/* Broad Thermal Aura */}
                          <circle
                            cx={pt.projected[0]}
                            cy={pt.projected[1]}
                            r={pt.radius * 1.3}
                            fill={gradId}
                            opacity="0.65"
                          />
                          {/* Concentrated Nuclear Core */}
                          <circle
                            cx={pt.projected[0]}
                            cy={pt.projected[1]}
                            r={pt.radius * 0.72}
                            fill={gradId}
                            opacity="0.88"
                          />
                          {/* Iso-density Contour Ring */}
                          {showHeatmapContours && (
                            <circle
                              cx={pt.projected[0]}
                              cy={pt.projected[1]}
                              r={pt.radius * 0.9}
                              fill="none"
                              stroke={pt.intensityColor}
                              strokeWidth="0.8"
                              strokeDasharray="2,4"
                              opacity="0.45"
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Ballistic Threat Trajectories (Great-Circle Arcs) */}
                {showTrajectories && (
                  <g className="trajectories-layer">
                    {attackTrajectories.map((traj, idx) => {
                      const isSelected = selectedCountry === traj.country;
                      return (
                        <g key={idx}>
                          {/* Trajectory Base Line */}
                          <path
                            d={traj.pathStr}
                            fill="none"
                            stroke={traj.strokeColor}
                            strokeWidth={isSelected ? '2' : '1.2'}
                            strokeOpacity={isSelected ? '0.85' : '0.4'}
                            strokeLinecap="round"
                          />
                          {/* Animated Inbound Particle Dash */}
                          <path
                            d={traj.pathStr}
                            fill="none"
                            stroke={traj.strokeColor}
                            strokeWidth={isSelected ? '2.5' : '1.6'}
                            strokeDasharray="6,12"
                            strokeOpacity={isSelected ? '1' : '0.85'}
                            className="trajectory-line"
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Protected Destination: Local Gateway (Shield & Core) */}
                <g className="gateway-node" transform={`translate(${targetProjected[0]}, ${targetProjected[1]})`}>
                  {/* Outer Protection Halo */}
                  <circle r="18" fill="url(#gatewayGlow)" opacity="0.6" />
                  <circle
                    r="12"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.2"
                    strokeDasharray="3,3"
                    opacity="0.8"
                  />
                  <circle r="5" fill="#06b6d4" />
                  {/* Gateway Label */}
                  <text
                    x="0"
                    y="-16"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    className="pointer-events-none drop-shadow-md"
                  >
                    GATEWAY (eth0)
                  </text>
                </g>

                {/* Threat Nodes / Hostile Origins */}
                <g className="threat-nodes-layer">
                  {aggregatedRegions.map((region) => {
                    const pt = projection(region.coords);
                    if (!pt) return null;

                    const isSelected = selectedCountry === region.country;
                    const isCritical = region.criticalCount > 0;
                    const color = isCritical
                      ? '#f43f5e'
                      : region.highCount > 0
                      ? '#f59e0b'
                      : '#06b6d4';

                    const baseRadius = Math.min(18, 6 + region.attemptsCount * 1.5);

                    return (
                      <g
                        key={region.country}
                        transform={`translate(${pt[0]}, ${pt[1]})`}
                        className="cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFocusCountry(region);
                        }}
                        onMouseEnter={(e) => {
                          const rect = svgRef.current?.getBoundingClientRect();
                          if (rect) {
                            setTooltipPos({
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top,
                            });
                          }
                          setHoveredThreat(region);
                        }}
                        onMouseLeave={() => {
                          setHoveredThreat(null);
                        }}
                      >
                        {/* Radar Ripple Waves */}
                        {showPulses && (
                          <circle
                            r="16"
                            fill="none"
                            stroke={color}
                            strokeWidth="1.5"
                            className="threat-ripple"
                          />
                        )}

                        {/* Outer Glow Halo */}
                        <circle
                          r={baseRadius + 6}
                          fill={isCritical ? 'url(#threatGlowCritical)' : 'url(#threatGlowHigh)'}
                          opacity={isSelected ? 1 : 0.75}
                        />

                        {/* Main Origin Circle */}
                        <circle
                          r={baseRadius}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={isSelected ? '2' : '1'}
                          opacity="0.9"
                        />

                        {/* Hit Count Label */}
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                          className="pointer-events-none"
                        >
                          {region.attemptsCount}
                        </text>

                        {/* Country ISO Tag below marker */}
                        <text
                          x="0"
                          y={baseRadius + 11}
                          textAnchor="middle"
                          fill={color}
                          fontSize="8"
                          fontFamily="monospace"
                          fontWeight="bold"
                          className="pointer-events-none drop-shadow-md"
                        >
                          {region.iso}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredThreat && tooltipPos && (
              <div
                className="absolute z-30 pointer-events-none bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 text-white shadow-2xl backdrop-blur-md text-xs font-mono max-w-xs space-y-2 -translate-x-1/2 -translate-y-full"
                style={{
                  left: tooltipPos.x,
                  top: tooltipPos.y - 12,
                }}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <span>{hoveredThreat.flag}</span>
                    <span>{hoveredThreat.country}</span>
                    <span className="text-[10px] text-slate-400">({hoveredThreat.city})</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px]">
                    {hoveredThreat.attemptsCount} blocages
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                  <div>
                    <span className="text-slate-500">Vecteur : </span>
                    <span className="font-semibold text-cyan-400 uppercase">{hoveredThreat.dominantVector}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Risque : </span>
                    <span className="font-semibold text-rose-400">{hoveredThreat.riskIndex}/100</span>
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="text-slate-500">Réseau : </span>
                    <span className="text-slate-300">{hoveredThreat.asn}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">Dernière alerte : </span>
                    <span className="text-slate-400">
                      {new Date(hoveredThreat.latestAttempt.timestamp).toLocaleTimeString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Heatmap Density Legend Badge (Bottom-Left) */}
            {showHeatmap && (
              <div className="absolute bottom-3 left-3 z-20 pointer-events-auto bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 backdrop-blur-md shadow-xl max-w-[270px] font-mono text-[11px] space-y-1.5 transition-all">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1">
                  <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                    <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    <span>Densité Thermique IDS</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-bold">
                    {heatmapPoints.length} foyers
                  </span>
                </div>

                {/* Thermal Gradient Bar */}
                <div className="space-y-1">
                  <div className="h-2 rounded-md w-full bg-gradient-to-r from-cyan-500 via-amber-500 to-rose-600 shadow-inner" />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Modéré (1-2x)</span>
                    <span>Élevé (3-5x)</span>
                    <span className="text-rose-400 font-semibold">Critique &gt;5x</span>
                  </div>
                </div>

                {/* Density Stats & Active Mode */}
                <div className="flex items-center justify-between text-[10px] pt-0.5 text-slate-400">
                  <span className="truncate">
                    Mode :{' '}
                    <strong className="text-slate-200">
                      {heatmapMode === 'density'
                        ? 'Fréquence'
                        : heatmapMode === 'persistence'
                        ? 'Persistance'
                        : 'Foyers Ciblés'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHeatmapContours((prev) => !prev)}
                    className={`px-1.5 py-0.5 rounded-md border text-[9px] transition-colors cursor-pointer ${
                      showHeatmapContours
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Afficher/masquer les contours d'iso-densité"
                  >
                    Iso-anneaux {showHeatmapContours ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Aggressive Regions Leaderboard (4 cols on lg) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Régions les Plus Agressives
              </h4>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
              Top Origines
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
            {aggregatedRegions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Aucune tentative ne correspond aux filtres actifs.
              </div>
            ) : (
              aggregatedRegions.map((region, idx) => {
                const isSelected = selectedCountry === region.country;
                return (
                  <div
                    key={region.country}
                    onClick={() => handleFocusCountry(region)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-850/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="text-base">{region.flag}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {region.country}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {region.attemptsCount}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({region.percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar of Attack Proportion */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          region.criticalCount > 0 ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(6, region.percentage)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[140px]">{region.asn}</span>
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {region.dominantVector}
                      </span>
                    </div>

                    {/* Quick Action: Block Country CIDR */}
                    {onAddRuleFromCountry && (
                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddRuleFromCountry(region.country);
                          }}
                          className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <SlidersVertical className="w-3 h-3" />
                          <span>Bloquer cette Région (CIDR)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Selected Country Forensic Inspector Drawer (When a country is selected) */}
      {selectedRegionData && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedRegionData.flag}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Analyse Médico-Légale Régionale · {selectedRegionData.country} ({selectedRegionData.city})
                  </h4>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                    Score de Menace : {selectedRegionData.riskIndex}/100
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Zone géographique : {selectedRegionData.region} · Réseau opérateur : {selectedRegionData.asn}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onAddRuleFromCountry && (
                <button
                  type="button"
                  onClick={() => onAddRuleFromCountry(selectedRegionData.country)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Bannir le Sous-réseau (nftables)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedCountry(null)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Incidents Originating from this Region */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Incidents récents interceptés depuis cette région :</span>
              <span className="font-mono text-slate-400">
                {selectedRegionData.attemptsCount} tentative(s)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredAttempts
                .filter((a) => (a.sourceCountry || '').toLowerCase().includes(selectedRegionData.country.toLowerCase()))
                .slice(0, 4)
                .map((att) => (
                  <div
                    key={att.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {att.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        IP : <strong className="text-slate-800 dark:text-slate-200">{att.sourceIp}</strong> · Port {att.targetPort || 'Tout'} ({att.protocol})
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Règle : {att.signatureRule}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectAttempt(att)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Détail</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
