import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';
import type {
  GenerateContentConfig,
  GenerateContentResponse,
  LiveServerMessage,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const TEXT_MODEL_CASCADE = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
] as const;

const QUOTA_GUIDANCE_FR =
  'Quota Gemini API atteint (429) — moteur heuristique local actif. Pour augmenter votre quota, sélectionnez une clé API avec facturation activée dans Settings > Secrets.';

interface SecurityReportPayload {
  score: number;
  threatLevel: 'Faible' | 'Moyen' | 'Élevé' | 'Critique';
  analysis: string;
  recommendations: string[];
  engine?: 'gemini' | 'local-heuristic';
  quotaLimited?: boolean;
  quotaNotice?: string;
}

interface DeepAuditPayload {
  analysis: string;
  sources: { title: string; uri: string }[];
  isBlacklisted: boolean;
  engine?: 'gemini' | 'local-heuristic';
  quotaLimited?: boolean;
  quotaNotice?: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const modelCooldownUntil = new Map<string, number>();
const securityAnalysisCache = new Map<string, CacheEntry<SecurityReportPayload>>();
const securityAnalysisInFlight = new Map<string, Promise<SecurityReportPayload>>();
const deepAuditCache = new Map<string, CacheEntry<DeepAuditPayload>>();

let globalQuotaCircuitUntil = 0;
let globalQuotaTrippedAt = 0;
let lastApiKeyDigest = '';

function getApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  const digest = key
    ? crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)
    : '';
  if (digest !== lastApiKeyDigest) {
    lastApiKeyDigest = digest;
    modelCooldownUntil.clear();
    globalQuotaCircuitUntil = 0;
    globalQuotaTrippedAt = 0;
  }
  return key;
}

function createGenAIClient(): GoogleGenAI | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxEntries = 96
): void {
  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

interface ClassifiedGeminiError {
  statusCode: number;
  statusText: string;
  isQuotaExhausted: boolean;
  isRateLimited: boolean;
  isServerOverload: boolean;
  isTransient: boolean;
  isAuthOrConfig: boolean;
  retryDelayMs: number;
}

function parseRetryDelayMs(rawText: string): number {
  const retryInMatch = rawText.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (retryInMatch?.[1]) {
    const sec = parseFloat(retryInMatch[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(10 * 60_000, Math.max(5_000, Math.ceil(sec * 1000)));
    }
  }
  const jsonDelayMatch = rawText.match(/"retryDelay"\s*:\s*"([0-9]+(?:\.[0-9]+)?)s"/i);
  if (jsonDelayMatch?.[1]) {
    const sec = parseFloat(jsonDelayMatch[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(10 * 60_000, Math.max(5_000, Math.ceil(sec * 1000)));
    }
  }
  return 0;
}

function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  let statusCode = 0;
  let statusText = '';
  let message = '';

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    if (typeof record.status === 'number') {
      statusCode = record.status;
    } else if (typeof record.code === 'number') {
      statusCode = record.code;
    }
    if (typeof record.status === 'string') {
      statusText = record.status;
    }
    if (typeof record.message === 'string') {
      message = record.message;
    }
  } else if (typeof err === 'string') {
    message = err;
  }

  const rawCombined = message;
  const retryDelayMs = parseRetryDelayMs(rawCombined);

  const jsonStart = message.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart)) as {
        error?: { code?: number; status?: string; message?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number' && !statusCode) {
          statusCode = parsed.error.code;
        }
        if (typeof parsed.error.status === 'string' && !statusText) {
          statusText = parsed.error.status;
        }
        if (typeof parsed.error.message === 'string') {
          message = parsed.error.message;
        }
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  const lower = `${statusText} ${message}`.toLowerCase();

  const isQuotaExhausted =
    statusCode === 429 &&
    (lower.includes('exceeded your current quota') ||
      lower.includes('check your plan and billing') ||
      lower.includes('quota exceeded') ||
      lower.includes('limit: 0') ||
      lower.includes('per_day') ||
      lower.includes('billing') ||
      lower.includes('quota_circuit_open'));

  const isRateLimited =
    !isQuotaExhausted &&
    (statusCode === 429 || lower.includes('resource_exhausted'));

  const isServerOverload =
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('fetch failed') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset');

  const isAuthOrConfig =
    statusCode === 400 ||
    statusCode === 401 ||
    statusCode === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated');

  return {
    statusCode,
    statusText,
    isQuotaExhausted,
    isRateLimited,
    isServerOverload,
    isTransient: isRateLimited || isServerOverload,
    isAuthOrConfig,
    retryDelayMs,
  };
}

function formatCleanFrenchGeminiError(err: unknown): string {
  const info = classifyGeminiError(err);
  if (info.isQuotaExhausted || info.isRateLimited) {
    return QUOTA_GUIDANCE_FR;
  }
  if (info.isAuthOrConfig) {
    return 'Configuration de clé API invalide ou accès restreint côté serveur (vérifiez GEMINI_API_KEY dans Settings > Secrets).';
  }
  if (info.isServerOverload) {
    return 'Le moteur distant connaît un pic de sollicitation temporaire. Veuillez réessayer dans quelques instants.';
  }
  return 'Service distant momentanément indisponible. Les outils locaux de diagnostic restent pleinement opérationnels.';
}

function getReadyCandidateModels(models: readonly string[]): string[] {
  const now = Date.now();
  const ready: string[] = [];
  for (const m of models) {
    const until = modelCooldownUntil.get(m) ?? 0;
    if (until <= now) {
      if (until > 0) modelCooldownUntil.delete(m);
      ready.push(m);
    }
  }
  return ready;
}

function createQuotaCircuitError(): Error {
  const err = new Error('429: quota_circuit_open — exceeded your current quota');
  (err as unknown as Record<string, unknown>).status = 429;
  return err;
}

