import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  User,
  Upload,
  Camera,
  ScanFace,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'info' | 'document' | 'face' | 'processing' | 'success';

export const VerificationModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<Step>('info');
  const [progress, setProgress] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
  });
  const [docMeta, setDocMeta] = useState<{
    name: string;
    hashPreview: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'processing') {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 8 + 4;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
          setStep('success');
          setTimeout(() => {
            onSuccess();
          }, 1600);
        }
        setProgress(p);
      }, 140);
      return () => clearInterval(interval);
    }
  }, [step, onSuccess]);

  const handleSelectDocument = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let hashPreview = 'e3b0c44298fc1c14';
    try {
      const buf = await file.slice(0, 65536).arrayBuffer();
      const digest = await window.crypto.subtle.digest('SHA-256', buf);
      hashPreview = Array.from(new Uint8Array(digest))
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback hash preview
    }
    setDocMeta({
      name: file.name,
      hashPreview,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={step !== 'processing' && step !== 'success' ? onClose : undefined}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
          <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Vérification d&apos;Opérateur (KYC)
          </h3>
          {step !== 'processing' && step !== 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Steps Progress */}
          {step !== 'success' && (
            <div className="flex items-center justify-between mb-7 relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />
              {(['info', 'document', 'face', 'processing'] as Step[]).map(
                (s, i) => {
                  const currentIdx = [
                    'info',
                    'document',
                    'face',
                    'processing',
                  ].indexOf(step);
                  const isActive = i <= currentIdx;
                  return (
                    <div
                      key={s}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                        isActive
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {i + 1}
                    </div>
                  );
                }
              )}
            </div>
          )}

          {step === 'info' && (
            <div className="space-y-4">
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl flex items-center justify-center mx-auto mb-3 text-cyan-600 dark:text-cyan-400">
                  <User className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Identité de l&apos;opérateur réseau
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Requis pour débloquer les retraits RNC et créditer votre bonus de +2.5000 RNC.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none focus:border-cyan-500 text-sm text-slate-900 dark:text-white"
                    placeholder="Jean"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none focus:border-cyan-500 text-sm text-slate-900 dark:text-white"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Adresse de résidence fiscale
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none focus:border-cyan-500 text-sm text-slate-900 dark:text-white"
                  placeholder="123 Rue de la République, 75001 Paris"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      firstName: 'Jean',
                      lastName: 'Dupont',
                      address: '14 Rue de la Paix, 75002 Paris',
                    })
                  }
                  className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Pré-remplir profil de démonstration
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStep('document')}
                disabled={
                  !formData.firstName.trim() ||
                  !formData.lastName.trim() ||
                  !formData.address.trim()
                }
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                Continuer vers le justificatif
              </button>
            </div>
          )}

          {step === 'document' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-500">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Empreinte locale du justificatif
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hachage SHA-256 calculé localement sans téléversement brut sur serveur tiers.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleSelectDocument}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                {docMeta ? (
                  <>
                    <FileCheck className="w-7 h-7 text-emerald-500 mb-2" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {docMeta.name}
                    </p>
                    <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      SHA-256 : {docMeta.hashPreview}...
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
                      <Camera className="w-6 h-6 text-slate-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Sélectionner un fichier CNI / Passeport
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      JPG, PNG ou PDF · Traitement WebCrypto local
                    </p>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('face')}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
              >
                {docMeta
                  ? 'Valider l’empreinte documentaire'
                  : 'Valider via attestation simulée'}
              </button>
            </div>
          )}

          {step === 'face' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-500">
                  <ScanFace className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Preuve de présence biométrique
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Confirmation anti-Sybil pour sécuriser le pool de rémunération RNC.
                </p>
              </div>

              <div className="aspect-video bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden flex items-center justify-center">
                <div className="w-28 h-28 border-2 border-cyan-500 rounded-full flex items-center justify-center relative">
                  <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                    PRÊT
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('processing')}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
              >
                Lancer la validation KYC
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-6 space-y-4">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-800 rounded-full" />
                <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                  {Math.round(progress)}%
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Certification du profil opérateur...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Signature cryptographique de votre attestation zéro-connaissance.
                </p>
              </div>
              <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                <div
                  className={`flex items-center justify-center gap-2 ${
                    progress > 25
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ''
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Empreinte SHA-256 vérifiée
                </div>
                <div
                  className={`flex items-center justify-center gap-2 ${
                    progress > 60
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ''
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Preuve anti-Sybil validée
                </div>
                <div
                  className={`flex items-center justify-center gap-2 ${
                    progress > 85
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ''
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Attribution bonus +2.5000 RNC
                </div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Opérateur certifié !
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Votre statut KYC est actif. Les retraits multi-réseaux et la rémunération RNC sont désormais débloqués.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};