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
  HardDrive,
  RefreshCw,
  FileKey2,
  Copy,
  Archive,
  X,
  Clock,
} from 'lucide-react';
import {
  KdfStrengthPreset,
  SecretNoteCategory,
  VaultStoredItem,
  buildRvaultBlob,
  clearVaultVerifier,
  decryptRvaultFile,
  decryptStoredVaultItem,
  decryptVaultItemInRam,
  deleteVaultItemById,
  encryptFileWithUserPassword,
  encryptSecretNoteWithPassword,
  exportEncryptedVaultArchive,
  formatByteSize,
  formatKcvBlocks,
  importEncryptedVaultArchive,
  isVaultItemPreviewableInRam,
  listUserVaultItems,
  markVaultItemTransferred,
  rotateVaultMasterKey,
  saveItemToLocalVault,
  triggerBrowserDownload,
  verifyAllVaultItemsIntegrity,
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
  clipboardAutoClearSeconds?: number;
  addLog: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
  vaultRevision: number;
  onVaultMutated: () => void;
}

type FilterStatus = 'all' | 'local_only' | 'transferred_vpn' | 'secrets';
type WorkbenchMode = 'files' | 'secret_note';

const SECRET_CATEGORIES: Array<{
  id: SecretNoteCategory;
  label: string;
  placeholderTitle: string;
  placeholderBody: string;
}> = [
  {
    id: 'note',
    label: 'Note confidentielle',
    placeholderTitle: 'protocole-acces-serveur',
    placeholderBody:
      'Saisissez vos instructions confidentielles, codes de secours ou coordonnées sensibles...',
  },
  {
    id: 'wireguard_psk',
    label: 'Clé PSK WireGuard',
    placeholderTitle: 'wg0-preshared-key',
    placeholderBody: 'Clé pré-partagée 256 bits encodée en Base64...',
  },
  {
    id: 'ssh_key',
    label: 'Clé privée SSH / PGP',
    placeholderTitle: 'id_ed25519_bastion',
    placeholderBody: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
  },
  {
    id: 'seed_phrase',
    label: 'Phrase mnémonique',
    placeholderTitle: 'portefeuille-froid-rnc',
    placeholderBody: 'Liste ordonnée de 12 ou 24 mots de récupération...',
  },
  {
    id: 'api_token',
    label: 'Jeton API / .env',
    placeholderTitle: 'jetons-infrastructure-prod',
    placeholderBody: 'API_SECRET_TOKEN=...',
  },
];

function computeShannonEntropyBitsPerChar(text: string): number {
  if (!text) return 0;
  const freq = new Map<string, number>();
  for (const ch of text) {
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }
  let entropy = 0;
  const len = text.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(2));
}

