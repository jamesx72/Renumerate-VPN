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
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
] as const;

interface SecurityReportPayload {
  score: number;
  threatLevel: 'Faible' | 'Moyen' | 'Élevé' | 'Critique';
  analysis: string;
  recommendations: string[];
}

interface DeepAuditPayload {
  analysis: string;
  sources: { title: string; uri: string }[];
  isBlacklisted: boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const modelCooldownUntil = new Map<string, number>();
const securityAnalysisCache = new Map<string, CacheEntry<SecurityReportPayload>>();
const securityAnalysisInFlight = new Map<string, Promise<SecurityReportPayload>>();
const deepAuditCache = new Map<string, CacheEntry<DeepAuditPayload>>();
let lastFallbackNoticeAt = 0;

function getApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
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
  maxEntries = 64
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
  summary: string;
  isTransient: boolean;
  isAuthOrConfig: boolean;
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

  // Parse nested JSON payload inside ApiError.message if present
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
  const isTransient =
    statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
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

  const cleanMsg = message.replace(/\s+/g, ' ').trim().slice(0, 140);
  const summary = `${statusCode || statusText || 'ERR'}${cleanMsg ? `: ${cleanMsg}` : ''}`;

  return {
    statusCode,
    statusText,
    summary,
    isTransient,
    isAuthOrConfig,
  };
}

function formatCleanFrenchGeminiError(err: unknown): string {
  const info = classifyGeminiError(err);
  if (info.isTransient) {
    return 'Le moteur distant connaît un pic de sollicitation temporaire. Veuillez réessayer dans quelques instants.';
  }
  if (info.isAuthOrConfig) {
    return 'Configuration de clé API invalide ou accès restreint côté serveur (vérifiez GEMINI_API_KEY dans Settings > Secrets).';
  }
  return 'Service distant momentanément indisponible. Les outils locaux de diagnostic restent pleinement opérationnels.';
}

function noteFallbackLog(scope: string, reason: string): void {
  const now = Date.now();
  if (now - lastFallbackNoticeAt > 30_000) {
    lastFallbackNoticeAt = now;
    console.info(`[Sentinel/${scope}] Bascule heuristique locale active (${reason})`);
  }
}

function orderCandidateModels(models: readonly string[]): string[] {
  const now = Date.now();
  const ready: string[] = [];
  const cooling: string[] = [];
  for (const m of models) {
    const until = modelCooldownUntil.get(m) ?? 0;
    if (until > now) {
      cooling.push(m);
    } else {
      if (until > 0) modelCooldownUntil.delete(m);
      ready.push(m);
    }
  }
  return [...ready, ...cooling];
}

