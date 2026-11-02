/**
 * Service de Coffre-fort cryptographique local propulsé exclusivement par `window.crypto.subtle`.
 * - Dérivation de clé basée sur le mot de passe utilisateur : PBKDF2-HMAC-SHA256 -> AES-GCM 256 bits
 * - Chiffrement authentifié : AES-256-GCM (vecteur IV 96 bits aléatoire, Tag d'authentification 128 bits, AAD liée)
 * - Intégrité de bout en bout : Empreinte SHA-256 calculée avant scellement et vérifiée après déchiffrement
 * - Persistance locale : Stockage binaire chiffré dans IndexedDB (aucune donnée en clair ni mot de passe sur disque)
 */

export type KdfStrengthPreset = 150000 | 310000 | 600000;

export interface RvaultEnvelopeHeader {
  version: 1;
  alg: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltHex: string;
  ivHex: string;
  sha256PlainHex: string;
  sha256CipherHex: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  originalSize: number;
  createdAt: number;
}

export interface VaultStoredItem extends RvaultEnvelopeHeader {
  id: string;
  userId: string;
  sealedSize: number;
  transferStatus: 'local_only' | 'transferred_vpn';
  transferredAt?: number;
  transferredNodeIp?: string;
  cipherPreviewHex: string;
  cipherBuffer: ArrayBuffer;
}

export interface VaultVerifierRecord {
  saltHex: string;
  iterations: number;
  kcvHex: string;
  updatedAt: number;
}

