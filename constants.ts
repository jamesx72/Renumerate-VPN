import { VirtualIdentity, LogEntry } from './types';

export const MOCK_IDENTITIES: VirtualIdentity[] = [
  { ip: '192.168.1.105', country: 'France', city: 'Paris', mac: '00:1B:44:11:3A:B7', userAgentShort: 'Chrome / Win10', latency: 12 },
  { ip: '45.33.22.11', country: 'Suisse', city: 'Zürich', mac: 'AC:DE:48:23:45:67', userAgentShort: 'Firefox / Linux', latency: 24 },
  { ip: '104.28.11.5', country: 'Singapour', city: 'Singapore', mac: '00:0a:95:9d:68:16', userAgentShort: 'Safari / macOS', latency: 145 },
  { ip: '185.200.118.44', country: 'Islande', city: 'Reykjavik', mac: '52:54:00:12:34:56', userAgentShort: 'Edge / Win11', latency: 56 },
  { ip: '89.10.22.114', country: 'Panama', city: 'Panama City', mac: '00:50:56:C0:00:08', userAgentShort: 'Brave / Android', latency: 112 },
  { ip: '5.196.33.20', country: 'Estonie', city: 'Tallinn', mac: '02:42:AC:11:00:02', userAgentShort: 'Firefox / Win10', latency: 45 },
];

export const INITIAL_LOGS: LogEntry[] = [
  { id: '1', timestamp: '10:00:01', event: 'Système initialisé', type: 'info' as const },
  { id: '2', timestamp: '10:00:02', event: 'Module de cryptage chargé', type: 'success' as const },
];