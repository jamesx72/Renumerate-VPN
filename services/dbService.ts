
import { supabase } from './supabaseClient';
import { AppSettings, PlanTier, ConnectionSession } from '../types';

/**
 * Service gérant la persistance des données utilisateur via Supabase
 * Optimisé pour ignorer les erreurs réseau fatales (Mode simulation auto)
 */
export const dbService = {
  /**
   * Récupère ou crée le profil de l'utilisateur après authentification
   */
  async getOrCreateProfile(userId: string, email: string) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{ id: userId, email, plan_tier: 'free' }])
          .select()
          .single();
        
        if (createError) throw createError;
        return newProfile;
      }

      if (error) throw error;
      return profile;
    } catch (err) {
      console.warn("Database Offline: Falling back to local identity profile.");
      return { id: userId, email, plan_tier: 'free', is_verified: false, balance: "0.4215" };
    }
  },

  /**
   * Récupère les paramètres de l'application pour un utilisateur
   */
  async getSettings(userId: string): Promise<Partial<AppSettings> | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        return null;
      }
      
      if (error) throw error;
      return data;
    } catch (err) {
      return null;
    }
  },

  /**
   * Sauvegarde les paramètres de l'utilisateur
   */
  async saveSettings(userId: string, settings: AppSettings) {
    try {
      await supabase
        .from('user_settings')
        .upsert({
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
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      // Ignorer silencieusement pour le mode hors ligne
    }
  },

  /**
   * Enregistre une nouvelle session de connexion
   */
  async logSession(userId: string, session: ConnectionSession) {
    try {
      await supabase
        .from('connection_sessions')
        .insert([{
          user_id: userId,
          server_country: session.serverCountry,
          server_ip: session.serverIp,
          protocol: session.protocol,
          mode: session.mode,
          start_time: new Date(session.startTime).toISOString()
        }]);
    } catch (err) {
      // Ignorer
    }
  },

  /**
   * Met à jour le solde RNC
   */
  async addEarnings(userId: string, amount: number) {
    try {
      await supabase.rpc('increment_balance', {
        user_id_param: userId,
        amount_param: amount
      });
    } catch (err) {
      // Ignorer
    }
  },

  /**
   * Crée une demande de retrait
   */
  async createWithdrawal(userId: string, amount: number, method: 'crypto' | 'paypal' | 'bank_transfer', address: string) {
    try {
      await supabase
        .from('transactions')
        .insert([{
          user_id: userId,
          amount,
          method,
          address,
          status: 'processing'
        }]);
    } catch (err) {
      // Ignorer
    }
  }
};
