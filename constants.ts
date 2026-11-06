import {
  VirtualIdentity,
  DeviceNode,
  AppSettings,
  AnonymityLevel,
  SplitTunnelRule,
  PlanTier,
  WithdrawalMethod,
  WithdrawalSubNetwork,
  FiatCurrency,
  TcpCongestionControl,
  PostQuantumKex,
  SystemPowerProfile,
  PanicActionMode,
  TrafficPaddingJitterMs,
  ConfigurationAuditIssue,
  IntrusionAttempt,
  QuarantinedHost,
  IntrusionVector,
  IntrusionSeverity,
} from './types';

export const REALISTIC_USER_AGENTS = [
  {
    short: 'Chrome 124 / Windows 11',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Safari/537.36',
    os: 'Windows 11 Pro 23H2',
    browser: 'Chrome 124.0.6367',
    engine: 'Blink (V8 12.4.254)',
    tier: 'standard' as const,
  },
  {
    short: 'Safari 17.5 / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    os: 'macOS Sonoma 14.5.0',
    browser: 'Safari 17.5',
    engine: 'WebKit/605.1.15',
    tier: 'standard' as const,
  },
  {
    short: 'Firefox 126 / Fedora',
    full: 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
    os: 'Fedora Linux 40',
    browser: 'Firefox 126.0',
    engine: 'Gecko/126.0',
    tier: 'diverse' as const,
  },
  {
    short: 'Edge 124 / Windows 10',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
    os: 'Windows 10 Enterprise',
    browser: 'Edge 124.0.2478',
    engine: 'Blink (Chromium 124)',
    tier: 'standard' as const,
  },
  {
    short: 'Chrome 125 / Android 14',
    full: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro Build/AP1A.240405.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.52 Mobile Safari/537.36',
    os: 'Android 14 (Upside Down Cake)',
    browser: 'Chrome Mobile 125',
    engine: 'Blink/125.0.0.0',
    tier: 'chaotic' as const,
  },
  {
    short: 'Safari / iPhone iOS 17.5',
    full: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    os: 'iOS 17.5.1',
    browser: 'Mobile Safari 17.5',
    engine: 'WebKit/605.1.15',
    tier: 'chaotic' as const,
  },
  {
    short: 'Vivaldi 6.7 / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Vivaldi/6.7.3329.21',
    os: 'macOS Catalina 10.15.7',
    browser: 'Vivaldi 6.7',
    engine: 'Blink (V8 12.4)',
    tier: 'diverse' as const,
  },
  {
    short: 'Brave 1.66 / Windows 11',
    full: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Brave/1.66.110',
    os: 'Windows 11 Home',
    browser: 'Brave 1.66',
    engine: 'Blink (Chromium 125)',
    tier: 'diverse' as const,
  },
  {
    short: 'Arc Browser / macOS',
    full: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    os: 'macOS Sonoma 14.2',
    browser: 'Arc 1.44',
    engine: 'Blink (Chromium 125)',
    tier: 'diverse' as const,
  },
  {
    short: 'Firefox 125 / Android',
    full: 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
    os: 'Android 14 (One UI 6.1)',
    browser: 'Firefox Mobile 125',
    engine: 'Gecko/125.0',
    tier: 'chaotic' as const,
  },
];

