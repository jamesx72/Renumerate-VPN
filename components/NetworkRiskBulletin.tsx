import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe,
  Search,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUpRight,
  Lock,
  Loader2,
  Radar,
} from 'lucide-react';
import { AppSettings, ConnectionMode } from '../types';
import { computeSettingsHardeningScore } from '../constants';
import {
  fetchNetworkRiskBulletin,
  computeAdaptiveSecurityRecommendations,
  NetworkRiskBulletinResult,
  RiskBulletinTopic,
} from '../services/geminiService';

export interface NetworkRiskBulletinProps {
  settings: AppSettings;
  mode: ConnectionMode;
  location: string;
  onApplyPatch: (patch: Partial<AppSettings>, reason?: string) => void;
  onFullSystemHardening?: () => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

const TOPIC_TABS: Array<{ id: RiskBulletinTopic; label: string }> = [
  { id: 'global', label: 'Menace Mondiale' },
  { id: 'vpn_tunnel', label: 'VPN & Tunnels' },
  { id: 'zero_day', label: 'Zero-Day / CVE' },
  { id: 'dns_bgp', label: 'DNS & BGP' },
];

export const NetworkRiskBulletin: React.FC<NetworkRiskBulletinProps> = ({
  settings,
  mode,
  location,
  onApplyPatch,
  onFullSystemHardening,
  addLog,
}) => {
  const [topic, setTopic] = useState<RiskBulletinTopic>('global');
  const [bulletin, setBulletin] = useState<NetworkRiskBulletinResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedPatchIds, setAppliedPatchIds] = useState<Record<string, boolean>>(
    {}
  );

  const hardeningScore = useMemo(
    () => computeSettingsHardeningScore(settings),
    [settings]
  );

  const missingControlsList = useMemo(() => {
    const missing: string[] = [];
    if (!settings.killSwitch || settings.killSwitchMode !== 'strict') {
      missing.push('Kill Switch Strict');
    }
    if (!settings.dnsLeakProtection) missing.push('Protection DNS');
    if (!settings.ipv6LeakProtection) missing.push('Bouclier IPv6');
    if (!settings.webrtcLeakShield) missing.push('Bouclier WebRTC');
    if (settings.postQuantumKex !== 'ml-kem-1024') missing.push('PQC ML-KEM-1024');
    if (!settings.idsEnabled || settings.idsSensitivity !== 'paranoid') {
      missing.push('Sentinelle IDS Paranoïaque');
    }
    if (!settings.blockQuicUdp443) missing.push('Filtrage QUIC UDP/443');
    if (settings.trafficPaddingJitterMs === 0) missing.push('Brouillage Chaff');
    if (settings.excludeEyesJurisdictions !== '14-eyes') {
      missing.push('Exclusion 14-Eyes');
    }
    return missing;
  }, [settings]);

  const loadBulletin = useCallback(
    async (selectedTopic: RiskBulletinTopic, forceRefresh = false) => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetchNetworkRiskBulletin({
          hardeningScore,
          topic: selectedTopic,
          location,
          mode,
          protocol: settings.protocol,
          missingControls: missingControlsList,
          forceRefresh,
        });
        setBulletin(res);
        if (forceRefresh) {
          addLog?.(
            `Bulletin de Risque Réseau actualisé (${res.globalThreatLevel} · ${res.threatIndex}/100) via ${
              res.engine === 'gemini-search'
                ? 'Recherche Google en direct'
                : 'Moteur heuristique local'
            }`,
            res.globalThreatLevel === 'Critique' ? 'warning' : 'info'
          );
        }
      } catch {
        setErrorMsg(
          'Impossible de récupérer le bulletin distant pour le moment.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      hardeningScore,
      location,
      mode,
      settings.protocol,
      missingControlsList,
      addLog,
    ]
  );

