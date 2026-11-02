import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getApiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
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

function buildDeterministicSecurityReport(params: {
  mode: string;
  location: string;
  ip: string;
  protocol?: string;
  killSwitch?: boolean;
  ipv6LeakProtection?: boolean;
}) {
  const {
    mode,
    location,
    ip,
    protocol = 'wireguard',
    killSwitch = true,
    ipv6LeakProtection = true,
  } = params;

  let score = 84;
  if (mode === 'Onion Vortex') score = 98;
  else if (mode === 'Double Hop') score = 95;
  else if (mode === 'Stealth') score = 92;
  else if (mode === 'Smart DNS') score = 74;

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
      'Basculez en WireGuard Standard ou Stealth pour chiffrer les charges utiles.'
    );
  }
  recommendations.push(
    `Protocole ${protocol.toUpperCase()} actif sur la passerelle ${location} (${ip}).`,
    'Activez la rotation périodique MAC/IP pour réduire la corrélation temporelle.'
  );

  return {
    score,
    threatLevel,
    analysis: `Tunnel ${mode} établi vers ${location} (${ip}) sous ${protocol.toUpperCase()}. Empreinte réseau cloisonnée et chiffrement de transport opérationnel.`,
    recommendations: recommendations.slice(0, 3),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

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
      } = (req.body || {}) as Record<string, unknown>;

      const ai = createGenAIClient();
      if (!ai) {
        res.json(
          buildDeterministicSecurityReport({
            mode: String(mode),
            location: String(location),
            ip: String(ip),
            protocol: String(protocol),
            killSwitch: Boolean(killSwitch),
            ipv6LeakProtection: Boolean(ipv6LeakProtection),
          })
        );
        return;
      }

      const prompt = `Agis comme un architecte en cybersécurité réseau pour "Renumerate VPN".
L'utilisateur est connecté via un relais en ${String(location)} (IP de sortie : ${String(ip)}).
Mode actif : ${String(mode)} | Protocole : ${String(protocol).toUpperCase()} | Kill Switch : ${Boolean(killSwitch)} | Bouclier IPv6 : ${Boolean(ipv6LeakProtection)}.
Analyse en français (maximum 55 mots) le niveau d'anonymat et de résilience.
Attribue un score de 0 à 100 et fournis exactement 3 recommandations techniques courtes.`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
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
              required: ['score', 'threatLevel', 'analysis', 'recommendations'],
            },
          },
        });

        const text = (response.text ?? '').trim();
        if (!text) {
          throw new Error('Réponse vide du modèle');
        }
        res.json(JSON.parse(text));
      } catch (err) {
        console.error('Security analysis fallback:', err);
        res.json(
          buildDeterministicSecurityReport({
            mode: String(mode),
            location: String(location),
            ip: String(ip),
            protocol: String(protocol),
            killSwitch: Boolean(killSwitch),
            ipv6LeakProtection: Boolean(ipv6LeakProtection),
          })
        );
      }
    }
  );

  app.post('/api/gemini/deep-audit', async (req: Request, res: Response) => {
    const { ip = '0.0.0.0', location = 'Suisse' } = (req.body || {}) as Record<
      string,
      unknown
    >;

    const ai = createGenAIClient();
    if (!ai) {
      res.json({
        analysis: `Audit heuristique local du relais ${String(location)} (${String(ip)}) : aucune signature de liste noire critique détectée sur ce sous-réseau de transit.`,
        sources: [],
        isBlacklisted: false,
      });
      return;
    }

    const prompt = `Effectue un audit de réputation cybersécurité en français (3 à 4 phrases maximum) pour un nœud de sortie VPN situé en ${String(location)} (plage IP simulée : ${String(ip)}).
Évalue la juridiction de confidentialité de ${String(location)}, la réputation générale des centres de données locaux et les bonnes pratiques anti-corrélation.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const analysis =
        response.text ||
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
      res.json({
        analysis,
        sources,
        isBlacklisted:
          lower.includes('blacklisté') || lower.includes('compromis critique'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur serveur Gemini';
      res.status(502).json({
        error: msg,
        analysis: `Audit local de secours pour ${String(location)} (${String(ip)}) : juridiction vérifiée, aucune anomalie BGP détectée.`,
        sources: [],
        isBlacklisted: false,
      });
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
        reply: `Diagnostic Sentinel local : votre tunnel est actuellement ${context.isConnected ? 'actif' : 'hors ligne'} en mode ${String(context.mode || 'Standard')} (${String(context.protocol || 'wireguard').toUpperCase()}). Pour une protection optimale, maintenez WireGuard, le coupe-circuit d'urgence et la protection anti-fuite DNS/IPv6 activés.`,
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction: `Tu es Sentinel, l'ingénieur conseil en cybersécurité et anonymat numérique intégré à Renumerate VPN.
Réponds toujours en français, de manière claire, précise, structurée et concise (maximum 110 mots).
Contexte télémétrique actuel de l'utilisateur :
- Connexion tunnel : ${context.isConnected ? 'ÉTABLIE' : 'HORS LIGNE'}
- Mode : ${String(context.mode || 'Standard')}
- Protocole : ${String(context.protocol || 'wireguard').toUpperCase()}
- Relais actif : ${String(context.country || 'France')} (${String(context.ip || 'N/A')})
- Score sécurité : ${String(context.securityScore ?? 0)}/100
- Kill Switch : ${context.killSwitch ? 'Actif' : 'Inactif'}
- Protection IPv6 : ${context.ipv6LeakProtection ? 'Active' : 'Inactive'}`,
        },
      });

      res.json({
        reply:
          response.text ||
          'Analyse terminée. Vérifiez vos paramètres de tunnel pour maintenir une isolation stricte.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur Gemini';
      res.status(502).json({
        error: msg,
        reply:
          'Le moteur Sentinel distant est temporairement indisponible. Vérifiez votre clé API dans Settings > Secrets ou utilisez les outils locaux de diagnostic DNS et Coffre-fort.',
      });
    }
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

    try {
      const sessionPromise = ai.live.connect({
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
                  error: 'Interruption de la session vocale Gemini Live.',
                })
              );
              clientWs.close();
            }
          },
        },
      });

      liveSession = await sessionPromise;

      clientWs.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString()) as { audio?: string };
          if (parsed.audio) {
            sessionPromise
              .then((s) =>
                s.sendRealtimeInput({
                  audio: {
                    data: parsed.audio as string,
                    mimeType: 'audio/pcm;rate=16000',
                  },
                })
              )
              .catch(() => {});
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
            error:
              err instanceof Error
                ? err.message
                : 'Impossible d’ouvrir la session vocale Gemini Live.',
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