export function pickUserAgentByComplexity(
  complexity: AppSettings['uaComplexity'],
  excludeShort?: string
) {
  const pool = REALISTIC_USER_AGENTS.filter((ua) => {
    if (complexity === 'standard') return ua.tier === 'standard';
    if (complexity === 'diverse')
      return ua.tier === 'standard' || ua.tier === 'diverse';
    return true;
  });
  const withoutCurrent = pool.filter((ua) => ua.short !== excludeShort);
  const candidates = withoutCurrent.length > 0 ? withoutCurrent : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export const EYES_5_COUNTRIES = [
  'USA',
  'Royaume-Uni',
  'Canada',
  'Australie',
  'Nouvelle-Zélande',
];

export const EYES_14_COUNTRIES = [
  ...EYES_5_COUNTRIES,
  'France',
  'Allemagne',
  'Pays-Bas',
  'Danemark',
  'Norvège',
  'Belgique',
  'Italie',
  'Espagne',
  'Suède',
];

export function isCountryExcludedByJurisdiction(
  country: string,
  policy: AppSettings['excludeEyesJurisdictions']
): boolean {
  if (policy === '5-eyes') {
    return EYES_5_COUNTRIES.includes(country);
  }
  if (policy === '14-eyes') {
    return EYES_14_COUNTRIES.includes(country);
  }
  return false;
}

export function getJurisdictionTier(
  country: string
): 'sanctuary' | '14-eyes' | '5-eyes' {
  if (EYES_5_COUNTRIES.includes(country)) return '5-eyes';
  if (EYES_14_COUNTRIES.includes(country)) return '14-eyes';
  return 'sanctuary';
}

export const DEFAULT_SPLIT_TUNNEL_RULES: SplitTunnelRule[] = [
  {
    id: 'rule-lan-cidr',
    target: '192.168.1.0/24',
    type: 'cidr',
    policy: 'bypass',
    enabled: true,
  },
  {
    id: 'rule-local-printer',
    target: 'imprimante.local',
    type: 'domain',
    policy: 'bypass',
    enabled: true,
  },
  {
    id: 'rule-secure-git',
    target: 'git.interne.corp',
    type: 'domain',
    policy: 'vpn_only',
    enabled: true,
  },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  protocol: 'wireguard',
  tunnelPort: 51820,
  dns: 'cloudflare',
  customDnsServer: '',
  killSwitch: true,
  killSwitchMode: 'strict',
  dnsLeakProtection: true,
  webrtcLeakShield: true,
  dnsCache: true,
  autoReconnect: true,
  reconnectDelay: 3,
  splitTunneling: false,
  splitTunnelRules: DEFAULT_SPLIT_TUNNEL_RULES,
  adBlocker: true,
  threatFilters: {
    ads: true,
    trackers: true,
    malware: true,
    cryptominers: true,
  },
  customBlockedDomains: ['telemetry.ad-tracker.example', 'pixel.analytics-spy.net'],
  autoConnect: false,
  anonymityLevel: 'balanced',
  autoRotation: false,
  rotationInterval: 10,
  obfuscationLevel: 'standard',
  macScramblingMode: 'random',
  macFormat: 'random',
  uaComplexity: 'diverse',
  fingerprintProtection: {
    canvasNoise: true,
    webglMask: true,
    audioContextSpoof: false,
    timezoneSync: true,
  },
  vortexBridge: 'none',
  vortexCircuitLength: 3,
  vortexEntryNodeCountry: 'auto',
  vortexExitNodeCountry: 'auto',
  vortexNoScript: false,
  excludeEyesJurisdictions: 'none',
  miningIntensity: 50,
  yieldOptimizationIA: true,
  contributionType: 'passive',
  autoWithdraw: false,
  autoWithdrawThreshold: 5,
  autoWithdrawAddress: '',
  autoWithdrawMethod: 'crypto',
  autoWithdrawSubNetwork: 'polygon',
  autoWithdrawReserve: 0,
  preferredFiat: 'EUR',
  mtuSize: 1420,
  ipv6LeakProtection: true,
  localNetworkSharing: false,
  lanBypass: true,
  logRetentionHours: 168,
  keyboardShortcutsEnabled: true,
  socks5Enabled: false,
  socks5Host: '127.0.0.1',
  socks5Port: 1080,
  tcpCongestionControl: 'bbr',
  postQuantumKex: 'ml-kem-1024',
  keepaliveInterval: 25,
  mssClamping: true,
  multiQueueTun: true,
  blockQuicUdp443: true,
  blockCaptivePortalProbes: true,
  arpSpoofGuard: true,
  strictReversePathFilter: true,
  powerProfile: 'balanced',
  autoLockVaultMinutes: 15,
  clipboardAutoClearSeconds: 30,
  privacyScreenBlurOnInactive: false,
  panicAction: 'lockdown',
  ebpfXdpAcceleration: true,
  tlsClientHelloFragmentation: false,
  trafficPaddingJitterMs: 0,
  ephemeralRekeyMinutes: 10,
  strictMemoryLock: true,
  ntpDriftProtection: true,
  idsEnabled: true,
  idsSensitivity: 'high',
  idsAutoQuarantine: true,
  idsAutoRenumberOnCritical: true,
  idsSoundAlert: false,
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function sanitizeAppSettings(
  raw?: Partial<AppSettings> | Record<string, unknown> | null
): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APP_SETTINGS };
  }
  const src = raw as Partial<AppSettings>;

  const validProtocols: AppSettings['protocol'][] = ['wireguard', 'openvpn', 'ikev2'];
  const validPorts: AppSettings['tunnelPort'][] = [51820, 443, 1194, 500, 8443];
  const validDns: AppSettings['dns'][] = [
    'cloudflare',
    'google',
    'quad9',
    'opendns',
    'custom',
  ];
  const validAnonymityLevels: AnonymityLevel[] = ['low', 'balanced', 'extreme'];
  const validObfuscation: AppSettings['obfuscationLevel'][] = [
    'standard',
    'high',
    'ultra',
  ];
  const validMacModes: AppSettings['macScramblingMode'][] = [
    'vendor',
    'laa',
    'random',
  ];
  const validMacFormats: AppSettings['macFormat'][] = [
    'standard',
    'hyphen',
    'cisco',
    'random',
  ];
  const validUaComplexity: AppSettings['uaComplexity'][] = [
    'standard',
    'diverse',
    'chaotic',
  ];
  const validBridges: AppSettings['vortexBridge'][] = [
    'none',
    'obfs4',
    'snowflake',
    'meek-azure',
  ];
  const validEyes: AppSettings['excludeEyesJurisdictions'][] = [
    'none',
    '5-eyes',
    '14-eyes',
  ];
  const validContribution: AppSettings['contributionType'][] = [
    'passive',
    'relay',
    'exit',
  ];
  const validCongestion: TcpCongestionControl[] = ['bbr', 'cubic', 'hybla'];
  const validPqcKex: PostQuantumKex[] = [
    'ml-kem-1024',
    'sntrup761',
    'classic-x25519',
  ];
  const validPowerProfiles: SystemPowerProfile[] = [
    'eco',
    'balanced',
    'performance',
  ];
  const validPanicActions: PanicActionMode[] = [
    'lockdown',
    'disconnect_wipe',
    'lock_vault_and_scramble',
  ];
  const validPaddingJitter: TrafficPaddingJitterMs[] = [0, 15, 40, 85];
  const validIdsSensitivity: AppSettings['idsSensitivity'][] = [
    'standard',
    'high',
    'paranoid',
  ];

  const rules = Array.isArray(src.splitTunnelRules)
    ? src.splitTunnelRules
        .filter(
          (r): r is SplitTunnelRule =>
            Boolean(r) &&
            typeof r.id === 'string' &&
            typeof r.target === 'string' &&
            r.target.trim().length > 0
        )
        .map((r) => ({
          id: r.id,
          target: r.target.trim(),
          type:
            r.type === 'cidr' || r.type === 'app' ? r.type : ('domain' as const),
          policy: r.policy === 'vpn_only' ? ('vpn_only' as const) : ('bypass' as const),
          enabled: Boolean(r.enabled),
        }))
    : DEFAULT_SPLIT_TUNNEL_RULES;

  const customBlockedDomains = Array.isArray(src.customBlockedDomains)
    ? src.customBlockedDomains
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
        .map((d) => d.trim().toLowerCase())
    : DEFAULT_APP_SETTINGS.customBlockedDomains;

  return {
    protocol: validProtocols.includes(src.protocol as AppSettings['protocol'])
      ? (src.protocol as AppSettings['protocol'])
      : DEFAULT_APP_SETTINGS.protocol,
    tunnelPort: validPorts.includes(src.tunnelPort as AppSettings['tunnelPort'])
      ? (src.tunnelPort as AppSettings['tunnelPort'])
      : DEFAULT_APP_SETTINGS.tunnelPort,
    dns: validDns.includes(src.dns as AppSettings['dns'])
      ? (src.dns as AppSettings['dns'])
      : DEFAULT_APP_SETTINGS.dns,
    customDnsServer:
      typeof src.customDnsServer === 'string' ? src.customDnsServer : '',
    killSwitch:
      typeof src.killSwitch === 'boolean'
        ? src.killSwitch
        : DEFAULT_APP_SETTINGS.killSwitch,
    killSwitchMode:
      src.killSwitchMode === 'soft' ? 'soft' : DEFAULT_APP_SETTINGS.killSwitchMode,
    dnsLeakProtection:
      typeof src.dnsLeakProtection === 'boolean'
        ? src.dnsLeakProtection
        : DEFAULT_APP_SETTINGS.dnsLeakProtection,
    webrtcLeakShield:
      typeof src.webrtcLeakShield === 'boolean'
        ? src.webrtcLeakShield
        : DEFAULT_APP_SETTINGS.webrtcLeakShield,
    dnsCache:
      typeof src.dnsCache === 'boolean'
        ? src.dnsCache
        : DEFAULT_APP_SETTINGS.dnsCache,
    autoReconnect:
      typeof src.autoReconnect === 'boolean'
        ? src.autoReconnect
        : DEFAULT_APP_SETTINGS.autoReconnect,
    reconnectDelay: clampInt(
      src.reconnectDelay,
      1,
      60,
      DEFAULT_APP_SETTINGS.reconnectDelay
    ),
    splitTunneling:
      typeof src.splitTunneling === 'boolean'
        ? src.splitTunneling
        : DEFAULT_APP_SETTINGS.splitTunneling,
    splitTunnelRules: rules,
    adBlocker:
      typeof src.adBlocker === 'boolean'
        ? src.adBlocker
        : DEFAULT_APP_SETTINGS.adBlocker,
    threatFilters: {
      ads:
        typeof src.threatFilters?.ads === 'boolean'
          ? src.threatFilters.ads
          : DEFAULT_APP_SETTINGS.threatFilters.ads,
      trackers:
        typeof src.threatFilters?.trackers === 'boolean'
          ? src.threatFilters.trackers
          : DEFAULT_APP_SETTINGS.threatFilters.trackers,
      malware:
        typeof src.threatFilters?.malware === 'boolean'
          ? src.threatFilters.malware
          : DEFAULT_APP_SETTINGS.threatFilters.malware,
      cryptominers:
        typeof src.threatFilters?.cryptominers === 'boolean'
          ? src.threatFilters.cryptominers
          : DEFAULT_APP_SETTINGS.threatFilters.cryptominers,
    },
    customBlockedDomains,
    autoConnect:
      typeof src.autoConnect === 'boolean'
        ? src.autoConnect
        : DEFAULT_APP_SETTINGS.autoConnect,
    anonymityLevel: validAnonymityLevels.includes(
      src.anonymityLevel as AnonymityLevel
    )
      ? (src.anonymityLevel as AnonymityLevel)
      : DEFAULT_APP_SETTINGS.anonymityLevel,
    autoRotation:
      typeof src.autoRotation === 'boolean'
        ? src.autoRotation
        : DEFAULT_APP_SETTINGS.autoRotation,
    rotationInterval: clampInt(
      src.rotationInterval,
      1,
      120,
      DEFAULT_APP_SETTINGS.rotationInterval
    ),
    obfuscationLevel: validObfuscation.includes(
      src.obfuscationLevel as AppSettings['obfuscationLevel']
    )
      ? (src.obfuscationLevel as AppSettings['obfuscationLevel'])
      : DEFAULT_APP_SETTINGS.obfuscationLevel,
    macScramblingMode: validMacModes.includes(
      src.macScramblingMode as AppSettings['macScramblingMode']
    )
      ? (src.macScramblingMode as AppSettings['macScramblingMode'])
      : DEFAULT_APP_SETTINGS.macScramblingMode,
    macFormat: validMacFormats.includes(
      src.macFormat as AppSettings['macFormat']
    )
      ? (src.macFormat as AppSettings['macFormat'])
      : DEFAULT_APP_SETTINGS.macFormat,
    uaComplexity: validUaComplexity.includes(
      src.uaComplexity as AppSettings['uaComplexity']
    )
      ? (src.uaComplexity as AppSettings['uaComplexity'])
      : DEFAULT_APP_SETTINGS.uaComplexity,
    fingerprintProtection: {
      canvasNoise:
        typeof src.fingerprintProtection?.canvasNoise === 'boolean'
          ? src.fingerprintProtection.canvasNoise
          : DEFAULT_APP_SETTINGS.fingerprintProtection.canvasNoise,
      webglMask:
        typeof src.fingerprintProtection?.webglMask === 'boolean'
          ? src.fingerprintProtection.webglMask
          : DEFAULT_APP_SETTINGS.fingerprintProtection.webglMask,
      audioContextSpoof:
        typeof src.fingerprintProtection?.audioContextSpoof === 'boolean'
          ? src.fingerprintProtection.audioContextSpoof
          : DEFAULT_APP_SETTINGS.fingerprintProtection.audioContextSpoof,
      timezoneSync:
        typeof src.fingerprintProtection?.timezoneSync === 'boolean'
          ? src.fingerprintProtection.timezoneSync
          : DEFAULT_APP_SETTINGS.fingerprintProtection.timezoneSync,
    },
    vortexBridge: validBridges.includes(
      src.vortexBridge as AppSettings['vortexBridge']
    )
      ? (src.vortexBridge as AppSettings['vortexBridge'])
      : DEFAULT_APP_SETTINGS.vortexBridge,
    vortexCircuitLength: clampInt(
      src.vortexCircuitLength,
      3,
      6,
      DEFAULT_APP_SETTINGS.vortexCircuitLength
    ),
    vortexEntryNodeCountry:
      typeof src.vortexEntryNodeCountry === 'string' &&
      src.vortexEntryNodeCountry.trim()
        ? src.vortexEntryNodeCountry
        : DEFAULT_APP_SETTINGS.vortexEntryNodeCountry,
    vortexExitNodeCountry:
      typeof src.vortexExitNodeCountry === 'string' &&
      src.vortexExitNodeCountry.trim()
        ? src.vortexExitNodeCountry
        : DEFAULT_APP_SETTINGS.vortexExitNodeCountry,
    vortexNoScript:
      typeof src.vortexNoScript === 'boolean'
        ? src.vortexNoScript
        : DEFAULT_APP_SETTINGS.vortexNoScript,
    excludeEyesJurisdictions: validEyes.includes(
      src.excludeEyesJurisdictions as AppSettings['excludeEyesJurisdictions']
    )
      ? (src.excludeEyesJurisdictions as AppSettings['excludeEyesJurisdictions'])
      : DEFAULT_APP_SETTINGS.excludeEyesJurisdictions,
    miningIntensity: clampInt(
      src.miningIntensity,
      0,
      100,
      DEFAULT_APP_SETTINGS.miningIntensity
    ),
    yieldOptimizationIA:
      typeof src.yieldOptimizationIA === 'boolean'
        ? src.yieldOptimizationIA
        : DEFAULT_APP_SETTINGS.yieldOptimizationIA,
    contributionType: validContribution.includes(
      src.contributionType as AppSettings['contributionType']
    )
      ? (src.contributionType as AppSettings['contributionType'])
      : DEFAULT_APP_SETTINGS.contributionType,
    autoWithdraw:
      typeof src.autoWithdraw === 'boolean'
        ? src.autoWithdraw
        : DEFAULT_APP_SETTINGS.autoWithdraw,
    autoWithdrawThreshold: (() => {
      const parsed = Number(src.autoWithdrawThreshold);
      if (!Number.isFinite(parsed)) return DEFAULT_APP_SETTINGS.autoWithdrawThreshold;
      return Math.min(1000, Math.max(0.25, parseFloat(parsed.toFixed(2))));
    })(),
    autoWithdrawAddress:
      typeof src.autoWithdrawAddress === 'string'
        ? src.autoWithdrawAddress
        : DEFAULT_APP_SETTINGS.autoWithdrawAddress,
    autoWithdrawMethod: (
      ['crypto', 'mobile_money', 'paypal', 'bank_transfer'] as WithdrawalMethod[]
    ).includes(src.autoWithdrawMethod as WithdrawalMethod)
      ? (src.autoWithdrawMethod as WithdrawalMethod)
      : DEFAULT_APP_SETTINGS.autoWithdrawMethod,
    autoWithdrawSubNetwork: (
      [
        'polygon',
        'trc20',
        'solana',
        'lightning',
        'erc20',
        'wave',
        'orange_money',
        'mtn_momo',
        'moov',
        'paypal_instant',
        'sepa',
      ] as WithdrawalSubNetwork[]
    ).includes(src.autoWithdrawSubNetwork as WithdrawalSubNetwork)
      ? (src.autoWithdrawSubNetwork as WithdrawalSubNetwork)
      : DEFAULT_APP_SETTINGS.autoWithdrawSubNetwork,
    autoWithdrawReserve: (() => {
      const parsed = Number(src.autoWithdrawReserve);
      if (!Number.isFinite(parsed) || parsed < 0) return 0;
      return Math.min(500, parseFloat(parsed.toFixed(2)));
    })(),
    preferredFiat: (['EUR', 'USD', 'XOF'] as FiatCurrency[]).includes(
      src.preferredFiat as FiatCurrency
    )
      ? (src.preferredFiat as FiatCurrency)
      : DEFAULT_APP_SETTINGS.preferredFiat,
    mtuSize: clampInt(src.mtuSize, 1280, 1500, DEFAULT_APP_SETTINGS.mtuSize),
    ipv6LeakProtection:
      typeof src.ipv6LeakProtection === 'boolean'
        ? src.ipv6LeakProtection
        : DEFAULT_APP_SETTINGS.ipv6LeakProtection,
    localNetworkSharing:
      typeof src.localNetworkSharing === 'boolean'
        ? src.localNetworkSharing
        : DEFAULT_APP_SETTINGS.localNetworkSharing,
    lanBypass:
      typeof src.lanBypass === 'boolean'
        ? src.lanBypass
        : DEFAULT_APP_SETTINGS.lanBypass,
    logRetentionHours: clampInt(
      src.logRetentionHours,
      0,
      720,
      DEFAULT_APP_SETTINGS.logRetentionHours
    ),
    keyboardShortcutsEnabled:
      typeof src.keyboardShortcutsEnabled === 'boolean'
        ? src.keyboardShortcutsEnabled
        : DEFAULT_APP_SETTINGS.keyboardShortcutsEnabled,
    socks5Enabled:
      typeof src.socks5Enabled === 'boolean'
        ? src.socks5Enabled
        : DEFAULT_APP_SETTINGS.socks5Enabled,
    socks5Host:
      typeof src.socks5Host === 'string' && src.socks5Host.trim()
        ? src.socks5Host.trim()
        : DEFAULT_APP_SETTINGS.socks5Host,
    socks5Port: clampInt(
      src.socks5Port,
      1,
      65535,
      DEFAULT_APP_SETTINGS.socks5Port
    ),
    tcpCongestionControl: validCongestion.includes(
      src.tcpCongestionControl as TcpCongestionControl
    )
      ? (src.tcpCongestionControl as TcpCongestionControl)
      : DEFAULT_APP_SETTINGS.tcpCongestionControl,
    postQuantumKex: validPqcKex.includes(src.postQuantumKex as PostQuantumKex)
      ? (src.postQuantumKex as PostQuantumKex)
      : DEFAULT_APP_SETTINGS.postQuantumKex,
    keepaliveInterval: clampInt(
      src.keepaliveInterval,
      0,
      120,
      DEFAULT_APP_SETTINGS.keepaliveInterval
    ),
    mssClamping:
      typeof src.mssClamping === 'boolean'
        ? src.mssClamping
        : DEFAULT_APP_SETTINGS.mssClamping,
    multiQueueTun:
      typeof src.multiQueueTun === 'boolean'
        ? src.multiQueueTun
        : DEFAULT_APP_SETTINGS.multiQueueTun,
    blockQuicUdp443:
      typeof src.blockQuicUdp443 === 'boolean'
        ? src.blockQuicUdp443
        : DEFAULT_APP_SETTINGS.blockQuicUdp443,
    blockCaptivePortalProbes:
      typeof src.blockCaptivePortalProbes === 'boolean'
        ? src.blockCaptivePortalProbes
        : DEFAULT_APP_SETTINGS.blockCaptivePortalProbes,
    arpSpoofGuard:
      typeof src.arpSpoofGuard === 'boolean'
        ? src.arpSpoofGuard
        : DEFAULT_APP_SETTINGS.arpSpoofGuard,
    strictReversePathFilter:
      typeof src.strictReversePathFilter === 'boolean'
        ? src.strictReversePathFilter
        : DEFAULT_APP_SETTINGS.strictReversePathFilter,
    powerProfile: validPowerProfiles.includes(
      src.powerProfile as SystemPowerProfile
    )
      ? (src.powerProfile as SystemPowerProfile)
      : DEFAULT_APP_SETTINGS.powerProfile,
    autoLockVaultMinutes: clampInt(
      src.autoLockVaultMinutes,
      0,
      240,
      DEFAULT_APP_SETTINGS.autoLockVaultMinutes
    ),
    clipboardAutoClearSeconds: clampInt(
      src.clipboardAutoClearSeconds,
      0,
      300,
      DEFAULT_APP_SETTINGS.clipboardAutoClearSeconds
    ),
    privacyScreenBlurOnInactive:
      typeof src.privacyScreenBlurOnInactive === 'boolean'
        ? src.privacyScreenBlurOnInactive
        : DEFAULT_APP_SETTINGS.privacyScreenBlurOnInactive,
    panicAction: validPanicActions.includes(src.panicAction as PanicActionMode)
      ? (src.panicAction as PanicActionMode)
      : DEFAULT_APP_SETTINGS.panicAction,
    ebpfXdpAcceleration:
      typeof src.ebpfXdpAcceleration === 'boolean'
        ? src.ebpfXdpAcceleration
        : DEFAULT_APP_SETTINGS.ebpfXdpAcceleration,
    tlsClientHelloFragmentation:
      typeof src.tlsClientHelloFragmentation === 'boolean'
        ? src.tlsClientHelloFragmentation
        : DEFAULT_APP_SETTINGS.tlsClientHelloFragmentation,
    trafficPaddingJitterMs: validPaddingJitter.includes(
      Number(src.trafficPaddingJitterMs) as TrafficPaddingJitterMs
    )
      ? (Number(src.trafficPaddingJitterMs) as TrafficPaddingJitterMs)
      : DEFAULT_APP_SETTINGS.trafficPaddingJitterMs,
    ephemeralRekeyMinutes: clampInt(
      src.ephemeralRekeyMinutes,
      1,
      60,
      DEFAULT_APP_SETTINGS.ephemeralRekeyMinutes
    ),
    strictMemoryLock:
      typeof src.strictMemoryLock === 'boolean'
        ? src.strictMemoryLock
        : DEFAULT_APP_SETTINGS.strictMemoryLock,
    ntpDriftProtection:
      typeof src.ntpDriftProtection === 'boolean'
        ? src.ntpDriftProtection
        : DEFAULT_APP_SETTINGS.ntpDriftProtection,
    idsEnabled:
      typeof src.idsEnabled === 'boolean'
        ? src.idsEnabled
        : DEFAULT_APP_SETTINGS.idsEnabled,
    idsSensitivity: validIdsSensitivity.includes(
      src.idsSensitivity as AppSettings['idsSensitivity']
    )
      ? (src.idsSensitivity as AppSettings['idsSensitivity'])
      : DEFAULT_APP_SETTINGS.idsSensitivity,
    idsAutoQuarantine:
      typeof src.idsAutoQuarantine === 'boolean'
        ? src.idsAutoQuarantine
        : DEFAULT_APP_SETTINGS.idsAutoQuarantine,
    idsAutoRenumberOnCritical:
      typeof src.idsAutoRenumberOnCritical === 'boolean'
        ? src.idsAutoRenumberOnCritical
        : DEFAULT_APP_SETTINGS.idsAutoRenumberOnCritical,
    idsSoundAlert:
      typeof src.idsSoundAlert === 'boolean'
        ? src.idsSoundAlert
        : DEFAULT_APP_SETTINGS.idsSoundAlert,
  };
}

export function computeSettingsHardeningScore(settings: AppSettings): number {
  let score = 9;
  if (settings.killSwitch) score += settings.killSwitchMode === 'strict' ? 12 : 8;
  if (settings.dnsLeakProtection) score += 10;
  if (settings.ipv6LeakProtection) score += 9;
  if (settings.webrtcLeakShield) score += 7;
  if (settings.postQuantumKex === 'ml-kem-1024') score += 8;
  else if (settings.postQuantumKex === 'sntrup761') score += 6;
  else score += 2;
  if (settings.idsEnabled) {
    score += settings.idsSensitivity === 'paranoid' ? 5 : 4;
    if (settings.idsAutoQuarantine) score += 2;
    if (settings.idsAutoRenumberOnCritical) score += 2;
  }
  if (settings.blockQuicUdp443) score += 4;
  if (settings.arpSpoofGuard) score += 4;
  if (settings.strictReversePathFilter) score += 3;
  if (settings.blockCaptivePortalProbes) score += 2;
  if (settings.strictMemoryLock) score += 2;
  if (settings.ntpDriftProtection) score += 2;
  if (settings.ebpfXdpAcceleration) score += 1;
  if (settings.tlsClientHelloFragmentation) score += 2;
  if (settings.trafficPaddingJitterMs > 0) score += 2;
  if (settings.ephemeralRekeyMinutes <= 10) score += 2;
  if (settings.adBlocker) {
    const activeFilters = Object.values(settings.threatFilters).filter(Boolean).length;
    score += Math.round((activeFilters / 4) * 6);
  }
  if (settings.autoRotation) score += 5;
  if (settings.anonymityLevel === 'extreme') score += 5;
  else if (settings.anonymityLevel === 'balanced') score += 3;
  if (settings.obfuscationLevel === 'ultra') score += 5;
  else if (settings.obfuscationLevel === 'high') score += 3;
  if (settings.excludeEyesJurisdictions === '14-eyes') score += 5;
  else if (settings.excludeEyesJurisdictions === '5-eyes') score += 3;
  if (settings.fingerprintProtection.canvasNoise) score += 2;
  if (settings.fingerprintProtection.webglMask) score += 2;
  if (settings.autoLockVaultMinutes > 0 && settings.autoLockVaultMinutes <= 30) {
    score += 2;
  }
  return Math.min(100, Math.max(0, score));
}

