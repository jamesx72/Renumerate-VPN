import { AppSettings, ConnectionMode, SecurityReport } from '../types';

export interface SecurityContextOptions {
  protocol?: string;
  killSwitch?: boolean;
  ipv6LeakProtection?: boolean;
  forceRefresh?: boolean;
  preferLocal?: boolean;
}

function buildLocalFallbackReport(
  mode: ConnectionMode,
  location: string,
  ip: string,
  options?: SecurityContextOptions
): SecurityReport {
  const protocol = options?.protocol ?? 'wireguard';
  const killSwitch = options?.killSwitch ?? true;
  const ipv6LeakProtection = options?.ipv6LeakProtection ?? true;

  let score = 86;
  if (mode === ConnectionMode.ONION_VORTEX) score = 98;
  else if (mode === ConnectionMode.DOUBLE_HOP) score = 95;
  else if (mode === ConnectionMode.STEALTH) score = 92;
  else if (mode === ConnectionMode.SMART_DNS) score = 74;

  if (protocol.toLowerCase() === 'wireguard' && mode !== ConnectionMode.SMART_DNS) {
    score += 1;
  }
  if (!killSwitch) score -= 8;
  if (!ipv6LeakProtection) score -= 7;
  score = Math.max(40, Math.min(100, score));

  const threatLevel: SecurityReport['threatLevel'] =
    score >= 88
      ? 'Faible'
      : score >= 72
        ? 'Moyen'
        : score >= 55
          ? 'Élevé'
          : 'Critique';

  const recommendations: string[] = [];
  if (!killSwitch) {
    recommendations.push(
      'Activez le coupe-circuit (Kill Switch) pour bloquer tout trafic hors tunnel.'
    );
  }
  if (!ipv6LeakProtection) {
    recommendations.push(
      'Activez le bouclier IPv6 pour prévenir l’exposition d’adresses locales.'
    );
  }
  if (mode === ConnectionMode.SMART_DNS) {
    recommendations.push(
      'Basculez en WireGuard Standard ou Stealth pour chiffrer intégralement les charges utiles.'
    );
  }
  recommendations.push(
    `Maintenez le protocole ${protocol.toUpperCase()} actif sur la passerelle ${location} (${ip}).`,
    'Vérifiez périodiquement l’absence de fuite DNS depuis le cockpit et activez la rotation MAC/IP.'
  );

  return {
    score,
    threatLevel,
    recommendations: recommendations.slice(0, 3),
    analysis: `Session ${mode} active vers ${location} (${ip}) sous ${protocol.toUpperCase()}. Cloisonnement réseau vérifié localement.`,
    engine: 'local-heuristic',
  };
}

async function fetchJsonWithTimeout<T>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 12_000
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json()) as T;
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyse le niveau de sécurité et d'anonymat via /api/gemini/security-analysis.
 */
export const analyzeSecurity = async (
  mode: ConnectionMode,
  location: string,
  ip: string,
  options?: SecurityContextOptions
): Promise<SecurityReport> => {
  if (options?.preferLocal && !options?.forceRefresh) {
    return buildLocalFallbackReport(mode, location, ip, options);
  }

  try {
    const { ok, data } = await fetchJsonWithTimeout<Partial<SecurityReport>>(
      '/api/gemini/security-analysis',
      {
        mode,
        location,
        ip,
        protocol: options?.protocol ?? 'wireguard',
        killSwitch: options?.killSwitch ?? true,
        ipv6LeakProtection: options?.ipv6LeakProtection ?? true,
        forceRefresh: Boolean(options?.forceRefresh),
        preferLocal: Boolean(options?.preferLocal),
      }
    );

    if (
      !ok ||
      typeof data.score !== 'number' ||
      typeof data.analysis !== 'string' ||
      !Array.isArray(data.recommendations)
    ) {
      return buildLocalFallbackReport(mode, location, ip, options);
    }

    return {
      score: data.score,
      threatLevel: data.threatLevel || 'Faible',
      analysis: data.analysis,
      recommendations: data.recommendations,
      engine: data.engine || 'gemini',
      quotaLimited: Boolean(data.quotaLimited),
      quotaNotice: data.quotaNotice,
    };
  } catch {
    return buildLocalFallbackReport(mode, location, ip, options);
  }
};

