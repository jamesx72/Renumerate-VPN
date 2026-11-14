import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Camera,
  CameraOff,
  Compass,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Power,
  RotateCcw,
  ShieldCheck,
  ArrowDown,
  ArrowUp,
  Layers,
  Download,
} from 'lucide-react';
import { AppSettings, ConnectionMode, DeviceNode, VirtualIdentity } from '../types';
import { getNodeLonLat, LOCAL_ORIGIN, computeGeodesicDistanceKm } from './WorldNodeMap';
import { isNodeBlockedByGeoFence } from '../constants';

export interface CockpitArOverlayProps {
  nodes: DeviceNode[];
  currentIdentity: VirtualIdentity;
  isConnected: boolean;
  mode: ConnectionMode;
  settings: AppSettings;
  throughput: { up: number; down: number };
  onConnectNode: (nodeId: string) => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

interface ArNodeRecord {
  node: DeviceNode;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  satellite: THREE.Mesh;
  hitMesh: THREE.Mesh;
  sprite: THREE.Sprite;
  basePos: THREE.Vector3;
  isActive: boolean;
  isBlocked: boolean;
  phaseOffset: number;
}

interface ArPulseRecord {
  curve: THREE.QuadraticBezierCurve3;
  mesh: THREE.Mesh;
  speed: number;
  offset: number;
  isUplink: boolean;
}

// Pre-allocated scratch helpers (zero GC inside animation loop)
const _scratchPointer = new THREE.Vector2();
const _scratchVec = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();

function createNodeLabelTexture(
  city: string,
  country: string,
  latency: number,
  isActive: boolean,
  isBlocked: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const borderColor = isBlocked
      ? '#f43f5e'
      : isActive
        ? '#10b981'
        : '#38bdf8';
    const bgFill = isActive
      ? 'rgba(6, 78, 59, 0.88)'
      : isBlocked
        ? 'rgba(76, 5, 25, 0.86)'
        : 'rgba(15, 23, 42, 0.86)';

    // Rounded HUD tag card
    const r = 18;
    const w = canvas.width - 12;
    const h = canvas.height - 16;
    ctx.beginPath();
    ctx.roundRect(6, 6, w, h, r);
    ctx.fillStyle = bgFill;
    ctx.fill();
    ctx.lineWidth = isActive ? 3.5 : 2;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Accent bar on top-left corner
    ctx.fillStyle = borderColor;
    ctx.fillRect(22, 22, 6, 52);

    // City + Country
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 26px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(city.slice(0, 18), 40, 44);

    // Latency + Country
    ctx.fillStyle = isActive ? '#6ee7b7' : isBlocked ? '#fda4af' : '#94a3b8';
    ctx.font = '600 20px ui-monospace, SFMono-Regular, monospace';
    const statusText = isBlocked
      ? `${country.slice(0, 10)} · BLOQUÉ`
      : isActive
        ? `${latency} ms · ACTIF`
        : `${country.slice(0, 11)} · ${latency} ms`;
    ctx.fillText(statusText, 40, 76);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        const anyM = m as THREE.MeshStandardMaterial & { map?: THREE.Texture | null };
        if (anyM.map) anyM.map.dispose();
        m.dispose();
      });
    } else if (mat) {
      const anyM = mat as THREE.MeshStandardMaterial & { map?: THREE.Texture | null };
      if (anyM.map) anyM.map.dispose();
      mat.dispose();
    }
  });
}

