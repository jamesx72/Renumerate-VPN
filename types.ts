
export interface VirtualIdentity {
  ip: string;
  country: string;
  city: string;
  mac: string;
  userAgentShort: string;
  latency: number;
  timezone: string;
}

export interface SecurityReport {
  score: number;
  threatLevel: 'Faible' | 'Moyen' | 'Élevé' | 'Critique';
  recommendations: string[];
  analysis: string;
}

export enum ConnectionMode {
  STANDARD = 'Standard',
  STEALTH = 'Furtif',
  DOUBLE_HOP = 'Double Hop',
  SMART_DNS = 'Smart DNS'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

export type PlanTier = 'free' | 'pro' | 'elite';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  method: 'crypto' | 'paypal' | 'bank_transfer';
  status: 'pending' | 'completed';
  address: string;
}

export interface AppSettings {
  protocol: 'wireguard' | 'openvpn' | 'ikev2';
  dns: 'cloudflare' | 'google' | 'quad9' | 'opendns' | 'custom';
  killSwitch: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  splitTunneling: boolean;
  adBlocker: boolean;
  autoConnect: boolean;
  autoRotation: boolean;
  rotationInterval: number;
  obfuscationLevel: 'standard' | 'high' | 'ultra';
  // Advanced Settings
  mtuSize: number;
  ipv6LeakProtection: boolean;
  localNetworkSharing: boolean;
}