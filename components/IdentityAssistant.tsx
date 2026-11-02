import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  X,
  Orbit,
  Sparkles,
  Terminal,
  Loader2,
  Send,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { ConnectionMode } from '../types';
import { sendSentinelChatMessage } from '../services/geminiService';

interface Props {
  mode: ConnectionMode;
  protocol?: string;
  isConnected: boolean;
  country?: string;
  ip?: string;
  securityScore: number;
  killSwitch?: boolean;
  ipv6LeakProtection?: boolean;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

function encodePcmBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodePcmBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodePcmBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(
    data.buffer,
    data.byteOffset,
    Math.floor(data.byteLength / 2)
  );
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

const QUICK_PROMPTS = [
  'Auditer ma posture actuelle',
  'Prévenir les fuites DNS/IPv6',
  'Quand utiliser Onion Vortex ?',
];

export const IdentityAssistant: React.FC<Props> = ({
  mode,
  protocol = 'wireguard',
  isConnected,
  country = 'France',
  ip = '185.212.149.42',
  securityScore,
  killSwitch = true,
  ipv6LeakProtection = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'voice'>('chat');

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Bonjour. Je suis Sentinel, votre conseiller en sécurité réseau et identité numérique. Posez-moi une question sur votre tunnel, vos empreintes ou la prévention des fuites.',
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Live Voice WebSocket state
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (isOpen && tab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, tab]);

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  const handleSendChat = async (promptOverride?: string) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || isSendingChat) return;

