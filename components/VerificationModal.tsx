import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, User, Upload, Camera, ScanFace, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'info' | 'document' | 'face' | 'processing' | 'success';

export const VerificationModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<Step>('info');
  const [progress, setProgress] = useState(0);

  // Simulation step 1 form
  const [formData, setFormData] = useState({ firstName: '', lastName: '', address: '' });

  // Simulation step 4 processing
  useEffect(() => {
    if (step === 'processing') {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 5;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
          setStep('success');
          setTimeout(() => {
             onSuccess();
          }, 2000);
        }
        setProgress(p);
      }, 150);
      return () => clearInterval(interval);
    }
  }, [step, onSuccess]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={step !== 'processing' ? onClose : undefined} />
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
           <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
             <ShieldCheck className="w-5 h-5 text-brand-500" />
             Vérification d'Identité (KYC)
           </h3>
           {step !== 'processing' && step !== 'success' && (
               <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                 <X className="w-5 h-5" />
               </button>
           )}
        </div>

        <div className="p-6">
            {/* Steps Progress */}
            {step !== 'success' && (
                <div className="flex items-center justify-between mb-8 relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -z-10"></div>
                    {(['info', 'document', 'face', 'processing'] as Step[]).map((s, i) => {
                         const currentIdx = ['info', 'document', 'face', 'processing'].indexOf(step);
                         const stepIdx = i;
                         const isActive = stepIdx <= currentIdx;
                         
                         return (
                             <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                 isActive ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                             }`}>
                                 {i + 1}
                             </div>
                         )
                    })}
                </div>
            )}

            {/* Content */}
            {step === 'info' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-brand-50 dark:bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-brand-500">
                            <User className="w-8 h-8" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Informations Personnelles</h4>
                        <p className="text-xs text-slate-500">Veuillez confirmer votre identité légale.</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 ml-1">Prénom</label>
                            <input 
                                type="text" 
                                value={formData.firstName}
                                onChange={e => setFormData({...formData, firstName: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-brand-500 text-sm dark:text-white"
                                placeholder="Jean"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 ml-1">Nom</label>
                            <input 
                                type="text" 
                                value={formData.lastName}
                                onChange={e => setFormData({...formData, lastName: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-brand-500 text-sm dark:text-white"
                                placeholder="Dupont"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1">Adresse Complète</label>
                        <input 
                            type="text" 
                            value={formData.address}
                            onChange={e => setFormData({...formData, address: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-brand-500 text-sm dark:text-white"
                            placeholder="123 Rue de la République, 75001 Paris"
                        />
                    </div>
                    
                    <button 
                        onClick={() => setStep('document')}
                        disabled={!formData.firstName || !formData.lastName || !formData.address}
                        className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        Continuer
                    </button>
                </div>
            )}

            {step === 'document' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-500">
                            <Upload className="w-8 h-8" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Document d'Identité</h4>
                        <p className="text-xs text-slate-500">Téléversez une copie de votre CNI ou Passeport.</p>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Camera className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliquez pour téléverser</p>
                        <p className="text-xs text-slate-400 mt-1">JPG, PNG ou PDF (Max 5MB)</p>
                    </div>

                    <button 
                        onClick={() => setStep('face')}
                        className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all"
                    >
                        Document Validé (Simulation)
                    </button>
                </div>
            )}

            {step === 'face' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                     <div className="text-center">
                        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-500 animate-pulse">
                            <ScanFace className="w-8 h-8" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Vérification Biométrique</h4>
                        <p className="text-xs text-slate-500">Analyse faciale pour confirmer que c'est bien vous.</p>
                    </div>

                    <div className="aspect-video bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden flex items-center justify-center">
                         <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 opacity-20">
                             {Array.from({length: 64}).map((_, i) => (
                                 <div key={i} className="border border-brand-500/30"></div>
                             ))}
                         </div>
                         <div className="w-32 h-32 border-2 border-brand-500 rounded-full flex items-center justify-center relative">
                             <div className="absolute inset-0 border-2 border-brand-500 rounded-full animate-ping opacity-20"></div>
                             <span className="text-xs font-mono text-brand-500 font-bold bg-slate-900 px-2 rounded">SCANNING</span>
                         </div>
                    </div>

                    <button 
                        onClick={() => setStep('processing')}
                        className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all"
                    >
                        Lancer l'Analyse
                    </button>
                </div>
            )}

            {step === 'processing' && (
                <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand-500">
                            {Math.round(progress)}%
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Vérification en cours...</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto mb-4">
                        Nous analysons vos documents et votre profil biométrique. Cela prend quelques secondes.
                    </p>
                    <div className="space-y-2 text-xs text-slate-400 font-mono">
                         <div className={`flex items-center justify-center gap-2 ${progress > 20 ? 'text-emerald-500' : ''}`}>
                             <CheckCircle className="w-3 h-3" /> Analyse Documentaire
                         </div>
                         <div className={`flex items-center justify-center gap-2 ${progress > 50 ? 'text-emerald-500' : ''}`}>
                             <CheckCircle className="w-3 h-3" /> Correspondance Biométrique
                         </div>
                         <div className={`flex items-center justify-center gap-2 ${progress > 80 ? 'text-emerald-500' : ''}`}>
                             <CheckCircle className="w-3 h-3" /> Validation AML/KYC
                         </div>
                    </div>
                </div>
            )}

            {step === 'success' && (
                 <div className="text-center py-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-lg shadow-emerald-500/20">
                        <CheckCircle className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Compte Vérifié !</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Merci. Votre identité a été confirmée avec succès. Vous avez désormais accès à toutes les fonctionnalités.
                    </p>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};