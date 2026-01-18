
import React, { useState } from 'react';
import { Check, X, Crown, ArrowLeft, Lock, CreditCard, ShieldCheck, CheckCircle, Loader2, Coins, Search, Fingerprint, ShieldAlert, Globe } from 'lucide-react';
import { PlanTier } from '../types';

interface Props {
  currentPlan: PlanTier;
  onUpgrade: (plan: PlanTier, method: string) => Promise<boolean>;
  onClose: () => void;
}

type CheckoutStep = 'selection' | 'checkout' | 'authenticating' | 'success';

export const PricingModal: React.FC<Props> = ({ currentPlan, onUpgrade, onClose }) => {
  const [step, setStep] = useState<CheckoutStep>('selection');
  const [selectedPlanId, setSelectedPlanId] = useState<PlanTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'card' | 'crypto'>('card');

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

  const handlePaymentStart = async (method: 'paypal' | 'card' | 'crypto') => {
    setPaymentMethod(method);
    
    if (method === 'crypto') {
        // Redirection externe directe
        await onUpgrade(selectedPlanId!, 'crypto');
        onClose();
        return;
    }

    setStep('authenticating');
    
    // Appel du handler de l'application parente pour l'authentification
    const success = await onUpgrade(selectedPlanId!, method);
    if (success) {
      setStep('success');
      setTimeout(() => onClose(), 2500);
    } else {
      setStep('checkout'); // Retour en cas d'échec
    }
  };

  const selectedPlanData = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={step === 'authenticating' ? undefined : onClose} />
      
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            {step === 'checkout' ? (
                <button 
                    onClick={() => setStep('selection')}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour
                </button>
            ) : <div className="w-20"></div>}

            <div className="flex flex-col items-center">
                <h2 className="text-xl font-black flex items-center gap-2 uppercase tracking-[0.2em]">
                  <Crown className="w-6 h-6 text-amber-500 animate-pulse" />
                  <span className="bg-gradient-to-r from-amber-500 to-brand-500 bg-clip-text text-transparent">
                    {step === 'selection' ? 'RE-NUMÉROTEZ VOTRE PLAN' : step === 'success' ? 'TRANSACTION VALIDÉE' : 'VÉRIFICATION SÉCURISÉE'}
                  </span>
                </h2>
            </div>

            <button onClick={onClose} disabled={step === 'authenticating'} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar p-8 bg-white dark:bg-slate-950">
          
          {step === 'selection' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-12">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                        Débloquez l'accès aux nœuds Elite, au Double-Hop et commencez à accumuler des RNC pour chaque paquet relayé.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan) => {
                    const isCurrent = currentPlan === plan.id;
                    const isPopular = plan.popular;

                    return (
                        <div 
                        key={plan.id}
                        className={`relative rounded-[2rem] p-8 border-2 transition-all duration-500 flex flex-col group ${
                            isCurrent 
                            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10' 
                            : isPopular
                                ? 'border-amber-400 dark:border-amber-500/50 hover:border-amber-500 shadow-xl shadow-amber-500/5'
                                : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                        >
                        {isPopular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                            LE PLUS RECOMMANDÉ
                            </div>
                        )}

                        <div className="mb-8">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 uppercase tracking-widest">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{plan.price}</span>
                            <span className="text-slate-400 font-bold">{plan.period}</span>
                            </div>
                        </div>

                        <ul className="space-y-4 mb-10 flex-1">
                            {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                                <Check className="w-3.5 h-3.5" />
                                </div>
                                {feature}
                            </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => handleSelectPlan(plan.id)}
                            disabled={isCurrent}
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] transition-all ${
                            isCurrent
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
                                : plan.id === 'elite'
                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/30 active:scale-95'
                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 active:scale-95 shadow-xl'
                            }`}
                        >
                            {isCurrent ? 'Plan Actif' : 'Sélectionner'}
                        </button>
                        </div>
                    );
                    })}
                </div>
            </div>
          )}

          {step === 'checkout' && selectedPlanData && (
              <div className="max-w-3xl mx-auto animate-in slide-in-from-right-8 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Passerelle Sécurisée</h3>
                          
                          <button 
                            onClick={() => handlePaymentStart('paypal')}
                            className="w-full bg-[#FFC439] hover:bg-[#F4BB2E] text-slate-900 h-16 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95"
                          >
                             <span className="italic font-bold text-2xl flex items-center gap-1">
                                <span className="text-[#003087]">Pay</span><span className="text-[#009cde]">Pal</span>
                             </span>
                          </button>

                          <button 
                             onClick={() => handlePaymentStart('card')}
                             className="w-full bg-slate-900 dark:bg-slate-100 hover:opacity-90 text-white dark:text-slate-900 h-16 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95"
                          >
                             <CreditCard className="w-5 h-5" />
                             <span className="font-black text-xs uppercase tracking-widest">Carte Bancaire</span>
                          </button>

                          <button 
                             onClick={() => handlePaymentStart('crypto')}
                             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-16 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95"
                          >
                             <Coins className="w-5 h-5" />
                             <span className="font-black text-xs uppercase tracking-widest">Payer en Crypto (Redirect)</span>
                          </button>
                          
                          <div className="flex items-center justify-center gap-6 mt-8 text-slate-400">
                              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                                  <Lock className="w-3.5 h-3.5" /> SSL 256-BIT
                              </div>
                              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                                  <ShieldCheck className="w-3.5 h-3.5" /> ANTI-FRAUDE
                              </div>
                          </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800">
                          <h4 className="text-xs font-black uppercase text-slate-500 mb-6 tracking-widest">Sommaire du nœud</h4>
                          
                          <div className="space-y-4">
                              <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Accès Premium</span>
                                  <span className="font-black text-slate-900 dark:text-white">{selectedPlanData.name}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">Durée</span>
                                  <span className="font-black text-slate-900 dark:text-white">30 Jours</span>
                              </div>
                              <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-2">
                                  <div className="flex justify-between items-center">
                                      <span className="font-black text-slate-900 dark:text-white text-lg">TOTAL</span>
                                      <span className="text-3xl font-black text-brand-500">{selectedPlanData.price}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {step === 'authenticating' && (
              <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-300">
                  <div className="relative mb-8">
                      <div className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                      <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                      <Fingerprint className="absolute inset-0 m-auto w-8 h-8 text-brand-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Authentification via {paymentMethod.toUpperCase()}</h3>
                  
                  <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-4 max-w-sm">
                      <ShieldCheck className="w-6 h-6 text-blue-500" />
                      <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                          Une fenêtre d'authentification bancaire (3D Secure) va s'ouvrir. Veuillez confirmer la transaction sur votre application mobile.
                      </p>
                  </div>

                  <div className="mt-10 flex flex-col gap-3 w-full max-w-sm">
                       <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Serveur Auth</span>
                            <span className="text-[10px] font-mono font-bold text-brand-500 uppercase">RE-NUM-AUTH-V2</span>
                       </div>
                       <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Statut</span>
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">En attente confirmation</span>
                            </div>
                       </div>
                  </div>
              </div>
          )}

          {step === 'success' && (
              <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/40">
                      <Check className="w-12 h-12 stroke-[3]" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 text-center">Identité Premium Activée</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-center max-w-sm">
                      Paiement validé par le réseau. Votre plan {selectedPlanData?.name} est désormais actif sur tous vos nœuds.
                  </p>
                  <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                      <ShieldCheck className="w-4 h-4" /> Authentification Bancaire OK
                  </div>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};
