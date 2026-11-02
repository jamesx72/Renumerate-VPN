import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  AppSettings,
  PlanTier,
  ConnectionSession,
  Transaction,
  WithdrawalMethod,
  WithdrawalSubNetwork,
  FiatCurrency,
  SavedBeneficiary,
} from '../types';
import { generateSettlementReference } from '../constants';

export interface PersistedProfile {
  id: string;
  email: string;
  plan_tier: PlanTier;
  is_verified: boolean;
  kyc_bonus_claimed?: boolean;
  balance: string;
  reputation: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWithdrawalInput {
  amount: number;
  method: WithdrawalMethod;
  subNetwork: WithdrawalSubNetwork;
  networkLabel: string;
  executionMode: 'instant' | 'standard' | 'auto';
  feeRnc: number;
  netAmountRnc: number;
  fiatCurrency: FiatCurrency;
  fiatAmount: number;
  exchangeRate: number;
  address: string;
  accountHolder?: string;
  status: 'completed' | 'processing';
  txHash?: string;
  etaSeconds?: number;
}

interface StoredCredential {
  email: string;
  userId: string;
  passwordHash: string;
  createdAt: string;
}

interface StoredUserSettings {
  user_id: string;
  settings: Partial<AppSettings>;
  updated_at: string;
}

interface StoredSessionRecord extends ConnectionSession {
  user_id: string;
}

interface StoredTransactionRecord extends Transaction {
  user_id: string;
  createdAt: number;
}

const IDB_NAME = 'renumerate_identity_db_v1';
const IDB_VERSION = 1;
const STORE_PROFILES = 'profiles';
const STORE_CREDENTIALS = 'credentials';
const STORE_SETTINGS = 'user_settings';
const STORE_SESSIONS = 'connection_sessions';
const STORE_TRANSACTIONS = 'transactions';

const LS_PREFIX = 'renumerate_local_db:';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Génère un UUID v4/v5 déterministe conforme RFC-4122 à partir de l'adresse email.
 * Garantit que le même utilisateur retrouve toujours son profil local et un UUID PostgreSQL valide.
 */
export function deriveDeterministicUserId(email: string): string {
  const normalized = `renumerate-vpn-identity::${email.trim().toLowerCase()}`;
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    for (let s = 0; s < 4; s++) {
      let h = seeds[s] ^ (code + s * 31 + i * 17);
      h = Math.imul(h, 0x01000193);
      h ^= h >>> 15;
      seeds[s] = h >>> 0;
    }
  }

  // Final avalanche pass
  for (let s = 0; s < 4; s++) {
    let h = seeds[s] ^ seeds[(s + 1) % 4];
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    seeds[s] = (h ^ (h >>> 16)) >>> 0;
  }

  const hex = seeds.map((n) => n.toString(16).padStart(8, '0')).join('');
  const timeLow = hex.slice(0, 8);
  const timeMid = hex.slice(8, 12);
  const timeHiAndVersion = '4' + hex.slice(13, 16);
  const variantNibble = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const clockSeq = variantNibble + hex.slice(17, 20);
  const node = hex.slice(20, 32);

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeq}-${node}`;
}

export function ensureValidUserId(candidateId: string | undefined, email: string): string {
  if (candidateId && UUID_REGEX.test(candidateId)) {
    return candidateId.toLowerCase();
  }
  return deriveDeterministicUserId(email);
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openIdentityDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROFILES)) {
          db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CREDENTIALS)) {
          db.createObjectStore(STORE_CREDENTIALS, { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'user_id' });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          store.createIndex('by_user', 'user_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
          const store = db.createObjectStore(STORE_TRANSACTIONS, {
            keyPath: 'id',
          });
          store.createIndex('by_user', 'user_id', { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function readFallbackJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeFallbackJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openIdentityDb();
  if (!db) {
    return readFallbackJson<T>(`${storeName}:${key}`);
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () =>
        resolve(
          (req.result as T | undefined) ??
            readFallbackJson<T>(`${storeName}:${key}`)
        );
      req.onerror = () => resolve(readFallbackJson<T>(`${storeName}:${key}`));
    } catch {
      resolve(readFallbackJson<T>(`${storeName}:${key}`));
    }
  });
}

async function idbPut<T>(
  storeName: string,
  keyForFallback: string,
  value: T
): Promise<void> {
  writeFallbackJson(`${storeName}:${keyForFallback}`, value);
  const db = await openIdentityDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetAllByUser<T extends { user_id: string }>(
  storeName: string,
  userId: string
): Promise<T[]> {
  const fallbackList =
    readFallbackJson<T[]>(`${storeName}:list:${userId}`) || [];
  const db = await openIdentityDb();
  if (!db) return fallbackList;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index('by_user');
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const rows = (req.result as T[]) || [];
        resolve(rows.length > 0 ? rows : fallbackList);
      };
      req.onerror = () => resolve(fallbackList);
    } catch {
      resolve(fallbackList);
    }
  });
}

async function idbReplaceUserList<T extends { id: string; user_id: string }>(
  storeName: string,
  userId: string,
  items: T[]
): Promise<void> {
  writeFallbackJson(`${storeName}:list:${userId}`, items);
  const db = await openIdentityDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('by_user');
      const keysReq = index.getAllKeys(userId);
      keysReq.onsuccess = () => {
        for (const existingKey of keysReq.result || []) {
          store.delete(existingKey);
        }
        for (const item of items) {
          store.put(item);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function hashCredential(email: string, password: string): Promise<string> {
  const normalized = `${email.trim().toLowerCase()}::renumerate-auth-v1::${password}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return deriveDeterministicUserId(normalized);
}

