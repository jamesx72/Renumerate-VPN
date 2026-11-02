import React, { useMemo, useRef, useEffect, useState } from 'react';
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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe2,
  Power,
  Activity,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { DeviceNode, ConnectionMode } from '../types';

interface WorldNodeMapProps {
  nodes: DeviceNode[];
  currentIp: string;
  isConnected: boolean;
  mode: ConnectionMode;
  isDark?: boolean;
  onConnectNode: (nodeId: string) => void;
}

const FALLBACK_COORDS: Record<string, [number, number]> = {
  France: [2.3522, 48.8566],
  Suisse: [8.5417, 47.3769],
  Allemagne: [8.6821, 50.1109],
  Islande: [-21.9426, 64.1466],
  Estonie: [24.7536, 59.437],
  USA: [-74.006, 40.7128],
  Panama: [-79.5199, 8.9824],
  Singapour: [103.8198, 1.3521],
};

// Local origin hub (Brussels / Western Europe IXP neutral anchor)
const LOCAL_ORIGIN: [number, number] = [4.3517, 50.8503];

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 460;

export const WorldNodeMap: React.FC<WorldNodeMapProps> = ({
  nodes,
  currentIp,
  isConnected,
  mode,
  isDark = true,
  onConnectNode,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);

  const [transformStr, setTransformStr] = useState('translate(0,0) scale(1)');
  const [latencyFilter, setLatencyFilter] = useState<'all' | 'fast' | 'provider'>('all');
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
      if (latencyFilter === 'fast') return n.latency <= 40;
      if (latencyFilter === 'provider') return n.autonomyProfile === 'provider';
      return true;
    });
  }, [nodes, latencyFilter]);

  const mappedNodes = useMemo(() => {
    return visibleNodes
      .map((node) => {
        const lonLat: [number, number] =
          typeof node.lon === 'number' && typeof node.lat === 'number'
            ? [node.lon, node.lat]
            : FALLBACK_COORDS[node.country] || [2.3522, 48.8566];
        const projected = projection(lonLat);
        if (!projected) return null;
        return {
          node,
          lonLat,
          x: projected[0],
          y: projected[1],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [visibleNodes, projection]);

  const originPoint = useMemo(() => {
    const p = projection(LOCAL_ORIGIN) || [480, 145];
    return { x: p[0], y: p[1], lonLat: LOCAL_ORIGIN };
  }, [projection]);

  const buildGreatCircleSvgPath = (
    fromLonLat: [number, number],
    toLonLat: [number, number]
  ): string => {
    const interp = geoInterpolate(fromLonLat, toLonLat);
    const steps = 28;
    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const pt = projection(interp(i / steps));
      if (pt) coords.push([pt[0], pt[1]]);
    }
    if (coords.length < 2) return '';
    return coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`)
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
        setTransformStr(`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(3)})`);
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

  const activeNodeItem = useMemo(
    () => mappedNodes.find((m) => m.node.ip === currentIp),
    [mappedNodes, currentIp]
  );

  // Intermediate relay for Double Hop / Onion Vortex visualization
  const entryHopItem = useMemo(() => {
    if (
      !isConnected ||
      !activeNodeItem ||
      (mode !== ConnectionMode.DOUBLE_HOP && mode !== ConnectionMode.ONION_VORTEX)
    ) {
      return null;
    }
    return (
      mappedNodes.find(
        (m) =>
          m.node.id !== activeNodeItem.node.id &&
          (m.node.country === 'Suisse' || m.node.country === 'Islande')
      ) || mappedNodes.find((m) => m.node.id !== activeNodeItem.node.id) || null
    );
  }, [isConnected, activeNodeItem, mode, mappedNodes]);

  const inspectedItem = useMemo(() => {
    const targetId = hoveredNodeId || selectedNodeId || activeNodeItem?.node.id;
    return mappedNodes.find((m) => m.node.id === targetId) || mappedNodes[0] || null;
  }, [hoveredNodeId, selectedNodeId, activeNodeItem, mappedNodes]);

  const getLatencyStroke = (latency: number, isActiveLink: boolean) => {
    if (isActiveLink && isConnected) return '#06b6d4';
    if (latency <= 35) return '#10b981';
    if (latency <= 90) return '#f59e0b';
    return '#f43f5e';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Top Map Control Bar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Globe2 className="w-4 h-4 text-cyan-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Carte mondiale des relais actifs
          </h2>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {mappedNodes.length} relais affichés
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Latency Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'Tous les relais' },
                { id: 'fast', label: '< 40 ms' },
                { id: 'provider', label: 'Haute capacité' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setLatencyFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  latencyFilter === f.id
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
        <div className="lg:col-span-9 relative bg-slate-50 dark:bg-slate-950/80 select-none overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="w-full h-[360px] sm:h-[420px] cursor-grab active:cursor-grabbing block"
          >
            <defs>
              <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
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
                stroke={isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.06)'}
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

              {/* Geodesic Latency Arcs from Origin to Nodes */}
              {mappedNodes.map(({ node, lonLat }) => {
                const isActiveTarget = isConnected && node.ip === currentIp;
                const dPath =
                  isActiveTarget && entryHopItem
                    ? buildGreatCircleSvgPath(entryHopItem.lonLat, lonLat)
                    : buildGreatCircleSvgPath(originPoint.lonLat, lonLat);
                const strokeColor = getLatencyStroke(node.latency, isActiveTarget);

                return (
                  <g key={`arc-${node.id}`}>
                    <path
                      d={dPath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isActiveTarget ? 2.4 : 1.15}
                      strokeOpacity={isActiveTarget ? 0.95 : 0.38}
                      strokeDasharray={isActiveTarget ? undefined : '4 4'}
                      filter={isActiveTarget ? 'url(#arcGlow)' : undefined}
                    />
                  </g>
                );
              })}

              {/* First Hop Arc when Double Hop / Onion Vortex is Active */}
              {entryHopItem && activeNodeItem && (
                <path
                  d={buildGreatCircleSvgPath(originPoint.lonLat, entryHopItem.lonLat)}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth={2.2}
                  strokeOpacity={0.9}
                  filter="url(#arcGlow)"
                />
              )}

              {/* Local Origin Hub Marker */}
              <g transform={`translate(${originPoint.x}, ${originPoint.y})`}>
                <circle r={6} fill="#06b6d4" fillOpacity={0.2} />
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
                const isHovered = hoveredNodeId === node.id || selectedNodeId === node.id;
                const dotColor = getLatencyStroke(node.latency, isCurrent);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x}, ${y})`}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                      onConnectNode(node.id);
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      r={isCurrent ? 12 : isHovered ? 10 : 7}
                      fill={dotColor}
                      fillOpacity={isCurrent ? 0.28 : isHovered ? 0.22 : 0.12}
                    />
                    <circle
                      r={isCurrent ? 5.5 : isHovered ? 5 : 4}
                      fill={dotColor}
                      stroke={isDark ? '#0f172a' : '#ffffff'}
                      strokeWidth={1.5}
                    />
                    {(isCurrent || isHovered) && (
                      <g transform="translate(8, -8)">
                        <rect
                          x={0}
                          y={-11}
                          width={102}
                          height={20}
                          rx={5}
                          fill={isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)'}
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
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Latence optimale (&le; 35 ms)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Intermédiaire (36–90 ms)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>Longue distance (&gt; 90 ms)</span>
              </span>
            </div>
            <span>Cliquez sur un nœud de la carte pour basculer le tunnel</span>
          </div>
        </div>

        {/* Right Node Inspector Panel */}
        <div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between bg-white dark:bg-slate-900">
          {inspectedItem ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectedItem.node.city || inspectedItem.node.country} ·{' '}
                  {inspectedItem.node.country}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-center justify-between">
                  <span>{inspectedItem.node.name}</span>
                  <span className="text-xs font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {inspectedItem.node.latency} ms
                  </span>
                </h3>
                <div className="text-xs font-mono tabular-nums text-slate-500 mt-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  <span>{inspectedItem.node.ip}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Signal relais</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {inspectedItem.node.signalStrength}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Capacité bande passante</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {inspectedItem.node.transferRate} Mo/s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Rôle d’autonomie</span>
                  <span className="font-medium capitalize text-slate-800 dark:text-slate-200">
                    {inspectedItem.node.autonomyProfile}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Intégrité passerelle</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Vérifiée
                  </span>
                </div>
              </div>

              {entryHopItem &&
                activeNodeItem?.node.id === inspectedItem.node.id && (
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-600 dark:text-purple-300">
                    Routage multi-sauts actif via{' '}
                    <span className="font-mono font-semibold">
                      {entryHopItem.node.name}
                    </span>{' '}
                    →{' '}
                    <span className="font-mono font-semibold">
                      {inspectedItem.node.name}
                    </span>
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
                    <span>Connecter ce nœud</span>
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
