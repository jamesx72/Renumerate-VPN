import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import {
  AlertTriangle,
  Check,
  Compass,
  Copy,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { VirtualIdentity } from '../types';

export interface WifiGeoSpoofingProps {
  identity: VirtualIdentity;
  enabled: boolean;
  onToggle?: (enabled: boolean) => void;
  isRotating?: boolean;
  isMasking?: boolean;
  onScanGenerated?: (info: {
    city: string;
    country: string;
    apCount: number;
    spoofedLat: number;
    spoofedLon: number;
  }) => void;
}

type DispersionRadiusM = 150 | 450 | 1200;
type BandFilter = 'all' | 'high' | 'low';

interface GatewayGeoAnchor {
  lat: number;
  lon: number;
  district: string;
  regionalSsids: string[];
  regionalOuis: Array<{ oui: string; vendor: string }>;
}

interface GeoSpoofedAp {
  id: string;
  ssid: string;
  bssid: string;
  vendor: string;
  band: '2.4 GHz' | '5 GHz' | '6 GHz';
  channel: number;
  distanceMeters: number;
  azimuthDeg: number;
  bearingLabel: string;
  rssiDbm: number;
  snrDb: number;
  qualityPct: number;
  security: 'WPA3-SAE' | 'WPA2/WPA3' | 'WPA2-PSK' | 'OWE';
  apLat: number;
  apLon: number;
}

const CITY_GEO_ANCHORS: Record<string, GatewayGeoAnchor> = {
  Paris: {
    lat: 48.8566,
    lon: 2.3522,
    district: 'Paris 2e · Sentier',
    regionalSsids: [
      'Livebox',
      'Freebox',
      'SFR_WiFi',
      'Bbox',
      'Orange-5G',
      'FreeWifi_secure',
      'Paris_Wi-Fi',
    ],
    regionalOuis: [
      { oui: '34:27:92', vendor: 'Sagemcom' },
      { oui: 'F4:CA:E5', vendor: 'Freebox SAS' },
      { oui: '84:A1:D1', vendor: 'Technicolor' },
      { oui: '74:83:C2', vendor: 'Ubiquiti' },
    ],
  },
  Zurich: {
    lat: 47.3769,
    lon: 8.5417,
    district: 'Zürich · Kreis 1',
    regionalSsids: [
      'Swisscom_Pro',
      'Sunrise-6E',
      'Salt-Fiber',
      'Init7-Mesh',
      'SBB-FREE',
      'ETH-Guest',
    ],
    regionalOuis: [
      { oui: 'E8:DF:70', vendor: 'Swisscom/Arcadyan' },
      { oui: '3C:A6:2F', vendor: 'AVM FRITZ!' },
      { oui: '00:1D:70', vendor: 'Cisco Meraki' },
      { oui: '74:83:C2', vendor: 'Ubiquiti' },
    ],
  },
  Singapour: {
    lat: 1.3521,
    lon: 103.8198,
    district: 'Downtown Core · Marina',
    regionalSsids: [
      'Singtel_Fiber',
      'StarHub-6E',
      'M1_Mesh',
      'Wireless@SGx',
      'MyRepublic-AX',
      'ViewQwest_10G',
    ],
    regionalOuis: [
      { oui: '04:D4:C4', vendor: 'ASUSTek' },
      { oui: '50:C7:BF', vendor: 'TP-Link' },
      { oui: '28:80:88', vendor: 'Netgear' },
      { oui: '00:24:6C', vendor: 'Aruba HPE' },
    ],
  },
  Reykjavik: {
    lat: 64.1466,
    lon: -21.9426,
    district: 'Miðborg · Reykjavík',
    regionalSsids: [
      'Siminn-5G',
      'Nova_Fiber',
      'Vodafone_IS',
      'Hringdu_Net',
      'ReykjavikGuest',
    ],
    regionalOuis: [
      { oui: '3C:A6:2F', vendor: 'AVM FRITZ!' },
      { oui: '74:83:C2', vendor: 'Ubiquiti' },
      { oui: 'CC:2D:E0', vendor: 'MikroTik' },
    ],
  },
  Tallinn: {
    lat: 59.437,
    lon: 24.7536,
    district: 'Kesklinn · Tallinn',
    regionalSsids: [
      'Telia-EE',
      'Elisa_5G',
      'Tele2_Fiber',
      'Eduroam-EE',
      'TallinnMesh',
    ],
    regionalOuis: [
      { oui: 'CC:2D:E0', vendor: 'MikroTik' },
      { oui: '74:83:C2', vendor: 'Ubiquiti' },
      { oui: '84:A1:D1', vendor: 'Technicolor' },
    ],
  },
  Panama: {
    lat: 8.9824,
    lon: -79.5199,
    district: 'Bella Vista · Panamá',
    regionalSsids: [
      'Tigo_Fiber',
      'CableOnda_5G',
      'Claro_Mesh',
      'CW_Panama',
      'MetroGuest',
    ],
    regionalOuis: [
      { oui: '50:C7:BF', vendor: 'TP-Link' },
      { oui: '84:A1:D1', vendor: 'Technicolor' },
      { oui: '00:1D:70', vendor: 'Cisco Meraki' },
    ],
  },
  'New York': {
    lat: 40.7128,
    lon: -74.006,
    district: 'Lower Manhattan · NYC',
    regionalSsids: [
      'Verizon_6E',
      'SpectrumSetup',
      'AT&T-Fiber',
      'LinkNYC_Free',
      'Xfinity-5G',
      'SonicFiber',
    ],
    regionalOuis: [
      { oui: '28:80:88', vendor: 'Netgear' },
      { oui: '00:1D:70', vendor: 'Cisco Meraki' },
      { oui: '74:83:C2', vendor: 'Ubiquiti' },
    ],
  },
  Francfort: {
    lat: 50.1109,
    lon: 8.6821,
    district: 'Innenstadt · Frankfurt',
    regionalSsids: [
      'Telekom-WLAN',
      'FRITZ!Box_7590',
      'Vodafone_5G',
      'O2-HomeBox',
      'Freifunk',
    ],
    regionalOuis: [
      { oui: '3C:A6:2F', vendor: 'AVM FRITZ!' },
      { oui: '34:27:92', vendor: 'Sagemcom' },
      { oui: '74:83:C2', vendor: 'Ubiquiti' },
    ],
  },
};

function cryptoRandUnit(): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] / 0xffffffff;
}