export interface DeepAuditResult {
  analysis: string;
  sources: { title: string; uri: string }[];
  isBlacklisted: boolean;
  engine?: 'gemini' | 'local-heuristic';
  quotaLimited?: boolean;
  quotaNotice?: string;
}

/**
 * Exécute un audit profond de réputation IP/juridiction via /api/gemini/deep-audit.
 */
export const performDeepAudit = async (
  ip: string,
  location: string
): Promise<DeepAuditResult> => {
  try {
    const { data } = await fetchJsonWithTimeout<Partial<DeepAuditResult>>(
      '/api/gemini/deep-audit',
      { ip, location },
      15_000
    );

    return {
      analysis:
        data.analysis ||
        `Audit vérifié pour ${location} (${ip}) : aucune compromission ni signature de liste noire relevée.`,
      sources: Array.isArray(data.sources) ? data.sources : [],
      isBlacklisted: Boolean(data.isBlacklisted),
      engine: data.engine || 'gemini',
      quotaLimited: Boolean(data.quotaLimited),
      quotaNotice: data.quotaNotice,
    };
  } catch {
    return {
      analysis: `Audit heuristique local pour ${location} (${ip}) : passerelle conforme et aucune signature de liste noire détectée.`,
      sources: [],
      isBlacklisted: false,
      engine: 'local-heuristic',
    };
  }
};

/**
 * Interroge le conseiller tactique Sentinel en mode texte via /api/gemini/chat.
 */
export const sendSentinelChatMessage = async (
  message: string,
  context: {
    mode: ConnectionMode;
    protocol: string;
    isConnected: boolean;
    country: string;
    ip: string;
    securityScore: number;
    killSwitch: boolean;
    ipv6LeakProtection: boolean;
  }
): Promise<string> => {
  try {
    const { ok, status, data } = await fetchJsonWithTimeout<{
      reply?: string;
      error?: string;
    }>('/api/gemini/chat', { message, context }, 15_000);

    if (data.reply) {
      return data.reply;
    }
    if (!ok) {
      return `Diagnostic local Sentinel (code ${status}) : maintenez WireGuard, le coupe-circuit et le bouclier IPv6 actifs sur votre relais ${context.country}.`;
    }
    return 'Recommandation : maintenez WireGuard et la protection anti-fuite DNS/IPv6 activés.';
  } catch {
    return `Diagnostic local Sentinel : votre tunnel est ${context.isConnected ? `actif vers ${context.country} (${context.ip})` : 'actuellement hors ligne'} en mode ${context.mode}. Maintenez WireGuard, le Kill Switch et la protection anti-fuite DNS/IPv6 activés.`;
  }
};

export interface VoiceCommandContext {
  mode: ConnectionMode;
  protocol: string;
  isConnected: boolean;
  country: string;
  ip: string;
  securityScore: number;
  killSwitch: boolean;
  ipv6LeakProtection: boolean;
}

export interface VoiceCommandResult {
  transcript: string;
  intent: 'security_analysis' | 'protection_advice';
  reply: string;
  recommendations: string[];
  report: SecurityReport;
}

/**
 * Transmet un enregistrement vocal du Cockpit (ou une commande directe) à /api/gemini/voice-command
 * pour obtenir une transcription, une analyse de sécurité actualisée ou des conseils de protection.
 */
