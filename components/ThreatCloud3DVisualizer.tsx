import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Globe,
  Radio,
  ShieldAlert,
  Flame,
  Activity,
  Maximize2,
  Minimize2,
  RotateCcw,
  Play,
  Pause,
  Layers,
  Filter,
  Eye,
  Zap,
  Info,
  Sparkles,
} from 'lucide-react';

export interface ThreatPoint {
  id: string;
  ip: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  threatType: 'ssh_bruteforce' | 'ddos_syn' | 'port_scan' | 'rce_exploit' | 'dns_amplification';
  severity: 'critical' | 'high' | 'medium';
  targetPort: number;
  blockedCount: number;
  timestamp: string;
  activePulse?: number; // 0 to 1 for expanding ring animation
}

interface ThreatCloud3DVisualizerProps {
  isDark?: boolean;
  onInspectThreat?: (threat: ThreatPoint) => void;
  onClose?: () => void;
}

// 25 Foyers géographiques réalistes de tentatives d'intrusion bloquées
const INITIAL_THREAT_HOTSPOTS: Omit<ThreatPoint, 'id' | 'timestamp' | 'activePulse'>[] = [
  { ip: '185.156.73.44', city: 'Moscou', country: 'Russie', lat: 55.7558, lon: 37.6173, threatType: 'ssh_bruteforce', severity: 'critical', targetPort: 22, blockedCount: 1480 },
  { ip: '118.193.41.92', city: 'Shenzhen', country: 'Chine', lat: 22.5431, lon: 114.0579, threatType: 'ddos_syn', severity: 'critical', targetPort: 443, blockedCount: 2340 },
  { ip: '54.210.134.19', city: 'Ashburn', country: 'USA', lat: 39.0438, lon: -77.4874, threatType: 'rce_exploit', severity: 'critical', targetPort: 8443, blockedCount: 890 },
  { ip: '194.26.29.112', city: 'Saint-Pétersbourg', country: 'Russie', lat: 59.9311, lon: 30.3609, threatType: 'port_scan', severity: 'high', targetPort: 51820, blockedCount: 670 },
  { ip: '14.225.205.18', city: 'Hanoï', country: 'Vietnam', lat: 21.0285, lon: 105.8542, threatType: 'ssh_bruteforce', severity: 'high', targetPort: 22, blockedCount: 1120 },
  { ip: '177.12.184.50', city: 'São Paulo', country: 'Brésil', lat: -23.5505, lon: -46.6333, threatType: 'ddos_syn', severity: 'medium', targetPort: 80, blockedCount: 540 },
  { ip: '185.220.101.5', city: 'Francfort', country: 'Allemagne', lat: 50.1109, lon: 8.6821, threatType: 'port_scan', severity: 'high', targetPort: 9001, blockedCount: 1340 },
  { ip: '193.163.125.7', city: 'Bucarest', country: 'Roumanie', lat: 44.4268, lon: 26.1025, threatType: 'rce_exploit', severity: 'critical', targetPort: 443, blockedCount: 780 },
  { ip: '211.233.77.10', city: 'Séoul', country: 'Corée du Sud', lat: 37.5665, lon: 126.978, threatType: 'dns_amplification', severity: 'medium', targetPort: 53, blockedCount: 430 },
  { ip: '103.85.24.11', city: 'Singapour', country: 'Singapour', lat: 1.3521, lon: 103.8198, threatType: 'ssh_bruteforce', severity: 'high', targetPort: 22, blockedCount: 960 },
  { ip: '185.191.171.1', city: 'Téhéran', country: 'Iran', lat: 35.6892, lon: 51.389, threatType: 'port_scan', severity: 'critical', targetPort: 1194, blockedCount: 820 },
  { ip: '102.164.21.9', city: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792, threatType: 'ssh_bruteforce', severity: 'medium', targetPort: 22, blockedCount: 390 },
  { ip: '180.149.230.1', city: 'Tokyo', country: 'Japon', lat: 35.6762, lon: 139.6503, threatType: 'ddos_syn', severity: 'high', targetPort: 443, blockedCount: 610 },
  { ip: '195.154.122.9', city: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522, threatType: 'port_scan', severity: 'medium', targetPort: 51820, blockedCount: 410 },
  { ip: '190.14.37.88', city: 'Panama City', country: 'Panama', lat: 8.9824, lon: -79.5199, threatType: 'rce_exploit', severity: 'high', targetPort: 8080, blockedCount: 320 },
  { ip: '91.240.118.15', city: 'Amsterdam', country: 'Pays-Bas', lat: 52.3676, lon: 4.9041, threatType: 'dns_amplification', severity: 'medium', targetPort: 53, blockedCount: 710 },
  { ip: '45.154.255.10', city: 'Kiev', country: 'Ukraine', lat: 50.4501, lon: 30.5234, threatType: 'ddos_syn', severity: 'critical', targetPort: 443, blockedCount: 1620 },
  { ip: '117.253.12.90', city: 'Mumbai', country: 'Inde', lat: 19.076, lon: 72.8777, threatType: 'ssh_bruteforce', severity: 'high', targetPort: 22, blockedCount: 880 },
  { ip: '196.21.112.5', city: 'Le Cap', country: 'Afrique du Sud', lat: -33.9249, lon: 18.4241, threatType: 'port_scan', severity: 'medium', targetPort: 80, blockedCount: 290 },
  { ip: '185.176.27.12', city: 'Sofia', country: 'Bulgarie', lat: 42.6977, lon: 23.3219, threatType: 'rce_exploit', severity: 'critical', targetPort: 443, blockedCount: 670 },
  { ip: '203.144.144.1', city: 'Bangkok', country: 'Thaïlande', lat: 13.7563, lon: 100.5018, threatType: 'ddos_syn', severity: 'medium', targetPort: 443, blockedCount: 450 },
  { ip: '185.244.25.10', city: 'Riga', country: 'Lettonie', lat: 56.9496, lon: 24.1052, threatType: 'port_scan', severity: 'high', targetPort: 22, blockedCount: 510 },
  { ip: '190.2.140.22', city: 'Buenos Aires', country: 'Argentine', lat: -34.6037, lon: -58.3816, threatType: 'ssh_bruteforce', severity: 'medium', targetPort: 22, blockedCount: 360 },
  { ip: '194.38.20.14', city: 'Varsovie', country: 'Pologne', lat: 52.2297, lon: 21.0122, threatType: 'rce_exploit', severity: 'high', targetPort: 8443, blockedCount: 590 },
  { ip: '104.244.42.1', city: 'San Francisco', country: 'USA', lat: 37.7749, lon: -122.4194, threatType: 'dns_amplification', severity: 'critical', targetPort: 53, blockedCount: 1410 },
];