export const generateRandomMac = (
  mode: 'vendor' | 'laa' | 'random' = 'random',
  format: 'standard' | 'hyphen' | 'cisco' | 'random' = 'random'
) => {
  const hex = '0123456789ABCDEF';
  const vendors = [
    '00:00:0C',
    '00:05:02',
    '00:0C:F1',
    '00:16:3E',
    '00:50:56',
    '3C:5A:B4',
    '00:14:22',
    '00:10:18',
    'E0:D5:5E',
    '52:54:00',
    '00:15:5D',
    '08:00:27',
  ];
  let bytes: string[] = [];
  if (mode === 'vendor') {
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    bytes = vendor.split(':');
    while (bytes.length < 6) {
      bytes.push(
        hex[Math.floor(Math.random() * 16)] +
          hex[Math.floor(Math.random() * 16)]
      );
    }
  } else if (mode === 'laa') {
    const firstDigit = hex[Math.floor(Math.random() * 16)];
    const secondDigit = ['2', '6', 'A', 'E'][Math.floor(Math.random() * 4)];
    bytes.push(firstDigit + secondDigit);
    for (let i = 1; i < 6; i++) {
      bytes.push(
        hex[Math.floor(Math.random() * 16)] +
          hex[Math.floor(Math.random() * 16)]
      );
    }
  } else {
    for (let i = 0; i < 6; i++) {
      bytes.push(
        hex[Math.floor(Math.random() * 16)] +
          hex[Math.floor(Math.random() * 16)]
      );
    }
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
  { id: 'n1', name: 'FR-PAR-01', type: 'server', status: 'active', signalStrength: 98, transferRate: 185, latency: 12, jitter: 1.4, packetLoss: 0, asn: 'AS12876 Scaleway IX', loadPct: 34, autonomyProfile: 'provider', tags: ['fast'], ip: '185.212.149.42', country: 'France', city: 'Paris', lat: 48.8566, lon: 2.3522, timezone: 'UTC+1' },
  { id: 'n2', name: 'FR-LYO-02', type: 'desktop', status: 'active', signalStrength: 89, transferRate: 74, latency: 17, jitter: 2.6, packetLoss: 0, asn: 'AS3215 Orange Backbone', loadPct: 48, autonomyProfile: 'balanced', tags: ['relay'], ip: '185.212.151.18', country: 'France', city: 'Lyon', lat: 45.764, lon: 4.8357, timezone: 'UTC+1' },
  { id: 'n3', name: 'CH-ZUR-01', type: 'server', status: 'active', signalStrength: 97, transferRate: 210, latency: 21, jitter: 1.2, packetLoss: 0, asn: 'AS51395 Bahnhof Swiss', loadPct: 26, autonomyProfile: 'provider', tags: ['stealth', 'exit'], ip: '179.43.168.24', country: 'Suisse', city: 'Zürich', lat: 47.3769, lon: 8.5417, timezone: 'UTC+1' },
  { id: 'n4', name: 'CH-GEN-02', type: 'server', status: 'active', signalStrength: 93, transferRate: 145, latency: 24, jitter: 1.9, packetLoss: 0, asn: 'AS20965 Proton Transit', loadPct: 31, autonomyProfile: 'provider', tags: ['stealth'], ip: '179.43.170.85', country: 'Suisse', city: 'Genève', lat: 46.2044, lon: 6.1432, timezone: 'UTC+1' },
  { id: 'n5', name: 'DE-FRA-01', type: 'server', status: 'active', signalStrength: 99, transferRate: 240, latency: 16, jitter: 1.1, packetLoss: 0, asn: 'AS24940 Hetzner DE-CIX', loadPct: 41, autonomyProfile: 'provider', tags: ['fast'], ip: '91.198.174.66', country: 'Allemagne', city: 'Francfort', lat: 50.1109, lon: 8.6821, timezone: 'UTC+1' },
  { id: 'n6', name: 'IS-REY-01', type: 'server', status: 'active', signalStrength: 94, transferRate: 160, latency: 38, jitter: 2.3, packetLoss: 0, asn: 'AS48685 Advania Verne', loadPct: 19, autonomyProfile: 'provider', tags: ['stealth', 'exit'], ip: '82.221.105.19', country: 'Islande', city: 'Reykjavik', lat: 64.1466, lon: -21.9426, timezone: 'UTC+0' },
  { id: 'n7', name: 'EE-TAL-01', type: 'server', status: 'active', signalStrength: 91, transferRate: 135, latency: 34, jitter: 2.8, packetLoss: 0.1, asn: 'AS3249 Telia Tallinn', loadPct: 29, autonomyProfile: 'balanced', tags: ['relay'], ip: '185.65.134.88', country: 'Estonie', city: 'Tallinn', lat: 59.437, lon: 24.7536, timezone: 'UTC+2' },
  { id: 'n8', name: 'US-NYC-01', type: 'server', status: 'active', signalStrength: 92, transferRate: 195, latency: 76, jitter: 4.5, packetLoss: 0.2, asn: 'AS20473 Constant NYIIX', loadPct: 57, autonomyProfile: 'provider', tags: ['exit'], ip: '198.54.131.70', country: 'USA', city: 'New York', lat: 40.7128, lon: -74.006, timezone: 'UTC-5' },
  { id: 'n9', name: 'PA-PTY-01', type: 'iot', status: 'active', signalStrength: 82, transferRate: 68, latency: 118, jitter: 6.4, packetLoss: 0.3, asn: 'AS52275 Cable Onda IX', loadPct: 22, autonomyProfile: 'balanced', tags: ['stealth'], ip: '190.14.37.112', country: 'Panama', city: 'Panama City', lat: 8.9824, lon: -79.5199, timezone: 'UTC-5' },
  { id: 'n10', name: 'SG-SIN-01', type: 'server', status: 'active', signalStrength: 96, transferRate: 205, latency: 145, jitter: 5.1, packetLoss: 0.1, asn: 'AS135377 Equinix SG1', loadPct: 38, autonomyProfile: 'provider', tags: ['exit'], ip: '103.253.41.90', country: 'Singapour', city: 'Singapour', lat: 1.3521, lon: 103.8198, timezone: 'UTC+8' },
];

export interface AnonymityLevelSpec {
  id: AnonymityLevel;
  codeLabel: 'Low' | 'Balanced' | 'Extreme';
  frenchTitle: string;
  postureSummary: string;
  jurisdictionPolicyLabel: string;
  identityMutationLabel: string;
  cadenceMultiplier: number;
  settleDelayMs: number;
  vortexMinHops: number;
}

export const ANONYMITY_LEVEL_SPECS: Record<AnonymityLevel, AnonymityLevelSpec> = {
  low: {
    id: 'low',
    codeLabel: 'Low',
    frenchTitle: 'Faible — Vitesse & continuité',
    postureSummary:
      'Privilégie les relais <= 35 ms avec affinité régionale et conserve le User-Agent actif lors des sauts pour préserver les sessions Web.',
    jurisdictionPolicyLabel: 'Affinité régionale (latence min.)',
    identityMutationLabel: 'IP rapide · MAC OUI · UA conservé',
    cadenceMultiplier: 1.5,
    settleDelayMs: 380,
    vortexMinHops: 3,
  },
  balanced: {
    id: 'balanced',
    codeLabel: 'Balanced',
    frenchTitle: 'Équilibré — Rotation multi-juridictions',
    postureSummary:
      'Écarte les juridictions 5-Eyes lors des sauts, bascule vers un pays distinct et régénère conjointement l’adresse MAC LAA et le User-Agent.',
    jurisdictionPolicyLabel: 'Hors 5-Eyes · Changement de pays',
    identityMutationLabel: 'IP + MAC LAA + UA diversifié',
    cadenceMultiplier: 1.0,
    settleDelayMs: 650,
    vortexMinHops: 4,
  },
  extreme: {
    id: 'extreme',
    codeLabel: 'Extreme',
    frenchTitle: 'Extrême — Sanctuaires & brouillage intégral',
    postureSummary:
      'Restreint les sauts aux sanctuaires hors 14-Eyes, force une juridiction différente à chaque saut et brouille MAC 48-bit + UA chaotique.',
    jurisdictionPolicyLabel: 'Sanctuaires hors 14-Eyes strict',
    identityMutationLabel: 'IP furtive + MAC 48-bit + UA chaotique',
    cadenceMultiplier: 0.5,
    settleDelayMs: 900,
    vortexMinHops: 5,
  },
};

export function getEffectiveRotationSeconds(
  intervalMinutes: number,
  level: AnonymityLevel = 'balanced'
): number {
  const baseSeconds = Math.max(1, intervalMinutes) * 60;
  const spec = ANONYMITY_LEVEL_SPECS[level] || ANONYMITY_LEVEL_SPECS.balanced;
  return Math.max(30, Math.round(baseSeconds * spec.cadenceMultiplier));
}

export function getNextHopCandidateNodes(params: {
  level: AnonymityLevel;
  currentIp: string;
  currentCountry: string;
  nodes?: DeviceNode[];
  excludePolicy?: AppSettings['excludeEyesJurisdictions'];
}): DeviceNode[] {
  const {
    level,
    currentIp,
    currentCountry,
    nodes = MOCK_NODES,
    excludePolicy = 'none',
  } = params;

  const sourceNodes = nodes.length > 0 ? nodes : MOCK_NODES;
  const withoutCurrentIp = sourceNodes.filter((n) => n.ip !== currentIp);
  const basePool = withoutCurrentIp.length > 0 ? withoutCurrentIp : sourceNodes;

  if (level === 'low') {
    const allowed = basePool.filter(
      (n) => !isCountryExcludedByJurisdiction(n.country, excludePolicy)
    );
    const pool = allowed.length > 0 ? allowed : basePool;
    const fastPool = pool.filter(
      (n) => n.latency <= 35 || n.tags.includes('fast')
    );
    const target = fastPool.length > 0 ? fastPool : pool;
    return [...target].sort((a, b) => {
      const aSameCountry = a.country === currentCountry ? 0 : 1;
      const bSameCountry = b.country === currentCountry ? 0 : 1;
      if (aSameCountry !== bSameCountry) return aSameCountry - bSameCountry;
      return a.latency - b.latency;
    });
  }

  if (level === 'balanced') {
    const effectiveEyes: AppSettings['excludeEyesJurisdictions'] =
      excludePolicy === '14-eyes' ? '14-eyes' : '5-eyes';
    const nonEyes = basePool.filter(
      (n) => !isCountryExcludedByJurisdiction(n.country, effectiveEyes)
    );
    const pool = nonEyes.length > 0 ? nonEyes : basePool;
    const crossCountry = pool.filter((n) => n.country !== currentCountry);
    const target = crossCountry.length > 0 ? crossCountry : pool;
    const moderateLatency = target.filter((n) => n.latency <= 85);
    const ordered = moderateLatency.length > 0 ? moderateLatency : target;
    return [...ordered].sort((a, b) => a.latency - b.latency);
  }

  // extreme: strictly non-14-Eyes sanctuaries + mandatory cross-country jump + stealth/exit priority
  const sanctuaries = basePool.filter(
    (n) => !EYES_14_COUNTRIES.includes(n.country)
  );
  const crossSanctuaries = sanctuaries.filter(
    (n) => n.country !== currentCountry
  );
  const target =
    crossSanctuaries.length > 0
      ? crossSanctuaries
      : sanctuaries.length > 0
        ? sanctuaries
        : basePool;

  return [...target].sort((a, b) => {
    const aStealth = a.tags.includes('stealth') || a.tags.includes('exit') ? 0 : 1;
    const bStealth = b.tags.includes('stealth') || b.tags.includes('exit') ? 0 : 1;
    if (aStealth !== bStealth) return aStealth - bStealth;
    return b.signalStrength - a.signalStrength;
  });
}

export function mutateIdentityIdentifiersForHop(
  currentIdentity: VirtualIdentity,
  settings: Pick<
    AppSettings,
    'anonymityLevel' | 'macScramblingMode' | 'macFormat' | 'uaComplexity'
  >
): { mac: string; userAgentShort: string } {
  const level = settings.anonymityLevel || 'balanced';

  if (level === 'low') {
    return {
      mac: generateRandomMac('vendor', 'standard'),
      userAgentShort:
        currentIdentity.userAgentShort ||
        pickUserAgentByComplexity('standard').short,
    };
  }

  if (level === 'extreme') {
    return {
      mac: generateRandomMac('random', 'random'),
      userAgentShort: pickUserAgentByComplexity(
        'chaotic',
        currentIdentity.userAgentShort
      ).short,
    };
  }

  // balanced
  const macMode =
    settings.macScramblingMode === 'vendor' ? 'laa' : settings.macScramblingMode;
  return {
    mac: generateRandomMac(macMode, settings.macFormat),
    userAgentShort: pickUserAgentByComplexity(
      'diverse',
      currentIdentity.userAgentShort
    ).short,
  };
}

export function computeNextRenumberHop(params: {
  currentIdentity: VirtualIdentity;
  settings: AppSettings;
  nodes?: DeviceNode[];
}): {
  identity: VirtualIdentity;
  selectedNode: DeviceNode | null;
  spec: AnonymityLevelSpec;
  candidateCount: number;
} {
  const { currentIdentity, settings, nodes = MOCK_NODES } = params;
  const level = settings.anonymityLevel || 'balanced';
  const spec = ANONYMITY_LEVEL_SPECS[level] || ANONYMITY_LEVEL_SPECS.balanced;

  const candidates = getNextHopCandidateNodes({
    level,
    currentIp: currentIdentity.ip,
    currentCountry: currentIdentity.country,
    nodes,
    excludePolicy: settings.excludeEyesJurisdictions,
  });

  let selectionPool = candidates;
  if (level === 'low') {
    selectionPool = candidates.slice(0, Math.min(2, candidates.length));
  } else if (level === 'extreme') {
    const hardened = candidates.filter(
      (n) => n.tags.includes('stealth') || n.tags.includes('exit')
    );
    if (hardened.length > 0) selectionPool = hardened;
  }

  const pickedNode =
    selectionPool[Math.floor(Math.random() * selectionPool.length)] ||
    candidates[0] ||
    null;

  const mutated = mutateIdentityIdentifiersForHop(currentIdentity, settings);

  if (!pickedNode) {
    const fallbackIdentity =
      MOCK_IDENTITIES.find((i) => i.ip !== currentIdentity.ip) ||
      MOCK_IDENTITIES[0];
    return {
      identity: {
        ...fallbackIdentity,
        mac: mutated.mac,
        userAgentShort: mutated.userAgentShort,
      },
      selectedNode: null,
      spec,
      candidateCount: candidates.length,
    };
  }

  const matchingMock = MOCK_IDENTITIES.find((i) => i.ip === pickedNode.ip);
  const resolvedCity =
    pickedNode.city || matchingMock?.city || pickedNode.country;
  const resolvedTimezone =
    pickedNode.timezone ||
    matchingMock?.timezone ||
    currentIdentity.timezone ||
    'UTC+0';

  return {
    identity: {
      ip: pickedNode.ip,
      country: pickedNode.country,
      city: resolvedCity,
      latency: pickedNode.latency,
      timezone: resolvedTimezone,
      mac: mutated.mac,
      userAgentShort: mutated.userAgentShort,
    },
    selectedNode: pickedNode,
    spec,
    candidateCount: candidates.length,
  };
}

export const INITIAL_LOGS = [
  { id: '1', timestamp: '10:00:01', timestampRaw: Date.now(), event: 'Système Renumerate initialisé', type: 'info' as const },
  { id: '2', timestamp: '10:00:02', timestampRaw: Date.now(), event: 'Moteur de re-numérotation chargé', type: 'success' as const },
  { id: '3', timestamp: '10:00:03', timestampRaw: Date.now(), event: 'Protocole WireGuard optimisé (Vitesse & Fiabilité max) sélectionné par défaut', type: 'info' as const },
];

// ============================================================================
// MOTEUR UNIFIÉ DE VALORISATION RNC, TAUX DE MINAGE & SYSTÈME DE RETRAIT
// ============================================================================

export const RNC_FIAT_RATES: Record<
  FiatCurrency,
  { rate: number; symbol: string; decimals: number; label: string }
> = {
  EUR: { rate: 2.45, symbol: '€', decimals: 2, label: 'Euro (EUR)' },
  USD: { rate: 2.68, symbol: '$', decimals: 2, label: 'Dollar US (USD)' },
  XOF: { rate: 1607, symbol: 'FCFA', decimals: 0, label: 'Franc CFA (XOF)' },
};

export function formatFiatValue(
  rncAmount: number,
  currency: FiatCurrency = 'EUR',
  overrideRate?: number
): string {
  const spec = RNC_FIAT_RATES[currency] || RNC_FIAT_RATES.EUR;
  const rate = overrideRate && overrideRate > 0 ? overrideRate : spec.rate;
  const converted = Math.max(0, rncAmount) * rate;
  if (currency === 'XOF') {
    return `${Math.round(converted).toLocaleString('fr-FR')} ${spec.symbol}`;
  }
  if (currency === 'USD') {
    return `$${converted.toFixed(spec.decimals)}`;
  }
  return `${converted.toFixed(spec.decimals)} ${spec.symbol}`;
}

export interface WithdrawalRailSpec {
  id: WithdrawalSubNetwork;
  method: WithdrawalMethod;
  label: string;
  shortLabel: string;
  minRnc: number;
  baseFeeRnc: number;
  pctFee: number;
  placeholder: string;
  sampleAddress: string;
  inputLabel: string;
  etaInstant: string;
  etaStandard: string;
}

export const WITHDRAWAL_RAIL_SPECS: Record<
  WithdrawalSubNetwork,
  WithdrawalRailSpec
> = {
  polygon: {
    id: 'polygon',
    method: 'crypto',
    label: 'Polygon PoS (USDC / RNC)',
    shortLabel: 'Polygon PoS',
    minRnc: 0.25,
    baseFeeRnc: 0.012,
    pctFee: 0,
    placeholder: '0x71C9...89A2B (42 caractères EVM)',
    sampleAddress: '0x71C95911E9a5D330f4D621842EC243EE13439A2B',
    inputLabel: 'Adresse du portefeuille Polygon (EVM 0x...)',
    etaInstant: '~6 sec',
    etaStandard: 'File 45 sec',
  },
  trc20: {
    id: 'trc20',
    method: 'crypto',
    label: 'Tron TRC-20 (USDT)',
    shortLabel: 'Tron TRC-20',
    minRnc: 0.5,
    baseFeeRnc: 0.032,
    pctFee: 0,
    placeholder: 'TNPeeaaFB7K9... (34 caractères Base58)',
    sampleAddress: 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL',
    inputLabel: 'Adresse du portefeuille Tron (TRC-20)',
    etaInstant: '~8 sec',
    etaStandard: 'File 45 sec',
  },
  solana: {
    id: 'solana',
    method: 'crypto',
    label: 'Solana SPL (USDC / SOL)',
    shortLabel: 'Solana SPL',
    minRnc: 0.25,
    baseFeeRnc: 0.008,
    pctFee: 0,
    placeholder: '7xKXtg2CW87d97TX... (Clé Base58)',
    sampleAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    inputLabel: 'Adresse du portefeuille Solana (SPL)',
    etaInstant: '~5 sec',
    etaStandard: 'File 40 sec',
  },
  lightning: {
    id: 'lightning',
    method: 'crypto',
    label: 'Bitcoin Lightning Network',
    shortLabel: 'Lightning BTC',
    minRnc: 0.1,
    baseFeeRnc: 0.002,
    pctFee: 0.002,
    placeholder: 'operateur@getalby.com ou lnbc1...',
    sampleAddress: 'satoshi.node@walletofsatoshi.com',
    inputLabel: 'Adresse Lightning (nom@domaine) ou facture BOLT11',
    etaInstant: '~3 sec',
    etaStandard: 'File 30 sec',
  },
  erc20: {
    id: 'erc20',
    method: 'crypto',
    label: 'Ethereum Mainnet (ERC-20)',
    shortLabel: 'Ethereum ERC-20',
    minRnc: 1.0,
    baseFeeRnc: 0.085,
    pctFee: 0,
    placeholder: '0x71C9...89A2B (42 caractères EVM)',
    sampleAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    inputLabel: 'Adresse Ethereum Mainnet (ERC-20 0x...)',
    etaInstant: '~12 sec',
    etaStandard: 'File 60 sec',
  },
  wave: {
    id: 'wave',
    method: 'mobile_money',
    label: 'Wave Mobile Money',
    shortLabel: 'Wave',
    minRnc: 0.25,
    baseFeeRnc: 0.005,
    pctFee: 0.01,
    placeholder: '+225 07 08 09 10 11',
    sampleAddress: '+225 07 48 12 90 34',
    inputLabel: 'Numéro de compte Wave (avec indicatif)',
    etaInstant: 'Instantané',
    etaStandard: 'File 40 sec',
  },
  orange_money: {
    id: 'orange_money',
    method: 'mobile_money',
    label: 'Orange Money',
    shortLabel: 'Orange Money',
    minRnc: 0.25,
    baseFeeRnc: 0.008,
    pctFee: 0.012,
    placeholder: '+221 77 123 45 67',
    sampleAddress: '+221 77 540 82 19',
    inputLabel: 'Numéro Orange Money (avec indicatif)',
    etaInstant: 'Instantané',
    etaStandard: 'File 45 sec',
  },
  mtn_momo: {
    id: 'mtn_momo',
    method: 'mobile_money',
    label: 'MTN MoMo',
    shortLabel: 'MTN MoMo',
    minRnc: 0.25,
    baseFeeRnc: 0.008,
    pctFee: 0.012,
    placeholder: '+225 05 00 11 22 33',
    sampleAddress: '+225 05 64 21 88 10',
    inputLabel: 'Numéro MTN Mobile Money (avec indicatif)',
    etaInstant: 'Instantané',
    etaStandard: 'File 45 sec',
  },
  moov: {
    id: 'moov',
    method: 'mobile_money',
    label: 'Moov Money',
    shortLabel: 'Moov Money',
    minRnc: 0.25,
    baseFeeRnc: 0.008,
    pctFee: 0.01,
    placeholder: '+225 01 02 03 04 05',
    sampleAddress: '+225 01 42 75 30 91',
    inputLabel: 'Numéro Moov Money (avec indicatif)',
    etaInstant: 'Instantané',
    etaStandard: 'File 45 sec',
  },
  paypal_instant: {
    id: 'paypal_instant',
    method: 'paypal',
    label: 'PayPal Express (EUR / USD)',
    shortLabel: 'PayPal',
    minRnc: 0.5,
    baseFeeRnc: 0.015,
    pctFee: 0.015,
    placeholder: 'operateur@domaine.com',
    sampleAddress: 'operateur.renumerate@proton.me',
    inputLabel: 'Adresse e-mail du compte PayPal vérifié',
    etaInstant: '~8 sec',
    etaStandard: 'File 50 sec',
  },
  sepa: {
    id: 'sepa',
    method: 'bank_transfer',
    label: 'Virement Bancaire SEPA / IBAN',
    shortLabel: 'Virement SEPA',
    minRnc: 1.0,
    baseFeeRnc: 0.035,
    pctFee: 0.005,
    placeholder: 'FR76 3000 6000 0112 3456 7890 189',
    sampleAddress: 'FR76 3000 6000 0112 3456 7890 189',
    inputLabel: 'IBAN du compte bénéficiaire (Zone SEPA)',
    etaInstant: 'SEPA Instant',
    etaStandard: 'File 60 sec',
  },
};

export function getDefaultSubNetworkForMethod(
  method: WithdrawalMethod
): WithdrawalSubNetwork {
  switch (method) {
    case 'crypto':
      return 'polygon';
    case 'mobile_money':
      return 'wave';
    case 'paypal':
      return 'paypal_instant';
    case 'bank_transfer':
      return 'sepa';
  }
}

export function getSubNetworksForMethod(
  method: WithdrawalMethod
): WithdrawalRailSpec[] {
  return Object.values(WITHDRAWAL_RAIL_SPECS).filter(
    (spec) => spec.method === method
  );
}

export function validateWithdrawalDestination(
  method: WithdrawalMethod,
  subNetwork: WithdrawalSubNetwork,
  rawAddress: string,
  accountHolder?: string,
  requireHolder = false
): { valid: boolean; normalized: string; error?: string } {
  const trimmed = rawAddress.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      error: 'Veuillez renseigner une destination de retrait.',
    };
  }

  if (method === 'crypto') {
    if (subNetwork === 'erc20' || subNetwork === 'polygon') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        return {
          valid: false,
          normalized: trimmed,
          error:
            'Adresse EVM invalide : elle doit commencer par 0x suivi de 40 caractères hexadécimaux.',
        };
      }
      return { valid: true, normalized: trimmed };
    }
    if (subNetwork === 'trc20') {
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) {
        return {
          valid: false,
          normalized: trimmed,
          error:
            'Adresse Tron TRC-20 invalide : elle doit débuter par T et comporter 34 caractères Base58.',
        };
      }
      return { valid: true, normalized: trimmed };
    }
    if (subNetwork === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
        return {
          valid: false,
          normalized: trimmed,
          error:
            'Clé publique Solana invalide : format Base58 attendu (32 à 44 caractères).',
        };
      }
      return { valid: true, normalized: trimmed };
    }
    if (subNetwork === 'lightning') {
      const isBolt11 = /^ln(bc|tb)[0-9a-z]{20,}$/i.test(trimmed);
      const isLnAddress = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
      if (!isBolt11 && !isLnAddress) {
        return {
          valid: false,
          normalized: trimmed,
          error:
            'Destination Lightning invalide : saisissez une adresse (nom@domaine.com) ou une facture BOLT11 (lnbc...).',
        };
      }
      return { valid: true, normalized: trimmed.toLowerCase() };
    }
  }

  if (method === 'mobile_money') {
    const compact = trimmed.replace(/[\s\-().]/g, '');
    if (!/^\+?[1-9]\d{7,14}$/.test(compact)) {
      return {
        valid: false,
        normalized: trimmed,
        error:
          'Numéro Mobile Money invalide : indiquez l’indicatif pays et 8 à 15 chiffres (ex: +225 07 48 12 90 34).',
      };
    }
    const withPlus = compact.startsWith('+') ? compact : `+${compact}`;
    return { valid: true, normalized: withPlus };
  }

  if (method === 'paypal') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return {
        valid: false,
        normalized: trimmed,
        error: 'Adresse e-mail PayPal invalide (ex: nom@domaine.com).',
      };
    }
    return { valid: true, normalized: trimmed.toLowerCase() };
  }

  if (method === 'bank_transfer') {
    const compactIban = trimmed.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compactIban)) {
      return {
        valid: false,
        normalized: trimmed,
        error:
          'IBAN invalide : saisissez un code pays ISO (ex: FR76, CH93, BE68) suivi de 13 à 32 caractères.',
      };
    }
    if (requireHolder && (!accountHolder || accountHolder.trim().length < 2)) {
      return {
        valid: false,
        normalized: compactIban,
        error: 'Veuillez indiquer le nom complet du titulaire du compte IBAN.',
      };
    }
    const formattedIban = compactIban.replace(/(.{4})/g, '$1 ').trim();
    return { valid: true, normalized: formattedIban };
  }

  return { valid: true, normalized: trimmed };
}