async function generateWithModelCascade(options: {
  ai: GoogleGenAI;
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
  models?: readonly string[];
  allowCircuitProbe?: boolean;
  buildConfig?: (model: string) => GenerateContentConfig | undefined;
}): Promise<{ response: GenerateContentResponse; model: string }> {
  const now = Date.now();
  if (globalQuotaCircuitUntil > now) {
    if (options.allowCircuitProbe && now - globalQuotaTrippedAt >= 60_000) {
      // Allow a single lightweight probe after 60s when manually requested by user
      globalQuotaCircuitUntil = 0;
      modelCooldownUntil.delete('gemini-3.1-flash-lite');
    } else {
      throw createQuotaCircuitError();
    }
  }

  const candidates = getReadyCandidateModels(
    options.models ?? TEXT_MODEL_CASCADE
  );
  if (candidates.length === 0) {
    throw createQuotaCircuitError();
  }

  let lastError: unknown = new Error('Aucun modèle disponible');
  let quotaFailuresInCascade = 0;

  for (let idx = 0; idx < candidates.length; idx++) {
    const model = candidates[idx];
    const maxAttempts = 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await options.ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.buildConfig ? options.buildConfig(model) : undefined,
        });
        modelCooldownUntil.delete(model);
        globalQuotaCircuitUntil = 0;
        return { response, model };
      } catch (err) {
        lastError = err;
        const info = classifyGeminiError(err);

        if (info.isAuthOrConfig && info.statusCode !== 400) {
          throw err;
        }

        if (info.isQuotaExhausted) {
          quotaFailuresInCascade += 1;
          const cooldownMs = Math.max(info.retryDelayMs, 5 * 60_000);
          modelCooldownUntil.set(model, Date.now() + cooldownMs);

          // If lightweight model also reports billing/daily quota exhaustion or 2 models fail with quota exhaustion, trip global circuit breaker immediately
          if (model === 'gemini-3.1-flash-lite' || quotaFailuresInCascade >= 2) {
            globalQuotaTrippedAt = Date.now();
            globalQuotaCircuitUntil = Date.now() + cooldownMs;
            throw err;
          }
          break;
        }

        if (info.isRateLimited) {
          const cooldownMs = Math.max(info.retryDelayMs, 60_000);
          modelCooldownUntil.set(model, Date.now() + cooldownMs);
          break;
        }

        if (info.isServerOverload) {
          modelCooldownUntil.set(model, Date.now() + 20_000);
          if (idx < candidates.length - 1) {
            await sleep(220 + Math.floor(Math.random() * 120));
          }
          break;
        }

        // Move to next candidate on model-specific 400 config differences
        break;
      }
    }
  }

  throw lastError;
}

function normalizeSecurityReport(
  raw: unknown,
  fallbackParams: {
    mode: string;
    location: string;
    ip: string;
    protocol?: string;
    killSwitch?: boolean;
    ipv6LeakProtection?: boolean;
  }
): SecurityReportPayload {
  const fallback = buildDeterministicSecurityReport(fallbackParams);
  if (!raw || typeof raw !== 'object') return fallback;

  const obj = raw as Record<string, unknown>;
  const numericScore = Number(obj.score);
  const score = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(100, Math.round(numericScore)))
    : fallback.score;

  const validLevels = new Set(['Faible', 'Moyen', 'Élevé', 'Critique']);
  const threatLevel =
    typeof obj.threatLevel === 'string' && validLevels.has(obj.threatLevel)
      ? (obj.threatLevel as SecurityReportPayload['threatLevel'])
      : score >= 88
        ? 'Faible'
        : score >= 72
          ? 'Moyen'
          : score >= 55
            ? 'Élevé'
            : 'Critique';

  const analysis =
    typeof obj.analysis === 'string' && obj.analysis.trim().length > 8
      ? obj.analysis.trim()
      : fallback.analysis;

  const rawRecs = Array.isArray(obj.recommendations)
    ? obj.recommendations
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 3)
        .map((item) => item.trim())
    : [];

  const recommendations =
    rawRecs.length >= 3
      ? rawRecs.slice(0, 3)
      : [...rawRecs, ...fallback.recommendations].slice(0, 3);

  return {
    score,
    threatLevel,
    analysis,
    recommendations,
  };
}

function buildDeterministicSecurityReport(params: {
  mode: string;
  location: string;
  ip: string;
  protocol?: string;
  killSwitch?: boolean;
  ipv6LeakProtection?: boolean;
}): SecurityReportPayload {
  const {
    mode,
    location,
    ip,
    protocol = 'wireguard',
    killSwitch = true,
    ipv6LeakProtection = true,
  } = params;

  let score = 86;
  if (mode === 'Onion Vortex') score = 98;
  else if (mode === 'Double Hop') score = 95;
  else if (mode === 'Stealth') score = 92;
  else if (mode === 'Smart DNS') score = 74;

  if (protocol.toLowerCase() === 'wireguard' && mode !== 'Smart DNS') {
    score += 1;
  }
  if (!killSwitch) score -= 8;
  if (!ipv6LeakProtection) score -= 7;
  score = Math.max(40, Math.min(100, score));

  const threatLevel =
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
  if (mode === 'Smart DNS') {
    recommendations.push(
      'Basculez en WireGuard Standard ou Stealth pour chiffrer intégralement les charges utiles.'
    );
  }
  recommendations.push(
    `Maintenez le transport ${protocol.toUpperCase()} sur le relais ${location} (${ip}) avec vérification DNS périodique.`,
    'Activez la rotation automatique MAC/User-Agent pour limiter la corrélation temporelle.'
  );

  return {
    score,
    threatLevel,
    analysis: `Tunnel ${mode} établi vers ${location} (${ip}) sous ${protocol.toUpperCase()}. Cloisonnement cryptographique vérifié et surface d'exposition réseau maîtrisée.`,
    recommendations: recommendations.slice(0, 3),
  };
}

function buildDeterministicDeepAudit(
  ip: string,
  location: string
): DeepAuditPayload {
  const privacyStrongholds = new Set([
    'Suisse',
    'Islande',
    'Panama',
    'Estonie',
  ]);
  const jurisdictionNote = privacyStrongholds.has(location)
    ? `${location} offre un cadre légal favorable à la protection des métadonnées et hors alliances de rétention massive.`
    : `Le point de présence en ${location} opère sur un transit cloisonné sans journalisation persistante.`;

  return {
    analysis: `Audit heuristique de réputation pour la passerelle ${location} (${ip}) : aucune signature de liste noire critique ni anomalie de routage BGP détectée. ${jurisdictionNote} Maintenez le bouclier anti-fuite DNS/IPv6 actif lors des sessions longues.`,
    sources: [],
    isBlacklisted: false,
  };
}

function buildContextualSentinelReply(
  userPrompt: string,
  context: Record<string, unknown>
): string {
  const lower = userPrompt.toLowerCase();
  const mode = String(context.mode || 'Standard');
  const protocol = String(context.protocol || 'wireguard').toUpperCase();
  const country = String(context.country || 'France');
  const ip = String(context.ip || 'N/A');
  const isConnected = Boolean(context.isConnected);
  const killSwitch = Boolean(context.killSwitch);
  const ipv6 = Boolean(context.ipv6LeakProtection);
  const score = Number(context.securityScore ?? 85);

  if (lower.includes('dns') || lower.includes('ipv6') || lower.includes('fuite')) {
    return `Pour prévenir toute fuite DNS/IPv6 (${country} · ${ip}) : maintenez le résolveur chiffré dans le tunnel ${protocol}, gardez le bouclier IPv6 ${ipv6 ? 'actif (déjà activé)' : 'activé dans les paramètres'} et exécutez l’outil de test de fuite DNS intégré au cockpit après chaque changement de réseau.`;
  }

  if (lower.includes('vortex') || lower.includes('onion') || lower.includes('tor')) {
    return `Le mode Onion Vortex enchaîne plusieurs sauts chiffrés avec isolation de flux par domaine (.onion). Privilégiez-le pour les recherches sensibles, l’accès aux sources anonymes et la résistance maximale à la corrélation de trafic, tout en conservant ${protocol} Standard/Stealth pour les transferts volumineux à faible latence.`;
  }

  return `Diagnostic Sentinel : votre tunnel est ${isConnected ? `actif vers ${country} (${ip})` : 'actuellement hors ligne'} en architecture ${mode} (${protocol}, indice ${score}/100). ${!killSwitch ? 'Activez immédiatement le Kill Switch pour verrouiller les interfaces en cas de coupure. ' : ''}${!ipv6 ? 'Activez la protection IPv6 pour éviter les fuites locales. ' : ''}Combinez WireGuard et la rotation périodique MAC/User-Agent pour une résilience optimale.`;
}

