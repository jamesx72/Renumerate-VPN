import React from 'react';
import { Settings, Shield, Globe, Zap, ToggleLeft, ToggleRight, X, RefreshCw, Lock, Crown, Network } from 'lucide-react';
import { AppSettings, PlanTier } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
}

export const SettingsPanel: React.FC<Props> = ({ settings, updateSettings, onClose, userPlan, onShowPricing }) => {
  
  const isFeatureLocked = (featureLevel: 'pro' | 'elite') => {
    if (featureLevel === 'elite') return userPlan !== 'elite';
    if (featureLevel === 'pro') return userPlan === 'free';
    return false;
  };

  const LockedBadge = ({ level }: { level: 'pro' | 'elite' }) => (
    <button 
      onClick={onShowPricing}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
        level === 'elite' 
          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/20' 
          : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/20'
      }`}
    >
      <Lock className="w-2.5 h-2.5" />
      {level}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto animate-shimmer">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-500" />
            Configuration
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          {/* Protocol Section */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Protocole Tunnel
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {(['wireguard', 'openvpn', 'ikev2'] as const).map((proto) => (
                <button
                  key={proto}
                  onClick={() => updateSettings('protocol', proto)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    settings.protocol === proto
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span className="font-mono capitalize">{proto}</span>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    settings.protocol === proto ? 'border-brand-500 bg-brand-500' : 'border-slate-300 dark:border-slate-600'
                  }`} />
                </button>
              ))}
            </div>
          </section>

          {/* Split Tunneling */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Network className="w-4 h-4" /> Tunneling (Split)
            </h3>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-medium">Split Tunneling</div>
                    <div className="text-xs text-slate-500">Choisir les apps qui contournent le VPN</div>
                  </div>
                  <button onClick={() => updateSettings('splitTunneling', !settings.splitTunneling)}>
                    {settings.splitTunneling ? (
                      <ToggleRight className="w-10 h-10 text-brand-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                    )}
                  </button>
                </div>
                
                {settings.splitTunneling && (
                    <div className="animate-shimmer space-y-2">
                        <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Applications Exclues</p>
                        {['Netflix', 'Banking App', 'Local Mail'].map(app => (
                            <div key={app} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                <input type="checkbox" defaultChecked className="accent-brand-500 rounded" />
                                <span>{app}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </section>

          {/* Auto Rotation Section */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Rotation Automatique
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium">Rotation IP Auto</div>
                  <div className="text-xs text-slate-500">Change d'identité périodiquement</div>
                </div>
                <button onClick={() => updateSettings('autoRotation', !settings.autoRotation)}>
                  {settings.autoRotation ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>

              {settings.autoRotation && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-shimmer">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Intervalle</span>
                    <span className="text-sm font-bold text-brand-500">{settings.rotationInterval} min</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={settings.rotationInterval} 
                    onChange={(e) => updateSettings('rotationInterval', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  />
                  <div className="flex justify-between mt-1 text-xs text-slate-400">
                    <span>1 min</span>
                    <span>60 min</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Security Features */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Sécurité Avancée
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium">Kill Switch</div>
                  <div className="text-xs text-slate-500">Coupe Internet si le VPN lâche</div>
                </div>
                <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)}>
                  {settings.killSwitch ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>

               {/* Obfuscation Level */}
               <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Niveau d'Obfuscation</span>
                    <span className="text-xs font-bold bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded uppercase">{settings.obfuscationLevel}</span>
                  </div>
                  <div className="flex gap-2">
                      {(['standard', 'high', 'ultra'] as const).map(level => (
                          <button
                            key={level}
                            onClick={() => updateSettings('obfuscationLevel', level)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize border transition-colors ${
                                settings.obfuscationLevel === level 
                                ? 'bg-brand-500 text-white border-brand-500' 
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-brand-300'
                            }`}
                          >
                              {level}
                          </button>
                      ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                      *Ultra peut ralentir la connexion mais maximise l'anonymat.
                  </p>
               </div>

              <div className={`flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-opacity ${isFeatureLocked('elite') ? 'opacity-75' : ''}`}>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    AdBlocker NetShield
                    {isFeatureLocked('elite') && <LockedBadge level="elite" />}
                  </div>
                  <div className="text-xs text-slate-500">Bloque pubs et traqueurs</div>
                </div>
                <button 
                  onClick={() => isFeatureLocked('elite') ? onShowPricing() : updateSettings('adBlocker', !settings.adBlocker)}
                  className={isFeatureLocked('elite') ? 'cursor-pointer' : ''}
                >
                  {isFeatureLocked('elite') ? (
                    <Lock className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  ) : settings.adBlocker ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* DNS Settings */}
          <section>
             <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Serveurs DNS
            </h3>
            <div className="space-y-2">
              <select 
                value={settings.dns}
                onChange={(e) => updateSettings('dns', e.target.value)}
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-brand-500 transition-colors appearance-none"
              >
                <option value="cloudflare">Cloudflare (1.1.1.1) - Rapide</option>
                <option value="google">Google (8.8.8.8) - Standard</option>
                <option value="custom" disabled={isFeatureLocked('pro')}>
                   Renumerate Secure DNS {isFeatureLocked('pro') ? '(PRO Only)' : '- Privé'}
                </option>
              </select>
              {isFeatureLocked('pro') && (
                <div onClick={onShowPricing} className="flex items-center gap-2 text-xs text-amber-500 cursor-pointer hover:underline pl-1">
                  <Crown className="w-3 h-3" />
                  Débloquer le DNS Privé
                </div>
              )}
            </div>
          </section>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-center text-slate-400">
              Version 2.4.0-stable • {userPlan.toUpperCase()} Edition
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};