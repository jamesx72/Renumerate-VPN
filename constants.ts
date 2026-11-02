
import { VirtualIdentity, DeviceNode } from './types';

export const REALISTIC_USER_AGENTS = [
  {
    short: 'Chrome 124 / Windows 11',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Safari/537.36',
    os: 'Windows 11 Pro 23H2',
    browser: 'Chrome 124.0.6367',
    engine: 'Blink (V8 12.4.254)'
  },
  {
    short: 'Safari 17.5 / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    os: 'macOS Sonoma 14.5.0',
    browser: 'Safari 17.5',
    engine: 'WebKit/605.1.15'
  },
  {
    short: 'Firefox 126 / Fedora',
    full: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
    os: 'Fedora Linux 40',
    browser: 'Firefox 126.0',
    engine: 'Gecko/126.0'
  },
  {
    short: 'Edge 124 / Windows 10',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
    os: 'Windows 10 Enterprise',
    browser: 'Edge 124.0.2478',
    engine: 'Blink (Chromium 124)'
  },
  {
    short: 'Chrome 125 / Android 14',
    full: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro Build/AP1A.240405.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.52 Mobile Safari/537.36',
    os: 'Android 14 (Upside Down Cake)',
    browser: 'Chrome Mobile 125',
    engine: 'Blink/125.0.0.0'
  },
  {
    short: 'Safari / iPhone iOS 17.5',
    full: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    os: 'iOS 17.5.1',
    browser: 'Mobile Safari 17.5',
    engine: 'WebKit/605.1.15'
  },
  {
    short: 'Vivaldi 6.7 / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Vivaldi/6.7.3329.21',
    os: 'macOS Catalina 10.15.7',
    browser: 'Vivaldi 6.7',
    engine: 'Blink (V8 12.4)'
  },
  {
    short: 'Brave 1.66 / Windows 11',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Brave/1.66.110',
    os: 'Windows 11 Home',
    browser: 'Brave 1.66',
    engine: 'Blink (Chromium 125)'
  },
  {
    short: 'Arc Browser / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    os: 'macOS Sonoma 14.2',
    browser: 'Arc 1.44',
    engine: 'Blink (Chromium 125)'
  },
  {
    short: 'Firefox 125 / Android',
    full: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
    os: 'Android 14 (One UI 6.1)',
    browser: 'Firefox Mobile 125',
    engine: 'Gecko/125.0'
  }
];

export const generateRandomMac = (
  mode: 'vendor' | 'laa' | 'random' = 'random',
  format: 'standard' | 'hyphen' | 'cisco' | 'random' = 'random'
) => {
  const hex = "0123456789ABCDEF";
  const vendors = [
    "00:00:0C", "00:05:02", "00:0C:F1", "00:16:3E", "00:50:56", "3C:5A:B4", "00:14:22", "00:10:18", "E0:D5:5E", "52:54:00", "00:15:5D", "08:00:27"
  ];
  let bytes: string[] = [];
  if (mode === 'vendor') {
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    bytes = vendor.split(':');
    while (bytes.length < 6) bytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
  } else if (mode === 'laa') {
    const firstDigit = hex[Math.floor(Math.random() * 16)];
    const secondDigit = ['2', '6', 'A', 'E'][Math.floor(Math.random() * 4)];
    bytes.push(firstDigit + secondDigit);
    for (let i = 1; i < 6; i++) bytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
  } else {
    for (let i = 0; i < 6; i++) bytes.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
  }
  let finalFormat = format;
  if (format === 'random') {
    const r = Math.random();
    if (r < 0.4) finalFormat = 'standard';
    else if (r < 0.7) finalFormat = 'hyphen';
    else finalFormat = 'cisco';
  }
  if (finalFormat === 'standard') return bytes.join(':').toUpperCase();
  if (finalFormat === 'hyphen') return bytes.join('-').toUpperCase();
  const flat = bytes.join('').toLowerCase();
  return `${flat.slice(0, 4)}.${flat.slice(4, 8)}.${flat.slice(8, 12)}`;
};

export const MOCK_IDENTITIES: VirtualIdentity[] = [
  { ip: '185.212.149.42', country: 'France', city: 'Paris', mac: '00:1B:44:11:3A:B7', userAgentShort: 'Chrome 124 / Windows 11', latency: 12, timezone: 'UTC+1' },
  { ip: '179.43.168.24', country: 'Suisse', city: 'Zürich', mac: 'AC:DE:48:23:45:67', userAgentShort: 'Firefox 126 / Fedora', latency: 21, timezone: 'UTC+1' },
  { ip: '82.221.105.19', country: 'Islande', city: 'Reykjavik', mac: '3C:5A:B4:91:0E:44', userAgentShort: 'Brave 1.66 / Windows 11', latency: 38, timezone: 'UTC+0' },
  { ip: '91.198.174.66', country: 'Allemagne', city: 'Francfort', mac: '00:50:56:C0:00:08', userAgentShort: 'Chrome 124 / Windows 11', latency: 16, timezone: 'UTC+1' },
  { ip: '185.65.134.88', country: 'Estonie', city: 'Tallinn', mac: '52:54:00:4A:92:1B', userAgentShort: 'Firefox 126 / Fedora', latency: 34, timezone: 'UTC+2' },
  { ip: '198.54.131.70', country: 'USA', city: 'New York', mac: '00:16:3E:7F:21:C9', userAgentShort: 'Arc Browser / macOS', latency: 76, timezone: 'UTC-5' },
  { ip: '190.14.37.112', country: 'Panama', city: 'Panama City', mac: 'E0:D5:5E:8B:44:10', userAgentShort: 'Safari 17.5 / macOS', latency: 118, timezone: 'UTC-5' },
  { ip: '103.253.41.90', country: 'Singapour', city: 'Singapour', mac: '0014.22ef.6816', userAgentShort: 'Safari 17.5 / macOS', latency: 145, timezone: 'UTC+8' },
];

