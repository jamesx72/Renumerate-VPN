import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Orbit,
  RotateCcw,
  Play,
  Pause,
  Power,
  Activity,
  Route,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Server,
  Eye,
} from 'lucide-react';
import { AppSettings, ConnectionMode, DeviceNode } from '../types';
import {
  getJurisdictionTier,
  isCountryExcludedByJurisdiction,
  isNodeBlockedByGeoFence,
} from '../constants';
import {
  LOCAL_ORIGIN,
  computeGeodesicDistanceKm,
  getNodeLonLat,
} from './WorldNodeMap';

interface NetworkPlanetarium3DProps {
  nodes: DeviceNode[];
  currentIp: string;
  isConnected: boolean;
  mode: ConnectionMode;
  settings: AppSettings;
  circuitHopIds: string[];
  onConnectNode: (nodeId: string) => void;
  onAssignHopRole?: (nodeId: string, role: 'entry' | 'relay' | 'exit') => void;
}

interface NodeMeshRecord {
  node: DeviceNode;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  coreMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  surfacePos: THREE.Vector3;
  orbitPos: THREE.Vector3;
}

interface PacketPulseRecord {
  curve: THREE.QuadraticBezierCurve3;
  mesh: THREE.Mesh;
  speed: number;
  offset: number;
}

const GLOBE_RADIUS = 2.15;
const ORBIT_ALTITUDE = 0.24;

// Pre-allocated scratch helpers (zero GC inside render loop)
const _scratchVecA = new THREE.Vector3();
const _scratchVecB = new THREE.Vector3();
const _scratchUp = new THREE.Vector3(0, 1, 0);
const _pointerNdc = new THREE.Vector2();

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

function createProceduralPlanetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Deep aerospace obsidian base
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#071121');
    grad.addColorStop(0.5, '#0b182e');
    grad.addColorStop(1, '#071121');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle longitude & latitude technical grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Equator highlight
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(1024, 256);
    ctx.stroke();

    // Procedural subtle orbital dot matrix across sphere
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    for (let i = 0; i < 650; i++) {
      const px = ((i * 197) % 1024);
      const py = ((i * 313) % 512);
      ctx.fillRect(px, py, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export const NetworkPlanetarium3D: React.FC<NetworkPlanetarium3DProps> = ({
  nodes,
  currentIp,
  isConnected,
  mode,
  settings,
  circuitHopIds,
  onConnectNode,
  onAssignHopRole,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => nodes.find((n) => n.ip === currentIp)?.id || nodes[0]?.id || null
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showMeshLinks, setShowMeshLinks] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [liveRttSamples, setLiveRttSamples] = useState<number[]>([]);

  // Latest props & state refs for stable WebGL animation & raycast handlers
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const hoveredNodeIdRef = useRef(hoveredNodeId);
  hoveredNodeIdRef.current = hoveredNodeId;
  const cameraTargetFocusRef = useRef<THREE.Vector3 | null>(null);
  const focusNodeByIdRef = useRef<((nodeId: string) => void) | null>(null);

  const selectedNode = useMemo(
    () =>
      nodes.find((n) => n.id === selectedNodeId) ||
      nodes.find((n) => n.ip === currentIp) ||
      nodes[0] ||
      null,
    [nodes, selectedNodeId, currentIp]
  );

  // Real-time RTT telemetry sparkline sampling for the selected node
  useEffect(() => {
    if (!selectedNode) {
      setLiveRttSamples([]);
      return;
    }
    const jitter = selectedNode.jitter ?? 2.2;
    const seed = Array.from({ length: 14 }, (_, idx) => {
      const wave = Math.sin(idx * 0.7) * jitter * 0.65;
      return Math.max(4, Math.round(selectedNode.latency + wave));
    });
    setLiveRttSamples(seed);

    const timer = window.setInterval(() => {
      const delta = (Math.random() - 0.48) * jitter * 1.3;
      const sample = Math.max(4, Math.round(selectedNode.latency + delta));
      setLiveRttSamples((prev) => [...prev.slice(-13), sample]);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [selectedNode]);

  // Main Three.js WebGL scene setup (rebuilds cleanly when nodes/circuit/mesh-links change)
  useEffect(() => {
    const container = mountRef.current;
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
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglError('Contexte WebGL indisponible dans ce navigateur.');
      return;
    }

    setWebglError(null);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Le contexte WebGL a été suspendu par le pilote graphique.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);
    scene.fog = new THREE.FogExp2(0x030712, 0.045);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    camera.position.set(0.4, 2.1, 6.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.8;
    controls.maxDistance = 10.5;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.85;

    const handleControlsStart = () => {
      cameraTargetFocusRef.current = null;
    };
    controls.addEventListener('start', handleControlsStart);

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.9);
    keyLight.position.set(6, 7, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.25);
    rimLight.position.set(-6, -2, -5);
    scene.add(rimLight);

    const disposables: Array<{ dispose: () => void }> = [envTarget];

    // Orbital Starfield (Instanced / Points)
    const starCount = 320;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 16 + ((i * 73) % 18);
      const u = ((i * 137.5) % 360) * (Math.PI / 180);
      const v = Math.acos(2 * (((i * 29) % 100) / 100) - 1);
      starPositions[i * 3] = r * Math.sin(v) * Math.cos(u);
      starPositions[i * 3 + 1] = r * Math.cos(v);
      starPositions[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );
    const starsMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.065,
      transparent: true,
      opacity: 0.65,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);
    disposables.push(starsGeo, starsMat);

    // Root Planetarium Group
    const planetariumGroup = new THREE.Group();
    scene.add(planetariumGroup);

    // 1. Central Planet Core (Multi-part composite sphere)
    const planetTex = createProceduralPlanetTexture();
    planetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    disposables.push(planetTex);

    const coreGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 48, 36);
    const coreMat = new THREE.MeshPhysicalMaterial({
      map: planetTex,
      color: 0x0f172a,
      roughness: 0.38,
      metalness: 0.62,
      clearcoat: 0.75,
      clearcoatRoughness: 0.22,
    });
    const coreSphere = new THREE.Mesh(coreGeo, coreMat);
    planetariumGroup.add(coreSphere);
    disposables.push(coreGeo, coreMat);

    // 2. Geodesic Wireframe Lattice Cage
    const cageGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS + 0.025, 2);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    planetariumGroup.add(cageMesh);
    disposables.push(cageGeo, cageMat);

    // 3. Two Brushed Metallic Orbital Gyro Rings
    const ringGeoPrimary = new THREE.TorusGeometry(GLOBE_RADIUS + 0.42, 0.014, 16, 120);
    const ringMatPrimary = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.88,
      roughness: 0.22,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
    });
    const eqRing = new THREE.Mesh(ringGeoPrimary, ringMatPrimary);
    eqRing.rotation.x = Math.PI / 2.25;
    eqRing.rotation.y = 0.2;
    planetariumGroup.add(eqRing);
    disposables.push(ringGeoPrimary, ringMatPrimary);

    const ringGeoSecondary = new THREE.TorusGeometry(GLOBE_RADIUS + 0.58, 0.01, 14, 120);
    const ringMatSecondary = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      metalness: 0.85,
      roughness: 0.28,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.22,
    });
    const polarRing = new THREE.Mesh(ringGeoSecondary, ringMatSecondary);
    polarRing.rotation.x = Math.PI / 3.4;
    polarRing.rotation.z = Math.PI / 4;
    planetariumGroup.add(polarRing);
    disposables.push(ringGeoSecondary, ringMatSecondary);

    // 4. Local Origin Anchor Hub (Brussels IX)
    const originSurfacePos = latLonToVector3(
      LOCAL_ORIGIN[1],
      LOCAL_ORIGIN[0],
      GLOBE_RADIUS + 0.03
    );
    const originOrbitalPos = latLonToVector3(
      LOCAL_ORIGIN[1],
      LOCAL_ORIGIN[0],
      GLOBE_RADIUS + 0.14
    );
    const originHubGroup = new THREE.Group();
    originHubGroup.position.copy(originSurfacePos);
    originHubGroup.quaternion.setFromUnitVectors(
      _scratchUp,
      originSurfacePos.clone().normalize()
    );
    const originPylonGeo = new THREE.CylinderGeometry(0.025, 0.05, 0.14, 12);
    const originPylonMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.65,
      metalness: 0.7,
      roughness: 0.2,
    });
    const originPylon = new THREE.Mesh(originPylonGeo, originPylonMat);
    originPylon.position.y = 0.07;
    originHubGroup.add(originPylon);
    planetariumGroup.add(originHubGroup);
    disposables.push(originPylonGeo, originPylonMat);

    // 5. Composite VPN Relay Node Satellites
    const nodeRecords: NodeMeshRecord[] = [];
    const hitTargets: THREE.Object3D[] = [];
    const hitGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const beaconGeo = new THREE.OctahedronGeometry(0.078, 1);
    const nodeRingGeo = new THREE.TorusGeometry(0.12, 0.01, 10, 32);
    const haloGeo = new THREE.RingGeometry(0.08, 0.14, 24);
    const stemMat = new THREE.LineBasicMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.65,
    });
    disposables.push(hitGeo, hitMat, beaconGeo, nodeRingGeo, haloGeo, stemMat);

    const circuitOrderMap = new Map<string, number>();
    circuitHopIds.forEach((id, idx) => {
      if (!circuitOrderMap.has(id)) circuitOrderMap.set(id, idx + 1);
    });

    nodes.forEach((node) => {
      const [lon, lat] = getNodeLonLat(node);
      const surfacePos = latLonToVector3(lat, lon, GLOBE_RADIUS + 0.015);
      const orbitPos = latLonToVector3(
        lat,
        lon,
        GLOBE_RADIUS + ORBIT_ALTITUDE
      );

      const isCurrent = isConnected && node.ip === currentIp;
      const isGeoBlocked = isNodeBlockedByGeoFence(node.country, settings);
      const isExcluded =
        isCountryExcludedByJurisdiction(
          node.country,
          settings.excludeEyesJurisdictions
        ) || isGeoBlocked;
      const hopIdx = circuitOrderMap.get(node.id);

      let colorHex = 0x10b981; // Emerald low latency
      if (isGeoBlocked) {
        colorHex = 0xf43f5e;
      } else if (hopIdx === 1 || isCurrent) {
        colorHex = 0x06b6d4;
      } else if (hopIdx === 2) {
        colorHex = 0xa855f7;
      } else if (hopIdx === 3) {
        colorHex = 0x10b981;
      } else if (isExcluded) {
        colorHex = 0x64748b;
      } else if (node.latency > 90) {
        colorHex = 0xf43f5e;
      } else if (node.latency > 35) {
        colorHex = 0xf59e0b;
      }

      // Surface-to-orbit tether stem
      const stemGeo = new THREE.BufferGeometry().setFromPoints([
        surfacePos,
        orbitPos,
      ]);
      const stemLine = new THREE.Line(stemGeo, stemMat);
      planetariumGroup.add(stemLine);
      disposables.push(stemGeo);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(orbitPos);
      const normalDir = orbitPos.clone().normalize();
      nodeGroup.quaternion.setFromUnitVectors(_scratchUp, normalDir);

      // Part 1: Emissive Core Beacon
      const coreNodeMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: isCurrent || hopIdx ? 0.95 : 0.45,
        metalness: 0.72,
        roughness: 0.18,
      });
      const coreMesh = new THREE.Mesh(beaconGeo, coreNodeMat);
      nodeGroup.add(coreMesh);
      disposables.push(coreNodeMat);

      // Part 2: Tilted Orbital Gyro Ring around node
      const nodeRingMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.88,
        roughness: 0.22,
        emissive: colorHex,
        emissiveIntensity: 0.25,
      });
      const ringMesh = new THREE.Mesh(nodeRingGeo, nodeRingMat);
      ringMesh.rotation.x = Math.PI / 2.6;
      nodeGroup.add(ringMesh);
      disposables.push(nodeRingMat);

      // Part 3: Selection / Active Halo Ring
      const haloMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isCurrent || hopIdx ? 0.85 : 0.25,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = -Math.PI / 2;
      nodeGroup.add(haloMesh);
      disposables.push(haloMat);

      // Part 4: Dedicated Raycast Proxy Sphere (Layer 1)
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.layers.set(1);
      hitMesh.userData.nodeId = node.id;
      nodeGroup.add(hitMesh);
      hitTargets.push(hitMesh);

      planetariumGroup.add(nodeGroup);
      nodeRecords.push({
        node,
        group: nodeGroup,
        hitMesh,
        coreMesh,
        ringMesh,
        haloMesh,
        surfacePos,
        orbitPos,
      });
    });

    // 6. 3D Orbital Routing Arcs + Animated Packet Pulses
    const packetPulses: PacketPulseRecord[] = [];
    const packetGeo = new THREE.SphereGeometry(0.036, 10, 10);
    disposables.push(packetGeo);

    const recordById = new Map(nodeRecords.map((r) => [r.node.id, r]));

    // Determine ordered circuit chain for active routing arcs
    const activeCircuitRecords: NodeMeshRecord[] = [];
    if (circuitHopIds.length > 0) {
      for (const hid of circuitHopIds) {
        const rec = recordById.get(hid);
        if (rec) activeCircuitRecords.push(rec);
      }
    } else if (isConnected) {
      const currentRec = nodeRecords.find((r) => r.node.ip === currentIp);
      if (currentRec) activeCircuitRecords.push(currentRec);
    }

    const createArcCurve = (pA: THREE.Vector3, pB: THREE.Vector3, lift: number) => {
      const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      const dist = pA.distanceTo(pB);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + ORBIT_ALTITUDE + lift + dist * 0.24);
      return new THREE.QuadraticBezierCurve3(pA, mid, pB);
    };

    // Standby mesh arcs (subtle)
    if (showMeshLinks) {
      const standbyArcMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
      });
      disposables.push(standbyArcMat);

      nodeRecords.forEach((rec) => {
        if (activeCircuitRecords.some((a) => a.node.id === rec.node.id)) return;
        const curve = createArcCurve(originOrbitalPos, rec.orbitPos, 0.12);
        const pts = curve.getPoints(28);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, standbyArcMat);
        planetariumGroup.add(line);
        disposables.push(geo);
      });
    }

    // Active / Staged Circuit Glowing Tube Arcs + Animated Data Packets
    if (activeCircuitRecords.length > 0) {
      const arcPalette = [0x06b6d4, 0xa855f7, 0x10b981];
      let prevPoint = originOrbitalPos;

      activeCircuitRecords.forEach((rec, idx) => {
        const arcColor = arcPalette[idx % arcPalette.length];
        const curve = createArcCurve(prevPoint, rec.orbitPos, 0.28);
        const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.015, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: arcColor,
          transparent: true,
          opacity: 0.9,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        planetariumGroup.add(tubeMesh);
        disposables.push(tubeGeo, tubeMat);

        // Two packet pulses per hop segment
        for (let p = 0; p < 2; p++) {
          const pulseMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
          });
          const pulseMesh = new THREE.Mesh(packetGeo, pulseMat);
          planetariumGroup.add(pulseMesh);
          disposables.push(pulseMat);
          packetPulses.push({
            curve,
            mesh: pulseMesh,
            speed: isConnected ? 0.45 : 0.26,
            offset: p * 0.5 + idx * 0.2,
          });
        }

        prevPoint = rec.orbitPos;
      });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster strictly targeting layer 1 hit-spheres
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    let lastHoverRaycast = 0;
    let pointerDownXY = { x: 0, y: 0 };

    const updatePointerFromEvent = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (ev: PointerEvent) => {
      pointerDownXY = { x: ev.clientX, y: ev.clientY };
    };

    const handlePointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverRaycast < 45) return;
      lastHoverRaycast = now;

      updatePointerFromEvent(ev);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.nodeId as string;
        renderer.domElement.style.cursor = 'pointer';
        if (hoveredNodeIdRef.current !== hitId) {
          setHoveredNodeId(hitId);
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
        if (hoveredNodeIdRef.current !== null) {
          setHoveredNodeId(null);
        }
      }
    };

    const focusCameraOnNode = (nodeId: string) => {
      const rec = nodeRecords.find((r) => r.node.id === nodeId);
      if (!rec) return;
      rec.group.getWorldPosition(_scratchVecA);
      const dist = camera.position.length();
      cameraTargetFocusRef.current = _scratchVecA
        .clone()
        .normalize()
        .multiplyScalar(Math.max(4.4, Math.min(6.4, dist)));
    };
    focusNodeByIdRef.current = focusCameraOnNode;

    const handlePointerUp = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerDownXY.x;
      const dy = ev.clientY - pointerDownXY.y;
      if (Math.hypot(dx, dy) > 6) return; // Ignore orbit drags

      updatePointerFromEvent(ev);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.nodeId as string;
        setSelectedNodeId(hitId);
        focusCameraOnNode(hitId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // ResizeObserver for crisp container adaptation
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(340, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Animation loop (with software WebGL pacing via afterDraw)
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (autoRotateRef.current && !cameraTargetFocusRef.current) {
        planetariumGroup.rotation.y += delta * 0.14;
      }

      // Gyro rings subtle counter-rotation
      eqRing.rotation.z += delta * 0.12;
      polarRing.rotation.y -= delta * 0.09;

      // Smoothly focus camera on selected node if triggered by click
      if (cameraTargetFocusRef.current) {
        const targetPos = cameraTargetFocusRef.current;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          targetPos.x,
          5.5,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          targetPos.y,
          5.5,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          targetPos.z,
          5.5,
          delta
        );
        if (camera.position.distanceTo(targetPos) < 0.05) {
          cameraTargetFocusRef.current = null;
        }
      }

      // Animate node beacons & smoothly scale selected/hovered nodes
      const selId = selectedNodeIdRef.current;
      const hovId = hoveredNodeIdRef.current;
      for (let i = 0; i < nodeRecords.length; i++) {
        const rec = nodeRecords[i];
        const isSel = rec.node.id === selId;
        const isHov = rec.node.id === hovId;
        const targetScale = isSel ? 1.55 : isHov ? 1.32 : 1.0;

        const nextScale = THREE.MathUtils.damp(
          rec.group.scale.x,
          targetScale,
          9,
          delta
        );
        rec.group.scale.setScalar(nextScale);
        rec.coreMesh.rotation.y += delta * (isSel ? 1.8 : 0.75);
        rec.ringMesh.rotation.z += delta * (isSel ? -2.1 : 0.9);
      }

      // Move data packets along 3D Bezier curves
      for (let i = 0; i < packetPulses.length; i++) {
        const p = packetPulses[i];
        const t = (elapsed * p.speed + p.offset) % 1;
        p.curve.getPoint(t, _scratchVecB);
        p.mesh.position.copy(_scratchVecB);
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );
      focusNodeByIdRef.current = null;
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [nodes, currentIp, isConnected, settings, circuitHopIds, showMeshLinks]);

  const hoveredNode = useMemo(
    () => (hoveredNodeId ? nodes.find((n) => n.id === hoveredNodeId) || null : null),
    [hoveredNodeId, nodes]
  );

  const selectedMetrics = useMemo(() => {
    if (!selectedNode) return null;
    const distanceKm = computeGeodesicDistanceKm(
      LOCAL_ORIGIN,
      getNodeLonLat(selectedNode)
    );
    const tier = getJurisdictionTier(selectedNode.country);
    const geoBlocked = isNodeBlockedByGeoFence(selectedNode.country, settings);
    const eyesExcluded = isCountryExcludedByJurisdiction(
      selectedNode.country,
      settings.excludeEyesJurisdictions
    );
    const hopIndex = circuitHopIds.indexOf(selectedNode.id);
    const circuitRole =
      hopIndex === 0 && circuitHopIds.length >= 2
        ? 'Garde d’entrée (#1)'
        : hopIndex === 1 && circuitHopIds.length === 3
          ? 'Relais aveugle (#2)'
          : hopIndex >= 0
            ? `Nœud de sortie (#${hopIndex + 1})`
            : 'En réserve dans le maillage';

    return {
      distanceKm,
      tier,
      geoBlocked,
      eyesExcluded,
      circuitRole,
      avgLiveRtt:
        liveRttSamples.length > 0
          ? Math.round(
              liveRttSamples.reduce((a, b) => a + b, 0) / liveRttSamples.length
            )
          : selectedNode.latency,
    };
  }, [selectedNode, settings, circuitHopIds, liveRttSamples]);

  // SVG sparkline path for real-time RTT
  const rttSparklinePath = useMemo(() => {
    if (liveRttSamples.length < 2) return '';
    const min = Math.min(...liveRttSamples) - 2;
    const max = Math.max(...liveRttSamples) + 2;
    const span = Math.max(4, max - min);
    return liveRttSamples
      .map((val, idx) => {
        const x = (idx / (liveRttSamples.length - 1)) * 220;
        const y = 38 - ((val - min) / span) * 32;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [liveRttSamples]);

  const handleSelectFromList = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    focusNodeByIdRef.current?.(nodeId);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Orbit className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Planétarium Réseau 3D (Sphère Orbitale WebGL)
          </h2>
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {nodes.length} nœuds en orbite
          </span>
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {isConnected ? `Tunnel ${mode} actif` : 'Mode veille orbitale'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              autoRotate
                ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {autoRotate ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{autoRotate ? 'Rotation auto' : 'En pause'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMeshLinks((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              showMeshLinks
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span>Arcs maillage</span>
          </button>

          <button
            type="button"
            onClick={() => {
              cameraTargetFocusRef.current = new THREE.Vector3(0.4, 2.1, 6.2);
            }}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Réinitialiser la caméra orbitale"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Viewport + Live Routing & Latency Telemetry Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left 3D WebGL Orbital Sphere */}
        <div className="lg:col-span-8 xl:col-span-9 relative bg-slate-950 flex flex-col justify-between min-h-[420px]">
          {/* Dedicated empty WebGL canvas mount (unobstructed center, no backdrop-filter) */}
          <div
            ref={mountRef}
            className="w-full h-[390px] sm:h-[440px] relative"
          />

          {/* WebGL Fallback Notice */}
          {webglError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-200">
              <Orbit className="w-10 h-10 text-cyan-400 mb-3 opacity-80" />
              <div className="text-sm font-semibold">{webglError}</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Vous pouvez toujours sélectionner un nœud depuis la liste rapide ci-dessous pour inspecter ses statistiques.
              </p>
            </div>
          )}

          {/* Top-Left Discrete Hover Readout (no backdrop-filter over WebGL) */}
          {hoveredNode && (
            <div className="pointer-events-none absolute top-3 left-3 z-10 bg-slate-900/90 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white">
              <div className="font-mono font-semibold flex items-center gap-2">
                <span>{hoveredNode.name}</span>
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="text-cyan-400 tabular-nums">
                  {hoveredNode.latency} ms
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {hoveredNode.city || hoveredNode.country}, {hoveredNode.country} ·{' '}
                Cliquer pour inspecter
              </div>
            </div>
          )}

          {/* Quick Node Orbital Selector Strip at bottom of viewport */}
          <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-1.5">
              {nodes.slice(0, 8).map((n) => {
                const isSelected = selectedNode?.id === n.id;
                const isActive = isConnected && n.ip === currentIp;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelectFromList(n.id)}
                    className={`px-2 py-1 rounded-md font-mono text-[11px] transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 text-white font-semibold'
                        : isActive
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {n.name}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400">
              Glisser : orbiter · Molette : zoom · Clic sur nœud 3D : inspecter
            </span>
          </div>
        </div>

        {/* Right Side Inspector: Selected Node Real-Time Latency & Routing Telemetry */}
        <div className="lg:col-span-4 xl:col-span-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between bg-white dark:bg-slate-900">
          {selectedNode && selectedMetrics ? (
            <div className="space-y-4">
              {/* Identity Header */}
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span>{selectedNode.city || selectedNode.country}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedNode.country}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      selectedMetrics.tier === 'sanctuary'
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : selectedMetrics.tier === '14-eyes'
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-rose-600 dark:text-rose-400 font-medium'
                    }
                  >
                    {selectedMetrics.tier === 'sanctuary'
                      ? 'Sanctuaire'
                      : selectedMetrics.tier === '14-eyes'
                        ? '14-Eyes'
                        : '5-Eyes'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 flex items-center justify-between gap-2">
                  <span>{selectedNode.name}</span>
                  <span className="text-xs font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {liveRttSamples[liveRttSamples.length - 1] ??
                      selectedNode.latency}{' '}
                    ms
                  </span>
                </h3>

                <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {selectedNode.ip} · {selectedNode.asn || 'AS60068'}
                  </span>
                </div>
              </div>

              {/* Real-Time RTT Telemetry Sparkline */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Sonde RTT en direct</span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    Moy. {selectedMetrics.avgLiveRtt} ms · ±
                    {selectedNode.jitter ?? 1.8} ms
                  </span>
                </div>
                <svg
                  viewBox="0 0 220 42"
                  className="w-full h-10 overflow-visible"
                >
                  <path
                    d={rttSparklinePath}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Routing & Telemetry Rows */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    Rôle dans le circuit
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white text-right">
                    {selectedMetrics.circuitRole}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    Portée orbitale
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {selectedMetrics.distanceKm.toLocaleString('fr-FR')} km
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    Débit &amp; charge
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {selectedNode.transferRate} Mo/s ·{' '}
                    {selectedNode.loadPct ?? 30}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    Perte de paquets
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {selectedNode.packetLoss ?? 0}% · Signal{' '}
                    {selectedNode.signalStrength}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    Conformité routage
                  </span>
                  {selectedMetrics.geoBlocked ? (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Bloqué (Barrière Géo)
                    </span>
                  ) : selectedMetrics.eyesExcluded ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Hors politique Eyes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Routage autorisé
                    </span>
                  )}
                </div>
              </div>

              {onAssignHopRole && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <Route className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Assigner au routage multi-sauts</span>
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
                          onAssignHopRole(selectedNode.id, slot.role)
                        }
                        className="py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-cyan-500/60 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-10 text-center flex flex-col items-center gap-2">
              <Eye className="w-6 h-6 opacity-40" />
              <span>Cliquez sur un nœud 3D de la sphère orbitale.</span>
            </div>
          )}

          {selectedNode && (
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onConnectNode(selectedNode.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  selectedNode.ip === currentIp && isConnected
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : selectedMetrics?.geoBlocked
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {selectedNode.ip === currentIp && isConnected ? (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Relais actuellement connecté</span>
                  </>
                ) : selectedMetrics?.geoBlocked ? (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Zone interdite (Barrière Géo)</span>
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
