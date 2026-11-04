import React, { useState } from 'react';
import {
  Check,
  X,
  Crown,
  ArrowLeft,
  Lock,
  CreditCard,
  ShieldCheck,
  Loader2,
  Coins,
  Wallet,
} from 'lucide-react';
import { PlanTier } from '../types';

export type PaymentSettlementMethod =
  | 'rnc_balance'
  | 'card'
  | 'paypal'
  | 'crypto';

interface Props {
  currentPlan: PlanTier;
  balance?: number;
  onUpgrade: (
    plan: PlanTier,
    method: PaymentSettlementMethod,
    rncCost?: number
  ) => Promise<boolean>;
  onClose: () => void;
}

type CheckoutStep = 'selection' | 'checkout' | 'authenticating' | 'success';

interface PlanSpec {
  id: PlanTier;
  name: string;
  subtitle: string;
  priceEur: string;
  rncCost: number;
  period: string;
  recommended?: boolean;
  features: string[];
}

const PLANS: PlanSpec[] = [
  {
    id: 'free',
    name: 'Starter',
    subtitle: 'Protection essentielle mono-relais',
    priceEur: '0,00 €',
    rncCost: 0,
    period: '/ mois',
    features: [
      'Tunnel chiffré Standard (1 saut)',
      '5 juridictions disponibles',
      'Coffre-fort local AES-256-GCM',
      'Coupe-circuit réseau standard',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Opérateur',
    subtitle: 'Multi-juridictions & rémunération relais RNC',
    priceEur: '4,99 €',
    rncCost: 2.0,
    period: '/ mois',
    recommended: true,
    features: [
      'Bande passante illimitée haute priorité',
      'Accès complet aux sanctuaires hors 14-Eyes',
      'Rémunération active en jetons RNC',
      'Mode Furtif Anti-DPI & Split Tunneling',
      '5 appareils simultanés',
    ],
  },
  {
    id: 'elite',
    name: 'Cyber Élite',
    subtitle: 'Routage Onion Vortex 3 sauts & KEX Post-Quantique',
    priceEur: '9,99 €',
    rncCost: 4.0,
    period: '/ mois',
    features: [
      'Orchestrateur Double Hop & Onion Vortex (3 sauts)',
      'Échange de clés hybride ML-KEM-1024',
      'Multiplicateur de rendement RNC maximal',
      'Retraits RNC instantanés prioritaires',
      'Appareils illimités & IP de sortie dédiée',
    ],
  },
];

export const PricingModal: React.FC<Props> = ({
  currentPlan,
  balance = 0,
  onUpgrade,
  onClose,
}) => {
  const [step, setStep] = useState<CheckoutStep>('selection');
  const [selectedPlanId, setSelectedPlanId] = useState<PlanTier | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentSettlementMethod>('card');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const selectedPlanData = PLANS.find((p) => p.id === selectedPlanId);

  const handleSelectPlan = (id: PlanTier) => {
    setCheckoutError(null);
    setSelectedPlanId(id);
    setStep('checkout');
  };

  const handlePaymentStart = async (method: PaymentSettlementMethod) => {
    if (!selectedPlanData) return;
    setCheckoutError(null);

    if (method === 'rnc_balance' && balance < selectedPlanData.rncCost) {
      setCheckoutError(
        `Solde RNC insuffisant : ${(selectedPlanData.rncCost - balance).toFixed(4)} RNC manquants pour régler ce forfait.`
      );
      return;
    }

    setPaymentMethod(method);
    setStep('authenticating');

    const success = await onUpgrade(
      selectedPlanData.id,
      method,
      method === 'rnc_balance' ? selectedPlanData.rncCost : undefined
    );
    if (success) {
      setStep('success');
      setTimeout(() => onClose(), 2000);
    } else {
      setCheckoutError('La validation du règlement a été interrompue.');
      setStep('checkout');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={step === 'authenticating' ? undefined : onClose}
      />

      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900">
          {step === 'checkout' ? (
            <button
              type="button"
              onClick={() => {
                setCheckoutError(null);
                setStep('selection');
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux forfaits</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span>Solde disponible : {balance.toFixed(4)} RNC</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {step === 'selection'
                ? 'Forfaits & licences opérateur'
                : step === 'success'
                  ? 'Licence activée'
                  : 'Règlement sécurisé'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={step === 'authenticating'}
            className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto custom-scrollbar p-6 sm:p-8 bg-white dark:bg-slate-950">
          {step === 'selection' && (
            <div className="space-y-6">
              <div className="text-center max-w-xl mx-auto">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Débloquez les circuits multi-sauts, la rémunération bande passante RNC et réglez votre abonnement par carte ou directement avec vos jetons RNC acquis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {PLANS.map((plan) => {
                  const isCurrent = currentPlan === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-2xl p-6 border flex flex-col justify-between transition-colors ${
                        isCurrent
                          ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20'
                          : plan.recommended
                            ? 'border-amber-500/60 bg-white dark:bg-slate-900'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {plan.name}
                          </h3>
                          {plan.recommended && (
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                              Recommandé
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                          {plan.subtitle}
                        </p>

                        <div className="pb-5 mb-5 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                              {plan.priceEur}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {plan.period}
                            </span>
                          </div>
                          {plan.rncCost > 0 ? (
                            <div className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                              ou {plan.rncCost.toFixed(2)} RNC depuis votre portefeuille
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 mt-1">
                              Inclus sans engagement
                            </div>
                          )}
                        </div>

                        <ul className="space-y-3 mb-7">
                          {plan.features.map((feature, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
                            >
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={isCurrent}
                        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
                            : plan.id === 'elite'
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        }`}
                      >
                        {isCurrent ? 'Forfait actuel' : `Choisir ${plan.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'checkout' && selectedPlanData && (
            <div className="max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-7 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                    Choisissez votre mode de règlement
                  </h3>

                  {/* Pay directly with earned RNC wallet balance */}
                  {selectedPlanData.rncCost > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePaymentStart('rnc_balance')}
                      className={`w-full p-4 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        balance >= selectedPlanData.rncCost
                          ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-50 dark:hover:bg-amber-500/15'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            Payer avec mon solde RNC
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            Disponible : {balance.toFixed(4)} RNC · Sans frais réseau
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
                        {selectedPlanData.rncCost.toFixed(2)} RNC
                      </span>
                    </button>
                  )}

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => handlePaymentStart('card')}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-500/60 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          Carte bancaire (3D Secure)
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Visa, Mastercard, CB · Activation immédiate
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {selectedPlanData.priceEur}
                    </span>
                  </button>

                  {/* PayPal */}
                  <button
                    type="button"
                    onClick={() => handlePaymentStart('paypal')}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-500/60 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-xs font-mono">
                        PP
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          PayPal Express
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Facturation mensuelle sans partage de coordonnées carte
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {selectedPlanData.priceEur}
                    </span>
                  </button>

                  {/* Crypto On-chain */}
                  <button
                    type="button"
                    onClick={() => handlePaymentStart('crypto')}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-500/60 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          Crypto externe (USDT / USDC / Lightning)
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Règlement pseudonyme sans trace bancaire
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {selectedPlanData.priceEur}
                    </span>
                  </button>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400">
                      {checkoutError}
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="md:col-span-5 bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Récapitulatif de licence
                    </h4>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Forfait sélectionné
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedPlanData.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Période d’activation
                        </span>
                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          30 jours renouvelables
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Équivalent RNC
                        </span>
                        <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                          {selectedPlanData.rncCost.toFixed(2)} RNC
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex justify-between items-baseline">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        Total TTC
                      </span>
                      <span className="text-2xl font-extrabold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                        {selectedPlanData.priceEur}
                      </span>
                    </div>
                  </div>

                  <div className="pt-5 mt-5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-500" />
                      TLS 1.3
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
                      Zéro journalisation
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'authenticating' && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-600 dark:text-cyan-400" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {paymentMethod === 'rnc_balance'
                    ? 'Débit atomique du portefeuille RNC...'
                    : 'Validation cryptographique du règlement...'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Mise à jour des droits multi-relais de votre profil opérateur.
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Forfait {selectedPlanData?.name} activé
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                  Vos privilèges de routage et de rémunération RNC sont immédiatement actifs sur l’ensemble du cockpit.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