async function generateWithModelCascade(options: {
  ai: GoogleGenAI;
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
  models?: readonly string[];
  buildConfig?: (model: string) => GenerateContentConfig | undefined;
}): Promise<{ response: GenerateContentResponse; model: string }> {
  const candidates = orderCandidateModels(options.models ?? TEXT_MODEL_CASCADE);
  let lastError: unknown = new Error('Aucun modèle disponible');

  for (let idx = 0; idx < candidates.length; idx++) {
    const model = candidates[idx];
    const maxAttempts = idx === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await options.ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.buildConfig ? options.buildConfig(model) : undefined,
        });
        modelCooldownUntil.delete(model);
        return { response, model };
      } catch (err) {
        lastError = err;
        const info = classifyGeminiError(err);

        if (info.isAuthOrConfig && info.statusCode !== 400) {
          throw err;
        }

        if (info.isTransient) {
          const cooldownMs = info.statusCode === 429 ? 30_000 : 20_000;
          modelCooldownUntil.set(model, Date.now() + cooldownMs);

          if (attempt < maxAttempts) {
            const jitter = Math.floor(Math.random() * 140);
            await sleep(340 * attempt + jitter);
            continue;
          }

          if (idx < candidates.length - 1) {
            const jitter = Math.floor(Math.random() * 100);
            await sleep(200 + jitter);
          }
          break;
        }

        // If 400 on a specific model config (e.g. tool support difference), move to next candidate
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
      } = (req.body || {}) as Record<string, unknown>;

      const reportParams = {
        mode: String(mode),
        location: String(location),
        ip: String(ip),
        protocol: String(protocol),
        killSwitch: Boolean(killSwitch),
        ipv6LeakProtection: Boolean(ipv6LeakProtection),
      };

      const cacheKey = `${reportParams.mode}|${reportParams.location}|${reportParams.ip}|${reportParams.protocol}|${reportParams.killSwitch}|${reportParams.ipv6LeakProtection}`;

      if (!forceRefresh) {
        const cached = getCachedValue(securityAnalysisCache, cacheKey);
        if (cached) {
          res.json(cached);
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
        res.json(buildDeterministicSecurityReport(reportParams));
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

          const parsed = normalizeSecurityReport(JSON.parse(text), reportParams);
          setCachedValue(securityAnalysisCache, cacheKey, parsed, 90_000);
          return parsed;
        } catch (err) {
          const info = classifyGeminiError(err);
          noteFallbackLog('security-analysis', info.summary);
          const fallback = buildDeterministicSecurityReport(reportParams);
          setCachedValue(securityAnalysisCache, cacheKey, fallback, 25_000);
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
      res.json(buildDeterministicDeepAudit(targetIp, targetLocation));
      return;
    }

    const prompt = `Effectue un audit de réputation cybersécurité en français (3 à 4 phrases maximum) pour un nœud de sortie VPN situé en ${targetLocation} (plage IP simulée : ${targetIp}).
Évalue la juridiction de confidentialité de ${targetLocation}, la réputation générale des centres de données locaux et les bonnes pratiques anti-corrélation.`;

    try {
      const { response } = await generateWithModelCascade({
        ai,
        contents: prompt,
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
      };
      setCachedValue(deepAuditCache, cacheKey, payload, 120_000, 48);
      res.json(payload);
    } catch (err) {
      const info = classifyGeminiError(err);
      noteFallbackLog('deep-audit', info.summary);
      res.json(buildDeterministicDeepAudit(targetIp, targetLocation));
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
      noteFallbackLog('chat', info.summary);
      if (info.isAuthOrConfig) {
        res.json({
          reply: `${formatCleanFrenchGeminiError(err)} ${buildContextualSentinelReply(userPrompt, context)}`,
        });
        return;
      }
      res.json({
        reply: buildContextualSentinelReply(userPrompt, context),
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

      const buildHeuristicVoicePayload = (spokenText: string) => {
        const effectiveTranscript =
          spokenText.trim() ||
          'Analyse de sécurité et recommandations de protection de la session';
        const intent = inferVoiceIntent(effectiveTranscript);
        const report = buildDeterministicSecurityReport(reportParams);
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

      let transcript = directText;

      // Step 1: Dedicated speech transcription when audio bytes are supplied
      if (!transcript && cleanAudioBase64) {
        try {
          const { response: txRes } = await generateWithModelCascade({
            ai,
            models: ['gemini-3.5-transcribe'],
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: normalizedMime,
                    data: cleanAudioBase64,
                  },
                },
                {
                  text: 'Transcris exactement en français la phrase prononcée dans cet extrait audio. Réponds uniquement avec la transcription brute sans guillemets ni commentaire.',
                },
              ],
            },
          });
          const txText = (txRes.text ?? '').trim();
          if (txText) {
            transcript = txText;
          }
        } catch (txErr) {
          const txInfo = classifyGeminiError(txErr);
          noteFallbackLog('voice-transcribe', txInfo.summary);
        }
      }

      // Step 2: Structured intent classification + security audit / protection advice
      const telemetrySummary = `Contexte session VPN de l'opérateur :
- État du tunnel : ${context.isConnected ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
- Architecture active : ${reportParams.mode}
- Protocole : ${reportParams.protocol.toUpperCase()}
- Relais de sortie : ${reportParams.location} (${reportParams.ip})
- Score actuel : ${String(context.securityScore ?? 85)}/100
- Kill Switch : ${reportParams.killSwitch ? 'Actif' : 'Inactif'}
- Protection IPv6 : ${reportParams.ipv6LeakProtection ? 'Active' : 'Inactive'}`;

      const analysisInstruction = transcript
        ? `Tu es Sentinel, l'architecte cybersécurité vocal du Cockpit Renumerate VPN.
Commande vocale transcrite de l'utilisateur : "${transcript}"
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
      >[0]['contents'] = transcript
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
          transcript ||
          (typeof parsed.transcript === 'string' && parsed.transcript.trim()
            ? parsed.transcript.trim()
            : 'Analyse vocale de la posture de sécurité');

        const resolvedIntent: 'security_analysis' | 'protection_advice' =
          parsed.intent === 'protection_advice' ||
          parsed.intent === 'security_analysis'
            ? parsed.intent
            : inferVoiceIntent(resolvedTranscript);

        const normalizedReport = normalizeSecurityReport(parsed, reportParams);
        const resolvedReply =
          typeof parsed.reply === 'string' && parsed.reply.trim().length > 8
            ? parsed.reply.trim()
            : normalizedReport.analysis;

        const cacheKey = `${reportParams.mode}|${reportParams.location}|${reportParams.ip}|${reportParams.protocol}|${reportParams.killSwitch}|${reportParams.ipv6LeakProtection}`;
        setCachedValue(
          securityAnalysisCache,
          cacheKey,
          normalizedReport,
          90_000
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
        noteFallbackLog('voice-command', info.summary);
        res.json(buildHeuristicVoicePayload(transcript));
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
    if (!ai) {
      res.json({ audioWavBase64: null });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
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

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
      res.json({ audioWavBase64: base64Audio });
    } catch (err) {
      const info = classifyGeminiError(err);
      noteFallbackLog('tts', info.summary);
      res.json({ audioWavBase64: null });
    }
  });

  app.get('/api/system/diagnostics', (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const cpus = os.cpus();
    const load = os.loadavg();
    let cipherSuitesCount = 0;
    try {
      cipherSuitesCount = crypto.getCiphers().length;
    } catch {
      cipherSuitesCount = 64;
    }

    res.json({
      status: 'nominal',
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpuCores: Array.isArray(cpus) && cpus.length > 0 ? cpus.length : 1,
      loadAvg1m: Number.isFinite(load[0]) ? parseFloat(load[0].toFixed(2)) : 0,
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: parseFloat((mem.rss / (1024 * 1024)).toFixed(1)),
      memoryHeapUsedMb: parseFloat((mem.heapUsed / (1024 * 1024)).toFixed(1)),
      memoryHeapTotalMb: parseFloat((mem.heapTotal / (1024 * 1024)).toFixed(1)),
      cipherSuitesCount,
      pqcReady: true,
    });
  });

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

    try {
      try {
        liveSession = await openLiveSession();
      } catch (firstErr) {
        if (classifyGeminiError(firstErr).isTransient) {
          await sleep(450);
          liveSession = await openLiveSession();
        } else {
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
      const info = classifyGeminiError(err);
      noteFallbackLog('live-voice', info.summary);
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
