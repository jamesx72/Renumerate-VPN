import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  X,
  ChevronRight,
  Ban,
  Terminal,
  Zap,
} from 'lucide-react';
import { IntrusionAttempt, IntrusionSeverity } from '../types';

export interface IntrusionToastProps {
  attempt: IntrusionAttempt | null;
  onInspect: (attempt: IntrusionAttempt) => void;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export const IntrusionToastNotification: React.FC<IntrusionToastProps> = ({
  attempt,
  onInspect,
  onDismiss,
  autoDismissMs = 9000,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(autoDismissMs);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!attempt) return;
    startTimeRef.current = Date.now();
    remainingTimeRef.current = autoDismissMs;
    setProgress(100);

    const updateProgress = () => {
      if (isPaused) {
        animFrameRef.current = requestAnimationFrame(updateProgress);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, autoDismissMs - elapsed);
      const pct = (remaining / autoDismissMs) * 100;
      setProgress(pct);

      if (remaining <= 0) {
        onDismiss();
      } else {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [attempt, autoDismissMs, onDismiss, isPaused]);

  if (!attempt) return null;

  const isCritical = attempt.severity === 'critical';
  const isHigh = attempt.severity === 'high';

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        startTimeRef.current = Date.now() - (1 - progress / 100) * autoDismissMs;
      }}
      className={`fixed bottom-6 right-6 z-[9999] w-full max-w-md sm:max-w-lg bg-slate-900 text-white rounded-2xl shadow-2xl border transition-all duration-300 overflow-hidden ${
        isCritical
          ? 'border-rose-500/80 shadow-rose-950/50'
          : isHigh
            ? 'border-amber-500/70 shadow-amber-950/40'
            : 'border-cyan-500/70 shadow-cyan-950/40'
      }`}
    >
      {/* Top Banner Alert Bar */}
      <div
        className={`px-4 py-3 flex items-start justify-between gap-3 border-b ${
          isCritical
            ? 'bg-rose-500/10 border-rose-500/30'
            : isHigh
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-cyan-500/10 border-cyan-500/30'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg border ${
              isCritical
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                : isHigh
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Tentative d'intrusion neutralisée
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${getSeverityClasses(
                  attempt.severity
                )}`}
              >
                {attempt.severity}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Filtre actif : <strong className="font-mono text-cyan-300">{attempt.signatureRule}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Fermer la notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Toast Content */}
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white leading-snug">
            {attempt.title}
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
            {attempt.description}
          </p>
        </div>

        {/* Technical Target Strip */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-slate-300">
          <span>
            IP Attaquant : <strong className="text-white">{attempt.sourceIp}</strong>{' '}
            {attempt.sourceCountry ? `(${attempt.sourceCountry})` : ''}
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Cible : {attempt.targetInterface} (port {attempt.targetPort || 'Tout'})
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 font-semibold">
            {formatDefenseAction(attempt.actionTaken)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-[10px] text-slate-400 font-mono">
            {attempt.quarantined ? (
              <span className="flex items-center gap-1 text-rose-400 font-medium">
                <Ban className="w-3 h-3" />
                IP isolée sur liste noire nftables
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ShieldCheck className="w-3 h-3" />
                Paquet rejeté au niveau eBPF/XDP
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Ignorer
            </button>

            <button
              type="button"
              onClick={() => onInspect(attempt)}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-cyan-900/30"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspecter l'incident</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Auto-Dismiss Bar */}
      <div className="w-full h-1 bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-75 linear ${
            isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-cyan-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

function getSeverityClasses(severity: IntrusionSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'high':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'medium':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    case 'low':
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  }
}

function formatDefenseAction(action: string): string {
  switch (action) {
    case 'drop_xdp':
      return 'Verdict: eBPF/XDP DROP';
    case 'nft_quarantine':
      return 'Verdict: Quarantaine nftables';
    case 'tunnel_rekey':
      return 'Verdict: Rekeying PQC forcé';
    case 'sinkhole':
      return 'Verdict: Dérouté vers Sinkhole';
    default:
      return `Verdict: ${action}`;
  }
}
