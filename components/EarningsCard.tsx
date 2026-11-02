import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  TrendingUp,
  Lock,
  Wallet,
  History,
  Sparkles,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Globe,
  ArrowRight,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { PlanTier, Transaction, AppSettings } from '../types';
import {
  WITHDRAWAL_RAIL_SPECS,
  computeRncEarningRate,
  formatFiatValue,
  validateWithdrawalDestination,
} from '../constants';

interface Props {
  isConnected: boolean;
  plan: PlanTier;
  isVerified: boolean;
  balance: number;
  reputation?: number;
  onUpgrade: () => void;
  onVerify: () => void;
  onWithdraw: () => void;
  onShowTransactions?: () => void;
  transactions?: Transaction[];
  settings?: AppSettings;
}

export const EarningsCard: React.FC<Props> = ({
  isConnected,
  plan,
  isVerified,
  balance,
  reputation = 100,
  onUpgrade,
  onVerify,
  onWithdraw,
  onShowTransactions,
  transactions = [],
  settings,
}) => {
  const [networkLoad, setNetworkLoad] = useState(44);
  const isPremium = plan !== 'free';
  const isEarning =
    isConnected &&
    isPremium &&
    isVerified &&
    (settings?.miningIntensity ?? 50) > 0;

  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setNetworkLoad((prev) =>
          Math.max(15, Math.min(98, prev + (Math.random() * 8 - 4)))
        );
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const ratePerSec = useMemo(
    () =>
      computeRncEarningRate({
        plan,
        isVerified,
        isConnected,
        settings: {
          miningIntensity: settings?.miningIntensity ?? 50,
          yieldOptimizationIA: settings?.yieldOptimizationIA ?? true,
          contributionType: settings?.contributionType ?? 'passive',
        },
        reputation,
        networkLoad,
      }),
    [
      plan,
      isVerified,
      isConnected,
      settings?.miningIntensity,
      settings?.yieldOptimizationIA,
      settings?.contributionType,
      reputation,
      networkLoad,
    ]
  );

  const potentialDailyGain = (ratePerSec * 86400).toFixed(2);
  const reputationMultiplier = (1 + (reputation / 100) * 0.42).toFixed(2);
  const preferredFiat = settings?.preferredFiat || 'EUR';

  const autoThreshold = settings?.autoWithdrawThreshold || 5;
  const thresholdProgress = Math.min(
    100,
    Math.round((balance / Math.max(0.25, autoThreshold)) * 100)
  );

  const autoRailSpec = settings?.autoWithdrawSubNetwork
    ? WITHDRAWAL_RAIL_SPECS[settings.autoWithdrawSubNetwork]
    : WITHDRAWAL_RAIL_SPECS.polygon;

  const autoDestValid = useMemo(() => {
    if (!settings?.autoWithdraw) return true;
    return validateWithdrawalDestination(
      settings.autoWithdrawMethod || 'crypto',
      settings.autoWithdrawSubNetwork || 'polygon',
      settings.autoWithdrawAddress || ''
    ).valid;
  }, [
    settings?.autoWithdraw,
    settings?.autoWithdrawMethod,
    settings?.autoWithdrawSubNetwork,
    settings?.autoWithdrawAddress,
  ]);

  const processingCount = useMemo(
    () => transactions.filter((t) => t.status === 'processing').length,
    [transactions]
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl border ${
              isEarning
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-500'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Portefeuille &amp; gains RNC
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Contribution bande passante{' '}
              {settings?.contributionType
                ? `(${settings.contributionType === 'exit' ? 'Sortie' : settings.contributionType === 'relay' ? 'Relais' : 'Passif'})`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onShowTransactions && (
            <button
              type="button"
              onClick={onShowTransactions}
              title="Grand livre des retraits RNC"
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              {transactions.length > 0 && <span>{transactions.length}</span>}
            </button>
          )}
          {isEarning && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <Sparkles className="w-3 h-3" />
              Actif
            </span>
          )}
        </div>
      </div>

      {/* Balance Display */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono tabular-nums font-extrabold text-slate-900 dark:text-white tracking-tight">
              {balance.toFixed(4)}
            </span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
              RNC
            </span>
          </div>
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-mono tabular-nums font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+{ratePerSec.toFixed(6)}/s</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-mono tabular-nums">
          <span>≈ {formatFiatValue(balance, preferredFiat)}</span>
          <span>Intensité : {settings?.miningIntensity ?? 50}%</span>
        </div>

        {settings?.autoWithdraw && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 truncate">
                <RefreshCw className="w-3 h-3 text-emerald-500 shrink-0" />
                Auto ({autoRailSpec?.shortLabel || 'Crypto'} · {autoThreshold} RNC)
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">
                {thresholdProgress}%
              </span>
            </div>
            <svg className="w-full h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 block">
              <rect
                x="0"
                y="0"
                width={`${thresholdProgress}%`}
                height="100%"
                rx="3"
                fill={autoDestValid ? '#10b981' : '#f59e0b'}
              />
            </svg>
            {!autoDestValid && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400">
                Adresse cible manquante ou invalide — configurez-la dans Retrait.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Queue Notification */}
      {processingCount > 0 && onShowTransactions && (
        <button
          type="button"
          onClick={onShowTransactions}
          className="w-full p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Clock className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>
              {processingCount} retrait{processingCount > 1 ? 's' : ''} en file de compensation
            </span>
          </span>
          <span className="font-mono text-[11px] underline shrink-0">
            Gérer
          </span>
        </button>
      )}

      {/* Tier / Verification Body */}
      {isPremium ? (
        isVerified ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  <Globe className="w-3.5 h-3.5 text-cyan-500" />
                  Demande réseau actuelle
                </span>
                <span className="font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                  {Math.round(networkLoad)}%
                </span>
              </div>
              <svg className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 block">
                <rect
                  x="0"
                  y="0"
                  width={`${Math.round(networkLoad)}%`}
                  height="100%"
                  rx="3"
                  fill="#06b6d4"
                />
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">
                  Gain estimé / 24h
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    +{potentialDailyGain} RNC
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">
                  Bonus réputation
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    ×{reputationMultiplier}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onWithdraw}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                balance >= 0.1
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>
                {balance >= 0.1
                  ? 'Retirer / Modes de retrait RNC'
                  : 'Configurer modes & Auto-Retrait'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        ) : (
          <div className="p-5 bg-amber-500/5 rounded-xl border border-dashed border-amber-500/30 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Vérification d&apos;opérateur requise
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Validez votre preuve KYC pour activer les retraits multi-réseaux et recevoir votre prime d&apos;opérateur (+2.5000 RNC).
              </p>
            </div>
            <button
              type="button"
              onClick={onVerify}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
            >
              Vérifier mon profil (+2.50 RNC)
            </button>
          </div>
        )
      ) : (
        <div className="p-5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Contribution RNC verrouillée
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Passez au forfait Pro ou Élite pour partager votre bande passante et débloquer le terminal de retrait.
            </p>
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            Découvrir les forfaits Pro / Élite
          </button>
        </div>
      )}

      {!isConnected && isPremium && isVerified && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <Activity className="w-4 h-4 shrink-0" />
          <span>
            Connectez le tunnel VPN pour accumuler des RNC en temps réel.
          </span>
        </div>
      )}
    </div>
  );
};