function resolveGatewayAnchor(identity: VirtualIdentity): GatewayGeoAnchor {
  const byCity = CITY_GEO_ANCHORS[identity.city];
  if (byCity) return byCity;

  // Fallback derived deterministically from city/country/IP
  const octets = identity.ip.split('.').map((v) => Number.parseInt(v, 10) || 12);
  const lat = Number((((octets[0] % 70) - 20) + 28.4).toFixed(4));
  const lon = Number((((octets[1] % 160) - 80) + 4.2).toFixed(4));

  return {
    lat,
    lon,
    district: `${identity.city || 'Zone'} · ${identity.country}`,
    regionalSsids: [
      `${identity.country.slice(0, 5)}Tel_5G`,
      'MetroFiber_6E',
      'Cafe_WiFi_Guest',
      'Ubiquiti_U6',
      'Corp_Mesh',
    ],
    regionalOuis: [
      { oui: '74:83:C2', vendor: 'Ubiquiti' },
      { oui: '04:D4:C4', vendor: 'ASUSTek' },
      { oui: '00:24:6C', vendor: 'Aruba HPE' },
    ],
  };
}

function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

function offsetLatLon(
  lat: number,
  lon: number,
  distanceM: number,
  azimuthDeg: number
): { lat: number; lon: number } {
  const rad = (azimuthDeg * Math.PI) / 180;
  const dLat = (distanceM * Math.cos(rad)) / 111320;
  const dLon =
    (distanceM * Math.sin(rad)) /
    (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    lat: Number((lat + dLat).toFixed(6)),
    lon: Number((lon + dLon).toFixed(6)),
  };
}