export interface WithdrawalQuote {
  grossRnc: number;
  feeRnc: number;
  netRnc: number;
  discountPct: number;
  fiatCurrency: FiatCurrency;
  exchangeRate: number;
  grossFiat: number;
  netFiat: number;
  minRnc: number;
  rail: WithdrawalRailSpec;
}

export function computeWithdrawalQuote(params: {
  amountRnc: number;
  method: WithdrawalMethod;
  subNetwork: WithdrawalSubNetwork;
  executionMode: 'instant' | 'standard' | 'auto';
  plan: PlanTier;
  fiatCurrency: FiatCurrency;
  overrideRate?: number;
}): WithdrawalQuote {
  const {
    amountRnc,
    method,
    subNetwork,
    executionMode,
    plan,
    fiatCurrency,
    overrideRate,
  } = params;

  const rail =
    WITHDRAWAL_RAIL_SPECS[subNetwork] &&
    WITHDRAWAL_RAIL_SPECS[subNetwork].method === method
      ? WITHDRAWAL_RAIL_SPECS[subNetwork]
      : WITHDRAWAL_RAIL_SPECS[getDefaultSubNetworkForMethod(method)];

  const grossRnc = Math.max(0, Number.isFinite(amountRnc) ? amountRnc : 0);
  const rawRailFee = rail.baseFeeRnc + grossRnc * rail.pctFee;
  const modeMultiplier = executionMode === 'standard' ? 0.5 : 1.0;
  const instantPriorityFee =
    executionMode === 'instant' && plan !== 'elite' ? 0.006 : 0;
  const planMultiplier = plan === 'elite' ? 0.5 : plan === 'pro' ? 0.85 : 1.0;
  const discountPct =
    executionMode === 'standard' && plan === 'elite'
      ? 75
      : plan === 'elite' || executionMode === 'standard'
        ? 50
        : plan === 'pro'
          ? 15
          : 0;

  const computedFee =
    grossRnc > 0
      ? parseFloat(
          ((rawRailFee * modeMultiplier + instantPriorityFee) * planMultiplier).toFixed(4)
        )
      : 0;
  const feeRnc = Math.min(grossRnc, Math.max(0, computedFee));
  const netRnc = parseFloat(Math.max(0, grossRnc - feeRnc).toFixed(4));

  const fiatSpec = RNC_FIAT_RATES[fiatCurrency] || RNC_FIAT_RATES.EUR;
  const exchangeRate =
    overrideRate && overrideRate > 0 ? overrideRate : fiatSpec.rate;
  const grossFiat = grossRnc * exchangeRate;
  const netFiat = netRnc * exchangeRate;

  return {
    grossRnc,
    feeRnc,
    netRnc,
    discountPct,
    fiatCurrency,
    exchangeRate,
    grossFiat,
    netFiat,
    minRnc: rail.minRnc,
    rail,
  };
}

export function computeRncEarningRate(params: {
  plan: PlanTier;
  isVerified: boolean;
  isConnected: boolean;
  settings: Pick<
    AppSettings,
    'miningIntensity' | 'yieldOptimizationIA' | 'contributionType'
  >;
  reputation?: number;
  networkLoad?: number;
}): number {
  const {
    plan,
    isVerified,
    isConnected,
    settings,
    reputation = 100,
    networkLoad = 44,
  } = params;

  if (
    !isConnected ||
    plan === 'free' ||
    !isVerified ||
    settings.miningIntensity <= 0
  ) {
    return 0;
  }

  const base = plan === 'elite' ? 0.00018 : 0.00006;
  const intensityMult = 0.5 + settings.miningIntensity / 100;
  const iaMult = settings.yieldOptimizationIA ? 1.25 : 1.0;
  const typeMult =
    settings.contributionType === 'exit'
      ? 1.5
      : settings.contributionType === 'relay'
        ? 1.25
        : 1.0;
  const repMult = 1 + (Math.max(0, Math.min(100, reputation)) / 100) * 0.42;
  const loadBonus = 1 + Math.max(0, Math.min(100, networkLoad)) / 200;

  return base * intensityMult * iaMult * typeMult * repMult * loadBonus;
}