const RVAULT_MAGIC = 'RVAULT01';
const DB_NAME = 'renumerate_local_vault_v1';
const DB_VERSION = 1;
const STORE_NAME = 'sealed_files';
const VERIFIER_PREFIX = 'renumerate_vault_kcv_v1_';

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) {
    throw new Error('Chaîne hexadécimale invalide.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

export function formatKcvBlocks(kcvHex: string): string {
  return (
    kcvHex
      .slice(0, 16)
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('·') || kcvHex.slice(0, 16).toUpperCase()
  );
}

export function formatByteSize(bytes: number): string {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const idx = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function ensureWebCrypto(): SubtleCrypto {
  if (
    typeof window === 'undefined' ||
    !window.crypto ||
    !window.crypto.subtle
  ) {
    throw new Error(
      "L'API WebCrypto (window.crypto.subtle) n'est pas disponible dans ce contexte navigateur."
    );
  }
  return window.crypto.subtle;
}

function buildAadBytes(params: {
  displayName: string;
  mimeType: string;
  originalSize: number;
  createdAt: number;
}): Uint8Array {
  const canonical = JSON.stringify({
    v: 1,
    n: params.displayName,
    m: params.mimeType || 'application/octet-stream',
    s: params.originalSize,
    t: params.createdAt,
  });
  return new TextEncoder().encode(canonical);
}

/**
 * Dérive une clé AES-256-GCM non-extractible + une empreinte de contrôle (KCV) à partir du mot de passe utilisateur.
 */
export async function deriveAesGcmKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 310000
): Promise<{
  key: CryptoKey;
  kcvHex: string;
  deriveMs: number;
}> {
  const subtle = ensureWebCrypto();
  if (!password) {
    throw new Error('Mot de passe utilisateur requis pour dériver la clé.');
  }

  const t0 = performance.now();
  const passwordBytes = new TextEncoder().encode(password);

  const baseKey = await subtle.importKey(
    'raw',
    toArrayBuffer(passwordBytes),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const aesKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Dérivation séparée par domaine pour calculer le Key Check Value (KCV) sans exposer la clé de chiffrement
  const kcvSaltLabel = new TextEncoder().encode('RENUMERATE-KCV-VERIFY-V1');
  const combinedKcvSalt = new Uint8Array(salt.length + kcvSaltLabel.length);
  combinedKcvSalt.set(salt, 0);
  combinedKcvSalt.set(kcvSaltLabel, salt.length);

  const kcvBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(combinedKcvSalt),
      iterations: Math.min(iterations, 100000),
      hash: 'SHA-256',
    },
    baseKey,
    128
  );

  const kcvDigest = await subtle.digest('SHA-256', kcvBits);
  const kcvHex = bytesToHex(new Uint8Array(kcvDigest)).slice(0, 16);
  const deriveMs = Math.max(1, Math.round(performance.now() - t0));

  return { key: aesKey, kcvHex, deriveMs };
}

/**
 * Vérifie le mot de passe utilisateur contre le vérificateur PBKDF2 du coffre (ou l'initialise lors du premier accès).
 */
export async function verifyOrInitVaultPassword(
  userId: string,
  password: string,
  preferredIterations: number = 310000
): Promise<{
  valid: boolean;
  kcvHex: string;
  deriveMs: number;
  iterations: number;
  isNewVerifier: boolean;
}> {
  const storageKey = `${VERIFIER_PREFIX}${userId}`;
  const rawExisting = localStorage.getItem(storageKey);

  if (rawExisting) {
    try {
      const parsed = JSON.parse(rawExisting) as VaultVerifierRecord;
      const salt = hexToBytes(parsed.saltHex);
      const { kcvHex, deriveMs } = await deriveAesGcmKeyFromPassword(
        password,
        salt,
        parsed.iterations
      );
      return {
        valid: kcvHex === parsed.kcvHex,
        kcvHex,
        deriveMs,
        iterations: parsed.iterations,
        isNewVerifier: false,
      };
    } catch {
      // Fallback to fresh initialization if corrupted
    }
  }

  const freshSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const { kcvHex, deriveMs } = await deriveAesGcmKeyFromPassword(
    password,
    freshSalt,
    preferredIterations
  );

  const record: VaultVerifierRecord = {
    saltHex: bytesToHex(freshSalt),
    iterations: preferredIterations,
    kcvHex,
    updatedAt: Date.now(),
  };
  localStorage.setItem(storageKey, JSON.stringify(record));

  return {
    valid: true,
    kcvHex,
    deriveMs,
    iterations: preferredIterations,
    isNewVerifier: true,
  };
}

export function clearVaultVerifier(userId: string): void {
  localStorage.removeItem(`${VERIFIER_PREFIX}${userId}`);
}

/**
 * Assemble un conteneur binaire `.rvault` autonome (En-tête authentifié + Ciphertext AES-256-GCM).
 */
export function buildRvaultBlob(
  header: RvaultEnvelopeHeader,
  cipherBuffer: ArrayBuffer
): Blob {
  const magicBytes = new TextEncoder().encode(RVAULT_MAGIC); // 8 octets
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const lengthPrefix = new Uint8Array(4);
  new DataView(lengthPrefix.buffer).setUint32(0, headerBytes.byteLength, false);

  return new Blob(
    [
      toArrayBuffer(magicBytes),
      toArrayBuffer(lengthPrefix),
      toArrayBuffer(headerBytes),
      cipherBuffer,
    ],
    { type: 'application/octet-stream' }
  );
}

/**
 * Chiffre localement un fichier via `window.crypto.subtle` avec une clé PBKDF2 dérivée du mot de passe utilisateur.
 */
export async function encryptFileWithUserPassword(
  file: File,
  password: string,
  options: {
    userId: string;
    iterations?: number;
    maskFilename?: boolean;
  }
): Promise<{
  item: VaultStoredItem;
  envelopeBlob: Blob;
  stats: {
    deriveMs: number;
    encryptMs: number;
    throughputMBps: number;
  };
}> {
  const subtle = ensureWebCrypto();
  const iterations = options.iterations ?? 310000;
  const createdAt = Date.now();

  const plainBuffer = await file.arrayBuffer();
  const sha256PlainDigest = await subtle.digest('SHA-256', plainBuffer);
  const sha256PlainHex = bytesToHex(new Uint8Array(sha256PlainDigest));

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const { key, deriveMs } = await deriveAesGcmKeyFromPassword(
    password,
    salt,
    iterations
  );

  const randomTag = bytesToHex(window.crypto.getRandomValues(new Uint8Array(4)));
  const displayName = options.maskFilename
    ? `scelle-${randomTag}.bin`
    : file.name;
  const mimeType = file.type || 'application/octet-stream';

  const aadBytes = buildAadBytes({
    displayName,
    mimeType,
    originalSize: file.size,
    createdAt,
  });

  const encStart = performance.now();
  const cipherBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(aadBytes),
      tagLength: 128,
    },
    key,
    plainBuffer
  );
  const encryptMs = Math.max(1, Math.round(performance.now() - encStart));

  const sha256CipherDigest = await subtle.digest('SHA-256', cipherBuffer);
  const sha256CipherHex = bytesToHex(new Uint8Array(sha256CipherDigest));

  const previewBytes = new Uint8Array(
    cipherBuffer.slice(0, Math.min(48, cipherBuffer.byteLength))
  );
  const cipherPreviewHex = bytesToHex(previewBytes);

  const header: RvaultEnvelopeHeader = {
    version: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    sha256PlainHex,
    sha256CipherHex,
    originalName: file.name,
    displayName,
    mimeType,
    originalSize: file.size,
    createdAt,
  };

  const envelopeBlob = buildRvaultBlob(header, cipherBuffer);

  const item: VaultStoredItem = {
    ...header,
    id: `vault-${createdAt}-${randomTag}`,
    userId: options.userId,
    sealedSize: cipherBuffer.byteLength,
    transferStatus: 'local_only',
    cipherPreviewHex,
    cipherBuffer,
  };

  const seconds = Math.max(0.001, encryptMs / 1000);
  const throughputMBps = parseFloat(
    (file.size / (1024 * 1024) / seconds).toFixed(2)
  );

  return {
    item,
    envelopeBlob,
    stats: {
      deriveMs,
      encryptMs,
      throughputMBps,
    },
  };
}

