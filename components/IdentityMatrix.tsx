import React, { useState } from 'react';
import { VirtualIdentity, ConnectionMode, SecurityReport } from '../types';
import { Fingerprint, Globe, Monitor, Network, ArrowRight, ShieldCheck, Server, Pin, Building2, AlertTriangle, CheckCircle, Clock, Plus, Share2, Check } from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  entryIdentity: VirtualIdentity | null;
  isRotating: boolean;
  isMasking?: boolean;
  mode: ConnectionMode;
  securityReport?: SecurityReport | null;
}

export const IdentityMatrix: React.FC<Props> = ({ identity, entryIdentity, isRotating, isMasking = false, mode, securityReport }) => {
  const [copiedIp, setCopiedIp] = useState(false);

  const handleCopyIp = () => {
    if (isRotating) return;
    navigator.clipboard.writeText(identity.ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  return (
    <div className="space-y-4">
      {mode === ConnectionMode.DOUBLE_HOP && entryIdentity && (
        <div className="bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg border border-brand-200 dark:border-brand-500/30 flex items-center justify-between text-xs sm:text-sm animate-pulse-fast">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
             <div className="w-2 h-2 rounded-full bg-slate-400"></div>
             <span className="hidden sm:inline">Source</span>
          </div>
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 mx-2 relative">
             <ArrowRight className="w-3 h-3 text-brand-500 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-medium">
                <Server className="w-4 h-4" />
                <span className="hidden sm:inline">{entryIdentity.country}</span>
                <span className="sm:hidden">{entryIdentity.country.slice(0,2).toUpperCase()}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:block">{entryIdentity.ip}</span>
          </div>
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 mx-2 relative">
             <ArrowRight className="w-3 h-3 text-brand-500 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="flex items-center gap-2 text-emerald-500 font-bold">
             <Globe className="w-4 h-4" />
             <span>{isRotating ? '...' : identity.country}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg shadow-brand-600/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Adresse IP Publique</span>
            </div>
            {copiedIp && (
               <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded animate-in fade-in slide-in-from-right-2">
                   IP copiée !
               </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className={`font-mono text-xl tracking-wider ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
               {isRotating ? 'RENUMBERING...' : identity.ip}
            </div>
            {!isRotating && (
              <button 
                onClick={handleCopyIp}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-all shadow-sm group border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/30"
                title="Copier l'adresse IP"
              >
                {copiedIp ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg shadow-brand-600/10">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Localisation Virtuelle</span>
          </div>
          <div className={`font-mono text-lg ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
            {isRotating ? '---' : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div className="group relative flex items-center">
                    <Pin className="w-4 h-4 text-brand-500 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-sans font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl z-20">
                      Emplacement virtuel actuel
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                  <span className="font-bold">{identity.country}</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="text-base text-slate-600 dark:text-slate-300">{identity.city}</span>
                  <button 
                    onClick={() => console.log(`Afficher plus de détails pour ${identity.city}`)}
                    className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/30 transition-all shadow-sm hover:shadow-md ml-1"
                    title="Plus de détails"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex items-center gap-2 text-base text-slate-600 dark:text-slate-300" title="Fuseau Horaire Serveur">
                   <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                   <span className="text-sm font-mono">{identity.timezone || 'UTC+0'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg shadow-brand-600/10">
          <div className="flex items-center gap-3 mb-2">
            <Fingerprint className={`w-5 h-5 ${isMasking ? 'text-indigo-600 dark:text-indigo-400' : 'text-brand-600 dark:text-brand-400'}`} />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">MAC Virtuelle</span>
          </div>
          <div className={`font-mono text-base ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : isMasking ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
             {isRotating ? 'XX:XX:XX:XX:XX:XX' : isMasking ? 'Spoofing MAC...' : identity.mac}
          </div>
        </div>

        <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-lg shadow-brand-600/10">
          <div className="flex items-center gap-3 mb-2">
            <Monitor className={`w-5 h-5 ${isMasking ? 'text-indigo-600 dark:text-indigo-400' : 'text-brand-600 dark:text-brand-400'}`} />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">User Agent Spoof</span>
          </div>
          <div className={`font-mono text-sm font-bold ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : isMasking ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
             {isRotating ? 'Generating Profile...' : isMasking ? 'Randomizing UA...' : identity.userAgentShort}
          </div>
        </div>
      </div>

      {securityReport && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-brand-500" />
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Analyse de sécurité IA</h4>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 font-medium">Score de sécurité</span>
                    <div className="flex items-center gap-2">
                         <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${securityReport.score > 80 ? 'bg-emerald-500' : securityReport.score > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${securityReport.score}%` }}></div>
                         </div>
                         <span className={`text-xs font-bold ${securityReport.score > 80 ? 'text-emerald-500' : securityReport.score > 50 ? 'text-amber-500' : 'text-red-500'}`}>{securityReport.score}/100</span>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 font-medium">Niveau de menace</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        securityReport.threatLevel === 'Faible' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                        securityReport.threatLevel === 'Moyen' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                        'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                        {securityReport.threatLevel === 'Faible' ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {securityReport.threatLevel.toUpperCase()}
                    </span>
                </div>
                
                <p className="text-xs text-slate-600 dark:text-slate-400 italic border-l-2 border-brand-500 pl-2 my-3">
                    "{securityReport.analysis}"
                </p>
                
                {securityReport.recommendations.length > 0 && (
                    <div className="space-y-1">
                        {securityReport.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="text-brand-500 mt-0.5">•</span>
                                <span>{rec}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};