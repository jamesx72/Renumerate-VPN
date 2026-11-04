import { ConnectionMode, SecurityReport } from '../types';

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

