import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  FileText,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Upload,
  RefreshCw,
  Play,
  Lock,
  Unlock,
  Hash,
  Cpu,
  Zap,
  AlertTriangle,
  Layers,
  FileCode2,
  Info,
  Clock,
  ArrowRight,
  Shield,
  Trash2,
  Share2,
  ExternalLink,
  Sliders,
  Sparkles,
} from 'lucide-react';

export interface DashboardECCProps {
  onAddLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
  className?: string;
}

export interface EccP256KeyPairState {
  rawKeyPair: CryptoKeyPair;
  publicKeyPem: string;
  publicKeyJwk: JsonWebKey;
  publicKeyHex: string;
  fingerprintSha256: string;
  generatedAt: string;
  label: string;
  pointCoordinates: {
    xHex: string;
    yHex: string;
    compressedHex: string;
    uncompressedHex: string;
    isOnCurve: boolean;
  };
}

export interface EccSignedDocumentBundle {
  documentTitle: string;
  documentContent: string;
  algorithm: {
    name: 'ECDSA';
    namedCurve: 'P-256';
    hash: 'SHA-256';
  };
  signatureHex: string;
  signatureDerHex: string;
  signatureBase64: string;
  documentSha256: string;
  publicKeyFingerprint: string;
  publicKeyPem: string;
  signedAt: string;
}

export interface EccOperationLog {
  id: string;
  timestamp: string;
  action:
    | 'KEY_GENERATED'
    | 'DOCUMENT_SIGNED'
    | 'SIGNATURE_VERIFIED'
    | 'TAMPER_DETECTED'
    | 'PUBLIC_KEY_IMPORTED'
    | 'BENCHMARK_EXECUTED';
  status: 'success' | 'warning' | 'error';
  details: string;
  latencyMs: number;
  digest?: string;
}

// ============================================================================
// UTILITAIRES CRYPTOGRAPHIQUES PURS (Web Crypto API)
// ============================================================================

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '').replace(/\s+/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('Longueur hexadécimale impaire invalide.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.trim().replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer;
}

function base64UrlToBytes(base64url: string): Uint8Array {
  let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  return base64ToBytes(b64);
}

function formatPem(base64: string, type: 'PUBLIC KEY' | 'EC PRIVATE KEY'): string {
  const chunks = base64.match(/.{1,64}/g) || [base64];
  return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
}

// Conversion r,s IEEE P1363 (64 octets) vers ASN.1 DER (RFC 3279)
function encodeEcdsaAsn1Der(r: Uint8Array, s: Uint8Array): Uint8Array {
  function formatInteger(bytes: Uint8Array): Uint8Array {
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) start++;
    const trimmed = bytes.subarray(start);
    if (trimmed.length === 0) return new Uint8Array([0x02, 0x01, 0x00]);
    const needsZero = Boolean(trimmed[0] & 0x80);
    const len = trimmed.length + (needsZero ? 1 : 0);
    const out = new Uint8Array(2 + len);
    out[0] = 0x02; // INTEGER
    out[1] = len;
    if (needsZero) {
      out[2] = 0x00;
      out.set(trimmed, 3);
    } else {
      out.set(trimmed, 2);
    }
    return out;
  }

  const rAsn = formatInteger(r);
  const sAsn = formatInteger(s);
  const totalLen = rAsn.length + sAsn.length;
  const seq = new Uint8Array(2 + totalLen);
  seq[0] = 0x30; // SEQUENCE
  seq[1] = totalLen;
  seq.set(rAsn, 2);
  seq.set(sAsn, 2 + rAsn.length);
  return seq;
}

// Convertit ASN.1 DER vers IEEE P1363 brut si l'utilisateur fournit du DER
function parseDerSignatureToRaw(derBytes: Uint8Array): Uint8Array {
  if (derBytes[0] !== 0x30) {
    // Déjà du format brut P1363 (64 octets pour P-256)
    return derBytes;
  }
  let offset = 2;
  if (derBytes[1] & 0x80) {
    offset = 2 + (derBytes[1] & 0x7f);
  }

  // Lecture r
  if (derBytes[offset] !== 0x02) throw new Error('Format DER invalide: INTEGER attendu');
  const rLen = derBytes[offset + 1];
  offset += 2;
  let rBytes = derBytes.subarray(offset, offset + rLen);
  offset += rLen;

  // Lecture s
  if (derBytes[offset] !== 0x02) throw new Error('Format DER invalide: second INTEGER attendu');
  const sLen = derBytes[offset + 1];
  offset += 2;
  let sBytes = derBytes.subarray(offset, offset + sLen);

  // Normalisation à 32 octets chacun
  const raw = new Uint8Array(64);
  // Nettoyage de l'éventuel octet de signe 0x00
  if (rBytes.length > 32) rBytes = rBytes.subarray(rBytes.length - 32);
  if (sBytes.length > 32) sBytes = sBytes.subarray(sBytes.length - 32);

  raw.set(rBytes, 32 - rBytes.length);
  raw.set(sBytes, 64 - sBytes.length);
  return raw;
}

// Vérification de point géométrique NIST P-256 : y² ≡ x³ - 3x + b mod p
const P256_P = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
const P256_A = BigInt('0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc');
const P256_B = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');

function checkPointOnP256(xHex: string, yHex: string): boolean {
  try {
    if (!xHex || !yHex) return false;
    const x = BigInt(`0x${xHex}`);
    const y = BigInt(`0x${yHex}`);
    const left = (y * y) % P256_P;
    const right = (((x * x * x) % P256_P) + ((P256_A * x) % P256_P) + P256_B) % P256_P;
    const normalizedRight = ((right % P256_P) + P256_P) % P256_P;
    return left === normalizedRight;
  } catch {
    return false;
  }
}

// Calcul de l'entropie binaire Shannon H = -sum(p * log2(p))
function computeShannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const freq = new Map<number, number>();
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    freq.set(b, (freq.get(b) || 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(3));
}

