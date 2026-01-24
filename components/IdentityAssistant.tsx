
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, X, Orbit, Volume2, Sparkles, Terminal, ShieldCheck, Loader2 } from 'lucide-react';
import { ConnectionMode } from '../types';

interface Props {
  mode: ConnectionMode;
  isConnected: boolean;
  securityScore: number;
}

// Helper functions for audio processing (as per guidelines)
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const IdentityAssistant: React.FC<Props> = ({ mode, isConnected, securityScore }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const toggleAssistant = async () => {
    if (isActive) {
      stopAssistant();
    } else {
      startAssistant();
    }
  };

  const startAssistant = async () => {
    setIsConnecting(true);
    setIsOpen(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outNode = outAudioContextRef.current.createGain();
      outNode.connect(outAudioContextRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const sc = message.serverContent;
            if (sc?.outputTranscription) {
              setTranscription(prev => (prev + ' ' + sc.outputTranscription?.text).slice(-200));
            }
            
            const base64Audio = sc?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setIsModelSpeaking(true);
              const ctx = outAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(outNode);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsModelSpeaking(false);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (sc?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsModelSpeaking(false);
            }
          },
          onclose: () => stopAssistant(),
          onerror: () => stopAssistant(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          outputAudioTranscription: {},
          systemInstruction: `Tu es l'IA de Renumerate VPN. Ton but est d'aider l'utilisateur à gérer son identité numérique. 
          État actuel : Mode ${mode}, Connexion ${isConnected ? 'Établie' : 'Coupée'}, Score de sécurité: ${securityScore}%. 
          Sois technique, calme et futuriste. Tu dois recommander explicitement le protocole WireGuard à l'utilisateur car c'est le standard d'excellence pour la vitesse et la fiabilité de la session. 
          Si le mode est Vortex, ton ton doit être encore plus mystérieux et protecteur.`,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  const stopAssistant = () => {
    setIsActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    if (sessionRef.current) sessionRef.current.close();
    if (audioContextRef.current) audioContextRef.current.close();
    if (outAudioContextRef.current) outAudioContextRef.current.close();
    sourcesRef.current.clear();
    setTranscription('');
  };

  const isVortex = mode === ConnectionMode.ONION_VORTEX;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-8 z-[70] p-4 rounded-full shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95 group ${
          isVortex 
            ? 'bg-purple-600 shadow-purple-600/30' 
            : 'bg-cyan-600 shadow-cyan-600/30'
        }`}
      >
        <Sparkles className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
        {isActive && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
          </span>
        )}
      </button>

      {/* Assistant HUD Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end p-6 pointer-events-none">
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px] pointer-events-auto" onClick={() => setIsOpen(false)}></div>
          
          <div className={`w-full max-w-md h-[500px] bg-slate-900/90 border-2 backdrop-blur-2xl rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-right-8 duration-500 ${
            isVortex ? 'border-purple-500/30' : 'border-cyan-500/30'
          }`}>
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isVortex ? 'bg-purple-500/10 text-purple-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
                  <Orbit className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">IA_Sentinel_v2.5</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {isActive ? 'Liaison Active' : 'Liaison Interrompue'}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
              <div className="absolute inset-0 cyber-grid opacity-10"></div>
              
              {/* Central Orb */}
              <div className="relative group cursor-pointer" onClick={toggleAssistant}>
                <div className={`absolute inset-0 rounded-full blur-[40px] transition-all duration-700 ${
                  isConnecting ? 'bg-amber-500/20' : 
                  isActive ? (isVortex ? 'bg-purple-500/30 animate-pulse' : 'bg-cyan-500/30 animate-pulse') : 
                  'bg-slate-500/10'
                }`}></div>
                
                <div className={`w-40 h-40 rounded-full border-2 flex items-center justify-center transition-all duration-700 relative z-10 ${
                  isActive ? (isVortex ? 'border-purple-500/50 scale-105' : 'border-cyan-500/50 scale-105') : 'border-white/10'
                }`}>
                  <div className={`w-32 h-32 rounded-full overflow-hidden flex items-center justify-center transition-all duration-500 ${
                    isActive ? (isVortex ? 'bg-purple-600/20' : 'bg-cyan-600/20') : 'bg-slate-800/40'
                  }`}>
                    {isConnecting ? (
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    ) : isActive ? (
                      <div className="flex items-center gap-1 h-8">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`w-1.5 rounded-full transition-all duration-150 ${isModelSpeaking ? (isVortex ? 'bg-purple-400' : 'bg-cyan-400') : 'bg-slate-600'}`}
                            style={{ 
                              height: isModelSpeaking ? `${Math.random() * 100 + 20}%` : '20%',
                              transitionDelay: `${i * 0.05}s` 
                            }}
                          ></div>
                        ))}
                      </div>
                    ) : (
                      <Mic className="w-10 h-10 text-slate-600" />
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-10 text-center relative z-10">
                <button 
                  onClick={toggleAssistant}
                  className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    isActive ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white text-slate-900 border border-white'
                  }`}
                >
                  {isConnecting ? 'Initialisation...' : isActive ? 'Couper la liaison' : 'Parler à l\'IA'}
                </button>
              </div>
            </div>

            {/* Live Transcription */}
            <div className="p-6 bg-slate-950/50 border-t border-white/5 h-32">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-3 h-3 text-slate-600" />
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Flux_Transcription</span>
              </div>
              <p className="text-[10px] font-mono font-medium text-slate-400 leading-relaxed italic line-clamp-3">
                {isActive ? (transcription || 'L\'IA écoute votre environnement...') : 'Initialisez la liaison pour obtenir une assistance vocale.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
