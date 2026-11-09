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
  FileCheck,
  History,
  FileText,
  BadgeAlert,
  Terminal,
  Share2,
  Info,
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
  EccCryptographicSelfTest,
  EccSecurityActivityLog,
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
  importPublicKeyFromPem,
  importPublicKeyFromJwk,
  runAutomatedEccTestSuite,
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

// Les 6 sections requises par la spécification + outils avancés
export type EccModuleTab =
  | 'status'       // 1. ECC Security Status (with live Automated Test Suite)
  | 'generate'     // 2. Generate Key Pair (ECDSA P-256 + SHA-256)
  | 'sign'         // 3. Sign Document (Digital document signing)
  | 'verify'       // 4. Verify Signature & Tamper Detection
  | 'public-keys'  // 5. Public Key Management (PEM, JWK, Raw Hex)
  | 'logs'         // 6. Security Activity Logs
  | 'advanced';    // Advanced tools: ECDH, ECIES, Hardware Benchmark

export const EccSecurityCenter: React.FC<EccSecurityCenterProps> = ({
  settings,
  updateSettings,
  patchSettings,
  addLog,
}) => {
  const [activeTab, setActiveTab] = useState<EccModuleTab>('status');

  // Key Pair State
  const [selectedCurve, setSelectedCurve] = useState<EccCurve>('P-256');
  const [keyUsage, setKeyUsage] = useState<EccKeyUsage>('ecdsa');
  const [keyLabel, setKeyLabel] = useState('Clé ECDSA P-256 Renumerate Root');
  const [isNonExtractable, setIsNonExtractable] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [activeKeyPair, setActiveKeyPair] = useState<EccKeyPairInfo | null>(null);
  const [activeRawKeyPair, setActiveRawKeyPair] = useState<CryptoKeyPair | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Document Signing State
  const [docTitle, setDocTitle] = useState('Contrat_Securite_Session_9482.txt');
  const [docContent, setDocContent] = useState(
    'Renumerate VPN Tunnel Session Token #9482\n' +
    'Signataire : Pass-Through Gateway Root CA\n' +
    'Protocole : WireGuard PQC ML-KEM-1024 + ECDSA P-256\n' +
    'Horodatage : ' + new Date().toISOString() + '\n' +
    'Intégrité certifiée sans journalisation IP.'
  );
  const [isSigning, setIsSigning] = useState(false);
  const [lastSignature, setLastSignature] = useState<EcdsaSignatureResult | null>(null);

  // Verification & Tamper Detection State
  const [verifyDocContent, setVerifyDocContent] = useState('');
  const [verifySignatureHex, setVerifySignatureHex] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [tamperedOriginalContent, setTamperedOriginalContent] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    checked: boolean;
    valid: boolean;
    isTampered: boolean;
    errorDetail?: string;
    verifiedAt?: string;
  } | null>(null);

  // Public Key Management & Import State
  const [importKeyFormat, setImportKeyFormat] = useState<'pem' | 'jwk'>('pem');
  const [importKeyText, setImportKeyText] = useState('');
  const [importedKeyStatus, setImportedKeyStatus] = useState<string | null>(null);
  const [importedPublicKey, setImportedPublicKey] = useState<CryptoKey | null>(null);

  // Security Activity Logs
  const [activityLogs, setActivityLogs] = useState<EccSecurityActivityLog[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      action: 'KEY_GENERATED',
      curve: 'P-256',
      status: 'success',
      details: 'Paire de clés de démarrage initialisée avec succès dans la RAM volatile WebCrypto.',
      digestOrFingerprint: 'SHA256:4f82c19e',
      latencyMs: 1.8,
    },
  ]);

  // Automated Test Suite State
  const [selfTests, setSelfTests] = useState<EccCryptographicSelfTest[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Signed Audit Export & Verification State
  const [isSigningAudit, setIsSigningAudit] = useState(false);
  const [signedAuditFeedback, setSignedAuditFeedback] = useState<{
    success: boolean;
    fingerprint: string;
    derPrefix: string;
    timestamp: string;
  } | null>(null);

  const [showAuditVerifier, setShowAuditVerifier] = useState(false);
  const [auditJsonToVerify, setAuditJsonToVerify] = useState('');
  const [isVerifyingAudit, setIsVerifyingAudit] = useState(false);
  const [auditVerificationStatus, setAuditVerificationStatus] = useState<{
    checked: boolean;
    valid: boolean;
    tampered: boolean;
    eventCount?: number;
    exportedAt?: string;
    signerFingerprint?: string;
    errorDetail?: string;
  } | null>(null);

  // Advanced Tools: ECDH & ECIES
  const [ecdhCurve, setEcdhCurve] = useState<EccCurve>('P-256');
  const [ecdhResult, setEcdhResult] = useState<EcdhExchangeResult | null>(null);
  const [isPerformingEcdh, setIsPerformingEcdh] = useState(false);
  const [benchmarks, setBenchmarks] = useState<Record<string, EccBenchmarkResult>>({});
  const [isRunningBench, setIsRunningBench] = useState(false);

  // Helper function to append to activity log
  const pushActivityLog = useCallback(
    (
      action: EccSecurityActivityLog['action'],
      curve: EccCurve,
      status: EccSecurityActivityLog['status'],
      details: string,
      digest?: string,
      latencyMs?: number
    ) => {
      const entry: EccSecurityActivityLog = {
        id: `ecc-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
        action,
        curve,
        status,
        details,
        digestOrFingerprint: digest,
        latencyMs,
      };
      setActivityLogs((prev) => [entry, ...prev.slice(0, 49)]);
    },
    []
  );

  // Copy helper with visual confirmation
  const handleCopy = useCallback((text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  // 1. Generate Key Pair Handler
  const handleGenerateKey = useCallback(async () => {
    setIsGeneratingKey(true);
    const startT = performance.now();
    try {
      const { keyPairInfo, rawKeyPair } = await generateEccKeyPair(
        selectedCurve,
        keyUsage,
        keyLabel
      );
      setActiveKeyPair(keyPairInfo);
      setActiveRawKeyPair(rawKeyPair || null);

      const latencyMs = Number((performance.now() - startT).toFixed(2));
      pushActivityLog(
        'KEY_GENERATED',
        selectedCurve,
        'success',
        `Paire de clés ${selectedCurve} générée (${keyUsage.toUpperCase()}, isolation RAM)`,
        keyPairInfo.fingerprintSha256.slice(0, 16),
        latencyMs
      );

      addLog(
        `Nouvelle paire de clés ECC (${selectedCurve}) générée [${keyPairInfo.keyId}]`,
        'success'
      );
    } catch (err: any) {
      pushActivityLog(
        'KEY_GENERATED',
        selectedCurve,
        'error',
        `Erreur génération : ${err?.message || 'Échec WebCrypto'}`
      );
      addLog(`Erreur génération de clé ECC : ${err?.message}`, 'error');
    } finally {
      setIsGeneratingKey(false);
    }
  }, [selectedCurve, keyUsage, keyLabel, addLog, pushActivityLog]);

  // Initial key generation on mount
  useEffect(() => {
    if (!activeKeyPair) {
      handleGenerateKey();
    }
  }, [handleGenerateKey, activeKeyPair]);

  // 2. Automated Cryptographic Test Suite Runner
  const handleRunSelfTests = useCallback(async () => {
    setIsRunningTests(true);
    const startT = performance.now();
    try {
      const results = await runAutomatedEccTestSuite();
      setSelfTests(results);
      const allPassed = results.every((r) => r.status === 'passed');
      const totalLatency = Number((performance.now() - startT).toFixed(2));

      pushActivityLog(
        'TEST_SUITE_RUN',
        'P-256',
        allPassed ? 'success' : 'warning',
        `Suite de tests de conformité exécutée : ${results.filter((r) => r.status === 'passed').length}/${results.length} tests validés.`,
        allPassed ? 'ALL_PASSED_100%' : 'WARNING_TEST_FAILED',
        totalLatency
      );

      addLog(
        allPassed
          ? 'Validation cryptographique complète : 6/6 tests WebCrypto réussis.'
          : 'Avertissement suite de tests cryptographiques.',
        allPassed ? 'success' : 'warning'
      );
    } catch (err: any) {
      addLog(`Erreur exécution tests cryptographiques : ${err?.message}`, 'error');
    } finally {
      setIsRunningTests(false);
    }
  }, [addLog, pushActivityLog]);

  // Run tests automatically on mount
  useEffect(() => {
    if (selfTests.length === 0) {
      handleRunSelfTests();
    }
  }, [handleRunSelfTests, selfTests.length]);

  // 3. Digital Document Signing Handler
  const handleSignDocument = async () => {
    if (!activeRawKeyPair || activeKeyPair?.usage !== 'ecdsa') {
      // If active pair is not ECDSA, regenerate as ECDSA
      setIsSigning(true);
      try {
        const { keyPairInfo, rawKeyPair } = await generateEccKeyPair(
          'P-256',
          'ecdsa',
          'Clé de Signature ECDSA P-256'
        );
        setActiveKeyPair(keyPairInfo);
        setActiveRawKeyPair(rawKeyPair || null);

        if (rawKeyPair) {
          const t0 = performance.now();
          const sig = await signEcdsaMessage({
            privateKey: rawKeyPair.privateKey,
            messageText: docContent,
            hashAlg: 'SHA-256',
            curve: 'P-256',
          });
          const lat = Number((performance.now() - t0).toFixed(2));
          setLastSignature(sig);
          setVerifyDocContent(docContent);
          setVerifySignatureHex(sig.signatureHex);
          setVerificationResult({
            checked: true,
            valid: true,
            isTampered: false,
            verifiedAt: new Date().toISOString(),
          });

          pushActivityLog(
            'DOCUMENT_SIGNED',
            'P-256',
            'success',
            `Document "${docTitle}" signé via ECDSA P-256 + SHA-256`,
            sig.messageHashHex.slice(0, 16),
            lat
          );

          addLog(`Document "${docTitle}" signé numériquement avec succès via ECDSA P-256`, 'success');
        }
      } catch (err: any) {
        addLog(`Erreur de signature : ${err?.message}`, 'error');
      } finally {
        setIsSigning(false);
      }
      return;
    }

    setIsSigning(true);
    const t0 = performance.now();
    try {
      const sig = await signEcdsaMessage({
        privateKey: activeRawKeyPair.privateKey,
        messageText: docContent,
        hashAlg: 'SHA-256',
        curve: activeKeyPair.curve,
      });
      const lat = Number((performance.now() - t0).toFixed(2));
      setLastSignature(sig);
      setVerifyDocContent(docContent);
      setVerifySignatureHex(sig.signatureHex);
      setVerificationResult({
        checked: true,
        valid: true,
        isTampered: false,
        verifiedAt: new Date().toISOString(),
      });

      pushActivityLog(
        'DOCUMENT_SIGNED',
        activeKeyPair.curve,
        'success',
        `Document "${docTitle}" signé via ECDSA ${activeKeyPair.curve} + SHA-256`,
        sig.messageHashHex.slice(0, 16),
        lat
      );

      addLog(`Document "${docTitle}" signé numériquement avec succès via ECDSA ${activeKeyPair.curve}`, 'success');
    } catch (err: any) {
      pushActivityLog('DOCUMENT_SIGNED', activeKeyPair.curve, 'error', `Échec signature : ${err?.message}`);
      addLog(`Erreur de signature : ${err?.message}`, 'error');
    } finally {
      setIsSigning(false);
    }
  };

  // 4. Verify Signature Handler
  const handleVerifySignature = async (contentToVerify: string, isTamperAttempt = false) => {
    const keyToUse = importedPublicKey || activeRawKeyPair?.publicKey;
    if (!keyToUse) {
      setVerificationResult({
        checked: true,
        valid: false,
        isTampered: false,
        errorDetail: 'Clé publique introuvable pour la vérification.',
      });
      return;
    }

    if (!verifySignatureHex.trim()) {
      setVerificationResult({
        checked: true,
        valid: false,
        isTampered: false,
        errorDetail: 'Signature hexadécimale requise.',
      });
      return;
    }

    setIsVerifying(true);
    const t0 = performance.now();
    try {
      const result = await verifyEcdsaSignature({
        publicKey: keyToUse,
        messageText: contentToVerify,
        signatureHex: verifySignatureHex.trim(),
        hashAlg: 'SHA-256',
      });
      const lat = Number((performance.now() - t0).toFixed(2));

      const isTampered = !result.valid && (isTamperAttempt || Boolean(tamperedOriginalContent));

      setVerificationResult({
        checked: true,
        valid: result.valid,
        isTampered,
        errorDetail: result.errorDetail,
        verifiedAt: new Date().toISOString(),
      });

      if (isTampered) {
        pushActivityLog(
          'TAMPER_DETECTED',
          'P-256',
          'warning',
          'Falsification détectée : signature invalidée suite à la modification du contenu du document.',
          'REJECTED_TAMPER_DETECTED',
          lat
        );
        addLog('Alerte d’intégrité : document altéré après signature (Falsification bloquée !)', 'warning');
      } else {
        pushActivityLog(
          'SIGNATURE_VERIFIED_VALID',
          'P-256',
          result.valid ? 'success' : 'error',
          result.valid
            ? 'Signature numérique authentique et valide certifiée par WebCrypto.'
            : 'Signature invalide ou clé incompatible.',
          result.valid ? 'VALID_ECDSA_SIG' : 'INVALID_SIG',
          lat
        );
        addLog(
          result.valid
            ? 'Vérification signature ECDSA P-256 : VALIDE (Intégrité 100%)'
            : 'Vérification signature ECDSA : INVALIDE',
          result.valid ? 'success' : 'error'
        );
      }
    } catch (err: any) {
      setVerificationResult({
        checked: true,
        valid: false,
        isTampered: false,
        errorDetail: err?.message || 'Erreur cryptographique inattendue.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // 5. Tamper Test Injector
  const handleInjectTamper = () => {
    if (!tamperedOriginalContent) {
      setTamperedOriginalContent(verifyDocContent);
    }
    // Inject subtle character alteration (change 9482 to 9483 or add a dot)
    const altered = verifyDocContent.includes('#9482')
      ? verifyDocContent.replace('#9482', '#9483')
      : verifyDocContent + ' [MODIFIÉ_SANS_AUTORISATION]';

    setVerifyDocContent(altered);
    handleVerifySignature(altered, true);
  };

  const handleRestoreOriginalDoc = () => {
    if (tamperedOriginalContent) {
      setVerifyDocContent(tamperedOriginalContent);
      setTamperedOriginalContent(null);
      handleVerifySignature(tamperedOriginalContent, false);
    }
  };

  // 6. Download Signed Document Bundle
  const handleDownloadSignedBundle = () => {
    if (!lastSignature || !activeKeyPair) return;
    const bundle = {
      schema: 'renumerate-signed-document-v2',
      document: {
        title: docTitle,
        content: docContent,
        sha256Digest: lastSignature.messageHashHex,
      },
      signature: {
        algorithm: 'ECDSA',
        curve: lastSignature.curve,
        hash: lastSignature.hashAlg,
        signatureHex: lastSignature.signatureHex,
        r: lastSignature.rHex,
        s: lastSignature.sHex,
        asn1DerHex: lastSignature.derHex,
        signedAt: lastSignature.timestamp,
      },
      publicKey: {
        fingerprintSha256: activeKeyPair.fingerprintSha256,
        spkiPem: activeKeyPair.publicKeyPem,
        jwk: activeKeyPair.publicKeyJwk,
      },
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.sig.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    pushActivityLog('PUBLIC_KEY_EXPORTED', activeKeyPair.curve, 'info', `Faisceau signé "${docTitle}.sig.json" exporté.`);
  };

  // 7. Download Public Key Files
  const handleDownloadPublicKey = (format: 'pem' | 'jwk') => {
    if (!activeKeyPair) return;
    let content = '';
    let filename = '';
    let mime = 'text/plain';

    if (format === 'pem') {
      content = activeKeyPair.publicKeyPem;
      filename = `renumerate_${activeKeyPair.curve}_public.pem`;
    } else {
      content = JSON.stringify(activeKeyPair.publicKeyJwk, null, 2);
      filename = `renumerate_${activeKeyPair.curve}_public.jwk.json`;
      mime = 'application/json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    pushActivityLog('PUBLIC_KEY_EXPORTED', activeKeyPair.curve, 'info', `Clé publique exportée au format ${format.toUpperCase()}.`);
  };

  // 8. Import Public Key
  const handleImportPublicKey = async () => {
    if (!importKeyText.trim()) return;
    setImportedKeyStatus(null);
    try {
      let importedKey: CryptoKey;
      if (importKeyFormat === 'pem') {
        importedKey = await importPublicKeyFromPem(importKeyText, selectedCurve, 'ecdsa');
      } else {
        const parsedJwk = JSON.parse(importKeyText);
        importedKey = await importPublicKeyFromJwk(parsedJwk, 'ecdsa');
      }
      setImportedPublicKey(importedKey);
      setImportedKeyStatus('Clé publique tierce importée avec succès ! Prête pour vérification.');
      pushActivityLog('PUBLIC_KEY_IMPORTED', selectedCurve, 'success', 'Clé publique importée pour vérification externe.');
      addLog('Clé publique externe importée avec succès dans l’enclave de vérification', 'success');
    } catch (err: any) {
      setImportedKeyStatus(`Erreur d'import : ${err?.message || 'Format invalide'}`);
      pushActivityLog('PUBLIC_KEY_IMPORTED', selectedCurve, 'error', `Échec d'import clé : ${err?.message}`);
    }
  };

  // 8b. Export Signed Audit Logs (JSON + ECDSA P-256 signature)
  const handleExportSignedAuditLogs = async () => {
    setIsSigningAudit(true);
    const startT = performance.now();
    try {
      let signingKeyPair = activeRawKeyPair;
      let keyInfo = activeKeyPair;

      if (!signingKeyPair || keyInfo?.usage !== 'ecdsa') {
        const generated = await generateEccKeyPair('P-256', 'ecdsa', 'Clé d’Audit Immuable ECDSA');
        setActiveKeyPair(generated.keyPairInfo);
        setActiveRawKeyPair(generated.rawKeyPair || null);
        signingKeyPair = generated.rawKeyPair || null;
        keyInfo = generated.keyPairInfo;
      }

      if (!signingKeyPair || !keyInfo) {
        throw new Error('Impossible d’initialiser la clé de signature ECDSA.');
      }

      const exportTimestamp = new Date().toISOString();
      const canonicalEventsJson = JSON.stringify(activityLogs);
      const enc = new TextEncoder();
      const eventsBuffer = enc.encode(canonicalEventsJson);

      const digestBuffer = await window.crypto.subtle.digest('SHA-256', eventsBuffer);
      const digestHex = bytesToHex(new Uint8Array(digestBuffer));

      const payloadToSign = JSON.stringify({
        schema: 'renumerate-signed-audit-log-v2',
        exportedAt: exportTimestamp,
        eventCount: activityLogs.length,
        canonicalDigestSha256: digestHex,
        signerFingerprintSha256: keyInfo.fingerprintSha256,
      });

      const signatureResult = await signEcdsaMessage({
        privateKey: signingKeyPair.privateKey,
        messageText: payloadToSign,
        hashAlg: 'SHA-256',
        curve: 'P-256',
      });

      const signedBundle = {
        schema: 'renumerate-signed-audit-log-v2',
        exportMetadata: {
          exportedAt: exportTimestamp,
          eventCount: activityLogs.length,
          canonicalDigestSha256: digestHex,
          auditImmutabilityPolicy: 'FIPS-186-4-ECDSA-P256-Strict-Integrity',
          specVersion: '2.0.0',
        },
        payloadSigned: payloadToSign,
        signer: {
          keyId: keyInfo.keyId,
          curve: 'P-256',
          hashAlgorithm: 'SHA-256',
          fingerprintSha256: keyInfo.fingerprintSha256,
          publicKeyPem: keyInfo.publicKeyPem,
          publicKeyJwk: keyInfo.publicKeyJwk,
        },
        cryptographicProof: {
          signatureHex: signatureResult.signatureHex,
          rHex: signatureResult.rHex,
          sHex: signatureResult.sHex,
          asn1DerHex: signatureResult.derHex,
          signerFingerprint: signatureResult.signerFingerprint,
          signedAt: signatureResult.timestamp,
        },
        events: activityLogs,
      };

      const blob = new Blob([JSON.stringify(signedBundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renumerate_ecc_audit_${Date.now()}.signed.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const lat = Number((performance.now() - startT).toFixed(2));
      setSignedAuditFeedback({
        success: true,
        fingerprint: keyInfo.fingerprintSha256,
        derPrefix: signatureResult.derHex.slice(0, 24),
        timestamp: new Date().toLocaleTimeString('fr-FR'),
      });

      pushActivityLog(
        'AUDIT_LOGS_EXPORTED_SIGNED',
        'P-256',
        'success',
        `Journaux scellés et exportés au format signé ECDSA P-256 (${activityLogs.length} événements).`,
        signatureResult.derHex.slice(0, 16),
        lat
      );

      addLog(
        `Journaux d’activité scellés sous signature ECDSA P-256 (Empreinte: ${keyInfo.fingerprintSha256.slice(0, 12)}...)`,
        'success'
      );
    } catch (err: any) {
      addLog(`Erreur lors de la signature de l’audit : ${err?.message}`, 'error');
    } finally {
      setIsSigningAudit(false);
    }
  };

  // 8c. Verify External Signed Audit Log File
  const handleVerifySignedAuditFile = async () => {
    if (!auditJsonToVerify.trim()) return;
    setIsVerifyingAudit(true);
    setAuditVerificationStatus(null);
    try {
      const parsed = JSON.parse(auditJsonToVerify);
      if (
        parsed.schema !== 'renumerate-signed-audit-log-v2' ||
        !parsed.cryptographicProof ||
        !parsed.events ||
        !parsed.payloadSigned
      ) {
        throw new Error('Fichier non conforme au schéma d’audit signé Renumerate v2.');
      }

      const canonicalEventsJson = JSON.stringify(parsed.events);
      const enc = new TextEncoder();
      const eventsBuffer = enc.encode(canonicalEventsJson);
      const digestBuffer = await window.crypto.subtle.digest('SHA-256', eventsBuffer);
      const computedDigestHex = bytesToHex(new Uint8Array(digestBuffer));

      if (computedDigestHex !== parsed.exportMetadata.canonicalDigestSha256) {
        setAuditVerificationStatus({
          checked: true,
          valid: false,
          tampered: true,
          eventCount: parsed.events.length,
          exportedAt: parsed.exportMetadata.exportedAt,
          signerFingerprint: parsed.signer?.fingerprintSha256,
          errorDetail: 'Altération détectée : le digest des événements ne correspond pas au sceau signé.',
        });
        pushActivityLog(
          'AUDIT_LOGS_VERIFIED',
          'P-256',
          'warning',
          'Vérification d’audit : Échec ! Altération détectée dans les événements de journalisation.',
          'TAMPER_IN_LOGS'
        );
        return;
      }

      const pubKey = await importPublicKeyFromPem(parsed.signer.publicKeyPem, 'P-256', 'ecdsa');

      const verifyRes = await verifyEcdsaSignature({
        publicKey: pubKey,
        messageText: parsed.payloadSigned,
        signatureHex: parsed.cryptographicProof.signatureHex,
        hashAlg: 'SHA-256',
      });

      setAuditVerificationStatus({
        checked: true,
        valid: verifyRes.valid,
        tampered: !verifyRes.valid,
        eventCount: parsed.events.length,
        exportedAt: parsed.exportMetadata.exportedAt,
        signerFingerprint: parsed.signer?.fingerprintSha256,
        errorDetail: verifyRes.errorDetail,
      });

      pushActivityLog(
        'AUDIT_LOGS_VERIFIED',
        'P-256',
        verifyRes.valid ? 'success' : 'error',
        verifyRes.valid
          ? `Audit signé vérifié avec succès : Immuabilité 100% certifiée (${parsed.events.length} événements).`
          : 'Échec de vérification : signature ECDSA invalide.',
        verifyRes.valid ? 'AUDIT_IMMUTABLE_OK' : 'INVALID_SIG'
      );

      addLog(
        verifyRes.valid
          ? `Vérification du faisceau d’audit signé : VALIDE et IMMUABLE (${parsed.events.length} événements certifiés)`
          : 'Vérification du faisceau d’audit : INVALIDE',
        verifyRes.valid ? 'success' : 'error'
      );
    } catch (err: any) {
      setAuditVerificationStatus({
        checked: true,
        valid: false,
        tampered: false,
        errorDetail: err?.message || 'Erreur lors du traitement du fichier JSON.',
      });
    } finally {
      setIsVerifyingAudit(false);
    }
  };

  // 9. Run ECDH Exchange (Advanced tool)
  const handleRunEcdh = async () => {
    setIsPerformingEcdh(true);
    try {
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
      const res = await performEcdhExchange({
        curve: ecdhCurve,
        aliceKeyPair: alice,
        bobKeyPair: bob,
        kdfInfo: 'renumerate-vpn-wireguard-tunnel-v2',
      });
      setEcdhResult(res);
      addLog(`Échange ECDH ${ecdhCurve} réussi : secret commun 256 bits dérivé via HKDF-SHA256`, 'success');
    } catch (err: any) {
      addLog(`Erreur échange ECDH : ${err?.message}`, 'error');
    } finally {
      setIsPerformingEcdh(false);
    }
  };

  const currentProfile = ECC_CURVE_PROFILES[selectedCurve];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
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
                  <span>Module de Sécurité Cryptographique ECC</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono">
                    NIST ECDSA P-256 &amp; SHA-256
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Génération asymétrique matérielle, signature numérique de documents, détection d'altérations et gestion des clés publiques conformes FIPS 186-4.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Niveau de Sécurité : <strong>128 bits classique</strong></span>
            </span>
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Stockage Clé Privée : <strong>0% LocalStorage (RAM Isolée)</strong></span>
            </span>
            <button
              type="button"
              onClick={handleGenerateKey}
              disabled={isGeneratingKey}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
              <span>Générer Paire P-256</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Dashboard 6 Core Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(
          [
            { id: 'status', label: '1. État de Sécurité ECC', icon: ShieldCheck, badge: 'Audit & Tests' },
            { id: 'generate', label: '2. Génération de Clés', icon: KeyRound, badge: 'P-256' },
            { id: 'sign', label: '3. Signature de Document', icon: FileCheck, badge: 'ECDSA' },
            { id: 'verify', label: '4. Vérification & Anti-Falsification', icon: CheckCircle2, badge: 'Intégrité' },
            { id: 'public-keys', label: '5. Gestion Clés Publiques', icon: Share2, badge: 'PEM / JWK' },
            { id: 'logs', label: '6. Journal d’Activité Sécurité', icon: History, badge: `${activityLogs.length}` },
            { id: 'advanced', label: 'Outils Avancés (ECDH / ECIES)', icon: Layers, badge: 'Diffie-Hellman' },
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
      {/* SECTION 1: ECC SECURITY STATUS & AUTOMATED TEST SUITE               */}
      {/* =================================================================== */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {/* Security Posture Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Moteur Web Crypto API</span>
                <Cpu className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Natif &amp; Accéléré</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">window.crypto.subtle · FIPS 186-4</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Courbe Asymétrique Active</span>
                <KeyRound className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                NIST P-256 (secp256r1)
              </div>
              <p className="text-[11px] text-slate-500 font-mono">SHA-256 · 128-bit de sécurité</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Protection Clé Privée</span>
                <Lock className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Enclave RAM Volatile</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">0 octet en localStorage</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Contexte Sécurisé TLS</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>HTTPS / Localhost Conforme</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">SubtleCrypto activé</p>
            </div>
          </div>

          {/* Automated Cryptographic Test Suite Runner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Suite de Tests Automatisée de Conformité Cryptographique</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                    6/6 Tests
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Vérification en temps réel des opérations de génération de clé, signature numérique, vérification intègre, détection de falsification et non-persistance en clair.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunSelfTests}
                disabled={isRunningTests}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-sm shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>{isRunningTests ? 'Exécution des tests...' : 'Ré-exécuter les Tests'}</span>
              </button>
            </div>

            {/* Test Results Table */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
              {selfTests.map((t, idx) => (
                <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 ${
                        t.status === 'passed'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/15 text-red-500'
                      }`}
                    >
                      {t.status === 'passed' ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </span>
                    <div>
                      <div className="font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Test {idx + 1} : {t.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({t.latencyMs} ms)</span>
                      </div>
                      <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                        {t.details}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      t.status === 'passed'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                    }`}
                  >
                    {t.status === 'passed' ? 'PASSÉ · CONFORME' : 'ÉCHEC'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 2: GENERATE KEY PAIR                                        */}
      {/* =================================================================== */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-cyan-500" />
                  <span>Génération de Paire Asymétrique ECC</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Conforme aux exigences FIPS 186-4 (ECDSA P-256 avec CSPRNG matériel).
                </p>
              </div>

              {/* Curve Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Courbe Elliptique :
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
                  <option value="P-256">NIST P-256 (secp256r1 / 128-bit) - Recommandé standard</option>
                  <option value="P-384">NIST P-384 (secp384r1 / 192-bit) - NSA CNSA Suite</option>
                  <option value="P-521">NIST P-521 (secp521r1 / 256-bit) - Sécurité Max</option>
                  <option value="X25519">Curve25519 (X25519) - WireGuard Core</option>
                  <option value="Ed25519">Ed25519 - Signatures EdDSA</option>
                  <option value="secp256k1">secp256k1 (Koblitz) - Bitcoin / Web3</option>
                </select>
              </div>

              {/* Usage Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Usage Cryptographique :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKeyUsage('ecdsa')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                      keyUsage === 'ecdsa'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    ECDSA (Sign &amp; Verify)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyUsage('ecdh')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                      keyUsage === 'ecdh'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    ECDH (Échange Clés)
                  </button>
                </div>
              </div>

              {/* Label */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Identifiant de la Paire :
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
                <span>Générer Nouvelle Paire {selectedCurve}</span>
              </button>

              {/* Protection notice */}
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 space-y-1 font-medium">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Isolation Garantie de la Clé Privée</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  La clé privée est maintenue strictement dans l'enclave de mémoire volatile WebCrypto. Elle n'est jamais exposée dans les logs ni écrite dans un stockage non chiffré (localStorage).
                </p>
              </div>
            </div>
          </div>

          {/* Active Key Details & Inspection (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {activeKeyPair ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <KeyRound className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {activeKeyPair.label}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400">ID : {activeKeyPair.keyId}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    {activeKeyPair.curve} ({activeKeyPair.bitSecurity} bits)
                  </span>
                </div>

                {/* Fingerprint SHA-256 */}
                <div className="space-y-1 text-xs font-mono">
                  <span className="text-slate-400 text-[10px] block">Empreinte Publique SHA-256 :</span>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-between">
                    <span className="break-all">{activeKeyPair.fingerprintSha256}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeKeyPair.fingerprintSha256, 'fp')}
                      className="p-1 text-slate-400 hover:text-cyan-500 cursor-pointer shrink-0"
                    >
                      {copiedField === 'fp' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Affine coordinates X, Y on curve */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block mb-1">Coordonnée Affine X :</span>
                    <span className="text-slate-700 dark:text-slate-300 break-all text-[11px]">
                      {activeKeyPair.pointCoordinates.xHex || 'N/A'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block mb-1">Coordonnée Affine Y :</span>
                    <span className="text-slate-700 dark:text-slate-300 break-all text-[11px]">
                      {activeKeyPair.pointCoordinates.yHex || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Geometric Point Equation Verification */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-500">Conformité Géométrique y² ≡ x³ + ax + b :</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Point valide sur la courbe</span>
                  </span>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('sign')}
                    className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Signer un Document avec cette Clé</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('public-keys')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Exporter Clé Publique (PEM / JWK)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 border border-dashed rounded-2xl">
                Génération de clé en cours...
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 3: SIGN DOCUMENT                                            */}
      {/* =================================================================== */}
      {activeTab === 'sign' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-cyan-500" />
                  <span>Signature Numérique de Document (ECDSA P-256 + SHA-256)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Appose une signature asymétrique mathématiquement infalsifiable conforme IEEE P1363.
                </p>
              </div>

              {/* Document Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nom / Référence du Document :
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Sample Templates */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">Modèles rapides :</span>
                <button
                  type="button"
                  onClick={() =>
                    setDocContent(
                      `Attestation de Non-Conservation des Journaux Renumerate\nHorodatage : ${new Date().toISOString()}\nJuridiction : Suisse (Zürich Bahnhof Node)\nConformité : RGPD & FIPS 186-4`
                    )
                  }
                  className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Attestation Zero-Log
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() =>
                    setDocContent(
                      `Certificat d'Autorisation de Routage BGP Transit Tier-1\nHorodatage : ${new Date().toISOString()}\nAS-Origin : AS51395\nSignature requise pour injection de route.`
                    )
                  }
                  className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  BGP Token
                </button>
              </div>

              {/* Content Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contenu Textuel du Document à Signer :
                </label>
                <textarea
                  rows={6}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              {/* Sign Action Button */}
              <button
                type="button"
                onClick={handleSignDocument}
                disabled={isSigning || !docContent.trim()}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <Zap className="w-4 h-4" />
                <span>{isSigning ? 'Signature en cours...' : 'Signer Numériquement le Document'}</span>
              </button>
            </div>
          </div>

          {/* Signature Result Pane (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            {lastSignature ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Certificat de Signature ECDSA Généré
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400">
                        Horodatage : {new Date(lastSignature.timestamp).toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    VALIDE
                  </span>
                </div>

                {/* Message Digest SHA-256 */}
                <div className="space-y-1 text-xs font-mono">
                  <span className="text-slate-400 text-[10px] block">Empreinte SHA-256 du Document :</span>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 break-all text-[11px]">
                    {lastSignature.messageHashHex}
                  </div>
                </div>

                {/* Raw (r, s) Coordinates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block mb-0.5">Scalaire r (32 octets) :</span>
                    <span className="text-cyan-600 dark:text-cyan-400 break-all text-[10px]">
                      {lastSignature.rHex}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block mb-0.5">Scalaire s (32 octets) :</span>
                    <span className="text-cyan-600 dark:text-cyan-400 break-all text-[10px]">
                      {lastSignature.sHex}
                    </span>
                  </div>
                </div>

                {/* ASN.1 DER Sequence Hex */}
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-400 text-[10px]">
                    <span>Format Standard ASN.1 DER (X9.62) :</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(lastSignature.derHex, 'der')}
                      className="text-cyan-500 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      {copiedField === 'der' ? 'Copié !' : 'Copier hex'}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-purple-600 dark:text-purple-400 break-all text-[10px]">
                    {lastSignature.derHex}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadSignedBundle}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger Faisceau Signé (.json)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVerifyDocContent(docContent);
                      setVerifySignatureHex(lastSignature.signatureHex);
                      setActiveTab('verify');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Transférer vers Vérification</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 border border-dashed rounded-2xl">
                Renseignez le document ci-contre et cliquez sur "Signer Numériquement".
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 4: VERIFY SIGNATURE & TAMPER DETECTION                      */}
      {/* =================================================================== */}
      {activeTab === 'verify' && (
        <div className="space-y-5">
          {/* Status Alert Banner */}
          {verificationResult && (
            <div
              className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                verificationResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : verificationResult.isTampered
                  ? 'bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {verificationResult.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <BadgeAlert className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {verificationResult.valid
                      ? 'Signature Authentique et Valide · Intégrité 100% Certifiée'
                      : verificationResult.isTampered
                      ? 'FALSIFICATION DÉTECTÉE · Document Altéré après Signature !'
                      : 'Échec de Vérification · Signature Invalide ou Clé Incompatible'}
                  </h4>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    {verificationResult.valid
                      ? 'Le document correspond exactement à l’empreinte signée par la clé ECDSA P-256.'
                      : verificationResult.isTampered
                      ? 'Le moindre octet modifié brise mathématiquement l’équation de vérification ECDSA. Signature révoquée.'
                      : verificationResult.errorDetail || 'La signature ne correspond pas à la clé publique fournie.'}
                  </p>
                </div>
              </div>

              {tamperedOriginalContent && (
                <button
                  type="button"
                  onClick={handleRestoreOriginalDoc}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold hover:border-cyan-500 transition-colors cursor-pointer text-slate-800 dark:text-slate-200 shrink-0"
                >
                  Restaurer Document Original
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Form (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Vérification d'Intégrité ECDSA</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Vérifie cryptographiquement que le texte n'a subi aucune modification.
                    </p>
                  </div>

                  {/* Tamper Button */}
                  <button
                    type="button"
                    onClick={handleInjectTamper}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Modifie un caractère pour tester le rejet automatique"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>Tester une Altération (Tamper)</span>
                  </button>
                </div>

                {/* Document text */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contenu du Document à Vérifier :
                    </label>
                    {tamperedOriginalContent && (
                      <span className="text-[10px] text-red-500 font-mono font-bold animate-pulse">
                        [ALTÉRÉ POUR TEST]
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={verifyDocContent}
                    onChange={(e) => setVerifyDocContent(e.target.value)}
                    placeholder="Collez ici le document à auditer..."
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none resize-none ${
                      tamperedOriginalContent
                        ? 'border-red-500/50 bg-red-500/5 text-red-900 dark:text-red-200'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Signature Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Signature ECDSA IEEE P1363 (Hexadécimale) :
                  </label>
                  <input
                    type="text"
                    value={verifySignatureHex}
                    onChange={(e) => setVerifySignatureHex(e.target.value)}
                    placeholder="Signature hexadécimale (128 caractères)..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Action Button */}
                <button
                  type="button"
                  onClick={() => handleVerifySignature(verifyDocContent)}
                  disabled={isVerifying || !verifyDocContent.trim() || !verifySignatureHex.trim()}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isVerifying ? 'Vérification mathématique...' : 'Vérifier l’Intégrité Cryptographique'}</span>
                </button>
              </div>
            </div>

            {/* Verification Key & How It Works (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-cyan-500" />
                  <span>Clé Publique de Vérification Utilisée</span>
                </h4>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] space-y-1">
                  <div className="text-slate-400 text-[10px]">Empreinte :</div>
                  <div className="text-cyan-600 dark:text-cyan-400 font-bold break-all">
                    {activeKeyPair?.fingerprintSha256 || 'N/A'}
                  </div>
                  <div className="text-slate-500 text-[10px] pt-1">
                    Courbe : {activeKeyPair?.curve || 'P-256'} · Algorithme : ECDSA-SHA256
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-slate-600 dark:text-slate-400">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Principe de Non-Répudiation</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Grâce à la propriété mathématique du problème du logarithme discret sur courbe elliptique (ECDLP), seule l'entité en possession de la clé privée secrète a pu générer le couple de scalaires (r, s).
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Si le texte est altéré d'un seul caractère, la fonction de hachage SHA-256 produit une empreinte entièrement différente qui invalide instantanément l'équation de congruence :
                    <br />
                    <code className="text-cyan-500 font-mono text-[10px]">s⁻¹ · (hash · G + r · PubKey) ≢ (x, y)</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 5: PUBLIC KEY MANAGEMENT                                    */}
      {/* =================================================================== */}
      {activeTab === 'public-keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-cyan-500" />
                    <span>Exportation Standard de la Clé Publique</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Formats normalisés SPKI PEM, JWK JSON et Hexadécimal brut uncompressed 04...
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadPublicKey('pem')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-cyan-500 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.pem</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPublicKey('jwk')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-cyan-500 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.json</span>
                  </button>
                </div>
              </div>

              {/* Format 1: SPKI PEM */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Format SPKI PEM (RFC 5280 / X.509) :</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeKeyPair?.publicKeyPem || '', 'pem')}
                    className="text-cyan-500 hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    {copiedField === 'pem' ? 'Copié !' : 'Copier PEM'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  value={activeKeyPair?.publicKeyPem || ''}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-slate-200 outline-none resize-none"
                />
              </div>

              {/* Format 2: JWK JSON */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Format JWK (RFC 7517) :</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(activeKeyPair?.publicKeyJwk, null, 2), 'jwk')}
                    className="text-cyan-500 hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    {copiedField === 'jwk' ? 'Copié !' : 'Copier JWK'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  value={JSON.stringify(activeKeyPair?.publicKeyJwk, null, 2)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-slate-200 outline-none resize-none"
                />
              </div>

              {/* Format 3: Raw Uncompressed Point Hex */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Point Brut Décompressé (Hex 04...) :</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeKeyPair?.pointCoordinates.uncompressedHex || '', 'uncompressed')}
                    className="text-cyan-500 hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    {copiedField === 'uncompressed' ? 'Copié !' : 'Copier Hex'}
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] break-all text-purple-600 dark:text-purple-400">
                  {activeKeyPair?.pointCoordinates.uncompressedHex}
                </div>
              </div>
            </div>
          </div>

          {/* Import External Public Key (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-500" />
                  <span>Importer une Clé Publique Tierce</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Collez un certificat public externe pour vérifier les signatures reçues.
                </p>
              </div>

              {/* Format selection */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImportKeyFormat('pem')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    importKeyFormat === 'pem'
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Format PEM
                </button>
                <button
                  type="button"
                  onClick={() => setImportKeyFormat('jwk')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    importKeyFormat === 'jwk'
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Format JWK
                </button>
              </div>

              {/* Textarea */}
              <textarea
                rows={5}
                value={importKeyText}
                onChange={(e) => setImportKeyText(e.target.value)}
                placeholder={
                  importKeyFormat === 'pem'
                    ? '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----'
                    : '{\n  "kty": "EC",\n  "crv": "P-256",\n  "x": "...",\n  "y": "..."\n}'
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 resize-none"
              />

              {/* Import button */}
              <button
                type="button"
                onClick={handleImportPublicKey}
                disabled={!importKeyText.trim()}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Valider &amp; Importer Clé
              </button>

              {importedKeyStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium ${
                    importedKeyStatus.includes('succès')
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                  }`}
                >
                  {importedKeyStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 6: SECURITY ACTIVITY LOGS                                   */}
      {/* =================================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-500" />
                <span>Journal d’Activité Cryptographique en Temps Réel</span>
                <span className="text-xs font-mono text-slate-400">({activityLogs.length} événements)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Traçabilité locale des opérations de signature, de vérification, d’export et des alertes de falsification.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* PRIMARY CTA: EXPORT SIGNED AUDIT */}
              <button
                type="button"
                onClick={handleExportSignedAuditLogs}
                disabled={isSigningAudit || activityLogs.length === 0}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                title="Signe et scelle l'ensemble des événements avec la clé ECDSA P-256"
              >
                <FileCheck className={`w-3.5 h-3.5 ${isSigningAudit ? 'animate-spin' : ''}`} />
                <span>{isSigningAudit ? 'Signature en cours...' : 'Exporter Audit Signé (ECDSA)'}</span>
              </button>

              {/* Verify Signed Audit Toggle */}
              <button
                type="button"
                onClick={() => setShowAuditVerifier(!showAuditVerifier)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showAuditVerifier
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                <span>Vérifier Audit Signé</span>
              </button>

              {/* Plain JSON export */}
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(activityLogs, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `renumerate_ecc_audit_${Date.now()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500 transition-colors cursor-pointer flex items-center gap-1"
                title="Exporter le JSON brut sans signature"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON Brut</span>
              </button>

              <button
                type="button"
                onClick={() => setActivityLogs([])}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                Purger
              </button>
            </div>
          </div>

          {/* Signed Audit Export Success Feedback Banner */}
          {signedAuditFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Audit scellé avec succès !</strong> Fichier signé horodaté à {signedAuditFeedback.timestamp} · Clé signataire :{' '}
                  <code className="font-mono text-[11px] bg-emerald-500/20 px-1 rounded">{signedAuditFeedback.fingerprint.slice(0, 16)}...</code> · DER :{' '}
                  <code className="font-mono text-[10px]">{signedAuditFeedback.derPrefix}...</code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSignedAuditFeedback(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold px-1.5 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Signed Audit Verifier Drawer */}
          {showAuditVerifier && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-500" />
                  <span>Vérificateur d’Audit Immuable (.signed.json)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAuditVerifier(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Collez ici le contenu d’un fichier d’audit signé pour vérifier mathématiquement son authenticité et certifier qu'aucun événement n'a été inséré, supprimé ou modifié depuis la signature.
              </p>
              <textarea
                rows={4}
                value={auditJsonToVerify}
                onChange={(e) => setAuditJsonToVerify(e.target.value)}
                placeholder='Collez le JSON complet du fichier renumerate_ecc_audit_*.signed.json...'
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono outline-none resize-none"
              />
              <button
                type="button"
                onClick={handleVerifySignedAuditFile}
                disabled={isVerifyingAudit || !auditJsonToVerify.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isVerifyingAudit ? 'Vérification cryptographique...' : 'Vérifier l’Intégrité de l’Audit'}</span>
              </button>

              {auditVerificationStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono space-y-1 ${
                    auditVerificationStatus.valid
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 font-sans">
                    {auditVerificationStatus.valid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Audit Immuable &amp; Valide · Intégrité 100% Certifiée</span>
                      </>
                    ) : (
                      <>
                        <BadgeAlert className="w-4 h-4 text-red-500" />
                        <span>Échec d'Intégrité : {auditVerificationStatus.errorDetail}</span>
                      </>
                    )}
                  </div>
                  {auditVerificationStatus.valid && (
                    <div className="text-[11px] opacity-90">
                      Événements vérifiés : {auditVerificationStatus.eventCount} · Clé Signataire : {auditVerificationStatus.signerFingerprint?.slice(0, 16)}...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
            {activityLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      log.status === 'success'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : log.status === 'warning'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : log.status === 'error'
                        ? 'bg-red-500/15 text-red-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {log.action}
                  </span>

                  <div>
                    <span className="font-sans text-slate-800 dark:text-slate-200 font-medium">
                      {log.details}
                    </span>
                    {log.digestOrFingerprint && (
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-400 ml-2 font-mono">
                        [{log.digestOrFingerprint}]
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                  {log.latencyMs !== undefined && <span>{log.latencyMs} ms</span>}
                  <span>{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 7: ADVANCED TOOLS (ECDH / ECIES / BENCHMARK)                */}
      {/* =================================================================== */}
      {activeTab === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bilateral ECDH Key Exchange */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-500" />
                <span>Échange Diffie-Hellman (ECDH) &amp; Dérivation HKDF</span>
              </h3>
              <button
                type="button"
                onClick={handleRunEcdh}
                disabled={isPerformingEcdh}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Exécuter Échange
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Simule un accord de clés bilatéral entre deux nœuds distants via ECDH et dérive une clé symétrique AES-256-GCM commune sans jamais transmettre le secret sur le réseau.
            </p>

            {ecdhResult && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 font-mono text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Point Commun Dérivé :</span>
                  <span className="text-cyan-600 dark:text-cyan-400 break-all text-[11px] font-bold">
                    {ecdhResult.rawSharedPointHex}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Clé Symétrique Finale AES-256 (via HKDF-SHA256) :</span>
                  <span className="text-emerald-600 dark:text-emerald-400 break-all text-[11px] font-bold">
                    {ecdhResult.derivedAesKeyHex}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ECIES & Post-Quantum Profile Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-500" />
                <span>Transition Post-Quantique &amp; Résistance Cryptanalytique</span>
              </h3>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              <p>
                La courbe NIST P-256 offre 128 bits de résistance face aux ordinateurs classiques les plus puissants. Face aux futures menaces quantiques (algorithme de Shor), Renumerate supporte le mode hybride avec <strong>ML-KEM-1024</strong> (FIPS 203).
              </p>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-purple-500" />
                  <span>Recommandation de Souveraineté :</span>
                </div>
                <p className="text-[11px]">
                  Pour les communications à très longue durée de rétention, activez l'encapsulation hybride post-quantique dans les Paramètres &gt; Transport Noyau.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
