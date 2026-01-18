
import { VirtualIdentity, DeviceNode } from './types';

export const REALISTIC_USER_AGENTS = [
  {
    short: 'Chrome 124 / Windows 11',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Safari/537.36',
    os: 'Windows 11 Pro 23H2',
    browser: 'Chrome 124.0.6367',
    preciseVersion: '124.0.6367.118',
    build: '22631.3527',
    engine: 'Blink (V8 12.4.254)'
  },
  {
    short: 'Safari 17.5 / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    os: 'macOS Sonoma 14.5.0',
    browser: 'Safari 17.5',
    preciseVersion: '17.5 (19618.2.12.11.6)',
    build: '23F79',
    engine: 'WebKit/605.1.15'
  },
  {
    short: 'Edge 124 / Windows 10',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
    os: 'Windows 10 Enterprise 22H2',
    browser: 'Edge 124.0.2478',
    preciseVersion: '124.0.2478.80',
    build: '19045.4291',
    engine: 'Blink (Chromium 124)'
  },
  {
    short: 'Firefox 126 / Fedora',
    full: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
    os: 'Fedora Linux 40 (Workstation)',
    browser: 'Firefox 126.0',
    preciseVersion: '126.0.1',
    build: 'fc40.x86_64',
    engine: 'Gecko/20240514'
  },
  {
    short: 'Chrome 125 / Android 14',
    full: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro Build/AP1A.240405.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.52 Mobile Safari/537.36',
    os: 'Android 14 (UPS1.231105.002)',
    browser: 'Chrome Mobile 125',
    preciseVersion: '125.0.6422.52',
    build: 'AP1A.240405.002',
    engine: 'Blink/125.0.0.0'
  },
  {
    short: 'Safari / iPhone iOS 17.5',
    full: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    os: 'iOS 17.5.1 (stable)',
    browser: 'Mobile Safari 17.5',
    preciseVersion: '17.5.1 (21F90)',
    build: '21F90',
    engine: 'WebKit/605.1.15'
  }
];

export const generateRandomMac = (
  mode: 'vendor' | 'laa' | 'random' = 'random',
  format: 'standard' | 'hyphen' | 'cisco' | 'random' = 'random'
) => {
  const hex = "0123456789ABCDEF";
  const vendors = [
    "00:05:02", // Apple
    "00:0C:F1", // Intel
    "00:16:3E", // Xen
    "00:50:56", // VMware
    "00:00:0C", // Cisco
    "3C:5A:B4", // Samsung
    "00:14:22", // Dell
    "00:10:18", // Broadcom
    "E0:D5:5E", // Giga-Byte
    "52:54:00", // QEMU/KVM
    "00:15:5D", // Microsoft
    "08:00:27"  // VirtualBox
  ];

  let bytes: string[] = [];
  
  if (mode === 'vendor') {
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    bytes = vendor.split(':');
    while (bytes.length < 6) {
      bytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
    }
  } else if (mode === 'laa') {
    const b1_1 = hex[Math.floor(Math.random() * 16)];
    const b1_2 = ['2', '6', 'A', 'E'][Math.floor(Math.random() * 4)];
    bytes.push(b1_1 + b1_2);
    for (let i = 1; i < 6; i++) {
      bytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      bytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
    }
  }

  // Determine final format
  let finalFormat = format;
  if (format === 'random') {
    const r = Math.random();
    finalFormat = r < 0.35 ? 'standard' : r < 0.65 ? 'hyphen' : 'cisco';
  }

  if (finalFormat === 'standard') {
    return bytes.join(':').toUpperCase();
  } else if (finalFormat === 'hyphen') {
    return bytes.join('-').toUpperCase();
  } else {
    // Cisco format: xxxx.xxxx.xxxx
    const flat = bytes.join('').toLowerCase();
    return `${flat.slice(0, 4)}.${flat.slice(4, 8)}.${flat.slice(8, 12)}`;
  }
};

export const MOCK_IDENTITIES: VirtualIdentity[] = [
  { ip: '192.168.1.105', country: 'France', city: 'Paris', mac: '00:1B:44:11:3A:B7', userAgentShort: 'Chrome 124 / Windows 11', latency: 12, timezone: 'UTC+1' },
  { ip: '45.33.22.11', country: 'Suisse', city: 'Zürich', mac: 'AC:DE:48:23:45:67', userAgentShort: 'Firefox 126 / Fedora', latency: 24, timezone: 'UTC+1' },
  { ip: '104.28.11.5', country: 'Singapour', city: 'Singapore', mac: '0014.22ef.6816', userAgentShort: 'Safari 17.5 / macOS', latency: 145, timezone: 'UTC+8' },
];

export const MOCK_NODES: DeviceNode[] = [
  { id: 'n1', name: 'FR-PAR-01', type: 'server', status: 'active', signalStrength: 98, transferRate: 120, latency: 12, autonomyProfile: 'provider', tags: ['fast'], ip: '192.168.1.105', country: 'France' },
  { id: 'n2', name: 'FR-LYO-02', type: 'desktop', status: 'idle', signalStrength: 85, transferRate: 45, latency: 18, autonomyProfile: 'balanced', tags: ['relay'], ip: '192.168.1.201', country: 'France' },
  { id: 'n3', name: 'CH-ZUR-01', type: 'server', status: 'active', signalStrength: 95, transferRate: 150, latency: 24, autonomyProfile: 'provider', tags: ['stealth'], ip: '45.33.22.11', country: 'Suisse' },
  { id: 'n4', name: 'CH-GEN-01', type: 'mobile', status: 'active', signalStrength: 70, transferRate: 20, latency: 32, autonomyProfile: 'consumer', tags: ['dynamic'], ip: '45.33.22.45', country: 'Suisse' },
  { id: 'n5', name: 'SG-CEN-01', type: 'server', status: 'active', signalStrength: 99, transferRate: 200, latency: 145, autonomyProfile: 'provider', tags: ['exit'], ip: '104.28.11.5', country: 'Singapour' },
];

export const INITIAL_LOGS = [
  { id: '1', timestamp: '10:00:01', timestampRaw: Date.now(), event: 'Système Renumerate initialisé', type: 'info' as const },
  { id: '2', timestamp: '10:00:02', timestampRaw: Date.now(), event: 'Moteur de re-numérotation chargé', type: 'success' as const },
];