export const ThreatCloud3DVisualizer: React.FC<ThreatCloud3DVisualizerProps> = ({
  isDark = true,
  onInspectThreat,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [threats, setThreats] = useState<ThreatPoint[]>(() =>
    INITIAL_THREAT_HOTSPOTS.map((h, i) => ({
      ...h,
      id: `threat-${i + 1}`,
      timestamp: new Date(Date.now() - i * 180000).toISOString(),
      activePulse: (i * 0.15) % 1,
    }))
  );

  const [filterType, setFilterType] = useState<string>('all');
  const [isRotating, setIsRotating] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [hoveredThreat, setHoveredThreat] = useState<ThreatPoint | null>(null);

  // Rotation angles in radians
  const rotationRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0.4, pitch: -0.2 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Stream in new blocked attempts continuously
  useEffect(() => {
    const interval = setInterval(() => {
      const randomHotspot =
        INITIAL_THREAT_HOTSPOTS[Math.floor(Math.random() * INITIAL_THREAT_HOTSPOTS.length)];

      const newThreat: ThreatPoint = {
        ...randomHotspot,
        id: `threat-live-${Date.now()}`,
        blockedCount: randomHotspot.blockedCount + Math.floor(Math.random() * 5 + 1),
        timestamp: new Date().toISOString(),
        activePulse: 0.05,
      };

      setThreats((prev) => [newThreat, ...prev.slice(0, 40)]);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  // Filtered threats
  const filteredThreats = useMemo(() => {
    if (filterType === 'all') return threats;
    if (filterType === 'critical') return threats.filter((t) => t.severity === 'critical');
    return threats.filter((t) => t.threatType === filterType);
  }, [threats, filterType]);

  // Aggregated Threat Metrics
  const totalBlocked = useMemo(
    () => threats.reduce((acc, t) => acc + t.blockedCount, 0),
    [threats]
  );
  const criticalCount = useMemo(
    () => threats.filter((t) => t.severity === 'critical').length,
    [threats]
  );

  // 3D Spherical projection and canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.38 * zoomLevel;

      // Auto-rotation when enabled and not dragging
      if (isRotating && !isDraggingRef.current) {
        rotationRef.current.yaw += 0.004;
      }

      const { yaw, pitch } = rotationRef.current;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // 1. Draw glowing 3D atmosphere / halo
      const radialGlow = ctx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.8,
        cx,
        cy,
        baseRadius * 1.3
      );
      radialGlow.addColorStop(0, isDark ? 'rgba(6, 182, 212, 0.08)' : 'rgba(6, 182, 212, 0.05)');
      radialGlow.addColorStop(0.5, isDark ? 'rgba(239, 68, 68, 0.04)' : 'rgba(239, 68, 68, 0.02)');
      radialGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw 3D Globe Sphere Base
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#020617' : '#f8fafc';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(203, 213, 225, 0.8)';
      ctx.stroke();

      // 3. Draw 3D Lat/Lon Wireframe Graticule Lines (3D spherical circles)
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(226, 232, 240, 0.8)';

      // Latitude rings (-60, -30, 0, 30, 60 degrees)
      const latAngles = [-60, -30, 0, 30, 60];
      latAngles.forEach((latDeg) => {
        const phi = (latDeg * Math.PI) / 180;
        const ringRadius = baseRadius * Math.cos(phi);
        const yOffset = -baseRadius * Math.sin(phi);

        // Project latitude circle under 3D pitch rotation
        ctx.beginPath();
        for (let a = 0; a <= 360; a += 8) {
          const theta = (a * Math.PI) / 180 + yaw;
          const x0 = ringRadius * Math.sin(theta);
          const z0 = ringRadius * Math.cos(theta);
          const y0 = yOffset;

          // Pitch rotation
          const y1 = y0 * Math.cos(pitch) - z0 * Math.sin(pitch);
          const z1 = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);

          const screenX = cx + x0;
          const screenY = cy + y1;

          if (a === 0) {
            ctx.moveTo(screenX, screenY);
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }
        ctx.stroke();
      });

      // Longitude rings (every 45 degrees)
      for (let lonDeg = 0; lonDeg < 180; lonDeg += 45) {
        const baseLon = (lonDeg * Math.PI) / 180 + yaw;
        ctx.beginPath();
        for (let l = 0; l <= 360; l += 8) {
          const latRad = (l * Math.PI) / 180;
          const x0 = baseRadius * Math.cos(latRad) * Math.sin(baseLon);
          const z0 = baseRadius * Math.cos(latRad) * Math.cos(baseLon);
          const y0 = -baseRadius * Math.sin(latRad);

          // Pitch rotation
          const y1 = y0 * Math.cos(pitch) - z0 * Math.sin(pitch);
          const screenX = cx + x0;
          const screenY = cy + y1;

          if (l === 0) ctx.moveTo(screenX, screenY);
          else ctx.lineTo(screenX, screenY);
        }
        ctx.stroke();
      }

      // 4. Project and sort 3D Threat Points with Z-Buffering
      interface ProjectedPoint {
        threat: ThreatPoint;
        sx: number;
        sy: number;
        z: number;
        radius: number;
        color: string;
        glowColor: string;
      }

      const projected: ProjectedPoint[] = [];

      filteredThreats.forEach((t) => {
        // Spherical coordinate math
        const latRad = (t.lat * Math.PI) / 180;
        const lonRad = (t.lon * Math.PI) / 180;

        // Cartesian 3D coordinates
        const x = baseRadius * Math.cos(latRad) * Math.sin(lonRad + yaw);
        const yInitial = -baseRadius * Math.sin(latRad);
        const zInitial = baseRadius * Math.cos(latRad) * Math.cos(lonRad + yaw);

        // Pitch tilt
        const y = yInitial * Math.cos(pitch) - zInitial * Math.sin(pitch);
        const z = yInitial * Math.sin(pitch) + zInitial * Math.cos(pitch);

        const sx = cx + x;
        const sy = cy + y;

        // Color coding by severity and vector
        let color = '#06b6d4'; // Cyan port scan
        let glowColor = 'rgba(6, 182, 212, 0.4)';
        if (t.severity === 'critical') {
          color = '#ef4444'; // Red critical
          glowColor = 'rgba(239, 68, 68, 0.5)';
        } else if (t.threatType === 'ddos_syn') {
          color = '#f59e0b'; // Amber DDoS
          glowColor = 'rgba(245, 158, 11, 0.4)';
        } else if (t.threatType === 'rce_exploit') {
          color = '#a855f7'; // Purple RCE
          glowColor = 'rgba(168, 85, 247, 0.4)';
        }

        // Relative point radius scaled with blocked volume
        const pointSize = Math.max(3.5, Math.min(9.5, 3 + Math.log10(t.blockedCount) * 1.8));

        projected.push({
          threat: t,
          sx,
          sy,
          z,
          radius: pointSize,
          color,
          glowColor,
        });
      });

      // Sort back-to-front (lowest z drawn first)
      projected.sort((a, b) => a.z - b.z);

      // Render back-side points (dimmed, translucent)
      projected.forEach((p) => {
        if (p.z <= 0) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.radius * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.15)';
          ctx.fill();
        }
      });

      // Render front-side points (bright, pulsating, glowing 3D spheres)
      projected.forEach((p) => {
        if (p.z > 0) {
          const depthScale = 0.85 + (p.z / baseRadius) * 0.35;
          const r = p.radius * depthScale;

          // Glowing pulse ring
          const pulse = (Date.now() / 1000 + p.threat.lat * 0.1) % 1;
          const ringRadius = r + pulse * 14;
          const ringAlpha = Math.max(0, 1 - pulse) * 0.6;

          ctx.beginPath();
          ctx.arc(p.sx, p.sy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = p.glowColor.replace(/[\d.]+\)$/g, `${ringAlpha})`);
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Outer glow
          const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 2.2);
          glow.addColorStop(0, p.color);
          glow.addColorStop(0.7, p.glowColor);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 2.2, 0, Math.PI * 2);
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // City text label on hover or if critical
          if (p.threat.severity === 'critical' || hoveredThreat?.id === p.threat.id) {
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
            ctx.fillText(`${p.threat.city} (${p.threat.blockedCount})`, p.sx + 9, p.sy + 3);
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [filteredThreats, isDark, isRotating, zoomLevel, hoveredThreat]);

  // Mouse interaction handlers for 3D orbital drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) {
      // Check hover
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const baseRadius = Math.min(rect.width, rect.height) * 0.38 * zoomLevel;
      const { yaw, pitch } = rotationRef.current;

      const found = filteredThreats.find((t) => {
        const latRad = (t.lat * Math.PI) / 180;
        const lonRad = (t.lon * Math.PI) / 180;
        const x = baseRadius * Math.cos(latRad) * Math.sin(lonRad + yaw);
        const yInitial = -baseRadius * Math.sin(latRad);
        const zInitial = baseRadius * Math.cos(latRad) * Math.cos(lonRad + yaw);
        const y = yInitial * Math.cos(pitch) - zInitial * Math.sin(pitch);
        const z = yInitial * Math.sin(pitch) + zInitial * Math.cos(pitch);

        if (z <= 0) return false;
        const sx = cx + x;
        const sy = cy + y;
        const dist = Math.hypot(mouseX - sx, mouseY - sy);
        return dist <= 12;
      });

      setHoveredThreat(found || null);
      return;
    }

    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;

    rotationRef.current.yaw += deltaX * 0.008;
    rotationRef.current.pitch = Math.max(
      -Math.PI / 2.3,
      Math.min(Math.PI / 2.3, rotationRef.current.pitch + deltaY * 0.008)
    );

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleResetRotation = () => {
    rotationRef.current = { yaw: 0.4, pitch: -0.2 };
    setZoomLevel(1.0);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs transition-colors">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-red-500/20 to-purple-500/20 text-red-500 border border-red-500/30">
            <Globe className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Nuage de Points 3D · Densité Géographique des Intrusions Bloquées</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25">
                Temps Réel D3 Sphérique
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Projection tridimensionnelle des attaques bloquées par l'eBPF XDP et le pare-feu Sentinelle IDS. Faites glisser pour pivoter.
            </p>
          </div>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRotating(!isRotating)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isRotating
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold'
            }`}
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRotating ? 'Pause rotation' : 'Reprendre'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetRotation}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Réinitialiser vue 3D"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold px-2 py-1 cursor-pointer"
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Canvas View & Side Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
        {/* 3D Canvas Container */}
        <div className="lg:col-span-3 relative bg-slate-950 rounded-2xl border border-slate-800 p-2 overflow-hidden flex items-center justify-center min-h-[380px]">
          <canvas
            ref={canvasRef}
            width={720}
            height={400}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-[380px] block cursor-grab active:cursor-grabbing select-none"
          />

          {/* Interactive Floating Tooltip */}
          {hoveredThreat && (
            <div className="absolute top-4 left-4 p-3 rounded-xl bg-slate-900/95 border border-cyan-500/40 text-white text-xs space-y-1 shadow-2xl backdrop-blur-md pointer-events-none font-mono">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                <span>{hoveredThreat.city}, {hoveredThreat.country}</span>
              </div>
              <div className="text-[11px] text-cyan-400">IP : {hoveredThreat.ip} (Port {hoveredThreat.targetPort})</div>
              <div className="text-[10px] text-slate-400">
                Vecteur : <strong>{hoveredThreat.threatType}</strong> · Bloqués : <strong>{hoveredThreat.blockedCount}</strong>
              </div>
            </div>
          )}

          {/* Canvas Bottom Legend Bar */}
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800/80 backdrop-blur-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <span>Critique (Force Brute / RCE)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>SYN Flood (DDoS)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                <span>Scan eBPF (Port/ICMP)</span>
              </span>
            </div>
            <div>
              <span>Glissez la sphère pour pivoter à 360°</span>
            </div>
          </div>
        </div>

        {/* Right Side Stats & Filter Column */}
        <div className="space-y-3 font-sans">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Métriques d'Intrusions</span>
              <Activity className="w-4 h-4 text-cyan-500" />
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">Tentatives Bloquées :</span>
                <span className="font-bold text-slate-900 dark:text-white">{totalBlocked.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">Foyers Critiques :</span>
                <span className="font-bold text-red-500">{criticalCount} foyers</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">Taux de Blocage eBPF :</span>
                <span className="font-bold text-emerald-500">100.0%</span>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500">Filtrer par vecteur :</div>
              <div className="grid grid-cols-1 gap-1 text-[11px] font-medium">
                {[
                  { id: 'all', label: 'Tous les vecteurs' },
                  { id: 'critical', label: 'Menaces critiques uniquement' },
                  { id: 'ssh_bruteforce', label: 'Force Brute SSH (Port 22)' },
                  { id: 'ddos_syn', label: 'SYN Flood DDoS' },
                  { id: 'port_scan', label: 'Balayage Netfilter eBPF' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterType(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                      filterType === f.id
                        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold'
                        : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>Échelle 3D :</span>
                <span>{(zoomLevel * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.4"
                step="0.05"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
