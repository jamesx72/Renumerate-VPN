
import { supabase } from './supabaseClient';
import { AppSettings, PlanTier, ConnectionSession } from '../types';

/**
 * Service gérant la persistance des données utilisateur via Supabase
 */
export const dbService = {
  /**
   * Récupère ou crée le profil de l'utilisateur après authentification
   */
  async getOrCreateProfile(userId: string, email: string) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profil inexistant, on le crée
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
  },

  /**
   * Récupère les paramètres de l'application pour un utilisateur
   */
  async getSettings(userId: string): Promise<Partial<AppSettings> | null> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return null; // Pas encore de paramètres sauvegardés
    }
    
    if (error) throw error;
    return data;
  },

  /**
   * Sauvegarde les paramètres de l'utilisateur
   */
  async saveSettings(userId: string, settings: AppSettings) {
    const { error } = await supabase
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
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  },

  /**
   * Enregistre une nouvelle session de connexion
   */
  async logSession(userId: string, session: ConnectionSession) {
    const { error } = await supabase
      .from('connection_sessions')
      .insert([{
        user_id: userId,
        server_country: session.serverCountry,
        server_ip: session.serverIp,
        protocol: session.protocol,
        mode: session.mode,
        start_time: new Date(session.startTime).toISOString()
      }]);

    if (error) throw error;
  },

  /**
   * Met à jour le solde RNC (Via RPC pour sécurité)
   */
  async addEarnings(userId: string, amount: number) {
    const { error } = await supabase.rpc('increment_balance', {
      user_id_param: userId,
      amount_param: amount
    });
    if (error) throw error;
  },

  /**
   * Crée une demande de retrait
   */
  async createWithdrawal(userId: string, amount: number, method: 'crypto' | 'paypal' | 'bank_transfer', address: string) {
    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount,
        method,
        address,
        status: 'processing'
      }]);

    if (error) throw error;
  }
};