    if (!promptOverride) setChatInput('');
    const userMsg: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);

    try {
      const reply = await sendSentinelChatMessage(text, {
        mode,
        protocol,
        isConnected,
        country,
        ip,
        securityScore,
        killSwitch,
        ipv6LeakProtection,
      });
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text:
            err instanceof Error
              ? err.message
              : 'Impossible de contacter Sentinel pour le moment.',
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const startVoiceSession = async () => {
    setVoiceError(null);
    setIsVoiceConnecting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const inCtx = new AudioCtx({ sampleRate: 16000 });
      const outCtx = new AudioCtx({ sampleRate: 24000 });
      inputAudioCtxRef.current = inCtx;
      outputAudioCtxRef.current = outCtx;

      const outGain = outCtx.createGain();
      outGain.connect(outCtx.destination);

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        mode,
        connected: String(isConnected),
        score: String(securityScore),
      });
      const ws = new WebSocket(
        `${wsProto}//${window.location.host}/api/live?${params.toString()}`
      );
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            ready?: boolean;
            audio?: string;
            outputTranscript?: string;
            inputTranscript?: string;
            interrupted?: boolean;
            error?: string;
          };

          if (msg.error) {
            setVoiceError(msg.error);
            stopVoiceSession();
            return;
          }

          if (msg.ready) {
            setIsVoiceConnecting(false);
            setIsVoiceActive(true);

            const source = inCtx.createMediaStreamSource(stream);
            const processor = inCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              ws.send(
                JSON.stringify({
                  audio: encodePcmBase64(new Uint8Array(int16.buffer)),
                })
              );
            };
            source.connect(processor);
            processor.connect(inCtx.destination);
          }

          if (msg.outputTranscript) {
            setTranscription((prev) =>
              `${prev} ${msg.outputTranscript}`.trim().slice(-240)
            );
          }

          if (msg.audio && outputAudioCtxRef.current) {
            setIsModelSpeaking(true);
            const ctx = outputAudioCtxRef.current;
            nextStartTimeRef.current = Math.max(
              nextStartTimeRef.current,
              ctx.currentTime
            );
            const buffer = await decodePcmBuffer(
              decodePcmBase64(msg.audio),
              ctx,
              24000
            );
            const bufSource = ctx.createBufferSource();
            bufSource.buffer = buffer;
            bufSource.connect(outGain);
            bufSource.onended = () => {
              sourcesRef.current.delete(bufSource);
              if (sourcesRef.current.size === 0) setIsModelSpeaking(false);
            };
            bufSource.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(bufSource);
          }

          if (msg.interrupted) {
            sourcesRef.current.forEach((s) => {
              try {
                s.stop();
              } catch {
                // Ignore
              }
            });
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsModelSpeaking(false);
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onerror = () => {
        setVoiceError(
          'Connexion vocale indisponible. Utilisez la console texte Sentinel.'
        );
        stopVoiceSession();
      };

      ws.onclose = () => {
        setIsVoiceActive(false);
        setIsVoiceConnecting(false);
      };
    } catch {
      setVoiceError(
        'Accès microphone refusé ou indisponible. Utilisez la console texte.'
      );
      stopVoiceSession();
    }
  };

  const stopVoiceSession = () => {
    setIsVoiceActive(false);
    setIsVoiceConnecting(false);
    setIsModelSpeaking(false);

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const isVortex = mode === ConnectionMode.ONION_VORTEX;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Ouvrir le conseiller Sentinel IA"
        className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-2xl shadow-xl transition-transform hover:scale-105 active:scale-95 flex items-center gap-2.5 text-white text-xs font-semibold cursor-pointer ${
          isVortex ? 'bg-purple-600' : 'bg-cyan-600'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        <span>Sentinel IA</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[105] flex items-end sm:items-center justify-end p-4 sm:p-6 pointer-events-none">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full max-w-md h-[560px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    isVortex
                      ? 'bg-purple-500/15 text-purple-500'
                      : 'bg-cyan-500/15 text-cyan-500'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Conseiller Sentinel IA
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isConnected
                      ? `${mode} · ${protocol.toUpperCase()} (${country})`
                      : 'Tunnel actuellement hors ligne'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex gap-1.5">
              <button
                type="button"
                onClick={() => setTab('chat')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  tab === 'chat'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Console Texte</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('voice')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  tab === 'voice'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Liaison Vocale Live</span>
              </button>
            </div>

            {tab === 'chat' ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${
                        m.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isSendingChat && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                        <span>Analyse Sentinel en cours...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Diagnostic Prompts */}
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex gap-1.5 overflow-x-auto">
                  {QUICK_PROMPTS.map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => handleSendChat(qp)}
                      disabled={isSendingChat}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {qp}
                    </button>
                  ))}
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Posez une question cybersécurité..."
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSendingChat}
                    className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col justify-between p-6">
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <button
                    type="button"
                    onClick={
                      isVoiceActive ? stopVoiceSession : startVoiceSession
                    }
                    className={`w-32 h-32 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                      isVoiceActive
                        ? isVortex
                          ? 'border-purple-500 bg-purple-500/15'
                          : 'border-cyan-500 bg-cyan-500/15'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60'
                    }`}
                  >
                    {isVoiceConnecting ? (
                      <Loader2 className="w-9 h-9 text-cyan-500 animate-spin" />
                    ) : isVoiceActive ? (
                      <div className="flex items-center gap-1.5 h-8">
                        {[0, 1, 2, 3, 4].map((idx) => (
                          <span
                            key={idx}
                            className={`w-1.5 rounded-full transition-all ${
                              isModelSpeaking
                                ? 'h-7 bg-cyan-400 animate-pulse'
                                : 'h-3 bg-slate-400'
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <Mic className="w-9 h-9 text-slate-500" />
                    )}
                  </button>

                  <div className="mt-6 space-y-2">
                    <button
                      type="button"
                      onClick={
                        isVoiceActive ? stopVoiceSession : startVoiceSession
                      }
                      className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isVoiceActive
                          ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                    >
                      {isVoiceConnecting
                        ? 'Connexion au pont vocal...'
                        : isVoiceActive
                          ? 'Interrompre la session vocale'
                          : 'Démarrer la session vocale'}
                    </button>
                    {voiceError && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 max-w-xs mx-auto">
                        {voiceError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Transcription audio en direct</span>
                  </div>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-300 line-clamp-3">
                    {isVoiceActive
                      ? transcription ||
                        'Canal audio PCM 16 kHz ouvert. Parlez maintenant...'
                      : 'Activez le canal vocal ou basculez sur l’onglet Console Texte.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