export const MOCK_NODES: DeviceNode[] = [
  { id: 'n1', name: 'FR-PAR-01', type: 'server', status: 'active', signalStrength: 98, transferRate: 185, latency: 12, autonomyProfile: 'provider', tags: ['fast'], ip: '185.212.149.42', country: 'France', city: 'Paris', lat: 48.8566, lon: 2.3522, timezone: 'UTC+1' },
  { id: 'n2', name: 'FR-LYO-02', type: 'desktop', status: 'active', signalStrength: 89, transferRate: 74, latency: 17, autonomyProfile: 'balanced', tags: ['relay'], ip: '185.212.151.18', country: 'France', city: 'Lyon', lat: 45.764, lon: 4.8357, timezone: 'UTC+1' },
  { id: 'n3', name: 'CH-ZUR-01', type: 'server', status: 'active', signalStrength: 97, transferRate: 210, latency: 21, autonomyProfile: 'provider', tags: ['stealth', 'exit'], ip: '179.43.168.24', country: 'Suisse', city: 'Zürich', lat: 47.3769, lon: 8.5417, timezone: 'UTC+1' },
  { id: 'n4', name: 'CH-GEN-02', type: 'server', status: 'active', signalStrength: 93, transferRate: 145, latency: 24, autonomyProfile: 'provider', tags: ['stealth'], ip: '179.43.170.85', country: 'Suisse', city: 'Genève', lat: 46.2044, lon: 6.1432, timezone: 'UTC+1' },
  { id: 'n5', name: 'DE-FRA-01', type: 'server', status: 'active', signalStrength: 99, transferRate: 240, latency: 16, autonomyProfile: 'provider', tags: ['fast'], ip: '91.198.174.66', country: 'Allemagne', city: 'Francfort', lat: 50.1109, lon: 8.6821, timezone: 'UTC+1' },
  { id: 'n6', name: 'IS-REY-01', type: 'server', status: 'active', signalStrength: 94, transferRate: 160, latency: 38, autonomyProfile: 'provider', tags: ['stealth', 'exit'], ip: '82.221.105.19', country: 'Islande', city: 'Reykjavik', lat: 64.1466, lon: -21.9426, timezone: 'UTC+0' },
  { id: 'n7', name: 'EE-TAL-01', type: 'server', status: 'active', signalStrength: 91, transferRate: 135, latency: 34, autonomyProfile: 'balanced', tags: ['relay'], ip: '185.65.134.88', country: 'Estonie', city: 'Tallinn', lat: 59.437, lon: 24.7536, timezone: 'UTC+2' },
  { id: 'n8', name: 'US-NYC-01', type: 'server', status: 'active', signalStrength: 92, transferRate: 195, latency: 76, autonomyProfile: 'provider', tags: ['exit'], ip: '198.54.131.70', country: 'USA', city: 'New York', lat: 40.7128, lon: -74.006, timezone: 'UTC-5' },
  { id: 'n9', name: 'PA-PTY-01', type: 'iot', status: 'active', signalStrength: 82, transferRate: 68, latency: 118, autonomyProfile: 'balanced', tags: ['stealth'], ip: '190.14.37.112', country: 'Panama', city: 'Panama City', lat: 8.9824, lon: -79.5199, timezone: 'UTC-5' },
  { id: 'n10', name: 'SG-SIN-01', type: 'server', status: 'active', signalStrength: 96, transferRate: 205, latency: 145, autonomyProfile: 'provider', tags: ['exit'], ip: '103.253.41.90', country: 'Singapour', city: 'Singapour', lat: 1.3521, lon: 103.8198, timezone: 'UTC+8' },
];

export const INITIAL_LOGS = [
  { id: '1', timestamp: '10:00:01', timestampRaw: Date.now(), event: 'Système Renumerate initialisé', type: 'info' as const },
  { id: '2', timestamp: '10:00:02', timestampRaw: Date.now(), event: 'Moteur de re-numérotation chargé', type: 'success' as const },
  { id: '3', timestamp: '10:00:03', timestampRaw: Date.now(), event: 'Protocole WireGuard optimisé (Vitesse & Fiabilité max) sélectionné par défaut', type: 'info' as const },
];