  useEffect(() => {
    loadBulletin(topic, false);
    // Intentionally fetch when topic changes or on initial mount; adaptive recs update locally in real time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const adaptiveRecommendations = useMemo(
    () =>
      computeAdaptiveSecurityRecommendations(
        settings,
        hardeningScore,
        bulletin?.globalThreatLevel || 'Élevé'
      ),
    [settings, hardeningScore, bulletin?.globalThreatLevel]
  );

  const postureEvaluation = useMemo(() => {
    const threatIdx = bulletin?.threatIndex ?? 72;
    const margin = hardeningScore - threatIdx;

    if (hardeningScore < 55) {
      return {
        tierLabel: 'Posture Exposée',
        summary:
          'Votre score de durcissement est inférieur au seuil de sûreté face au niveau de menace mondial. Appliquez les remédiations urgentes ci-dessous.',
        toneClass: 'text-rose-600 dark:text-rose-400',
        barClass: 'bg-rose-500',
        marginLabel: `${margin >= 0 ? '+' : ''}${margin} pts vs menace`,
      };
    }
    if (hardeningScore < 80) {
      return {
        tierLabel: 'Posture Intermédiaire',
        summary:
          'Protection de base active, mais plusieurs vecteurs critiques (PQC, anti-DPI ou IDS) restent perfectibles face aux campagnes réseau actuelles.',
        toneClass: 'text-amber-600 dark:text-amber-400',
        barClass: 'bg-amber-500',
        marginLabel: `${margin >= 0 ? '+' : ''}${margin} pts vs menace`,
      };
    }
    if (hardeningScore < 95) {
      return {
        tierLabel: 'Posture Durcie',
        summary:
          'Défenses solides. Finalisez les paramètres anti-corrélation et la restriction sanctuaire pour atteindre le niveau Forteresse.',
        toneClass: 'text-cyan-600 dark:text-cyan-400',
        barClass: 'bg-cyan-500',
        marginLabel: `${margin >= 0 ? '+' : ''}${margin} pts vs menace`,
      };
    }
    return {
      tierLabel: 'Posture Forteresse',
      summary:
        'Alignement maximal : votre configuration absorbe les vecteurs de menace mondiaux recensés dans le bulletin.',
      toneClass: 'text-emerald-600 dark:text-emerald-400',
      barClass: 'bg-emerald-500',
      marginLabel: `${margin >= 0 ? '+' : ''}${margin} pts vs menace`,
    };
  }, [hardeningScore, bulletin?.threatIndex]);

  const threatTone = useMemo(() => {
    const level = bulletin?.globalThreatLevel || 'Élevé';
    if (level === 'Critique') {
      return {
        text: 'text-rose-600 dark:text-rose-400',
        stroke: '#f43f5e',
        surface: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60',
      };
    }
    if (level === 'Élevé') {
      return {
        text: 'text-amber-600 dark:text-amber-400',
        stroke: '#f59e0b',
        surface: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60',
      };
    }
    if (level === 'Modéré') {
      return {
        text: 'text-cyan-600 dark:text-cyan-400',
        stroke: '#06b6d4',
        surface: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900/60',
      };
    }
    return {
      text: 'text-emerald-600 dark:text-emerald-400',
      stroke: '#10b981',
      surface: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60',
    };
  }, [bulletin?.globalThreatLevel]);

  const threatGaugeOffset = useMemo(() => {
    const pct = Math.max(5, Math.min(100, bulletin?.threatIndex ?? 72));
    const circumference = 2 * Math.PI * 30;
    return circumference - (pct / 100) * circumference;
  }, [bulletin?.threatIndex]);

  const handleApplyRecommendation = (
    recId: string,
    title: string,
    patch?: Partial<AppSettings>
  ) => {
    if (!patch) return;
    onApplyPatch(patch, `Bulletin Risque · ${title}`);
    setAppliedPatchIds((prev) => ({ ...prev, [recId]: true }));
    addLog?.(`Remédiation adaptative appliquée : ${title}`, 'success');
  };

  const formattedTime = useMemo(() => {
    if (!bulletin?.observedAt) return 'Instant T';
    try {
      return new Date(bulletin.observedAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Instant T';
    }
  }, [bulletin?.observedAt]);

  return (
    <section
      id="network-risk-bulletin"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
    >
      {/* Header & Interactive Topic Segmented Filter */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Radar className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Bulletin de Risque Réseau
            </h2>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {bulletin?.engine === 'gemini-search'
                ? 'API Recherche Google en direct'
                : 'Veille & Corrélation Heuristique'}
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              MàJ {formattedTime}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Corrélation du niveau de menace cybernétique mondial avec votre score de durcissement ({hardeningScore}/100).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
            {TOPIC_TABS.map((tab) => {
              const active = topic === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTopic(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => loadBulletin(topic, true)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>{isLoading ? 'Recherche...' : 'Actualiser'}</span>
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 space-y-5">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => loadBulletin(topic, true)}
              className="font-semibold underline cursor-pointer shrink-0"
            >
              Réessayer
            </button>
          </div>
        )}

        {bulletin?.quotaNotice && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{bulletin.quotaNotice}</span>
          </div>
        )}

        {/* Top Split: World Threat Gauge + Hardening Posture Correlation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Global Threat Index Panel */}
          <div className={`lg:col-span-7 rounded-xl border p-4 flex flex-col justify-between gap-3 ${threatTone.surface}`}>
            {isLoading && !bulletin ? (
              <div className="py-8 flex items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                <span>Interrogation de l’API de recherche cybernétique mondiale...</span>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  {/* Radial Threat SVG Meter */}
                  <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 72 72" className="w-20 h-20 -rotate-90">
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeWidth="6"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke={threatTone.stroke}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 30}
                        strokeDashoffset={threatGaugeOffset}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                        {bulletin?.threatIndex ?? 74}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        /100
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-bold flex items-center gap-1 ${threatTone.text}`}>
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>Menace mondiale : {bulletin?.globalThreatLevel || 'Élevé'}</span>
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {TOPIC_TABS.find((t) => t.id === topic)?.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {bulletin?.headline ||
                        'Analyse du niveau de menace cybernétique mondial'}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {bulletin?.summary}
                    </p>
                  </div>
                </div>

                {/* Search Queries Used */}
                {bulletin?.searchQueries && bulletin.searchQueries.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <Globe className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span className="font-medium">Requêtes Search :</span>
                    <span className="font-mono truncate max-w-full">
                      {bulletin.searchQueries.join(' · ')}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Local Hardening Posture Correlation Panel */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Durcissement Système Actuel</span>
                </span>
                <span className={`font-bold font-mono tabular-nums ${postureEvaluation.toneClass}`}>
                  {hardeningScore}/100
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${postureEvaluation.barClass}`}
                  style={{ width: `${hardeningScore}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${postureEvaluation.toneClass}`}>
                  {postureEvaluation.tierLabel}
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {postureEvaluation.marginLabel}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                {postureEvaluation.summary}
              </p>
            </div>

            {hardeningScore < 100 && onFullSystemHardening ? (
              <button
                type="button"
                onClick={onFullSystemHardening}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Durcir le système à 100/100</span>
              </button>
            ) : (
              <div className="py-2 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Conformité maximale 100/100 atteinte</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Threat Vectors Grounded by Search */}
        {bulletin && bulletin.activeThreats.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Signaux de Menace Actifs ({bulletin.activeThreats.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Classés par criticité réseau
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {bulletin.activeThreats.slice(0, 3).map((alert) => {
                const sevClass =
                  alert.severity === 'critique'
                    ? 'text-rose-600 dark:text-rose-400'
                    : alert.severity === 'élevée'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-cyan-600 dark:text-cyan-400';
                return (
                  <div
                    key={alert.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-1.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={`font-bold uppercase ${sevClass}`}>
                          {alert.severity}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 truncate">
                          {alert.cveOrRef || alert.category}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {alert.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {alert.summary}
                      </p>
                    </div>
                    <div className="pt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Vecteur : {alert.category}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Adaptive Security Recommendations Engine (Reactive to hardeningScore) */}
        <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>
                Recommandations Adaptatives (Score {hardeningScore}/100 ·{' '}
                {postureEvaluation.tierLabel})
              </span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {missingControlsList.length} écart{missingControlsList.length > 1 ? 's' : ''} détecté
              {missingControlsList.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {adaptiveRecommendations.map((rec) => {
              const prioColor =
                rec.priority === 'urgente'
                  ? 'text-rose-600 dark:text-rose-400'
                  : rec.priority === 'haute'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400';

              return (
                <div
                  key={rec.id}
                  className="p-3.5 bg-white dark:bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`font-bold uppercase ${prioColor}`}>
                        Priorité {rec.priority}
                      </span>
                      {rec.scoreGain > 0 && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                            +{rec.scoreGain} pts durcissement
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {rec.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {rec.rationale}
                    </p>
                  </div>

                  {rec.settingsPatch ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyRecommendation(
                          rec.id,
                          rec.title,
                          rec.settingsPatch
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>
                        {appliedPatchIds[rec.id] ? 'Réappliquer' : 'Appliquer'}
                      </span>
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Conforme</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Threat-Grounded Search Recommendations */}
          {bulletin?.searchRecommendations &&
            bulletin.searchRecommendations.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Directives issues de la veille Search :
                </div>
                <ul className="space-y-1">
                  {bulletin.searchRecommendations.map((line, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2"
                    >
                      <RefreshCw className="w-3 h-3 text-cyan-500 shrink-0 mt-1" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        {/* Grounding Web Sources from Google Search */}
        {bulletin && bulletin.sources.length > 0 && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-500" />
              <span>Sources vérifiées via Google Search ({bulletin.sources.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {bulletin.sources.map((src, idx) => (
                <a
                  key={idx}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors flex items-center justify-between gap-2 group"
                >
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                    {src.title}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-cyan-500 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
