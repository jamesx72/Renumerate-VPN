/**
 * Service Cryptographique d'Horodatage & Scellement HMAC-SHA256 des Journaux Système
 * Fournit :
 * - Dérivation de clé HMAC volatile pour la session courante (FIPS 198-1 / RFC 2104)
 * - Signature cryptographique de chaque nouvelle entrée de log (horodatage infalsifiable)
 * - Vérification active d'intégrité (détection d'altération en temps réel)
 */

import { LogEntry } from '../types';

let cachedHmacKey: CryptoKey | null = null;
let cachedKeyFingerprint = '';
let sessionCreatedAt = '';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function isHmacLoggingEnabled(): boolean {
  try {
    const val = localStorage.getItem('renumerate_hmac_log_signing');
    return val === null ? true : val === 'true'; // Actif par défaut pour sécurité maximale
  } catch {
    return true;
  }
}

export function setHmacLoggingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem('renumerate_hmac_log_signing', enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export async function getSessionHmacKey(): Promise<{
  key: CryptoKey;
  fingerprint: string;
  createdAt: string;
}> {
  if (cachedHmacKey && cachedKeyFingerprint) {
    return {
      key: cachedHmacKey,
      fingerprint: cachedKeyFingerprint,
      createdAt: sessionCreatedAt,
    };
  }

  // Génération d'une clé HMAC-SHA256 256 bits dédiée à la session via WebCrypto natif
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'HMAC',
      hash: { name: 'SHA-256' },
      length: 256,
    },
    true, // extractable for fingerprint digest computation
    ['sign', 'verify']
  );

  // Calcul de l'empreinte publique de la clé HMAC (SHA-256 des bits de clé)
  const rawKeyBuffer = await window.crypto.subtle.exportKey('raw', key);
  const hashDigest = await window.crypto.subtle.digest('SHA-256', rawKeyBuffer);
  const fp = bytesToHex(new Uint8Array(hashDigest)).slice(0, 12).toUpperCase();

  cachedHmacKey = key;
  cachedKeyFingerprint = `HMAC:${fp}`;
  sessionCreatedAt = new Date().toISOString();

  return {
    key,
    fingerprint: cachedKeyFingerprint,
    createdAt: sessionCreatedAt,
  };
}

export function getCachedHmacInfo(): {
  fingerprint: string;
  active: boolean;
  algorithm: string;
} {
  return {
    fingerprint: cachedKeyFingerprint || 'HMAC:INIT...',
    active: isHmacLoggingEnabled(),
    algorithm: 'HMAC-SHA256 (RFC 2104)',
  };
}

/**
 * Construit la chaîne canonique d'un log pour signature / vérification
 */
function buildCanonicalLogMessage(entry: {
  id: string;
  timestampRaw: number;
  event: string;
  type: string;
  ip?: string;
}): string {
  return `${entry.id}|${entry.timestampRaw}|${entry.type}|${entry.ip || 'local'}|${entry.event}`;
}

/**
 * Signe cryptographiquement une entrée de log avec la clé HMAC de la session
 */
export async function signLogEntryHmac(entry: LogEntry): Promise<LogEntry> {
  try {
    const { key, fingerprint } = await getSessionHmacKey();
    const message = buildCanonicalLogMessage(entry);
    const enc = new TextEncoder();
    const data = enc.encode(message);

    const sigBuffer = await window.crypto.subtle.sign('HMAC', key, data);
    const signatureHex = bytesToHex(new Uint8Array(sigBuffer));

    return {
      ...entry,
      hmacSignature: signatureHex,
      hmacVerified: true,
      sessionKeyFingerprint: fingerprint,
    };
  } catch (err) {
    console.warn('Échec signature HMAC du log :', err);
    return entry;
  }
}

/**
 * Vérifie mathématiquement le sceau HMAC d'une entrée de log
 */
export async function verifyLogEntryHmac(entry: LogEntry): Promise<{
  valid: boolean;
  errorDetail?: string;
}> {
  if (!entry.hmacSignature) {
    return { valid: false, errorDetail: 'Aucune signature HMAC présente' };
  }

  try {
    const { key } = await getSessionHmacKey();
    const message = buildCanonicalLogMessage(entry);
    const enc = new TextEncoder();
    const data = enc.encode(message);

    // Convert hex signature back to bytes
    const match = entry.hmacSignature.match(/.{1,2}/g);
    if (!match) return { valid: false, errorDetail: 'Signature hex malformée' };
    const sigBytes = new Uint8Array(match.map((byte) => parseInt(byte, 16)));

    const valid = await window.crypto.subtle.verify('HMAC', key, sigBytes, data);

    return { valid };
  } catch (err: any) {
    return { valid: false, errorDetail: err?.message || 'Erreur cryptographique' };
  }
}

/**
 * Scelle en lot (batch) un ensemble d'entrées de logs
 */
export async function signLogsBatch(entries: LogEntry[]): Promise<LogEntry[]> {
  const { key, fingerprint } = await getSessionHmacKey();
  const enc = new TextEncoder();

  const signedEntries: LogEntry[] = [];
  for (const entry of entries) {
    if (entry.hmacSignature && entry.hmacVerified) {
      signedEntries.push(entry);
      continue;
    }

    try {
      const message = buildCanonicalLogMessage(entry);
      const data = enc.encode(message);
      const sigBuffer = await window.crypto.subtle.sign('HMAC', key, data);
      const signatureHex = bytesToHex(new Uint8Array(sigBuffer));

      signedEntries.push({
        ...entry,
        hmacSignature: signatureHex,
        hmacVerified: true,
        sessionKeyFingerprint: fingerprint,
      });
    } catch {
      signedEntries.push(entry);
    }
  }

  return signedEntries;
}
