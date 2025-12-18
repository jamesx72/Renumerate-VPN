
import { VirtualIdentity } from './types';

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
  },
  {
    short: 'Edge 124 / Windows 10',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.51',
    os: 'Windows 10 22H2',
    browser: 'Edge',
    preciseVersion: '124.0.2478.51',
    build: '19045.4291',
    engine: 'Blink/Chromium'
  }
];

export const generateRandomMac = () => {
  const hexDigits = "0123456789ABCDEF";
  let mac = "";
  for (let i = 0; i < 6; i++) {
    let n1 = hexDigits[Math.floor(Math.random() * 16)];
    let n2 = hexDigits[Math.floor(Math.random() * 16)];
    if (i === 0) {
      n2 = hexDigits[(Math.floor(Math.random() * 4) * 4) + 2];
    }
    mac += n1 + n2 + (i === 5 ? "" : ":");
  }
  return mac;
};

export const MOCK_IDENTITIES: VirtualIdentity[] = [
  { ip: '192.168.1.105', country: 'France', city: 'Paris', mac: '00:1B:44:11:3A:B7', userAgentShort: 'Chrome 124 / Windows 11', latency: 12, timezone: 'UTC+1' },
  { ip: '45.33.22.11', country: 'Suisse', city: 'Zürich', mac: 'AC:DE:48:23:45:67', userAgentShort: 'Firefox 125 / Linux', latency: 24, timezone: 'UTC+1' },
  { ip: '104.28.11.5', country: 'Singapour', city: 'Singapore', mac: '00:0a:95:9d:68:16', userAgentShort: 'Safari 17.4 / macOS', latency: 145, timezone: 'UTC+8' },
  { ip: '185.200.118.44', country: 'Islande', city: 'Reykjavik', mac: '52:54:00:12:34:56', userAgentShort: 'Edge 124 / Windows 10', latency: 56, timezone: 'UTC+0' },
  { ip: '89.10.22.114', country: 'Panama', city: 'Panama City', mac: '00:50:56:C0:00:08', userAgentShort: 'Chrome 124 / Android 14', latency: 112, timezone: 'UTC-5' },
  { ip: '5.196.33.20', country: 'Estonie', city: 'Tallinn', mac: '02:42:AC:11:00:02', userAgentShort: 'Firefox 125 / Linux', latency: 45, timezone: 'UTC+2' },
];

export const INITIAL_LOGS = [
  { id: '1', timestamp: '10:00:01', timestampRaw: Date.now(), event: 'Système initialisé', type: 'info' as const },
  { id: '2', timestamp: '10:00:02', timestampRaw: Date.now(), event: 'Module de cryptage chargé', type: 'success' as const },
];
