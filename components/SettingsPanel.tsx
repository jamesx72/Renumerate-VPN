
import React, { useState } from 'react';
// Added ShieldCheck to the imports below
import { Settings, Shield, Globe, Zap, ToggleLeft, ToggleRight, X, RefreshCw, Lock, Crown, Network, Clock, Smartphone, Monitor, Tv, RotateCcw, Wifi, Eye, Ghost, Users, Activity, Sliders, Languages, Palette, Server, BoxSelect, Cpu, Power, WifiOff, Timer, CreditCard, Receipt, Plus, Trash2, CheckCircle, AlertTriangle, ShieldAlert, ShieldCheck, Wallet, TrendingUp, Landmark, ArrowRight } from 'lucide-react';
import { AppSettings, PlanTier, PaymentMethod } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
  userPlan: PlanTier;
  onShowPricing: () => void;
  initialTab?: 'general' | 'connection' | 'privacy' | 'advanced' | 'billing';
  isVerified?: boolean;
  onStartVerification?: () => void;
  paymentMethods?: PaymentMethod[];
  onAddPaymentMethod?: (type: 'card' | 'paypal') => void;
  onRemovePaymentMethod?: (id: string) => void;
  onViewHistory?: () => void;
  // New props for enhanced billing info
  balance?: number;
  totalWithdrawn?: number;
  totalEarned?: number;
  onWithdraw?: () => void;
}

type TabId = 'general' | 'connection' | 'privacy' | 'advanced' | 'billing';