function mapRemoteSettingsToApp(
  row: Record<string, unknown>
): Partial<AppSettings> {
  const mapped: Partial<AppSettings> = {};
  if (typeof row.protocol === 'string') {
    mapped.protocol = row.protocol as AppSettings['protocol'];
  }
  if (typeof row.dns === 'string') {
    mapped.dns = row.dns as AppSettings['dns'];
  }
  if (typeof row.kill_switch === 'boolean') {
    mapped.killSwitch = row.kill_switch;
  }
  if (typeof row.auto_rotation === 'boolean') {
    mapped.autoRotation = row.auto_rotation;
  }
  if (typeof row.rotation_interval === 'number') {
    mapped.rotationInterval = row.rotation_interval;
  }
  if (typeof row.vortex_bridge === 'string') {
    mapped.vortexBridge = row.vortex_bridge as AppSettings['vortexBridge'];
  }
  if (typeof row.mining_intensity === 'number') {
    mapped.miningIntensity = row.mining_intensity;
  }
  if (typeof row.yield_optimization_ia === 'boolean') {
    mapped.yieldOptimizationIA = row.yield_optimization_ia;
  }
  if (typeof row.contribution_type === 'string') {
    mapped.contributionType =
      row.contribution_type as AppSettings['contributionType'];
  }
  if (typeof row.log_retention_hours === 'number') {
    mapped.logRetentionHours = row.log_retention_hours;
  }
  if (typeof row.socks5_enabled === 'boolean') {
    mapped.socks5Enabled = row.socks5_enabled;
  }
  if (typeof row.socks5_host === 'string') {
    mapped.socks5Host = row.socks5_host;
  }
  if (typeof row.socks5_port === 'number') {
    mapped.socks5Port = row.socks5_port;
  }
  return mapped;
}

/**
 * Service de persistance Local-First (IndexedDB + localStorage)
 * avec synchronisation transparente vers Supabase lorsque VITE_SUPABASE_URL est configuré.
 */
