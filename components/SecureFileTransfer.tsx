import React, { useState, useRef } from 'react';
import { FileUp, Lock, Unlock, File, ArrowRight, X, Check, Loader2, ShieldAlert } from 'lucide-react';

interface Props {
  isConnected: boolean;
  addLog: (event: string, type: 'info' | 'warning' | 'success' | 'error') => void;
}

export const SecureFileTransfer: React.FC<Props> = ({ isConnected, addLog }) => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'encrypting' | 'transferring' | 'completed'>('idle');
  const [isEncrypted, setIsEncrypted] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isConnected && e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
      setProgress(0);
    }
  };

  const startTransfer = () => {
    if (!file || !isConnected) return;

    // Security Check Log
    if (!isEncrypted) {
        addLog(`⚠️ Attention : Transfert non chiffré initié pour ${file.name}`, 'warning');
    } else {
        addLog(`🔒 Initialisation du chiffrement AES-256 pour ${file.name}`, 'info');
    }

    let currentStep = 0;
    // Initial status based on encryption setting
    setStatus(isEncrypted ? 'encrypting' : 'transferring');
    
    const interval = setInterval(() => {
      currentStep += Math.random() * 5 + 1;
      
      // If encrypted, switch to transferring state after 30%
      if (currentStep > 30 && isEncrypted && status !== 'transferring' && currentStep < 100) {
         setStatus('transferring');
         if (status === 'encrypting') {
             // Only log this once when switching state
             // We can't easily log inside setInterval without refs or effects due to closure, 
             // but checking status === 'encrypting' inside the interval helps mimic the transition
         }
      }

      if (currentStep >= 100) {
        currentStep = 100;
        clearInterval(interval);
        setStatus('completed');
        addLog(`Fichier transféré avec succès: ${file.name}`, 'success');
        
        setTimeout(() => {
            setFile(null);
            setStatus('idle');
            setProgress(0);
        }, 3000);
      }
      setProgress(currentStep);
    }, 50);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <FileUp className="w-4 h-4" /> Transfert Sécurisé
        </h3>
        {isConnected && (
            <button 
                onClick={() => setIsEncrypted(!isEncrypted)}
                className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border transition-all font-bold ${
                    isEncrypted 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' 
                    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                }`}
                title={isEncrypted ? "Chiffrement Activé" : "Chiffrement Désactivé"}
            >
                {isEncrypted ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {isEncrypted ? 'AES-256 ON' : 'AES-256 OFF'}
            </button>
        )}
      </div>

      {!isConnected ? (
        <div className="h-32 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
           <Lock className="w-8 h-8 mb-2 opacity-50" />
           <span className="text-xs">Connexion requise</span>
        </div>
      ) : (
        <div className="space-y-4">
            {!file ? (
                <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors group bg-slate-50 dark:bg-slate-800/20"
                >
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                        <FileUp className="w-6 h-6 text-brand-500" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Cliquez ou glissez un fichier</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Max 2 GB • P2P Encrypted</p>
                </div>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-brand-100 dark:bg-brand-500/20 rounded-lg">
                                <File className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{formatSize(file.size)}</p>
                            </div>
                        </div>
                        {status === 'idle' && (
                            <button onClick={() => setFile(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {status === 'idle' ? (
                        <button 
                            onClick={startTransfer}
                            className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg ${
                                isEncrypted 
                                    ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/20' 
                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200 shadow-slate-700/20 border border-slate-600'
                            }`}
                        >
                            {isEncrypted ? <Lock className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                            {isEncrypted ? 'Envoyer Sécurisé' : 'Envoyer Non Chiffré'}
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    {status === 'encrypting' && <Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
                                    {status === 'transferring' && <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />}
                                    {status === 'completed' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                                    
                                    {status === 'encrypting' ? 'Chiffrement AES-256...' : 
                                     status === 'transferring' ? 'Téléversement...' : 
                                     'Terminé'}
                                </span>
                                <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200">{Math.round(progress)}%</span>
                            </div>
                            
                            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-300 dark:border-slate-600 relative">
                                <div 
                                    className={`h-full transition-all duration-200 relative ${
                                        status === 'completed' ? 'bg-emerald-500' : 
                                        status === 'encrypting' ? 'bg-amber-500' : 
                                        'bg-brand-500'
                                    }`} 
                                    style={{ width: `${progress}%` }}
                                >
                                    {/* Striped animation overlay */}
                                    {status !== 'completed' && (
                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:12px_12px] animate-[shimmer_1s_linear_infinite]"></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};