export const SettingsPanel: React.FC<Props> = ({ 
    settings, 
    updateSettings, 
    onClose, 
    userPlan, 
    onShowPricing, 
    initialTab,
    isVerified,
    onStartVerification,
    paymentMethods = [],
    onAddPaymentMethod,
    onRemovePaymentMethod,
    onViewHistory,
    balance = 0,
    totalWithdrawn = 0,
    totalEarned = 0,
    onWithdraw
}) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'general');
  
  const isFeatureLocked = (featureLevel: 'pro' | 'elite') => {
    if (featureLevel === 'elite') return userPlan !== 'elite';
    if (featureLevel === 'pro') return userPlan === 'free';
    return false;
  };

  const getObfuscationLabel = (level: string) => {
    switch(level) {
        case 'high': return 'Élevé';
        case 'ultra': return 'Ultra';
        default: return 'Standard';
    }
  };

  const protocols = [
    { id: 'wireguard', name: 'WireGuard', desc: 'Performance maximale, code léger.', badge: 'Rapide' },
    { id: 'openvpn', name: 'OpenVPN', desc: 'Standard éprouvé, compatibilité max.', badge: 'Stable' },
    { id: 'ikev2', name: 'IKEv2', desc: 'Idéal pour les réseaux mobiles instables.', badge: 'Mobile' }
  ];

  const handleReset = () => {
    if(window.confirm('Réinitialiser tous les paramètres par défaut ?')) {
        updateSettings('protocol', 'wireguard');
        updateSettings('dns', 'cloudflare');
        updateSettings('killSwitch', true);
        updateSettings('dnsLeakProtection', true);
        updateSettings('autoReconnect', true);
        updateSettings('reconnectDelay', 3);
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
    { id: 'billing', label: 'Compte & Gains', icon: Wallet },
  ];

  const defaultCard = paymentMethods.find(m => m.type === 'card' && m.isDefault) || paymentMethods.find(m => m.type === 'card');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[700px] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Settings className="w-6 h-6 text-brand-500" />
                    Configuration
                </h2>
                <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-md inline-block">
                    PRO v2.4.0 • {userPlan.toUpperCase()}
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
                        </div>
                    </div>
                )}

                {activeTab === 'connection' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Connexion</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Protocoles et configuration réseau.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 mb-6">
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
                                    <span className={`font-bold ${settings.protocol === proto.id ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {proto.name}
                                    </span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{proto.desc}</p>
                                </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'privacy' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sécurité & Confidentialité</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Gérez vos protections et filtrages pour un anonymat maximal.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-brand-50 dark:bg-brand-500/10 rounded-xl">
                                                <ShieldAlert className="w-5 h-5 text-brand-500" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white">Protection fuites DNS</div>
                                                <div className="text-[10px] text-brand-500 font-bold uppercase tracking-widest">Recommandé</div>
                                            </div>
                                        </div>
                                        <button onClick={() => updateSettings('dnsLeakProtection', !settings.dnsLeakProtection)} className="transition-transform active:scale-95">
                                            {settings.dnsLeakProtection ? <ToggleRight className="w-10 h-10 text-brand-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-slate-100 dark:border-slate-800 pl-3 italic">
                                        Cette option force votre système à utiliser exclusivement les serveurs DNS de Renumerate. Sans elle, votre navigateur pourrait interroger votre FAI local, révélant votre véritable adresse IP.
                                    </p>
                                </div>
                             </div>

                             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-xl">
                                                <WifiOff className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div className="font-bold text-slate-900 dark:text-white">Kill Switch</div>
                                        </div>
                                        <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)} className="transition-transform active:scale-95">
                                            {settings.killSwitch ? <ToggleRight className="w-10 h-10 text-red-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Coupe instantanément tout accès à Internet si la connexion VPN s'interrompt accidentellement, évitant toute fuite d'IP.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-8">
                         <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Abonnement & Gains</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Gérez vos paiements Pro et vos revenus passifs accumulés.</p>
                        </div>

                        {/* Plan Card - Professional Display */}
                        <div className="relative group">
                            <div className={`absolute -inset-1 bg-gradient-to-r ${userPlan === 'free' ? 'from-slate-400 to-slate-500' : userPlan === 'elite' ? 'from-emerald-500 to-brand-500' : 'from-brand-500 to-indigo-500'} rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200`}></div>
                            <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Statut de l'Identité</span>
                                        <div className="text-3xl font-black mt-1 flex items-center gap-3 text-slate-900 dark:text-white">
                                            {userPlan.toUpperCase()}
                                            {userPlan !== 'free' && <CheckCircle className="w-6 h-6 text-emerald-500" />}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Cycle Actuel</span>
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">Mensuel</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100 dark:border-slate-800/50 mb-6">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Prochaine Facture</span>
                                        <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">{userPlan === 'free' ? 'N/A' : '12 Oct. 2024'}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Mode de Paiement</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {defaultCard ? (
                                                <>
                                                    <CreditCard className="w-3.5 h-3.5 text-brand-500" />
                                                    <span className="text-sm font-medium">{defaultCard.name.split('•')[1]}</span>
                                                </>
                                            ) : (
                                                <span className="text-sm text-slate-400">Aucun</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button 
                                        onClick={onShowPricing} 
                                        className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Zap className="w-4 h-4 fill-current" />
                                        {userPlan === 'free' ? 'Passer Pro' : 'Gérer l\'abonnement'}
                                    </button>
                                    <button 
                                        onClick={onViewHistory}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                    >
                                        <Receipt className="w-4 h-4" />
                                        Factures
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Earnings and Withdrawal Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                                        <Wallet className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">Solde Retirable</h4>
                                </div>
                                <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-3xl font-mono font-black text-slate-900 dark:text-white">{balance.toFixed(4)}</span>
                                    <span className="text-amber-500 font-bold text-sm">RNC</span>
                                </div>
                                <button 
                                    onClick={onWithdraw}
                                    disabled={balance < 1}
                                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    <Landmark className="w-3.5 h-3.5" />
                                    Retrait Instantané
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">Statistiques</h4>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Total Accumulé</span>
                                        <span className="font-mono font-bold text-emerald-500">+{totalEarned.toFixed(2)} RNC</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Total Retiré</span>
                                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{totalWithdrawn.toFixed(2)} RNC</span>
                                    </div>
                                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-500 rounded-full" 
                                            style={{ width: `${(totalWithdrawn / totalEarned) * 100 || 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KYC Section */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${isVerified ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'}`}>
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="font-bold">Vérification de l'Identité</div>
                                        <p className="text-xs text-slate-500">{isVerified ? 'Votre compte est pleinement vérifié pour les paiements.' : 'Requise pour débloquer les retraits bancaires.'}</p>
                                    </div>
                                </div>
                                {!isVerified && (
                                    <button 
                                        onClick={onStartVerification} 
                                        className="px-4 py-2 bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-500/20 hover:scale-105 transition-transform"
                                    >
                                        Vérifier
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Detailed Payment Methods List */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                             <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                                 <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                     <CreditCard className="w-4 h-4 text-slate-500" />
                                     Méthodes de Paiement Enregistrées
                                 </h4>
                                 <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => onAddPaymentMethod?.('card')}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-brand-500 transition-colors flex items-center gap-1 group"
                                        title="Ajouter une carte"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <CreditCard className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => onAddPaymentMethod?.('paypal')}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-blue-500 transition-colors flex items-center gap-1 group"
                                        title="Lier un compte PayPal"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span className="text-[10px] font-bold">PP</span>
                                    </button>
                                 </div>
                             </div>
                             
                             <div className="p-4 space-y-3">
                                 {paymentMethods && paymentMethods.length > 0 ? (
                                     paymentMethods.map(method => (
                                         <div key={method.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${method.isDefault ? 'border-brand-200 dark:border-brand-500/30 bg-brand-50/10 dark:bg-brand-500/5' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'}`}>
                                             <div className="flex items-center gap-4">
                                                 <div className={`p-3 rounded-xl ${method.type === 'card' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'}`}>
                                                     {method.type === 'card' ? <CreditCard className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                                                 </div>
                                                 <div>
                                                     <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                         {method.name}
                                                         {method.isDefault && <span className="text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-black tracking-widest uppercase">Default</span>}
                                                     </div>
                                                     <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-3">
                                                        <span>{method.type === 'card' ? `Expire le ${method.expiry}` : 'PayPal Verified'}</span>
                                                        <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Chiffré</span>
                                                     </div>
                                                 </div>
                                             </div>
                                             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <button 
                                                    onClick={() => onRemovePaymentMethod?.(method.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                                    title="Supprimer"
                                                >
                                                     <Trash2 className="w-5 h-5" />
                                                 </button>
                                             </div>
                                         </div>
                                     ))
                                 ) : (
                                     <div className="text-center py-12 text-slate-400 text-sm italic">
                                         Aucune méthode enregistrée. Ajoutez-en une pour les paiements Pro.
                                     </div>
                                 )}
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <span className="font-bold">Niveau d'Obfuscation</span>
                            <div className="flex gap-2 mt-4">
                                {(['standard', 'high', 'ultra'] as const).map(level => (
                                    <button
                                        key={level}
                                        onClick={() => updateSettings('obfuscationLevel', level)}
                                        className={`flex-1 py-3 text-xs font-bold rounded-xl border ${settings.obfuscationLevel === level ? 'bg-brand-500 text-white' : 'bg-slate-50 dark:bg-slate-800'}`}
                                    >
                                        {getObfuscationLabel(level)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
