import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  geoNaturalEarth1,
  geoPath,
  geoGraticule10,
  geoInterpolate,
  geoDistance,
  zoom,
  zoomIdentity,
  select,
} from 'd3';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe2,
  Power,
  Activity,
  Server,
  ShieldCheck,
  ShieldAlert,
  Route,
} from 'lucide-react';
import { DeviceNode, ConnectionMode, AppSettings } from '../types';
import {
  getJurisdictionTier,
  isCountryExcludedByJurisdiction,
} from '../constants';

interface WorldNodeMapProps {
  nodes: DeviceNode[];
  currentIp: string;
  isConnected: boolean;
  mode: ConnectionMode;
  isDark?: boolean;
  circuitHopIds?: string[];
  excludeJurisdictions?: AppSettings['excludeEyesJurisdictions'];
  onConnectNode: (nodeId: string) => void;
  onAssignHopRole?: (nodeId: string, role: 'entry' | 'relay' | 'exit') => void;
}

export const FALLBACK_COORDS: Record<string, [number, number]> = {
  France: [2.3522, 48.8566],
  Suisse: [8.5417, 47.3769],
  Allemagne: [8.6821, 50.1109],
  Islande: [-21.9426, 64.1466],
  Estonie: [24.7536, 59.437],
  USA: [-74.006, 40.7128],
  Panama: [-79.5199, 8.9824],
  Singapour: [103.8198, 1.3521],
};

// Neutral European IXP local anchor (Brussels IX)
export const LOCAL_ORIGIN: [number, number] = [4.3517, 50.8503];
const EARTH_RADIUS_KM = 6371;

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 460;

export function getNodeLonLat(node: DeviceNode): [number, number] {
  if (typeof node.lon === 'number' && typeof node.lat === 'number') {
    return [node.lon, node.lat];
  }
  return FALLBACK_COORDS[node.country] || [2.3522, 48.8566];
}

export function computeGeodesicDistanceKm(
  fromLonLat: [number, number],
  toLonLat: [number, number]
): number {
  return Math.round(geoDistance(fromLonLat, toLonLat) * EARTH_RADIUS_KM);
}