export function generateSettlementReference(
  method: WithdrawalMethod,
  subNetwork: WithdrawalSubNetwork
): string {
  const randomHex = (len: number) =>
    Array.from({ length: len }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

  if (method === 'crypto') {
    if (subNetwork === 'erc20' || subNetwork === 'polygon') {
      return `0x${randomHex(64)}`;
    }
    if (subNetwork === 'lightning') {
      return `ln-preimage-${randomHex(32)}`;
    }
    return randomHex(64);
  }
  if (method === 'mobile_money') {
    return `MM-${subNetwork.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase()}-${randomHex(4).toUpperCase()}`;
  }
  if (method === 'paypal') {
    return `PP-${randomHex(12).toUpperCase()}`;
  }
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SEPA-${datePart}-${randomHex(8).toUpperCase()}`;
}

// ============================================================================
// COMPILATEUR DE CONFIGURATIONS SYSTÈME NATIVES & INSPECTEUR DE DÉRIVE
// ============================================================================

export function resolveDnsPrimaryIp(settings: AppSettings): string {
  switch (settings.dns) {
    case 'cloudflare':
      return '1.1.1.1, 1.0.0.1';
    case 'quad9':
      return '9.9.9.9, 149.112.112.112';
    case 'opendns':
      return '208.67.222.222, 208.67.220.220';
    case 'google':
      return '8.8.8.8, 8.8.4.4';
    case 'custom':
      return settings.customDnsServer.trim() || '1.1.1.1';
  }
}

export interface EphemeralKeyMetadata {
  keyIdHex: string;
  publicKeyBase64: string;
  presharedKeyMask: string;
}

export function compileNativeTunnelConfig(
  settings: AppSettings,
  identity: VirtualIdentity,
  ephemeralKeys?: EphemeralKeyMetadata | null
): { filename: string; formatLabel: string; content: string } {
  const dnsLine = resolveDnsPrimaryIp(settings);
  const pqcComment =
    settings.postQuantumKex === 'ml-kem-1024'
      ? 'X25519 + ML-KEM-1024 (NIST FIPS-203 Hybrid PQC)'
      : settings.postQuantumKex === 'sntrup761'
        ? 'sntrup761x25519-sha512 (Streamlined NTRU Prime Hybrid)'
        : 'X25519-ChaCha20Poly1305 (Classique)';

  const activeBypassCidrs = settings.splitTunneling
    ? settings.splitTunnelRules
        .filter((r) => r.enabled && r.policy === 'bypass' && r.type === 'cidr')
        .map((r) => r.target)
    : [];

  if (settings.protocol === 'wireguard') {
    const allowedIps = settings.ipv6LeakProtection
      ? '0.0.0.0/0'
      : '0.0.0.0/0, ::/0';
    const mssRule = settings.mssClamping
      ? ' ; nft add rule inet renumerate forward tcp flags syn tcp option maxseg size set rt mtu'
      : '';
    const xdpHook = settings.ebpfXdpAcceleration
      ? ' ; ip link set dev wg0 xdp obj /usr/lib/renumerate/wg_xdp_fastpath.o sec xdp'
      : '';
    const postUp = settings.killSwitch
      ? `PostUp = nft -f /etc/renumerate/renumerate-egress.nft${mssRule}${xdpHook}`
      : `# Kill Switch désactivé (routage souple)${xdpHook ? `\nPostUp = ${xdpHook.slice(3)}` : ''}`;
    const postDown =
      settings.killSwitch && settings.killSwitchMode === 'strict'
        ? '# Mode Strict : la table nftables reste verrouillée après fermeture de wg0'
        : 'PostDown = nft delete table inet renumerate_guard 2>/dev/null || true';

    const pskLine =
      settings.postQuantumKex !== 'classic-x25519'
        ? ephemeralKeys
          ? `PresharedKey = ${ephemeralKeys.presharedKeyMask}`
          : `PresharedKey = <JETON_HYBRIDE_${settings.postQuantumKex.toUpperCase().replace(/-/g, '_')}>`
        : null;

    const lines = [
      `# Renumerate VPN — Profil natif WireGuard`,
      `# Passerelle active : ${identity.city}, ${identity.country} (${identity.ip}:${settings.tunnelPort})`,
      `# Échange de clés   : ${pqcComment}`,
      `# Congestion noyau  : ${settings.tcpCongestionControl.toUpperCase()} | Multi-Queue TUN : ${settings.multiQueueTun ? 'ON' : 'OFF'} | XDP eBPF : ${settings.ebpfXdpAcceleration ? 'ACTIF' : 'OFF'}`,
      `# Rotation PFS      : ${settings.ephemeralRekeyMinutes} min | TLS Frag Anti-DPI : ${settings.tlsClientHelloFragmentation ? 'ON' : 'OFF'} | Chaff Jitter : ${settings.trafficPaddingJitterMs} ms`,
      ...(ephemeralKeys
        ? [
            `# Session Key-ID    : ${ephemeralKeys.keyIdHex} (RAM Volatile mlockall)`,
            `# Clé Publique X25519 locale : ${ephemeralKeys.publicKeyBase64}`,
          ]
        : []),
      ``,
      `[Interface]`,
      `PrivateKey = ${ephemeralKeys ? `<RAM_LOCKED_PRIVKEY_${ephemeralKeys.keyIdHex.toUpperCase()}>` : '<CLE_PRIVEE_EPHEMERE_LOCALE_X25519>'}`,
      `Address = 10.66.42.18/32${settings.ipv6LeakProtection ? '' : ', fd42:66:42::18/128'}`,
      `DNS = ${dnsLine}`,
      `MTU = ${settings.mtuSize}`,
      `FwMark = 0xca6c`,
      `Table = ${settings.splitTunneling ? '51820' : 'auto'}`,
      postUp,
      postDown,
      ``,
      `[Peer]`,
      `# Relais ${identity.country.toUpperCase()} (${identity.city})`,
      `PublicKey = rNm8K9xP4vQ2zL7wT5cY1bN6mJ3hF0dG8sA4eR2uI9o=`,
      ...(pskLine ? [pskLine] : []),
      `AllowedIPs = ${allowedIps}`,
      `Endpoint = ${identity.ip}:${settings.tunnelPort}`,
      ...(settings.keepaliveInterval > 0
        ? [`PersistentKeepalive = ${settings.keepaliveInterval}`]
        : []),
      ...(activeBypassCidrs.length > 0
        ? [`# Exclusions Split-Tunnel CIDR : ${activeBypassCidrs.join(', ')}`]
        : []),
      ``,
    ];

    return {
      filename: 'wg0-renumerate.conf',
      formatLabel: 'WireGuard (.conf)',
      content: lines.join('\n'),
    };
  }

  if (settings.protocol === 'openvpn') {
    const transportProto = settings.tunnelPort === 443 || settings.tunnelPort === 8443 ? 'tcp' : 'udp';
    const tlsGroups =
      settings.postQuantumKex === 'ml-kem-1024'
        ? 'X25519MLKEM1024:X25519'
        : settings.postQuantumKex === 'sntrup761'
          ? 'sntrup761x25519:X25519'
          : 'X25519:secp384r1';
    const lines = [
      `# Renumerate VPN — Profil client OpenVPN 2.6 DCO`,
      `# Passerelle : ${identity.city}, ${identity.country} (${identity.ip}:${settings.tunnelPort})`,
      `client`,
      `dev tun0`,
      `proto ${transportProto}`,
      `remote ${identity.ip} ${settings.tunnelPort}`,
      `resolv-retry infinite`,
      `nobind`,
      `persist-key`,
      `persist-tun`,
      ...(settings.strictMemoryLock ? [`mlock`] : []),
      `reneg-sec ${settings.ephemeralRekeyMinutes * 60}`,
      `tun-mtu ${settings.mtuSize}`,
      ...(settings.mssClamping ? [`mssfix ${Math.max(1200, settings.mtuSize - 40)}`] : []),
      ...(settings.tlsClientHelloFragmentation ? [`tls-crypt-v2 /etc/renumerate/anti-dpi-frag.key`] : []),
      `data-ciphers AES-256-GCM:CHACHA20-POLY1305`,
      `tls-version-min 1.3`,
      `tls-groups ${tlsGroups}`,
      `remote-cert-tls server`,
      `dhcp-option DNS ${dnsLine.split(',')[0].trim()}`,
      ...(settings.dnsLeakProtection ? [`block-outside-dns`] : []),
      ...(settings.ipv6LeakProtection
        ? [
            `pull-filter ignore "ifconfig-ipv6"`,
            `pull-filter ignore "route-ipv6"`,
          ]
        : []),
      ...(settings.keepaliveInterval > 0
        ? [`keepalive 10 ${Math.max(30, settings.keepaliveInterval * 2)}`]
        : []),
      `verb 3`,
      ``,
    ];
    return {
      filename: 'renumerate-client.ovpn',
      formatLabel: 'OpenVPN (.ovpn)',
      content: lines.join('\n'),
    };
  }

  // IKEv2 / strongSwan swanctl
  const keProposal =
    settings.postQuantumKex === 'ml-kem-1024'
      ? 'aes256gcm16-prfsha384-ecp384-ke1_mlkem1024'
      : 'aes256gcm16-prfsha384-x25519';
  const lines = [
    `# Renumerate VPN — Profil IKEv2 / IPsec MOBIKE (swanctl)`,
    `connections {`,
    `  renumerate-ikev2 {`,
    `    version = 2`,
    `    mobike = yes`,
    `    remote_addrs = ${identity.ip}`,
    `    remote_port = ${settings.tunnelPort}`,
    `    vips = 0.0.0.0`,
    `    rekey_time = ${settings.ephemeralRekeyMinutes}m`,
    `    dpd_delay = ${settings.keepaliveInterval > 0 ? settings.keepaliveInterval : 30}s`,
    `    proposals = ${keProposal}`,
    `    children {`,
    `      net-tunnel {`,
    `        remote_ts = 0.0.0.0/0`,
    `        rekey_time = ${settings.ephemeralRekeyMinutes}m`,
    `        esp_proposals = aes256gcm16-x25519`,
    `        mtu = ${settings.mtuSize}`,
    `      }`,
    `    }`,
    `  }`,
    `}`,
    ``,
  ];
  return {
    filename: 'ipsec-renumerate.conf',
    formatLabel: 'IKEv2 StrongSwan (.conf)',
    content: lines.join('\n'),
  };
}

export function compileSysctlConfig(settings: AppSettings): {
  filename: string;
  content: string;
} {
  const lines = [
    `# /etc/sysctl.d/99-renumerate-hardening.conf`,
    `# Généré dynamiquement par le moteur système Renumerate VPN`,
    ``,
    `# File d'attente Fair-Queueing & Contrôle de congestion TCP`,
    `net.core.default_qdisc = fq`,
    `net.ipv4.tcp_congestion_control = ${settings.tcpCongestionControl}`,
    `net.ipv4.tcp_mtu_probing = ${settings.mssClamping ? 1 : 0}`,
    `net.core.netdev_max_backlog = ${settings.multiQueueTun ? 16384 : 4096}`,
    ``,
    `# Accélération eBPF/XDP & Durcissement du compilateur JIT noyau`,
    `net.core.bpf_jit_enable = ${settings.ebpfXdpAcceleration ? 1 : 0}`,
    `net.core.bpf_jit_harden = 2`,
    `kernel.unprivileged_bpf_disabled = 1`,
    ``,
    `# Étanchéité de la pile IPv6`,
    `net.ipv6.conf.all.disable_ipv6 = ${settings.ipv6LeakProtection ? 1 : 0}`,
    `net.ipv6.conf.default.disable_ipv6 = ${settings.ipv6LeakProtection ? 1 : 0}`,
    `net.ipv6.conf.lo.disable_ipv6 = ${settings.ipv6LeakProtection ? 1 : 0}`,
    ``,
    `# Validation stricte de route inverse & Anti-usurpation`,
    `net.ipv4.conf.all.rp_filter = ${settings.strictReversePathFilter ? 1 : 0}`,
    `net.ipv4.conf.default.rp_filter = ${settings.strictReversePathFilter ? 1 : 0}`,
    `net.ipv4.conf.all.accept_redirects = 0`,
    `net.ipv4.conf.all.send_redirects = 0`,
    `net.ipv4.tcp_syncookies = 1`,
    ``,
    `# Garde ARP Couche 2 (Réseaux Wi-Fi partagés)`,
    `net.ipv4.conf.all.arp_ignore = ${settings.arpSpoofGuard ? 1 : 0}`,
    `net.ipv4.conf.all.arp_announce = ${settings.arpSpoofGuard ? 2 : 0}`,
    `net.ipv4.conf.all.drop_gratuitous_arp = ${settings.arpSpoofGuard ? 1 : 0}`,
    ``,
    `# Verrouillage RAM (mlockall), Anti-Swap & Isolation des pointeurs noyau`,
    `fs.suid_dumpable = ${settings.strictMemoryLock ? 0 : 1}`,
    `vm.swappiness = ${settings.strictMemoryLock ? 1 : 60}`,
    `kernel.kptr_restrict = 2`,
    `kernel.dmesg_restrict = 1`,
    ``,
  ];

  return {
    filename: '99-renumerate-hardening.sysctl.conf',
    content: lines.join('\n'),
  };
}

export function compileNftablesConfig(
  settings: AppSettings,
  identity: VirtualIdentity
): { filename: string; content: string } {
  const iface = settings.protocol === 'wireguard' ? 'wg0' : 'tun0';
  const lines = [
    `#!/usr/sbin/nft -f`,
    `# /etc/renumerate/renumerate-egress.nft`,
    `# Politique Kill Switch : ${settings.killSwitch ? settings.killSwitchMode.toUpperCase() : 'DESACTIVE'} | XDP : ${settings.ebpfXdpAcceleration ? 'FASTPATH' : 'STANDARD'}`,
    ``,
    `table inet renumerate_guard {`,
    `  chain output {`,
    `    type filter hook output priority 0; policy ${settings.killSwitch ? 'drop' : 'accept'};`,
    `    oifname "lo" accept`,
    `    ct state established,related accept`,
    `    meta mark 0xca6c accept comment "Flux encapsulé Renumerate signé"`,
    `    ip daddr ${identity.ip} udp dport ${settings.tunnelPort} accept`,
    `    ip daddr ${identity.ip} tcp dport ${settings.tunnelPort} accept`,
    ...(settings.lanBypass
      ? [
          `    ip daddr { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 } accept`,
        ]
      : [`    # LAN Bypass désactivé : isolation stricte du sous-réseau local`]),
    ...(settings.blockQuicUdp443
      ? [
          `    oifname "${iface}" udp dport 443 reject with icmpx type admin-prohibited comment "Blocage QUIC HTTP/3"`,
        ]
      : []),
    ...(settings.ntpDriftProtection
      ? [
          `    oifname != "${iface}" udp dport 123 drop comment "Anti-dérive temporelle NTP hors tunnel"`,
        ]
      : []),
    ...(settings.dnsLeakProtection
      ? [
          `    oifname != "${iface}" udp dport 53 drop comment "Anti-fuite DNS UDP/53"`,
          `    oifname != "${iface}" tcp dport { 53, 853 } drop comment "Anti-fuite DNS TCP/DoT"`,
        ]
      : []),
    ...(settings.tlsClientHelloFragmentation
      ? [
          `    oifname "${iface}" tcp dport 443 ct state new tcp flags syn counter comment "Découpage SNI ClientHello Anti-DPI actif"`,
        ]
      : []),
    ...(settings.ipv6LeakProtection
      ? [`    meta nfproto ipv6 drop comment "Verrouillage intégral IPv6"`]
      : []),
    `    oifname "${iface}" accept`,
    `  }`,
    `}`,
    ``,
  ];

  return {
    filename: 'renumerate-egress.nft',
    content: lines.join('\n'),
  };
}

