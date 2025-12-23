
import { VirtualIdentity, DeviceNode } from './types';

export const REALISTIC_USER_AGENTS = [
  {
    short: 'Chrome 124 / Windows 11',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.61 Safari/537.36',
    os: 'Windows 11 23H2',
    browser: 'Chrome',
    preciseVersion: '124.0.6367.61',
    build: '22631.3447',
    engine: 'Blink/WebKit'
  },
  {
    short: 'Safari 17.4 / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    os: 'macOS Sonoma 14.4.1',
    browser: 'Safari',
    preciseVersion: '17.4.1',
    build: '23E224',
    engine: 'WebKit/605.1.15'
  },
  {
    short: 'Firefox 125 / Linux',
    full: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    os: 'Ubuntu 22.04.4 LTS',
    browser: 'Firefox',
    preciseVersion: '125.0.2',
    build: '20240419144423',
    engine: 'Gecko/Quantum'
  },
  {
    short: 'Safari / iPhone iOS 17.4',
    full: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    os: 'iOS 17.4.1',
    browser: 'Mobile Safari',
    preciseVersion: '17.4.1',
    build: '21E236',
    engine: 'WebKit/605.1.15'
  },
  {
    short: 'Chrome 124 / Android 14',
    full: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.231105.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
    os: 'Android 14 (Upside Down Cake)',
    browser: 'Chrome Mobile',
    preciseVersion: '124.0.6367.82',
    build: 'UD1A.231105.004',
    engine: 'Blink/124.0.0.0'
  }
];

export const generateRandomMac = () => {
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

  const useVendor = Math.random() > 0.4;
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
        // Values: x2, x6, xA, xE
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
    // Cisco Dot Format: XXXX.XXXX.XXXX
    const combined = macBytes.join('').toLowerCase();
    return `${combined.slice(0,4)}.${combined.slice(4,8)}.${combined.slice(8,12)}`;
  }
};

export const MOCK_IDENTITIES: VirtualIdentity[] = [
  { ip: '192.168.1.105', country: 'France', city: 'Paris', mac: '00:1B:44:11:3A:B7', userAgentShort: 'Chrome 124 / Windows 11', latency: 12, timezone: 'UTC+1' },
  { ip: '45.33.22.11', country: 'Suisse', city: 'Zürich', mac: 'AC:DE:48:23:45:67', userAgentShort: 'Firefox 125 / Linux', latency: 24, timezone: 'UTC+1' },
  { ip: '104.28.11.5', country: 'Singapour', city: 'Singapore', mac: '0014.22ef.6816', userAgentShort: 'Safari 17.4 / macOS', latency: 145, timezone: 'UTC+8' },
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
