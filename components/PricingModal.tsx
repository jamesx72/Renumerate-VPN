import React, { useState } from 'react';
import { Check, X, Crown, ArrowLeft, Lock, CreditCard, ShieldCheck, CheckCircle, Loader2 } from 'lucide-react';
import { PlanTier } from '../types';

interface Props {
  currentPlan: PlanTier;
  onUpgrade: (plan: PlanTier) => void;
  onClose: () => void;
}

type CheckoutStep = 'selection' | 'checkout' | 'processing' | 'success';

export const PricingModal: React.FC<Props> = ({ currentPlan, onUpgrade, onClose }) => {
  const [step, setStep] = useState<CheckoutStep>('selection');
  const [selectedPlanId, setSelectedPlanId] = useState<PlanTier | null>(null);

  const plans = [
    {
      id: 'free' as PlanTier,
      name: 'Starter',
      price: '0.00€',
      rawPrice: 0,
      period: '/mois',
      features: ['Vitesse Standard', '5 Pays', '1 Appareil', 'Logs Basiques'],
      notIncluded: ['Double Hop', 'Streaming', 'AdBlocker', 'Support 24/7'],
      color: 'slate'
    },
    {
      id: 'pro' as PlanTier,
      name: 'Pro',
      price: '4.99€',
      rawPrice: 4.99,
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
      rawPrice: 9.99,
      period: '/mois',
      features: ['Tout Illimité', '100+ Pays', 'Appareils Illimités', 'Double Hop', 'AdBlocker AI', 'IP Dédiée'],
      notIncluded: [],
      color: 'emerald'
    }
  ];

  const handleSelectPlan = (id: PlanTier) => {
    setSelectedPlanId(id);
    setStep('checkout');
  };

  const handlePayment = (method: 'paypal' | 'card') => {
    setStep('processing');
    
    // Intégration PayPal : Redirection vers la page de paiement
    if (method === 'paypal' && selectedPlanId) {
        const plan = plans.find(p => p.id === selectedPlanId);
        if (plan && plan.rawPrice > 0) {
            // Construction de l'URL de paiement PayPal standard
            // Ajout de no_shipping=1 pour indiquer qu'il s'agit de biens numériques
            const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=papaoumar72@gmail.com&item_name=${encodeURIComponent(`RenumerateVPN ${plan.name} Subscription`)}&amount=${plan.rawPrice}&currency_code=EUR&no_shipping=1&no_note=1&return=${encodeURIComponent(window.location.href)}`;
            
            // Ouverture dans un nouvel onglet
            window.open(paypalUrl, '_blank');
        }
    }

    // Simulation de la validation du paiement pour l'UX (Optimistic UI)
    // Dans un environnement de production, on attendrait la confirmation webhook (IPN)
    setTimeout(() => {
        if (selectedPlanId) {
            onUpgrade(selectedPlanId);
            setStep('success');
            
            // Fermeture automatique après succès
            setTimeout(() => {
                onClose();
            }, 2000);
        }
    }, 5000); // Délai prolongé pour permettre à l'utilisateur de compléter le paiement
  };

  const selectedPlanData = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={step === 'processing' ? undefined : onClose} />
      
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center relative z-10">
            {step === 'checkout' && (
                <button 
                    onClick={() => setStep('selection')}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour
                </button>
            )}
            
            {step === 'selection' && <div className="w-16"></div>} {/* Spacer */}

            <h2 className="text-xl font-bold flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-500" />
              <span className="bg-gradient-to-r from-amber-500 to-brand-500 bg-clip-text text-transparent">
                {step === 'selection' ? 'Upgrade Your Identity' : step === 'success' ? 'Paiement Réussi' : 'Caisse Sécurisée'}
              </span>
            </h2>

            <button onClick={onClose} disabled={step === 'processing'} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar p-8">
          
          {/* STEP 1: SELECTION */}
          {step === 'selection' && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-10">
                    <p className="text-slate-500 dark:text-slate-400">Débloquez la puissance maximale de l'anonymat numérique.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                    const isCurrent = currentPlan === plan.id;
                    const isPopular = (plan as any).popular;

                    return (
                        <div 
                        key={plan.id}
                        className={`relative rounded-2xl p-6 border-2 transition-all duration-300 flex flex-col ${
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

                        <ul className="space-y-3 mb-8 flex-1">
                            {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                <div className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <Check className="w-3 h-3" />
                                </div>
                                {feature}
                            </li>
                            ))}
                            {plan.notIncluded.map((feature, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500 opacity-60">
                                <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0">
                                <X className="w-3 h-3" />
                                </div>
                                {feature}
                            </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => handleSelectPlan(plan.id)}
                            disabled={isCurrent}
                            className={`w-full py-3 rounded-xl font-bold transition-all ${
                            isCurrent
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-default'
                                : plan.id === 'elite'
                                ? 'bg-gradient-to-r from-emerald-500 to-brand-500 hover:from-emerald-400 hover:to-brand-400 text-white shadow-lg shadow-emerald-500/25 transform hover:scale-[1.02]'
                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transform hover:scale-[1.02]'
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
          )}

          {/* STEP 2: CHECKOUT */}
          {step === 'checkout' && selectedPlanData && (
              <div className="max-w-2xl mx-auto animate-in slide-in-from-right-8 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                      {/* Summary */}
                      <div className="md:col-span-3 space-y-6">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Moyen de paiement</h3>
                          
                          {/* PayPal Button */}
                          <button 
                            onClick={() => handlePayment('paypal')}
                            className="w-full bg-[#FFC439] hover:bg-[#F4BB2E] text-slate-900 h-14 rounded-xl flex items-center justify-center transition-transform hover:scale-[1.01] shadow-sm relative overflow-hidden group"
                          >
                             <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                             <span className="italic font-bold text-xl relative z-10 flex items-center gap-1">
                                <span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span>
                             </span>
                          </button>

                          <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">Ou payer par carte</span>
                            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                          </div>

                          {/* Card Button (Mockup) */}
                          <button 
                             onClick={() => handlePayment('card')}
                             className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white h-14 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm"
                          >
                             <CreditCard className="w-5 h-5" />
                             <span className="font-bold">Carte Bancaire</span>
                          </button>
                          
                          <div className="flex items-center justify-center gap-4 text-slate-400 mt-4">
                              <div className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                  <Lock className="w-3 h-3" />
                                  SSL Secure
                              </div>
                              <div className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                  <ShieldCheck className="w-3 h-3" />
                                  Chiffrement 256-bit
                              </div>
                          </div>
                      </div>

                      {/* Order Details */}
                      <div className="md:col-span-2">
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Récapitulatif</h4>
                              
                              <div className="flex justify-between items-center mb-2 text-sm">
                                  <span className="text-slate-500">Plan {selectedPlanData.name}</span>
                                  <span className="font-medium text-slate-900 dark:text-white">{selectedPlanData.price}</span>
                              </div>
                              <div className="flex justify-between items-center mb-4 text-sm">
                                  <span className="text-slate-500">Taxes</span>
                                  <span className="font-medium text-slate-900 dark:text-white">0.00€</span>
                              </div>
                              
                              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                                  <div className="flex justify-between items-center">
                                      <span className="font-bold text-slate-900 dark:text-white">Total</span>
                                      <span className="text-2xl font-bold text-brand-500">{selectedPlanData.price}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1 text-right">Facturé mensuellement</p>
                              </div>

                              <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                                  <div className="flex gap-2">
                                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                      <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-tight">
                                          Garantie satisfait ou remboursé de 30 jours incluse.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* STEP 3: PROCESSING */}
          {step === 'processing' && (
              <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-300">
                  <div className="relative">
                      <div className="w-20 h-20 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                      <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                      <Lock className="absolute inset-0 m-auto w-6 h-6 text-brand-500" />
                  </div>
                  <h3 className="text-xl font-bold mt-6 text-slate-900 dark:text-white">Traitement sécurisé...</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Nous contactons la banque. Ne fermez pas cette fenêtre.</p>
              </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
              <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 text-emerald-500 shadow-lg shadow-emerald-500/20">
                      <Check className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Bienvenue au club {selectedPlanData?.name} !</h3>
                  <p className="text-slate-500 dark:text-slate-400">Votre compte a été mis à niveau avec succès.</p>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};