export function compileSystemdServiceConfig(settings: AppSettings): {
  filename: string;
  content: string;
} {
  const iface = settings.protocol === 'wireguard' ? 'wg0' : 'tun0';
  const cpuPolicy =
    settings.powerProfile === 'performance'
      ? 'fifo'
      : settings.powerProfile === 'eco'
        ? 'idle'
        : 'other';
  const niceLevel =
    settings.powerProfile === 'performance'
      ? -10
      : settings.powerProfile === 'eco'
        ? 10
        : 0;
  const caps = [
    'CAP_NET_ADMIN',
    'CAP_NET_RAW',
    ...(settings.ebpfXdpAcceleration ? ['CAP_BPF', 'CAP_PERFMON'] : []),
    ...(settings.strictMemoryLock ? ['CAP_IPC_LOCK'] : []),
  ].join(' ');

  const lines = [
    `# /etc/systemd/system/renumerate-tunnel.service`,
    `# Unité systemd durcie — Renumerate VPN Daemon`,
    `[Unit]`,
    `Description=Renumerate VPN Encrypted Tunnel & eBPF Guard (${iface})`,
    `After=network-online.target nss-lookup.target`,
    `Wants=network-online.target`,
    ``,
    `[Service]`,
    `Type=notify`,
    `ExecStart=/usr/bin/renumerate-daemon --iface ${iface} --pqc ${settings.postQuantumKex} --rekey ${settings.ephemeralRekeyMinutes}m --padding-jitter ${settings.trafficPaddingJitterMs}ms`,
    `ExecReload=/bin/kill -HUP $MAINPID`,
    `Restart=${settings.autoReconnect ? 'on-failure' : 'no'}`,
    `RestartSec=${settings.reconnectDelay}s`,
    `CPUSchedulingPolicy=${cpuPolicy}`,
    `Nice=${niceLevel}`,
    ``,
    `# Confinement mémoire & bac à sable noyau`,
    `LimitCORE=0`,
    `LimitMEMLOCK=${settings.strictMemoryLock ? 'infinity' : '64M'}`,
    `MemoryDenyWriteExecute=yes`,
    `NoNewPrivileges=yes`,
    `PrivateTmp=yes`,
    `ProtectHome=yes`,
    `ProtectSystem=strict`,
    `ProtectControlGroups=yes`,
    `ProtectKernelModules=yes`,
    `LockPersonality=yes`,
    `RestrictRealtime=${settings.powerProfile === 'performance' ? 'no' : 'yes'}`,
    `CapabilityBoundingSet=${caps}`,
    `AmbientCapabilities=${caps}`,
    ``,
    `[Install]`,
    `WantedBy=multi-user.target`,
    ``,
  ];

  return {
    filename: 'renumerate-tunnel.service',
    content: lines.join('\n'),
  };
}

export function compilePolicyRoutingScript(
  settings: AppSettings,
  identity: VirtualIdentity
): { filename: string; content: string } {
  const iface = settings.protocol === 'wireguard' ? 'wg0' : 'tun0';
  const activeRules = settings.splitTunneling
    ? settings.splitTunnelRules.filter((r) => r.enabled)
    : [];

  const lines = [
    `#!/usr/bin/env bash`,
    `# /etc/renumerate/renumerate-policy-route.sh`,
    `# Routage par politique ip-rule (fwmark 0xca6c -> table 51820)`,
    `set -euo pipefail`,
    ``,
    `IFACE="${iface}"`,
    `FWMARK="0xca6c"`,
    `TABLE_ID="51820"`,
    `ENDPOINT_IP="${identity.ip}"`,
    ``,
    `ip route replace 0.0.0.0/0 dev "$IFACE" table "$TABLE_ID"`,
    `ip rule add not fwmark "$FWMARK" table "$TABLE_ID" priority 32700 2>/dev/null || true`,
    `ip rule add table main suppress_prefixlength 0 priority 32690 2>/dev/null || true`,
    ...(settings.lanBypass
      ? [
          ``,
          `# Contournement RFC1918 (LAN local préservé)`,
          `ip rule add to 192.168.0.0/16 table main priority 32600 2>/dev/null || true`,
          `ip rule add to 10.0.0.0/8 table main priority 32601 2>/dev/null || true`,
          `ip rule add to 172.16.0.0/12 table main priority 32602 2>/dev/null || true`,
        ]
      : [
          ``,
          `# Isolation LAN stricte active (aucune exception RFC1918)`,
        ]),
    ...(activeRules.length > 0
      ? [
          ``,
          `# Règles Split Tunneling actives (${activeRules.length})`,
          ...activeRules.map((r) =>
            r.type === 'cidr'
              ? `ip rule add to ${r.target} table ${r.policy === 'bypass' ? 'main' : '"$TABLE_ID"'} priority 32550 2>/dev/null || true`
              : `# [${r.type.toUpperCase()}] ${r.target} -> ${r.policy === 'bypass' ? 'BYPASS (table main via nftables set)' : 'FORCE_TUNNEL (table 51820)'}`
          ),
        ]
      : []),
    ``,
  ];

  return {
    filename: 'renumerate-policy-route.sh',
    content: lines.join('\n'),
  };
}

export interface PacketVerdictResult {
  action: 'ACCEPT_TUNNEL' | 'BYPASS_DIRECT' | 'DROP_FIREWALL' | 'REJECT_QUIC';
  outboundInterface: string;
  matchedRule: string;
  latencyImpactMs: number;
  encapsulationOverheadBytes: number;
  traceSteps: string[];
  explanation: string;
}

