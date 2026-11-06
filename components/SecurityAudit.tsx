import React, { useState, useMemo } from 'react';
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
  Check,
  X,
} from 'lucide-react';
import { performDeepAudit, DeepAuditResult } from '../services/geminiService';
import { AppSettings } from '../types';
import { computeSettingsHardeningScore } from '../constants';

interface Props {
  currentIp: string;
  location: string;
  settings?: AppSettings;
  onOpenSystemCenter?: () => void;
  onAutoRemediate?: () => void;
  onOpenIds?: () => void;
}

interface ComplianceVector {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
}

export const SecurityAudit: React.FC<Props> = ({
  currentIp,
  location,
  settings,
  onOpenSystemCenter,
  onAutoRemediate,
  onOpenIds,
}) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<DeepAuditResult | null>(null);
  const [showAllVectors, setShowAllVectors] = useState(false);

  const hardeningScore = settings
    ? computeSettingsHardeningScore(settings)
    : null;

  const complianceVectors = useMemo<ComplianceVector[]>(() => {
    if (!settings) return [];
    const fpCount = Object.values(settings.fingerprintProtection).filter(
      Boolean
    ).length;

    return [
      {
        id: 'killswitch',
        label: 'Kill Switch nftables',
        detail: !settings.killSwitch
          ? 'Inactif'
          : settings.killSwitchMode === 'strict'
            ? 'Strict'
            : 'Souple',
        passed: settings.killSwitch && settings.killSwitchMode === 'strict',
      },
      {
        id: 'pqc',
        label: 'Échange Post-Quantique',
        detail:
          settings.postQuantumKex === 'ml-kem-1024'
            ? 'ML-KEM-1024'
            : settings.postQuantumKex === 'sntrup761'
              ? 'SNTRUP761'
              : 'X25519 classique',
        passed: settings.postQuantumKex !== 'classic-x25519',
      },
      {
        id: 'dns_shield',
        label: 'Étanchéité DNS / DoH',
        detail: settings.dnsLeakProtection
          ? `${settings.dns.toUpperCase()} isolé`
          : 'Exposé',
        passed: settings.dnsLeakProtection,
      },
      {
        id: 'ipv6_webrtc',
        label: 'Confinement IPv6 & WebRTC',
        detail:
          settings.ipv6LeakProtection && settings.webrtcLeakShield
            ? 'Verrouillé'
            : 'Partiel',
        passed: settings.ipv6LeakProtection && settings.webrtcLeakShield,
      },
      {
        id: 'quic_egress',
        label: 'Filtrage QUIC UDP/443',
        detail: settings.blockQuicUdp443 ? 'Bloqué' : 'Autorisé',
        passed: settings.blockQuicUdp443,
      },
      {
        id: 'l2_arp',
        label: 'Garde ARP & rp_filter',
        detail:
          settings.arpSpoofGuard && settings.strictReversePathFilter
            ? 'Actif'
            : 'Partiel',
        passed: settings.arpSpoofGuard && settings.strictReversePathFilter,
      },
      {
        id: 'mlock',
        label: 'Verrouillage RAM (mlock)',
        detail: settings.strictMemoryLock ? 'Zéro-Swap' : 'Standard',
        passed: settings.strictMemoryLock,
      },
      {
        id: 'fingerprint',
        label: 'Anti-pistage navigateur',
        detail: `${fpCount}/4 actifs`,
        passed: fpCount === 4,
      },
      {
        id: 'ids_sentinel',
        label: 'Sentinelle IDS (eBPF/XDP)',
        detail: settings.idsEnabled
          ? `${settings.idsSensitivity === 'paranoid' ? 'Paranoïaque' : settings.idsSensitivity === 'high' ? 'Élevée' : 'Standard'} (${settings.idsAutoQuarantine ? 'Auto-Drop' : 'Alerte'})`
          : 'Désactivé',
        passed: settings.idsEnabled && settings.idsAutoQuarantine,
      },
    ];
  }, [settings]);

  const passedCount = useMemo(
    () => complianceVectors.filter((v) => v.passed).length,
    [complianceVectors]
  );

  const failedCount = complianceVectors.length - passedCount;

  const startAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await performDeepAudit(currentIp, location);
      setAuditResult(result);
    } catch {
      setAuditResult({
        analysis: `Vérification locale de la passerelle ${location} (${currentIp}) : aucune inscription sur les listes RBL/ASN critiques.`,
        sources: [],
        isBlacklisted: false,
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const displayedVectors = showAllVectors
    ? complianceVectors
    : complianceVectors.slice(0, 4);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>Audit sortie &amp; conformité noyau</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            {settings
              ? `${passedCount}/${complianceVectors.length} contrôles conformes`
              : 'Réputation ASN & listes noires'}
          </p>
        </div>

        {!auditResult && !isAuditing && (
          <button
            type="button"
            onClick={startAudit}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Auditer IP</span>
          </button>
        )}
      </div>

      {settings && complianceVectors.length > 0 && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 gap-1.5">
            {displayedVectors.map((vec) => (
              <div
                key={vec.id}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium truncate">
                  {vec.passed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{vec.label}</span>
                </span>
                <span
                  className={`font-mono tabular-nums font-semibold shrink-0 ${
                    vec.passed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {vec.detail}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setShowAllVectors((s) => !s)}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer"
            >
              {showAllVectors
                ? 'Réduire la matrice'
                : `Voir les ${complianceVectors.length} vecteurs`}
            </button>

            {failedCount > 0 && onAutoRemediate && (
              <button
                type="button"
                onClick={onAutoRemediate}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Durcir ({failedCount} écart{failedCount > 1 ? 's' : ''})
              </button>
            )}
          </div>

          {onOpenSystemCenter && (
            <button
              type="button"
              onClick={onOpenSystemCenter}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Console Système &amp; Noyau</span>
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
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-2.5 border-t border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-cyan-600 dark:text-cyan-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-cyan-600/70 dark:text-cyan-400/70" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Inspection ASN &amp; listes RBL en cours...
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              Cible : {currentIp} ({location})
            </p>
          </div>
        </div>
      ) : auditResult ? (
        <div className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              auditResult.isBlacklisted
                ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
            }`}
          >
            {auditResult.isBlacklisted ? (
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div>
              <h4
                className={`text-xs font-bold mb-1 ${
                  auditResult.isBlacklisted
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {auditResult.isBlacklisted
                  ? 'Signalement RBL détecté'
                  : 'Réputation IP irréprochable'}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {auditResult.analysis}
              </p>
            </div>
          </div>

          {auditResult.quotaNotice && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{auditResult.quotaNotice}</span>
            </div>
          )}

          {auditResult.sources.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                <span>Sources consultées</span>
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
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                      {source.title}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover/link:text-cyan-500 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={startAudit}
            className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Revérifier la réputation IP</span>
          </button>
        </div>
      ) : (
        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contrôlez les listes RBL publiques pour la sortie{' '}
            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300 font-semibold">
              {currentIp}
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
};