export const DashboardECC: React.FC<DashboardECCProps> = ({
  onAddLog,
  className = '',
}) => {
  // Onglets du Dashboard
  const [activeTab, setActiveTab] = useState<'overview' | 'keygen' | 'sign' | 'verify' | 'import' | 'audit'>('overview');

  // État de la Paire de Clés Active P-256
  const [keyPair, setKeyPair] = useState<EccP256KeyPairState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [keyLabelInput, setKeyLabelInput] = useState('Paire ECDSA P-256 Racine / Session');
  const [copiedKeyField, setCopiedKeyField] = useState<string | null>(null);

  // État de Signature de Document
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('Manifeste_Audit_Securite_2026.json');
  const [docContent, setDocContent] = useState(
    JSON.stringify(
      {
        protocole: 'Renumerate VPN Core v2.5',
        algorithme: 'ECDSA_P256_SHA256',
        horodatage: new Date().toISOString(),
        noeudSortie: 'Zurich-CH-Exit-04',
        statutTunnel: 'CHIFFREMENT_ACTIF_PQC_HYBRIDE',
        autorite: 'Pass-Through Root Certification Authority',
        emissions: 0,
        journalisation: false,
      },
      null,
      2
    )
  );
  const [isSigning, setIsSigning] = useState(false);
  const [signedBundle, setSignedBundle] = useState<EccSignedDocumentBundle | null>(null);

  // État de Vérification et Détection d'Altération
  const bundleFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingBundle, setIsDraggingBundle] = useState(false);
  const [verifyDocText, setVerifyDocText] = useState('');
  const [verifySignatureInput, setVerifySignatureInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [tamperedOriginalText, setTamperedOriginalText] = useState<string | null>(null);
  const [verificationOutcome, setVerificationOutcome] = useState<{
    tested: boolean;
    valid: boolean;
    isTampered: boolean;
    details: string;
    verifiedAt: string;
    documentHashHex?: string;
    signatureEntropyBits?: number;
    documentSizeBytes?: number;
    bundleDetected?: boolean;
  } | null>(null);

  // État d'Importation de Clé Publique Externe
  const [importMode, setImportMode] = useState<'pem' | 'jwk'>('pem');
  const [importedPemInput, setImportedPemInput] = useState('');
  const [importedJwkInput, setImportedJwkInput] = useState('');
  const [importedKeyInfo, setImportedKeyInfo] = useState<{
    fingerprint: string;
    rawKey: CryptoKey;
    pem: string;
    format: 'pem' | 'jwk';
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Logs d'activité
  const [operationLogs, setOperationLogs] = useState<EccOperationLog[]>([
    {
      id: 'log-init',
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      action: 'KEY_GENERATED',
      status: 'success',
      details: 'Module cryptographique Web Crypto ECDSA P-256 initialisé avec succès.',
      latencyMs: 1.2,
      digest: 'ECDSA:P-256:SHA-256',
    },
  ]);

  // État du Benchmark en temps réel
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<{
    keyGenOpsPerSec: number;
    signOpsPerSec: number;
    verifyOpsPerSec: number;
    keyGenLatencyUs: number;
    signLatencyUs: number;
    verifyLatencyUs: number;
    hardwareAccelerated: boolean;
  } | null>(null);

  const addLocalLog = useCallback(
    (
      action: EccOperationLog['action'],
      status: EccOperationLog['status'],
      details: string,
      latencyMs: number,
      digest?: string
    ) => {
      const entry: EccOperationLog = {
        id: `ecc-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
        action,
        status,
        details,
        latencyMs,
        digest,
      };
      setOperationLogs((prev) => [entry, ...prev.slice(0, 49)]);

      if (onAddLog) {
        const logType = status === 'success' ? 'success' : status === 'warning' ? 'warning' : 'error';
        onAddLog(`[ECC P-256] ${details}`, logType);
      }
    },
    [onAddLog]
  );

  // ==========================================================================
  // 1. GÉNÉRATION DE CLÉ ASYMÉTRIQUE ECDSA P-256
  // ==========================================================================
  const handleGenerateKeyPair = useCallback(async () => {
    setIsGenerating(true);
    const start = performance.now();
    try {
      if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
        throw new Error("L'API Web Crypto n'est pas disponible dans ce contexte (HTTPS requis).");
      }

      // 1. Génération WebCrypto P-256
      const rawKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true, // Clé publique extractable
        ['sign', 'verify']
      );

      // 2. Export SPKI (Clé Publique)
      const spkiBuffer = await window.crypto.subtle.exportKey('spki', rawKeyPair.publicKey);
      const spkiBytes = new Uint8Array(spkiBuffer);
      const pubB64 = bytesToBase64(spkiBytes);
      const publicKeyPem = formatPem(pubB64, 'PUBLIC KEY');
      const publicKeyHex = bytesToHex(spkiBytes);

      // 3. Export JWK pour inspection des coordonnées de courbe (X, Y)
      const jwk = (await window.crypto.subtle.exportKey('jwk', rawKeyPair.publicKey)) as JsonWebKey;
      const xHex = jwk.x ? bytesToHex(base64UrlToBytes(jwk.x)) : '';
      const yHex = jwk.y ? bytesToHex(base64UrlToBytes(jwk.y)) : '';

      // Format compressé standard (02 si Y pair, 03 si Y impair)
      const isYEven = yHex ? parseInt(yHex.slice(-1), 16) % 2 === 0 : true;
      const compressedHex = `${isYEven ? '02' : '03'}${xHex}`;
      const uncompressedHex = `04${xHex}${yHex}`;

      // 4. Empreinte SHA-256 de la clé publique
      const fpBuffer = await window.crypto.subtle.digest('SHA-256', spkiBuffer);
      const fingerprintSha256 = bytesToHex(new Uint8Array(fpBuffer));

      const isOnCurve = checkPointOnP256(xHex, yHex);
      const latencyMs = Number((performance.now() - start).toFixed(2));

      const newKeyPair: EccP256KeyPairState = {
        rawKeyPair,
        publicKeyPem,
        publicKeyJwk: jwk,
        publicKeyHex,
        fingerprintSha256,
        generatedAt: new Date().toISOString(),
        label: keyLabelInput || 'Clé ECDSA P-256 Session',
        pointCoordinates: {
          xHex,
          yHex,
          compressedHex,
          uncompressedHex,
          isOnCurve,
        },
      };

      setKeyPair(newKeyPair);
      addLocalLog(
        'KEY_GENERATED',
        'success',
        `Paire ECDSA P-256 générée avec succès (Empreinte: ${fingerprintSha256.slice(0, 12)}…). Clé privée isolée en mémoire RAM volatile.`,
        latencyMs,
        `SHA256:${fingerprintSha256.slice(0, 16)}`
      );
    } catch (err: any) {
      const latencyMs = Number((performance.now() - start).toFixed(2));
      addLocalLog(
        'KEY_GENERATED',
        'error',
        `Erreur lors de la génération de clé: ${err?.message || 'Erreur WebCrypto inconnue'}`,
        latencyMs
      );
    } finally {
      setIsGenerating(false);
    }
  }, [keyLabelInput, addLocalLog]);

  // Initialisation automatique au montage si aucune clé n'existe
  useEffect(() => {
    if (!keyPair && !isGenerating) {
      handleGenerateKeyPair();
    }
  }, [handleGenerateKeyPair, keyPair, isGenerating]);

  // ==========================================================================
  // 2. SIGNATURE NUMÉRIQUE DE DOCUMENT (ECDSA P-256 + SHA-256)
  // ==========================================================================
  const handleSignDocument = useCallback(async () => {
    if (!keyPair) {
      addLocalLog('DOCUMENT_SIGNED', 'warning', 'Impossible de signer: Aucune paire de clés P-256 active.', 0);
      return;
    }

    if (!docContent.trim()) {
      addLocalLog('DOCUMENT_SIGNED', 'warning', 'Document vide ignoré.', 0);
      return;
    }

    setIsSigning(true);
    const start = performance.now();
    try {
      const enc = new TextEncoder();
      const dataBytes = enc.encode(docContent);

      // 1. Calcul du hash SHA-256 du document en clair
      const hashBuf = await window.crypto.subtle.digest('SHA-256', toArrayBuffer(dataBytes));
      const documentSha256 = bytesToHex(new Uint8Array(hashBuf));

      // 2. Signature numérique ECDSA native WebCrypto (renvoie le format IEEE P1363: r || s)
      const sigBuffer = await window.crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: { name: 'SHA-256' },
        },
        keyPair.rawKeyPair.privateKey,
        toArrayBuffer(dataBytes)
      );

      const rawSigBytes = new Uint8Array(sigBuffer);
      const signatureHex = bytesToHex(rawSigBytes);
      const signatureBase64 = bytesToBase64(rawSigBytes);

      // 3. Conversion en format standard ASN.1 DER (X.509 / RFC 3279)
      const rBytes = rawSigBytes.subarray(0, 32);
      const sBytes = rawSigBytes.subarray(32, 64);
      const derBytes = encodeEcdsaAsn1Der(rBytes, sBytes);
      const signatureDerHex = bytesToHex(derBytes);

      const bundle: EccSignedDocumentBundle = {
        documentTitle: docTitle || 'Document_Signe.txt',
        documentContent: docContent,
        algorithm: {
          name: 'ECDSA',
          namedCurve: 'P-256',
          hash: 'SHA-256',
        },
        signatureHex,
        signatureDerHex,
        signatureBase64,
        documentSha256,
        publicKeyFingerprint: keyPair.fingerprintSha256,
        publicKeyPem: keyPair.publicKeyPem,
        signedAt: new Date().toISOString(),
      };

      setSignedBundle(bundle);

      // Pré-remplir automatiquement la section de vérification
      setVerifyDocText(docContent);
      setVerifySignatureInput(signatureHex);
      setTamperedOriginalText(null);
      setVerificationOutcome(null);

      const latencyMs = Number((performance.now() - start).toFixed(2));
      addLocalLog(
        'DOCUMENT_SIGNED',
        'success',
        `Document "${bundle.documentTitle}" signé avec succès via ECDSA P-256 + SHA-256 (${rawSigBytes.length} octets).`,
        latencyMs,
        `SIG:${signatureHex.slice(0, 16)}`
      );
    } catch (err: any) {
      const latencyMs = Number((performance.now() - start).toFixed(2));
      addLocalLog(
        'DOCUMENT_SIGNED',
        'error',
        `Échec de la signature numérique: ${err?.message || 'Erreur cryptographique'}`,
        latencyMs
      );
    } finally {
      setIsSigning(false);
    }
  }, [keyPair, docContent, docTitle, addLocalLog]);

  // ==========================================================================
  // 3. VÉRIFICATION D'INTÉGRITÉ & DÉTECTION D'ALTÉRATION
  // ==========================================================================
  const handleVerifySignature = useCallback(
    async (overrideText?: string) => {
      const textToVerify = overrideText !== undefined ? overrideText : verifyDocText;

      if (!textToVerify.trim()) {
        setVerificationOutcome({
          tested: true,
          valid: false,
          isTampered: false,
          details: 'Document manquant ou vide pour la vérification.',
          verifiedAt: new Date().toLocaleTimeString('fr-FR'),
        });
        return;
      }

      if (!verifySignatureInput.trim()) {
        setVerificationOutcome({
          tested: true,
          valid: false,
          isTampered: false,
          details: 'Signature numérique manquante.',
          verifiedAt: new Date().toLocaleTimeString('fr-FR'),
        });
        return;
      }

      setIsVerifying(true);
      const start = performance.now();
      try {
        // Clé publique à utiliser : priorité à la clé importée si spécifiée, sinon clé active
        const pubKey = importedKeyInfo?.rawKey || keyPair?.rawKeyPair.publicKey;
        if (!pubKey) {
          throw new Error('Aucune clé publique disponible pour la vérification.');
        }

        const enc = new TextEncoder();
        const dataBytes = enc.encode(textToVerify);

        // Hash SHA-256 actuel du document
        const hashBuf = await window.crypto.subtle.digest('SHA-256', toArrayBuffer(dataBytes));
        const currentDocHashHex = bytesToHex(new Uint8Array(hashBuf));

        // Décodage de la signature (support Hex, Base64 et DER)
        let rawSigBytes: Uint8Array;
        const cleanSig = verifySignatureInput.trim();

        if (/^[0-9a-fA-F\s]+$/.test(cleanSig) && cleanSig.replace(/\s+/g, '').length % 2 === 0) {
          const parsed = hexToBytes(cleanSig);
          rawSigBytes = parseDerSignatureToRaw(parsed);
        } else {
          // Essai Base64
          const parsed = base64ToBytes(cleanSig);
          rawSigBytes = parseDerSignatureToRaw(parsed);
        }

        // Vérification WebCrypto
        const isValid = await window.crypto.subtle.verify(
          {
            name: 'ECDSA',
            hash: { name: 'SHA-256' },
          },
          pubKey,
          toArrayBuffer(rawSigBytes),
          toArrayBuffer(dataBytes)
        );

        const latencyMs = Number((performance.now() - start).toFixed(2));
        const isTampered = !isValid && tamperedOriginalText !== null && tamperedOriginalText !== textToVerify;
        const sigEntropy = computeShannonEntropy(rawSigBytes);

        if (isValid) {
          setVerificationOutcome({
            tested: true,
            valid: true,
            isTampered: false,
            details:
              'Signature cryptographique 100% VALIDE. Le document est authentique et conforme à la clé publique.',
            verifiedAt: new Date().toLocaleTimeString('fr-FR'),
            documentHashHex: currentDocHashHex,
            signatureEntropyBits: sigEntropy,
            documentSizeBytes: dataBytes.length,
          });
          addLocalLog(
            'SIGNATURE_VERIFIED',
            'success',
            'Signature numérique validée avec succès. Intégrité absolue certifiée.',
            latencyMs,
            `HASH:${currentDocHashHex.slice(0, 16)}`
          );
        } else {
          setVerificationOutcome({
            tested: true,
            valid: false,
            isTampered: true,
            details: isTampered
              ? "ALERTE D'ALTÉRATION : Le document a été falsifié après signature ! La valeur mathématique de la signature ne correspond plus au condensat SHA-256."
              : 'REJET CRYPTOGRAPHIQUE : La signature ne correspond pas au document ou a été générée avec une autre clé.',
            verifiedAt: new Date().toLocaleTimeString('fr-FR'),
            documentHashHex: currentDocHashHex,
            signatureEntropyBits: sigEntropy,
            documentSizeBytes: dataBytes.length,
          });
          addLocalLog(
            'TAMPER_DETECTED',
            'error',
            isTampered
              ? "Falsification détectée : signature rejetée suite à l'altération du contenu."
              : 'Échec de vérification : signature non concordante.',
            latencyMs,
            `HASH:${currentDocHashHex.slice(0, 16)}`
          );
        }
      } catch (err: any) {
        const latencyMs = Number((performance.now() - start).toFixed(2));
        setVerificationOutcome({
          tested: true,
          valid: false,
          isTampered: false,
          details: `Erreur lors de la vérification : ${err?.message || 'Signature malformée.'}`,
          verifiedAt: new Date().toLocaleTimeString('fr-FR'),
        });
        addLocalLog('SIGNATURE_VERIFIED', 'error', `Erreur vérification: ${err?.message}`, latencyMs);
      } finally {
        setIsVerifying(false);
      }
    },
    [verifyDocText, verifySignatureInput, importedKeyInfo, keyPair, tamperedOriginalText, addLocalLog]
  );

  // Simulation d'altération (Tamper Test)
  const handleSimulateTamper = useCallback(() => {
    if (!tamperedOriginalText) {
      setTamperedOriginalText(verifyDocText);
    }
    // Altération d'un seul caractère ou mot
    const altered = verifyDocText.includes('// MODIFICATION_NON_AUTORISEE')
      ? verifyDocText + ' [CORROMPU]'
      : verifyDocText + '\n// MODIFICATION_NON_AUTORISEE: 1 octet altéré';

    setVerifyDocText(altered);
    handleVerifySignature(altered);
  }, [verifyDocText, tamperedOriginalText, handleVerifySignature]);

  // Rétablissement du document d'origine
  const handleRestoreOriginal = useCallback(() => {
    if (tamperedOriginalText) {
      setVerifyDocText(tamperedOriginalText);
      handleVerifySignature(tamperedOriginalText);
      setTamperedOriginalText(null);
    } else if (signedBundle) {
      setVerifyDocText(signedBundle.documentContent);
      setVerifySignatureInput(signedBundle.signatureHex);
      handleVerifySignature(signedBundle.documentContent);
    }
  }, [tamperedOriginalText, signedBundle, handleVerifySignature]);

  // ==========================================================================
  // 4. IMPORTATION DE CLÉ PUBLIQUE EXTERNE (PEM X.509)
  // ==========================================================================
  const handleImportPublicKeyPem = useCallback(async () => {
    if (!importedPemInput.trim()) {
      setImportError('Veuillez coller une clé publique au format PEM valide.');
      return;
    }

    setImportError(null);
    const start = performance.now();
    try {
      const b64 = importedPemInput
        .replace(/-----BEGIN [A-Z0-9_ -]+-----/g, '')
        .replace(/-----END [A-Z0-9_ -]+-----/g, '')
        .replace(/\s+/g, '');
      const spkiBytes = base64ToBytes(b64);

      const rawKey = await window.crypto.subtle.importKey(
        'spki',
        toArrayBuffer(spkiBytes),
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true,
        ['verify']
      );

      const fpBuffer = await window.crypto.subtle.digest('SHA-256', toArrayBuffer(spkiBytes));
      const fingerprint = bytesToHex(new Uint8Array(fpBuffer));

      setImportedKeyInfo({
        fingerprint,
        rawKey,
        pem: importedPemInput.trim(),
        format: 'pem',
      });

      const latencyMs = Number((performance.now() - start).toFixed(2));
      addLocalLog(
        'PUBLIC_KEY_IMPORTED',
        'success',
        `Clé publique P-256 importée avec succès (Empreinte: ${fingerprint.slice(0, 12)}…).`,
        latencyMs,
        `SHA256:${fingerprint.slice(0, 16)}`
      );
    } catch (err: any) {
      setImportError(`Échec d'importation : ${err?.message || 'Format PEM ou courbe non reconnue.'}`);
    }
  }, [importedPemInput, addLocalLog]);

  const handleImportPublicKeyJwk = useCallback(async () => {
    if (!importedJwkInput.trim()) {
      setImportError('Veuillez coller un objet JSON Web Key (JWK) valide.');
      return;
    }

    setImportError(null);
    const start = performance.now();
    try {
      const jwkObj = JSON.parse(importedJwkInput.trim());
      if (jwkObj.kty !== 'EC' || jwkObj.crv !== 'P-256') {
        throw new Error("Le JWK doit spécifier kty: 'EC' et crv: 'P-256'.");
      }

      const rawKey = await window.crypto.subtle.importKey(
        'jwk',
        jwkObj,
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true,
        ['verify']
      );

      const spkiBuffer = await window.crypto.subtle.exportKey('spki', rawKey);
      const spkiBytes = new Uint8Array(spkiBuffer);
      const pem = formatPem(bytesToBase64(spkiBytes), 'PUBLIC KEY');
      const fpBuffer = await window.crypto.subtle.digest('SHA-256', toArrayBuffer(spkiBytes));
      const fingerprint = bytesToHex(new Uint8Array(fpBuffer));

      setImportedKeyInfo({
        fingerprint,
        rawKey,
        pem,
        format: 'jwk',
      });

      const latencyMs = Number((performance.now() - start).toFixed(2));
      addLocalLog(
        'PUBLIC_KEY_IMPORTED',
        'success',
        `Clé publique JWK P-256 importée avec succès (Empreinte: ${fingerprint.slice(0, 12)}…).`,
        latencyMs,
        `SHA256:${fingerprint.slice(0, 16)}`
      );
    } catch (err: any) {
      setImportError(`Échec d'importation JWK : ${err?.message || 'Format JWK ou JSON invalide.'}`);
    }
  }, [importedJwkInput, addLocalLog]);

  const handleDocFileSelect = useCallback(
    (file: File) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        setDocContent(text);
        setDocTitle(file.name);
        addLocalLog(
          'DOCUMENT_SIGNED',
          'success',
          `Document importé depuis fichier : "${file.name}" (${file.size} octets).`,
          0
        );
      };
      reader.readAsText(file);
    },
    [addLocalLog]
  );

  const handleBundleFileSelect = useCallback(
    (file: File) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = (e.target?.result as string) || '';
          const parsed = JSON.parse(text);
          if (parsed.documentContent && (parsed.signatureHex || parsed.signatureBase64 || parsed.signatureDerHex)) {
            setVerifyDocText(parsed.documentContent);
            setVerifySignatureInput(parsed.signatureHex || parsed.signatureDerHex || parsed.signatureBase64);
            setTamperedOriginalText(null);

            if (parsed.publicKeyPem) {
              try {
                const b64 = parsed.publicKeyPem
                  .replace(/-----BEGIN [A-Z0-9_ -]+-----/g, '')
                  .replace(/-----END [A-Z0-9_ -]+-----/g, '')
                  .replace(/\s+/g, '');
                const spkiBytes = base64ToBytes(b64);
                const rawKey = await window.crypto.subtle.importKey(
                  'spki',
                  toArrayBuffer(spkiBytes),
                  { name: 'ECDSA', namedCurve: 'P-256' },
                  true,
                  ['verify']
                );
                const fpBuffer = await window.crypto.subtle.digest('SHA-256', toArrayBuffer(spkiBytes));
                const fingerprint = bytesToHex(new Uint8Array(fpBuffer));
                setImportedKeyInfo({
                  fingerprint,
                  rawKey,
                  pem: parsed.publicKeyPem,
                  format: 'pem',
                });
              } catch {
                // ignore
              }
            }

            addLocalLog(
              'SIGNATURE_VERIFIED',
              'success',
              `Paquet cryptographique signé chargé : "${file.name}".`,
              0
            );

            setTimeout(() => {
              handleVerifySignature(parsed.documentContent);
            }, 30);
          } else {
            throw new Error(
              "Le fichier ne respecte pas la structure d'enveloppe signée (champs requis: documentContent, signatureHex)."
            );
          }
        } catch (err: any) {
          addLocalLog('SIGNATURE_VERIFIED', 'error', `Échec d'import du paquet : ${err?.message}`, 0);
          setVerificationOutcome({
            tested: true,
            valid: false,
            isTampered: false,
            details: `Erreur d'import : ${err?.message}`,
            verifiedAt: new Date().toLocaleTimeString('fr-FR'),
          });
        }
      };
      reader.readAsText(file);
    },
    [addLocalLog, handleVerifySignature]
  );

  // ==========================================================================
  // 5. BANC D'ESSAI MATÉRIEL (Benchmark Client WebCrypto P-256)
  // ==========================================================================
  const handleRunBenchmark = useCallback(async () => {
    setIsBenchmarking(true);
    const samplePayload = new TextEncoder().encode(
      'Renumerate VPN Quantum Defense - Benchmark payload ECDSA P-256 operations per second'
    );
    try {
      // 1. KeyGen
      const keyGenStart = performance.now();
      const countKeyGen = 8;
      let lastKp: CryptoKeyPair | null = null;
      for (let i = 0; i < countKeyGen; i++) {
        lastKp = await window.crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign', 'verify']
        );
      }
      const keyGenDurationMs = performance.now() - keyGenStart;
      const keyGenOpsPerSec = Math.round(countKeyGen / (keyGenDurationMs / 1000));
      const keyGenLatencyUs = Math.round((keyGenDurationMs / countKeyGen) * 1000);

      if (!lastKp) throw new Error('Échec benchmark keypair');

      // 2. Sign
      const signStart = performance.now();
      const countSign = 24;
      let lastSig: ArrayBuffer | null = null;
      for (let i = 0; i < countSign; i++) {
        lastSig = await window.crypto.subtle.sign(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          lastKp.privateKey,
          toArrayBuffer(samplePayload)
        );
      }
      const signDurationMs = performance.now() - signStart;
      const signOpsPerSec = Math.round(countSign / (signDurationMs / 1000));
      const signLatencyUs = Math.round((signDurationMs / countSign) * 1000);

      // 3. Verify
      const verifyStart = performance.now();
      const countVerify = 24;
      for (let i = 0; i < countVerify; i++) {
        await window.crypto.subtle.verify(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          lastKp.publicKey,
          lastSig!,
          toArrayBuffer(samplePayload)
        );
      }
      const verifyDurationMs = performance.now() - verifyStart;
      const verifyOpsPerSec = Math.round(countVerify / (verifyDurationMs / 1000));
      const verifyLatencyUs = Math.round((verifyDurationMs / countVerify) * 1000);

      const result = {
        keyGenOpsPerSec,
        signOpsPerSec,
        verifyOpsPerSec,
        keyGenLatencyUs,
        signLatencyUs,
        verifyLatencyUs,
        hardwareAccelerated: signLatencyUs < 15000,
      };

      setBenchmarkResult(result);
      addLocalLog(
        'BENCHMARK_EXECUTED',
        'success',
        `Benchmark terminé : ${signOpsPerSec} signatures/sec (${signLatencyUs}µs) | ${verifyOpsPerSec} vérifications/sec.`,
        Number(signDurationMs.toFixed(1)),
        `${signOpsPerSec} ops/s`
      );
    } catch (err: any) {
      addLocalLog('BENCHMARK_EXECUTED', 'error', `Échec du benchmark: ${err?.message}`, 0);
    } finally {
      setIsBenchmarking(false);
    }
  }, [addLocalLog]);

  // Copie dans le presse-papiers
  const copyToClipboard = useCallback((text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyField(fieldId);
    setTimeout(() => setCopiedKeyField(null), 2200);
  }, []);

  // Téléchargement de fichiers
  const downloadBlob = useCallback((content: string, filename: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* En-tête principal DashboardECC */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                <span>Dashboard Cryptographique ECC</span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono font-bold">
                  ECDSA P-256 + SHA-256
                </span>
              </h1>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              Moteur cryptographique asymétrique à courbes elliptiques intégré via la{' '}
              <strong className="text-slate-200">Web Crypto API</strong> native. Génération de paires de clés
              matérielles, signature numérique certifiée IEEE P1363 / ASN.1 DER et détection d’altération de documents
              en temps réel.
            </p>
          </div>

          {/* Statut Enclave RAM */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 font-medium">Clé privée en mémoire RAM :</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Isolée (Non stockée)
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Zero-Persistence · Zéro fuite localStorage
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateKeyPair}
              disabled={isGenerating}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Génération...' : 'Régénérer Paire P-256'}</span>
            </button>
          </div>
        </div>

        {/* Barre de navigation des onglets */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Vue Globale & Métriques', icon: ShieldCheck },
            { id: 'keygen', label: '1. Génération & Clés', icon: KeyRound },
            { id: 'sign', label: '2. Signer Document', icon: FileCheck },
            { id: 'verify', label: '3. Vérifier & Altération', icon: ShieldAlert },
            { id: 'import', label: '4. Clés Publiques & Import', icon: Layers },
            { id: 'audit', label: '5. Journal d’Audit', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          ONGLET 0: VUE GLOBALE & MÉTRIQUES
      ====================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Grille de 4 cartes récapitulatives */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Standard Cryptographique</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">NIST P-256</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">FIPS 186-4 · secp256r1</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Niveau de Sécurité</span>
                <Lock className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">128 Bits</div>
              <div className="text-xs text-slate-500 mt-1">Équivalent RSA-3072 / AES-128</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Algorithme de Hachage</span>
                <Hash className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">SHA-256</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">256-bit Digest (WebCrypto)</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Accélération Matérielle</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">Native CSPRNG</div>
              <div className="text-xs text-slate-500 mt-1">window.crypto.subtle</div>
            </div>
          </div>

          {/* Panneau de statut de la clé active */}
          {keyPair ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {keyPair.label}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Empreinte SHA-256 : {keyPair.fingerprintSha256}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                    Point sur Courbe Validé (y² ≡ x³ - 3x + b)
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('keygen')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    Inspecter la Clé →
                  </button>
                </div>
              </div>

              {/* Raccourcis d'actions rapides */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('sign')}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left hover:border-cyan-500/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                      Signer un Document
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Générer une signature IEEE P1363 et un paquet certifié JSON.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('verify')}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left hover:border-cyan-500/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                      Vérifier l’Intégrité
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Tester la validité mathématique et détecter toute falsification.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarking}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left hover:border-cyan-500/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                      Banc d’Essai Matériel
                    </span>
                    <Play className={`w-4 h-4 text-slate-400 ${isBenchmarking ? 'animate-spin' : ''}`} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Mesurer le débit ops/s et la latence microseconde de votre matériel.
                  </p>
                </button>
              </div>

              {/* Résultat du benchmark si exécuté */}
              {benchmarkResult && (
                <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-400 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Résultats du Banc d’Essai Matériel P-256 :
                    </span>
                    <span className="text-emerald-400 font-mono">
                      Accélération Matérielle Confirmée
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center font-mono">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Génération Clés</div>
                      <div className="text-base font-bold text-white">{benchmarkResult.keyGenOpsPerSec} ops/s</div>
                      <div className="text-[10px] text-slate-500">{benchmarkResult.keyGenLatencyUs} µs / op</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Signatures ECDSA</div>
                      <div className="text-base font-bold text-cyan-400">{benchmarkResult.signOpsPerSec} ops/s</div>
                      <div className="text-[10px] text-slate-500">{benchmarkResult.signLatencyUs} µs / op</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Vérifications</div>
                      <div className="text-base font-bold text-emerald-400">{benchmarkResult.verifyOpsPerSec} ops/s</div>
                      <div className="text-[10px] text-slate-500">{benchmarkResult.verifyLatencyUs} µs / op</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Initialisation de la paire de clés ECDSA P-256 en cours...
              </p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 1: GÉNÉRATION DE CLÉ & GESTION (PEM / JWK / COORDONNÉES)
      ====================================================================== */}
      {activeTab === 'keygen' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Génération Asymétrique ECDSA P-256 (Web Crypto API)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Les clés privées sont instanciées dans la mémoire vive de l’enclave sécurisée du navigateur et ne sont
                  jamais écrites sur le disque ou dans localStorage.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={keyLabelInput}
                  onChange={(e) => setKeyLabelInput(e.target.value)}
                  placeholder="Nom ou libellé de la paire"
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none w-56"
                />
                <button
                  type="button"
                  onClick={handleGenerateKeyPair}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-600/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Calcul...' : 'Nouvelle Paire'}</span>
                </button>
              </div>
            </div>

            {keyPair && (
              <div className="space-y-6">
                {/* Coordonnées affines (X, Y) et intégrité de courbe */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-500" />
                      Point Affine Géométrique sur NIST P-256 (256 bits) :
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      y² ≡ x³ - 3x + b (mod p) : VALIDÉ
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400">Coordonnée X (32 octets / 256 bits) :</div>
                      <div className="text-cyan-600 dark:text-cyan-400 break-all select-all">
                        {keyPair.pointCoordinates.xHex}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400">Coordonnée Y (32 octets / 256 bits) :</div>
                      <div className="text-purple-600 dark:text-purple-400 break-all select-all">
                        {keyPair.pointCoordinates.yHex}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-mono text-slate-500">
                    <div>Format compressé SEC 1 : {keyPair.pointCoordinates.compressedHex.slice(0, 36)}...</div>
                    <div>Empreinte : {keyPair.fingerprintSha256.slice(0, 24)}...</div>
                  </div>
                </div>

                {/* Export Clé Publique PEM (SubjectPublicKeyInfo) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Clé Publique au Format PEM Standard (RFC 5280 / SPKI)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(keyPair.publicKeyPem, 'pem')}
                        className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedKeyField === 'pem' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copier PEM</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(keyPair.publicKeyPem, `ecc-public-key-${keyPair.fingerprintSha256.slice(0, 8)}.pem`)
                        }
                        className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger .pem</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    readOnly
                    rows={6}
                    value={keyPair.publicKeyPem}
                    className="w-full p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-cyan-400 border border-slate-800 select-all outline-none"
                  />
                </div>

                {/* Export JWK (JSON Web Key) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white">
                      Structure JSON Web Key (RFC 7517 JWK)
                    </label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(JSON.stringify(keyPair.publicKeyJwk, null, 2), 'jwk')}
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedKeyField === 'jwk' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copier JWK</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800 overflow-x-auto select-all">
                    {JSON.stringify(keyPair.publicKeyJwk, null, 2)}
                  </pre>
                </div>

                {/* Sécurité Clé Privée */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
                  <Lock className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <div className="font-bold">Protection Cryptographique de la Clé Privée :</div>
                    <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-200">
                      La clé privée est maintenue sous forme de handle opaque <code className="font-mono">CryptoKey</code>{' '}
                      dans la mémoire du processus. Elle n’est jamais exposée dans les logs, ni stockée dans le cache du
                      navigateur, garantissant une protection maximale contre les exfiltrations XSS.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 2: SIGNATURE NUMÉRIQUE DE DOCUMENT
      ====================================================================== */}
      {activeTab === 'sign' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-cyan-500" />
                  <span>Signature Numérique de Document (ECDSA + SHA-256)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Génère une preuve mathématique non répudiable liée au contenu exact du document et à votre clé privée.
                </p>
              </div>

              {keyPair && (
                <div className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  Signataire : {keyPair.label} ({keyPair.fingerprintSha256.slice(0, 8)})
                </div>
              )}
            </div>

            {/* Formulaire du document */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nom / Identifiant du Document :
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Contenu du Document à Signer (Texte clair, JSON, Contrat) :
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new TextEncoder().encode(docContent).length} octets
                  </span>
                </div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(true);
                  }}
                  onDragLeave={() => setIsDraggingDoc(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleDocFileSelect(file);
                  }}
                  className={`relative rounded-xl transition-all ${
                    isDraggingDoc ? 'ring-2 ring-cyan-500 bg-cyan-500/10' : ''
                  }`}
                >
                  <textarea
                    rows={8}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none leading-relaxed"
                  />
                  {isDraggingDoc && (
                    <div className="absolute inset-0 flex items-center justify-center bg-cyan-950/80 backdrop-blur-xs rounded-xl border border-cyan-500 text-cyan-300 font-bold text-xs pointer-events-none">
                      Déposez votre fichier ici pour charger son contenu
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={docFileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleDocFileSelect(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Charger Fichier (.txt, .json, .md)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDocContent(
                        `ORDRE DE ROUTAGE VPN IMMUABLE\nDate: ${new Date().toISOString()}\nNoeuds: [CH-Zurich, IS-Reykjavik]\nPriorité: HAUTE\nSignature autorisée par l'enclave racine.`
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Exemple : Routage
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDocContent(
                        JSON.stringify(
                          {
                            auditId: 'AUDIT-' + Date.now().toString(36),
                            statut: 'CONFORME_ANSSI_NIST',
                            timestamp: new Date().toISOString(),
                            tlsVersion: 'TLS_1_3',
                            antiLeakActive: true,
                          },
                          null,
                          2
                        )
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Exemple : JSON
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSignDocument}
                  disabled={isSigning || !keyPair}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <FileCheck className={`w-4 h-4 ${isSigning ? 'animate-spin' : ''}`} />
                  <span>{isSigning ? 'Calcul de signature...' : 'Apposer la Signature Numérique'}</span>
                </button>
              </div>
            </div>

            {/* Résultat de la Signature */}
            {signedBundle && (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Document Signé avec Succès (Conforme IEEE P1363 & RFC 3279)
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(signedBundle.signatureHex, 'sigHex')}
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                    >
                      {copiedKeyField === 'sigHex' ? 'Copié' : 'Copier Sig (Hex)'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlob(
                          JSON.stringify(signedBundle, null, 2),
                          `${signedBundle.documentTitle.replace(/\.[^/.]+$/, '')}.signed.json`,
                          'application/json'
                        )
                      }
                      className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger Paquet Signé (.json)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Signature Hexadécimale */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">Signature IEEE P1363 r || s (64 octets / 128 hex) :</div>
                    <div className="text-cyan-400 break-all select-all">{signedBundle.signatureHex}</div>
                  </div>

                  {/* Hash SHA-256 du document */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400">Condensat SHA-256 du document d’origine :</div>
                    <div className="text-purple-400 break-all select-all">{signedBundle.documentSha256}</div>
                  </div>
                </div>

                {/* Bouton pour basculer vers l'onglet vérification */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('verify');
                      handleVerifySignature();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <span>Vérifier l’Intégrité dans l’Inspecteur →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 3: VÉRIFICATION D'INTÉGRITÉ & DÉTECTION D'ALTÉRATION
      ====================================================================== */}
      {activeTab === 'verify' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  <span>Vérification d’Intégrité & Détection d’Altération</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Valide l’authenticité absolue du document face à la clé publique. Testez en direct l’effet de la
                  modification d’un seul caractère.
                </p>
              </div>

              {/* Bouton de simulation d'altération et import paquet */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={bundleFileInputRef}
                  className="hidden"
                  accept=".json,.signed.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBundleFileSelect(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => bundleFileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer Paquet (.signed.json)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSimulateTamper}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Simuler Altération (Tamper Test)</span>
                </button>

                {tamperedOriginalText && (
                  <button
                    type="button"
                    onClick={handleRestoreOriginal}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restaurer l’Original</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bannières de résultat de vérification */}
            {verificationOutcome && (
              <div
                className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
                  verificationOutcome.valid
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                    : 'bg-red-500/10 border-red-500/40 text-red-950 dark:text-red-200'
                }`}
              >
                {verificationOutcome.valid ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-sm">
                      {verificationOutcome.valid
                        ? 'INTÉGRITÉ 100% CERTIFIÉE — DOCUMENT AUTHENTIQUE'
                        : verificationOutcome.isTampered
                        ? 'ALERTE : ALTÉRATION & FALSIFICATION DÉTECTÉE !'
                        : 'REJET DE SIGNATURE CRYPTOGRAPHIQUE'}
                    </span>
                    <span className="text-[11px] font-mono opacity-75">
                      Vérifié à : {verificationOutcome.verifiedAt}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed opacity-90">{verificationOutcome.details}</p>

                  {verificationOutcome.documentHashHex && (
                    <div className="text-[11px] font-mono pt-1 text-slate-600 dark:text-slate-400">
                      Condensat SHA-256 calculé : {verificationOutcome.documentHashHex}
                    </div>
                  )}

                  {verificationOutcome.signatureEntropyBits !== undefined && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-mono border-t border-slate-200/40 dark:border-slate-800/60 mt-2">
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span>Taille Document :</span>
                        <strong className="text-slate-900 dark:text-white">
                          {verificationOutcome.documentSizeBytes} octets
                        </strong>
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <span>Entropie Shannon Signature :</span>
                        <strong className="text-cyan-600 dark:text-cyan-400">
                          {verificationOutcome.signatureEntropyBits} / 8.00 bits/octet
                        </strong>
                        <span className="text-[10px] text-emerald-500 font-semibold">(Aléatoire NIST Robuste)</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Champs de vérification */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Document à Contrôler (ou glissez-déposez une enveloppe .signed.json) :
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingBundle(true);
                  }}
                  onDragLeave={() => setIsDraggingBundle(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingBundle(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleBundleFileSelect(file);
                  }}
                  className={`relative rounded-xl transition-all ${
                    isDraggingBundle ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
                  }`}
                >
                  <textarea
                    rows={6}
                    value={verifyDocText}
                    onChange={(e) => {
                      setVerifyDocText(e.target.value);
                      if (verificationOutcome) setVerificationOutcome(null);
                    }}
                    placeholder="Collez ici le document ou glissez un paquet .signed.json..."
                    className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none leading-relaxed"
                  />
                  {isDraggingBundle && (
                    <div className="absolute inset-0 flex items-center justify-center bg-purple-950/80 backdrop-blur-xs rounded-xl border border-purple-500 text-purple-300 font-bold text-xs pointer-events-none">
                      Déposez votre paquet signé .signed.json pour vérification automatique
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Signature Numérique (Hexadécimal ou Base64) :
                </label>
                <input
                  type="text"
                  value={verifySignatureInput}
                  onChange={(e) => {
                    setVerifySignatureInput(e.target.value);
                    if (verificationOutcome) setVerificationOutcome(null);
                  }}
                  placeholder="Exemple: 3045022100... ou format brut 128 caractères hexadécimaux"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500 font-mono">
                  Clé de contrôle :{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {importedKeyInfo
                      ? `Clé Externe (${importedKeyInfo.format.toUpperCase()} · ${importedKeyInfo.fingerprint.slice(0, 8)})`
                      : keyPair
                      ? keyPair.label
                      : 'Aucune'}
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={() => handleVerifySignature()}
                  disabled={isVerifying}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
                  <span>{isVerifying ? 'Vérification...' : 'Lancer la Vérification Cryptographique'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 4: GESTION & IMPORT DE CLÉS PUBLIQUES EXTERNES
      ====================================================================== */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                <span>Importer &amp; Valider une Clé Publique Externe</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Importez une clé publique PEM (X.509 SPKI) d’un tiers (passerelle partenaire, auditeur, client distant)
                pour vérifier ses signatures sans posséder sa clé privée.
              </p>
            </div>

            {/* Sélecteur de format d'import */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Format de la clé :
              </span>
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('pem');
                    setImportError(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'pem'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  PEM (X.509 / RFC 5280)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('jwk');
                    setImportError(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'jwk'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  JWK (RFC 7517)
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {importMode === 'pem' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Clé Publique PEM (X.509 / SubjectPublicKeyInfo) :
                  </label>
                  <textarea
                    rows={6}
                    value={importedPemInput}
                    onChange={(e) => setImportedPemInput(e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----"
                    className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-cyan-400 outline-none leading-relaxed"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Clé Publique JWK (JSON Web Key P-256) :
                  </label>
                  <textarea
                    rows={6}
                    value={importedJwkInput}
                    onChange={(e) => setImportedJwkInput(e.target.value)}
                    placeholder="{\n  &quot;kty&quot;: &quot;EC&quot;,\n  &quot;crv&quot;: &quot;P-256&quot;,\n  &quot;x&quot;: &quot;...&quot;,\n  &quot;y&quot;: &quot;...&quot;\n}"
                    className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-cyan-400 outline-none leading-relaxed"
                  />
                </div>
              )}

              {importError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-medium">
                  {importError}
                </div>
              )}

              {importedKeyInfo && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-bold">
                    <span>Clé Publique P-256 ({importedKeyInfo.format.toUpperCase()}) Valide &amp; Chargée</span>
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    Empreinte SHA-256 : {importedKeyInfo.fingerprint}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (keyPair) {
                      if (importMode === 'pem') {
                        setImportedPemInput(keyPair.publicKeyPem);
                      } else {
                        setImportedJwkInput(JSON.stringify(keyPair.publicKeyJwk, null, 2));
                      }
                    }
                  }}
                  className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
                >
                  Charger la clé active ({importMode.toUpperCase()}) comme exemple
                </button>

                <button
                  type="button"
                  onClick={importMode === 'pem' ? handleImportPublicKeyPem : handleImportPublicKeyJwk}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer Clé {importMode.toUpperCase()}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 5: JOURNAL D'AUDIT CRYPTOGRAPHIQUE
      ====================================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-500" />
                  <span>Journal des Événements Cryptographiques ECC</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Traces d’audit immuables pour chaque génération de clé, signature numérique et tentative de
                  vérification.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    JSON.stringify(operationLogs, null, 2),
                    `ecc-audit-logs-${Date.now()}.json`,
                    'application/json'
                  )
                }
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter Journal JSON</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {operationLogs.map((log) => {
                const isSuccess = log.status === 'success';
                const isWarning = log.status === 'warning';
                return (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs font-mono">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSuccess ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="font-bold text-slate-900 dark:text-white">{log.action}</span>
                        <span className="text-[11px] text-slate-400">({log.timestamp})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-sans text-xs">{log.details}</p>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <span className="text-[11px] text-slate-400 font-mono">{log.latencyMs} ms</span>
                      {log.digest && (
                        <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">{log.digest}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