export const WorldNodeMap: React.FC<WorldNodeMapProps> = ({
  nodes,
  currentIp,
  isConnected,
  mode,
  isDark = true,
  circuitHopIds = [],
  excludeJurisdictions = 'none',
  onConnectNode,
  onAssignHopRole,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<
    ReturnType<typeof zoom<SVGSVGElement, unknown>> | null
  >(null);

  const [transformStr, setTransformStr] = useState('translate(0,0) scale(1)');
  const [mapFilter, setMapFilter] = useState<
    'all' | 'fast' | 'sanctuary' | 'provider'
  >('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const projection = useMemo(() => {
    return geoNaturalEarth1()
      .scale(176)
      .translate([VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2 + 18]);
  }, []);

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const countriesGeo = useMemo(() => {
    try {
      const topo = worldAtlas as unknown as {
        type: 'Topology';
        objects: { countries: unknown };
      };
      const geo = feature(
        topo as never,
        topo.objects.countries as never
      ) as unknown as { features: unknown[] };
      return geo.features || [];
    } catch {
      return [];
    }
  }, []);

  const graticulePath = useMemo(() => {
    return pathGenerator(geoGraticule10()) || '';
  }, [pathGenerator]);

  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (mapFilter === 'fast') return n.latency <= 40;
      if (mapFilter === 'sanctuary')
        return getJurisdictionTier(n.country) === 'sanctuary';
      if (mapFilter === 'provider') return n.autonomyProfile === 'provider';
      return true;
    });
  }, [nodes, mapFilter]);

  const allMappedById = useMemo(() => {
    const map = new Map<
      string,
      { node: DeviceNode; lonLat: [number, number]; x: number; y: number }
    >();
    for (const node of nodes) {
      const lonLat = getNodeLonLat(node);
      const projected = projection(lonLat);
      if (projected) {
        map.set(node.id, {
          node,
          lonLat,
          x: projected[0],
          y: projected[1],
        });
      }
    }
    return map;
  }, [nodes, projection]);

  const mappedNodes = useMemo(() => {
    return visibleNodes
      .map((node) => allMappedById.get(node.id) || null)
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [visibleNodes, allMappedById]);

  const originPoint = useMemo(() => {
    const p = projection(LOCAL_ORIGIN) || [480, 145];
    return { x: p[0], y: p[1], lonLat: LOCAL_ORIGIN };
  }, [projection]);

  const buildGreatCircleSvgPath = (
    fromLonLat: [number, number],
    toLonLat: [number, number]
  ): string => {
    const interp = geoInterpolate(fromLonLat, toLonLat);
    const steps = 30;
    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const pt = projection(interp(i / steps));
      if (pt) coords.push([pt[0], pt[1]]);
    }
    if (coords.length < 2) return '';
    return coords
      .map(
        (c, idx) =>
          `${idx === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`
      )
      .join(' ');
  };

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 5])
      .translateExtent([
        [-120, -80],
        [VIEWBOX_WIDTH + 120, VIEWBOX_HEIGHT + 80],
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

  const activeNodeItem = useMemo(() => {
    for (const item of allMappedById.values()) {
      if (item.node.ip === currentIp) return item;
    }
    return undefined;
  }, [allMappedById, currentIp]);

  // Build ordered circuit hops (either staged circuitHopIds or active tunnel fallback)
  const effectiveCircuitItems = useMemo(() => {
    const validExplicit = circuitHopIds
      .map((id) => allMappedById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (validExplicit.length > 0) {
      return validExplicit;
    }

    if (!isConnected || !activeNodeItem) return [];

    if (
      mode === ConnectionMode.DOUBLE_HOP ||
      mode === ConnectionMode.ONION_VORTEX
    ) {
      const guard = Array.from(allMappedById.values()).find(
        (m) =>
          m.node.id !== activeNodeItem.node.id &&
          (m.node.country === 'Suisse' || m.node.country === 'Islande')
      );
      if (mode === ConnectionMode.ONION_VORTEX && guard) {
        const middle = Array.from(allMappedById.values()).find(
          (m) =>
            m.node.id !== activeNodeItem.node.id &&
            m.node.id !== guard.node.id &&
            getJurisdictionTier(m.node.country) === 'sanctuary'
        );
        if (middle) return [guard, middle, activeNodeItem];
      }
      if (guard) return [guard, activeNodeItem];
    }

    return [activeNodeItem];
  }, [circuitHopIds, allMappedById, isConnected, activeNodeItem, mode]);

  const circuitSegments = useMemo(() => {
    if (effectiveCircuitItems.length === 0) return [];
    const palette = ['#06b6d4', '#a855f7', '#10b981'];
    const segments: Array<{
      key: string;
      dPath: string;
      color: string;
      distanceKm: number;
      fromLabel: string;
      toLabel: string;
    }> = [];

    let prevLonLat = originPoint.lonLat;
    let prevLabel = 'Origine locale';

    effectiveCircuitItems.forEach((hop, idx) => {
      const dist = computeGeodesicDistanceKm(prevLonLat, hop.lonLat);
      segments.push({
        key: `seg-${idx}-${hop.node.id}`,
        dPath: buildGreatCircleSvgPath(prevLonLat, hop.lonLat),
        color: palette[idx % palette.length],
        distanceKm: dist,
        fromLabel: prevLabel,
        toLabel: hop.node.name,
      });
      prevLonLat = hop.lonLat;
      prevLabel = hop.node.name;
    });

    return segments;
  }, [effectiveCircuitItems, originPoint.lonLat, projection]);

  const totalRouteKm = useMemo(
    () => circuitSegments.reduce((acc, s) => acc + s.distanceKm, 0),
    [circuitSegments]
  );

  const circuitOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    effectiveCircuitItems.forEach((item, index) => {
      if (!m.has(item.node.id)) {
        m.set(item.node.id, index + 1);
      }
    });
    return m;
  }, [effectiveCircuitItems]);

  const inspectedItem = useMemo(() => {
    const targetId =
      hoveredNodeId ||
      selectedNodeId ||
      effectiveCircuitItems[effectiveCircuitItems.length - 1]?.node.id ||
      activeNodeItem?.node.id;
    return (
      (targetId ? allMappedById.get(targetId) : undefined) ||
      mappedNodes[0] ||
      null
    );
  }, [
    hoveredNodeId,
    selectedNodeId,
    effectiveCircuitItems,
    activeNodeItem,
    allMappedById,
    mappedNodes,
  ]);

  const getLatencyStroke = (
    latency: number,
    isActiveLink: boolean,
    isExcluded: boolean
  ) => {
    if (isExcluded) return '#64748b';
    if (isActiveLink && isConnected) return '#06b6d4';
    if (latency <= 35) return '#10b981';
    if (latency <= 90) return '#f59e0b';
    return '#f43f5e';
  };

  const inspectedTier = inspectedItem
    ? getJurisdictionTier(inspectedItem.node.country)
    : 'sanctuary';
  const inspectedExcluded = inspectedItem
    ? isCountryExcludedByJurisdiction(
        inspectedItem.node.country,
        excludeJurisdictions
      )
    : false;
  const inspectedOriginKm = inspectedItem
    ? computeGeodesicDistanceKm(originPoint.lonLat, inspectedItem.lonLat)
    : 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Top Map Control Bar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Globe2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Projection géodésique mondiale des relais
          </h2>
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {mappedNodes.length} relais visibles
          </span>
          {totalRouteKm > 0 && (
            <>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-400 font-medium">
                Route {effectiveCircuitItems.length} saut
                {effectiveCircuitItems.length > 1 ? 's' : ''} ({totalRouteKm.toLocaleString('fr-FR')} km)
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Map Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Tous' },
                { id: 'fast', label: '≤ 40 ms' },
                { id: 'sanctuary', label: 'Sanctuaires' },
                { id: 'provider', label: 'Haute capacité' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setMapFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mapFilter === f.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

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

      {/* Main Map Viewport + Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 xl:col-span-9 relative bg-slate-50 dark:bg-slate-950/80 select-none overflow-hidden flex flex-col justify-between">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="w-full h-[360px] sm:h-[420px] cursor-grab active:cursor-grabbing block"
          >
            <defs>
              <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
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

              {/* World Countries */}
              {countriesGeo.map((geoFeature, idx) => (
                <path
                  key={idx}
                  d={pathGenerator(geoFeature as never) || ''}
                  fill={isDark ? '#1e293b' : '#e2e8f0'}
                  stroke={isDark ? '#334155' : '#cbd5e1'}
                  strokeWidth="0.55"
                />
              ))}

              {/* Background Standby Mesh Arcs */}
              {mappedNodes.map(({ node, lonLat }) => {
                const inCircuit = circuitOrderMap.has(node.id);
                if (inCircuit) return null;
                const isExcluded = isCountryExcludedByJurisdiction(
                  node.country,
                  excludeJurisdictions
                );
                const dPath = buildGreatCircleSvgPath(
                  originPoint.lonLat,
                  lonLat
                );
                const strokeColor = getLatencyStroke(
                  node.latency,
                  false,
                  isExcluded
                );

                return (
                  <path
                    key={`standby-arc-${node.id}`}
                    d={dPath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={0.95}
                    strokeOpacity={isExcluded ? 0.14 : 0.28}
                    strokeDasharray="3 4"
                  />
                );
              })}

              {/* Active / Staged Multi-Hop Geodesic Circuit Arcs */}
              {circuitSegments.map((seg) => (
                <path
                  key={seg.key}
                  d={seg.dPath}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={2.35}
                  strokeOpacity={0.92}
                  filter="url(#arcGlow)"
                />
              ))}

              {/* Local Origin Hub Marker */}
              <g transform={`translate(${originPoint.x}, ${originPoint.y})`}>
                <circle r={6.5} fill="#06b6d4" fillOpacity={0.22} />
                <circle
                  r={3.2}
                  fill="#06b6d4"
                  stroke={isDark ? '#0f172a' : '#ffffff'}
                  strokeWidth={1.2}
                />
              </g>

              {/* Relay Node Markers */}
              {mappedNodes.map(({ node, x, y }) => {
                const isCurrent = node.ip === currentIp && isConnected;
                const hopOrder = circuitOrderMap.get(node.id);
                const isExcluded = isCountryExcludedByJurisdiction(
                  node.country,
                  excludeJurisdictions
                );
                const isHovered =
                  hoveredNodeId === node.id || selectedNodeId === node.id;
                const dotColor = hopOrder
                  ? hopOrder === 1
                    ? '#06b6d4'
                    : hopOrder === 2 && effectiveCircuitItems.length === 3
                      ? '#a855f7'
                      : '#10b981'
                  : getLatencyStroke(node.latency, isCurrent, isExcluded);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x}, ${y})`}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                      onConnectNode(node.id);
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      r={
                        isCurrent || hopOrder
                          ? 12
                          : isHovered
                            ? 10
                            : 7
                      }
                      fill={dotColor}
                      fillOpacity={
                        isExcluded
                          ? 0.08
                          : isCurrent || hopOrder
                            ? 0.28
                            : isHovered
                              ? 0.22
                              : 0.13
                      }
                    />
                    <circle
                      r={isCurrent || hopOrder ? 5.6 : isHovered ? 5 : 4}
                      fill={dotColor}
                      fillOpacity={isExcluded ? 0.45 : 1}
                      stroke={isDark ? '#0f172a' : '#ffffff'}
                      strokeWidth={1.5}
                    />

                    {/* Circuit Hop Index Marker (#1, #2, #3) */}
                    {hopOrder && (
                      <g transform="translate(-7, -15)">
                        <rect
                          x={0}
                          y={-8}
                          width={14}
                          height={12}
                          rx={3}
                          fill={dotColor}
                        />
                        <text
                          x={7}
                          y={1}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={8}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={700}
                        >
                          {hopOrder}
                        </text>
                      </g>
                    )}

                    {(isCurrent || isHovered) && (
                      <g transform="translate(9, -8)">
                        <rect
                          x={0}
                          y={-11}
                          width={110}
                          height={20}
                          rx={5}
                          fill={
                            isDark
                              ? 'rgba(15,23,42,0.94)'
                              : 'rgba(255,255,255,0.96)'
                          }
                          stroke={dotColor}
                          strokeWidth={0.9}
                        />
                        <text
                          x={6}
                          y={2}
                          fill={isDark ? '#f8fafc' : '#0f172a'}
                          fontSize={9}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={600}
                        >
                          {node.name} · {node.latency}ms
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Bottom Legend Strip */}
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 inline-block" />
                <span>Garde #1</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-purple-500 inline-block" />
                <span>Relais #2</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                <span>Sortie / ≤ 35 ms</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                <span>36–90 ms</span>
              </span>
            </div>
            <span>
              Clic : inspecter le relais · Double-clic : basculer le tunnel
            </span>
          </div>
        </div>

        {/* Right Node Inspector Panel */}
        <div className="lg:col-span-4 xl:col-span-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between bg-white dark:bg-slate-900">
          {inspectedItem ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span>{inspectedItem.node.city || inspectedItem.node.country}</span>
                  <span aria-hidden="true">·</span>
                  <span>{inspectedItem.node.country}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      inspectedTier === 'sanctuary'
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : inspectedTier === '14-eyes'
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-rose-600 dark:text-rose-400 font-medium'
                    }
                  >
                    {inspectedTier === 'sanctuary'
                      ? 'Sanctuaire'
                      : inspectedTier === '14-eyes'
                        ? '14-Eyes'
                        : '5-Eyes'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 flex items-center justify-between gap-2">
                  <span>{inspectedItem.node.name}</span>
                  <span className="text-xs font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {inspectedItem.node.latency} ms
                    {typeof inspectedItem.node.jitter === 'number'
                      ? ` · ±${inspectedItem.node.jitter} ms`
                      : ''}
                  </span>
                </h3>

                <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {inspectedItem.node.ip}
                    {inspectedItem.node.asn ? ` · ${inspectedItem.node.asn}` : ''}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Distance géodésique
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {inspectedOriginKm.toLocaleString('fr-FR')} km
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Capacité &amp; charge
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {inspectedItem.node.transferRate} Mo/s ·{' '}
                    {inspectedItem.node.loadPct ?? 30}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Signal &amp; perte
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {inspectedItem.node.signalStrength}% ·{' '}
                    {inspectedItem.node.packetLoss ?? 0}% perte
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Politique juridictionnelle
                  </span>
                  {inspectedExcluded ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Exclu ({excludeJurisdictions})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Éligible &amp; vérifié
                    </span>
                  )}
                </div>
              </div>

              {onAssignHopRole && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <Route className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Épingler dans l’orchestrateur multi-sauts</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { role: 'entry', label: '#1 Garde' },
                        { role: 'relay', label: '#2 Relais' },
                        { role: 'exit', label: '#3 Sortie' },
                      ] as const
                    ).map((slot) => (
                      <button
                        key={slot.role}
                        type="button"
                        onClick={() =>
                          onAssignHopRole(inspectedItem.node.id, slot.role)
                        }
                        className="py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-cyan-500/60 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {circuitSegments.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="text-slate-500 dark:text-slate-400">
                    Tracé actif sur la carte
                  </div>
                  <div className="font-mono tabular-nums text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed">
                    Origine →{' '}
                    {effectiveCircuitItems.map((c) => c.node.name).join(' → ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-8 text-center">
              Survolez ou sélectionnez un relais sur la carte.
            </div>
          )}

          {inspectedItem && (
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onConnectNode(inspectedItem.node.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  inspectedItem.node.ip === currentIp && isConnected
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {inspectedItem.node.ip === currentIp && isConnected ? (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Relais actuellement connecté</span>
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4" />
                    <span>Basculer le tunnel sur ce nœud</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
