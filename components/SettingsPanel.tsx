import React, { useState } from 'react';
import { Settings, Shield, Globe, Zap, ToggleLeft, ToggleRight, X, RefreshCw, Lock, Crown, Network, Clock, Smartphone, Monitor, Tv, RotateCcw, Wifi, Eye, Ghost, Users, Activity, Sliders, Languages, Palette, Server, BoxSelect, Cpu, Power, WifiOff } from 'lucide-react';
import { AppSettings, PlanTier } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
  initialTab?: 'general' | 'connection' | 'privacy' | 'advanced';
}

type TabId = 'general' | 'connection' | 'privacy' | 'advanced';

export const SettingsPanel: React.FC<Props> = ({ settings, updateSettings, onClose, userPlan, onShowPricing, initialTab }) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'general');
  
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
    { id: 'wireguard', name: 'WireGuard', desc: 'Performance maximale, code léger.', badge: 'Rapide' },
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
        updateSettings('mtuSize', 1420);
        updateSettings('ipv6LeakProtection', true);
        updateSettings('localNetworkSharing', false);
    }
  };

  const tabs = [
    { id: 'general', label: 'Général', icon: Sliders },
    { id: 'connection', label: 'Connexion', icon: Activity },
    { id: 'privacy', label: 'Sécurité', icon: Shield },
    { id: 'advanced', label: 'Avancé', icon: Cpu },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[650px] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Settings className="w-6 h-6 text-brand-500" />
                    Paramètres
                </h2>
                <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-md inline-block">
                    Version 2.4.0 • {userPlan.toUpperCase()}
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabId)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                isActive 
                                    ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-700' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-brand-500' : 'opacity-70'}`} />
                            {tab.label}
                        </button>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <button 
                    onClick={handleReset}
                    className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-red-500 flex items-center justify-center gap-2 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Réinitialiser tout
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-950 relative">
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 z-10"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                
                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Général</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Préférences de démarrage et d'apparence.</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <Power className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Connexion Automatique</div>
                                        <div className="text-xs text-slate-500">Se connecter au lancement de l'application</div>
                                    </div>
                                </div>
                                <button onClick={() => updateSettings('autoConnect', !settings.autoConnect)} className="transition-transform active:scale-95">
                                    {settings.autoConnect ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                                </button>
                            </div>

                            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <Languages className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Langue</div>
                                        <div className="text-xs text-slate-500">Langue de l'interface</div>
                                    </div>
                                </div>
                                <select className="text-sm bg-slate-50 dark:bg-slate-800 border-none rounded-lg py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-brand-500">
                                    <option>Français</option>
                                    <option>English</option>
                                    <option>Deutsch</option>
                                </select>
                            </div>

                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <Palette className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Thème</div>
                                        <div className="text-xs text-slate-500">Apparence de l'application</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                     <button className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded-lg">Système</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONNECTION TAB */}
                {activeTab === 'connection' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                         <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Connexion</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Protocoles et configuration réseau.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 mb-6">
                            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Protocole VPN</label>
                            {protocols.map((proto) => (
                                <button
                                key={proto.id}
                                onClick={() => updateSettings('protocol', proto.id)}
                                className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                                    settings.protocol === proto.id
                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-sm'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                                >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                    settings.protocol === proto.id ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                    <Server className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`font-bold ${settings.protocol === proto.id ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {proto.name}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                             settings.protocol === proto.id ? 'bg-brand-200 dark:bg-brand-500/30 border-transparent text-brand-800 dark:text-brand-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                        }`}>
                                            {proto.badge}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {proto.desc}
                                    </p>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                    settings.protocol === proto.id ? 'border-brand-500' : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                    {settings.protocol === proto.id && <div className="w-2.5 h-2.5 bg-brand-500 rounded-full" />}
                                </div>
                                </button>
                            ))}
                        </div>

                        {/* MTU Size Slider */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                             <div className="flex justify-between items-center mb-4">
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                        Taille MTU
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">Avancé</span>
                                    </div>
                                    <div className="text-xs text-slate-500">Ajustez la taille des paquets pour optimiser la vitesse.</div>
                                </div>
                                <div className="text-sm font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/50 px-2 py-1 rounded border border-brand-100 dark:border-brand-500/20">
                                    {settings.mtuSize}
                                </div>
                             </div>
                             <input 
                                type="range" 
                                min="1280" 
                                max="1500" 
                                step="10"
                                value={settings.mtuSize} 
                                onChange={(e) => updateSettings('mtuSize', parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:accent-brand-400"
                             />
                             <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                                 <span>1280 (Min)</span>
                                 <span>1500 (Standard)</span>
                             </div>
                        </div>

                         {/* Local Network Sharing */}
                         <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <BoxSelect className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white">Partage Réseau Local (LAN)</div>
                                    <div className="text-xs text-slate-500">Autoriser l'accès aux imprimantes et appareils locaux.</div>
                                </div>
                            </div>
                            <button onClick={() => updateSettings('localNetworkSharing', !settings.localNetworkSharing)} className="transition-transform active:scale-95">
                                {settings.localNetworkSharing ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                            </button>
                        </div>
                    </div>
                )}

                {/* PRIVACY TAB */}
                {activeTab === 'privacy' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sécurité & Confidentialité</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Gérez vos protections et filtrages.</p>
                        </div>
                        
                        {/* Kill Switch & IPv6 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="flex flex-col justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 h-full">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                                        <WifiOff className="w-5 h-5 text-red-500" />
                                    </div>
                                    <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)} className="transition-transform active:scale-95">
                                        {settings.killSwitch ? <ToggleRight className="w-10 h-10 text-red-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                                    </button>
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white">Kill Switch</div>
                                    <div className="text-xs text-slate-500 mt-1">Bloque tout trafic si la connexion VPN est interrompue.</div>
                                </div>
                            </div>

                             <div className="flex flex-col justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 h-full">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg">
                                        <Shield className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <button onClick={() => updateSettings('ipv6LeakProtection', !settings.ipv6LeakProtection)} className="transition-transform active:scale-95">
                                        {settings.ipv6LeakProtection ? <ToggleRight className="w-10 h-10 text-indigo-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                                    </button>
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white">Protection IPv6</div>
                                    <div className="text-xs text-slate-500 mt-1">Prévient les fuites d'IP via le protocole IPv6.</div>
                                </div>
                            </div>
                        </div>

                        {/* DNS Section */}
                        <div>
                             <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 ml-1">Serveurs DNS</h4>
                             <div className="space-y-3">
                                {dnsProviders.map((dns) => {
                                    const isLocked = dns.locked && isFeatureLocked('pro');
                                    const isSelected = settings.dns === dns.id;
                                    const Icon = dns.icon;
                                    return (
                                        <button
                                            key={dns.id}
                                            onClick={() => isLocked ? onShowPricing() : updateSettings('dns', dns.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                isSelected
                                                ? `bg-white dark:bg-slate-900 ${dns.border} shadow-sm`
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                            } ${isLocked ? 'opacity-60' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? dns.bg + ' text-white' : 'bg-slate-100 dark:bg-slate-800 ' + dns.color}`}>
                                                    {isLocked ? <Lock className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                        {dns.name}
                                                        {dns.id === 'custom' && !isLocked && <span className="text-[9px] bg-brand-500 text-white px-1.5 rounded-full">PRO</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">{dns.desc}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                 <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                                                     {dns.ms}ms
                                                 </div>
                                                 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? dns.border : 'border-slate-300 dark:border-slate-600'}`}>
                                                     {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${dns.bg}`} />}
                                                 </div>
                                            </div>
                                        </button>
                                    )
                                })}
                             </div>
                        </div>

                         {/* AdBlocker */}
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                                    <Eye className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white">AdBlocker AI (NetShield)</div>
                                    <div className="text-xs text-slate-500">Bloque les publicités et les trackers malveillants via DNS.</div>
                                </div>
                            </div>
                            <button onClick={() => updateSettings('adBlocker', !settings.adBlocker)} className="transition-transform active:scale-95">
                                {settings.adBlocker ? <ToggleRight className="w-10 h-10 text-emerald-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                            </button>
                        </div>
                    </div>
                )}

                {/* ADVANCED TAB */}
                {activeTab === 'advanced' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                         <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Avancé</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Configurations expertes et automatisation.</p>
                        </div>

                        {/* Obfuscation */}
                        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 mb-4">
                                <Ghost className="w-5 h-5 text-indigo-500" />
                                <span className="font-bold text-slate-900 dark:text-white">Niveau d'Obfuscation</span>
                            </div>
                            
                            <div className="flex gap-2 mb-4">
                                {(['standard', 'high', 'ultra'] as const).map(level => (
                                    <button
                                        key={level}
                                        onClick={() => updateSettings('obfuscationLevel', level)}
                                        className={`flex-1 py-3 text-xs font-bold rounded-xl capitalize border transition-all active:scale-95 ${
                                            settings.obfuscationLevel === level 
                                            ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20' 
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-brand-300'
                                        }`}
                                    >
                                        {getObfuscationLabel(level)}
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                {settings.obfuscationLevel === 'ultra' 
                                    ? "⚠️ Mode Ultra : Masquage profond (Deep Packet Inspection). Contourne la censure d'état (Chine, Iran) mais impacte significativement la vitesse." 
                                    : settings.obfuscationLevel === 'high'
                                        ? "ℹ️ Mode Élevé : Chiffrement renforcé et headers masqués. Idéal pour les réseaux Wi-Fi publics ou restrictifs."
                                        : "✅ Mode Standard : Vitesse optimale avec chiffrement AES-256. Recommandé pour le streaming et l'usage quotidien."}
                            </div>
                        </div>

                        {/* Split Tunneling */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <Network className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Split Tunneling</div>
                                        <div className="text-xs text-slate-500">Exclure certaines applications du tunnel VPN</div>
                                    </div>
                                </div>
                                <button onClick={() => updateSettings('splitTunneling', !settings.splitTunneling)} className="transition-transform active:scale-95">
                                    {settings.splitTunneling ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                                </button>
                            </div>
                            
                            {settings.splitTunneling && (
                                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="space-y-2">
                                        {splitApps.map(app => (
                                            <div key={app.name} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-md text-slate-500">
                                                        <app.icon className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{app.name}</span>
                                                </div>
                                                <input type="checkbox" defaultChecked className="w-4 h-4 accent-brand-500 rounded cursor-pointer" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Auto Rotation */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                     <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <RefreshCw className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                     </div>
                                     <div>
                                        <div className="font-medium text-slate-900 dark:text-white">Rotation IP Automatique</div>
                                        <div className="text-xs text-slate-500">Changement périodique d'identité</div>
                                     </div>
                                </div>
                                <button onClick={() => updateSettings('autoRotation', !settings.autoRotation)} className="transition-transform active:scale-95">
                                    {settings.autoRotation ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                                </button>
                             </div>

                             {settings.autoRotation && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                     <div className="flex justify-between items-center mb-3 text-xs">
                                        <span className="font-bold text-slate-500">Fréquence de rotation</span>
                                        <span className="font-mono text-brand-500 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded border border-brand-100 dark:border-brand-500/20">{formatTime(settings.rotationInterval)}</span>
                                     </div>
                                     <input 
                                        type="range" 
                                        min="1" 
                                        max="60" 
                                        value={settings.rotationInterval} 
                                        onChange={(e) => updateSettings('rotationInterval', parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500 mb-4"
                                    />
                                    <div className="grid grid-cols-4 gap-2">
                                        {[5, 15, 30, 60].map(mins => (
                                            <button
                                                key={mins}
                                                onClick={() => updateSettings('rotationInterval', mins)}
                                                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                                    settings.rotationInterval === mins
                                                    ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-brand-300'
                                                }`}
                                            >
                                                {mins === 60 ? '1h' : `${mins}m`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                             )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};