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
  ip?: string;
}

export type PlanTier = 'free' | 'pro' | 'elite';

export type ConfigurationPreset =
  | 'balanced'
  | 'stealth_max'
  | 'speed_ultra'
  | 'vortex_deep'
  | 'zero_trace';

export interface SplitTunnelRule {
  id: string;
  target: string;
  type: 'domain' | 'cidr' | 'app';
  policy: 'bypass' | 'vpn_only';
  enabled: boolean;
}

export interface ThreatFilterConfig {
  ads: boolean;
  trackers: boolean;
  malware: boolean;
  cryptominers: boolean;
}

export interface FingerprintProtectionConfig {
  canvasNoise: boolean;
  webglMask: boolean;
  audioContextSpoof: boolean;
  timezoneSync: boolean;
}

export interface SavedSettingsProfile {
  id: string;
  name: string;
  createdAt: string;
  settings: AppSettings;
}

export interface AppSettings {
  protocol: 'wireguard' | 'openvpn' | 'ikev2';
  tunnelPort: 51820 | 443 | 1194 | 500 | 8443;
  dns: 'cloudflare' | 'google' | 'quad9' | 'opendns' | 'custom';
  customDnsServer: string;
  killSwitch: boolean;
  killSwitchMode: 'strict' | 'soft';
  dnsLeakProtection: boolean;
  webrtcLeakShield: boolean;
  dnsCache: boolean;
  autoReconnect: boolean;
  reconnectDelay: number;
  splitTunneling: boolean;
  splitTunnelRules: SplitTunnelRule[];
  adBlocker: boolean;
  threatFilters: ThreatFilterConfig;
  customBlockedDomains: string[];
  autoConnect: boolean;
  // Renumbering Config
  autoRotation: boolean;
  rotationInterval: number; // en minutes
  obfuscationLevel: 'standard' | 'high' | 'ultra';
  macScramblingMode: 'vendor' | 'laa' | 'random';
  macFormat: 'standard' | 'hyphen' | 'cisco' | 'random';
  uaComplexity: 'standard' | 'diverse' | 'chaotic';
  fingerprintProtection: FingerprintProtectionConfig;
  // Vortex (Tor) Config & Jurisdictions
  vortexBridge: 'none' | 'obfs4' | 'snowflake' | 'meek-azure';
  vortexCircuitLength: number;
  vortexEntryNodeCountry: string;
  vortexExitNodeCountry: string;
  vortexNoScript: boolean;
  excludeEyesJurisdictions: 'none' | '5-eyes' | '14-eyes';
  // Earning & Withdrawal Configurations
  miningIntensity: number;
  yieldOptimizationIA: boolean;
  contributionType: 'passive' | 'relay' | 'exit';
  autoWithdraw: boolean;
  autoWithdrawThreshold: number;
  autoWithdrawAddress: string;
  autoWithdrawMethod: WithdrawalMethod;
  autoWithdrawSubNetwork: WithdrawalSubNetwork;
  autoWithdrawReserve: number;
  preferredFiat: FiatCurrency;
  // Advanced & System Settings
  mtuSize: number;
  ipv6LeakProtection: boolean;
  localNetworkSharing: boolean;
  lanBypass: boolean;
  logRetentionHours: number;
  keyboardShortcutsEnabled: boolean;
  // SOCKS5 Proxy Config
  socks5Enabled: boolean;
  socks5Host: string;
  socks5Port: number;
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
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
}

export type WithdrawalMethod =
  | 'crypto'
  | 'mobile_money'
  | 'paypal'
  | 'bank_transfer';

export type CryptoNetwork =
  | 'polygon'
  | 'trc20'
  | 'solana'
  | 'lightning'
  | 'erc20';

export type MobileMoneyProvider =
  | 'wave'
  | 'orange_money'
  | 'mtn_momo'
  | 'moov';

export type WithdrawalSubNetwork =
  | CryptoNetwork
  | MobileMoneyProvider
  | 'paypal_instant'
  | 'sepa';

export type WithdrawalExecutionMode = 'instant' | 'standard';

export type FiatCurrency = 'EUR' | 'USD' | 'XOF';

export interface SavedBeneficiary {
  id: string;
  label: string;
  method: WithdrawalMethod;
  subNetwork: WithdrawalSubNetwork;
  address: string;
  accountHolder?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  method: WithdrawalMethod;
  subNetwork?: WithdrawalSubNetwork;
  networkLabel?: string;
  executionMode?: 'instant' | 'standard' | 'auto';
  amount: number;
  feeRnc?: number;
  netAmountRnc?: number;
  fiatCurrency?: FiatCurrency;
  fiatAmount?: number;
  exchangeRate?: number;
  status: 'completed' | 'processing' | 'cancelled' | 'failed';
  address: string;
  accountHolder?: string;
  txHash?: string;
  date: string;
  createdAt?: number;
  etaSeconds?: number;
}

export interface ConnectionSession {
  id: string;
  serverCountry: string;
  serverIp: string;
  startTime: number;
  protocol: string;
  mode: string;
  durationString: string;
}
