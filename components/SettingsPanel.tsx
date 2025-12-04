import React from 'react';
import { Settings, Shield, Globe, Zap, ToggleLeft, ToggleRight, X, RefreshCw, Lock, Crown, Network, Clock, Smartphone, Monitor, Tv, RotateCcw, Wifi, Eye } from 'lucide-react';
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

  const getObfuscationLabel = (level: string) => {
    switch(level) {
        case 'high': return 'Élevé';
        case 'ultra': return 'Ultra';
        default: return 'Standard';
    }
  };

  const protocols = [
    { id: 'wireguard', name: 'WireGuard', desc: 'Performance maximale, code léger.', badge: 'Recommandé' },
    { id: 'openvpn', name: 'OpenVPN', desc: 'Standard éprouvé, compatibilité max.', badge: 'Stable' },
    { id: 'ikev2', name: 'IKEv2', desc: 'Idéal pour les réseaux mobiles instables.', badge: 'Mobile' }
  ];

  const dnsProviders = [
    { id: 'cloudflare', name: 'Cloudflare', ip: '1.1.1.1', tag: 'Rapide', ms: 12, desc: 'Focus vitesse & vie privée' },
    { id: 'google', name: 'Google', ip: '8.8.8.8', tag: 'Standard', ms: 24, desc: 'Haute disponibilité' },
    { id: 'quad9', name: 'Quad9', ip: '9.9.9.9', tag: 'Sécurité', ms: 45, desc: 'Bloque les malwares' },
    { id: 'opendns', name: 'OpenDNS', ip: '208.67.222.222', tag: 'Famille', ms: 38, desc: 'Contrôle parental' },
    { id: 'custom', name: 'Renumerate DNS', ip: 'Privé', tag: 'Anonyme', locked: true, ms: 5, desc: 'Non-journalisé • Interne' }
  ];

  const splitApps = [
      { name: 'Netflix', icon: Tv, type: 'Streaming' },
      { name: 'Banking App', icon: Smartphone, type: 'Finance' },
      { name: 'Local Mail', icon: Monitor, type: 'System' }
  ];

  const handleReset = () => {
    if(window.confirm('Réinitialiser tous les paramètres par défaut ?')) {
        updateSettings('protocol', 'wireguard');
        updateSettings('dns', 'cloudflare');
        updateSettings('killSwitch', true);
        updateSettings('splitTunneling', false);
        updateSettings('adBlocker', false);
        updateSettings('autoConnect', false);
        updateSettings('autoRotation', false);
        updateSettings('rotationInterval', 10);
        updateSettings('obfuscationLevel', 'standard');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-shimmer">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Settings className="w-6 h-6 text-brand-500" />
            Paramètres
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* General Section (New) */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Général
            </h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Connexion Automatique</div>
                  <div className="text-xs text-slate-500">Se connecter au lancement de l'app</div>
                </div>
                <button onClick={() => updateSettings('autoConnect', !settings.autoConnect)} className="transition-transform active:scale-95">
                  {settings.autoConnect ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Protocol Section */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Protocole Tunnel
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {protocols.map((proto) => (
                <button
                  key={proto.id}
                  onClick={() => updateSettings('protocol', proto.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    settings.protocol === proto.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.protocol === proto.id ? 'border-brand-500 bg-brand-500' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                      {settings.protocol === proto.id && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                          <span className={`font-bold ${settings.protocol === proto.id ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'}`}>
                              {proto.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                              {proto.badge}
                          </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {proto.desc}
                      </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Privacy & Filtering Features */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Confidentialité & Filtrage
            </h3>
            <div className="space-y-4">
              
               {/* Obfuscation Level */}
               <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between mb-3">
                    <span className="font-medium text-slate-900 dark:text-white">Niveau d'Obfuscation</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                        settings.obfuscationLevel === 'standard' ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700' :
                        settings.obfuscationLevel === 'high' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' :
                        'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                    }`}>
                        {getObfuscationLabel(settings.obfuscationLevel)}
                    </span>
                  </div>
                  <div className="flex gap-2 mb-3">
                      {(['standard', 'high', 'ultra'] as const).map(level => (
                          <button
                            key={level}
                            onClick={() => updateSettings('obfuscationLevel', level)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize border transition-all active:scale-95 ${
                                settings.obfuscationLevel === level 
                                ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20' 
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-brand-300'
                            }`}
                          >
                              {getObfuscationLabel(level)}
                          </button>
                      ))}
                  </div>
                  <div className="flex gap-2 text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700/50">
                      <div className="mt-0.5"><Shield className="w-3 h-3" /></div>
                      <p>
                        {settings.obfuscationLevel === 'ultra' 
                            ? "Masquage profond (Deep Packet Inspection resistant). Peut ralentir la vitesse mais contourne les pare-feux stricts (Chine, Iran)." 
                            : settings.obfuscationLevel === 'high'
                                ? "Chiffrement renforcé et headers masqués. Recommandé pour les réseaux publics ou restrictifs."
                                : "Vitesse optimale avec chiffrement standard AES-256. Suffisant pour un usage quotidien."}
                      </p>
                  </div>
               </div>

               {/* AdBlocker */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium flex items-center gap-2 text-slate-900 dark:text-white">
                    AdBlocker AI
                  </div>
                  <div className="text-xs text-slate-500">Filtrage DNS intelligent (NetShield)</div>
                </div>
                <button 
                  onClick={() => updateSettings('adBlocker', !settings.adBlocker)}
                  className="transition-transform active:scale-95"
                >
                  {settings.adBlocker ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>

            </div>
          </section>

          {/* Network Security */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Sécurité Réseau
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Kill Switch</div>
                  <div className="text-xs text-slate-500">Coupe Internet si le VPN lâche</div>
                </div>
                <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)} className="transition-transform active:scale-95">
                  {settings.killSwitch ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Split Tunneling */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Network className="w-4 h-4" /> Tunneling (Split)
            </h3>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">Split Tunneling</div>
                    <div className="text-xs text-slate-500">Exclure certaines apps du VPN</div>
                  </div>
                  <button onClick={() => updateSettings('splitTunneling', !settings.splitTunneling)} className="transition-transform active:scale-95">
                    {settings.splitTunneling ? (
                      <ToggleRight className="w-10 h-10 text-brand-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                    )}
                  </button>
                </div>
                
                {settings.splitTunneling && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="h-px bg-slate-200 dark:bg-slate-800 mb-3" />
                        <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wide">Applications Exclues</p>
                        <div className="space-y-2">
                            {splitApps.map(app => (
                                <div key={app.name} className="flex items-center justify-between bg-white dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-500 dark:text-slate-300">
                                            <app.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{app.name}</span>
                                    </div>
                                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-brand-500 rounded cursor-pointer" />
                                </div>
                            ))}
                            <button className="w-full py-2 text-xs font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg border border-dashed border-brand-200 dark:border-brand-500/30 transition-colors">
                                + Ajouter une application
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </section>

          {/* Auto Rotation Section */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Rotation Automatique
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Rotation IP Auto</div>
                  <div className="text-xs text-slate-500">Changer d'identité périodiquement</div>
                </div>
                <button onClick={() => updateSettings('autoRotation', !settings.autoRotation)} className="transition-transform active:scale-95">
                  {settings.autoRotation ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>

              {settings.autoRotation && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Intervalle</span>
                    </div>
                    <span className="text-sm font-bold text-brand-500 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-0.5 rounded-md border border-brand-100 dark:border-brand-500/20 shadow-sm">
                        {settings.rotationInterval} min
                    </span>
                  </div>
                  
                  <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={settings.rotationInterval} 
                    onChange={(e) => updateSettings('rotationInterval', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500 mb-6 hover:accent-brand-400"
                  />
                  
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 15, 30, 60].map(mins => (
                        <button
                            key={mins}
                            onClick={() => updateSettings('rotationInterval', mins)}
                            className={`py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${
                                settings.rotationInterval === mins
                                ? 'bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20 ring-2 ring-brand-500/20'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-slate-600 hover:text-brand-600 dark:hover:text-brand-400'
                            }`}
                        >
                            {mins}m
                        </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* DNS Settings */}
          <section>
             <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Serveurs DNS
            </h3>
            <div className="space-y-3">
              {dnsProviders.map((dns) => {
                const isLocked = dns.locked && isFeatureLocked('pro');
                const isSelected = settings.dns === dns.id;

                return (
                  <button
                    key={dns.id}
                    onClick={() => isLocked ? onShowPricing() : updateSettings('dns', dns.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-sm ring-1 ring-brand-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                    } ${isLocked ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                       <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                          {isLocked ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                       </div>
                       <div className="text-left">
                          <div className={`text-sm font-bold flex items-center gap-2 ${isSelected ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'}`}>
                              {dns.name}
                              {dns.id === 'custom' && <span className="text-[9px] bg-brand-500 text-white px-1.5 rounded-full shadow-sm shadow-brand-500/30">PRO</span>}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mb-0.5">{dns.ip}</div>
                          <div className="text-[10px] text-slate-400 leading-tight">{dns.desc}</div>
                       </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                             {/* Signal Bars */}
                             <div className="flex items-end gap-0.5 h-3" title={`${dns.ms}ms`}>
                                <div className={`w-1 rounded-[1px] ${dns.ms < 50 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} h-1.5`} />
                                <div className={`w-1 rounded-[1px] ${dns.ms < 30 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} h-2.5`} />
                                <div className={`w-1 rounded-[1px] ${dns.ms < 15 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} h-3.5`} />
                             </div>
                             <span className={`text-[9px] font-mono px-1 rounded border ${isSelected ? 'border-brand-200 dark:border-brand-500/30 text-brand-600 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                                {dns.ms}ms
                              </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {!isLocked && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isSelected 
                                        ? 'bg-brand-200 dark:bg-brand-500/30 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-500/40' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                }`}>
                                    {dns.tag}
                                </span>
                            )}
                             {dns.locked && isLocked && <LockedBadge level="pro" />}
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                        </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex justify-between items-center">
            <button 
                onClick={handleReset}
                className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10"
            >
                <RotateCcw className="w-3.5 h-3.5" />
                Défaut
            </button>
            <p className="text-[10px] text-slate-400 font-mono">
              v2.4.0 • {userPlan.toUpperCase()}
            </p>
        </div>
      </div>
    </div>
  );
};