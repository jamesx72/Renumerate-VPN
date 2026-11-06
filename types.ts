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
  engine?: 'gemini' | 'local-heuristic';
  quotaLimited?: boolean;
  quotaNotice?: string;
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

export type AnonymityLevel = 'low' | 'balanced' | 'extreme';

export type ConfigurationPreset =
  | 'balanced'
  | 'stealth_max'
  | 'speed_ultra'
  | 'vortex_deep'
  | 'zero_trace'
  | 'kernel_pqc';

export type TcpCongestionControl = 'bbr' | 'cubic' | 'hybla';

export type PostQuantumKex = 'ml-kem-1024' | 'sntrup761' | 'classic-x25519';

export type SystemPowerProfile = 'eco' | 'balanced' | 'performance';

export type PanicActionMode =
  | 'lockdown'
  | 'disconnect_wipe'
  | 'lock_vault_and_scramble';

export type TrafficPaddingJitterMs = 0 | 15 | 40 | 85;

export interface HostNetworkInterfaceInfo {
  name: string;
  family: 'IPv4' | 'IPv6';
  cidr: string;
  internal: boolean;
  mac: string;
  mtu: number;
}

export interface SystemRuntimeTelemetry {
  status: 'nominal' | 'degraded';
  timestamp: string;
  platform: string;
  arch: string;
  osType?: string;
  osRelease?: string;
  nodeVersion: string;
  cpuCores: number;
  loadAvg1m: number;
  uptimeSeconds: number;
  userCpuMs?: number;
  systemCpuMs?: number;
  monotonicClockOk?: boolean;
  memoryRssMb: number;
  memoryHeapUsedMb: number;
  memoryHeapTotalMb: number;
  cipherSuitesCount: number;
  pqcReady: boolean;
  interfaces?: HostNetworkInterfaceInfo[];
}

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

export interface SystemConfigSnapshot {
  id: string;
  name: string;
  createdAt: string;
  hardeningScore: number;
  protocol: AppSettings['protocol'];
  postQuantumKex: PostQuantumKex;
  settings: AppSettings;
}

export interface SignedSystemBundle {
  schemaVersion: 'renumerate-sys-v2';
  exportedAt: string;
  sha256: string;
  hmacSignature: string;
  hardeningScore: number;
  settings: AppSettings;
  manifests: Record<string, string>;
}

export interface ConfigurationAuditIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: string;
  category:
    | 'mtu_transport'
    | 'leak_killswitch'
    | 'pqc_kex'
    | 'tor_privacy'
    | 'performance_jitter'
    | 'dns'
    | 'security';
  patchLabel: string;
  patch: Partial<AppSettings>;
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
  anonymityLevel: AnonymityLevel;
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
  // Kernel, Post-Quantum KEX & Low-Level Transport
  tcpCongestionControl: TcpCongestionControl;
  postQuantumKex: PostQuantumKex;
  keepaliveInterval: number;
  mssClamping: boolean;
  multiQueueTun: boolean;
  // OS Egress & L2/L3 Hardening
  blockQuicUdp443: boolean;
  blockCaptivePortalProbes: boolean;
  arpSpoofGuard: boolean;
  strictReversePathFilter: boolean;
  // System Daemon Governance & Operational Hygiene
  powerProfile: SystemPowerProfile;
  autoLockVaultMinutes: number;
  clipboardAutoClearSeconds: number;
  privacyScreenBlurOnInactive: boolean;
  panicAction: PanicActionMode;
  // Advanced Kernel eBPF, Anti-DPI, PFS Rekeying & Memory Hardening
  ebpfXdpAcceleration: boolean;
  tlsClientHelloFragmentation: boolean;
  trafficPaddingJitterMs: TrafficPaddingJitterMs;
  ephemeralRekeyMinutes: number;
  strictMemoryLock: boolean;
  ntpDriftProtection: boolean;
  // Intrusion Attempt Detection System (IDS / Sentinelle HIDS/NIDS)
  idsEnabled: boolean;
  idsSensitivity: 'standard' | 'high' | 'paranoid';
  idsAutoQuarantine: boolean;
  idsAutoRenumberOnCritical: boolean;
  idsSoundAlert: boolean;
}

export interface DeviceNode {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'iot' | 'server';
  status: 'active' | 'idle' | 'syncing' | 'disconnected';
  signalStrength: number;
  transferRate: number;
  latency: number;
  jitter?: number;
  packetLoss?: number;
  asn?: string;
  loadPct?: number;
  probedAt?: string;
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

export type IntrusionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IntrusionVector =
  | 'port_scan'
  | 'arp_poisoning'
  | 'dns_hijack'
  | 'webrtc_leak'
  | 'replay_attack'
  | 'brute_force'
  | 'c2_beacon';

export type IntrusionDefenseAction =
  | 'drop_xdp'
  | 'nft_quarantine'
  | 'identity_scramble'
  | 'tunnel_rekey'
  | 'sinkhole';

export interface IntrusionAttempt {
  id: string;
  timestamp: string;
  severity: IntrusionSeverity;
  vector: IntrusionVector;
  title: string;
  description: string;
  sourceIp: string;
  sourceCountry?: string;
  targetPort: number;
  targetInterface: string;
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'ARP' | 'DNS';
  signatureRule: string;
  actionTaken: IntrusionDefenseAction;
  quarantined: boolean;
  rawPayloadSnippet?: string;
  remediationAdvice: string;
}

export interface QuarantinedHost {
  ip: string;
  bannedAt: string;
  reason: string;
  attemptsCount: number;
  vector: IntrusionVector;
  expiresInMinutes?: number | 'permanent';
}

export interface IdsTelemetryStats {
  engineStatus: 'active_xdp' | 'degraded_nft' | 'standby';
  sensitivity: 'standard' | 'high' | 'paranoid';
  totalBlockedAttempts: number;
  activeQuarantinesCount: number;
  lastIntrusionTime: string | null;
  shannonEntropyRate: number;
  activeRulesCount: number;
  customRulesCount?: number;
}

export type IdsRuleProtocol = 'ALL' | 'TCP' | 'UDP' | 'ICMP';
export type IdsRuleDirection = 'inbound' | 'outbound' | 'both';
export type IdsRuleAction = 'drop' | 'reject' | 'quarantine' | 'alert_only';

export interface IdsFilterRule {
  id: string;
  name: string;
  enabled: boolean;
  protocol: IdsRuleProtocol;
  ports?: string; // e.g. "23", "22, 3389", "8000-8080"
  ipRange?: string; // e.g. "198.51.100.0/24" or "45.142.214.12"
  direction: IdsRuleDirection;
  action: IdsRuleAction;
  severity: IntrusionSeverity;
  description?: string;
  hitsCount: number;
  lastHitAt?: string | null;
  createdAt: string;
  isSystemPreset?: boolean;
}