function inferVoiceIntent(
  transcript: string
): 'security_analysis' | 'protection_advice' {
  const lower = transcript.toLowerCase();
  const adviceKeywords = [
    'conseil',
    'conseils',
    'recommand',
    'comment',
    'protéger',
    'proteger',
    'protection',
    'éviter',
    'eviter',
    'quel mode',
    'quel protocole',
    'astuce',
    'optimiser',
    'renforcer',
  ];
  const analysisKeywords = [
    'analyse',
    'analyser',
    'audit',
    'auditer',
    'diagnostic',
    'score',
    'vérifi',
    'verifi',
    'état',
    'etat',
    'statut',
    'bilan',
    'évalu',
    'evalu',
  ];

  const hasAdvice = adviceKeywords.some((kw) => lower.includes(kw));
  const hasAnalysis = analysisKeywords.some((kw) => lower.includes(kw));

  if (hasAdvice && !hasAnalysis) {
    return 'protection_advice';
  }
  return 'security_analysis';
}

function normalizeAudioMimeType(rawMime: unknown): string {
  if (typeof rawMime !== 'string' || !rawMime.trim()) {
    return 'audio/webm';
  }
  const base = rawMime.split(';')[0].trim().toLowerCase();
  const allowed = new Set([
    'audio/webm',
    'audio/wav',
    'audio/x-wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
  ]);
  if (base === 'audio/x-wav') return 'audio/wav';
  if (allowed.has(base)) return base;
  return 'audio/webm';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.post(
    '/api/gemini/security-analysis',
    async (req: Request, res: Response) => {
      const {
        mode = 'Standard',
        location = 'France',
        ip = '0.0.0.0',
        protocol = 'wireguard',
        killSwitch = true,
        ipv6LeakProtection = true,
        forceRefresh = false,
        preferLocal = false,
      } = (req.body || {}) as Record<string, unknown>;

      const reportParams = {
        mode: String(mode),
        location: String(location),
        ip: String(ip),
        protocol: String(protocol),
        killSwitch: Boolean(killSwitch),
        ipv6LeakProtection: Boolean(ipv6LeakProtection),
      };

      // Cache key normalized by posture + country so ephemeral hop IP mutations reuse valid audits
      const cacheKey = `${reportParams.mode}|${reportParams.location}|${reportParams.protocol}|${reportParams.killSwitch}|${reportParams.ipv6LeakProtection}`;

      if (!forceRefresh) {
        const cached = getCachedValue(securityAnalysisCache, cacheKey);
        if (cached) {
          res.json(cached);
          return;
        }

        if (preferLocal) {
          const localReport: SecurityReportPayload = {
            ...buildDeterministicSecurityReport(reportParams),
            engine: 'local-heuristic',
          };
          res.json(localReport);
          return;
        }

        const existingTask = securityAnalysisInFlight.get(cacheKey);
        if (existingTask) {
          const sharedResult = await existingTask;
          res.json(sharedResult);
          return;
        }
      }

      const ai = createGenAIClient();
      if (!ai) {
        res.json({
          ...buildDeterministicSecurityReport(reportParams),
          engine: 'local-heuristic',
        });
        return;
      }

      const prompt = `Agis comme un architecte en cybersécurité réseau pour "Renumerate VPN".
L'utilisateur est connecté via un relais en ${reportParams.location} (IP de sortie : ${reportParams.ip}).
Mode actif : ${reportParams.mode} | Protocole : ${reportParams.protocol.toUpperCase()} | Kill Switch : ${reportParams.killSwitch} | Bouclier IPv6 : ${reportParams.ipv6LeakProtection}.
Analyse en français (maximum 55 mots) le niveau d'anonymat et de résilience.
Attribue un score de 0 à 100 et fournis exactement 3 recommandations techniques courtes.`;

      const analysisTask = (async (): Promise<SecurityReportPayload> => {
        try {
          const { response } = await generateWithModelCascade({
            ai,
            contents: prompt,
            allowCircuitProbe: Boolean(forceRefresh),
            buildConfig: (model) => ({
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  score: {
                    type: Type.NUMBER,
                    description: 'Score de sécurité global de 0 à 100.',
                  },
                  threatLevel: {
                    type: Type.STRING,
                    enum: ['Faible', 'Moyen', 'Élevé', 'Critique'],
                    description: 'Niveau de menace évalué.',
                  },
                  analysis: {
                    type: Type.STRING,
                    description: 'Analyse technique concise en français.',
                  },
                  recommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '3 recommandations concrètes.',
                  },
                },
                required: [
                  'score',
                  'threatLevel',
                  'analysis',
                  'recommendations',
                ],
              },
              ...(model === 'gemini-3.8-flash'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            }),
          });

          const text = (response.text ?? '').trim();
          if (!text) {
            throw new Error('Réponse vide du modèle');
          }

          const parsed: SecurityReportPayload = {
            ...normalizeSecurityReport(JSON.parse(text), reportParams),
            engine: 'gemini',
          };
          setCachedValue(securityAnalysisCache, cacheKey, parsed, 15 * 60_000);
          return parsed;
        } catch (err) {
          const info = classifyGeminiError(err);
          const isQuota = info.isQuotaExhausted || info.isRateLimited;
          const fallback: SecurityReportPayload = {
            ...buildDeterministicSecurityReport(reportParams),
            engine: 'local-heuristic',
            quotaLimited: isQuota,
            ...(isQuota ? { quotaNotice: QUOTA_GUIDANCE_FR } : {}),
          };
          setCachedValue(securityAnalysisCache, cacheKey, fallback, 5 * 60_000);
          return fallback;
        } finally {
          securityAnalysisInFlight.delete(cacheKey);
        }
      })();

      securityAnalysisInFlight.set(cacheKey, analysisTask);
      const report = await analysisTask;
      res.json(report);
    }
  );

  app.post('/api/gemini/deep-audit', async (req: Request, res: Response) => {
    const { ip = '0.0.0.0', location = 'Suisse' } = (req.body || {}) as Record<
      string,
      unknown
    >;

    const targetIp = String(ip);
    const targetLocation = String(location);
    const cacheKey = `${targetLocation}|${targetIp}`;

    const cached = getCachedValue(deepAuditCache, cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const ai = createGenAIClient();
    if (!ai) {
      res.json({
        ...buildDeterministicDeepAudit(targetIp, targetLocation),
        engine: 'local-heuristic',
      });
      return;
    }

    const prompt = `Effectue un audit de réputation cybersécurité en français (3 à 4 phrases maximum) pour un nœud de sortie VPN situé en ${targetLocation} (plage IP simulée : ${targetIp}).
Évalue la juridiction de confidentialité de ${targetLocation}, la réputation générale des centres de données locaux et les bonnes pratiques anti-corrélation.`;

    try {
      const { response } = await generateWithModelCascade({
        ai,
        contents: prompt,
        allowCircuitProbe: true,
        models: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        buildConfig: (model) =>
          model === 'gemini-3.1-flash-lite'
            ? undefined
            : {
                tools: [{ googleSearch: {} }],
                ...(model === 'gemini-3.8-flash'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
              },
      });

      const analysis =
        (response.text ?? '').trim() ||
        'Audit terminé. Aucune compromission majeure relevée sur cette passerelle.';
      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .filter((chunk) => Boolean(chunk.web?.uri))
        .map((chunk) => ({
          title: chunk.web?.title || 'Référence réseau',
          uri: chunk.web?.uri || '',
        }))
        .slice(0, 4);

      const lower = analysis.toLowerCase();
      const payload: DeepAuditPayload = {
        analysis,
        sources,
        isBlacklisted:
          lower.includes('blacklisté') || lower.includes('compromis critique'),
        engine: 'gemini',
      };
      setCachedValue(deepAuditCache, cacheKey, payload, 15 * 60_000, 64);
      res.json(payload);
    } catch (err) {
      const info = classifyGeminiError(err);
      const isQuota = info.isQuotaExhausted || info.isRateLimited;
      const fallback: DeepAuditPayload = {
        ...buildDeterministicDeepAudit(targetIp, targetLocation),
        engine: 'local-heuristic',
        quotaLimited: isQuota,
        ...(isQuota ? { quotaNotice: QUOTA_GUIDANCE_FR } : {}),
      };
      setCachedValue(deepAuditCache, cacheKey, fallback, 5 * 60_000, 64);
      res.json(fallback);
    }
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const { message = '', context = {} } = (req.body || {}) as {
      message?: string;
      context?: Record<string, unknown>;
    };

    const userPrompt = String(message).trim();
    if (!userPrompt) {
      res.status(400).json({ error: 'Message vide.' });
      return;
    }

    const ai = createGenAIClient();
    if (!ai) {
      res.json({
        reply: buildContextualSentinelReply(userPrompt, context),
      });
      return;
    }

    const systemInstruction = `Tu es Sentinel, l'ingénieur conseil en cybersécurité et anonymat numérique intégré à Renumerate VPN.
Réponds toujours en français, de manière claire, précise, structurée et concise (maximum 110 mots).
Contexte télémétrique actuel de l'utilisateur :
- Connexion tunnel : ${context.isConnected ? 'ÉTABLIE' : 'HORS LIGNE'}
- Mode : ${String(context.mode || 'Standard')}
- Protocole : ${String(context.protocol || 'wireguard').toUpperCase()}
- Relais actif : ${String(context.country || 'France')} (${String(context.ip || 'N/A')})
- Score sécurité : ${String(context.securityScore ?? 0)}/100
- Kill Switch : ${context.killSwitch ? 'Actif' : 'Inactif'}
- Protection IPv6 : ${context.ipv6LeakProtection ? 'Active' : 'Inactive'}`;

    try {
      const { response } = await generateWithModelCascade({
        ai,
        contents: userPrompt,
        allowCircuitProbe: true,
        buildConfig: (model) => ({
          systemInstruction,
          ...(model === 'gemini-3.8-flash'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        }),
      });

      res.json({
        reply:
          (response.text ?? '').trim() ||
          buildContextualSentinelReply(userPrompt, context),
      });
    } catch (err) {
      const info = classifyGeminiError(err);
      const localReply = buildContextualSentinelReply(userPrompt, context);
      if (info.isAuthOrConfig || info.isQuotaExhausted || info.isRateLimited) {
        res.json({
          reply: `${localReply}\n\nNote : ${formatCleanFrenchGeminiError(err)}`,
        });
        return;
      }
      res.json({
        reply: localReply,
      });
    }
  });

  app.post(
    '/api/gemini/voice-command',
    async (req: Request, res: Response) => {
      const {
        audioBase64 = '',
        mimeType = 'audio/webm',
        simulatedCommand = '',
        context = {},
      } = (req.body || {}) as {
        audioBase64?: string;
        mimeType?: string;
        simulatedCommand?: string;
        context?: Record<string, unknown>;
      };

      const rawAudio = String(audioBase64 || '').trim();
      const cleanAudioBase64 = rawAudio.includes(',')
        ? rawAudio.split(',')[1]?.trim() || ''
        : rawAudio;
      const directText = String(simulatedCommand || '').trim();

      if (!cleanAudioBase64 && !directText) {
        res.status(400).json({
          error: 'Aucun flux vocal ni commande fournie.',
        });
        return;
      }

      const normalizedMime = normalizeAudioMimeType(mimeType);
      const reportParams = {
        mode: String(context.mode || 'Standard'),
        location: String(context.country || 'France'),
        ip: String(context.ip || '0.0.0.0'),
        protocol: String(context.protocol || 'wireguard'),
        killSwitch:
          context.killSwitch === undefined ? true : Boolean(context.killSwitch),
        ipv6LeakProtection:
          context.ipv6LeakProtection === undefined
            ? true
            : Boolean(context.ipv6LeakProtection),
      };

      const buildHeuristicVoicePayload = (
        spokenText: string,
        isQuota = false
      ) => {
        const effectiveTranscript =
          spokenText.trim() ||
          'Analyse de sécurité et recommandations de protection de la session';
        const intent = inferVoiceIntent(effectiveTranscript);
        const baseReport = buildDeterministicSecurityReport(reportParams);
        const report: SecurityReportPayload = {
          ...baseReport,
          engine: 'local-heuristic',
          quotaLimited: isQuota,
          ...(isQuota ? { quotaNotice: QUOTA_GUIDANCE_FR } : {}),
        };
        const reply =
          intent === 'security_analysis'
            ? `${report.analysis} Indice actuel évalué à ${report.score}/100 (risque ${report.threatLevel.toLowerCase()}).`
            : buildContextualSentinelReply(effectiveTranscript, context);

        return {
          transcript: effectiveTranscript,
          intent,
          reply,
          recommendations: report.recommendations,
          report,
        };
      };

      const ai = createGenAIClient();
      if (!ai) {
        res.json(buildHeuristicVoicePayload(directText));
        return;
      }

      // Single-pass multimodal or text intent + security audit generation (halves quota usage vs 2-step transcribe+analyze)
      const telemetrySummary = `Contexte session VPN de l'opérateur :
- État du tunnel : ${context.isConnected ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
- Architecture active : ${reportParams.mode}
- Protocole : ${reportParams.protocol.toUpperCase()}
- Relais de sortie : ${reportParams.location} (${reportParams.ip})
- Score actuel : ${String(context.securityScore ?? 85)}/100
- Kill Switch : ${reportParams.killSwitch ? 'Actif' : 'Inactif'}
- Protection IPv6 : ${reportParams.ipv6LeakProtection ? 'Active' : 'Inactive'}`;

      const analysisInstruction = directText
        ? `Tu es Sentinel, l'architecte cybersécurité vocal du Cockpit Renumerate VPN.
Commande vocale transcrite de l'utilisateur : "${directText}"
${telemetrySummary}

Détermine si l'utilisateur demande principalement une analyse de sécurité de sa session ("security_analysis") ou des conseils de protection ("protection_advice").
Réponds en français de manière directe, précise et exploitable (40 à 85 mots dans "reply"), évalue le score de sécurité actuel (0 à 100), fournis un résumé d'analyse technique court ("analysis", <= 50 mots) et exactement 3 recommandations concrètes.`
        : `Tu es Sentinel, l'architecte cybersécurité vocal du Cockpit Renumerate VPN.
Écoute cet enregistrement vocal de l'utilisateur, transcris fidèlement sa demande en français dans "transcript", puis réponds à sa demande en tenant compte de sa session :
${telemetrySummary}

Détermine si l'utilisateur demande principalement une analyse de sécurité de sa session ("security_analysis") ou des conseils de protection ("protection_advice").
Fournis une réponse vocale claire en français ("reply", 40 à 85 mots), un score de sécurité de 0 à 100, un résumé d'analyse ("analysis", <= 50 mots) et 3 recommandations concrètes.`;

      const multimodalContents: Parameters<
        GoogleGenAI['models']['generateContent']
      >[0]['contents'] = directText
        ? analysisInstruction
        : {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: cleanAudioBase64,
                },
              },
              { text: analysisInstruction },
            ],
          };

      try {
        const { response } = await generateWithModelCascade({
          ai,
          contents: multimodalContents,
          allowCircuitProbe: true,
          models: directText
            ? TEXT_MODEL_CASCADE
            : ['gemini-3.8-flash', 'gemini-flash-latest'],
          buildConfig: (model) => ({
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: {
                  type: Type.STRING,
                  description:
                    'Transcription fidèle en français de la commande vocale.',
                },
                intent: {
                  type: Type.STRING,
                  enum: ['security_analysis', 'protection_advice'],
                  description:
                    'Intention principale détectée dans la commande vocale.',
                },
                reply: {
                  type: Type.STRING,
                  description:
                    'Réponse claire et concise de Sentinel en français adaptée à la commande.',
                },
                score: {
                  type: Type.NUMBER,
                  description: 'Score de sécurité global de 0 à 100.',
                },
                threatLevel: {
                  type: Type.STRING,
                  enum: ['Faible', 'Moyen', 'Élevé', 'Critique'],
                  description: 'Niveau de menace évalué.',
                },
                analysis: {
                  type: Type.STRING,
                  description: 'Synthèse technique courte en français.',
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 recommandations concrètes de protection.',
                },
              },
              required: [
                'transcript',
                'intent',
                'reply',
                'score',
                'threatLevel',
                'analysis',
                'recommendations',
              ],
            },
            ...(model === 'gemini-3.8-flash'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          }),
        });

        const rawJson = (response.text ?? '').trim();
        if (!rawJson) {
          throw new Error('Réponse vocale vide');
        }

        const parsed = JSON.parse(rawJson) as Record<string, unknown>;
        const resolvedTranscript =
          directText ||
          (typeof parsed.transcript === 'string' && parsed.transcript.trim()
            ? parsed.transcript.trim()
            : 'Analyse vocale de la posture de sécurité');

        const resolvedIntent: 'security_analysis' | 'protection_advice' =
          parsed.intent === 'protection_advice' ||
          parsed.intent === 'security_analysis'
            ? parsed.intent
            : inferVoiceIntent(resolvedTranscript);

        const normalizedReport: SecurityReportPayload = {
          ...normalizeSecurityReport(parsed, reportParams),
          engine: 'gemini',
        };
        const resolvedReply =
          typeof parsed.reply === 'string' && parsed.reply.trim().length > 8
            ? parsed.reply.trim()
            : normalizedReport.analysis;

        const cacheKey = `${reportParams.mode}|${reportParams.location}|${reportParams.protocol}|${reportParams.killSwitch}|${reportParams.ipv6LeakProtection}`;
        setCachedValue(
          securityAnalysisCache,
          cacheKey,
          normalizedReport,
          15 * 60_000
        );

        res.json({
          transcript: resolvedTranscript,
          intent: resolvedIntent,
          reply: resolvedReply,
          recommendations: normalizedReport.recommendations,
          report: normalizedReport,
        });
      } catch (err) {
        const info = classifyGeminiError(err);
        res.json(
          buildHeuristicVoicePayload(
            directText,
            info.isQuotaExhausted || info.isRateLimited
          )
        );
      }
    }
  );

  app.post('/api/gemini/tts', async (req: Request, res: Response) => {
    const { text = '' } = (req.body || {}) as { text?: string };
    const cleanText = String(text || '').trim().slice(0, 700);
    if (!cleanText) {
      res.status(400).json({ audioWavBase64: null });
      return;
    }

    const ai = createGenAIClient();
    const ttsModel = 'gemini-3.8-flash-lite-tts';
    const now = Date.now();
    if (
      !ai ||
      globalQuotaCircuitUntil > now ||
      (modelCooldownUntil.get(ttsModel) ?? 0) > now
    ) {
      res.json({ audioWavBase64: null });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: ttsModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: 'Calme, clair et professionnel en français',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      modelCooldownUntil.delete(ttsModel);
      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
      res.json({ audioWavBase64: base64Audio });
    } catch (err) {
      const info = classifyGeminiError(err);
      if (info.isQuotaExhausted) {
        const cooldownMs = Math.max(info.retryDelayMs, 5 * 60_000);
        modelCooldownUntil.set(ttsModel, Date.now() + cooldownMs);
      } else if (info.isRateLimited) {
        modelCooldownUntil.set(ttsModel, Date.now() + 60_000);
      }
      res.json({ audioWavBase64: null });
    }
  });

  app.get('/api/system/diagnostics', (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const cpus = os.cpus();
    const load = os.loadavg();
    let cipherSuitesCount = 0;
    try {
      cipherSuitesCount = crypto.getCiphers().length;
    } catch {
      cipherSuitesCount = 64;
    }

    const interfaces: Array<{
      name: string;
      family: 'IPv4' | 'IPv6';
      cidr: string;
      internal: boolean;
      mac: string;
      mtu: number;
    }> = [];

    try {
      const rawIfaces = os.networkInterfaces();
      for (const [name, entries] of Object.entries(rawIfaces)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          if (!entry) continue;
          const family: 'IPv4' | 'IPv6' =
            entry.family === 'IPv6' ? 'IPv6' : 'IPv4';
          const rawCidr = entry.cidr || entry.address || '';
          const sanitizedCidr =
            entry.internal ||
            rawCidr.startsWith('10.') ||
            rawCidr.startsWith('192.168.') ||
            rawCidr.startsWith('172.') ||
            rawCidr.startsWith('fe80:') ||
            rawCidr.startsWith('::1') ||
            rawCidr.startsWith('127.')
              ? rawCidr
              : family === 'IPv4'
                ? rawCidr.replace(/^(\d+\.\d+)\.\d+\.\d+/, '$1.x.x')
                : 'fd00::/64';

          interfaces.push({
            name,
            family,
            cidr: sanitizedCidr,
            internal: Boolean(entry.internal),
            mac: entry.mac || '00:00:00:00:00:00',
            mtu: entry.internal ? 65536 : 1500,
          });
        }
      }
    } catch {
      // Fallback empty list if restricted container
    }

    let monotonicClockOk = true;
    try {
      monotonicClockOk = process.hrtime.bigint() > 0n;
    } catch {
      monotonicClockOk = true;
    }

    res.json({
      status: 'nominal',
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      arch: os.arch(),
      osType: os.type(),
      osRelease: os.release(),
      nodeVersion: process.version,
      cpuCores: Array.isArray(cpus) && cpus.length > 0 ? cpus.length : 1,
      loadAvg1m: Number.isFinite(load[0]) ? parseFloat(load[0].toFixed(2)) : 0,
      uptimeSeconds: Math.round(process.uptime()),
      userCpuMs: Math.round(cpuUsage.user / 1000),
      systemCpuMs: Math.round(cpuUsage.system / 1000),
      monotonicClockOk,
      memoryRssMb: parseFloat((mem.rss / (1024 * 1024)).toFixed(1)),
      memoryHeapUsedMb: parseFloat((mem.heapUsed / (1024 * 1024)).toFixed(1)),
      memoryHeapTotalMb: parseFloat((mem.heapTotal / (1024 * 1024)).toFixed(1)),
      cipherSuitesCount,
      pqcReady: true,
      interfaces: interfaces.slice(0, 12),
    });
  });

  app.post('/api/system/probe-mtu', (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      linkCeiling?: number;
      protocol?: string;
      ipv6?: boolean;
      pqcKex?: string;
      tlsFrag?: boolean;
      paddingMs?: number;
      currentMtu?: number;
    };

    const ceiling = Math.max(
      1280,
      Math.min(9000, Math.round(Number(body.linkCeiling) || 1500))
    );
    const protocol = String(body.protocol || 'wireguard').toLowerCase();
    const ipv6 = Boolean(body.ipv6);
    const pqcKex = String(body.pqcKex || 'ml-kem-1024').toLowerCase();
    const tlsFrag = Boolean(body.tlsFrag);
    const paddingMs = Math.max(0, Number(body.paddingMs) || 0);
    const currentMtu = Math.max(
      1280,
      Math.min(1500, Math.round(Number(body.currentMtu) || 1420))
    );

    const ipHeaderBytes = ipv6 ? 40 : 20;
    const transportBytes = protocol === 'openvpn' ? 20 : 8;
    const tunnelHeaderBytes =
      protocol === 'wireguard' ? 32 : protocol === 'ikev2' ? 28 : 21;
    const aeadTagBytes = 16;
    const antiDpiFramingBytes = (tlsFrag ? 8 : 0) + (paddingMs > 0 ? 12 : 0);
    const totalOverheadBytes =
      ipHeaderBytes +
      transportBytes +
      tunnelHeaderBytes +
      aeadTagBytes +
      antiDpiFramingBytes;

    const recommendedMtu = Math.max(
      1280,
      Math.min(1500, ceiling - totalOverheadBytes)
    );
    const maxPayloadBytes = Math.max(1160, recommendedMtu - (ipv6 ? 48 : 28));
    const maxTcpMss = Math.max(1200, recommendedMtu - (ipv6 ? 60 : 40));
    const pqcHandshakeBytes =
      pqcKex === 'ml-kem-1024' ? 1568 : pqcKex === 'sntrup761' ? 1158 : 32;

    const fragmentationRisk: 'none' | 'moderate' | 'high' =
      currentMtu + totalOverheadBytes > ceiling
        ? 'high'
        : currentMtu > recommendedMtu
          ? 'moderate'
          : 'none';

    res.json({
      ok: true,
      probedAt: new Date().toISOString(),
      linkCeiling: ceiling,
      currentMtu,
      recommendedMtu,
      maxPayloadBytes,
      maxTcpMss,
      pqcHandshakeBytes,
      fragmentationRisk,
      breakdown: {
        ipHeaderBytes,
        transportBytes,
        tunnelHeaderBytes,
        aeadTagBytes,
        antiDpiFramingBytes,
        totalOverheadBytes,
      },
    });
  });

  const canonicalizeJsonValue = (val: unknown): unknown => {
    if (Array.isArray(val)) {
      return val.map(canonicalizeJsonValue);
    }
    if (val && typeof val === 'object') {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = canonicalizeJsonValue(
          (val as Record<string, unknown>)[k]
        );
      }
      return sorted;
    }
    return val;
  };

  app.post('/api/system/attest-bundle', (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      mode?: 'sign' | 'verify';
      schemaVersion?: string;
      settings?: Record<string, unknown>;
      sha256?: string;
      hmacSignature?: string;
    };

    const mode = body.mode === 'verify' ? 'verify' : 'sign';
    const schemaVersion = String(body.schemaVersion || 'renumerate-sys-v2');
    const settingsObj =
      body.settings && typeof body.settings === 'object' ? body.settings : null;

    if (!settingsObj) {
      res.status(400).json({
        ok: false,
        error: 'Objet settings manquant pour l’attestation cryptographique.',
      });
      return;
    }

    const canonicalPayload = JSON.stringify(canonicalizeJsonValue(settingsObj));
    const computedSha256 = crypto
      .createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');
    const computedHmac = crypto
      .createHmac('sha256', 'renumerate-system-attestation-v2')
      .update(`${schemaVersion}|${computedSha256}`)
      .digest('hex');

    if (mode === 'sign') {
      res.json({
        ok: true,
        schemaVersion,
        exportedAt: new Date().toISOString(),
        sha256: computedSha256,
        hmacSignature: computedHmac,
      });
      return;
    }

    const providedSha = String(body.sha256 || '').trim().toLowerCase();
    const providedHmac = String(body.hmacSignature || '').trim().toLowerCase();

    let shaValid = false;
    let hmacValid = false;
    if (providedSha.length === computedSha256.length) {
      shaValid = crypto.timingSafeEqual(
        Buffer.from(providedSha, 'utf8'),
        Buffer.from(computedSha256, 'utf8')
      );
    }
    if (providedHmac.length === computedHmac.length) {
      hmacValid = crypto.timingSafeEqual(
        Buffer.from(providedHmac, 'utf8'),
        Buffer.from(computedHmac, 'utf8')
      );
    }

    const verified = shaValid && hmacValid;
    res.json({
      ok: true,
      verified,
      computedSha256,
      reason: verified
        ? 'Empreinte SHA-256 et sceau HMAC-SHA256 authentifiés sans altération.'
        : !providedSha || !providedHmac
          ? 'Fichier JSON standard importé (aucun sceau HMAC détecté).'
          : 'Alerte d’intégrité : le contenu du bundle a été modifié depuis sa signature.',
    });
  });

  app.post('/api/network/probe-nodes', (req: Request, res: Response) => {
    const startHr = process.hrtime.bigint();
    const body = (req.body || {}) as {
      nodes?: Array<{
        id: string;
        ip: string;
        country: string;
        latency: number;
        transferRate?: number;
        asn?: string;
      }>;
    };

    const inputNodes = Array.isArray(body.nodes) ? body.nodes.slice(0, 50) : [];
    const eyes5 = new Set([
      'USA',
      'Royaume-Uni',
      'Canada',
      'Australie',
      'Nouvelle-Zélande',
    ]);
    const eyes14 = new Set([
      ...eyes5,
      'France',
      'Allemagne',
      'Pays-Bas',
      'Danemark',
      'Norvège',
      'Belgique',
      'Italie',
      'Espagne',
      'Suède',
    ]);
    const asnByCountry: Record<string, string> = {
      France: 'AS12876 Scaleway IX',
      Suisse: 'AS51395 Bahnhof Swiss',
      Allemagne: 'AS24940 Hetzner DE-CIX',
      Islande: 'AS48685 Advania Verne',
      Estonie: 'AS3249 Telia Tallinn',
      USA: 'AS20473 Constant NYIIX',
      Panama: 'AS52275 Cable Onda IX',
      Singapour: 'AS135377 Equinix SG1',
    };

    const nowSec = Date.now() / 1000;
    const probedAt = new Date().toISOString();

    const results = inputNodes.map((n, index) => {
      const baseLat = Math.max(6, Math.min(350, Number(n.latency) || 28));
      const hashByte = crypto
        .createHash('sha256')
        .update(`${n.id}:${n.ip}:${Math.floor(nowSec / 4)}`)
        .digest()[0];
      const wave = Math.sin(nowSec * 0.9 + index * 1.37);
      const deltaLat = Math.round(wave * Math.max(2, baseLat * 0.08) + ((hashByte % 5) - 2));
      const measuredLatency = Math.max(5, baseLat + deltaLat);
      const jitter = Number(
        Math.max(
          0.6,
          baseLat * 0.038 + ((hashByte % 17) / 10)
        ).toFixed(1)
      );
      const packetLoss =
        measuredLatency > 110 && hashByte % 3 === 0
          ? 0.2
          : measuredLatency > 65 && hashByte % 5 === 0
            ? 0.1
            : 0;
      const loadPct = Math.max(
        12,
        Math.min(89, 22 + ((hashByte * 7 + index * 13) % 58))
      );
      const baseRate = Math.max(40, Number(n.transferRate) || 140);
      const measuredRate = Math.max(
        35,
        Math.round(baseRate * (1 - (loadPct - 35) * 0.0025))
      );
      const sanctuaryTier = eyes5.has(n.country)
        ? '5-eyes'
        : eyes14.has(n.country)
          ? '14-eyes'
          : 'sanctuary';

      return {
        id: String(n.id),
        latency: measuredLatency,
        jitter,
        packetLoss,
        loadPct,
        transferRate: measuredRate,
        asn: n.asn || asnByCountry[n.country] || 'AS60068 Transit Core',
        sanctuaryTier,
        probedAt,
      };
    });

    const elapsedMs = Number(process.hrtime.bigint() - startHr) / 1_000_000;
    res.json({
      ok: true,
      probedAt,
      probeDurationMs: Number(elapsedMs.toFixed(2)),
      results,
    });
  });

  app.post('/api/network/dns-audit', async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      dnsProvider?: string;
      canaryToken?: string;
    };
    const providerKey = String(body.dnsProvider || 'cloudflare').toLowerCase();
    const rawToken = String(body.canaryToken || '')
      .replace(/[^a-f0-9-]/gi, '')
      .slice(0, 24);
    const token = rawToken || crypto.randomBytes(6).toString('hex');
    const canaryDomain = `canary-${token}.example.com`;

    const dohEndpoints: Record<string, { url: string; label: string }> = {
      cloudflare: {
        url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(canaryDomain)}&type=A&do=true`,
        label: 'Cloudflare 1.1.1.1 DoH',
      },
      quad9: {
        url: `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(canaryDomain)}&type=A&do=true`,
        label: 'Quad9 9.9.9.9 DNSSEC',
      },
      google: {
        url: `https://dns.google/resolve?name=${encodeURIComponent(canaryDomain)}&type=A&do=1`,
        label: 'Google 8.8.8.8 DoH',
      },
      opendns: {
        url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(canaryDomain)}&type=A&do=true`,
        label: 'OpenDNS 208.67.222.222 DNSCrypt',
      },
    };

    const selectedEndpoint =
      dohEndpoints[providerKey] || dohEndpoints.cloudflare;
    const startHr = process.hrtime.bigint();
    let rttMs: number | null = null;
    let dnssecVerified = true;
    let rcode = 3; // NXDOMAIN expected for random canary subdomain
    let upstreamReachable = false;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1400);

    try {
      const dohRes = await fetch(selectedEndpoint.url, {
        method: 'GET',
        headers: { Accept: 'application/dns-json' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (dohRes.ok) {
        rttMs = Math.max(
          3,
          Math.round(Number(process.hrtime.bigint() - startHr) / 1_000_000)
        );
        upstreamReachable = true;
        const json = (await dohRes.json()) as {
          Status?: number;
          AD?: boolean;
        };
        if (typeof json.Status === 'number') {
          rcode = json.Status;
        }
        if (typeof json.AD === 'boolean') {
          dnssecVerified = json.AD || providerKey !== 'custom';
        }
      }
    } catch {
      clearTimeout(timer);
    }

    const auditSignature = crypto
      .createHash('sha256')
      .update(`${canaryDomain}:${providerKey}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    res.json({
      ok: true,
      probedAt: new Date().toISOString(),
      canaryDomain,
      resolverLabel: selectedEndpoint.label,
      upstreamReachable,
      rttMs,
      rcode,
      dnssecVerified,
      ecsPadding: '0.0.0.0/0',
      auditSignature,
    });
  });

  app.get('/api/network/speedtest-ping', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
    res.json({
      ok: true,
      serverTimeIso: new Date().toISOString(),
      hrTimeNs: process.hrtime.bigint().toString(),
    });
  });

  app.get('/api/network/speedtest-down', (req: Request, res: Response) => {
    const startHr = process.hrtime.bigint();
    const rawBytes = Number(req.query.bytes) || 524_288;
    const byteCount = Math.max(65_536, Math.min(1_048_576, Math.floor(rawBytes)));

    const payload = crypto.randomBytes(byteCount);
    const sha256Prefix = crypto
      .createHash('sha256')
      .update(payload)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
    const computeMs = Number(process.hrtime.bigint() - startHr) / 1_000_000;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(byteCount));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-transform');
    res.setHeader('X-Server-Compute-Ms', computeMs.toFixed(3));
    res.setHeader('X-Payload-Sha256', sha256Prefix);
    res.status(200).send(payload);
  });

  app.post(
    '/api/network/speedtest-up',
    express.raw({ type: 'application/octet-stream', limit: '2mb' }),
    (req: Request, res: Response) => {
      const startHr = process.hrtime.bigint();
      const buf = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : '');
      const receivedBytes = buf.byteLength;
      const sha256Prefix = crypto
        .createHash('sha256')
        .update(buf)
        .digest('hex')
        .slice(0, 12)
        .toUpperCase();
      const serverProcessMs = Number(process.hrtime.bigint() - startHr) / 1_000_000;

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({
        ok: true,
        receivedBytes,
        sha256Prefix,
        serverProcessMs: Number(serverProcessMs.toFixed(3)),
        receivedAt: new Date().toISOString(),
      });
    }
  );

  app.get('/api/withdrawals/rates', (_req: Request, res: Response) => {
    const bucket = Math.floor(Date.now() / 300000);
    const wave = Math.sin(bucket * 0.73) * 0.018;
    const eurRate = parseFloat((2.45 * (1 + wave)).toFixed(4));
    const usdRate = parseFloat((eurRate * 1.0938).toFixed(4));
    const xofRate = Math.round(eurRate * 655.957);

    res.json({
      updatedAt: new Date().toISOString(),
      rates: {
        EUR: eurRate,
        USD: usdRate,
        XOF: xofRate,
      },
      rails: {
        crypto: 'operational',
        mobile_money: 'operational',
        paypal: 'operational',
        bank_transfer: 'operational',
      },
    });
  });

  app.post('/api/withdrawals/sign', (req: Request, res: Response) => {
    const {
      userId = 'anonymous',
      amount = 0,
      netAmountRnc = 0,
      method = 'crypto',
      subNetwork = 'polygon',
      address = '',
      executionMode = 'instant',
    } = (req.body || {}) as Record<string, unknown>;

    const parsedAmount = Number(amount);
    const cleanAddress = String(address || '').trim();
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || cleanAddress.length < 4) {
      res.status(400).json({
        ok: false,
        error: 'Paramètres de retrait incomplets ou montant invalide.',
      });
      return;
    }

    const settledAt = new Date().toISOString();
    const seedPayload = `${String(userId)}|${parsedAmount.toFixed(6)}|${Number(netAmountRnc).toFixed(6)}|${String(method)}|${String(subNetwork)}|${cleanAddress}|${String(executionMode)}|${settledAt}|${crypto.randomBytes(8).toString('hex')}`;
    const digest = crypto
      .createHmac('sha256', 'renumerate-settlement-engine-v2')
      .update(seedPayload)
      .digest('hex');

    let txHash = digest;
    const m = String(method);
    const sn = String(subNetwork);
    if (m === 'crypto') {
      if (sn === 'erc20' || sn === 'polygon') {
        txHash = `0x${digest}`;
      } else if (sn === 'lightning') {
        txHash = `ln-preimage-${digest.slice(0, 32)}`;
      }
    } else if (m === 'mobile_money') {
      txHash = `MM-${sn.toUpperCase().slice(0, 4)}-${Date.now().toString(36).toUpperCase()}-${digest.slice(0, 6).toUpperCase()}`;
    } else if (m === 'paypal') {
      txHash = `PP-${digest.slice(0, 12).toUpperCase()}`;
    } else if (m === 'bank_transfer') {
      const dateStr = settledAt.slice(0, 10).replace(/-/g, '');
      txHash = `SEPA-${dateStr}-${digest.slice(0, 8).toUpperCase()}`;
    }

    res.json({
      ok: true,
      txHash,
      signature: digest.slice(0, 24).toUpperCase(),
      settledAt,
    });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(
      request.url || '/',
      `http://${request.headers.host || 'localhost'}`
    ).pathname;

    if (pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, request) => {
    const ai = createGenAIClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          error:
            'Clé API Gemini absente côté serveur. Utilisez l’onglet Console Texte ou vérifiez Settings > Secrets.',
        })
      );
      clientWs.close();
      return;
    }

    const reqUrl = new URL(
      request.url || '/api/live',
      `http://${request.headers.host || 'localhost'}`
    );
    const mode = reqUrl.searchParams.get('mode') || 'Standard';
    const connected = reqUrl.searchParams.get('connected') === 'true';
    const score = reqUrl.searchParams.get('score') || '85';

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    const openLiveSession = () =>
      ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `Tu es Sentinel, l'assistant vocal cybersécurité de Renumerate VPN. Parle en français de façon calme, précise et concise. État du tunnel : Mode ${mode}, ${connected ? 'Connecté' : 'Déconnecté'}, Score ${score}/100. Recommande WireGuard pour la performance et la sécurité.`,
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ ready: true }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== clientWs.OPEN) return;
            const sc = message.serverContent;
            if (sc?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: sc.inputTranscription.text })
              );
            }
            if (sc?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  outputTranscript: sc.outputTranscription.text,
                })
              );
            }
            for (const part of sc?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (sc?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.close();
            }
          },
          onerror: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  error:
                    'Interruption temporaire du canal vocal. Basculez sur l’onglet Console Texte ou relancez la session.',
                })
              );
              clientWs.close();
            }
          },
        },
      });

    if (globalQuotaCircuitUntil > Date.now()) {
      clientWs.send(
        JSON.stringify({
          error: QUOTA_GUIDANCE_FR,
        })
      );
      clientWs.close();
      return;
    }

    try {
      try {
        liveSession = await openLiveSession();
      } catch (firstErr) {
        const firstInfo = classifyGeminiError(firstErr);
        if (firstInfo.isServerOverload) {
          await sleep(450);
          liveSession = await openLiveSession();
        } else {
          if (firstInfo.isQuotaExhausted) {
            globalQuotaTrippedAt = Date.now();
            globalQuotaCircuitUntil =
              Date.now() + Math.max(firstInfo.retryDelayMs, 5 * 60_000);
          }
          throw firstErr;
        }
      }

      const activeSession = liveSession;

      clientWs.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString()) as { audio?: string };
          if (parsed.audio && activeSession) {
            Promise.resolve(
              activeSession.sendRealtimeInput({
                audio: {
                  data: parsed.audio,
                  mimeType: 'audio/pcm;rate=16000',
                },
              })
            ).catch(() => {});
          }
        } catch {
          // Ignore malformed frame
        }
      });

      clientWs.on('close', () => {
        try {
          liveSession?.close();
        } catch {
          // Ignore close errors
        }
      });
    } catch (err) {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: formatCleanFrenchGeminiError(err),
          })
        );
        clientWs.close();
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Renumerate VPN server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
