import React from 'react';
import { Check, X, Zap, Shield, Crown } from 'lucide-react';
import { PlanTier } from '../types';

interface Props {
  currentPlan: PlanTier;
  onUpgrade: (plan: PlanTier) => void;
  onClose: () => void;
}

export const PricingModal: React.FC<Props> = ({ currentPlan, onUpgrade, onClose }) => {
  const plans = [
    {
      id: 'free' as PlanTier,
      name: 'Starter',
      price: '0€',
      period: '/mois',
      features: ['Vitesse Standard', '5 Pays', '1 Appareil', 'Logs Basiques'],
      notIncluded: ['Double Hop', 'Streaming', 'AdBlocker', 'Support 24/7'],
      color: 'slate'
    },
    {
      id: 'pro' as PlanTier,
      name: 'Pro',
      price: '4.99€',
      period: '/mois',
      features: ['Vitesse Illimitée', '50+ Pays', '5 Appareils', 'Mode Furtif', 'Streaming 4K'],
      notIncluded: ['Double Hop', 'Support Prioritaire'],
      color: 'brand',
      popular: true
    },
    {
      id: 'elite' as PlanTier,
      name: 'Cyber Elite',
      price: '9.99€',
      period: '/mois',
      features: ['Tout Illimité', '100+ Pays', 'Appareils Illimités', 'Double Hop', 'AdBlocker AI', 'IP Dédiée'],
      notIncluded: [],
      color: 'emerald'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
              <Crown className="w-8 h-8 text-amber-500" />
              <span className="bg-gradient-to-r from-amber-500 to-brand-500 bg-clip-text text-transparent">
                Upgrade Your Identity
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400">Débloquez la puissance maximale de l'anonymat numérique.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const isPopular = (plan as any).popular;

              return (
                <div 
                  key={plan.id}
                  className={`relative rounded-2xl p-6 border-2 transition-all duration-300 ${
                    isCurrent 
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10' 
                      : isPopular
                        ? 'border-amber-400 dark:border-amber-500/50 hover:border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg">
                      Populaire
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{plan.price}</span>
                      <span className="text-slate-500">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <div className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3 h-3" />
                        </div>
                        {feature}
                      </li>
                    ))}
                    {plan.notIncluded.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500 opacity-60">
                        <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800">
                          <X className="w-3 h-3" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => onUpgrade(plan.id)}
                    disabled={isCurrent}
                    className={`w-full py-3 rounded-xl font-bold transition-all ${
                      isCurrent
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-default'
                        : plan.id === 'elite'
                          ? 'bg-gradient-to-r from-emerald-500 to-brand-500 hover:from-emerald-400 hover:to-brand-400 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                    }`}
                  >
                    {isCurrent ? 'Plan Actuel' : 'Choisir ce plan'}
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 text-center">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 underline">
              Non merci, je garde mon identité limitée
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
