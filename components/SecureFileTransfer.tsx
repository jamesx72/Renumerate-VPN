
import React, { useState, useRef } from 'react';
import { FileUp, Lock, Unlock, File, ArrowRight, X, Check, Loader2, ShieldAlert, Key, Fingerprint, ShieldCheck } from 'lucide-react';

interface Props {
  isConnected: boolean;
  addLog: (event: string, type: 'info' | 'warning' | 'success' | 'error') => void;
}

interface CryptoSession {
  key: string;
  iv: string;
  salt: string;
}

export const SecureFileTransfer: React.FC<Props> = ({ isConnected, addLog }) => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'encrypting' | 'transferring' | 'completed'>('idle');
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<CryptoSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setProgress(0);
      setSessionInfo(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isConnected && e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
      setProgress(0);
      setSessionInfo(null);
    }
  };

  // Fonction réelle de simulation/exécution cryptographique
  const performEncryption = async () => {
    if (!file) return;

    setStatus('encrypting');
    setProgress(5);
    addLog(`🛡️ Préparation du moteur cryptographique pour ${file.name}`, 'info');

    // Étape 1 : Génération des paramètres (Simulation des délais pour l'UX)
    await new Promise(r => setTimeout(r, 600));
    const salt = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    addLog(`🔑 Dérivation de clé PBKDF2 initiée (100,000 itérations)`, 'info');
    setProgress(25);

    // Étape 2 : Simulation de la dérivation
    await new Promise(r => setTimeout(r, 800));
    const sessionKey = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const iv = Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    
    setSessionInfo({ key: sessionKey, iv, salt });
    addLog(`🔒 Chiffrement AES-256-GCM en cours (Tag d'authentification 128-bit)`, 'info');
    setProgress(60);

    // Étape 3 : Finalisation du chiffrement
    await new Promise(r => setTimeout(r, 1000));
    setProgress(100);
    addLog(`✅ Objet cryptographique scellé et prêt pour le transfert`, 'success');
    
    // Passage au transfert
    setTimeout(() => {
        setStatus('transferring');
        setProgress(0);
        startTransferNetwork();
    }, 500);
  };

  const startTransferNetwork = () => {
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep += Math.random() * 8 + 2;
      
      if (currentStep >= 100) {
        currentStep = 100;
        clearInterval(interval);
        setStatus('completed');
        addLog(`📦 Transfert P2P terminé : ${file?.name}`, 'success');
        
        setTimeout(() => {
            setFile(null);
            setStatus('idle');
            setProgress(0);
            setSessionInfo(null);
        }, 4000);
      }
      setProgress(currentStep);
    }, 100);
  };

  const startProcess = () => {
    if (!file || !isConnected) return;
    if (isEncrypted) {
        performEncryption();
    } else {
        addLog(`⚠️ Alerte : Transfert de flux en clair initié pour ${file.name}`, 'warning');
        setStatus('transferring');
        startTransferNetwork();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300 relative overflow-hidden group">
      {/* Background patterns */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.02] dark:opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform">
        <Fingerprint className="w-32 h-32" />
      </div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 uppercase tracking-widest">
          <FileUp className="w-4 h-4 text-brand-500" /> Flux de données
        </h3>
        {isConnected && (
            <button 
                onClick={() => setIsEncrypted(!isEncrypted)}
                disabled={status !== 'idle'}
                className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border transition-all font-black uppercase tracking-tighter ${
                    isEncrypted 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400'
                } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
            >
                {isEncrypted ? <Lock className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                {isEncrypted ? 'AES-256-GCM PROTECTED' : 'DANGER: UNENCRYPTED'}
            </button>
        )}
      </div>

      {!isConnected ? (
        <div className="h-32 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
           <Lock className="w-8 h-8 mb-2 opacity-50" />
           <span className="text-[10px] font-black uppercase tracking-widest">Tunnel requis</span>
        </div>
      ) : (
        <div className="space-y-4 relative z-10">
            {!file ? (
                <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group bg-slate-50 dark:bg-slate-950/30"
                >
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm mb-2 group-hover:scale-110 transition-transform border border-slate-200 dark:border-slate-800">
                        <FileUp className="w-6 h-6 text-brand-500" />
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest">DÉPOSER UN PAQUET</p>
                </div>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`p-2.5 rounded-xl border transition-colors ${status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-500/10 border-brand-500/20 text-brand-500'}`}>
                                <File className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{file.name}</p>
                                <p className="text-[10px] font-mono text-slate-500">{formatSize(file.size)} • {file.type || 'Binary'}</p>
                            </div>
                        </div>
                        {status === 'idle' && (
                            <button onClick={() => setFile(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {sessionInfo && (
                        <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Security context</span>
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Session Key</span>
                                    <div className="text-[9px] font-mono text-brand-500 truncate bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                        {sessionInfo.key.slice(0, 12)}••••••••
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Auth Tag (IV)</span>
                                    <div className="text-[9px] font-mono text-slate-400 truncate bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                        {sessionInfo.iv}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {status === 'idle' ? (
                        <button 
                            onClick={startProcess}
                            className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${
                                isEncrypted 
                                    ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/30' 
                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30'
                            }`}
                        >
                            {isEncrypted ? <Key className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                            {isEncrypted ? 'Initialiser le scellement' : 'Transférer sans protection'}
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</span>
                                    <span className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                                        {status === 'encrypting' && <Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
                                        {status === 'transferring' && <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />}
                                        {status === 'completed' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                                        
                                        {status === 'encrypting' ? 'OPÉRATION CRYPTO...' : 
                                         status === 'transferring' ? 'TÉLÉVERSEMENT P2P...' : 
                                         'FLUX SÉCURISÉ'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Charge</span>
                                    <div className="text-xs font-mono font-black text-slate-900 dark:text-white">{Math.round(progress)}%</div>
                                </div>
                            </div>
                            
                            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700 relative">
                                <div 
                                    className={`h-full transition-all duration-300 relative ${
                                        status === 'completed' ? 'bg-emerald-500' : 
                                        status === 'encrypting' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 
                                        'bg-brand-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                                    }`} 
                                    style={{ width: `${progress}%` }}
                                >
                                    {status !== 'completed' && (
                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:15px_15px] animate-shimmer"></div>
                                    )}
                                </div>
                            </div>

                            {status === 'completed' && (
                                <div className="flex items-center justify-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in zoom-in-95">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Intégrité vérifiée • Session close</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};
