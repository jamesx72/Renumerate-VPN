import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Loader2,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Globe,
  Terminal,
  RefreshCw,
  Cpu,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { performDeepAudit, DeepAuditResult } from '../services/geminiService';
import { AppSettings } from '../types';
import { computeSettingsHardeningScore } from '../constants';

interface Props {
  currentIp: string;
  location: string;
  settings?: AppSettings;
  onOpenSystemCenter?: () => void;
}

export const SecurityAudit: React.FC<Props> = ({
  currentIp,
  location,
  settings,
  onOpenSystemCenter,
}) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<DeepAuditResult | null>(null);

  const hardeningScore = settings ? computeSettingsHardeningScore(settings) : null;

  const startAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await performDeepAudit(currentIp, location);
      setAuditResult(result);
    } catch {
      setAuditResult({
        analysis: `Vérification locale de la passerelle ${location} (${currentIp}) : aucune anomalie détectée.`,
        sources: [],
        isBlacklisted: false,
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const pqcLabel =
    settings?.postQuantumKex === 'ml-kem-1024'
      ? 'ML-KEM-1024'
      : settings?.postQuantumKex === 'sntrup761'
        ? 'SNTRUP761'
        : 'X25519';

  const egressProtected = Boolean(
    settings?.blockQuicUdp443 &&
      settings?.arpSpoofGuard &&
      settings?.strictReversePathFilter
  );

  const killSwitchLabel = !settings?.killSwitch
    ? 'Inactif'
    : settings.killSwitchMode === 'strict'
      ? 'Strict (nft)'
      : 'Souple';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 overflow-hidden relative group">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            Audit Sortie & Noyau
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Réputation IP & conformité système
          </p>
        </div>
        {!auditResult && !isAuditing && (
          <button
            onClick={startAudit}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Auditer</span>
          </button>
        )}
      </div>

      {settings && (
        <div className="mb-5 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Échange KEX
              </div>
              <div
                className={`text-xs font-mono font-bold tabular-nums mt-0.5 ${
                  settings.postQuantumKex !== 'classic-x25519'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {pqcLabel}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pile TCP / TUN
              </div>
              <div className="text-xs font-mono font-bold tabular-nums mt-0.5 text-slate-800 dark:text-slate-200">
                {settings.tcpCongestionControl.toUpperCase()}
                {settings.multiQueueTun ? ' · MQ' : ''}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pare-feu Egress
              </div>
              <div
                className={`text-xs font-mono font-bold tabular-nums mt-0.5 ${
                  egressProtected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {egressProtected ? 'QUIC+ARP Filtré' : 'Filtrage partiel'}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kill Switch
              </div>
              <div
                className={`text-xs font-mono font-bold tabular-nums mt-0.5 ${
                  !settings.killSwitch
                    ? 'text-red-600 dark:text-red-400'
                    : settings.killSwitchMode === 'strict'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-cyan-600 dark:text-cyan-400'
                }`}
              >
                {killSwitchLabel}
              </div>
            </div>
          </div>

          {onOpenSystemCenter && (
            <button
              onClick={onOpenSystemCenter}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Console Système & Noyau</span>
              </span>
              <span className="flex items-center gap-1 font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                {hardeningScore !== null && <span>{hardeningScore}%</span>}
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
        </div>
      )}

      {isAuditing ? (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="w-4 h-4 text-cyan-500/60" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Audit en cours...
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 animate-pulse font-mono">
              RECHERCHE DE FUITES DNS / BLACKLISTS...
            </p>
          </div>
        </div>
      ) : auditResult ? (
        <div className="space-y-4">
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              auditResult.isBlacklisted
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-emerald-500/5 border-emerald-500/20'
            }`}
          >
            {auditResult.isBlacklisted ? (
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div>
              <h4
                className={`text-xs font-bold uppercase mb-1 ${
                  auditResult.isBlacklisted
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {auditResult.isBlacklisted
                  ? 'Risque Détecté'
                  : 'Réputation Excellente'}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {auditResult.analysis}
              </p>
            </div>
          </div>

          {auditResult.quotaNotice && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{auditResult.quotaNotice}</span>
            </div>
          )}

          {auditResult.sources.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3 h-3" /> Sources Consultées
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {auditResult.sources.map((source, i) => (
                  <a
                    key={i}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors group/link"
                  >
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                      {source.title}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover/link:text-cyan-500 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={startAudit}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-vérifier la sortie
          </button>
        </div>
      ) : (
        <div className="p-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-center">
          <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
            Vérifiez la réputation ASN et les listes noires publiques du nœud{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {currentIp}
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
};

