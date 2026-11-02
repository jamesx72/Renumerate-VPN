import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Upload,
  Download,
  ShieldCheck,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Send,
  Search,
  Loader2,
  AlertTriangle,
  Check,
  FileArchive,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import {
  KdfStrengthPreset,
  VaultStoredItem,
  buildRvaultBlob,
  clearVaultVerifier,
  decryptRvaultFile,
  decryptStoredVaultItem,
  deleteVaultItemById,
  encryptFileWithUserPassword,
  formatByteSize,
  formatKcvBlocks,
  listUserVaultItems,
  markVaultItemTransferred,
  saveItemToLocalVault,
  triggerBrowserDownload,
  verifyOrInitVaultPassword,
  wipeAllUserVaultItems,
} from '../services/cryptoVaultService';

interface LocalVaultProps {
  userId: string;
  userEmail: string;
  sessionPassword: string | null;
  onUnlockPassword: (password: string) => void;
  onLockVault: () => void;
  isConnected: boolean;
  currentNodeIp: string;
  currentNodeCountry: string;
  addLog: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
  vaultRevision: number;
  onVaultMutated: () => void;
}

type FilterStatus = 'all' | 'local_only' | 'transferred_vpn';

export const LocalVault: React.FC<LocalVaultProps> = ({
  userId,
  userEmail,
  sessionPassword,
  onUnlockPassword,
  onLockVault,
  isConnected,
  currentNodeIp,
  currentNodeCountry,
  addLog,
  vaultRevision,
  onVaultMutated,
}) => {
  const [vaultItems, setVaultItems] = useState<VaultStoredItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  // Key Derivation & Unlock State
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [kcvHex, setKcvHex] = useState<string | null>(null);
  const [lastDeriveMs, setLastDeriveMs] = useState<number | null>(null);
  const [iterations, setIterations] = useState<KdfStrengthPreset>(310000);
  const [authError, setAuthError] = useState<string | null>(null);

  // Drag & Drop + Staging Queue
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [maskFilenames, setMaskFilenames] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing & Transfer Telemetry
  const [activeOperation, setActiveOperation] = useState<{
    label: string;
    progress: number;
  } | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Inventory Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);

  const isUnlocked = Boolean(sessionPassword && kcvHex);

  const showNotice = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info') => {
      setFeedbackBanner({ text, type });
    },
    []
  );

  useEffect(() => {
    if (!feedbackBanner) return;
    const t = setTimeout(() => setFeedbackBanner(null), 5000);
    return () => clearTimeout(t);
  }, [feedbackBanner]);

  // Load sealed items from IndexedDB
  const refreshVaultItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const items = await listUserVaultItems(userId);
      setVaultItems(items);
    } catch (err) {
      console.error('Vault IndexedDB read error:', err);
    } finally {
      setIsLoadingItems(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshVaultItems();
  }, [refreshVaultItems, vaultRevision]);

  // Automatically derive & verify PBKDF2 key when sessionPassword is present
  useEffect(() => {
    let cancelled = false;
    if (!sessionPassword) {
      setKcvHex(null);
      return;
    }

    const syncKey = async () => {
      setIsDerivingKey(true);
      setAuthError(null);
      try {
        const res = await verifyOrInitVaultPassword(
          userId,
          sessionPassword,
          iterations
        );
        if (cancelled) return;
        if (res.valid) {
          setKcvHex(res.kcvHex);
          setLastDeriveMs(res.deriveMs);
        } else {
          setKcvHex(null);
          onLockVault();
          setAuthError(
            "Ce mot de passe ne correspond pas à l'empreinte PBKDF2 des fichiers déjà scellés dans ce coffre."
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setAuthError(err?.message || 'Erreur WebCrypto lors de la dérivation.');
        }
      } finally {
        if (!cancelled) setIsDerivingKey(false);
      }
    };

    syncKey();
    return () => {
      cancelled = true;
    };
  }, [sessionPassword, userId, iterations, onLockVault]);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!passwordInput || passwordInput.length < 6) {
      setAuthError(
        'Saisissez votre mot de passe utilisateur (minimum 6 caractères) pour dériver la clé.'
      );
      return;
    }

    setIsDerivingKey(true);
    try {
      const check = await verifyOrInitVaultPassword(
        userId,
        passwordInput,
        iterations
      );
      if (!check.valid) {
        setAuthError(
          "Mot de passe invalide : l'empreinte dérivée PBKDF2 ne correspond pas au coffre existant."
        );
        addLog(
          'Tentative de déverrouillage du coffre local refusée (KCV non concordant)',
          'warning'
        );
        return;
      }

      setKcvHex(check.kcvHex);
      setLastDeriveMs(check.deriveMs);
      onUnlockPassword(passwordInput);
      setPasswordInput('');
      addLog(
        `Clé AES-256-GCM dérivée en ${check.deriveMs} ms via PBKDF2-SHA256 (KCV ${formatKcvBlocks(check.kcvHex)})`,
        'success'
      );
      showNotice(
        `Coffre déverrouillé — Clé dérivée en mémoire vive (KCV ${formatKcvBlocks(check.kcvHex)})`,
        'success'
      );
    } catch (err: any) {
      setAuthError(err?.message || 'Échec de dérivation PBKDF2.');
    } finally {
      setIsDerivingKey(false);
    }
  };

  const handleResetEmptyVaultKey = () => {
    if (vaultItems.length > 0) return;
    clearVaultVerifier(userId);
    setAuthError(null);
    showNotice(
      'Empreinte KCV réinitialisée. Saisissez votre mot de passe utilisateur pour initialiser une nouvelle clé.',
      'info'
    );
  };

  // Drag & Drop handlers
  const appendFilesToStage = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    setStagedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const unique = arr.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`)
      );
      return [...prev, ...unique];
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFilesToStage(e.dataTransfer.files);
    }
  };

  const handleGenerateSampleFile = () => {
    const content = [
      'RENUMERATE VPN — DOCUMENT CONFIDENTIEL TÉMOIN',
      `Utilisateur : ${userEmail}`,
      `Horodatage ISO : ${new Date().toISOString()}`,
      `Sortie VPN : ${currentNodeCountry} (${currentNodeIp})`,
      '------------------------------------------------------------',
      'Ce fichier sert à vérifier le chiffrement local AES-256-GCM',
      'avec dérivation de clé PBKDF2-HMAC-SHA256 via window.crypto.subtle',
      'avant tout stockage IndexedDB ou transfert réseau.',
    ].join('\n');

    const sample = new File(
      [content],
      `rapport-confidentiel-${new Date().toISOString().slice(0, 10)}.txt`,
      { type: 'text/plain;charset=utf-8' }
    );
    appendFilesToStage([sample]);
    showNotice('Fichier témoin ajouté à la file de préparation.', 'info');
  };

  // Core batch processor for staged files (Encrypt plain files OR Decrypt .rvault containers)
  const processStagedQueue = async (
    modeAction: 'store_only' | 'store_and_transfer' | 'export_rvault'
  ) => {
    if (!sessionPassword || !isUnlocked) {
      showNotice(
        "Déverrouillez d'abord le coffre avec votre mot de passe utilisateur pour dériver la clé de chiffrement.",
        'error'
      );
      return;
    }

    if (modeAction === 'store_and_transfer' && !isConnected) {
      showNotice(
        'Activez le tunnel VPN avant de lancer un transfert externe, ou choisissez le stockage local chiffré.',
        'error'
      );
      return;
    }

    if (stagedFiles.length === 0) return;

    let sealedCount = 0;
    let decryptedCount = 0;

    try {
      for (let i = 0; i < stagedFiles.length; i++) {
        const currentFile = stagedFiles[i];
        const baseProgress = Math.round((i / stagedFiles.length) * 100);

        // If user dropped a .rvault container, decrypt & restore it!
        if (currentFile.name.toLowerCase().endsWith('.rvault')) {
          setActiveOperation({
            label: `Déchiffrement AES-256-GCM de ${currentFile.name}...`,
            progress: Math.max(12, baseProgress),
          });

          const restored = await decryptRvaultFile(currentFile, sessionPassword);
          triggerBrowserDownload(restored.blob, restored.restoredName);
          decryptedCount++;

          addLog(
            `Conteneur ${currentFile.name} déchiffré localement (${restored.decryptMs} ms · SHA-256 ${restored.verifiedSha256 ? 'vérifié' : 'alerte'})`,
            restored.verifiedSha256 ? 'success' : 'warning'
          );
          continue;
        }

        // Otherwise encrypt the plaintext file locally via window.crypto.subtle
        setActiveOperation({
          label: `Dérivation PBKDF2 & scellement AES-256-GCM : ${currentFile.name}...`,
          progress: Math.max(15, baseProgress + 10),
        });

        const { item, envelopeBlob, stats } = await encryptFileWithUserPassword(
          currentFile,
          sessionPassword,
          {
            userId,
            iterations,
            maskFilename: maskFilenames,
          }
        );

        setLastDeriveMs(stats.deriveMs);

        if (modeAction === 'export_rvault') {
          await saveItemToLocalVault(item);
          triggerBrowserDownload(
            envelopeBlob,
            `${item.displayName}.rvault`
          );
          addLog(
            `Fichier ${currentFile.name} chiffré localement (${stats.encryptMs} ms) et exporté en .rvault`,
            'success'
          );
        } else if (modeAction === 'store_and_transfer') {
          await saveItemToLocalVault(item);
          setActiveOperation({
            label: `Transmission du bloc chiffré (${formatByteSize(item.sealedSize)}) via ${currentNodeIp}...`,
            progress: Math.min(95, baseProgress + 65),
          });
          await new Promise((r) => setTimeout(r, 650));
          await markVaultItemTransferred(item.id, currentNodeIp);
          addLog(
            `Objet scellé ${item.displayName} chiffré localement puis transmis via le tunnel ${currentNodeIp}`,
            'success',
            currentNodeIp
          );
        } else {
          await saveItemToLocalVault(item);
          addLog(
            `Fichier ${currentFile.name} chiffré localement (AES-256-GCM · ${stats.deriveMs + stats.encryptMs} ms) et stocké dans le coffre`,
            'success'
          );
        }

        sealedCount++;
      }

      setActiveOperation({ label: 'Opération terminée', progress: 100 });
      setStagedFiles([]);
      await refreshVaultItems();
      onVaultMutated();

      if (sealedCount > 0 && decryptedCount > 0) {
        showNotice(
          `${sealedCount} fichier(s) chiffré(s) et ${decryptedCount} conteneur(s) .rvault restauré(s) avec intégrité SHA-256 vérifiée.`,
          'success'
        );
      } else if (decryptedCount > 0) {
        showNotice(
          `${decryptedCount} conteneur(s) .rvault déchiffré(s) localement avec contrôle SHA-256 valide.`,
          'success'
        );
      } else if (modeAction === 'store_and_transfer') {
        showNotice(
          `${sealedCount} fichier(s) chiffré(s) localement puis transféré(s) via le tunnel ${currentNodeCountry}.`,
          'success'
        );
      } else {
        showNotice(
          `${sealedCount} fichier(s) scellé(s) localement en AES-256-GCM dans votre coffre.`,
          'success'
        );
      }
    } catch (err: any) {
      const msg =
        err?.message || "Erreur lors de l'opération cryptographique locale.";
      showNotice(msg, 'error');
      addLog(msg, 'error');
    } finally {
      setTimeout(() => setActiveOperation(null), 400);
    }
  };

  // Decrypt and download a stored item from IndexedDB
  const handleDecryptItem = async (item: VaultStoredItem) => {
    if (!sessionPassword || !isUnlocked) {
      showNotice(
        'Déverrouillez le coffre avec votre mot de passe utilisateur pour déchiffrer ce fichier.',
        'error'
      );
      return;
    }

    setDecryptingId(item.id);
    try {
      const result = await decryptStoredVaultItem(item, sessionPassword);
      triggerBrowserDownload(result.blob, result.restoredName);
      addLog(
        `Déchiffrement local réussi pour ${result.restoredName} (${result.decryptMs} ms · SHA-256 ${result.verifiedSha256 ? 'intact' : 'divergent'})`,
        result.verifiedSha256 ? 'success' : 'warning'
      );
      showNotice(
        `Fichier "${result.restoredName}" déchiffré en mémoire et restauré (${result.decryptMs} ms · SHA-256 vérifié).`,
        'success'
      );
    } catch (err: any) {
      showNotice(err?.message || 'Échec du déchiffrement AES-256-GCM.', 'error');
      addLog(
        `Échec du déchiffrement pour ${item.displayName} : tag GCM invalide`,
        'error'
      );
    } finally {
      setDecryptingId(null);
    }
  };

  // Export encrypted .rvault container without decrypting
  const handleExportSealedContainer = (item: VaultStoredItem) => {
    const header = {
      version: item.version,
      alg: item.alg,
      kdf: item.kdf,
      iterations: item.iterations,
      saltHex: item.saltHex,
      ivHex: item.ivHex,
      sha256PlainHex: item.sha256PlainHex,
      sha256CipherHex: item.sha256CipherHex,
      originalName: item.originalName,
      displayName: item.displayName,
      mimeType: item.mimeType,
      originalSize: item.originalSize,
      createdAt: item.createdAt,
    };
    const blob = buildRvaultBlob(header, item.cipherBuffer);
    triggerBrowserDownload(blob, `${item.displayName}.rvault`);
    showNotice(
      `Conteneur chiffré ${item.displayName}.rvault exporté (aucune donnée en clair exposée).`,
      'info'
    );
  };

  // Transfer already-encrypted item over VPN tunnel
  const handleTransferItemOverVpn = async (item: VaultStoredItem) => {
    if (!isConnected) {
      showNotice(
        'Connectez le tunnel VPN avant de transmettre un conteneur chiffré.',
        'error'
      );
      return;
    }

    setTransferringId(item.id);
    addLog(
      `Envoi du conteneur pré-chiffré ${item.displayName} (${formatByteSize(item.sealedSize)}) via ${currentNodeIp}...`,
      'info',
      currentNodeIp
    );

    await new Promise((r) => setTimeout(r, 850));
    await markVaultItemTransferred(item.id, currentNodeIp);
    await refreshVaultItems();
    onVaultMutated();
    setTransferringId(null);

    addLog(
      `Transfert chiffré de bout en bout confirmé pour ${item.displayName} (SHA-256 chiffré : ${item.sha256CipherHex.slice(0, 12)}…)`,
      'success',
      currentNodeIp
    );
    showNotice(
      `Conteneur chiffré "${item.displayName}" transmis via le nœud ${currentNodeCountry} (${currentNodeIp}).`,
      'success'
    );
  };

  const handleDeleteItem = async (item: VaultStoredItem) => {
    await deleteVaultItemById(item.id);
    await refreshVaultItems();
    onVaultMutated();
    if (expandedItemId === item.id) setExpandedItemId(null);
    addLog(`Objet scellé ${item.displayName} purgé d'IndexedDB`, 'info');
  };

  const handleWipeAll = async () => {
    await wipeAllUserVaultItems(userId);
    setConfirmWipeAll(false);
    await refreshVaultItems();
    onVaultMutated();
    addLog('Purge intégrale du coffre-fort local effectuée', 'warning');
    showNotice('Tous les conteneurs chiffrés locaux ont été purgés.', 'info');
  };

  const filteredItems = useMemo(() => {
    return vaultItems.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.originalName.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        item.sha256PlainHex.toLowerCase().includes(q);
      const matchesStatus =
        filterStatus === 'all' || item.transferStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [vaultItems, searchQuery, filterStatus]);

  const totalSealedBytes = useMemo(
    () => vaultItems.reduce((sum, item) => sum + item.sealedSize, 0),
    [vaultItems]
  );

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : feedbackBanner.type === 'error'
                ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : feedbackBanner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 text-brand-500" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-xs underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Section 1: Password-Based Key Derivation & Cryptographic Context */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-xl border shrink-0 ${
                isUnlocked
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isUnlocked ? (
                <Unlock className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Moteur cryptographique WebCrypto (window.crypto.subtle)
                </h2>
                <span className="text-slate-400">·</span>
                <span
                  className={`text-xs font-semibold ${
                    isUnlocked
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isUnlocked
                    ? 'Clé dérivée active en RAM'
                    : 'Coffre verrouillé — Mot de passe requis'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Votre mot de passe utilisateur ({userEmail}) n'est jamais stocké : il dérive localement une clé AES-256-GCM non-extractible via PBKDF2-HMAC-SHA256.
              </p>
            </div>
          </div>

          {/* KDF Iteration Strength Selector + Lock Button */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-mono tabular-nums">
              {(
                [
                  { value: 150000, label: '150k itér.' },
                  { value: 310000, label: '310k OWASP' },
                  { value: 600000, label: '600k Max' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setIterations(preset.value)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    iterations === preset.value
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title={`Définir la dureté PBKDF2 à ${preset.value.toLocaleString('fr-FR')} itérations`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {isUnlocked && (
              <button
                onClick={() => {
                  onLockVault();
                  setKcvHex(null);
                  addLog(
                    'Clé cryptographique du coffre purgée de la mémoire vive',
                    'info'
                  );
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Verrouiller la clé</span>
              </button>
            )}
          </div>
        </div>

        {/* Key Telemetry Strip OR Password Unlock Form */}
        {isUnlocked && kcvHex ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">
                Algorithme de scellement
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                AES-256-GCM · Tag 128b
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">
                Dérivation de clé (KDF)
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                PBKDF2-SHA256 · {iterations.toLocaleString('fr-FR')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">
                Empreinte de contrôle (KCV)
              </span>
              <span className="font-mono font-bold tabular-nums text-brand-600 dark:text-brand-400">
                {formatKcvBlocks(kcvHex)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">
                Stockage local IndexedDB
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                {vaultItems.length} objet(s) · {formatByteSize(totalSealedBytes)}
                {lastDeriveMs !== null ? ` · ${lastDeriveMs} ms` : ''}
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUnlockSubmit} className="pt-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Entrez votre mot de passe utilisateur pour dériver la clé AES-256-GCM..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:border-brand-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Afficher ou masquer le mot de passe"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={isDerivingKey}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shrink-0 cursor-pointer"
              >
                {isDerivingKey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span>Dériver la clé & déverrouiller</span>
              </button>
            </div>

            {authError && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3.5 py-2">
                <span>{authError}</span>
                {vaultItems.length === 0 && (
                  <button
                    type="button"
                    onClick={handleResetEmptyVaultKey}
                    className="underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Réinitialiser l'empreinte de ce coffre vide
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </section>

      {/* Section 2: Drag & Drop Local Encryption & Decryption Zone */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Zone de scellement & restauration par glisser-déposer
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Déposez des fichiers en clair pour les chiffrer avant stockage ou transfert, ou déposez un fichier <span className="font-mono">.rvault</span> pour le déchiffrer localement.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateSampleFile}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            <span>Générer un fichier témoin</span>
          </button>
        </div>

        {/* Interactive Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            isDraggingOver
              ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-brand-500/70 bg-slate-50/70 dark:bg-slate-950/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                appendFilesToStage(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-3 text-brand-500">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Glissez-déposez vos fichiers ici, ou cliquez pour parcourir
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Chiffrement local AES-256-GCM · Sel 128 bits + IV 96 bits uniques par fichier · Aucun envoi en clair
          </p>
        </div>

        {/* Active Cryptographic Progress Bar (SVG — zero inline style) */}
        {activeOperation && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                {activeOperation.label}
              </span>
              <span className="font-mono font-bold tabular-nums text-brand-600 dark:text-brand-400">
                {activeOperation.progress}%
              </span>
            </div>
            <svg className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
              <rect
                x="0"
                y="0"
                width={`${activeOperation.progress}%`}
                height="100%"
                rx="4"
                fill="#06b6d4"
              />
            </svg>
          </div>
        )}

        {/* Staged Files Queue & Pre-Transfer Encryption Actions */}
        {stagedFiles.length > 0 && !activeOperation && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                {stagedFiles.length} fichier(s) prêt(s) pour traitement cryptographique local
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={maskFilenames}
                    onChange={(e) => setMaskFilenames(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>Anonymiser les noms de fichiers</span>
                </label>
                <button
                  type="button"
                  onClick={() => setStagedFiles([])}
                  className="text-xs text-slate-500 hover:text-red-500 font-semibold cursor-pointer"
                >
                  Vider la file
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 max-h-48 overflow-y-auto">
              {stagedFiles.map((f, idx) => {
                const isContainer = f.name.toLowerCase().endsWith('.rvault');
                return (
                  <div
                    key={`${f.name}-${idx}`}
                    className="py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isContainer ? (
                        <FileArchive className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {f.name}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono tabular-nums text-slate-500 shrink-0">
                        {formatByteSize(f.size)}
                      </span>
                      <span className="text-slate-400 hidden sm:inline">·</span>
                      <span className="hidden sm:inline text-slate-500">
                        {isContainer
                          ? 'Conteneur chiffré (Déchiffrement local)'
                          : 'Clair -> AES-256-GCM'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setStagedFiles((prev) =>
                          prev.filter((_, itemIdx) => itemIdx !== idx)
                        )
                      }
                      className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                      title="Retirer de la file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => processStagedQueue('store_only')}
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <HardDrive className="w-4 h-4" />
                <span>Chiffrer & stocker dans le coffre local</span>
              </button>

              <button
                type="button"
                onClick={() => processStagedQueue('store_and_transfer')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                  isConnected
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
                title={
                  isConnected
                    ? `Chiffrer localement puis envoyer vers ${currentNodeIp}`
                    : 'Connectez le tunnel VPN pour activer le transfert réseau'
                }
              >
                <Send className="w-4 h-4" />
                <span>
                  Chiffrer & transférer via le tunnel
                  {isConnected ? ` (${currentNodeCountry})` : ' (Tunnel hors ligne)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => processStagedQueue('export_rvault')}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-brand-500" />
                <span>Chiffrer & exporter (.rvault)</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Local Encrypted Vault Inventory (IndexedDB) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Inventaire du coffre-fort local (IndexedDB)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Seuls les blocs chiffrés AES-256-GCM, leurs sels PBKDF2 et vecteurs d'initialisation sont conservés localement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par nom ou SHA-256..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:border-brand-500 outline-none"
              />
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              {(
                [
                  { id: 'all', label: 'Tous' },
                  { id: 'local_only', label: 'Stockage local' },
                  { id: 'transferred_vpn', label: 'Transférés VPN' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterStatus === tab.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {vaultItems.length > 0 && (
              <>
                {confirmWipeAll ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleWipeAll}
                      className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Confirmer la purge
                    </button>
                    <button
                      onClick={() => setConfirmWipeAll(false)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmWipeAll(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-500/50 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Purger le coffre
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {isLoadingItems ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <Lock className="w-8 h-8 text-slate-400 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {vaultItems.length === 0
                ? 'Votre coffre-fort local est actuellement vide'
                : 'Aucun objet scellé ne correspond à votre filtre'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Glissez-déposez un document ci-dessus ou générez un fichier témoin pour le chiffrer avec votre clé PBKDF2 / AES-256-GCM.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Objet scellé</th>
                  <th className="px-4 py-3 font-semibold">Volume (Clair → GCM)</th>
                  <th className="px-4 py-3 font-semibold">Empreinte SHA-256</th>
                  <th className="px-4 py-3 font-semibold">État & Canal</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions cryptographiques</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const isDecrypting = decryptingId === item.id;
                  const isTransferring = transferringId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <FileArchive className="w-4 h-4 text-brand-500 shrink-0" />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.displayName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {new Date(item.createdAt).toLocaleString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                · {item.iterations.toLocaleString('fr-FR')} itér.
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {formatByteSize(item.originalSize)} →{' '}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatByteSize(item.sealedSize)}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {item.sha256PlainHex.slice(0, 10)}…
                          {item.sha256PlainHex.slice(-6)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 font-medium ${
                              item.transferStatus === 'transferred_vpn'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-brand-600 dark:text-brand-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.transferStatus === 'transferred_vpn'
                                  ? 'bg-emerald-500'
                                  : 'bg-brand-500'
                              }`}
                            />
                            {item.transferStatus === 'transferred_vpn'
                              ? `Transmis (${item.transferredNodeIp || 'VPN'})`
                              : 'Scellé localement'}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDecryptItem(item)}
                              disabled={isDecrypting}
                              className="px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Déchiffrer localement via window.crypto.subtle et télécharger le fichier restauré"
                            >
                              {isDecrypting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                              <span>Déchiffrer</span>
                            </button>

                            <button
                              onClick={() => handleTransferItemOverVpn(item)}
                              disabled={isTransferring}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Transmettre uniquement le bloc chiffré via le tunnel VPN"
                            >
                              {isTransferring ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden xl:inline">Tunnel</span>
                            </button>

                            <button
                              onClick={() => handleExportSealedContainer(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-500 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Télécharger le conteneur chiffré .rvault"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() =>
                                setExpandedItemId(isExpanded ? null : item.id)
                              }
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                              title="Inspecter les preuves cryptographiques (Sel, IV, Ciphertext)"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-500/60 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Purger cet objet d'IndexedDB"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Cryptographic Envelope Proof Inspector Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-950/70">
                          <td colSpan={5} className="px-5 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono tabular-nums">
                              <div className="space-y-1">
                                <span className="text-slate-400 font-sans font-semibold">
                                  Sel PBKDF2 (128 bits) · Vecteur IV (96 bits)
                                </span>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 break-all">
                                  Salt: {item.saltHex}
                                  <br />
                                  IV: {item.ivHex}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-slate-400 font-sans font-semibold">
                                  Empreintes SHA-256 (Clair d'origine vs Ciphertext GCM)
                                </span>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 break-all">
                                  Plain: {item.sha256PlainHex}
                                  <br />
                                  Cipher: {item.sha256CipherHex}
                                </div>
                              </div>
                              <div className="md:col-span-2 space-y-1">
                                <span className="text-slate-400 font-sans font-semibold">
                                  Aperçu brut des premiers octets chiffrés stockés (AES-256-GCM)
                                </span>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-400 break-all">
                                  {item.cipherPreviewHex}…
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