export const dbService = {
  /**
   * Authentifie ou enregistre un profil d'identité local (et Supabase Auth si configuré).
   */
  async authenticateUser(
    email: string,
    password: string,
    mode: 'login' | 'signup'
  ): Promise<{ id: string; email: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const deterministicId = deriveDeterministicUserId(cleanEmail);
    const passwordHash = await hashCredential(cleanEmail, password);

    const existingCred = await idbGet<StoredCredential>(
      STORE_CREDENTIALS,
      cleanEmail
    );

    if (mode === 'signup') {
      if (existingCred && existingCred.passwordHash !== passwordHash) {
        throw new Error(
          'Un profil existe déjà pour cet email. Veuillez utiliser le mode connexion.'
        );
      }
      const newCred: StoredCredential = {
        email: cleanEmail,
        userId: existingCred?.userId || deterministicId,
        passwordHash,
        createdAt: existingCred?.createdAt || new Date().toISOString(),
      };
      await idbPut(STORE_CREDENTIALS, cleanEmail, newCred);
      await this.getOrCreateProfile(newCred.userId, cleanEmail);
      return { id: newCred.userId, email: cleanEmail };
    }

    // Mode login
    if (existingCred) {
      if (existingCred.passwordHash !== passwordHash) {
        throw new Error('Mot de passe incorrect.');
      }
      const validId = ensureValidUserId(existingCred.userId, cleanEmail);
      await this.getOrCreateProfile(validId, cleanEmail);
      return { id: validId, email: cleanEmail };
    }

    // Premier accès sur ce navigateur : initialise l'identité persistante localement
    const initialCred: StoredCredential = {
      email: cleanEmail,
      userId: deterministicId,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    await idbPut(STORE_CREDENTIALS, cleanEmail, initialCred);
    await this.getOrCreateProfile(deterministicId, cleanEmail);
    return { id: deterministicId, email: cleanEmail };
  },

  /**
   * Récupère ou crée le profil persistant de l'utilisateur
   */
  async getOrCreateProfile(
    rawUserId: string,
    email: string
  ): Promise<PersistedProfile> {
    const cleanEmail = email.trim().toLowerCase();
    const userId = ensureValidUserId(rawUserId, cleanEmail);
    const now = new Date().toISOString();

    let localProfile = await idbGet<PersistedProfile>(STORE_PROFILES, userId);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: remoteProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!error && remoteProfile) {
          const merged: PersistedProfile = {
            id: userId,
            email: remoteProfile.email || cleanEmail,
            plan_tier: (remoteProfile.plan_tier as PlanTier) || 'free',
            is_verified: Boolean(remoteProfile.is_verified),
            balance: String(remoteProfile.balance ?? localProfile?.balance ?? '0.4215'),
            reputation: Number(remoteProfile.reputation ?? localProfile?.reputation ?? 100),
            created_at: remoteProfile.created_at || localProfile?.created_at || now,
            updated_at: remoteProfile.updated_at || now,
          };
          await idbPut(STORE_PROFILES, userId, merged);
          return merged;
        }

        if (!error && !remoteProfile) {
          const seedProfile: PersistedProfile = localProfile ?? {
            id: userId,
            email: cleanEmail,
            plan_tier: 'free',
            is_verified: false,
            balance: '0.4215',
            reputation: 100,
            created_at: now,
            updated_at: now,
          };

          const { data: inserted } = await supabase
            .from('profiles')
            .insert([
              {
                id: userId,
                email: cleanEmail,
                plan_tier: seedProfile.plan_tier,
                is_verified: seedProfile.is_verified,
                balance: parseFloat(seedProfile.balance),
                reputation: seedProfile.reputation,
              },
            ])
            .select()
            .maybeSingle();

          if (inserted) {
            seedProfile.updated_at = inserted.updated_at || now;
          }
          await idbPut(STORE_PROFILES, userId, seedProfile);
          return seedProfile;
        }
      } catch {
        // Bascule transparente sur le stockage local IndexedDB
      }
    }

    if (!localProfile) {
      localProfile = {
        id: userId,
        email: cleanEmail,
        plan_tier: 'free',
        is_verified: false,
        balance: '0.4215',
        reputation: 100,
        created_at: now,
        updated_at: now,
      };
      await idbPut(STORE_PROFILES, userId, localProfile);
    }

    return localProfile;
  },

  /**
   * Met à jour les attributs du profil (forfait, statut KYC, solde RNC, réputation)
   */
  async updateProfile(
    rawUserId: string,
    email: string,
    updates: Partial<{
      plan_tier: PlanTier;
      is_verified: boolean;
      kyc_bonus_claimed: boolean;
      balance: string | number;
      reputation: number;
    }>
  ): Promise<PersistedProfile> {
    const current = await this.getOrCreateProfile(rawUserId, email);
    const updated: PersistedProfile = {
      ...current,
      plan_tier: updates.plan_tier ?? current.plan_tier,
      is_verified:
        typeof updates.is_verified === 'boolean'
          ? updates.is_verified
          : current.is_verified,
      kyc_bonus_claimed:
        typeof updates.kyc_bonus_claimed === 'boolean'
          ? updates.kyc_bonus_claimed
          : current.kyc_bonus_claimed,
      balance:
        updates.balance !== undefined
          ? typeof updates.balance === 'number'
            ? updates.balance.toFixed(6)
            : updates.balance
          : current.balance,
      reputation:
        typeof updates.reputation === 'number'
          ? updates.reputation
          : current.reputation,
      updated_at: new Date().toISOString(),
    };

    await idbPut(STORE_PROFILES, current.id, updated);

    if (isSupabaseConfigured && supabase) {
      try {
        const remotePatch: Record<string, unknown> = {
          updated_at: updated.updated_at,
        };
        if (updates.plan_tier !== undefined) {
          remotePatch.plan_tier = updated.plan_tier;
        }
        if (updates.is_verified !== undefined) {
          remotePatch.is_verified = updated.is_verified;
        }
        if (updates.balance !== undefined) {
          remotePatch.balance = parseFloat(updated.balance);
        }
        if (updates.reputation !== undefined) {
          remotePatch.reputation = updated.reputation;
        }
        await supabase.from('profiles').update(remotePatch).eq('id', current.id);
      } catch {
        // Persisté localement
      }
    }

    return updated;
  },

  /**
   * Récupère les paramètres complets de l'application pour un utilisateur
   */
  async getSettings(userId: string): Promise<Partial<AppSettings> | null> {
    const localRecord = await idbGet<StoredUserSettings>(
      STORE_SETTINGS,
      userId
    );

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data) {
          const remoteMapped = mapRemoteSettingsToApp(
            data as Record<string, unknown>
          );
          const mergedSettings = {
            ...(localRecord?.settings || {}),
            ...remoteMapped,
          };
          await idbPut<StoredUserSettings>(STORE_SETTINGS, userId, {
            user_id: userId,
            settings: mergedSettings,
            updated_at: new Date().toISOString(),
          });
          return mergedSettings;
        }
      } catch {
        // Lecture depuis IndexedDB
      }
    }

    return localRecord?.settings ?? null;
  },

  /**
   * Sauvegarde l'intégralité des paramètres de l'utilisateur
   */
  async saveSettings(userId: string, settings: AppSettings): Promise<void> {
    const now = new Date().toISOString();
    await idbPut<StoredUserSettings>(STORE_SETTINGS, userId, {
      user_id: userId,
      settings,
      updated_at: now,
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('user_settings').upsert({
          user_id: userId,
          protocol: settings.protocol,
          dns: settings.dns,
          kill_switch: settings.killSwitch,
          auto_rotation: settings.autoRotation,
          rotation_interval: settings.rotationInterval,
          vortex_bridge: settings.vortexBridge,
          mining_intensity: settings.miningIntensity,
          yield_optimization_ia: settings.yieldOptimizationIA,
          contribution_type: settings.contributionType,
          log_retention_hours: settings.logRetentionHours,
          socks5_enabled: settings.socks5Enabled,
          socks5_host: settings.socks5Host,
          socks5_port: settings.socks5Port,
          updated_at: now,
        });
      } catch {
        // Déjà persisté dans IndexedDB
      }
    }
  },

  /**
   * Récupère l'historique des sessions VPN de l'utilisateur
   */
  async getSessions(userId: string): Promise<ConnectionSession[]> {
    const rows = await idbGetAllByUser<StoredSessionRecord>(
      STORE_SESSIONS,
      userId
    );
    return rows
      .sort((a, b) => b.startTime - a.startTime)
      .map(({ user_id: _uid, ...session }) => session);
  },

  /**
   * Enregistre une nouvelle session de connexion
   */
  async logSession(userId: string, session: ConnectionSession): Promise<void> {
    const existing = await idbGetAllByUser<StoredSessionRecord>(
      STORE_SESSIONS,
      userId
    );
    const record: StoredSessionRecord = {
      ...session,
      user_id: userId,
    };
    const updatedList = [
      record,
      ...existing.filter((s) => s.id !== session.id),
    ].slice(0, 100);
    await idbReplaceUserList(STORE_SESSIONS, userId, updatedList);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('connection_sessions').insert([
          {
            user_id: userId,
            server_country: session.serverCountry,
            server_ip: session.serverIp,
            protocol: session.protocol,
            mode: session.mode,
            start_time: new Date(session.startTime).toISOString(),
          },
        ]);
      } catch {
        // Persisté localement
      }
    }
  },

  /**
   * Met à jour la durée de la dernière session à la déconnexion
   */
  async finalizeLatestSession(
    userId: string,
    sessionId: string,
    durationString: string
  ): Promise<void> {
    const existing = await idbGetAllByUser<StoredSessionRecord>(
      STORE_SESSIONS,
      userId
    );
    const updated = existing.map((s) =>
      s.id === sessionId ? { ...s, durationString } : s
    );
    await idbReplaceUserList(STORE_SESSIONS, userId, updated);
  },

  /**
   * Efface l'historique local des sessions VPN de l'utilisateur
   */
  async clearSessions(userId: string): Promise<void> {
    await idbReplaceUserList<StoredSessionRecord>(STORE_SESSIONS, userId, []);
  },

  /**
   * Incrémente et persiste le solde RNC gagné par contribution réseau
   */
  async addEarnings(
    rawUserId: string,
    email: string,
    amount: number
  ): Promise<number> {
    const profile = await this.getOrCreateProfile(rawUserId, email);
    const currentBalance = parseFloat(profile.balance) || 0;
    const nextBalance = Math.max(0, currentBalance + amount);

    await idbPut<PersistedProfile>(STORE_PROFILES, profile.id, {
      ...profile,
      balance: nextBalance.toFixed(6),
      updated_at: new Date().toISOString(),
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.rpc('increment_balance', {
          user_id_param: profile.id,
          amount_param: amount,
        });
      } catch {
        // Persisté localement
      }
    }

    return nextBalance;
  },

  /**
   * Valide le KYC opérateur et crédite le bonus unique de bienvenue (+2.5000 RNC)
   */
  async claimKycVerificationBonus(
    rawUserId: string,
    email: string
  ): Promise<{ newBalance: number; bonusAwarded: number }> {
    const profile = await this.getOrCreateProfile(rawUserId, email);
    const currentBalance = parseFloat(profile.balance) || 0;
    const bonusAwarded = profile.kyc_bonus_claimed ? 0 : 2.5;
    const nextBalance = currentBalance + bonusAwarded;

    await this.updateProfile(profile.id, email, {
      is_verified: true,
      kyc_bonus_claimed: true,
      balance: nextBalance,
    });

    return { newBalance: nextBalance, bonusAwarded };
  },

  /**
   * Récupère l'historique des transactions RNC de l'utilisateur
   */
  async getTransactions(userId: string): Promise<Transaction[]> {
    const rows = await idbGetAllByUser<StoredTransactionRecord>(
      STORE_TRANSACTIONS,
      userId
    );
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ user_id: _uid, ...tx }) => tx);
  },

  /**
   * Crée et persiste une demande de retrait RNC et débite atomiquement le solde du profil
   */
  async createWithdrawal(
    rawUserId: string,
    email: string,
    input: CreateWithdrawalInput
  ): Promise<{ transaction: Transaction; newBalance: number }> {
    const profile = await this.getOrCreateProfile(rawUserId, email);
    const currentBalance = parseFloat(profile.balance) || 0;
    const requested = Math.max(0, Number.isFinite(input.amount) ? input.amount : 0);
    if (requested <= 0 || currentBalance + 0.000001 < requested) {
      throw new Error('Solde RNC insuffisant pour exécuter ce retrait.');
    }

    const withdrawAmount = Math.min(currentBalance, requested);
    const newBalance = Math.max(0, currentBalance - withdrawAmount);
    const nowTs = Date.now();
    const shortCode = Math.random().toString(16).slice(2, 10).toUpperCase();
    const txHash =
      input.txHash ||
      generateSettlementReference(input.method, input.subNetwork);

    const txRecord: StoredTransactionRecord = {
      id: `TX-${shortCode}`,
      user_id: profile.id,
      method: input.method,
      subNetwork: input.subNetwork,
      networkLabel: input.networkLabel,
      executionMode: input.executionMode,
      amount: parseFloat(withdrawAmount.toFixed(4)),
      feeRnc: parseFloat(Math.max(0, input.feeRnc).toFixed(4)),
      netAmountRnc: parseFloat(Math.max(0, input.netAmountRnc).toFixed(4)),
      fiatCurrency: input.fiatCurrency,
      fiatAmount: parseFloat(Math.max(0, input.fiatAmount).toFixed(2)),
      exchangeRate: input.exchangeRate,
      status: input.status,
      address: input.address.trim(),
      accountHolder: input.accountHolder?.trim() || undefined,
      txHash,
      date: new Date(nowTs).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      createdAt: nowTs,
      etaSeconds: input.etaSeconds,
    };

    const existing = await idbGetAllByUser<StoredTransactionRecord>(
      STORE_TRANSACTIONS,
      profile.id
    );
    await idbReplaceUserList(STORE_TRANSACTIONS, profile.id, [
      txRecord,
      ...existing,
    ]);

    await this.updateProfile(profile.id, email, { balance: newBalance });

    if (isSupabaseConfigured && supabase) {
      try {
        const remoteMethod =
          input.method === 'mobile_money' ? 'paypal' : input.method;
        await supabase.from('transactions').insert([
          {
            user_id: profile.id,
            amount: txRecord.amount,
            method: remoteMethod,
            address: txRecord.address,
            status: input.status,
          },
        ]);
      } catch {
        // Persisté localement
      }
    }

    const { user_id: _uid, ...cleanTx } = txRecord;
    return { transaction: cleanTx, newBalance };
  },

  /**
   * Finalise une transaction en attente ('processing' -> 'completed')
   */
  async completeWithdrawal(
    rawUserId: string,
    txId: string,
    overrideTxHash?: string
  ): Promise<Transaction | null> {
    const existing = await idbGetAllByUser<StoredTransactionRecord>(
      STORE_TRANSACTIONS,
      rawUserId
    );
    let updatedTx: StoredTransactionRecord | null = null;
    const nextList = existing.map((tx) => {
      if (tx.id === txId && tx.status === 'processing') {
        updatedTx = {
          ...tx,
          status: 'completed',
          txHash: overrideTxHash || tx.txHash,
        };
        return updatedTx;
      }
      return tx;
    });

    if (!updatedTx) return null;
    await idbReplaceUserList(STORE_TRANSACTIONS, rawUserId, nextList);
    const { user_id: _uid, ...cleanTx } = updatedTx as StoredTransactionRecord;
    return cleanTx;
  },

  /**
   * Annule un retrait en file d'attente ('processing' -> 'cancelled') et rembourse intégralement le solde RNC
   */
  async cancelWithdrawal(
    rawUserId: string,
    email: string,
    txId: string
  ): Promise<{ transaction: Transaction; newBalance: number } | null> {
    const profile = await this.getOrCreateProfile(rawUserId, email);
    const existing = await idbGetAllByUser<StoredTransactionRecord>(
      STORE_TRANSACTIONS,
      profile.id
    );
    const target = existing.find(
      (tx) => tx.id === txId && tx.status === 'processing'
    );
    if (!target) return null;

    const cancelledRecord: StoredTransactionRecord = {
      ...target,
      status: 'cancelled',
    };

    const nextList = existing.map((tx) =>
      tx.id === txId ? cancelledRecord : tx
    );
    await idbReplaceUserList(STORE_TRANSACTIONS, profile.id, nextList);

    const currentBalance = parseFloat(profile.balance) || 0;
    const refundedBalance = currentBalance + target.amount;
    await this.updateProfile(profile.id, email, { balance: refundedBalance });

    const { user_id: _uid, ...cleanTx } = cancelledRecord;
    return { transaction: cleanTx, newBalance: refundedBalance };
  },

  /**
   * Gestion du carnet de bénéficiaires enregistrés par utilisateur
   */
  getBeneficiaries(rawUserId: string): SavedBeneficiary[] {
    return (
      readFallbackJson<SavedBeneficiary[]>(`beneficiaries:list:${rawUserId}`) ||
      []
    );
  },

  saveBeneficiary(
    rawUserId: string,
    beneficiary: Omit<SavedBeneficiary, 'id' | 'createdAt'>
  ): SavedBeneficiary[] {
    const current = this.getBeneficiaries(rawUserId);
    const deduped = current.filter(
      (b) =>
        !(
          b.method === beneficiary.method &&
          b.subNetwork === beneficiary.subNetwork &&
          b.address.toLowerCase() === beneficiary.address.trim().toLowerCase()
        )
    );
    const created: SavedBeneficiary = {
      ...beneficiary,
      address: beneficiary.address.trim(),
      label: beneficiary.label.trim() || 'Compte vérifié',
      id: `ben-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toLocaleDateString('fr-FR'),
    };
    const next = [created, ...deduped].slice(0, 15);
    writeFallbackJson(`beneficiaries:list:${rawUserId}`, next);
    return next;
  },

  deleteBeneficiary(rawUserId: string, beneficiaryId: string): SavedBeneficiary[] {
    const current = this.getBeneficiaries(rawUserId);
    const next = current.filter((b) => b.id !== beneficiaryId);
    writeFallbackJson(`beneficiaries:list:${rawUserId}`, next);
    return next;
  },
};
