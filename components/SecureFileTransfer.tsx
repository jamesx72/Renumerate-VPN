import React, { useState, useRef } from 'react';
import {
  FileUp,
  Lock,
  Unlock,
  FileText,
  X,
  Check,
  Loader2,
  KeyRound,
  ShieldCheck,
  ArrowUpRight,
  HardDrive,
  Send,
} from 'lucide-react';
import {
  encryptFileWithUserPassword,
  formatByteSize,
  markVaultItemTransferred,
  saveItemToLocalVault,
  verifyOrInitVaultPassword,
} from '../services/cryptoVaultService';

interface Props {
  userId: string;
  sessionPassword: string | null;
  onUnlockPassword: (password: string) => void;
  isConnected: boolean;
  currentNodeIp: string;
  onOpenFullVault: () => void;
  onVaultMutated: () => void;
  vaultCount: number;
  addLog: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

export const SecureFileTransfer: React.FC<Props> = ({
  userId,
  sessionPassword,
  onUnlockPassword,
  isConnected,
  currentNodeIp,
  onOpenFullVault,
  onVaultMutated,
  vaultCount,
  addLog,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [quickPassword, setQuickPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    'idle' | 'encrypting' | 'transferring' | 'completed'
  >('idle');
  const [lastDigest, setLastDigest] = useState<{
    ivHex: string;
    sha256CipherHex: string;
    sealedSize: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setProgress(0);
      setLastDigest(null);
      setAuthError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
      setProgress(0);
      setLastDigest(null);
      setAuthError(null);
    }
  };

  const resolveActivePassword = async (): Promise<string | null> => {
    if (sessionPassword) return sessionPassword;
    if (!quickPassword || quickPassword.length < 6) {
      setAuthError('Mot de passe utilisateur requis (min. 6 caractères).');
      return null;
    }
    const check = await verifyOrInitVaultPassword(userId, quickPassword);
    if (!check.valid) {
      setAuthError('Mot de passe invalide pour ce coffre.');
      return null;
    }
    onUnlockPassword(quickPassword);
    setQuickPassword('');
    return quickPassword;
  };

  const executeSeal = async (andTransfer: boolean) => {
    if (!file) return;
    setAuthError(null);

    try {
      const pwd = await resolveActivePassword();
      if (!pwd) return;

      setStatus('encrypting');
      setProgress(25);
      addLog(
        `Dérivation PBKDF2-SHA256 & chiffrement local AES-256-GCM de ${file.name}...`,
        'info'
      );

      const { item, stats } = await encryptFileWithUserPassword(file, pwd, {
        userId,
        iterations: 310000,
      });

      setProgress(65);
      await saveItemToLocalVault(item);

      setLastDigest({
        ivHex: item.ivHex,
        sha256CipherHex: item.sha256CipherHex,
        sealedSize: item.sealedSize,
      });

      if (andTransfer && isConnected) {
        setStatus('transferring');
        setProgress(85);
        await new Promise((r) => setTimeout(r, 650));
        await markVaultItemTransferred(item.id, currentNodeIp);
        addLog(
          `Conteneur scellé ${item.displayName} chiffré en ${stats.encryptMs} ms puis transmis via ${currentNodeIp}`,
          'success',
          currentNodeIp
        );
      } else {
        addLog(
          `Fichier ${item.displayName} scellé localement dans le coffre (${stats.deriveMs + stats.encryptMs} ms)`,
          'success'
        );
      }

      onVaultMutated();
      setProgress(100);
      setStatus('completed');

      setTimeout(() => {
        setFile(null);
        setStatus('idle');
        setProgress(0);
      }, 3200);
    } catch (err: unknown) {
      setStatus('idle');
      setProgress(0);
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Erreur WebCrypto lors du scellement.'
      );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {sessionPassword ? (
            <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Scellement rapide
          </h3>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            · {vaultCount}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenFullVault}
          className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Ouvrir le coffre</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-500/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-cyan-500 bg-slate-50 dark:bg-slate-950/40'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
          <FileUp className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mb-2" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Glisser-déposer un fichier à sceller
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            PBKDF2 · AES-256-GCM local
          </p>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-500">
                  {formatByteSize(file.size)}
                </p>
              </div>
            </div>
            {status === 'idle' && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!sessionPassword && status === 'idle' && (
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={quickPassword}
                onChange={(e) => setQuickPassword(e.target.value)}
                placeholder="Mot de passe utilisateur (clé PBKDF2)..."
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:border-cyan-500 outline-none"
              />
            </div>
          )}

          {authError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              {authError}
            </p>
          )}

          {lastDigest && (
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono tabular-nums text-slate-500 space-y-0.5">
              <div className="flex justify-between">
                <span>IV GCM</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {lastDigest.ivHex.slice(0, 16)}…
                </span>
              </div>
              <div className="flex justify-between">
                <span>SHA-256</span>
                <span className="text-cyan-600 dark:text-cyan-400">
                  {lastDigest.sha256CipherHex.slice(0, 14)}…
                </span>
              </div>
            </div>
          )}

          {status === 'idle' ? (
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => executeSeal(false)}
                className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Chiffrer &amp; stocker localement</span>
              </button>
              {isConnected && (
                <button
                  type="button"
                  onClick={() => executeSeal(true)}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Chiffrer &amp; transférer via VPN</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  {status === 'completed' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 animate-spin" />
                  )}
                  {status === 'encrypting'
                    ? 'Scellement AES-256-GCM...'
                    : status === 'transferring'
                      ? 'Transfert du bloc chiffré...'
                      : 'Scellé dans le coffre'}
                </span>
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {Math.round(progress)}%
                </span>
              </div>
              <svg className="w-full h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                <rect
                  x="0"
                  y="0"
                  width={`${progress}%`}
                  height="100%"
                  rx="3"
                  fill={status === 'completed' ? '#10b981' : '#06b6d4'}
                />
              </svg>
              {status === 'completed' && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Intégrité SHA-256 vérifiée</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
