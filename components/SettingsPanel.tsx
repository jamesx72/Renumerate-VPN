import React from 'react';
import { Settings, Shield, Globe, Zap, ToggleLeft, ToggleRight, X, RefreshCw, Lock, Crown, Network, Clock, Smartphone, Monitor, Tv, RotateCcw, Wifi, Eye, Ghost, Users, Activity } from 'lucide-react';
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
      onClick={(e) => { e.stopPropagation(); onShowPricing(); }}
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

  const formatTime = (minutes: number) => {
    if (minutes === 60) return '1 h';
    return `${minutes} min`;
  };

  const protocols = [
    { id: 'wireguard', name: 'WireGuard', desc: 'Performance maximale, code léger.', badge: 'Recommandé' },
    { id: 'openvpn', name: 'OpenVPN', desc: 'Standard éprouvé, compatibilité max.', badge: 'Stable' },
    { id: 'ikev2', name: 'IKEv2', desc: 'Idéal pour les réseaux mobiles instables.', badge: 'Mobile' }
  ];

  const dnsProviders = [
    { id: 'cloudflare', name: 'Cloudflare', ip: '1.1.1.1', tag: 'Rapide', ms: 12, desc: 'Vitesse & Privée', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500', border: 'border-orange-500' },
    { id: 'google', name: 'Google', ip: '8.8.8.8', tag: 'Standard', ms: 24, desc: 'Haute disponibilité', icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-500' },
    { id: 'quad9', name: 'Quad9', ip: '9.9.9.9', tag: 'Sécurité', ms: 45, desc: 'Anti-Malware', icon: Shield, color: 'text-indigo-500', bg: 'bg-indigo-500', border: 'border-indigo-500' },
    { id: 'opendns', name: 'OpenDNS', ip: '208.67.222.222', tag: 'Famille', ms: 38, desc: 'Contrôle parental', icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-600', border: 'border-cyan-600' },
    { id: 'custom', name: 'Renumerate DNS', ip: 'Interne', tag: 'Anonyme', locked: true, ms: 5, desc: 'Zero-Logs • Privé', icon: Ghost, color: 'text-brand-500', bg: 'bg-brand-500', border: 'border-brand-500' }
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
          
          {/* General Section */}
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

          {/* DNS Settings - ENHANCED VISUALS */}
          <section>
             <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Serveurs DNS
            </h3>
            <div className="space-y-3">
              {dnsProviders.map((dns) => {
                const isLocked = dns.locked && isFeatureLocked('pro');
                const isSelected = settings.dns === dns.id;
                const Icon = dns.icon;

                return (
                  <button
                    key={dns.id}
                    onClick={() => isLocked ? onShowPricing() : updateSettings('dns', dns.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-300 relative overflow-hidden group ${
                        isSelected
                          ? `${dns.border} ${dns.bg.replace('bg-', 'bg-')}/5 dark:${dns.bg.replace('bg-', 'bg-')}/10 shadow-lg`
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
                    } ${isLocked ? 'opacity-70 grayscale-[0.5]' : ''}`}
                  >
                    {/* Background glow effect when selected */}
                    {isSelected && <div className={`absolute -right-10 -top-10 w-24 h-24 ${dns.bg} opacity-10 blur-3xl rounded-full pointer-events-none`}></div>}

                    <div className="flex items-start gap-4 relative z-10">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                         isSelected 
                           ? `${dns.bg} text-white shadow-md` 
                           : `bg-slate-100 dark:bg-slate-800 ${dns.color}`
                       }`}>
                          {isLocked ? <Lock className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                       </div>
                       
                       <div className="text-left">
                          <div className={`text-sm font-bold flex items-center gap-2 ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                              {dns.name}
                              
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                  isSelected 
                                    ? 'bg-slate-900/5 dark:bg-white/10 border-transparent' 
                                    : `bg-slate-50 dark:bg-slate-900 ${dns.color.replace('text-', 'text-')} border-slate-200 dark:border-slate-700`
                              }`}>
                                  {dns.tag}
                              </span>

                              {dns.id === 'custom' && !isLocked && <span className="text-[9px] bg-brand-500 text-white px-1.5 rounded-full shadow-sm">PRO</span>}
                          </div>
                          <div className="text-[11px] font-medium text-slate-400 font-mono mb-0.5 flex items-center gap-1.5">
                             <span className={isSelected ? dns.color : ''}>{dns.ip}</span>
                             {isSelected && <span className="w-1 h-1 rounded-full bg-slate-300"></span>}
                             {isSelected && <span>{dns.desc}</span>}
                          </div>
                          {!isSelected && <div className="text-[10px] text-slate-400">{dns.desc}</div>}
                       </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 relative z-10">
                         {/* Latency Indicator */}
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md min-w-[60px] justify-center border border-slate-200 dark:border-slate-700/50">
                             <div className="flex items-end gap-0.5 h-2.5">
                                <div className={`w-0.5 rounded-[1px] ${dns.ms < 100 ? 'bg-emerald-500' : 'bg-slate-300'} h-1.5`} />
                                <div className={`w-0.5 rounded-[1px] ${dns.ms < 50 ? 'bg-emerald-500' : 'bg-slate-300'} h-2.5`} />
                                <div className={`w-0.5 rounded-[1px] ${dns.ms < 20 ? 'bg-emerald-500' : 'bg-slate-300'} h-full`} />
                             </div>
                             <span className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                {dns.ms}ms
                              </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                             {dns.locked && isLocked && <LockedBadge level="pro" />}
                             
                             {/* Radio Check */}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected 
                                  ? `${dns.border} ${dns.bg.replace('bg-', 'text-')}` // Use color text for the dot? No, let's use bg for border and dot
                                  : 'border-slate-300 dark:border-slate-700'
                            }`}
                            style={{ borderColor: isSelected ? '' : '' }} // Rely on classes
                            >
                                {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${dns.bg}`} />}
                            </div>
                        </div>
                    </div>
                  </button>
                );
              })}
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
                        {formatTime(settings.rotationInterval)}
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
                            {mins === 60 ? '1 h' : `${mins}m`}
                        </button>
                    ))}
                  </div>
                </div>
              )}
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