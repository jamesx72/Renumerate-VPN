
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
  STEALTH = 'Stealth',
  DOUBLE_HOP = 'Double Hop',
  SMART_DNS = 'Smart DNS',
  ONION_VORTEX = 'Onion Vortex'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  timestampRaw: number;
  event: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

export type PlanTier = 'free' | 'pro' | 'elite';

export interface AppSettings {
  protocol: 'wireguard' | 'openvpn' | 'ikev2';
  dns: 'cloudflare' | 'google' | 'quad9' | 'opendns' | 'custom';
  killSwitch: boolean;
  dnsLeakProtection: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  splitTunneling: boolean;
  adBlocker: boolean;
  autoConnect: boolean;
  // Renumbering Config
  autoRotation: boolean;
  rotationInterval: number; // en minutes
  obfuscationLevel: 'standard' | 'high' | 'ultra';
  macScramblingMode: 'vendor' | 'laa' | 'random';
  uaComplexity: 'standard' | 'diverse' | 'chaotic';
  // Earning Configurations
  miningIntensity: number; 
  yieldOptimizationIA: boolean;
  contributionType: 'passive' | 'relay' | 'exit';
  autoWithdraw: boolean;
  // Advanced Settings
  mtuSize: number;
  ipv6LeakProtection: boolean;
  localNetworkSharing: boolean;
  logRetentionHours: number;
}

export interface DeviceNode {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'iot' | 'server';
  status: 'active' | 'idle' | 'syncing' | 'disconnected';
  signalStrength: number;
  transferRate: number;
  latency: number;
  autonomyProfile: 'provider' | 'balanced' | 'consumer';
  tags: string[];
  ip: string;
  country: string;
}

// Fixed: Added missing Transaction interface
export interface Transaction {
  id: string;
  method: 'crypto' | 'paypal' | 'bank_transfer';
  amount: number;
  status: 'completed' | 'processing';
  address: string;
  date: string;
}

// Fixed: Added missing ConnectionSession interface
export interface ConnectionSession {
  id: string;
  serverCountry: string;
  serverIp: string;
  startTime: number;
  protocol: string;
  mode: string;
  durationString: string;
}
