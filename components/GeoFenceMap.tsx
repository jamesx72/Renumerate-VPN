import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  geoNaturalEarth1,
  geoPath,
  geoGraticule10,
  zoom,
  zoomIdentity,
  select,
} from 'd3';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import {
  ShieldBan,
  ShieldCheck,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe2,
  MapPinOff,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import { DeviceNode, GeoFenceRegionId } from '../types';
import {
  GEO_FENCE_REGIONS,
  getGeoRegionByCountryId,
  getNodeGeoRegion,
  isNodeBlockedByGeoFence,
} from '../constants';
import { getNodeLonLat } from './WorldNodeMap';

interface GeoFenceMapProps {
  nodes: DeviceNode[];
  currentIp: string;
  isConnected: boolean;
  isDark?: boolean;
  blockedRegions: GeoFenceRegionId[];
  blockedCountries: string[];
  onUpdateGeoFence: (
    nextRegions: GeoFenceRegionId[],
    nextCountries: string[],
    reason?: string
  ) => void;
  onConnectNode: (nodeId: string) => void;
}

interface AtlasCountryFeature {
  type: string;
  id?: string | number;
  properties?: {
    name?: string;
  };
  geometry: unknown;
}

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 440;

const FIVE_EYES_ATLAS_NAMES = [
  'United States of America',
  'Canada',
  'United Kingdom',
  'Australia',
  'New Zealand',
];

const FOURTEEN_EYES_ATLAS_NAMES = [
  ...FIVE_EYES_ATLAS_NAMES,
  'France',
  'Germany',
  'Netherlands',
  'Denmark',
  'Norway',
  'Belgium',
  'Italy',
  'Spain',
  'Sweden',
];

export const GeoFenceMap: React.FC<GeoFenceMapProps> = ({
  nodes,
  currentIp,
  isConnected,
  isDark = true,
  blockedRegions,
  blockedCountries,
  onUpdateGeoFence,
  onConnectNode,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ReturnType<
    typeof zoom<SVGSVGElement, unknown>
  > | null>(null);

  const [transformStr, setTransformStr] = useState('translate(0,0) scale(1)');
  const [selectionGranularity, setSelectionGranularity] = useState<
    'region' | 'country'
  >('region');
  const [hoveredGeo, setHoveredGeo] = useState<{
    regionId: GeoFenceRegionId;
    countryName: string;
    isBlocked: boolean;
  } | null>(null);

  const projection = useMemo(() => {
    return geoNaturalEarth1()
      .scale(172)
      .translate([VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2 + 16]);
  }, []);

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const countriesGeo = useMemo<AtlasCountryFeature[]>(() => {
    try {
      const topo = worldAtlas as unknown as {
        type: 'Topology';
        objects: { countries: unknown };
      };
      const geo = feature(
        topo as never,
        topo.objects.countries as never
      ) as unknown as { features: AtlasCountryFeature[] };
      return geo.features || [];
    } catch {
      return [];
    }
  }, []);

  const graticulePath = useMemo(() => {
    return pathGenerator(geoGraticule10()) || '';
  }, [pathGenerator]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 5])
      .translateExtent([
        [-100, -60],
        [VIEWBOX_WIDTH + 100, VIEWBOX_HEIGHT + 60],
      ])
      .on('zoom', (event) => {
        const { x, y, k } = event.transform;
        setTransformStr(
          `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(3)})`
        );
      });

    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(svgEl);
    selection.call(zoomBehavior);

    return () => {
      selection.on('.zoom', null);
    };
  }, []);

  const handleZoomBy = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(220)
      .call(zoomBehaviorRef.current.scaleBy, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(260)
      .call(zoomBehaviorRef.current.transform, zoomIdentity);
  };

  const toggleRegion = (regionId: GeoFenceRegionId) => {
    const spec = GEO_FENCE_REGIONS.find((r) => r.id === regionId);
    const exists = blockedRegions.includes(regionId);
    const nextRegions = exists
      ? blockedRegions.filter((r) => r !== regionId)
      : [...blockedRegions, regionId];
    onUpdateGeoFence(
      nextRegions,
      blockedCountries,
      exists
        ? `Barrière géographique levée pour la région : ${spec?.name || regionId}`
        : `Zone interdite activée sur la région : ${spec?.name || regionId}`
    );
  };

  const toggleCountry = (countryName: string) => {
    if (!countryName) return;
    const exists = blockedCountries.includes(countryName);
    const nextCountries = exists
      ? blockedCountries.filter((c) => c !== countryName)
      : [...blockedCountries, countryName];
    onUpdateGeoFence(
      blockedRegions,
      nextCountries,
      exists
        ? `Pays autorisé à nouveau : ${countryName}`
        : `Pays interdit à la connexion : ${countryName}`
    );
  };

  const handleMapFeatureClick = (
    regionId: GeoFenceRegionId,
    countryName: string
  ) => {
    if (selectionGranularity === 'region') {
      toggleRegion(regionId);
    } else {
      toggleCountry(countryName);
    }
  };

  const nodesWithGeoStatus = useMemo(() => {
    return nodes.map((node) => {
      const lonLat = getNodeLonLat(node);
      const projected = projection(lonLat);
      const regionId = getNodeGeoRegion(node.country);
      const isBlocked = isNodeBlockedByGeoFence(node.country, {
        geoFenceBlockedRegions: blockedRegions,
        geoFenceBlockedCountries: blockedCountries,
      });
      return {
        node,
        regionId,
        isBlocked,
        x: projected ? projected[0] : 480,
        y: projected ? projected[1] : 220,
      };
    });
  }, [nodes, projection, blockedRegions, blockedCountries]);

  const blockedNodesCount = useMemo(
    () => nodesWithGeoStatus.filter((n) => n.isBlocked).length,
    [nodesWithGeoStatus]
  );

  const authorizedNodes = useMemo(
    () => nodesWithGeoStatus.filter((n) => !n.isBlocked),
    [nodesWithGeoStatus]
  );

  const activeBlockedNode = useMemo(() => {
    if (!isConnected || !currentIp) return null;
    return (
      nodesWithGeoStatus.find(
        (n) => n.node.ip === currentIp && n.isBlocked
      ) || null
    );
  }, [isConnected, currentIp, nodesWithGeoStatus]);

  const recommendedSafeNode = useMemo(() => {
    if (authorizedNodes.length === 0) return null;
    return [...authorizedNodes].sort(
      (a, b) => a.node.latency - b.node.latency
    )[0].node;
  }, [authorizedNodes]);

  const regionStats = useMemo(() => {
    return GEO_FENCE_REGIONS.map((reg) => {
      const regionNodes = nodesWithGeoStatus.filter(
        (n) => n.regionId === reg.id
      );
      const isRegionBlocked = blockedRegions.includes(reg.id);
      const projectedCenter = projection(reg.centerLonLat) || [480, 220];
      return {
        ...reg,
        nodes: regionNodes,
        isBlocked: isRegionBlocked,
        cx: projectedCenter[0],
        cy: projectedCenter[1],
      };
    });
  }, [nodesWithGeoStatus, blockedRegions, projection]);

  const hoveredRegionSpec = useMemo(
    () =>
      hoveredGeo
        ? regionStats.find((r) => r.id === hoveredGeo.regionId) || null
        : null,
    [hoveredGeo, regionStats]
  );

  const totalBarriersCount = blockedRegions.length + blockedCountries.length;

  return (
    <div
      id="geofence-panel"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <ShieldBan className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Barrière Géographique (Géo-Fencing)
          </h2>
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span
            className={`font-mono tabular-nums font-medium ${
              totalBarriersCount > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {totalBarriersCount === 0
              ? 'Aucune zone interdite'
              : `${blockedRegions.length} région${blockedRegions.length > 1 ? 's' : ''} · ${blockedCountries.length} pays bloqué${blockedCountries.length > 1 ? 's' : ''}`}
          </span>
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {authorizedNodes.length}/{nodes.length} relais autorisés
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectionGranularity('region')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                selectionGranularity === 'region'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Clic par Région
            </button>
            <button
              type="button"
              onClick={() => setSelectionGranularity('country')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                selectionGranularity === 'country'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Clic par Pays
            </button>
          </div>

          {/* Quick Geopolitical Presets */}
          <button
            type="button"
            onClick={() =>
              onUpdateGeoFence(
                [],
                FIVE_EYES_ATLAS_NAMES,
                'Barrière géographique : alliance 5-Eyes bloquée sur la carte'
              )
            }
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-400 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            Interdire 5-Eyes
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateGeoFence(
                [],
                FOURTEEN_EYES_ATLAS_NAMES,
                'Barrière géographique : alliance 14-Eyes bloquée sur la carte'
              )
            }
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-400 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            Interdire 14-Eyes
          </button>
          {totalBarriersCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onUpdateGeoFence(
                  [],
                  [],
                  'Barrière géographique réinitialisée : toutes les zones sont autorisées'
                )
              }
              className="px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              Tout autoriser
            </button>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleZoomBy(1.35)}
              title="Zoom avant"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoomBy(0.74)}
              title="Zoom arrière"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Réinitialiser la vue"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Warning if Active Tunnel is inside Blocked Geo-Fence */}
      {activeBlockedNode && (
        <div className="px-5 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              Votre tunnel actif ({activeBlockedNode.node.name} ·{' '}
              {activeBlockedNode.node.country}) se trouve désormais dans une
              zone interdite.
            </span>
          </div>
          {recommendedSafeNode && (
            <button
              type="button"
              onClick={() => onConnectNode(recommendedSafeNode.id)}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>
                Migrer vers {recommendedSafeNode.name} (
                {recommendedSafeNode.country})
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Split: Interactive SVG Map (8 cols) + Region Fence Panel (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Interactive SVG Map */}
        <div className="lg:col-span-8 xl:col-span-9 relative bg-slate-50 dark:bg-slate-950/80 select-none overflow-hidden flex flex-col justify-between">
          {/* Hover HUD Readout */}
          {hoveredGeo && hoveredRegionSpec && (
            <div className="pointer-events-none absolute top-3 left-3 z-10 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs shadow-sm max-w-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <span>
                  {selectionGranularity === 'region'
                    ? hoveredRegionSpec.name
                    : hoveredGeo.countryName}
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span
                  className={
                    hoveredGeo.isBlocked
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }
                >
                  {hoveredGeo.isBlocked ? 'Zone interdite' : 'Autorisée'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {selectionGranularity === 'region'
                  ? `${hoveredGeo.countryName} · ${hoveredRegionSpec.nodes.length} relais dans cette région`
                  : `Région : ${hoveredRegionSpec.name}`}
              </div>
              <div className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-0.5 font-medium">
                {hoveredGeo.isBlocked
                  ? 'Cliquer pour autoriser à nouveau'
                  : 'Cliquer pour définir comme zone interdite'}
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="w-full h-[350px] sm:h-[410px] cursor-crosshair block"
          >
            <defs>
              {/* Diagonal Hazard Hatch Pattern for Blocked Zones (color-blind accessible) */}
              <pattern
                id="geoFenceHazardPattern"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width="8"
                  height="8"
                  fill={
                    isDark
                      ? 'rgba(225, 29, 72, 0.28)'
                      : 'rgba(225, 29, 72, 0.18)'
                  }
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke={
                    isDark
                      ? 'rgba(251, 113, 133, 0.7)'
                      : 'rgba(225, 29, 72, 0.55)'
                  }
                  strokeWidth="2.2"
                />
              </pattern>
            </defs>

            <g transform={transformStr}>
              {/* Graticule */}
              <path
                d={graticulePath}
                fill="none"
                stroke={
                  isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.06)'
                }
                strokeWidth="0.6"
              />

              {/* Interactive Countries / Regions */}
              {countriesGeo.map((geoFeature, idx) => {
                const atlasName = geoFeature.properties?.name || 'Territoire';
                const regionId = getGeoRegionByCountryId(
                  geoFeature.id,
                  atlasName
                );
                const isRegionBlocked = blockedRegions.includes(regionId);
                const isCountryBlocked = blockedCountries.includes(atlasName);
                const isBlocked = isRegionBlocked || isCountryBlocked;

                const isHovered =
                  hoveredGeo !== null &&
                  (selectionGranularity === 'region'
                    ? hoveredGeo.regionId === regionId
                    : hoveredGeo.countryName === atlasName);

                const fillColor = isBlocked
                  ? 'url(#geoFenceHazardPattern)'
                  : isHovered
                    ? isDark
                      ? '#0e7490'
                      : '#bae6fd'
                    : isDark
                      ? '#1e293b'
                      : '#e2e8f0';

                const strokeColor = isBlocked
                  ? '#f43f5e'
                  : isHovered
                    ? '#06b6d4'
                    : isDark
                      ? '#334155'
                      : '#cbd5e1';

                return (
                  <path
                    key={`${geoFeature.id ?? atlasName}-${idx}`}
                    d={pathGenerator(geoFeature as never) || ''}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 1.15 : isBlocked ? 0.85 : 0.55}
                    className="transition-colors duration-150 cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredGeo({
                        regionId,
                        countryName: atlasName,
                        isBlocked,
                      })
                    }
                    onMouseLeave={() => setHoveredGeo(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMapFeatureClick(regionId, atlasName);
                    }}
                  />
                );
              })}

              {/* Region Anchor Chips on Map (Clickable) */}
              {regionStats.map((reg) => {
                const isHovered =
                  hoveredGeo?.regionId === reg.id &&
                  selectionGranularity === 'region';
                return (
                  <g
                    key={reg.id}
                    transform={`translate(${reg.cx}, ${reg.cy})`}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredGeo({
                        regionId: reg.id,
                        countryName: reg.name,
                        isBlocked: reg.isBlocked,
                      })
                    }
                    onMouseLeave={() => setHoveredGeo(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRegion(reg.id);
                    }}
                  >
                    <rect
                      x={-44}
                      y={-10}
                      width={88}
                      height={20}
                      rx={5}
                      fill={
                        reg.isBlocked
                          ? isDark
                            ? 'rgba(136, 19, 55, 0.92)'
                            : 'rgba(255, 228, 230, 0.96)'
                          : isHovered
                            ? isDark
                              ? 'rgba(8, 51, 68, 0.95)'
                              : 'rgba(224, 242, 254, 0.98)'
                            : isDark
                              ? 'rgba(15, 23, 42, 0.84)'
                              : 'rgba(255, 255, 255, 0.9)'
                      }
                      stroke={
                        reg.isBlocked
                          ? '#f43f5e'
                          : isHovered
                            ? '#06b6d4'
                            : isDark
                              ? '#334155'
                              : '#cbd5e1'
                      }
                      strokeWidth={reg.isBlocked || isHovered ? 1.1 : 0.75}
                    />
                    <text
                      x={0}
                      y={3.2}
                      textAnchor="middle"
                      fontSize={8.5}
                      fontWeight={600}
                      fontFamily="JetBrains Mono, monospace"
                      fill={
                        reg.isBlocked
                          ? isDark
                            ? '#fda4af'
                            : '#be123c'
                          : isDark
                            ? '#e2e8f0'
                            : '#0f172a'
                      }
                    >
                      {reg.isBlocked ? '✕ ' : ''}
                      {reg.shortName}
                    </text>
                  </g>
                );
              })}

              {/* Relay Nodes Overlaid on Map */}
              {nodesWithGeoStatus.map(({ node, isBlocked, x, y }) => {
                const isActive = isConnected && node.ip === currentIp;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectNode(node.id);
                    }}
                  >
                    <circle
                      r={isActive ? 9 : 6}
                      fill={isBlocked ? '#f43f5e' : '#10b981'}
                      fillOpacity={isActive ? 0.3 : 0.16}
                    />
                    <circle
                      r={isActive ? 4.8 : 3.8}
                      fill={isBlocked ? '#e11d48' : '#10b981'}
                      stroke={isDark ? '#0f172a' : '#ffffff'}
                      strokeWidth={1.3}
                    />
                    {isBlocked && (
                      <g stroke="#ffffff" strokeWidth={1.1}>
                        <line x1={-1.8} y1={-1.8} x2={1.8} y2={1.8} />
                        <line x1={1.8} y1={-1.8} x2={-1.8} y2={1.8} />
                      </g>
                    )}
                    <title>
                      {node.name} ({node.city || node.country}) —{' '}
                      {isBlocked ? 'Bloqué par barrière géo' : 'Relais autorisé'}
                    </title>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Bottom Legend Strip */}
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs border border-rose-500 bg-rose-500/30 inline-block" />
                <span>Zone hachurée = connexion interdite</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Relais autorisé ({authorizedNodes.length})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                <span>Relais bloqué ({blockedNodesCount})</span>
              </span>
            </div>
            <span>
              Simple clic sur une région ou un pays pour basculer son accès
            </span>
          </div>
        </div>

        {/* Right Side Panel: World Regions List & Country Overrides */}
        <div className="lg:col-span-4 xl:col-span-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between bg-white dark:bg-slate-900 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                <Globe2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Régions mondiales (8 zones)</span>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {blockedRegions.length}/8 bloquées
              </span>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-0.5">
              {regionStats.map((reg) => {
                const relayCount = reg.nodes.length;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => toggleRegion(reg.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      reg.isBlocked
                        ? 'bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800/80'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {reg.isBlocked ? (
                          <MapPinOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">{reg.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {relayCount > 0
                          ? `${relayCount} relais (${reg.nodes.map((n) => n.node.country).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`
                          : reg.description}
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-mono font-semibold shrink-0 ${
                        reg.isBlocked
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {reg.isBlocked ? 'Interdite' : 'Autorisée'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Individual Country Rules Summary */}
            {blockedCountries.length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Pays individuellement bloqués ({blockedCountries.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateGeoFence(
                        blockedRegions,
                        [],
                        'Exceptions pays individuelles effacées'
                      )
                    }
                    className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Effacer
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                  {blockedCountries.map((countryName) => (
                    <button
                      key={countryName}
                      type="button"
                      onClick={() => toggleCountry(countryName)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer"
                      title={`Autoriser ${countryName}`}
                    >
                      <span>{countryName}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>Filtrage appliqué au routage &amp; sauts auto</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