export const LocalVault: React.FC<LocalVaultProps> = ({
  userId,
  userEmail,
  sessionPassword,
  onUnlockPassword,
  onLockVault,
  isConnected,
  currentNodeIp,
  currentNodeCountry,
  clipboardAutoClearSeconds = 30,
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

  // Key Rotation & Audit State
  const [showKeyRotationPanel, setShowKeyRotationPanel] = useState(false);
  const [nextMasterPassword, setNextMasterPassword] = useState('');
  const [nextRotationIterations, setNextRotationIterations] =
    useState<KdfStrengthPreset>(600000);
  const [isRotatingKey, setIsRotatingKey] = useState(false);
  const [isAuditingVault, setIsAuditingVault] = useState(false);
  const [auditResults, setAuditResults] = useState<
    Record<string, { valid: boolean; ms: number }>
  >({});

  // Workbench Mode: Files vs Zero-Disk Secret Notes
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>('files');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [maskFilenames, setMaskFilenames] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  // Secret Note Composer State
  const [secretCategory, setSecretCategory] =
    useState<SecretNoteCategory>('note');
  const [secretTitle, setSecretTitle] = useState('');
  const [secretBody, setSecretBody] = useState('');
  const [isSealingSecret, setIsSealingSecret] = useState(false);

  // Ephemeral RAM Viewer State (Zero Disk Write)
  const [ramViewer, setRamViewer] = useState<{
    itemId: string;
    restoredName: string;
    kind: 'text' | 'image';
    textContent?: string;
    imageUrl?: string;
    verifiedSha256: boolean;
    decryptMs: number;
    secondsRemaining: number;
  } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const clipboardTimerRef = useRef<number | null>(null);

  // Processing & Transfer Telemetry
  const [activeOperation, setActiveOperation] = useState<{
    label: string;
    progress: number;
  } | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
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

  // Cleanup clipboard timer & RAM preview ObjectURL on unmount
  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
    };
  }, []);

  const closeRamViewer = useCallback(() => {
    setRamViewer((prev) => {
      if (prev?.imageUrl) {
        URL.revokeObjectURL(prev.imageUrl);
      }
      return null;
    });
    setCopiedSecret(false);
  }, []);

  // Auto-purge RAM Viewer when vault locks or countdown reaches 0
  useEffect(() => {
    if (!isUnlocked && ramViewer) {
      closeRamViewer();
    }
  }, [isUnlocked, ramViewer, closeRamViewer]);

  useEffect(() => {
    if (!ramViewer) return;
    const interval = window.setInterval(() => {
      setRamViewer((prev) => {
        if (!prev) return null;
        if (prev.secondsRemaining <= 1) {
          if (prev.imageUrl) URL.revokeObjectURL(prev.imageUrl);
          return null;
        }
        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [Boolean(ramViewer)]);

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
      } catch (err: unknown) {
        if (!cancelled) {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'Erreur WebCrypto lors de la dérivation.'
          );
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
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Échec de dérivation PBKDF2.'
      );
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

  // --- Vault Audit, Key Rotation & Zero-Knowledge Backup ---

  const handleAuditAllItems = async () => {
    if (!sessionPassword || !isUnlocked || isAuditingVault) return;
    setIsAuditingVault(true);
    try {
      const res = await verifyAllVaultItemsIntegrity(userId, sessionPassword);
      setAuditResults(res.results);
      if (res.totalChecked === 0) {
        showNotice('Aucun objet à auditer dans ce coffre.', 'info');
      } else if (res.allValid) {
        showNotice(
          `Audit cryptographique réussi : ${res.totalChecked}/${res.totalChecked} enveloppes AES-256-GCM + SHA-256 authentifiées en ${res.totalMs} ms.`,
          'success'
        );
        addLog(
          `Audit d’intégrité du coffre validé (${res.totalChecked} objets · ${res.totalMs} ms)`,
          'success'
        );
      } else {
        showNotice(
          'Alerte : au moins un conteneur a échoué à la vérification du tag GCM ou SHA-256.',
          'error'
        );
        addLog('Divergence cryptographique détectée dans le coffre', 'error');
      }
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : 'Échec de l’audit d’intégrité.',
        'error'
      );
    } finally {
      setIsAuditingVault(false);
    }
  };

  const handleExecuteKeyRotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionPassword || !isUnlocked || isRotatingKey) return;
    const effectiveNextPwd = nextMasterPassword.trim() || sessionPassword;
    if (effectiveNextPwd.length < 6) {
      showNotice(
        'Le nouveau mot de passe doit contenir au moins 6 caractères.',
        'error'
      );
      return;
    }

    setIsRotatingKey(true);
    try {
      const res = await rotateVaultMasterKey(
        userId,
        sessionPassword,
        effectiveNextPwd,
        nextRotationIterations
      );
      setIterations(nextRotationIterations);
      setKcvHex(res.kcvHex);
      onUnlockPassword(effectiveNextPwd);
      setNextMasterPassword('');
      setShowKeyRotationPanel(false);
      setAuditResults({});
      await refreshVaultItems();
      onVaultMutated();

      showNotice(
        `Rotation accomplie : ${res.rotatedCount} objet(s) re-scellé(s) avec nouveaux sels/IV (${nextRotationIterations.toLocaleString('fr-FR')} itér. · KCV ${formatKcvBlocks(res.kcvHex)}) en ${res.totalMs} ms.`,
        'success'
      );
      addLog(
        `Rotation de clé maîtresse PBKDF2/AES-256-GCM effectuée sur ${res.rotatedCount} objet(s) (${res.totalMs} ms)`,
        'success'
      );
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : 'Échec de la rotation de clé.',
        'error'
      );
    } finally {
      setIsRotatingKey(false);
    }
  };

  const handleExportFullArchive = async () => {
    if (vaultItems.length === 0) {
      showNotice('Le coffre est vide : aucune enveloppe à exporter.', 'info');
      return;
    }
    try {
      const { blob, count } = await exportEncryptedVaultArchive(userId);
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerBrowserDownload(
        blob,
        `renumerate-coffre-chiffre-${dateStr}.rvault-archive.json`
      );
      showNotice(
        `Archive zéro-connaissance exportée (${count} enveloppe(s) chiffrée(s), aucune donnée en clair).`,
        'success'
      );
      addLog(
        `Archive chiffrée du coffre exportée (${count} conteneurs AES-256-GCM)`,
        'info'
      );
    } catch (err: unknown) {
      showNotice(
        err instanceof Error ? err.message : 'Échec de l’export d’archive.',
        'error'
      );
    }
  };

  const handleImportFullArchive = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!sessionPassword || !isUnlocked) {
      showNotice(
        'Déverrouillez d’abord le coffre avec la clé correspondant à cette archive.',
        'error'
      );
      return;
    }

    try {
      const { importedCount, skippedCount } = await importEncryptedVaultArchive(
        userId,
        file,
        sessionPassword
      );
      await refreshVaultItems();
      onVaultMutated();
      showNotice(
        `Archive importée : ${importedCount} objet(s) restauré(s), ${skippedCount} doublon(s) ignoré(s).`,
        'success'
      );
      addLog(
        `Restauration d’archive chiffrée réussie (+${importedCount} objet(s) authentifié(s))`,
        'success'
      );
    } catch (err: unknown) {
      showNotice(
        err instanceof Error
          ? err.message
          : 'Impossible d’authentifier cette archive.',
        'error'
      );
    }
  };

  // --- Secret Note Composer Handlers ---

  const handleGenerateWireGuardPsk = () => {
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
    let bin = '';
    for (let i = 0; i < randomBytes.length; i++) {
      bin += String.fromCharCode(randomBytes[i]);
    }
    const pskBase64 = btoa(bin);
    randomBytes.fill(0);
    setSecretCategory('wireguard_psk');
    if (!secretTitle.trim()) {
      setSecretTitle(`wg0-psk-${new Date().toISOString().slice(0, 10)}`);
    }
    setSecretBody(
      [
        '# Renumerate VPN — Clé pré-partagée post-quantique symétrique (256 bits)',
        `# Générée via window.crypto.getRandomValues le ${new Date().toISOString()}`,
        `PresharedKey = ${pskBase64}`,
      ].join('\n')
    );
  };

  const handleSealSecretNote = async (andTransfer: boolean) => {
    if (!sessionPassword || !isUnlocked) {
      showNotice(
        'Déverrouillez d’abord votre coffre avec votre mot de passe maître.',
        'error'
      );
      return;
    }
    if (!secretBody.trim()) {
      showNotice('Saisissez le contenu du secret à chiffrer.', 'error');
      return;
    }
    if (andTransfer && !isConnected) {
      showNotice(
        'Activez le tunnel VPN avant de transmettre un secret chiffré.',
        'error'
      );
      return;
    }

    setIsSealingSecret(true);
    try {
      const { item, stats } = await encryptSecretNoteWithPassword(
        {
          title: secretTitle || `secret-${secretCategory}`,
          secretText: secretBody,
          category: secretCategory,
          userId,
          iterations,
        },
        sessionPassword
      );

      if (andTransfer && isConnected) {
        await markVaultItemTransferred(item.id, currentNodeIp);
      }

      setSecretTitle('');
      setSecretBody('');
      await refreshVaultItems();
      onVaultMutated();

      showNotice(
        `Secret "${item.displayName}" scellé directement en RAM (${stats.deriveMs + stats.encryptMs} ms · zéro fichier temporaire).`,
        'success'
      );
      addLog(
        `Secret confidentiel ${item.displayName} scellé en AES-256-GCM (${stats.deriveMs + stats.encryptMs} ms)`,
        'success',
        andTransfer ? currentNodeIp : undefined
      );
    } catch (err: unknown) {
      showNotice(
        err instanceof Error
          ? err.message
          : 'Erreur lors du scellement du secret.',
        'error'
      );
    } finally {
      setIsSealingSecret(false);
    }
  };

  // --- Ephemeral RAM Viewer Handlers ---

  const handleOpenInRamViewer = async (item: VaultStoredItem) => {
    if (!sessionPassword || !isUnlocked) {
      showNotice(
        'Déverrouillez le coffre avec votre mot de passe pour ouvrir cet objet en mémoire vive.',
        'error'
      );
      return;
    }
    setPreviewLoadingId(item.id);
    try {
      closeRamViewer();
      const preview = await decryptVaultItemInRam(item, sessionPassword);
      setRamViewer({
        itemId: item.id,
        restoredName: preview.restoredName,
        kind: preview.kind,
        textContent: preview.textContent,
        imageUrl: preview.imageUrl,
        verifiedSha256: preview.verifiedSha256,
        decryptMs: preview.decryptMs,
        secondsRemaining: 45,
      });
      addLog(
        `Ouverture éphémère en RAM de ${preview.restoredName} (${preview.decryptMs} ms · zéro écriture disque)`,
        'info'
      );
    } catch (err: unknown) {
      showNotice(
        err instanceof Error
          ? err.message
          : 'Impossible de déchiffrer cet objet en RAM.',
        'error'
      );
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleCopyFromRamViewer = async () => {
    if (!ramViewer?.textContent) return;
    try {
      await navigator.clipboard.writeText(ramViewer.textContent);
      setCopiedSecret(true);
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
      if (clipboardAutoClearSeconds > 0) {
        clipboardTimerRef.current = window.setTimeout(() => {
          navigator.clipboard.writeText('').catch(() => {});
          setCopiedSecret(false);
        }, clipboardAutoClearSeconds * 1000);
      }
    } catch {
      showNotice('Accès au presse-papiers refusé par le navigateur.', 'error');
    }
  };

  // --- Drag & Drop File Queue Handlers ---

  const appendFilesToStage = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    setStagedFiles((prev) => {
      const existingKeys = new Set(
        prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`)
      );
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
      setWorkbenchMode('files');
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
    setWorkbenchMode('files');
    appendFilesToStage([sample]);
    showNotice('Fichier témoin ajouté à la file de préparation.', 'info');
  };

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

        if (currentFile.name.toLowerCase().endsWith('.rvault')) {
          setActiveOperation({
            label: `Déchiffrement AES-256-GCM de ${currentFile.name}...`,
            progress: Math.max(12, baseProgress),
          });

          const restored = await decryptRvaultFile(
            currentFile,
            sessionPassword
          );
          triggerBrowserDownload(restored.blob, restored.restoredName);
          decryptedCount++;

          addLog(
            `Conteneur ${currentFile.name} déchiffré localement (${restored.decryptMs} ms · SHA-256 ${restored.verifiedSha256 ? 'vérifié' : 'alerte'})`,
            restored.verifiedSha256 ? 'success' : 'warning'
          );
          continue;
        }

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
          triggerBrowserDownload(envelopeBlob, `${item.displayName}.rvault`);
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
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erreur lors de l'opération cryptographique locale.";
      showNotice(msg, 'error');
      addLog(msg, 'error');
    } finally {
      setTimeout(() => setActiveOperation(null), 400);
    }
  };

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
        `Fichier "${result.restoredName}" déchiffré en mémoire et téléchargé (${result.decryptMs} ms · SHA-256 vérifié).`,
        'success'
      );
    } catch (err: unknown) {
      showNotice(
        err instanceof Error
          ? err.message
          : 'Échec du déchiffrement AES-256-GCM.',
        'error'
      );
      addLog(
        `Échec du déchiffrement pour ${item.displayName} : tag GCM invalide`,
        'error'
      );
    } finally {
      setDecryptingId(null);
    }
  };

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
      itemKind: item.itemKind,
      secretCategory: item.secretCategory,
    };
    const blob = buildRvaultBlob(header, item.cipherBuffer);
    triggerBrowserDownload(blob, `${item.displayName}.rvault`);
    showNotice(
      `Conteneur chiffré ${item.displayName}.rvault exporté (aucune donnée en clair exposée).`,
      'info'
    );
  };

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
    if (ramViewer?.itemId === item.id) {
      closeRamViewer();
    }
    await deleteVaultItemById(item.id);
    await refreshVaultItems();
    onVaultMutated();
    if (expandedItemId === item.id) setExpandedItemId(null);
    addLog(`Objet scellé ${item.displayName} purgé d'IndexedDB`, 'info');
  };

  const handleWipeAll = async () => {
    closeRamViewer();
    await wipeAllUserVaultItems(userId);
    setConfirmWipeAll(false);
    setAuditResults({});
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
        filterStatus === 'all'
          ? true
          : filterStatus === 'secrets'
            ? item.itemKind === 'secret_note'
            : item.transferStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [vaultItems, searchQuery, filterStatus]);

  const totalSealedBytes = useMemo(
    () => vaultItems.reduce((sum, item) => sum + item.sealedSize, 0),
    [vaultItems]
  );

  const secretByteLength = useMemo(
    () => new TextEncoder().encode(secretBody).byteLength,
    [secretBody]
  );
  const secretEntropy = useMemo(
    () => computeShannonEntropyBitsPerChar(secretBody),
    [secretBody]
  );

  const activeCategorySpec =
    SECRET_CATEGORIES.find((c) => c.id === secretCategory) ||
    SECRET_CATEGORIES[0];

  return (
    <div className="space-y-6">
      {/* Hidden Archive File Input */}
      <input
        ref={archiveInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFullArchive}
      />

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : feedbackBanner.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : feedbackBanner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Section 1: Password-Based Key Derivation, Governance & Rotation */}
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
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
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
                Votre mot de passe ({userEmail}) n&apos;est jamais stocké : il dérive localement une clé AES-256-GCM non-extractible via PBKDF2-HMAC-SHA256.
              </p>
            </div>
          </div>

          {/* KDF Iteration Strength Selector + Lock Button */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                  type="button"
                  onClick={() => setIterations(preset.value)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    iterations === preset.value
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title={`Définir la dureté PBKDF2 des prochains scellements à ${preset.value.toLocaleString('fr-FR')} itérations`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {isUnlocked && (
              <button
                type="button"
                onClick={() => {
                  closeRamViewer();
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

        {/* Key Telemetry + Governance Operations OR Password Unlock Form */}
        {isUnlocked && kcvHex ? (
          <div className="pt-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
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
                  Dérivation active (KDF)
                </span>
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  PBKDF2-SHA256 · {iterations.toLocaleString('fr-FR')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block mb-1">
                  Empreinte de contrôle (KCV)
                </span>
                <span className="font-mono font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
                  {formatKcvBlocks(kcvHex)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block mb-1">
                  Stockage local IndexedDB
                </span>
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {vaultItems.length} objet(s) ·{' '}
                  {formatByteSize(totalSealedBytes)}
                  {lastDeriveMs !== null ? ` · ${lastDeriveMs} ms` : ''}
                </span>
              </div>
            </div>

            {/* Cryptographic Governance Toolbar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAuditAllItems}
                  disabled={isAuditingVault || vaultItems.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-cyan-500/60 disabled:opacity-50 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isAuditingVault ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600 dark:text-cyan-400" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>Auditer l’intégrité GCM/SHA-256</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowKeyRotationPanel((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showKeyRotationPanel
                      ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-cyan-500/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rotation de clé / Re-scellement KDF</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportFullArchive}
                  disabled={vaultItems.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500/60 disabled:opacity-50 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Exporter archive chiffrée</span>
                </button>
                <button
                  type="button"
                  onClick={() => archiveInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500/60 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Importer archive</span>
                </button>
              </div>
            </div>

            {/* Collapsible Master Key Rotation & KDF Re-Sealing Drawer */}
            {showKeyRotationPanel && (
              <form
                onSubmit={handleExecuteKeyRotation}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Rotation atomique de clé maîtresse &amp; dureté PBKDF2
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Déchiffre chaque objet en RAM, génère un nouveau sel 128 bits + IV 96 bits et re-chiffre l’ensemble du coffre. Laissez le champ vide pour conserver votre mot de passe actuel et augmenter uniquement les itérations KDF.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Nouveau mot de passe maître (optionnel si même clé)
                    </label>
                    <input
                      type="password"
                      value={nextMasterPassword}
                      onChange={(e) => setNextMasterPassword(e.target.value)}
                      placeholder="Laisser vide pour garder le mot de passe actuel..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Cible d’itérations PBKDF2-SHA256
                    </label>
                    <select
                      value={nextRotationIterations}
                      onChange={(e) =>
                        setNextRotationIterations(
                          Number(e.target.value) as KdfStrengthPreset
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:border-cyan-500 outline-none cursor-pointer"
                    >
                      <option value={150000}>150 000 itérations (Rapide)</option>
                      <option value={310000}>310 000 itérations (OWASP)</option>
                      <option value={600000}>600 000 itérations (Durci)</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      disabled={isRotatingKey}
                      className="w-full py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer h-[36px]"
                    >
                      {isRotatingKey ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Re-sceller ({vaultItems.length})</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
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
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:border-cyan-500 outline-none"
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
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 cursor-pointer"
              >
                {isDerivingKey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span>Dériver la clé &amp; déverrouiller</span>
              </button>
            </div>

            {authError && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-3.5 py-2">
                <span>{authError}</span>
                {vaultItems.length === 0 && (
                  <button
                    type="button"
                    onClick={handleResetEmptyVaultKey}
                    className="underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Réinitialiser l&apos;empreinte de ce coffre vide
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </section>

      {/* Section 2: Dual-Mode Cryptographic Sealing Workbench */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setWorkbenchMode('files')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                workbenchMode === 'files'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Fichiers &amp; conteneurs .rvault</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkbenchMode('secret_note')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                workbenchMode === 'secret_note'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileKey2 className="w-3.5 h-3.5" />
              <span>Secrets &amp; clés en RAM</span>
            </button>
          </div>

          {workbenchMode === 'files' ? (
            <button
              type="button"
              onClick={handleGenerateSampleFile}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Générer un fichier témoin</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerateWireGuardPsk}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Générer une clé PSK WireGuard 256-bit</span>
            </button>
          )}
        </div>

        {workbenchMode === 'files' ? (
          <>
            {/* Interactive File Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                isDraggingOver
                  ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-500/10'
                  : 'border-slate-300 dark:border-slate-700 hover:border-cyan-500/70 bg-slate-50/70 dark:bg-slate-950/40'
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
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-3 text-cyan-600 dark:text-cyan-400">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Glissez-déposez vos fichiers en clair ou conteneurs .rvault ici
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                AES-256-GCM local · Sel 128 bits + IV 96 bits uniques par fichier · Zéro envoi en clair
              </p>
            </div>

            {activeOperation && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 animate-spin" />
                    {activeOperation.label}
                  </span>
                  <span className="font-mono font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
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

            {stagedFiles.length > 0 && !activeOperation && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                    {stagedFiles.length} fichier(s) prêt(s) pour traitement local
                  </span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={maskFilenames}
                        onChange={(e) => setMaskFilenames(e.target.checked)}
                        className="rounded border-slate-300 accent-cyan-600"
                      />
                      <span>Anonymiser les noms de fichiers</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setStagedFiles([])}
                      className="text-xs text-slate-500 hover:text-rose-500 font-semibold cursor-pointer"
                    >
                      Vider la file
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-200/70 dark:divide-slate-800 max-h-48 overflow-y-auto">
                  {stagedFiles.map((f, idx) => {
                    const isContainer = f.name
                      .toLowerCase()
                      .endsWith('.rvault');
                    return (
                      <div
                        key={`${f.name}-${idx}`}
                        className="py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isContainer ? (
                            <FileArchive className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {f.name}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono tabular-nums text-slate-500 shrink-0">
                            {formatByteSize(f.size)}
                          </span>
                          <span
                            className="text-slate-400 hidden sm:inline"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                          <span className="hidden sm:inline text-slate-500">
                            {isContainer
                              ? 'Conteneur chiffré (Déchiffrement local)'
                              : 'Clair → AES-256-GCM'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setStagedFiles((prev) =>
                              prev.filter((_, itemIdx) => itemIdx !== idx)
                            )
                          }
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
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
                    className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>Chiffrer &amp; stocker dans le coffre</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => processStagedQueue('store_and_transfer')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                      isConnected
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      Chiffrer &amp; transférer via le tunnel
                      {isConnected
                        ? ` (${currentNodeCountry})`
                        : ' (Tunnel hors ligne)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => processStagedQueue('export_rvault')}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Chiffrer &amp; exporter (.rvault)</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Zero-Disk Secret Note & Key Sealing Workbench */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Catégorie du secret
                </label>
                <select
                  value={secretCategory}
                  onChange={(e) =>
                    setSecretCategory(e.target.value as SecretNoteCategory)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:border-cyan-500 outline-none cursor-pointer"
                >
                  {SECRET_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-8">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Identifiant de l’enveloppe scellée
                </label>
                <input
                  type="text"
                  value={secretTitle}
                  onChange={(e) => setSecretTitle(e.target.value)}
                  placeholder={activeCategorySpec.placeholderTitle}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-medium text-slate-600 dark:text-slate-300">
                  Contenu en clair (chiffré puis effacé de la mémoire vive)
                </label>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {formatByteSize(secretByteLength)} · Entropie {secretEntropy}{' '}
                  bits/car.
                </span>
              </div>
              <textarea
                rows={4}
                value={secretBody}
                onChange={(e) => setSecretBody(e.target.value)}
                placeholder={activeCategorySpec.placeholderBody}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:border-cyan-500 outline-none resize-y"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Consultable ultérieurement via l’aperçu RAM éphémère sans téléchargement disque.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSealSecretNote(false)}
                  disabled={isSealingSecret || !secretBody.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {isSealingSecret ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Sceller en RAM dans le coffre</span>
                </button>
                {isConnected && (
                  <button
                    type="button"
                    onClick={() => handleSealSecretNote(true)}
                    disabled={isSealingSecret || !secretBody.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Sceller &amp; transmettre via VPN</span>
                  </button>
                )}
              </div>
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
              Seuls les blocs chiffrés AES-256-GCM, leurs sels PBKDF2 et vecteurs d&apos;initialisation sont stockés.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[205px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par nom ou SHA-256..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:border-cyan-500 outline-none"
              />
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              {(
                [
                  { id: 'all', label: 'Tous' },
                  { id: 'secrets', label: 'Secrets RAM' },
                  { id: 'local_only', label: 'Locaux' },
                  { id: 'transferred_vpn', label: 'Transmis VPN' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
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
                      type="button"
                      onClick={handleWipeAll}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirmer la purge
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipeAll(false)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmWipeAll(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-500/50 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
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
              Glissez-déposez un document ou scellez un secret en RAM ci-dessus avec votre clé PBKDF2 / AES-256-GCM.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Objet scellé</th>
                  <th className="px-4 py-3 font-semibold">
                    Volume (Clair → GCM)
                  </th>
                  <th className="px-4 py-3 font-semibold">Empreinte SHA-256</th>
                  <th className="px-4 py-3 font-semibold">État &amp; Audit</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions cryptographiques
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const isDecrypting = decryptingId === item.id;
                  const isPreviewLoading = previewLoadingId === item.id;
                  const isTransferring = transferringId === item.id;
                  const canPreviewRam = isVaultItemPreviewableInRam(item);
                  const auditEntry = auditResults[item.id];

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {item.itemKind === 'secret_note' ? (
                              <FileKey2 className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <FileArchive className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            )}
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.displayName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {new Date(item.createdAt).toLocaleString(
                                  'fr-FR',
                                  {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}{' '}
                                · {item.iterations.toLocaleString('fr-FR')} itér.
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatByteSize(item.originalSize)} →{' '}
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatByteSize(item.sealedSize)}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {item.sha256PlainHex.slice(0, 10)}…
                          {item.sha256PlainHex.slice(-6)}
                        </td>

                        {/* Clean Unboxed Status & Audit Metadata (Zero Row-Dot Scatter) */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`font-medium ${
                              item.transferStatus === 'transferred_vpn'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.transferStatus === 'transferred_vpn'
                              ? `Transmis (${item.transferredNodeIp || 'VPN'})`
                              : 'Scellé localement'}
                          </span>
                          {auditEntry && (
                            <>
                              <span
                                className="text-slate-400 mx-1.5"
                                aria-hidden="true"
                              >
                                ·
                              </span>
                              <span
                                className={`font-mono tabular-nums ${
                                  auditEntry.valid
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {auditEntry.valid
                                  ? `Vérifié (${auditEntry.ms} ms)`
                                  : 'Tag invalide'}
                              </span>
                            </>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {canPreviewRam && (
                              <button
                                type="button"
                                onClick={() => handleOpenInRamViewer(item)}
                                disabled={isPreviewLoading}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Déchiffrer uniquement en mémoire vive (zéro écriture disque)"
                              >
                                {isPreviewLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">RAM</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDecryptItem(item)}
                              disabled={isDecrypting}
                              className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Déchiffrer localement et télécharger le fichier restauré"
                            >
                              {isDecrypting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                              <span>Restaurer</span>
                            </button>

                            <button
                              type="button"
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
                              type="button"
                              onClick={() => handleExportSealedContainer(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Télécharger le conteneur chiffré .rvault"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
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
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-500/60 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                              title="Purger cet objet d'IndexedDB"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-950/70">
                          <td colSpan={5} className="px-5 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono tabular-nums">
                              <div className="space-y-1">
                                <span className="text-slate-500 font-sans font-semibold">
                                  Sel PBKDF2 (128 bits) · Vecteur IV (96 bits)
                                </span>
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 break-all">
                                  Salt: {item.saltHex}
                                  <br />
                                  IV: {item.ivHex}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-slate-500 font-sans font-semibold">
                                  Empreintes SHA-256 (Clair d&apos;origine vs Ciphertext GCM)
                                </span>
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 break-all">
                                  Plain: {item.sha256PlainHex}
                                  <br />
                                  Cipher: {item.sha256CipherHex}
                                </div>
                              </div>
                              <div className="md:col-span-2 space-y-1">
                                <span className="text-slate-500 font-sans font-semibold">
                                  Aperçu brut des premiers octets chiffrés stockés (AES-256-GCM)
                                </span>
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-cyan-700 dark:text-cyan-400 break-all">
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

      {/* Ephemeral Zero-Disk RAM Viewer Modal */}
      {ramViewer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={closeRamViewer}
          />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[84vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Aperçu éphémère en RAM · {ramViewer.restoredName}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                    {ramViewer.verifiedSha256
                      ? 'SHA-256 authentifié'
                      : 'Alerte SHA-256'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{ramViewer.decryptMs} ms</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    Purge auto dans {ramViewer.secondsRemaining}s
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRamViewer((prev) =>
                      prev
                        ? {
                            ...prev,
                            secondsRemaining: prev.secondsRemaining + 30,
                          }
                        : null
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer font-mono tabular-nums"
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={closeRamViewer}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                  title="Purger la mémoire et fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/60 dark:bg-slate-950">
              {ramViewer.kind === 'image' && ramViewer.imageUrl ? (
                <div className="flex items-center justify-center">
                  <img
                    src={ramViewer.imageUrl}
                    alt={ramViewer.restoredName}
                    className="max-h-[52vh] rounded-xl border border-slate-200 dark:border-slate-800 object-contain"
                  />
                </div>
              ) : (
                <pre className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                  {ramViewer.textContent}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Aucun fichier temporaire n’est écrit sur le disque local.
              </span>
              <div className="flex items-center gap-2">
                {ramViewer.kind === 'text' && (
                  <button
                    type="button"
                    onClick={handleCopyFromRamViewer}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedSecret ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedSecret
                        ? clipboardAutoClearSeconds > 0
                          ? `Copié (purge ${clipboardAutoClearSeconds}s)`
                          : 'Copié'
                        : 'Copier en RAM'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeRamViewer}
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Purger la RAM &amp; fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