/**
 * Log-Distance Path Loss Model:
 * RSSI(d) = P0(freq) - 10 * n * log10(d) + shadowNoise
 * Ensures physically plausible urban Wi-Fi RSSI (-38 dBm close -> -86 dBm edge).
 */
function computePlausibleRssi(
  distanceMeters: number,
  band: '2.4 GHz' | '5 GHz' | '6 GHz',
  shadowNoiseDb: number
): number {
  const p0At1m = band === '2.4 GHz' ? -30 : band === '5 GHz' ? -34 : -37;
  const pathLossExp = band === '2.4 GHz' ? 2.45 : band === '5 GHz' ? 2.75 : 2.95;
  const raw =
    p0At1m -
    10 * pathLossExp * Math.log10(Math.max(3, distanceMeters)) +
    shadowNoiseDb;
  return Math.round(Math.max(-87, Math.min(-36, raw)));
}

function generateGeoSpoofedScan(
  identity: VirtualIdentity,
  radiusMeters: DispersionRadiusM,
  count = 7
): {
  anchor: GatewayGeoAnchor;
  spoofedLat: number;
  spoofedLon: number;
  aps: GeoSpoofedAp[];
} {
  const anchor = resolveGatewayAnchor(identity);
  // Randomize spoofed user receiver centroid slightly inside the gateway city
  const centroidOffsetDist = 60 + cryptoRandUnit() * Math.min(420, radiusMeters * 0.45);
  const centroidAzimuth = cryptoRandUnit() * 360;
  const centroid = offsetLatLon(
    anchor.lat,
    anchor.lon,
    centroidOffsetDist,
    centroidAzimuth
  );

  const bandSpecs: Array<{
    band: '2.4 GHz' | '5 GHz' | '6 GHz';
    channels: number[];
  }> = [
    { band: '5 GHz', channels: [36, 44, 52, 100, 149, 157] },
    { band: '6 GHz', channels: [5, 21, 37, 53, 85] },
    { band: '2.4 GHz', channels: [1, 6, 11] },
  ];
  const securities: GeoSpoofedAp['security'][] = [
    'WPA3-SAE',
    'WPA2/WPA3',
    'WPA2-PSK',
    'OWE',
  ];

  const aps: GeoSpoofedAp[] = [];
  for (let i = 0; i < count; i++) {
    const ssidPrefix =
      anchor.regionalSsids[
        Math.floor(cryptoRandUnit() * anchor.regionalSsids.length)
      ];
    const ouiSpec =
      anchor.regionalOuis[
        Math.floor(cryptoRandUnit() * anchor.regionalOuis.length)
      ];
    const bandSpec = bandSpecs[Math.floor(cryptoRandUnit() * bandSpecs.length)];
    const channel =
      bandSpec.channels[
        Math.floor(cryptoRandUnit() * bandSpec.channels.length)
      ];

    const nicBytes = new Uint8Array(3);
    window.crypto.getRandomValues(nicBytes);
    const nicHex = Array.from(nicBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
    const bssid = `${ouiSpec.oui}:${nicHex}`;

    // Scale realistic RF distance relative to selected urban dispersion
    const maxApRangeM = radiusMeters === 150 ? 68 : radiusMeters === 450 ? 115 : 165;
    const distanceMeters = Math.round(
      9 + Math.pow(cryptoRandUnit(), 1.15) * (maxApRangeM - 9)
    );
    const azimuthDeg = Math.round(cryptoRandUnit() * 359);
    const shadowNoise = (cryptoRandUnit() - 0.5) * 5.2;
    const rssiDbm = computePlausibleRssi(
      distanceMeters,
      bandSpec.band,
      shadowNoise
    );
    const noiseFloorDbm = bandSpec.band === '6 GHz' ? -96 : -94;
    const snrDb = Math.max(6, rssiDbm - noiseFloorDbm);
    const qualityPct = Math.round(
      Math.max(12, Math.min(100, ((rssiDbm + 90) / 52) * 100))
    );

    const suffix = Math.floor(cryptoRandUnit() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
    const ssid = `${ssidPrefix}-${suffix}`;
    const apCoords = offsetLatLon(
      centroid.lat,
      centroid.lon,
      distanceMeters,
      azimuthDeg
    );

    aps.push({
      id: `geoap-${i}-${suffix}-${Math.round(cryptoRandUnit() * 9999)}`,
      ssid,
      bssid,
      vendor: ouiSpec.vendor,
      band: bandSpec.band,
      channel,
      distanceMeters,
      azimuthDeg,
      bearingLabel: bearingToCompass(azimuthDeg),
      rssiDbm,
      snrDb,
      qualityPct,
      security: securities[Math.floor(cryptoRandUnit() * securities.length)],
      apLat: apCoords.lat,
      apLon: apCoords.lon,
    });
  }

  aps.sort((a, b) => b.rssiDbm - a.rssiDbm);

  return {
    anchor,
    spoofedLat: centroid.lat,
    spoofedLon: centroid.lon,
    aps,
  };
}

export const WifiGeoSpoofing: React.FC<WifiGeoSpoofingProps> = ({
  identity,
  enabled,
  onToggle,
  isRotating = false,
  isMasking = false,
  onScanGenerated,
}) => {
  const [radiusM, setRadiusM] = useState<DispersionRadiusM>(450);
  const [bandFilter, setBandFilter] = useState<BandFilter>('all');
  const [hoveredApId, setHoveredApId] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const [scanData, setScanData] = useState(() =>
    generateGeoSpoofedScan(identity, 450, 7)
  );

  const radarRef = useRef<SVGSVGElement | null>(null);

  // Automatically regenerate plausible geo-spoofed Wi-Fi networks whenever the active VPN gateway changes
  useEffect(() => {
    const next = generateGeoSpoofedScan(identity, radiusM, 7);
    setScanData(next);
    onScanGenerated?.({
      city: identity.city,
      country: identity.country,
      apCount: next.aps.length,
      spoofedLat: next.spoofedLat,
      spoofedLon: next.spoofedLon,
    });
  }, [identity.ip, identity.city, identity.country, radiusM, onScanGenerated]);

  const handleRegenerate = useCallback(() => {
    const next = generateGeoSpoofedScan(identity, radiusM, 7);
    setScanData(next);
    onScanGenerated?.({
      city: identity.city,
      country: identity.country,
      apCount: next.aps.length,
      spoofedLat: next.spoofedLat,
      spoofedLon: next.spoofedLon,
    });
  }, [identity, radiusM, onScanGenerated]);

  const visibleAps = useMemo(() => {
    if (bandFilter === 'high') {
      return scanData.aps.filter(
        (ap) => ap.band === '5 GHz' || ap.band === '6 GHz'
      );
    }
    if (bandFilter === 'low') {
      return scanData.aps.filter((ap) => ap.band === '2.4 GHz');
    }
    return scanData.aps;
  }, [scanData.aps, bandFilter]);

  const handleCopyGeoPayload = useCallback(() => {
    const payload = {
      considerIp: false,
      spoofedAnchor: {
        city: identity.city,
        country: identity.country,
        lat: scanData.spoofedLat,
        lng: scanData.spoofedLon,
      },
      wifiAccessPoints: visibleAps.map((ap) => ({
        macAddress: ap.bssid,
        signalStrength: ap.rssiDbm,
        channel: ap.channel,
        signalToNoiseRatio: ap.snrDb,
        age: 0,
      })),
    };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => {
        setCopiedPayload(true);
        window.setTimeout(() => setCopiedPayload(false), 1800);
      })
      .catch(() => {});
  }, [identity.city, identity.country, scanData.spoofedLat, scanData.spoofedLon, visibleAps]);

  // Render D3.js Radial Geo-Triangulation Spoofing Radar
  useEffect(() => {
    if (!enabled || !radarRef.current) return;

    const svg = d3.select(radarRef.current);
    svg.selectAll('*').remove();

    const size = 216;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 84;
    const maxDistM = Math.max(
      90,
      d3.max(visibleAps, (a) => a.distanceMeters) ?? 120
    );

    svg.attr('viewBox', `0 0 ${size} ${size}`);

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    const rScale = d3.scaleLinear().domain([0, maxDistM]).range([10, maxR]);

    // Concentric distance rings
    [0.33, 0.66, 1].forEach((ratio) => {
      g.append('circle')
        .attr('r', maxR * ratio)
        .attr('fill', 'none')
        .attr('stroke', '#334155')
        .attr('stroke-opacity', 0.45)
        .attr('stroke-dasharray', ratio < 1 ? '2,3' : 'none');
    });

    // Crosshairs N/S/E/O
    g.append('line')
      .attr('x1', -maxR)
      .attr('x2', maxR)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.35);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', -maxR)
      .attr('y2', maxR)
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.35);

    // Compass labels
    [
      { label: 'N', x: 0, y: -maxR - 8 },
      { label: 'E', x: maxR + 10, y: 3 },
      { label: 'S', x: 0, y: maxR + 13 },
      { label: 'O', x: -maxR - 10, y: 3 },
    ].forEach((c) => {
      g.append('text')
        .attr('x', c.x)
        .attr('y', c.y)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '8.5px')
        .attr('font-family', 'monospace')
        .text(c.label);
    });

    // Triangulation vectors & AP markers
    visibleAps.forEach((ap) => {
      const theta = ((ap.azimuthDeg - 90) * Math.PI) / 180;
      const distR = rScale(ap.distanceMeters);
      const px = Math.cos(theta) * distR;
      const py = Math.sin(theta) * distR;

      const color =
        ap.rssiDbm >= -56
          ? '#10b981'
          : ap.rssiDbm >= -70
            ? '#38bdf8'
            : '#f59e0b';

      const isHovered = hoveredApId === ap.id;

      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', px)
        .attr('y2', py)
        .attr('stroke', color)
        .attr('stroke-width', isHovered ? 1.8 : 1)
        .attr('stroke-opacity', isHovered ? 0.9 : 0.35);

      g.append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', isHovered ? 6 : 4.2)
        .attr('fill', color)
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.4)
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHoveredApId(ap.id))
        .on('mouseleave', () => setHoveredApId(null));
    });

    // Spoofed gateway receiver centroid
    g.append('circle')
      .attr('r', 4.5)
      .attr('fill', '#22d3ee')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5);
  }, [enabled, visibleAps, hoveredApId]);

  const avgRssi = useMemo(() => {
    if (visibleAps.length === 0) return 0;
    return Math.round(
      visibleAps.reduce((s, a) => s + a.rssiDbm, 0) / visibleAps.length
    );
  }, [visibleAps]);

  return (
    <section
      id="wifi-geo-spoofing"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              enabled
                ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/25 text-cyan-600 dark:text-cyan-400'
                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400'
            }`}
          >
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Wi-Fi Geo-Spoofing (Trilatération ancrée sur passerelle)
              </h4>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {enabled
                  ? `${identity.city} (${scanData.spoofedLat.toFixed(4)}, ${scanData.spoofedLon.toFixed(4)})`
                  : 'Balayage géolocalisé inactif'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Synthétise des réseaux sans fil fictifs dont les signaux RSSI (modèle d’atténuation urbaine) et préfixes opérateurs correspondent à la géolocalisation de la passerelle active.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!enabled || isMasking || isRotating}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isMasking || isRotating ? 'animate-spin text-cyan-500' : ''}`}
            />
            <span>Régénérer balayage</span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Activer Wi-Fi Geo-Spoofing"
            onClick={() => onToggle?.(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {enabled ? (
        <div className="space-y-4">
          {/* Controls & Gateway Coordinates Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-white">
                {scanData.anchor.district}
              </span>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span>Moy RSSI {avgRssi} dBm</span>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span>{visibleAps.length} PA synthétiques</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                {([150, 450, 1200] as DispersionRadiusM[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusM(r)}
                    className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums font-medium cursor-pointer transition-colors ${
                      radiusM === r
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {r >= 1000 ? `${(r / 1000).toFixed(1)} km` : `${r} m`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                {(
                  [
                    { id: 'all', label: 'Toutes' },
                    { id: 'high', label: '5/6 GHz' },
                    { id: 'low', label: '2.4 GHz' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBandFilter(tab.id)}
                    className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                      bandFilter === tab.id
                        ? 'bg-slate-900 dark:bg-slate-700 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyGeoPayload}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-cyan-500 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {copiedPayload ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-cyan-500" />
                )}
                <span>{copiedPayload ? 'JSON copié' : 'Copier JSON MLS'}</span>
              </button>
            </div>
          </div>

          {/* Radar + Plausible Network List */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            <div className="xl:col-span-4 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-between">
              <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Radar Trilatération RF</span>
                <span className="text-cyan-400">Rayon {radiusM} m</span>
              </div>

              <svg
                ref={radarRef}
                className="w-[216px] h-[216px] my-1 select-none"
                role="img"
                aria-label="Radar polaire D3.js des réseaux Wi-Fi géolocalisés autour de la passerelle"
              />

              <div className="w-full text-[11px] font-mono tabular-nums text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>
                  {hoveredApId
                    ? visibleAps.find((a) => a.id === hoveredApId)?.ssid ?? ''
                    : 'Survolez un point d’accès'}
                </span>
                <span className="text-emerald-400">
                  {hoveredApId
                    ? `${visibleAps.find((a) => a.id === hoveredApId)?.rssiDbm ?? 0} dBm`
                    : `${identity.city}`}
                </span>
              </div>
            </div>

            <div className="xl:col-span-8 overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/70 text-[11px] font-mono text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">SSID / Constructeur</th>
                    <th className="px-3 py-2 font-semibold">BSSID (OUI Régional)</th>
                    <th className="px-3 py-2 font-semibold">Position RF</th>
                    <th className="px-3 py-2 font-semibold">Bande</th>
                    <th className="px-3 py-2 font-semibold text-right">
                      RSSI · SNR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  {visibleAps.map((ap) => {
                    const isHover = hoveredApId === ap.id;
                    return (
                      <tr
                        key={ap.id}
                        onMouseEnter={() => setHoveredApId(ap.id)}
                        onMouseLeave={() => setHoveredApId(null)}
                        className={`transition-colors ${
                          isHover
                            ? 'bg-cyan-50/70 dark:bg-cyan-950/30'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-sans font-semibold text-slate-900 dark:text-white">
                            {ap.ssid}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {ap.vendor} · {ap.security}
                          </div>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-cyan-700 dark:text-cyan-400">
                          {ap.bssid}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                          <div>
                            {ap.distanceMeters} m · {ap.bearingLabel} ({ap.azimuthDeg}°)
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {ap.apLat.toFixed(4)}, {ap.apLon.toFixed(4)}
                          </div>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                          {ap.band} · Ch {ap.channel}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <div
                            className={`font-semibold ${
                              ap.rssiDbm >= -56
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : ap.rssiDbm >= -70
                                  ? 'text-cyan-600 dark:text-cyan-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {ap.rssiDbm} dBm
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            SNR {ap.snrDb} dB · {ap.qualityPct}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Wi-Fi Geo-Spoofing désactivé : sans vecteurs de signaux Wi-Fi synthétiques alignés sur {identity.city}, les API de géolocalisation navigateur peuvent corréler votre emplacement physique réel.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onToggle?.(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shrink-0 cursor-pointer"
          >
            Activer Wi-Fi Geo-Spoofing
          </button>
        </div>
      )}
    </section>
  );
};