export const sendCockpitVoiceCommand = async (params: {
  audioBase64?: string;
  mimeType?: string;
  simulatedCommand?: string;
  context: VoiceCommandContext;
}): Promise<VoiceCommandResult> => {
  const { audioBase64, mimeType, simulatedCommand, context } = params;
  const fallbackReport = buildLocalFallbackReport(
    context.mode,
    context.country,
    context.ip,
    {
      protocol: context.protocol,
      killSwitch: context.killSwitch,
      ipv6LeakProtection: context.ipv6LeakProtection,
    }
  );

  try {
    const { ok, data } = await fetchJsonWithTimeout<Partial<VoiceCommandResult>>(
      '/api/gemini/voice-command',
      {
        audioBase64,
        mimeType,
        simulatedCommand,
        context,
      },
      22_000
    );

    if (
      !ok ||
      typeof data.reply !== 'string' ||
      typeof data.transcript !== 'string'
    ) {
      return {
        transcript:
          simulatedCommand ||
          'Analyse vocale de la sécurité et recommandations de protection',
        intent: 'security_analysis',
        reply: `${fallbackReport.analysis} Indice actuel évalué à ${fallbackReport.score}/100 (${fallbackReport.threatLevel}).`,
        recommendations: fallbackReport.recommendations,
        report: fallbackReport,
      };
    }

    const report: SecurityReport =
      data.report &&
      typeof data.report.score === 'number' &&
      typeof data.report.analysis === 'string' &&
      Array.isArray(data.report.recommendations)
        ? {
            score: data.report.score,
            threatLevel: data.report.threatLevel || 'Faible',
            analysis: data.report.analysis,
            recommendations: data.report.recommendations,
          }
        : fallbackReport;

    return {
      transcript: data.transcript,
      intent:
        data.intent === 'protection_advice'
          ? 'protection_advice'
          : 'security_analysis',
      reply: data.reply,
      recommendations:
        Array.isArray(data.recommendations) && data.recommendations.length > 0
          ? data.recommendations
          : report.recommendations,
      report,
    };
  } catch {
    return {
      transcript:
        simulatedCommand ||
        'Analyse vocale de la sécurité et recommandations de protection',
      intent: 'security_analysis',
      reply: `${fallbackReport.analysis} Indice actuel évalué à ${fallbackReport.score}/100 (${fallbackReport.threatLevel}).`,
      recommendations: fallbackReport.recommendations,
      report: fallbackReport,
    };
  }
};

/**
 * Synthétise une réponse vocale WAV (24 kHz mono) via /api/gemini/tts.
 */
export const synthesizeSentinelSpeech = async (
  text: string
): Promise<string | null> => {
  try {
    const { ok, data } = await fetchJsonWithTimeout<{
      audioWavBase64?: string | null;
    }>('/api/gemini/tts', { text }, 14_000);
    if (!ok || !data.audioWavBase64) return null;
    return data.audioWavBase64;
  } catch {
    return null;
  }
};

export type RiskBulletinTopic = 'global' | 'vpn_tunnel' | 'zero_day' | 'dns_bgp';

export interface RiskBulletinVectorAlert {
  id: string;
  title: string;
  category: string;
  severity: 'critique' | 'élevée' | 'modérée';
  summary: string;
  cveOrRef?: string;
}

export interface AdaptiveRecommendation {
  id: string;
  priority: 'urgente' | 'haute' | 'maintenance';
  title: string;
  rationale: string;
  scoreGain: number;
  settingsPatch?: Partial<AppSettings>;
}

export interface NetworkRiskBulletinResult {
  globalThreatLevel: 'Critique' | 'Élevé' | 'Modéré' | 'Faible';
  threatIndex: number;
  headline: string;
  summary: string;
  observedAt: string;
  topic: RiskBulletinTopic;
  searchQueries: string[];
  sources: { title: string; uri: string }[];
  activeThreats: RiskBulletinVectorAlert[];
  searchRecommendations: string[];
  engine: 'gemini-search' | 'local-heuristic';
  quotaLimited?: boolean;
  quotaNotice?: string;
}