/**
 * Déchiffre localement un objet stocké dans le coffre et vérifie son empreinte SHA-256 d'origine.
 */
export async function decryptStoredVaultItem(
  item: VaultStoredItem,
  password: string
): Promise<{
  blob: Blob;
  restoredName: string;
  verifiedSha256: boolean;
  decryptMs: number;
}> {
  const subtle = ensureWebCrypto();
  const salt = hexToBytes(item.saltHex);
  const iv = hexToBytes(item.ivHex);

  const t0 = performance.now();
  const { key } = await deriveAesGcmKeyFromPassword(
    password,
    salt,
    item.iterations
  );

  const aadBytes = buildAadBytes({
    displayName: item.displayName,
    mimeType: item.mimeType,
    originalSize: item.originalSize,
    createdAt: item.createdAt,
  });

  try {
    const plainBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(aadBytes),
        tagLength: 128,
      },
      key,
      item.cipherBuffer
    );

    const digestBuffer = await subtle.digest('SHA-256', plainBuffer);
    const computedHex = bytesToHex(new Uint8Array(digestBuffer));
    const decryptMs = Math.max(1, Math.round(performance.now() - t0));

    return {
      blob: new Blob([plainBuffer], {
        type: item.mimeType || 'application/octet-stream',
      }),
      restoredName: item.originalName || item.displayName,
      verifiedSha256: computedHex === item.sha256PlainHex,
      decryptMs,
    };
  } catch {
    throw new Error(
      "Échec d'authentification AES-256-GCM : mot de passe incorrect ou données altérées."
    );
  }
}

/**
 * Déchiffre un fichier externe `.rvault` glissé-déposé directement par l'utilisateur.
 */
export async function decryptRvaultFile(
  file: File,
  password: string
): Promise<{
  blob: Blob;
  restoredName: string;
  header: RvaultEnvelopeHeader;
  verifiedSha256: boolean;
  decryptMs: number;
}> {
  const rawBuffer = await file.arrayBuffer();
  if (rawBuffer.byteLength < 16) {
    throw new Error('Conteneur .rvault invalide ou tronqué.');
  }

  const magic = new TextDecoder().decode(rawBuffer.slice(0, 8));
  if (magic !== RVAULT_MAGIC) {
    throw new Error(
      "En-tête magique RVAULT01 introuvable : ce fichier n'est pas un conteneur Renumerate Vault."
    );
  }

  const headerLength = new DataView(rawBuffer, 8, 4).getUint32(0, false);
  if (12 + headerLength > rawBuffer.byteLength) {
    throw new Error('En-tête de métadonnées .rvault corrompu.');
  }

  const headerJson = new TextDecoder().decode(
    rawBuffer.slice(12, 12 + headerLength)
  );
  const header = JSON.parse(headerJson) as RvaultEnvelopeHeader;
  const cipherBuffer = rawBuffer.slice(12 + headerLength);

  const tempItem: VaultStoredItem = {
    ...header,
    id: 'imported-rvault',
    userId: 'local',
    sealedSize: cipherBuffer.byteLength,
    transferStatus: 'local_only',
    cipherPreviewHex: bytesToHex(
      new Uint8Array(cipherBuffer.slice(0, Math.min(48, cipherBuffer.byteLength)))
    ),
    cipherBuffer,
  };

  const result = await decryptStoredVaultItem(tempItem, password);
  return {
    ...result,
    header,
  };
}

// --- Persistance locale IndexedDB ---

function openVaultDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_user', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ||
          new Error("Impossible d'ouvrir la base locale IndexedDB du coffre.")
      );
  });
}

export async function saveItemToLocalVault(
  item: VaultStoredItem
): Promise<void> {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function listUserVaultItems(
  userId: string
): Promise<VaultStoredItem[]> {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('by_user');
    const req = index.getAll(userId);

    req.onsuccess = () => {
      db.close();
      const rows = (req.result as VaultStoredItem[]) || [];
      rows.sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function markVaultItemTransferred(
  id: string,
  nodeIp: string
): Promise<void> {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result as VaultStoredItem | undefined;
      if (existing) {
        existing.transferStatus = 'transferred_vpn';
        existing.transferredAt = Date.now();
        existing.transferredNodeIp = nodeIp;
        store.put(existing);
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteVaultItemById(id: string): Promise<void> {
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function wipeAllUserVaultItems(userId: string): Promise<void> {
  const items = await listUserVaultItems(userId);
  const db = await openVaultDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const item of items) {
      store.delete(item.id);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
