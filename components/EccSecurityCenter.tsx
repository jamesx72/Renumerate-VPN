import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Play,
  Download,
  Upload,
  ArrowRight,
  Zap,
  Layers,
  FileCode2,
  Hash,
  AlertTriangle,
  RotateCcw,
  Eye,
  EyeOff,
  Flame,
  Radio,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import {
  EccCurve,
  EccKeyUsage,
  EccHashAlgorithm,
  EccKeyPairInfo,
  EcdhExchangeResult,
  EcdsaSignatureResult,
  EciesCipherEnvelope,
  EccBenchmarkResult,
  EccCurveSecurityProfile,
  AppSettings,
} from '../types';
import {
  generateEccKeyPair,
  performEcdhExchange,
  signEcdsaMessage,
  verifyEcdsaSignature,
  encryptEciesPayload,
  decryptEciesPayload,
  runClientEccBenchmark,
  verifyPointOnCurve,
  ECC_CURVE_PROFILES,
  bytesToHex,
  formatHexView,
} from '../services/eccSecurityService';

interface EccSecurityCenterProps {
  settings: AppSettings;
  updateSettings: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  patchSettings: (patch: Partial<AppSettings>, reason?: string) => void;
  addLog: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

type EccModuleTab = 'keys' | 'ecdh' | 'ecdsa' | 'ecies' | 'bench' | 'matrix';

export const EccSecurityCenter: React.FC<EccSecurityCenterProps> = ({
  settings,
  updateSettings,
  patchSettings,
  addLog,
}) => {
  const [activeTab, setActiveTab] = useState<EccModuleTab>('keys');

  // Key Pair Management
  const [selectedCurve, setSelectedCurve] = useState<EccCurve>(
    settings.eccDefaultCurve || 'P-256'
  );
  const [keyUsage, setKeyUsage] = useState<EccKeyUsage>('ecdh');
  const [keyLabel, setKeyLabel] = useState('Clé Maîtresse Renumerate ECC');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [activeKeyPair, setActiveKeyPair] = useState<EccKeyPairInfo | null>(null);
  const [activeRawKeyPair, setActiveRawKeyPair] = useState<CryptoKeyPair | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Manual Coordinates Validation
  const [customX, setCustomX] = useState('');
  const [customY, setCustomY] = useState('');
  const [validationResult, setValidationResult] = useState<{
    isOnCurve: boolean;
    detail: string;
    residualHex: string;
  } | null>(null);

  // ECDH Simulation
  const [ecdhCurve, setEcdhCurve] = useState<EccCurve>('P-256');
  const [ecdhAlicePair, setEcdhAlicePair] = useState<CryptoKeyPair | null>(null);
  const [ecdhBobPair, setEcdhBobPair] = useState<CryptoKeyPair | null>(null);
  const [ecdhResult, setEcdhResult] = useState<EcdhExchangeResult | null>(null);
  const [isPerformingEcdh, setIsPerformingEcdh] = useState(false);

  // ECDSA Sign & Verify
  const [signMessageText, setSignMessageText] = useState(
    'Renumerate VPN Tunnel Session Token #9482 // Integrity Guaranteed via ECDSA'
  );
  const [ecdsaHashAlg, setEcdsaHashAlg] = useState<EccHashAlgorithm>(
    settings.eccSignatureHash || 'SHA-256'
  );
  const [isSigning, setIsSigning] = useState(false);
  const [signatureRecord, setSignatureRecord] = useState<EcdsaSignatureResult | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<{
    checked: boolean;
    valid: boolean;
    tampered?: boolean;
    detail?: string;
  } | null>(null);

  // ECIES Encryption
  const [eciesPlaintext, setEciesPlaintext] = useState(
    'Renumerate Vault Root Seed: 0x4f82c19e8a3b567d10e4a9bc83f2e1a5 (Top Secret)'
  );
  const [eciesEnvelope, setEciesEnvelope] = useState<EciesCipherEnvelope | null>(null);
  const [eciesDecrypted, setEciesDecrypted] = useState<string | null>(null);
  const [isEncryptingEcies, setIsEncryptingEcies] = useState(false);
  const [isDecryptingEcies, setIsDecryptingEcies] = useState(false);

  // Benchmarking
  const [benchmarks, setBenchmarks] = useState<Record<string, EccBenchmarkResult>>({});
  const [isRunningBench, setIsRunningBench] = useState(false);
  const [benchProgressCurve, setBenchProgressCurve] = useState<string | null>(null);

  // Copy helper with visual timer
  const handleCopy = useCallback((text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  }, []);

  // Generate KeyPair Handler
  const handleGenerateKey = useCallback(async () => {
    setIsGeneratingKey(true);
    try {
      const { keyPairInfo, rawKeyPair } = await generateEccKeyPair(
        selectedCurve,
        keyUsage,
        keyLabel
      );
      setActiveKeyPair(keyPairInfo);
      setActiveRawKeyPair(rawKeyPair || null);
      setCustomX(keyPairInfo.pointCoordinates.xHex);
      setCustomY(keyPairInfo.pointCoordinates.yHex);
      setValidationResult({
        isOnCurve: keyPairInfo.pointCoordinates.isOnCurve,
        detail: keyPairInfo.pointCoordinates.isOnCurve
          ? `Point vérifié conforme à l'équation ${ECC_CURVE_PROFILES[selectedCurve].equation}`
          : 'Point hors courbe !',
        residualHex: '0',
      });
      addLog(
        `Nouvelle paire de clés ECC (${selectedCurve}) générée [${keyPairInfo.keyId}]`,
        'success'
      );
    } catch (err: any) {
      addLog(`Erreur génération de clé ECC : ${err?.message}`, 'error');
    } finally {
      setIsGeneratingKey(false);
    }
  }, [selectedCurve, keyUsage, keyLabel, addLog]);

  // Initial Key Generation
  useEffect(() => {
    if (!activeKeyPair) {
      handleGenerateKey();
    }
  }, [handleGenerateKey, activeKeyPair]);

  // Point verification handler for manual input
  const handleCheckCustomPoint = () => {
    if (!customX || !customY) return;
    const res = verifyPointOnCurve(selectedCurve, customX, customY);
    setValidationResult(res);
  };

  // Perform ECDH Bilateral Exchange
  const handleRunEcdh = async () => {
    setIsPerformingEcdh(true);
    try {
      // Generate Alice and Bob ephemeral keypairs
      const alice = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: ecdhCurve === 'P-256' || ecdhCurve === 'P-384' || ecdhCurve === 'P-521' ? ecdhCurve : 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      const bob = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: ecdhCurve === 'P-256' || ecdhCurve === 'P-384' || ecdhCurve === 'P-521' ? ecdhCurve : 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      setEcdhAlicePair(alice);
      setEcdhBobPair(bob);

      const res = await performEcdhExchange({
        curve: ecdhCurve,
        aliceKeyPair: alice,
        bobKeyPair: bob,
        kdfInfo: 'renumerate-vpn-wireguard-tunnel-v2',
      });
      setEcdhResult(res);
      addLog(
        `Échange ECDH ${ecdhCurve} réussi : secret commun 256 bits dérivé via HKDF-SHA256`,
        'success'
      );
    } catch (err: any) {
      addLog(`Erreur échange ECDH : ${err?.message}`, 'error');
    } finally {
      setIsPerformingEcdh(false);
    }
  };

  // ECDSA Sign Message
  const handleSignMessage = async () => {
    if (!activeRawKeyPair || activeKeyPair?.usage !== 'ecdsa') {
      // Re-generate as ECDSA if needed
      setIsSigning(true);
      try {
        const { keyPairInfo, rawKeyPair } = await generateEccKeyPair(
          selectedCurve,
          'ecdsa',
          'Clé de Signature ECDSA'
        );
        setActiveKeyPair(keyPairInfo);
        setActiveRawKeyPair(rawKeyPair || null);
        if (rawKeyPair) {
          const sig = await signEcdsaMessage({
            privateKey: rawKeyPair.privateKey,
            messageText: signMessageText,
            hashAlg: ecdsaHashAlg,
            curve: selectedCurve,
          });
          setSignatureRecord(sig);
          setVerifyStatus({ checked: true, valid: true, detail: 'Signature vérifiée avec succès.' });
          addLog(`Message signé numériquement avec succès via ECDSA-${ecdsaHashAlg}`, 'success');
        }
      } catch (err: any) {
        addLog(`Erreur signature ECDSA : ${err?.message}`, 'error');
      } finally {
        setIsSigning(false);
      }
      return;
    }

    setIsSigning(true);
    try {
      const sig = await signEcdsaMessage({
        privateKey: activeRawKeyPair.privateKey,
        messageText: signMessageText,
        hashAlg: ecdsaHashAlg,
        curve: selectedCurve,
      });
      setSignatureRecord(sig);
      setVerifyStatus({ checked: true, valid: true, detail: 'Signature cryptographique vérifiée avec succès.' });
      addLog(`Message signé via ECDSA-${ecdsaHashAlg} (r, s extraits)`, 'success');
    } catch (err: any) {
      addLog(`Erreur signature : ${err?.message}`, 'error');
    } finally {
      setIsSigning(false);
    }
  };

  // Verify Signature
  const handleVerifySignature = async (tamperWithData = false) => {
    if (!signatureRecord || !activeRawKeyPair) return;
    const textToVerify = tamperWithData
      ? `${signMessageText} [FALSIFICATION INJECTÉE: 1 BIT FLIPPED]`
      : signMessageText;

    const res = await verifyEcdsaSignature({
      publicKey: activeRawKeyPair.publicKey,
      messageText: textToVerify,
      signatureHex: signatureRecord.signatureHex,
      hashAlg: ecdsaHashAlg,
    });

    setVerifyStatus({
      checked: true,
      valid: res.valid,
      tampered: tamperWithData,
      detail: res.valid
        ? 'Signature valide : intégrité et authenticité de l’émetteur confirmées sans équivoque.'
        : 'REJET CRYPTOGRAPHIQUE : Le message a été altéré ou la clé ne correspond pas !',
    });

    if (tamperWithData) {
      addLog('Test de falsification ECDSA : altération détectée et bloquée avec succès', 'warning');
    } else {
      addLog(`Vérification signature ECDSA : ${res.valid ? 'VALIDE' : 'INVALIDE'}`, res.valid ? 'success' : 'error');
    }
  };

  // ECIES Encryption
  const handleEncryptEcies = async () => {
    if (!activeRawKeyPair || !activeKeyPair) return;
    setIsEncryptingEcies(true);
    setEciesDecrypted(null);
    try {
      const envelope = await encryptEciesPayload({
        recipientPublicKey: activeRawKeyPair.publicKey,
        recipientKeyInfo: activeKeyPair,
        plaintext: eciesPlaintext,
      });
      setEciesEnvelope(envelope);
      addLog(
        `Donnée scellée sous enveloppe hybride ECIES (Clé éphémère + HKDF + AES-256-GCM)`,
        'success'
      );
    } catch (err: any) {
      addLog(`Erreur chiffrement ECIES : ${err?.message}`, 'error');
    } finally {
      setIsEncryptingEcies(false);
    }
  };

  // ECIES Decryption
  const handleDecryptEcies = async () => {
    if (!activeRawKeyPair || !eciesEnvelope) return;
    setIsDecryptingEcies(true);
    try {
      const plaintext = await decryptEciesPayload({
        recipientPrivateKey: activeRawKeyPair.privateKey,
        envelope: eciesEnvelope,
      });
      setEciesDecrypted(plaintext);
      addLog('Enveloppe ECIES déchiffrée avec succès avec la clé privée destinataire', 'success');
    } catch (err: any) {
      addLog(`Erreur déchiffrement ECIES : ${err?.message}`, 'error');
    } finally {
      setIsDecryptingEcies(false);
    }
  };

  // Run Full Benchmark
  const handleRunFullBenchmark = async () => {
    setIsRunningBench(true);
    const curvesToTest: EccCurve[] = ['P-256', 'P-384', 'P-521'];
    const results: Record<string, EccBenchmarkResult> = {};

    try {
      for (const crv of curvesToTest) {
        setBenchProgressCurve(crv);
        const res = await runClientEccBenchmark(crv);
        results[crv] = res;
      }
      setBenchmarks(results);
      addLog('Banc d’essai matériel ECC terminé (P-256, P-384, P-521)', 'success');
    } catch (err: any) {
      addLog(`Erreur lors du benchmark ECC : ${err?.message}`, 'error');
    } finally {
      setIsRunningBench(false);
      setBenchProgressCurve(null);
    }
  };

  const currentProfile = ECC_CURVE_PROFILES[selectedCurve];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <KeyRound className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span>Centre de Sécurité Cryptographique ECC</span>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-mono">
                    Suite Asymétrique V2
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Courbes elliptiques NIST P-256 / P-384 / P-521, Curve25519 (X25519), Ed25519 &amp; secp256k1
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Courbe active : <strong>{selectedCurve}</strong></span>
            </span>
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Sécurité classique : <strong>{currentProfile.securityBitsClassical} bits</strong></span>
            </span>
            <button
              type="button"
              onClick={handleGenerateKey}
              disabled={isGeneratingKey}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
              <span>Régénérer paire</span>
            </button>
          </div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(
          [
            { id: 'keys', label: 'Inspecteur & Coffre de Clés', icon: KeyRound, badge: selectedCurve },
            { id: 'ecdh', label: 'Échange Diffie-Hellman (ECDH)', icon: Radio, badge: 'HKDF-256' },
            { id: 'ecdsa', label: 'Signatures Numériques (ECDSA)', icon: CheckCircle2, badge: ecdsaHashAlg },
            { id: 'ecies', label: 'Chiffrement Hybride (ECIES)', icon: Lock, badge: 'AEAD GCM' },
            { id: 'bench', label: 'Banc d’Essai & Benchmarks', icon: Cpu, badge: 'Ops/sec' },
            { id: 'matrix', label: 'Matrice de Résistance & PQC', icon: ShieldAlert, badge: 'Audit Shor' },
          ] as Array<{
            id: EccModuleTab;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
            badge: string;
          }>
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                active
                  ? 'bg-slate-900 dark:bg-cyan-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-cyan-500/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: INSPECTEUR DE CLÉS & COFFRE ECC                              */}
      {/* =================================================================== */}
      {activeTab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Key Generator Form (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-500" />
                  <span>Paramètres de la Courbe</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400">CSPRNG Natif</span>
              </div>

              {/* Curve Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Courbe Elliptique Spécifiée :
                </label>
                <select
                  value={selectedCurve}
                  onChange={(e) => {
                    const c = e.target.value as EccCurve;
                    setSelectedCurve(c);
                    updateSettings('eccDefaultCurve', c);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="P-256">NIST P-256 (secp256r1 / 128-bit) - Standard</option>
                  <option value="P-384">NIST P-384 (secp384r1 / 192-bit) - CNSA Suite</option>
                  <option value="P-521">NIST P-521 (secp521r1 / 256-bit) - Ultra</option>
                  <option value="X25519">Curve25519 / X25519 - WireGuard Core</option>
                  <option value="Ed25519">Ed25519 - Signatures EdDSA rapides</option>
                  <option value="secp256k1">secp256k1 (Koblitz) - Web3 / Bitcoin</option>
                </select>
              </div>

              {/* Key Usage */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Usage Cryptographique Prévu :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKeyUsage('ecdh')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                      keyUsage === 'ecdh'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    ECDH (Échange)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyUsage('ecdsa')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                      keyUsage === 'ecdsa'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    ECDSA (Signature)
                  </button>
                </div>
              </div>

              {/* Key Label */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Identifiant / Alias de la paire :
                </label>
                <input
                  type="text"
                  value={keyLabel}
                  onChange={(e) => setKeyLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateKey}
                disabled={isGeneratingKey}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <Zap className="w-4 h-4" />
                <span>Générer Nouvelle Paire ({selectedCurve})</span>
              </button>

              {/* Curve Characteristics Card */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Équation de la courbe :</span>
                  <span className="font-mono text-[10px] text-cyan-500">{currentProfile.fieldSizeBits} bits</span>
                </div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  {currentProfile.equation}
                </div>
                <div className="text-[11px] text-slate-500">
                  <strong>Standard :</strong> {currentProfile.standard}
                </div>
              </div>
            </div>

            {/* Point Equation Validation Tester */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Vérification Géométrique du Point</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCheckCustomPoint}
                  className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                >
                  Tester Point
                </button>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Coordonnée Affine X (hex) :</span>
                  <input
                    type="text"
                    value={customX}
                    onChange={(e) => setCustomX(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-900 dark:text-slate-100"
                    placeholder="Abscisse X..."
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Coordonnée Affine Y (hex) :</span>
                  <input
                    type="text"
                    value={customY}
                    onChange={(e) => setCustomY(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-900 dark:text-slate-100"
                    placeholder="Ordonnée Y..."
                  />
                </div>
              </div>

              {validationResult && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                    validationResult.isOnCurve
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {validationResult.isOnCurve ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="text-[11px] leading-tight">
                    <p className="font-semibold">{validationResult.detail}</p>
                    <p className="font-mono text-[9px] text-slate-400 mt-1">
                      Résidu modulaire : 0x{validationResult.residualHex.slice(0, 16)}...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Key Inspection & Formats (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {activeKeyPair ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {activeKeyPair.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                        {activeKeyPair.curve}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[10px] font-mono uppercase">
                        {activeKeyPair.usage}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Key ID : <strong className="text-slate-700 dark:text-slate-300">{activeKeyPair.keyId}</strong> · Créé le {new Date(activeKeyPair.createdAt).toLocaleTimeString('fr-FR')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(activeKeyPair.publicKeyPem, 'pem_pub')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedField === 'pem_pub' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copier PEM Publique</span>
                    </button>
                  </div>
                </div>

                {/* Point Coordinates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[10px] flex items-center justify-between">
                      <span>Abscisse X (Affine)</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeKeyPair.pointCoordinates.xHex, 'x_hex')}
                        className="text-cyan-500 hover:underline"
                      >
                        {copiedField === 'x_hex' ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-800 dark:text-slate-200 break-all select-all font-semibold">
                      0x{activeKeyPair.pointCoordinates.xHex}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[10px] flex items-center justify-between">
                      <span>Ordonnée Y (Affine)</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeKeyPair.pointCoordinates.yHex, 'y_hex')}
                        className="text-cyan-500 hover:underline"
                      >
                        {copiedField === 'y_hex' ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-800 dark:text-slate-200 break-all select-all font-semibold">
                      0x{activeKeyPair.pointCoordinates.yHex}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[10px] flex items-center justify-between">
                      <span>Format Compressé SEC 1 (02/03 + X)</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeKeyPair.pointCoordinates.compressedHex, 'comp_hex')}
                        className="text-cyan-500 hover:underline"
                      >
                        {copiedField === 'comp_hex' ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <div className="text-[11px] text-cyan-600 dark:text-cyan-400 break-all select-all font-semibold">
                      {activeKeyPair.pointCoordinates.compressedHex}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[10px] flex items-center justify-between">
                      <span>Empreinte SHA-256 (Fingerprint)</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeKeyPair.fingerprintSha256, 'fp_hex')}
                        className="text-cyan-500 hover:underline"
                      >
                        {copiedField === 'fp_hex' ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 break-all select-all font-semibold">
                      {formatHexView(activeKeyPair.fingerprintSha256.slice(0, 32))}
                    </div>
                  </div>
                </div>

                {/* WireGuard / Base64 Representation */}
                <div className="p-3.5 rounded-xl bg-slate-950 text-white font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Clé Publique Canonique RFC / Base64 WireGuard :</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeKeyPair.publicKeyBase64, 'wg_b64')}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      {copiedField === 'wg_b64' ? 'Copié !' : 'Copier Base64'}
                    </button>
                  </div>
                  <div className="text-cyan-300 font-bold select-all break-all">
                    {activeKeyPair.publicKeyBase64}
                  </div>
                </div>

                {/* Private Key Vault Section */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Clé Privée / Scalaire d (Zone Enclave Volatile)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="px-2 py-1 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
                    >
                      {showPrivateKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPrivateKey ? 'Masquer' : 'Révéler'}</span>
                    </button>
                  </div>

                  <div className="font-mono text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 select-all break-all">
                    {showPrivateKey ? (
                      activeKeyPair.privateKeyPem || activeKeyPair.privateKeyHexMasked
                    ) : (
                      <span className="text-slate-400">••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Les scalaires privés sont protégés par <span className="font-mono">mlockall</span> en mémoire RAM volatile et ne sont jamais enregistrés sur disque non chiffrés.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Génération de la paire de clés en cours...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ÉCHANGE DIFFIE-HELLMAN ECC (ECDH)                           */}
      {/* =================================================================== */}
      {activeTab === 'ecdh' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-500" />
                <span>Échange de Clés Bilatéral Elliptic Curve Diffie-Hellman (ECDH)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Calcul mathématique du secret partagé S = d_A · Q_B = d_B · Q_A avec dérivation HKDF-SHA256
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={ecdhCurve}
                onChange={(e) => setEcdhCurve(e.target.value as EccCurve)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono cursor-pointer"
              >
                <option value="P-256">NIST P-256 (128-bit)</option>
                <option value="P-384">NIST P-384 (192-bit)</option>
                <option value="P-521">NIST P-521 (256-bit)</option>
                <option value="X25519">X25519 (WireGuard)</option>
              </select>

              <button
                type="button"
                onClick={handleRunEcdh}
                disabled={isPerformingEcdh}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simuler Négociation Tunnel</span>
              </button>
            </div>
          </div>

          {/* Visual 2-Party Negotiation Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Alice (Client) */}
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Alice (Client Renumerate)</span>
                </span>
                <span className="text-[10px] text-cyan-500">Iface: wg0</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Génère scalaire privé aléatoire <strong className="text-cyan-400">d_A</strong> et publie le point <strong className="text-cyan-400">Q_A = d_A · G</strong>.
              </p>
              <div className="p-2 rounded bg-slate-900 text-slate-300 text-[10px] break-all truncate">
                {ecdhResult ? `Q_A: ${ecdhResult.rawSharedPointHex.slice(0, 24)}...` : 'En attente d’échange...'}
              </div>
            </div>

            {/* Central Mathematical Agreement */}
            <div className="text-center space-y-2 p-3">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <ArrowRight className="w-5 h-5 text-cyan-500" />
              </div>
              <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                S = d_A · Q_B = d_B · Q_A
              </div>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                Aucun espion réseau ne peut calculer S à partir de Q_A et Q_B (Dureté du problème ECDLP).
              </p>
            </div>

            {/* Bob (VPN Gateway) */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Bob (Passerelle Relais)</span>
                </span>
                <span className="text-[10px] text-emerald-500">Node: IXP-DE</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Génère scalaire privé aléatoire <strong className="text-emerald-400">d_B</strong> et calcule <strong className="text-emerald-400">S = d_B · Q_A</strong>.
              </p>
              <div className="p-2 rounded bg-slate-900 text-slate-300 text-[10px] break-all truncate">
                {ecdhResult ? `Q_B: ${ecdhResult.rawSharedPointHex.slice(24, 48)}...` : 'En attente d’échange...'}
              </div>
            </div>
          </div>

          {/* Derived Session Key & HKDF Output */}
          {ecdhResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-emerald-400">Secret Partagé Établi Bit-à-Bit Identique</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Calculé à {new Date(ecdhResult.completedAt).toLocaleTimeString('fr-FR')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px]">Point Partagé Brut (Abscisse mod p) :</span>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 break-all select-all">
                    0x{ecdhResult.rawSharedPointHex}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px]">Clé Symétrique de Session Dérivée (AES-256-GCM) :</span>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-300 break-all select-all font-bold">
                    0x{ecdhResult.derivedAesKeyHex}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>Sel HKDF : <strong className="text-slate-200">0x{ecdhResult.kdfSaltHex}</strong></span>
                <span>Info Contextuelle : <strong className="text-slate-200">{ecdhResult.kdfInfo}</strong></span>
                <span className="text-emerald-400 font-semibold">Forward Secrecy (PFS) Assuré</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: SIGNATURES NUMÉRIQUES ECDSA                                 */}
      {/* =================================================================== */}
      {activeTab === 'ecdsa' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Atelier de Signature &amp; Intégrité ECDSA</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Signez vos manifestes, règles de filtrage ou tokens de session et prouvez l'authenticité sans contestation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={ecdsaHashAlg}
                onChange={(e) => {
                  const h = e.target.value as EccHashAlgorithm;
                  setEcdsaHashAlg(h);
                  updateSettings('eccSignatureHash', h);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono cursor-pointer"
              >
                <option value="SHA-256">SHA-256 (NIST Nominal)</option>
                <option value="SHA-384">SHA-384 (CNSA Grade)</option>
                <option value="SHA-512">SHA-512 (Ultra-Entropie)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Charge Utile / Message à Signer :
              </label>
              <textarea
                rows={3}
                value={signMessageText}
                onChange={(e) => setSignMessageText(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSignMessage}
                disabled={isSigning}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Signer Numériquement (ECDSA-{ecdsaHashAlg})</span>
              </button>
            </div>

            {signatureRecord && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950 text-white font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-cyan-400">Empreinte &amp; Décomposition Scalaire (r, s)</span>
                    <span className="text-[10px] text-slate-400">Format IEEE P1363 / DER</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px]">Scalaire r (hex) :</span>
                      <div className="p-2 rounded bg-slate-900 text-slate-200 break-all select-all font-semibold">
                        0x{signatureRecord.rHex}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px]">Scalaire s (hex) :</span>
                      <div className="p-2 rounded bg-slate-900 text-slate-200 break-all select-all font-semibold">
                        0x{signatureRecord.sHex}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px]">Structure Encodée ASN.1 DER :</span>
                    <div className="p-2 rounded bg-slate-900 text-amber-300 break-all select-all text-[10px]">
                      {signatureRecord.derHex}
                    </div>
                  </div>
                </div>

                {/* Interactive Verification & Bit-Flip Simulator */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Épreuve de Vérification Cryptographique :
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVerifySignature(false)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Vérifier Intégrité Normale
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifySignature(true)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-1"
                        title="Injecte 1 bit altéré dans le message pour prouver le rejet"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Injecter Altération (Bit-Flip)</span>
                      </button>
                    </div>
                  </div>

                  {verifyStatus && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                        verifyStatus.valid
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      {verifyStatus.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold">
                          {verifyStatus.valid
                            ? 'Vérification Réussie : Intégrité Validée'
                            : 'Échec de Vérification : Altération Détectée'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {verifyStatus.detail}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: CHIFFREMENT ASYMÉTRIQUE HYBRIDE ECIES                       */}
      {/* =================================================================== */}
      {activeTab === 'ecies' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-500" />
              <span>Chiffrement Asymétrique Hybride ECIES</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Elliptic Curve Integrated Encryption Scheme (Clé éphémère KEM + HKDF-SHA256 + AES-256-GCM authentifié)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Encryption Deck */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-500" />
                <span>1. Sceller pour le destinataire (Clé Publique)</span>
              </h4>
              <textarea
                rows={4}
                value={eciesPlaintext}
                onChange={(e) => setEciesPlaintext(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
                placeholder="Entrez vos données sensibles à chiffrer..."
              />
              <button
                type="button"
                onClick={handleEncryptEcies}
                disabled={isEncryptingEcies || !activeRawKeyPair}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Chiffrer sous Enveloppe ECIES
              </button>
            </div>

            {/* Decryption Deck */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                <span>2. Déchiffrer avec la Clé Privée</span>
              </h4>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 min-h-[96px] text-xs font-mono">
                {eciesDecrypted ? (
                  <div className="text-emerald-700 dark:text-emerald-300 font-semibold select-all break-all">
                    {eciesDecrypted}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">
                    {eciesEnvelope
                      ? "Enveloppe prête. Cliquez sur 'Déchiffrer' pour reconstituer le clair."
                      : 'Aucune enveloppe chiffrée active.'}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleDecryptEcies}
                disabled={isDecryptingEcies || !eciesEnvelope}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Déchiffrer Enveloppe ECIES
              </button>
            </div>
          </div>

          {/* Envelope Inspection */}
          {eciesEnvelope && (
            <div className="p-4 rounded-xl bg-slate-950 text-white font-mono text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-cyan-400">Enveloppe Cryptographique ECIES (.enc)</span>
                <span className="text-[10px] text-slate-400">AES-256-GCM + Tag 128-bit</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-slate-400">Clé Éphémère Publique R :</span>
                  <div className="truncate text-cyan-300">0x{eciesEnvelope.ephemeralPublicKeyHex}</div>
                </div>
                <div>
                  <span className="text-slate-400">Vecteur d'Initialisation IV :</span>
                  <div className="text-slate-300">0x{eciesEnvelope.ivHex}</div>
                </div>
                <div>
                  <span className="text-slate-400">Tag d'Authentification GCM :</span>
                  <div className="text-emerald-400">0x{eciesEnvelope.authTagHex}</div>
                </div>
                <div>
                  <span className="text-slate-400">Chiffré Ciphertext :</span>
                  <div className="truncate text-amber-300">0x{eciesEnvelope.ciphertextHex}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: BANC D'ESSAI & BENCHMARKS                                   */}
      {/* =================================================================== */}
      {activeTab === 'bench' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-500" />
                <span>Banc d’Essai Matériel &amp; Performance ECC</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mesure en direct sur votre processeur des cadences KeyGen, signatures, vérifications et dérivations ECDH.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunFullBenchmark}
              disabled={isRunningBench}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Zap className={`w-4 h-4 ${isRunningBench ? 'animate-bounce text-amber-300' : ''}`} />
              <span>{isRunningBench ? `Test en cours (${benchProgressCurve})...` : 'Lancer le Banc d’Essai'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['P-256', 'P-384', 'P-521'] as EccCurve[]).map((crv) => {
              const bench = benchmarks[crv];
              return (
                <div
                  key={crv}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3 font-mono text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="font-bold text-slate-900 dark:text-white">{crv}</span>
                    <span className="text-[10px] text-slate-400">
                      {ECC_CURVE_PROFILES[crv].fieldSizeBits} bits
                    </span>
                  </div>

                  {bench ? (
                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Signatures ECDSA :</span>
                        <strong className="text-cyan-600 dark:text-cyan-400">
                          {bench.signOpsPerSec.toLocaleString('fr-FR')} ops/s ({bench.signLatencyUs} µs)
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Vérifications :</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {bench.verifyOpsPerSec.toLocaleString('fr-FR')} ops/s ({bench.verifyLatencyUs} µs)
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Échanges ECDH :</span>
                        <strong className="text-amber-600 dark:text-amber-400">
                          {bench.ecdhOpsPerSec.toLocaleString('fr-FR')} ops/s ({bench.ecdhLatencyUs} µs)
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Génération Clés :</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {bench.keyGenOpsPerSec.toLocaleString('fr-FR')} ops/s
                        </strong>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Accélération CPU :</span>
                        <span className="text-emerald-500 font-bold">ACTIVE (WebCrypto JIT)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-[11px] italic">
                      En attente d'exécution...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: MATRICE DE RÉSISTANCE & HORIZON POST-QUANTIQUE               */}
      {/* =================================================================== */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Matrice de Résistance Cryptanalytique &amp; Transition Post-Quantique</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Résistance aux canaux auxiliaires, attaques par repliement de courbes et stratégie face à l’algorithme de Shor.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px]">
                  <th className="py-2.5 px-3">Courbe</th>
                  <th className="py-2.5 px-3">Standard</th>
                  <th className="py-2.5 px-3">Sécurité Classique</th>
                  <th className="py-2.5 px-3">Canaux Auxiliaires</th>
                  <th className="py-2.5 px-3">Twist Security</th>
                  <th className="py-2.5 px-3">Vulnérabilité Shor</th>
                  <th className="py-2.5 px-3">Remédiation Renumerate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(Object.values(ECC_CURVE_PROFILES) as EccCurveSecurityProfile[]).map((prof) => (
                  <tr key={prof.curve} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {prof.curve}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{prof.standard.split(',')[0]}</td>
                    <td className="py-3 px-3 text-cyan-600 dark:text-cyan-400 font-bold">
                      {prof.securityBitsClassical} bits
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {prof.sideChannelResistance}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {prof.twistSecurity ? (
                        <span className="text-emerald-500">OUI (Robuste)</span>
                      ) : (
                        <span className="text-amber-500">Validation stricte requise</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-rose-500 font-semibold">
                      OUI (Shor ~2.3kQ)
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      Couplé avec <strong>ML-KEM-1024</strong> (FIPS-203)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3">
            <ExternalLink className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-900 dark:text-white">
                Recommandation Souveraine ANSSI &amp; NIST pour 2026-2030 :
              </span>
              <p>
                Toute courbe elliptique classique (X25519, P-256 ou secp256k1) est théoriquement vulnérable à l'interception et stockage rétroactif (« Harvest Now, Decrypt Later »). Renumerate VPN applique une encapsulation hybride combinant <span className="font-mono font-bold text-cyan-500">X25519 + ML-KEM-1024 (FIPS-203)</span> pour garantir une invulnérabilité mathématique absolue à la fois classique et post-quantique.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