export const CockpitArOverlay: React.FC<CockpitArOverlayProps> = ({
  nodes,
  currentIdentity,
  isConnected,
  mode,
  settings,
  throughput,
  onConnectNode,
  addLog,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showHud, setShowHud] = useState(true);
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [webglFallback, setWebglFallback] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => nodes.find((n) => n.ip === currentIdentity.ip)?.id || nodes[0]?.id || null
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Sync active node selection when IP switches
  useEffect(() => {
    const matched = nodes.find((n) => n.ip === currentIdentity.ip);
    if (matched) {
      setSelectedNodeId((prev) => prev || matched.id);
    }
  }, [currentIdentity.ip, nodes]);

  const selectedNode = useMemo(
    () =>
      nodes.find((n) => n.id === selectedNodeId) ||
      nodes.find((n) => n.ip === currentIdentity.ip) ||
      nodes[0] ||
      null,
    [nodes, selectedNodeId, currentIdentity.ip]
  );

  // Refs shared with Three.js loop without rebuilding WebGL context
  const throughputRef = useRef(throughput);
  throughputRef.current = throughput;
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const hoveredNodeIdRef = useRef(hoveredNodeId);
  hoveredNodeIdRef.current = hoveredNodeId;
  const gyroOffsetRef = useRef({ yaw: 0, pitch: 0 });
  const gyroEnabledRef = useRef(gyroEnabled);
  gyroEnabledRef.current = gyroEnabled;
  const resetViewFnRef = useRef<(() => void) | null>(null);
  const captureSnapshotFnRef = useRef<(() => void) | null>(null);

  const selectedNodeSpatial = useMemo(() => {
    if (!selectedNode) return null;
    const [lon, lat] = getNodeLonLat(selectedNode);
    const distKm = computeGeodesicDistanceKm(LOCAL_ORIGIN, [lon, lat]);
    const yRad = Math.sin(THREE.MathUtils.degToRad(lon - LOCAL_ORIGIN[0])) * Math.cos(THREE.MathUtils.degToRad(lat));
    const xRad =
      Math.cos(THREE.MathUtils.degToRad(LOCAL_ORIGIN[1])) * Math.sin(THREE.MathUtils.degToRad(lat)) -
      Math.sin(THREE.MathUtils.degToRad(LOCAL_ORIGIN[1])) *
        Math.cos(THREE.MathUtils.degToRad(lat)) *
        Math.cos(THREE.MathUtils.degToRad(lon - LOCAL_ORIGIN[0]));
    const bearingDeg = Math.round(((THREE.MathUtils.radToDeg(Math.atan2(yRad, xRad)) % 360) + 360) % 360);
    return { distKm, bearingDeg };
  }, [selectedNode]);

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCameraStream = useCallback(
    async (requestedFacing: 'environment' | 'user') => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          'API Caméra WebRTC indisponible dans ce navigateur. Projection spatiale 3D maintenue en mode HUD optique.'
        );
        setCameraActive(false);
        return;
      }

      setCameraPending(true);
      setCameraError(null);
      stopCameraStream();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: requestedFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
        addLog?.(
          `Superposition AR caméra activée (${
            requestedFacing === 'environment' ? 'caméra arrière' : 'caméra frontale'
          })`,
          'success'
        );
      } catch (err) {
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Accès caméra refusé par l’utilisateur. Mode spatial AR sans caméra actif.'
            : 'Aucune caméra physique détectée ou flux verrouillé. Mode spatial AR sans caméra actif.';
        setCameraError(msg);
        setCameraActive(false);
        addLog?.('Caméra AR indisponible — bascule sur horizon spatial 3D', 'info');
      } finally {
        setCameraPending(false);
      }
    },
    [stopCameraStream, addLog]
  );

  // Stop camera cleanly on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // Optional DeviceOrientation gyroscope tracking
  useEffect(() => {
    if (!gyroEnabled) {
      gyroOffsetRef.current = { yaw: 0, pitch: 0 };
      return;
    }
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = typeof e.beta === 'number' ? e.beta : 45;
      const gamma = typeof e.gamma === 'number' ? e.gamma : 0;
      gyroOffsetRef.current = {
        yaw: THREE.MathUtils.clamp((gamma / 45) * 0.45, -0.6, 0.6),
        pitch: THREE.MathUtils.clamp(((beta - 45) / 45) * 0.3, -0.4, 0.4),
      };
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [gyroEnabled]);

  const displayedNodes = useMemo(() => {
    if (!activeOnlyFilter) return nodes;
    return nodes.filter(
      (n) => n.ip === currentIdentity.ip || n.status === 'active'
    );
  }, [nodes, activeOnlyFilter, currentIdentity.ip]);

  // Main Three.js Transparent AR WebGL Scene
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(360, container.clientHeight);

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(
        'Le contexte WebGL 3D est indisponible sur cet environnement.'
      );
      return;
    }

    setWebglFallback(null);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Procedural Studio Reflection Environment for crisp metallic 3D icons
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 60);
    camera.position.set(0, 1.35, 5.1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 9.5;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.target.set(0, 0.35, -1.6);
    controls.update();

    resetViewFnRef.current = () => {
      camera.position.set(0, 1.35, 5.1);
      controls.target.set(0, 0.35, -1.6);
      controls.update();
    };

    captureSnapshotFnRef.current = () => {
      const w = renderer.domElement.width || 1280;
      const h = renderer.domElement.height || 720;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');
      if (!ctx) return;

      // Render fresh frame right before reading drawing buffer
      renderer.render(scene, camera);

      const vid = videoRef.current;
      if (vid && vid.srcObject && vid.readyState >= 2 && vid.videoWidth > 0) {
        const vidAspect = vid.videoWidth / vid.videoHeight;
        const outAspect = w / h;
        let sx = 0;
        let sy = 0;
        let sw = vid.videoWidth;
        let sh = vid.videoHeight;
        if (vidAspect > outAspect) {
          sw = vid.videoHeight * outAspect;
          sx = (vid.videoWidth - sw) / 2;
        } else {
          sh = vid.videoWidth / outAspect;
          sy = (vid.videoHeight - sh) / 2;
        }
        ctx.drawImage(vid, sx, sy, sw, sh, 0, 0, w, h);
      } else {
        const bgGrad = ctx.createRadialGradient(w / 2, h * 0.38, 20, w / 2, h * 0.45, Math.max(w, h) * 0.7);
        bgGrad.addColorStop(0, '#083344');
        bgGrad.addColorStop(1, '#020617');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(renderer.domElement, 0, 0, w, h);
      const dataUrl = out.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `renumerate-ar-capture-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addLog?.('Capture photo Réalité Augmentée 3D exportée (PNG)', 'success');
    };

    // Warm/cool studio rig (matches threejs/SKILL.md)
    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 1.15);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.4);
    rimLight.position.set(-5, 3, -6);
    scene.add(rimLight);

    // Master AR spatial group anchored in front of the camera feed
    const arWorldGroup = new THREE.Group();
    scene.add(arWorldGroup);

    // Subtle AR horizon reference rings (transparent floor plane radar)
    const horizonGroup = new THREE.Group();
    horizonGroup.position.set(0, -1.05, -1.4);
    arWorldGroup.add(horizonGroup);

    [1.6, 3.0, 4.4].forEach((radius, idx) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.012, radius + 0.012, 72);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0x10b981 : 0x06b6d4,
        transparent: true,
        opacity: idx === 0 ? 0.38 : 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      horizonGroup.add(new THREE.Mesh(ringGeo, ringMat));
    });

    // Azimuthal AR Radar Sweep Wedge
    const sweepGeo = new THREE.CircleGeometry(4.4, 32, 0, Math.PI / 5);
    sweepGeo.rotateX(-Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const radarSweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
    radarSweepMesh.position.y = 0.005;
    horizonGroup.add(radarSweepMesh);

    // Local User Origin Composite 3D Beacon ("VOUS / TUNNEL LOCAL")
    const originPos = new THREE.Vector3(0, -0.55, 0.35);
    const originGroup = new THREE.Group();
    originGroup.position.copy(originPos);
    arWorldGroup.add(originGroup);

    const originCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({
        color: isConnected ? 0x10b981 : 0x64748b,
        emissive: isConnected ? 0x059669 : 0x1e293b,
        emissiveIntensity: 0.75,
        metalness: 0.72,
        roughness: 0.22,
      })
    );
    originGroup.add(originCore);

    const originRingA = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.022, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        metalness: 0.85,
        roughness: 0.18,
      })
    );
    originRingA.rotation.x = Math.PI / 2.4;
    originGroup.add(originRingA);

    const originRingB = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.014, 10, 48),
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        metalness: 0.7,
        roughness: 0.3,
        transparent: true,
        opacity: 0.7,
      })
    );
    originRingB.rotation.y = Math.PI / 3;
    originGroup.add(originRingB);

    const originPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.18, 0.45, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.45,
        roughness: 0.65,
        transparent: true,
        opacity: 0.8,
      })
    );
    originPedestal.position.y = -0.3;
    originGroup.add(originPedestal);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Build Composite 3D Floating Icons for each VPN Node projected in front hemisphere
    const nodeRecords: ArNodeRecord[] = [];
    const hitMeshes: THREE.Mesh[] = [];
    const pulseRecords: ArPulseRecord[] = [];

    const totalNodes = Math.max(1, displayedNodes.length);

    displayedNodes.forEach((node, index) => {
      const isActive = node.ip === currentIdentity.ip;
      const isBlocked = isNodeBlockedByGeoFence(node.country, settings);
      const [lon, lat] = getNodeLonLat(node);

      // Map geographic bearing & distance into ergonomic AR room space in front of user
      const dLon = (lon - LOCAL_ORIGIN[0]) * 0.022;
      const spreadAngle =
        totalNodes > 1
          ? THREE.MathUtils.lerp(-1.22, 1.22, index / (totalNodes - 1))
          : 0;
      const azimuth = THREE.MathUtils.clamp(
        spreadAngle * 0.72 + dLon * 0.28,
        -1.35,
        1.35
      );
      const distKm = computeGeodesicDistanceKm(LOCAL_ORIGIN, [lon, lat]);
      const radialDist = isActive
        ? 2.85
        : THREE.MathUtils.clamp(2.65 + (distKm / 12000) * 2.1, 2.5, 4.9);

      const x = Math.sin(azimuth) * radialDist * 1.18;
      const z = -Math.cos(azimuth) * radialDist * 0.92 - 0.55;
      const y =
        (isActive ? 0.85 : 0.15 + ((index % 3) - 1) * 0.42) +
        THREE.MathUtils.clamp((lat - 30) / 85, -0.35, 0.55);

      const basePos = new THREE.Vector3(x, y, z);

      // Composite 5-part 3D Holographic Beacon Group
      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(basePos);
      arWorldGroup.add(nodeGroup);

      const primaryColor = isBlocked
        ? 0xf43f5e
        : isActive
          ? 0x10b981
          : node.status === 'active'
            ? 0x06b6d4
            : 0xf59e0b;

      const coreGeo = isActive
        ? new THREE.OctahedronGeometry(0.27, 0)
        : new THREE.DodecahedronGeometry(0.21, 0);
      const coreMat = new THREE.MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryColor,
        emissiveIntensity: isActive ? 0.65 : 0.35,
        metalness: 0.78,
        roughness: 0.18,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      nodeGroup.add(coreMesh);

      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(isActive ? 0.42 : 0.33, 0.018, 10, 40),
        new THREE.MeshStandardMaterial({
          color: isActive ? 0x6ee7b7 : 0x7dd3fc,
          metalness: 0.85,
          roughness: 0.22,
        })
      );
      outerRing.rotation.x = Math.PI * 0.35;
      nodeGroup.add(outerRing);

      const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(isActive ? 0.34 : 0.27, 0.012, 8, 36),
        new THREE.MeshStandardMaterial({
          color: primaryColor,
          metalness: 0.55,
          roughness: 0.45,
          transparent: true,
          opacity: 0.85,
        })
      );
      innerRing.rotation.y = Math.PI * 0.42;
      nodeGroup.add(innerRing);

      const satellite = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.065, 0),
        new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          emissive: primaryColor,
          emissiveIntensity: 0.5,
          metalness: 0.9,
          roughness: 0.15,
        })
      );
      satellite.position.set(isActive ? 0.44 : 0.35, 0.12, 0);
      nodeGroup.add(satellite);

      // Vertical AR projection stem down to horizon floor
      const stemHeight = Math.max(0.2, basePos.y - -1.05);
      const stemMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, stemHeight, 8),
        new THREE.MeshBasicMaterial({
          color: primaryColor,
          transparent: true,
          opacity: isActive ? 0.55 : 0.22,
        })
      );
      stemMesh.position.y = -stemHeight / 2;
      nodeGroup.add(stemMesh);

      const floorTargetRing = new THREE.Mesh(
        new THREE.RingGeometry(0.16, 0.21, 32),
        new THREE.MeshBasicMaterial({
          color: primaryColor,
          transparent: true,
          opacity: isActive ? 0.7 : 0.3,
          side: THREE.DoubleSide,
        })
      );
      floorTargetRing.rotation.x = -Math.PI / 2;
      floorTargetRing.position.y = -stemHeight;
      nodeGroup.add(floorTargetRing);

      // Procedural 3D Floating Label Sprite
      const labelTex = createNodeLabelTexture(
        node.city || node.name,
        node.country,
        node.latency,
        isActive,
        isBlocked,
        maxAniso
      );
      const spriteMat = new THREE.SpriteMaterial({
        map: labelTex,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, isActive ? 0.68 : 0.56, 0);
      sprite.scale.set(isActive ? 1.48 : 1.24, isActive ? 0.44 : 0.36, 1);
      nodeGroup.add(sprite);

      // Invisible Raycast Hit Sphere on Layer 1
      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.layers.set(1);
      hitMesh.userData = { nodeId: node.id };
      nodeGroup.add(hitMesh);
      hitMeshes.push(hitMesh);

      nodeRecords.push({
        node,
        group: nodeGroup,
        coreMesh,
        outerRing,
        innerRing,
        satellite,
        hitMesh,
        sprite,
        basePos,
        isActive,
        isBlocked,
        phaseOffset: index * 0.85,
      });

      // Build 3D Tunnel Flow Arc from Local Origin to Node
      if (isActive || (!isBlocked && node.status === 'active')) {
        const midPoint = new THREE.Vector3()
          .addVectors(originPos, basePos)
          .multiplyScalar(0.5);
        midPoint.y += isActive ? 0.85 : 0.48;

        const curve = new THREE.QuadraticBezierCurve3(
          originPos.clone(),
          midPoint,
          basePos.clone()
        );

        const tubeGeo = new THREE.TubeGeometry(
          curve,
          36,
          isActive ? 0.024 : 0.011,
          8,
          false
        );
        const tubeMat = new THREE.MeshBasicMaterial({
          color: isActive
            ? mode === ConnectionMode.ONION_VORTEX
              ? 0xa855f7
              : 0x10b981
            : 0x38bdf8,
          transparent: true,
          opacity: isActive ? 0.78 : 0.24,
        });
        arWorldGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

        // Animated 3D Data Packet Pulses (RX & TX) along curve
        const pulseCount = isActive ? 5 : 2;
        for (let p = 0; p < pulseCount; p++) {
          const isUplink = p % 2 === 1;
          const pulseGeo = isUplink
            ? new THREE.OctahedronGeometry(isActive ? 0.068 : 0.042, 0)
            : new THREE.SphereGeometry(isActive ? 0.062 : 0.038, 10, 10);
          const pulseMat = new THREE.MeshBasicMaterial({
            color: isUplink ? 0xc084fc : 0x22d3ee,
          });
          const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
          arWorldGroup.add(pulseMesh);
          pulseRecords.push({
            curve,
            mesh: pulseMesh,
            speed: isActive ? 0.42 + p * 0.05 : 0.22 + p * 0.04,
            offset: p / pulseCount,
            isUplink,
          });
        }
      }
    });

    // Multi-Hop Inter-Node AR Relay Links for DOUBLE_HOP / ONION_VORTEX
    const activeRecord = nodeRecords.find((r) => r.isActive);
    const eligibleRelays = nodeRecords.filter(
      (r) => !r.isActive && !r.isBlocked && r.node.status === 'active'
    );
    if (
      activeRecord &&
      eligibleRelays.length > 0 &&
      (mode === ConnectionMode.DOUBLE_HOP || mode === ConnectionMode.ONION_VORTEX)
    ) {
      const chainCount = mode === ConnectionMode.ONION_VORTEX ? 2 : 1;
      const chainNodes = [
        ...eligibleRelays.slice(0, chainCount),
        activeRecord,
      ];
      for (let h = 0; h < chainNodes.length - 1; h++) {
        const fromPos = chainNodes[h].basePos;
        const toPos = chainNodes[h + 1].basePos;
        const hopMid = new THREE.Vector3()
          .addVectors(fromPos, toPos)
          .multiplyScalar(0.5);
        hopMid.y += 0.65;
        const hopCurve = new THREE.QuadraticBezierCurve3(
          fromPos.clone(),
          hopMid,
          toPos.clone()
        );
        const hopTube = new THREE.Mesh(
          new THREE.TubeGeometry(hopCurve, 28, 0.018, 8, false),
          new THREE.MeshBasicMaterial({
            color: mode === ConnectionMode.ONION_VORTEX ? 0xc084fc : 0x34d399,
            transparent: true,
            opacity: 0.72,
          })
        );
        arWorldGroup.add(hopTube);

        for (let p = 0; p < 3; p++) {
          const hopPulse = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.055, 0),
            new THREE.MeshBasicMaterial({
              color: mode === ConnectionMode.ONION_VORTEX ? 0xe879f9 : 0x6ee7b7,
            })
          );
          arWorldGroup.add(hopPulse);
          pulseRecords.push({
            curve: hopCurve,
            mesh: hopPulse,
            speed: 0.48 + p * 0.06,
            offset: p / 3,
            isUplink: true,
          });
        }
      }
    }

    // Raycaster strictly on Layer 1 for crisp 60fps picking
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    let lastHoverTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _scratchPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _scratchPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 50) return;
      lastHoverTime = now;
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_scratchPointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      const hitId = (hits[0]?.object?.userData?.nodeId as string) || null;
      setHoveredNodeId(hitId);
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist > 6) return; // Was a camera drag, not click
      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_scratchPointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      const hitId = hits[0]?.object?.userData?.nodeId as string | undefined;
      if (hitId) {
        setSelectedNodeId(hitId);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(360, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(handleResize)
        : null;
    resizeObserver?.observe(container);

    // Pre-compile shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let isDisposed = false;
    let prevTime = performance.now();
    let elapsed = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (isDisposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const dt = Math.min(0.08, (now - prevTime) / 1000);
      prevTime = now;
      elapsed += dt;

      const curThroughput = throughputRef.current;
      const flowActivity = isConnectedRef.current
        ? Math.min(2.2, 0.35 + curThroughput.down / 38 + curThroughput.up / 3.2)
        : 0.15;

      // Damped gyroscope spatial parallax
      const targetYaw = gyroEnabledRef.current ? gyroOffsetRef.current.yaw : 0;
      const targetPitch = gyroEnabledRef.current ? gyroOffsetRef.current.pitch : 0;
      arWorldGroup.rotation.y = THREE.MathUtils.damp(
        arWorldGroup.rotation.y,
        targetYaw,
        6,
        dt
      );
      arWorldGroup.rotation.x = THREE.MathUtils.damp(
        arWorldGroup.rotation.x,
        targetPitch,
        6,
        dt
      );

      // Animate Local Origin Core
      originCore.rotation.y += dt * (0.65 + flowActivity * 0.45);
      originCore.rotation.x += dt * 0.3;
      originRingA.rotation.z -= dt * (0.9 + flowActivity * 0.6);
      originRingB.rotation.x += dt * 0.7;

      // Animate Composite 3D Floating Node Icons
      const curSelected = selectedNodeIdRef.current;
      const curHovered = hoveredNodeIdRef.current;

      for (let i = 0; i < nodeRecords.length; i++) {
        const rec = nodeRecords[i];
        const bob = Math.sin(elapsed * 1.65 + rec.phaseOffset) * 0.08;
        rec.group.position.set(
          rec.basePos.x,
          rec.basePos.y + bob,
          rec.basePos.z
        );

        const spinRate = rec.isActive ? 1.15 : 0.55;
        rec.coreMesh.rotation.y += dt * spinRate;
        rec.outerRing.rotation.z += dt * spinRate * 0.85;
        rec.innerRing.rotation.x -= dt * spinRate * 1.1;

        // Orbiting micro-satellite pin
        const satAngle = elapsed * (1.8 + i * 0.15) + rec.phaseOffset;
        const satRadius = rec.isActive ? 0.46 : 0.36;
        rec.satellite.position.set(
          Math.cos(satAngle) * satRadius,
          Math.sin(satAngle * 1.3) * 0.14,
          Math.sin(satAngle) * satRadius
        );

        const isHighlighted =
          rec.node.id === curSelected || rec.node.id === curHovered;
        const targetScale = isHighlighted ? 1.18 : 1.0;
        const nextScale = THREE.MathUtils.damp(
          rec.coreMesh.scale.x,
          targetScale,
          10,
          dt
        );
        rec.coreMesh.scale.setScalar(nextScale);
      }

      // Animate 3D Data Packet Pulses along Bezier Tunnel Curves
      for (let i = 0; i < pulseRecords.length; i++) {
        const pulse = pulseRecords[i];
        pulse.mesh.visible = isConnectedRef.current;
        if (!isConnectedRef.current) continue;

        const dir = pulse.isUplink ? 1 : -1;
        const rawT =
          (pulse.offset + elapsed * pulse.speed * flowActivity * dir) % 1;
        const t = rawT < 0 ? rawT + 1 : rawT;
        pulse.curve.getPoint(t, _scratchVec);
        pulse.mesh.position.copy(_scratchVec);
        _scratchEuler.set(elapsed * 2, elapsed * 3, 0);
        pulse.mesh.rotation.copy(_scratchEuler);
      }

      // Rotate floor horizon radar sweep
      radarSweepMesh.rotation.y -= dt * (0.45 + flowActivity * 0.35);

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      frameId = window.setTimeout(tick, 16);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      envTarget.dispose();
      disposeObject3D(scene);
      renderer.dispose();
      captureSnapshotFnRef.current = null;
      resetViewFnRef.current = null;
      container.innerHTML = '';
    };
  }, [displayedNodes, currentIdentity.ip, isConnected, mode, settings, addLog]);

  const handleToggleFullscreen = () => {
    const el = sectionRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsExpanded(false);
    } else if (el.requestFullscreen) {
      el.requestFullscreen()
        .then(() => setIsExpanded(true))
        .catch(() => setIsExpanded((v) => !v));
    } else {
      setIsExpanded((v) => !v);
    }
  };

  return (
    <section
      id="cockpit-ar-overlay"
      ref={sectionRef}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
    >
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Superposition Réalité Augmentée 3D (Caméra &amp; Flux Réseau)
            </h2>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span
              className={`text-xs font-semibold ${
                cameraActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-cyan-600 dark:text-cyan-400'
              }`}
            >
              {cameraActive ? 'Flux Caméra Live' : 'Horizon Spatial Optique'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Projette les nœuds VPN en icônes 3D flottantes et les paquets RX/TX sur votre environnement physique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={cameraPending}
            onClick={() => {
              if (cameraActive) {
                stopCameraStream();
              } else {
                startCameraStream(facingMode);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              cameraActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {cameraActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Couper Caméra</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>{cameraPending ? 'Initialisation...' : 'Activer Caméra AR'}</span>
              </>
            )}
          </button>

          {cameraActive && (
            <button
              type="button"
              onClick={() => {
                const nextFacing =
                  facingMode === 'environment' ? 'user' : 'environment';
                setFacingMode(nextFacing);
                startCameraStream(nextFacing);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
              title="Basculer caméra avant / arrière"
            >
              {facingMode === 'environment' ? 'Arrière' : 'Frontale'}
            </button>
          )}

          <button
            type="button"
            onClick={() => captureSnapshotFnRef.current?.()}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Capturer une image composite AR (PNG)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowHud((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title={showHud ? 'Masquer l’interface HUD' : 'Afficher l’interface HUD'}
          >
            {showHud ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Agrandir la vue AR"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Camera fallback notice (clean, non-blocking) */}
      {cameraError && (
        <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <span>{cameraError}</span>
          <button
            type="button"
            onClick={() => setCameraError(null)}
            className="font-semibold underline cursor-pointer shrink-0"
          >
            Fermer
          </button>
        </div>
      )}

      {/* AR Viewport: Camera Layer + Transparent Three.js WebGL Overlay + Compact Dock */}
      <div
        className={`relative w-full overflow-hidden select-none bg-slate-950 ${
          isExpanded ? 'h-[580px]' : 'h-[430px]'
        }`}
      >
        {/* Background Live Video Feed (real physical environment) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Subtle Optical Radar Backdrop when physical camera is off */}
        {!cameraActive && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 38%, rgba(8, 51, 68, 0.55) 0%, rgba(2, 6, 23, 0.96) 72%)',
            }}
          />
        )}

        {/* Optical AR Viewfinder Brackets */}
        <div className="absolute inset-4 pointer-events-none border border-cyan-500/15 rounded-xl" />

        {/* Dedicated Three.js WebGL Mount Container (isolated from React HUD siblings) */}
        <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

        {webglFallback && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-slate-300 bg-slate-950/90">
            {webglFallback}
          </div>
        )}

        {/* Top-Left Minimal AR Telemetry Overlay (No backdrop-filter over WebGL) */}
        {showHud && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <div className="px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-800 text-[11px] font-mono text-slate-200 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white">
                  {isConnected ? currentIdentity.ip : 'TUNNEL VEILLE'}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-cyan-400">
                  {settings.protocol.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3 tabular-nums text-[10px] text-slate-400">
                <span className="flex items-center gap-1 text-cyan-300">
                  <ArrowDown className="w-3 h-3" />
                  {throughput.down.toFixed(1)} Mb/s
                </span>
                <span className="flex items-center gap-1 text-purple-300">
                  <ArrowUp className="w-3 h-3" />
                  {throughput.up.toFixed(2)} Mb/s
                </span>
                <span>{displayedNodes.length} balises 3D</span>
              </div>
            </div>
          </div>
        )}

        {/* Unified Compact Bottom Control Dock (Zero Viewport Center Occlusion) */}
        {showHud && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-24px)] max-w-2xl">
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {selectedNode ? (
                <div className="min-w-0 flex items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-white truncate">
                      <span>
                        {selectedNode.city || selectedNode.name}, {selectedNode.country}
                      </span>
                      <span className="font-mono text-[11px] font-medium text-cyan-400 tabular-nums">
                        {selectedNode.latency} ms
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate tabular-nums">
                      {selectedNode.ip} · Charge {selectedNode.loadPct ?? 24}%
                      {selectedNodeSpatial
                        ? ` · ${selectedNodeSpatial.distKm} km · Azimut ${selectedNodeSpatial.bearingDeg}°`
                        : ''}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  Cliquez sur une icône 3D flottante pour l’inspecter
                </span>
              )}

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {selectedNode && selectedNode.ip !== currentIdentity.ip && (
                  <button
                    type="button"
                    onClick={() => onConnectNode(selectedNode.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Power className="w-3 h-3" />
                    <span>Relier ce nœud</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveOnlyFilter((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer border ${
                    activeOnlyFilter
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                  title="Filtrer les nœuds actifs"
                >
                  <Layers className="w-3 h-3" />
                  <span>{activeOnlyFilter ? 'Actifs' : 'Tous'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (gyroEnabled) {
                      setGyroEnabled(false);
                      return;
                    }
                    const DevOrient = window.DeviceOrientationEvent as unknown as
                      | { requestPermission?: () => Promise<'granted' | 'denied'> }
                      | undefined;
                    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
                      try {
                        const perm = await DevOrient.requestPermission();
                        if (perm !== 'granted') return;
                      } catch {
                        return;
                      }
                    }
                    setGyroEnabled(true);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border ${
                    gyroEnabled
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                  title="Parallaxe gyroscope"
                >
                  Gyro
                </button>

                <button
                  type="button"
                  onClick={() => resetViewFnRef.current?.()}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 cursor-pointer"
                  title="Réinitialiser l’orientation 3D"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
