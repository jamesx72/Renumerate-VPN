import {
  VirtualIdentity,
  DeviceNode,
  AppSettings,
  SplitTunnelRule,
  PlanTier,
  WithdrawalMethod,
  WithdrawalSubNetwork,
  FiatCurrency,
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
  };
}

export function computeSettingsHardeningScore(settings: AppSettings): number {
  let score = 25;
  if (settings.killSwitch) score += settings.killSwitchMode === 'strict' ? 14 : 9;
  if (settings.dnsLeakProtection) score += 12;
  if (settings.ipv6LeakProtection) score += 10;
  if (settings.webrtcLeakShield) score += 8;
  if (settings.adBlocker) {
    const activeFilters = Object.values(settings.threatFilters).filter(Boolean).length;
    score += Math.round((activeFilters / 4) * 8);
  }
  if (settings.autoRotation) score += 6;
  if (settings.obfuscationLevel === 'ultra') score += 7;
  else if (settings.obfuscationLevel === 'high') score += 4;
  if (settings.excludeEyesJurisdictions === '14-eyes') score += 6;
  else if (settings.excludeEyesJurisdictions === '5-eyes') score += 3;
  if (settings.fingerprintProtection.canvasNoise) score += 2;
  if (settings.fingerprintProtection.webglMask) score += 2;
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