function isRfc1918OrLocalTarget(target: string): boolean {
  const clean = target.trim().toLowerCase();
  if (clean.endsWith('.local') || clean.endsWith('.lan') || clean === 'localhost') {
    return true;
  }
  if (/^127\./.test(clean) || /^10\./.test(clean) || /^192\.168\./.test(clean)) {
    return true;
  }
  const m172 = clean.match(/^172\.(\d{1,3})\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function simulatePacketRouteVerdict(
  params: {
    destination: string;
    protocol: 'UDP' | 'TCP' | 'ICMPv6';
    port: number;
  },
  settings: AppSettings,
  identity: VirtualIdentity,
  isConnected: boolean,
  isEmergency: boolean
): PacketVerdictResult {
  const dest = params.destination.trim() || '1.1.1.1';
  const destLower = dest.toLowerCase();
  const port = Math.max(1, Math.min(65535, Math.round(params.port || 443)));
  const tunnelIface =
    settings.protocol === 'wireguard'
      ? 'wg0'
      : settings.protocol === 'ikev2'
        ? 'ipsec0'
        : 'tun0';
  const overheadBytes =
    (settings.protocol === 'wireguard'
      ? 80
      : settings.protocol === 'ikev2'
        ? 76
        : 69) +
    (settings.tlsClientHelloFragmentation && params.protocol === 'TCP' && port === 443
      ? 8
      : 0);

  const trace: string[] = [
    `1. Entrée socket noyau -> dst=${dest}:${port} proto=${params.protocol}`,
  ];

  if (isEmergency) {
    trace.push(`2. Arrêt immédiat : Coupe-circuit d'urgence (Emergency Lockdown) actif`);
    trace.push(`3. Verdict nftables inet renumerate_guard : DROP`);
    return {
      action: 'DROP_FIREWALL',
      outboundInterface: 'lo (verrouillé)',
      matchedRule: 'emergency_lockdown :: policy drop',
      latencyImpactMs: 0,
      encapsulationOverheadBytes: 0,
      traceSteps: trace,
      explanation:
        "Le coupe-circuit d'urgence bloque intégralement toute sortie réseau externe.",
    };
  }

  const isIpv6Target = params.protocol === 'ICMPv6' || dest.includes(':');
  if (isIpv6Target && settings.ipv6LeakProtection) {
    trace.push(`2. Détection trame IPv6 / ICMPv6 avec sysctl disable_ipv6=1`);
    trace.push(`3. Règle nftables : meta nfproto ipv6 drop`);
    return {
      action: 'DROP_FIREWALL',
      outboundInterface: 'aucune (rejet noyau)',
      matchedRule: 'nftables :: meta nfproto ipv6 drop',
      latencyImpactMs: 0,
      encapsulationOverheadBytes: 0,
      traceSteps: trace,
      explanation:
        'Paquet IPv6 neutralisé par le garde-fou anti-fuite IPv6 au niveau Netfilter.',
    };
  }

  if (settings.adBlocker) {
    const blockedMatch = settings.customBlockedDomains.find(
      (d) => destLower === d || destLower.endsWith(`.${d}`)
    );
    const heuristicTracker =
      (settings.threatFilters.trackers &&
        (destLower.includes('tracker') || destLower.includes('telemetry'))) ||
      (settings.threatFilters.cryptominers && destLower.includes('coinhive'));
    if (blockedMatch || heuristicTracker) {
      trace.push(`2. Inspection DNS Sinkhole : correspondance liste noire (${blockedMatch || 'filtre menace'})`);
      trace.push(`3. Résolution neutralisée vers 0.0.0.0 (NXDOMAIN)`);
      return {
        action: 'DROP_FIREWALL',
        outboundInterface: 'sinkhole0',
        matchedRule: `dns_shield :: block ${blockedMatch || 'threat-feed'}`,
        latencyImpactMs: 0,
        encapsulationOverheadBytes: 0,
        traceSteps: trace,
        explanation:
          'Domaine intercepté et bloqué en amont par le bouclier DNS anti-traqueurs.',
      };
    }
  }

  if (params.protocol === 'UDP' && port === 443 && settings.blockQuicUdp443) {
    trace.push(`2. Détection flux HTTP/3 QUIC sur UDP/443`);
    trace.push(`3. Règle nftables : udp dport 443 reject with icmpx admin-prohibited`);
    return {
      action: 'REJECT_QUIC',
      outboundInterface: tunnelIface,
      matchedRule: 'nftables :: udp dport 443 reject (anti-QUIC)',
      latencyImpactMs: 1,
      encapsulationOverheadBytes: 0,
      traceSteps: trace,
      explanation:
        'Flux QUIC UDP/443 rejeté proprement afin de forcer le navigateur à négocier TCP/TLS 1.3 dans le tunnel.',
    };
  }

  if (params.protocol === 'UDP' && port === 123 && settings.ntpDriftProtection && !isConnected) {
    trace.push(`2. Détection requête horloge NTP UDP/123 hors tunnel`);
    trace.push(`3. Règle nftables : oifname != "${tunnelIface}" udp dport 123 drop`);
    return {
      action: 'DROP_FIREWALL',
      outboundInterface: 'aucune (anti-dérive NTP)',
      matchedRule: 'nftables :: ntp_drift_guard udp/123 drop',
      latencyImpactMs: 0,
      encapsulationOverheadBytes: 0,
      traceSteps: trace,
      explanation:
        'Synchronisation NTP en clair bloquée hors tunnel pour empêcher le marquage temporel FAI.',
    };
  }

  if (isRfc1918OrLocalTarget(dest)) {
    if (settings.lanBypass) {
      trace.push(`2. Cible locale RFC1918 / mDNS détectée (${dest})`);
      trace.push(`3. Règle ip-rule prio 32600 : table main -> interface physique LAN`);
      return {
        action: 'BYPASS_DIRECT',
        outboundInterface: 'eth0 (LAN local)',
        matchedRule: 'ip-rule :: to RFC1918 lookup main (lanBypass=true)',
        latencyImpactMs: 1,
        encapsulationOverheadBytes: 0,
        traceSteps: trace,
        explanation:
          'Routage direct sur le sous-réseau local autorisé par la directive LAN Bypass.',
      };
    }
    trace.push(`2. Cible locale RFC1918 détectée mais LAN Bypass est désactivé`);
    trace.push(`3. Isolation stricte du sous-réseau local : DROP`);
    return {
      action: 'DROP_FIREWALL',
      outboundInterface: 'aucune (LAN isolé)',
      matchedRule: 'nftables :: rfc1918_strict_isolation drop',
      latencyImpactMs: 0,
      encapsulationOverheadBytes: 0,
      traceSteps: trace,
      explanation:
        'Accès au réseau local bloqué car l’isolation stricte LAN est activée.',
    };
  }

  if (settings.splitTunneling) {
    const matchedSplit = settings.splitTunnelRules.find((r) => {
      if (!r.enabled) return false;
      const t = r.target.toLowerCase();
      if (r.type === 'domain') {
        return destLower === t || destLower.endsWith(`.${t}`);
      }
      if (r.type === 'cidr') {
        const prefix = t.split('/')[0];
        const threeOctets = prefix.split('.').slice(0, 3).join('.');
        return destLower === prefix || (threeOctets.length > 4 && destLower.startsWith(`${threeOctets}.`));
      }
      return destLower === t;
    });

    if (matchedSplit) {
      if (matchedSplit.policy === 'bypass') {
        trace.push(`2. Correspondance Split Tunneling [BYPASS] : ${matchedSplit.target}`);
        trace.push(`3. Routage table main hors chiffrement vers passerelle FAI`);
        return {
          action: 'BYPASS_DIRECT',
          outboundInterface: 'eth0 (Split-Bypass)',
          matchedRule: `split_tunnel :: ${matchedSplit.target} -> bypass`,
          latencyImpactMs: 4,
          encapsulationOverheadBytes: 0,
          traceSteps: trace,
          explanation: `Ce flux contourne volontairement le tunnel selon votre règle Split Tunneling (${matchedSplit.target}).`,
        };
      }
      trace.push(`2. Correspondance Split Tunneling [VPN_ONLY] : ${matchedSplit.target}`);
    }
  }

  if (!isConnected) {
    if (settings.killSwitch) {
      trace.push(`2. Tunnel fermé + Kill Switch (${settings.killSwitchMode.toUpperCase()}) actif`);
      if (settings.killSwitchMode === 'strict' || (port === 53 && settings.dnsLeakProtection)) {
        trace.push(`3. Verdict nftables chain output : policy DROP`);
        return {
          action: 'DROP_FIREWALL',
          outboundInterface: 'aucune (Kill Switch)',
          matchedRule: `nftables :: kill_switch_${settings.killSwitchMode} drop`,
          latencyImpactMs: 0,
          encapsulationOverheadBytes: 0,
          traceSteps: trace,
          explanation:
            'Tunnel inactif : le coupe-circuit empêche toute fuite de paquet en clair vers votre FAI.',
        };
      }
    }
    trace.push(`2. Tunnel fermé et Kill Switch souple/inactif`);
    trace.push(`3. Sortie directe non chiffrée sur eth0`);
    return {
      action: 'BYPASS_DIRECT',
      outboundInterface: 'eth0 (clair FAI)',
      matchedRule: 'default_route :: main table (tunnel fermé)',
      latencyImpactMs: 8,
      encapsulationOverheadBytes: 0,
      traceSteps: trace,
      explanation:
        'Attention : le tunnel est déconnecté et ce paquet sortirait en clair sans Kill Switch Strict.',
    };
  }

  const xdpGain = settings.ebpfXdpAcceleration ? -2 : 0;
  const paddingDelay = Math.round(settings.trafficPaddingJitterMs * 0.35);
  const fragDelay =
    settings.tlsClientHelloFragmentation && params.protocol === 'TCP' && port === 443
      ? 2
      : 0;
  const estLatency = Math.max(
    2,
    identity.latency + xdpGain + paddingDelay + fragDelay
  );

  trace.push(
    `2. Marquage fwmark 0xca6c -> table 51820 (${settings.ebpfXdpAcceleration ? 'XDP Zero-Copy' : 'SKB standard'})`
  );
  if (settings.tlsClientHelloFragmentation && params.protocol === 'TCP' && port === 443) {
    trace.push(`3. Découpage TLS ClientHello SNI en 2 fragments TCP anti-DPI`);
  }
  trace.push(
    `${settings.tlsClientHelloFragmentation && params.protocol === 'TCP' && port === 443 ? '4' : '3'}. Encapsulation ${settings.protocol.toUpperCase()} (${settings.postQuantumKex.toUpperCase()}) -> sortie ${tunnelIface} vers ${identity.city} (${identity.ip})`
  );

  return {
    action: 'ACCEPT_TUNNEL',
    outboundInterface: `${tunnelIface} (${identity.country})`,
    matchedRule: `ip-rule 51820 :: oifname "${tunnelIface}" accept`,
    latencyImpactMs: estLatency,
    encapsulationOverheadBytes: overheadBytes,
    traceSteps: trace,
    explanation: `Paquet chiffré et acheminé sans fuite via ${tunnelIface} vers ${identity.city} (${identity.ip}).`,
  };
}

export interface SettingsDiffEntry {
  key: keyof AppSettings;
  label: string;
  category: string;
  defaultFormatted: string;
  currentFormatted: string;
}

function formatBoolFr(val: boolean): string {
  return val ? 'Activé' : 'Désactivé';
}

export function computeModifiedSettingsDiff(
  settings: AppSettings
): SettingsDiffEntry[] {
  const def = DEFAULT_APP_SETTINGS;
  const descriptors: Array<{
    key: keyof AppSettings;
    label: string;
    category: string;
    format: (s: AppSettings) => string;
    isEqual?: (a: AppSettings, b: AppSettings) => boolean;
  }> = [
    {
      key: 'protocol',
      label: 'Protocole de tunnel',
      category: 'Réseau & Noyau',
      format: (s) => s.protocol.toUpperCase(),
    },
    {
      key: 'tunnelPort',
      label: 'Port de transport',
      category: 'Réseau & Noyau',
      format: (s) => `:${s.tunnelPort}`,
    },
    {
      key: 'mtuSize',
      label: 'Segment MTU',
      category: 'Réseau & Noyau',
      format: (s) => `${s.mtuSize} octets`,
    },
    {
      key: 'tcpCongestionControl',
      label: 'Congestion TCP noyau',
      category: 'Réseau & Noyau',
      format: (s) => s.tcpCongestionControl.toUpperCase(),
    },
    {
      key: 'postQuantumKex',
      label: 'Échange de clés PQC',
      category: 'Cryptographie',
      format: (s) => s.postQuantumKex.toUpperCase(),
    },
    {
      key: 'keepaliveInterval',
      label: 'Persistent Keepalive NAT',
      category: 'Réseau & Noyau',
      format: (s) => (s.keepaliveInterval === 0 ? 'Désactivé' : `${s.keepaliveInterval}s`),
    },
    {
      key: 'mssClamping',
      label: 'Ajustement TCP MSS (PMTU)',
      category: 'Réseau & Noyau',
      format: (s) => formatBoolFr(s.mssClamping),
    },
    {
      key: 'multiQueueTun',
      label: 'Files parallèles Multi-Queue TUN',
      category: 'Réseau & Noyau',
      format: (s) => formatBoolFr(s.multiQueueTun),
    },
    {
      key: 'dns',
      label: 'Résolveur DNS chiffré',
      category: 'Bouclier & Pare-feu',
      format: (s) => s.dns.toUpperCase(),
    },
    {
      key: 'killSwitch',
      label: 'Coupe-circuit (Kill Switch)',
      category: 'Bouclier & Pare-feu',
      format: (s) => (s.killSwitch ? `Actif (${s.killSwitchMode})` : 'Désactivé'),
      isEqual: (a, b) =>
        a.killSwitch === b.killSwitch && a.killSwitchMode === b.killSwitchMode,
    },
    {
      key: 'dnsLeakProtection',
      label: 'Anti-fuite DNS strict',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.dnsLeakProtection),
    },
    {
      key: 'ipv6LeakProtection',
      label: 'Garde-fou pile IPv6',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.ipv6LeakProtection),
    },
    {
      key: 'webrtcLeakShield',
      label: 'Bouclier WebRTC STUN',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.webrtcLeakShield),
    },
    {
      key: 'blockQuicUdp443',
      label: 'Blocage QUIC (UDP/443)',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.blockQuicUdp443),
    },
    {
      key: 'blockCaptivePortalProbes',
      label: 'Neutralisation sondes OS',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.blockCaptivePortalProbes),
    },
    {
      key: 'arpSpoofGuard',
      label: 'Garde ARP Anti-Spoofing',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.arpSpoofGuard),
    },
    {
      key: 'strictReversePathFilter',
      label: 'Filtre strict rp_filter',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.strictReversePathFilter),
    },
    {
      key: 'anonymityLevel',
      label: "Niveau d'anonymat des sauts",
      category: 'Identité & Morphing',
      format: (s) => s.anonymityLevel.toUpperCase(),
    },
    {
      key: 'autoRotation',
      label: 'Rotation cyclique IP/MAC',
      category: 'Identité & Morphing',
      format: (s) =>
        s.autoRotation ? `Active (${s.rotationInterval} min)` : 'Manuelle',
      isEqual: (a, b) =>
        a.autoRotation === b.autoRotation &&
        a.rotationInterval === b.rotationInterval,
    },
    {
      key: 'obfuscationLevel',
      label: 'Obfuscation matérielle',
      category: 'Identité & Morphing',
      format: (s) => s.obfuscationLevel.toUpperCase(),
    },
    {
      key: 'excludeEyesJurisdictions',
      label: 'Exclusion 5/14-Eyes',
      category: 'Onion Vortex',
      format: (s) =>
        s.excludeEyesJurisdictions === 'none'
          ? 'Aucune'
          : `Hors ${s.excludeEyesJurisdictions.toUpperCase()}`,
    },
    {
      key: 'vortexBridge',
      label: 'Pont anti-DPI Vortex',
      category: 'Onion Vortex',
      format: (s) => s.vortexBridge.toUpperCase(),
    },
    {
      key: 'vortexCircuitLength',
      label: 'Longueur circuit Vortex',
      category: 'Onion Vortex',
      format: (s) => `${s.vortexCircuitLength} sauts`,
    },
    {
      key: 'powerProfile',
      label: 'Profil énergétique démon',
      category: 'Système & Gouvernance',
      format: (s) => s.powerProfile.toUpperCase(),
    },
    {
      key: 'autoLockVaultMinutes',
      label: 'Verrouillage auto Coffre RAM',
      category: 'Système & Gouvernance',
      format: (s) =>
        s.autoLockVaultMinutes === 0
          ? 'Désactivé'
          : `${s.autoLockVaultMinutes} min`,
    },
    {
      key: 'clipboardAutoClearSeconds',
      label: 'Purge presse-papiers',
      category: 'Système & Gouvernance',
      format: (s) =>
        s.clipboardAutoClearSeconds === 0
          ? 'Désactivée'
          : `${s.clipboardAutoClearSeconds}s`,
    },
    {
      key: 'privacyScreenBlurOnInactive',
      label: 'Voile furtif hors focus',
      category: 'Système & Gouvernance',
      format: (s) => formatBoolFr(s.privacyScreenBlurOnInactive),
    },
    {
      key: 'panicAction',
      label: 'Protocole Panique',
      category: 'Système & Gouvernance',
      format: (s) =>
        s.panicAction === 'lockdown'
          ? 'Kill Switch Strict'
          : s.panicAction === 'disconnect_wipe'
            ? 'Déconnexion + Purge RAM'
            : 'Verrouiller Coffre + Morphing',
    },
    {
      key: 'logRetentionHours',
      label: 'Rétention journaux',
      category: 'Système & Gouvernance',
      format: (s) =>
        s.logRetentionHours === 0 ? 'RAM Volatile (0h)' : `${s.logRetentionHours}h`,
    },
    {
      key: 'lanBypass',
      label: 'Accès réseau local (LAN)',
      category: 'Réseau & Noyau',
      format: (s) => formatBoolFr(s.lanBypass),
    },
    {
      key: 'splitTunneling',
      label: 'Split Tunneling sélectif',
      category: 'Réseau & Noyau',
      format: (s) => formatBoolFr(s.splitTunneling),
    },
    {
      key: 'socks5Enabled',
      label: 'Passerelle SOCKS5',
      category: 'Réseau & Noyau',
      format: (s) =>
        s.socks5Enabled ? `${s.socks5Host}:${s.socks5Port}` : 'Désactivée',
    },
    {
      key: 'ebpfXdpAcceleration',
      label: 'Accélération eBPF / XDP Zero-Copy',
      category: 'Réseau & Noyau',
      format: (s) => formatBoolFr(s.ebpfXdpAcceleration),
    },
    {
      key: 'tlsClientHelloFragmentation',
      label: 'Fragmentation TLS ClientHello (Anti-DPI)',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.tlsClientHelloFragmentation),
    },
    {
      key: 'trafficPaddingJitterMs',
      label: 'Bourrage Chaff Anti-Corrélation',
      category: 'Cryptographie',
      format: (s) =>
        s.trafficPaddingJitterMs === 0
          ? 'Désactivé (0 ms)'
          : `Actif (${s.trafficPaddingJitterMs} ms)`,
    },
    {
      key: 'ephemeralRekeyMinutes',
      label: 'Rotation clés éphémères PFS',
      category: 'Cryptographie',
      format: (s) => `${s.ephemeralRekeyMinutes} min`,
    },
    {
      key: 'strictMemoryLock',
      label: 'Verrouillage RAM mlockall (Anti-Swap)',
      category: 'Système & Gouvernance',
      format: (s) => formatBoolFr(s.strictMemoryLock),
    },
    {
      key: 'ntpDriftProtection',
      label: 'Garde horloge NTP/NTS tunnel',
      category: 'Bouclier & Pare-feu',
      format: (s) => formatBoolFr(s.ntpDriftProtection),
    },
  ];

  const diffs: SettingsDiffEntry[] = [];
  for (const item of descriptors) {
    const equal = item.isEqual
      ? item.isEqual(settings, def)
      : settings[item.key] === def[item.key];
    if (!equal) {
      diffs.push({
        key: item.key,
        label: item.label,
        category: item.category,
        defaultFormatted: item.format(def),
        currentFormatted: item.format(settings),
      });
    }
  }
  return diffs;
}

export function auditConfigurationIntegrity(
  settings: AppSettings,
  isConnected = false
): ConfigurationAuditIssue[] {
  const issues: ConfigurationAuditIssue[] = [];

  // 1. WireGuard MTU vs MSS Clamping
  if (
    settings.protocol === 'wireguard' &&
    settings.mtuSize > 1420 &&
    !settings.mssClamping
  ) {
    issues.push({
      id: 'conf_mtu_wireguard_fragmentation',
      severity: 'warning',
      category: 'mtu_transport',
      title: 'Risque de fragmentation Path-MTU sur tunnel WireGuard',
      description: `Le MTU (${settings.mtuSize}B) avec l'encapsulation WireGuard (80B) excède le standard Ethernet (1500B) sans MSS Clamping.`,
      impact:
        'Pertes de paquets et retransmissions excessives sur liaisons WAN ou modems 4G/5G.',
      patchLabel: 'Fixer le MTU à 1420B et activer le MSS Clamping',
      patch: { mtuSize: 1420, mssClamping: true },
    });
  }

  // 2. Kill Switch Strict vs LAN Bypass
  if (
    settings.killSwitch &&
    settings.killSwitchMode === 'strict' &&
    settings.lanBypass
  ) {
    issues.push({
      id: 'conf_strict_killswitch_lan_bypass',
      severity: 'warning',
      category: 'leak_killswitch',
      title: 'Incohérence Kill Switch Strict et Bypass Réseau Local (LAN)',
      description:
        'Le Kill Switch strict applique une règle de rejet absolu en amont des exceptions RFC 1918 locales (LAN Bypass).',
      impact:
        "Les imprimantes réseau, NAS et flux locaux risquent d'être coupés brutalement.",
      patchLabel: 'Basculer le Kill Switch en mode souple (soft)',
      patch: { killSwitchMode: 'soft' },
    });
  }

  // 3. Post-Quantum KEX (ML-KEM-1024) vs Low MTU
  if (settings.postQuantumKex === 'ml-kem-1024' && settings.mtuSize < 1280) {
    issues.push({
      id: 'conf_pqc_kem_mtu_underrun',
      severity: 'critical',
      category: 'pqc_kex',
      title: 'MTU insuffisant pour le Handshake Post-Quantique ML-KEM-1024',
      description:
        'Les clés hybrides FIPS-203 (1184 octets) requièrent un segment non fragmenté supérieur à 1280B.',
      impact:
        'Échec de négociation cryptographique avec les nœuds de transit durcis.',
      patchLabel: 'Rehausser le segment MTU à 1380 octets',
      patch: { mtuSize: 1380 },
    });
  }

  // 4. WebRTC Leak Shield Inactif
  if (!settings.webrtcLeakShield) {
    issues.push({
      id: 'conf_webrtc_leak_unshielded',
      severity: 'critical',
      category: 'leak_killswitch',
      title: 'Bouclier anti-fuite WebRTC mDNS inactif',
      description:
        'Les candidats STUN/ICE exécutés dans les pages web peuvent sonder et fuiter vos adresses IPv4/IPv6 réelles.',
      impact:
        "Exposition directe de l'adresse IP de votre fournisseur d'accès à Internet (FAI).",
      patchLabel: 'Activer le bouclier anti-fuite WebRTC',
      patch: { webrtcLeakShield: true },
    });
  }

  // 5. DNS Custom Invalide / Vide
  if (
    settings.dns === 'custom' &&
    (!settings.customDnsServer || !settings.customDnsServer.trim())
  ) {
    issues.push({
      id: 'conf_dns_custom_invalid',
      severity: 'critical',
      category: 'dns',
      title: 'Résolveur DNS personnalisé non configuré',
      description:
        'Le protocole DNS est réglé sur "custom" mais le champ de serveur est vide.',
      impact:
        'Échec total de résolution des noms de domaine lors de la navigation.',
      patchLabel: 'Bascule automatique sur Quad9 (DNSSEC / No-Log)',
      patch: { dns: 'quad9', customDnsServer: '' },
    });
  }

  // 6. Tor Onion Vortex sans Exclusion des Juridictions 14-Eyes
  if (
    settings.vortexBridge !== 'none' &&
    settings.excludeEyesJurisdictions === 'none'
  ) {
    issues.push({
      id: 'conf_vortex_14eyes_surveillance',
      severity: 'warning',
      category: 'tor_privacy',
      title: 'Onion Vortex actif sans sanctuarisation juridictionnelle',
      description:
        "Le pontage Vortex est actif sans filtre sur les 14-Eyes, exposant l'entrée ou la sortie à la surveillance étatique.",
      impact:
        'Risque de corrélation temporelle du trafic par des agences de renseignement.',
      patchLabel: "Exclure les 14 pays de l'alliance 14-Eyes",
      patch: { excludeEyesJurisdictions: '14-eyes' },
    });
  }

  // 7. Gouverneur Performance avec Jitter Chaff excessif (>35ms)
  if (
    settings.powerProfile === 'performance' &&
    settings.trafficPaddingJitterMs >= 35
  ) {
    issues.push({
      id: 'conf_perf_power_chaff_jitter',
      severity: 'info',
      category: 'performance_jitter',
      title:
        'Bourrage temporel Chaff contradictoire avec le Profil Performance',
      description: `Le gouverneur processeur est réglé en mode Performance, mais un délai artificiel de ${settings.trafficPaddingJitterMs}ms est injecté.`,
      impact:
        'Latence accrue injustifiée pour le streaming temps réel et les tunnels basse latence.',
      patchLabel: 'Désactiver le bourrage Chaff (latence minimale 0 ms)',
      patch: { trafficPaddingJitterMs: 0 },
    });
  }

  // 8. Rétention des journaux prolongée en mode Furtivité Extrême
  if (settings.anonymityLevel === 'extreme' && settings.logRetentionHours > 24) {
    issues.push({
      id: 'conf_extreme_anonymity_log_retention',
      severity: 'info',
      category: 'security',
      title: 'Rétention locale des journaux prolongée en Furtivité Extrême',
      description: `La posture d'anonymat est sur Extrême alors que les journaux sont conservés pendant ${settings.logRetentionHours}h.`,
      impact:
        "Possibilité d'analyse forensique locale en cas de saisie matérielle.",
      patchLabel: 'Ajuster la rétention des journaux à 4 heures',
      patch: { logRetentionHours: 4 },
    });
  }

  // 9. SOCKS5 Activé sans Hôte valide
  if (
    settings.socks5Enabled &&
    (!settings.socks5Host || !settings.socks5Host.trim())
  ) {
    issues.push({
      id: 'conf_socks5_missing_host',
      severity: 'warning',
      category: 'mtu_transport',
      title: "Proxy SOCKS5 local actif sans hôte d'écoute",
      description:
        'Le démon proxy SOCKS5 est activé mais le champ hôte d\'écoute est indéterminé.',
      impact: "Le port d'écoute SOCKS5 ne peut pas être initialisé.",
      patchLabel: "Assigner l'écoute locale 127.0.0.1:1080",
      patch: { socks5Host: '127.0.0.1', socks5Port: 1080 },
    });
  }

  // 10. Bloqueur de menaces actif sans aucun filtre sélectionné
  if (
    settings.adBlocker &&
    !settings.threatFilters.ads &&
    !settings.threatFilters.trackers &&
    !settings.threatFilters.malware &&
    !settings.threatFilters.cryptominers
  ) {
    issues.push({
      id: 'conf_adblock_no_filters_active',
      severity: 'info',
      category: 'dns',
      title: 'Bloqueur actif sans filtre de menaces coché',
      description:
        "Le module Sinkhole anti-menaces est activé mais aucune liste noire (pub, malwares, mineurs) n'est cochée.",
      impact: 'Aucune trame DNS n\'est filtrée par le sinkhole.',
      patchLabel: "Activer l'ensemble des 4 filtres de menaces",
      patch: {
        threatFilters: {
          ads: true,
          trackers: true,
          malware: true,
          cryptominers: true,
        },
      },
    });
  }

  return issues;
}