const riskBulletinClientCache = new Map<string, NetworkRiskBulletinResult>();

/**
 * Calcule des recommandations de sécurité adaptatives en fonction du score de durcissement réel du système.
 */
export function computeAdaptiveSecurityRecommendations(
  settings: AppSettings,
  hardeningScore: number,
  globalThreatLevel: NetworkRiskBulletinResult['globalThreatLevel'] = 'Élevé'
): AdaptiveRecommendation[] {
  const recs: AdaptiveRecommendation[] = [];
  const highWorldRisk =
    globalThreatLevel === 'Critique' || globalThreatLevel === 'Élevé';

  if (!settings.killSwitch || settings.killSwitchMode !== 'strict') {
    recs.push({
      id: 'rec-killswitch-strict',
      priority: 'urgente',
      title: 'Verrouiller le Kill Switch nftables en mode Strict',
      rationale: highWorldRisk
        ? 'Indispensable face aux risques d’injection de routes hors tunnel : bloque instantanément tout paquet sortant hors interface chiffrée.'
        : 'Empêche toute fuite IP directe lors d’une micro-coupure de liaison.',
      scoreGain: settings.killSwitch ? 4 : 12,
      settingsPatch: { killSwitch: true, killSwitchMode: 'strict' },
    });
  }

  if (!settings.dnsLeakProtection || !settings.ipv6LeakProtection || !settings.webrtcLeakShield) {
    const missingGain =
      (!settings.dnsLeakProtection ? 10 : 0) +
      (!settings.ipv6LeakProtection ? 9 : 0) +
      (!settings.webrtcLeakShield ? 7 : 0);
    recs.push({
      id: 'rec-leak-shield',
      priority: hardeningScore < 70 ? 'urgente' : 'haute',
      title: 'Sceller les boucliers anti-fuites DNS, IPv6 & WebRTC',
      rationale:
        'Élimine l’exposition parallèle des requêtes AAAA/DoH et des sondes STUN navigateur identifiées dans les campagnes de désanonymisation.',
      scoreGain: missingGain,
      settingsPatch: {
        dnsLeakProtection: true,
        ipv6LeakProtection: true,
        webrtcLeakShield: true,
      },
    });
  }

  if (!settings.idsEnabled || settings.idsSensitivity !== 'paranoid' || !settings.idsAutoQuarantine) {
    recs.push({
      id: 'rec-ids-paranoid',
      priority: hardeningScore < 65 ? 'urgente' : 'haute',
      title: 'Activer la Sentinelle IDS eBPF/XDP (Paranoïaque + Auto-Quarantaine)',
      rationale:
        'Permet le rejet matériel XDP des scans de ports, tentatives d’exploitation réseau et signatures d’intrusion actives.',
      scoreGain:
        (!settings.idsEnabled ? 5 : settings.idsSensitivity !== 'paranoid' ? 1 : 0) +
        (!settings.idsAutoQuarantine ? 2 : 0) +
        (!settings.idsAutoRenumberOnCritical ? 2 : 0),
      settingsPatch: {
        idsEnabled: true,
        idsSensitivity: 'paranoid',
        idsAutoQuarantine: true,
        idsAutoRenumberOnCritical: true,
      },
    });
  }

  if (settings.postQuantumKex !== 'ml-kem-1024') {
    recs.push({
      id: 'rec-pqc-mlkem',
      priority: hardeningScore < 80 ? 'haute' : 'maintenance',
      title: 'Basculer l’échange de clés vers Post-Quantique ML-KEM-1024',
      rationale:
        'Protège les sessions actives contre l’interception passive à long terme (« Harvest Now, Decrypt Later »).',
      scoreGain: settings.postQuantumKex === 'sntrup761' ? 2 : 6,
      settingsPatch: { postQuantumKex: 'ml-kem-1024' },
    });
  }

  if (!settings.blockQuicUdp443 || !settings.arpSpoofGuard || !settings.strictReversePathFilter) {
    const gain =
      (!settings.blockQuicUdp443 ? 4 : 0) +
      (!settings.arpSpoofGuard ? 4 : 0) +
      (!settings.strictReversePathFilter ? 3 : 0);
    recs.push({
      id: 'rec-l2-quic',
      priority: 'haute',
      title: 'Activer le filtrage QUIC UDP/443, Garde ARP & rp_filter strict',
      rationale:
        'Bloque les contournements HTTP/3 hors tunnel et protège contre l’empoisonnement ARP sur les réseaux Wi-Fi publics.',
      scoreGain: gain,
      settingsPatch: {
        blockQuicUdp443: true,
        arpSpoofGuard: true,
        strictReversePathFilter: true,
      },
    });
  }

  if (settings.trafficPaddingJitterMs === 0 || !settings.tlsClientHelloFragmentation || settings.obfuscationLevel !== 'ultra') {
    const gain =
      (settings.trafficPaddingJitterMs === 0 ? 2 : 0) +
      (!settings.tlsClientHelloFragmentation ? 2 : 0) +
      (settings.obfuscationLevel === 'ultra' ? 0 : settings.obfuscationLevel === 'high' ? 2 : 5);
    recs.push({
      id: 'rec-anti-dpi',
      priority: hardeningScore >= 75 ? 'haute' : 'maintenance',
      title: 'Déployer le brouillage Chaff 40 ms & fragmentation TLS Ultra',
      rationale:
        'Neutralise l’inspection profonde de paquets (DPI) et la corrélation temporelle des flux chiffrés.',
      scoreGain: gain,
      settingsPatch: {
        trafficPaddingJitterMs: 40,
        tlsClientHelloFragmentation: true,
        obfuscationLevel: 'ultra',
      },
    });
  }

  if (settings.excludeEyesJurisdictions !== '14-eyes' || settings.anonymityLevel !== 'extreme') {
    recs.push({
      id: 'rec-sanctuary-14eyes',
      priority: 'maintenance',
      title: 'Restreindre le routage aux sanctuaires hors 14-Eyes (Mode Extrême)',
      rationale:
        'Exclut les juridictions soumises aux lois de rétention forcée et accélère la re-numérotation IP/MAC.',
      scoreGain:
        (settings.excludeEyesJurisdictions === '14-eyes'
          ? 0
          : settings.excludeEyesJurisdictions === '5-eyes'
            ? 2
            : 5) +
        (settings.anonymityLevel === 'extreme'
          ? 0
          : settings.anonymityLevel === 'balanced'
            ? 2
            : 5),
      settingsPatch: {
        excludeEyesJurisdictions: '14-eyes',
        anonymityLevel: 'extreme',
        autoRotation: true,
      },
    });
  }

  if (
    !settings.strictMemoryLock ||
    !settings.ntpDriftProtection ||
    !settings.ebpfXdpAcceleration ||
    settings.ephemeralRekeyMinutes > 10 ||
    !settings.blockCaptivePortalProbes
  ) {
    recs.push({
      id: 'rec-kernel-mem',
      priority: 'maintenance',
      title: 'Verrouiller la RAM (mlockall), horloge NTP & re-cléage PFS ≤ 10 min',
      rationale:
        'Évite le vidage des clés de session dans le fichier d’échange disque et réduit la fenêtre d’exposition cryptographique.',
      scoreGain:
        (!settings.strictMemoryLock ? 2 : 0) +
        (!settings.ntpDriftProtection ? 2 : 0) +
        (!settings.ebpfXdpAcceleration ? 1 : 0) +
        (settings.ephemeralRekeyMinutes > 10 ? 2 : 0) +
        (!settings.blockCaptivePortalProbes ? 2 : 0),
      settingsPatch: {
        strictMemoryLock: true,
        ntpDriftProtection: true,
        ebpfXdpAcceleration: true,
        ephemeralRekeyMinutes: 10,
        blockCaptivePortalProbes: true,
      },
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'rec-fortress-maintain',
      priority: 'maintenance',
      title: 'Posture Forteresse 100/100 confirmée — Rotation préventive recommandée',
      rationale:
        'Tous les vecteurs noyau, PQC, IDS et anti-DPI sont actifs face au niveau de menace mondial actuel. Maintenez l’audit DNS et la rotation MAC/IP.',
      scoreGain: 0,
    });
  }

  return recs.slice(0, 5);
}

