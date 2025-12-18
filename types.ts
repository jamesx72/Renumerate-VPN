
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
  SMART_DNS = 'Smart DNS'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  timestampRaw: number;
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

export interface ConnectionSession {
  id: string;
  startTime: number;
  endTime: number;
  durationString: string;
  serverCountry: string;
  serverIp: string;
  protocol: string;
  mode: ConnectionMode;
  dataUsed?: string;
}

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
  autoRotation: boolean;
  rotationInterval: number;
  obfuscationLevel: 'standard' | 'high' | 'ultra';
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

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  name: string;
  last4?: string;
  expiry?: string;
  isDefault: boolean;
}
