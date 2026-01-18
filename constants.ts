
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
  },
  {
    short: 'Opera 109 / Windows 11',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 OPR/109.0.5097.68',
    os: 'Windows 11 Home 23H2',
    browser: 'Opera 109.0',
    preciseVersion: '109.0.5097.68',
    build: '22631.3447',
    engine: 'Blink/Chromium 123'
  },
  {
    short: 'Chrome 124 / Ubuntu',
    full: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.60 Safari/537.36',
    os: 'Ubuntu 24.04 LTS (Noble)',
    browser: 'Chrome 124.0.6367',
    preciseVersion: '124.0.6367.60',
    build: '6.8.0-31-generic',
    engine: 'Blink/124.0.0.0'
  }
];

export const generateRandomMac = (forceLAA: boolean = false) => {
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
    "52:54:00"  // QEMU/KVM
  ];

  const useVendor = forceLAA ? false : Math.random() > 0.4;
  let macBytes: string[] = [];

  if (useVendor) {
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    macBytes = vendor.split(':');
    while (macBytes.length < 6) {
      macBytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
    }
  } else {
    // Generate LAA (Locally Administered Address)
    for (let i = 0; i < 6; i++) {
      let b1 = hex[Math.floor(Math.random() * 16)];
      let b2 = hex[Math.floor(Math.random() * 16)];
      if (i === 0) {
        // Force Unicast (bit 0 = 0) and Local (bit 1 = 1)
        // Values for second nibble: 2, 6, A, E
        const laaNibbles = ['2', '6', 'A', 'E'];
        b2 = laaNibbles[Math.floor(Math.random() * 4)];
      }
      macBytes.push(b1 + b2);
    }
  }

  const formatRand = Math.random();
  if (formatRand < 0.5) {
    return macBytes.join(':').toUpperCase();
  } else if (formatRand < 0.75) {
    return macBytes.join('-').toUpperCase();
  } else {
    const combined = macBytes.join('').toLowerCase();
    return `${combined.slice(0,4)}.${combined.slice(4,8)}.${combined.slice(8,12)}`;
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
  { id: 'n6', name: 'IS-REY-01', type: 'server', status: 'active', signalStrength: 92, transferRate: 110, latency: 38, autonomyProfile: 'balanced', tags: ['arctic'], ip: '157.1.2.3', country: 'Islande' },
  { id: 'n7', name: 'EE-TAL-01', type: 'desktop', status: 'active', signalStrength: 88, transferRate: 85, latency: 42, autonomyProfile: 'balanced', tags: ['secure'], ip: '193.40.5.1', country: 'Estonie' },
  { id: 'n8', name: 'PA-PAN-01', type: 'server', status: 'active', signalStrength: 90, transferRate: 95, latency: 115, autonomyProfile: 'provider', tags: ['offshore'], ip: '190.1.2.3', country: 'Panama' },
];

export const INITIAL_LOGS = [
  { id: '1', timestamp: '10:00:01', timestampRaw: Date.now(), event: 'Système initialisé', type: 'info' as const },
  { id: '2', timestamp: '10:00:02', timestampRaw: Date.now(), event: 'Module de cryptage chargé', type: 'success' as const },
];