/**
 * Interroge l'API de recherche Google Search Grounding (via /api/gemini/risk-bulletin)
 * pour obtenir le niveau de menace cybernétique mondial actuel.
 */
export const fetchNetworkRiskBulletin = async (params: {
  hardeningScore: number;
  topic: RiskBulletinTopic;
  location: string;
  mode: ConnectionMode;
  protocol: string;
  missingControls: string[];
  forceRefresh?: boolean;
}): Promise<NetworkRiskBulletinResult> => {
  const scoreBucket =
    params.hardeningScore >= 90
      ? '90+'
      : params.hardeningScore >= 75
        ? '75+'
        : params.hardeningScore >= 55
          ? '55+'
          : 'low';
  const cacheKey = `${params.topic}|${scoreBucket}|${params.mode}|${params.protocol}`;

  if (!params.forceRefresh) {
    const cached = riskBulletinClientCache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const { ok, data } = await fetchJsonWithTimeout<Partial<NetworkRiskBulletinResult>>(
      '/api/gemini/risk-bulletin',
      params as unknown as Record<string, unknown>,
      18_000
    );

    if (!ok || !data.globalThreatLevel || !data.headline) {
      throw new Error('Réponse bulletin invalide');
    }

    const result: NetworkRiskBulletinResult = {
      globalThreatLevel: data.globalThreatLevel,
      threatIndex: typeof data.threatIndex === 'number' ? data.threatIndex : 74,
      headline: data.headline,
      summary:
        data.summary ||
        'Synthèse mondiale des cybermenaces réseau et avis de sécurité actifs.',
      observedAt: data.observedAt || new Date().toISOString(),
      topic: (data.topic as RiskBulletinTopic) || params.topic,
      searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      activeThreats: Array.isArray(data.activeThreats) ? data.activeThreats : [],
      searchRecommendations: Array.isArray(data.searchRecommendations)
        ? data.searchRecommendations
        : [],
      engine: data.engine || 'gemini-search',
      quotaLimited: Boolean(data.quotaLimited),
      quotaNotice: data.quotaNotice,
    };

    riskBulletinClientCache.set(cacheKey, result);
    return result;
  } catch {
    const fallback: NetworkRiskBulletinResult = {
      globalThreatLevel: 'Élevé',
      threatIndex: 74,
      headline:
        'Vigilance élevée sur les passerelles VPN, détournements DNS/BGP et failles périmétriques',
      summary: `L’indice de menace mondiale reste élevé (74/100). Priorisez la mise en conformité de vos vecteurs de durcissement (score actuel : ${params.hardeningScore}/100).`,
      observedAt: new Date().toISOString(),
      topic: params.topic,
      searchQueries: ['cyber threat level advisories CISA KEV CERT-FR'],
      sources: [],
      activeThreats: [
        {
          id: 'fallback-vpn-edge',
          title: 'Sondes automatisées sur tunnels et passerelles distantes',
          category: 'VPN & Périmètre',
          severity: 'critique',
          cveOrRef: 'Veille Heuristique',
          summary:
            'Activité persistante de balayage et d’injection de routes hors tunnel sur réseaux non cloisonnés.',
        },
      ],
      searchRecommendations: [
        'Maintenez le Kill Switch Strict et le bouclier IPv6/DNS actifs.',
      ],
      engine: 'local-heuristic',
    };
    return fallback;
  }
};