export const INITIAL_INTRUSION_ATTEMPTS: IntrusionAttempt[] = [
  {
    id: 'ids-att-001',
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    severity: 'high',
    vector: 'port_scan',
    title: 'Balayage furtif de ports TCP SYN (Nmap Sweep)',
    description:
      'Séquence rapide de paquets TCP SYN ciblant les ports 22, 80, 443, 51820 et 8080 depuis un nœud de sortie Tor non authentifié.',
    sourceIp: '185.220.101.45',
    sourceCountry: 'Allemagne',
    targetPort: 51820,
    targetInterface: 'eth0',
    protocol: 'TCP',
    signatureRule: 'SURICATA-ET-SCAN-SYN-SWEEP-v2',
    actionTaken: 'drop_xdp',
    quarantined: true,
    rawPayloadSnippet:
      '45 00 00 2c 91 32 00 00 34 06 a1 d9 b9 dc 65 2d ... SYN seq=0x3f910a2b win=1024',
    remediationAdvice:
      'Rejet au niveau eBPF/XDP immédiat sans allocation sk_buff. IP placée sur liste de quarantaine nftables.',
  },
  {
    id: 'ids-att-002',
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    severity: 'critical',
    vector: 'arp_poisoning',
    title: 'Attaque MITM par empoisonnement de cache ARP',
    description:
      'Trame Gratuitous ARP annonçant l’adresse MAC 52:54:00:fa:8c:12 pour l’adresse IP de passerelle 192.168.1.1 en divergence avec la table statique locale.',
    sourceIp: '192.168.1.134',
    sourceCountry: 'LAN Local',
    targetPort: 0,
    targetInterface: 'eth0',
    protocol: 'ARP',
    signatureRule: 'EBPF-ARP-INCONSISTENCY-GATEWAY-POISON',
    actionTaken: 'nft_quarantine',
    quarantined: true,
    rawPayloadSnippet:
      'ff ff ff ff ff ff 52 54 00 fa 8c 12 08 06 00 01 ... ARP reply 192.168.1.1 is-at 52:54:00:fa:8c:12',
    remediationAdvice:
      'ARP Spoof Guard a ignoré l’annonce empoisonnée et scellé la table ARP statique.',
  },
  {
    id: 'ids-att-003',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    severity: 'medium',
    vector: 'webrtc_leak',
    title: 'Sonde de fuite STUN / WebRTC non sollicitée',
    description:
      'Requête STUN Binding Request non encapsulée ciblant UDP/3478 tentant de forcer la résolution de l’adresse IP publique réelle hors du tunnel.',
    sourceIp: '45.33.32.156',
    sourceCountry: 'États-Unis',
    targetPort: 3478,
    targetInterface: 'eth0',
    protocol: 'UDP',
    signatureRule: 'NETFILTER-WEBRTC-UNSOLICITED-STUN-LEAK',
    actionTaken: 'sinkhole',
    quarantined: false,
    rawPayloadSnippet:
      '00 01 00 00 21 12 a4 42 7a 88 12 49 53 10 cc 99 ... STUN binding-request probe',
    remediationAdvice:
      'WebRTC Leak Shield a dérouté le paquet vers l’interface sinkhole0.',
  },
  {
    id: 'ids-att-004',
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    severity: 'critical',
    vector: 'replay_attack',
    title: 'Violation de fenêtre anti-rejeu WireGuard / PQC',
    description:
      'Paquet de données chiffré injecté présentant un compteur de séquence déjà acquitté (différence -487), caractéristique d’une attaque par rejeu passif.',
    sourceIp: '91.240.118.82',
    sourceCountry: 'Russie',
    targetPort: 51820,
    targetInterface: 'wg0',
    protocol: 'UDP',
    signatureRule: 'WG-REPLAY-SLIDING-WINDOW-VIOLATION',
    actionTaken: 'tunnel_rekey',
    quarantined: true,
    rawPayloadSnippet:
      '04 00 00 00 81 22 90 a1 00 00 01 eb 44 a8 7c 99 ... WG data pkt replay counter mismatch',
    remediationAdvice:
      'Rejet immédiat par la fenêtre glissante de WireGuard et renouvellement éphémère de session initié.',
  },
  {
    id: 'ids-att-005',
    timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    severity: 'high',
    vector: 'brute_force',
    title: 'Attaque par force brute sur mandataire SOCKS5 & Auth',
    description:
      'Rafale d’échecs d’authentification consécutifs (18 tentatives en 3 secondes) sur l’interface mandataire locale.',
    sourceIp: '194.26.29.112',
    sourceCountry: 'Pays-Bas',
    targetPort: 1080,
    targetInterface: 'eth0',
    protocol: 'TCP',
    signatureRule: 'HIDS-BRUTEFORCE-RATE-LIMIT-EXCEEDED',
    actionTaken: 'nft_quarantine',
    quarantined: true,
    rawPayloadSnippet:
      '05 02 00 02 01 05 61 64 6d 69 6e ... SOCKS5 auth-req fail count=18',
    remediationAdvice:
      'Hôte placé en liste noire nftables (drop direct pendant 24 heures).',
  },
];

export const INITIAL_QUARANTINE_LIST: QuarantinedHost[] = [
  {
    ip: '185.220.101.45',
    bannedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    reason: 'Scan furtif SYN multi-ports détecté par filtre eBPF/XDP',
    attemptsCount: 24,
    vector: 'port_scan',
    expiresInMinutes: 1440,
  },
  {
    ip: '192.168.1.134',
    bannedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    reason: 'Usurpation ARP de la passerelle LAN (MITM local intercepté)',
    attemptsCount: 3,
    vector: 'arp_poisoning',
    expiresInMinutes: 'permanent',
  },
  {
    ip: '91.240.118.82',
    bannedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    reason: 'Tentative d’injection par rejeu de paquets WireGuard/PQC',
    attemptsCount: 7,
    vector: 'replay_attack',
    expiresInMinutes: 720,
  },
  {
    ip: '194.26.29.112',
    bannedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    reason: 'Saturation de requêtes d’authentification SOCKS5 (>15 req/sec)',
    attemptsCount: 42,
    vector: 'brute_force',
    expiresInMinutes: 1440,
  },
];

export function generateSimulatedIntrusion(vector: IntrusionVector): IntrusionAttempt {
  const now = new Date().toISOString();
  const randId = `ids-sim-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 899 + 100
  )}`;

  switch (vector) {
    case 'port_scan':
      return {
        id: randId,
        timestamp: now,
        severity: 'high',
        vector: 'port_scan',
        title: 'Simulation : Balayage agressif SYN/Xmas (Nmap)',
        description:
          'Séquence simulée de paquets avec drapeaux FIN, PSH, URG anormaux (Xmas scan) détectée par eBPF/XDP sur l’interface externe.',
        sourceIp: `198.51.100.${Math.floor(Math.random() * 200 + 10)}`,
        sourceCountry: 'Sonde de test (Sandbox)',
        targetPort: 443,
        targetInterface: 'eth0',
        protocol: 'TCP',
        signatureRule: 'SURICATA-ET-SCAN-XMAS-FLAGS-ANOMALY',
        actionTaken: 'drop_xdp',
        quarantined: true,
        rawPayloadSnippet:
          '45 00 00 28 d4 11 00 00 40 06 ... TCP flags=FIN|PSH|URG seq=0x01 win=0',
        remediationAdvice:
          'Règle eBPF drop_xdp exécutée. L’attaquant ne reçoit aucune réponse RST.',
      };
    case 'arp_poisoning':
      return {
        id: randId,
        timestamp: now,
        severity: 'critical',
        vector: 'arp_poisoning',
        title: 'Simulation : Usurpation d’identité ARP de passerelle',
        description:
          'Simulation d’annonce ARP parasite prétendant associer l’adresse IP de passerelle à une fausse adresse MAC physique.',
        sourceIp: `192.168.1.${Math.floor(Math.random() * 100 + 150)}`,
        sourceCountry: 'Réseau local (Simulé)',
        targetPort: 0,
        targetInterface: 'eth0',
        protocol: 'ARP',
        signatureRule: 'EBPF-ARP-SPOOF-GUARD-ACTIVE-DEFENSE',
        actionTaken: 'nft_quarantine',
        quarantined: true,
        rawPayloadSnippet:
          'ff ff ff ff ff ff 02 42 ac 11 00 02 08 06 ... ARP reply mismatch on local gateway',
        remediationAdvice:
          'La table ARP locale a été verrouillée en mode immuable et la MAC parasite est mise en quarantaine.',
      };
    case 'webrtc_leak':
      return {
        id: randId,
        timestamp: now,
        severity: 'medium',
        vector: 'webrtc_leak',
        title: 'Simulation : Tentative d’exfiltration STUN / WebRTC',
        description:
          'Simulation d’un script tiers injecté tentant de générer une requête ICE/STUN hors de la table de routage du VPN.',
        sourceIp: '203.0.113.88',
        sourceCountry: 'Sonde WebRTC simulée',
        targetPort: 3478,
        targetInterface: 'eth0',
        protocol: 'UDP',
        signatureRule: 'NETFILTER-WEBRTC-LEAK-DEFENSE-SINKHOLE',
        actionTaken: 'sinkhole',
        quarantined: false,
        rawPayloadSnippet:
          '00 01 00 08 21 12 a4 42 1f c4 55 90 ... STUN binding candidate leak attempt',
        remediationAdvice:
          'Le pare-feu a immédiatement redirigé la tentative vers le sinkhole local.',
      };
    case 'replay_attack':
      return {
        id: randId,
        timestamp: now,
        severity: 'critical',
        vector: 'replay_attack',
        title: 'Simulation : Attaque par rejeu cryptographique WireGuard/PQC',
        description:
          'Simulation de capture et réinjection d’un bloc de données chiffrées avec compteur dépassé.',
        sourceIp: `185.196.220.${Math.floor(Math.random() * 200 + 10)}`,
        sourceCountry: 'Relais hostile simulé',
        targetPort: 51820,
        targetInterface: 'wg0',
        protocol: 'UDP',
        signatureRule: 'WG-REPLAY-ANTI-TAMPER-ASSERTION-FAILED',
        actionTaken: 'tunnel_rekey',
        quarantined: true,
        rawPayloadSnippet:
          '04 00 00 00 c8 14 00 a2 ... Replay counter 0x0000000a < window base 0x00000420',
        remediationAdvice:
          'Rejet automatique par la couche cryptographique et renouvellement de clé éphémère déclenché.',
      };
    case 'brute_force':
      return {
        id: randId,
        timestamp: now,
        severity: 'high',
        vector: 'brute_force',
        title: 'Simulation : Bourrage d’identifiants Vault & SOCKS5',
        description:
          'Simulation d’une attaque automatisée par dictionnaire sur l’interface d’authentification locale.',
        sourceIp: `198.18.0.${Math.floor(Math.random() * 200 + 10)}`,
        sourceCountry: 'Botnet simulé',
        targetPort: 1080,
        targetInterface: 'eth0',
        protocol: 'TCP',
        signatureRule: 'HIDS-BRUTEFORCE-RATE-LIMIT-TRIGGERED',
        actionTaken: 'nft_quarantine',
        quarantined: true,
        rawPayloadSnippet:
          'POST /api/vault/unlock HTTP/1.1 ... 12 attempts in 400ms',
        remediationAdvice:
          'Verrouillage automatique avec délai exponentiel et IP source mise en quarantaine nftables.',
      };
    case 'dns_hijack':
    default:
      return {
        id: randId,
        timestamp: now,
        severity: 'high',
        vector: 'dns_hijack',
        title: 'Simulation : Tentative d’empoisonnement de cache DNS (Kaminsky)',
        description:
          'Simulation d’injection massive de réponses DNS avec ID de transaction aléatoires ciblant le résolveur local.',
        sourceIp: `198.51.100.${Math.floor(Math.random() * 200 + 50)}`,
        sourceCountry: 'Faux résolveur FAI',
        targetPort: 53,
        targetInterface: 'eth0',
        protocol: 'DNS',
        signatureRule: 'DNS-POISONING-TRANSACTION-ID-MISMATCH',
        actionTaken: 'sinkhole',
        quarantined: true,
        rawPayloadSnippet:
          '1a 2b 81 80 00 01 00 01 ... DNS reply rogue authority NS injection',
        remediationAdvice:
          'Le résolveur local applique la validation stricte DoH/DNSSEC et a rejeté la réponse malveillante.',
      };
  }
}


