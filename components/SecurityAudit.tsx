
import React, { useState } from 'react';
import { ShieldCheck, Search, Loader2, ExternalLink, AlertTriangle, ShieldAlert, CheckCircle2, Globe, Terminal, RefreshCw } from 'lucide-react';
import { performDeepAudit } from '../services/geminiService';

interface Props {
  currentIp: string;
  location: string;
}

export const SecurityAudit: React.FC<Props> = ({ currentIp, location }) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    analysis: string;
    sources: { title: string; uri: string }[];
    isBlacklisted: boolean;
  } | null>(null);

  const startAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await performDeepAudit(currentIp, location);
      setAuditResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform">
        <ShieldCheck className="w-32 h-32" />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Search className="w-4 h-4 text-brand-500" /> Audit Profond IA
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Analyse de réputation en temps réel</p>
        </div>
        {!auditResult && !isAuditing && (
          <button 
            onClick={startAudit}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-brand-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> LANCER L'AUDIT
          </button>
        )}
      </div>

      {isAuditing ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
             <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
                <Globe className="w-5 h-5 text-brand-500/50" />
             </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Audit en cours...</p>
            <p className="text-[10px] text-slate-500 mt-1 animate-pulse font-mono">RECHERCHE DE FUITES DNS / BLACKLISTS...</p>
          </div>
        </div>
      ) : auditResult ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className={`p-4 rounded-xl border flex items-start gap-4 ${auditResult.isBlacklisted ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
            {auditResult.isBlacklisted ? <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" /> : <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />}
            <div>
              <h4 className={`text-xs font-black uppercase mb-1 ${auditResult.isBlacklisted ? 'text-red-500' : 'text-emerald-500'}`}>
                {auditResult.isBlacklisted ? 'Risque Détecté' : 'Réputation Excellente'}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                "{auditResult.analysis}"
              </p>
            </div>
          </div>

          {auditResult.sources.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-2">
                <Terminal className="w-3 h-3" /> Sources Consultées
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {auditResult.sources.map((source, i) => (
                  <a 
                    key={i} 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-brand-500 transition-colors group/link"
                  >
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{source.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover/link:text-brand-500" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={startAudit}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> RE-VÉRIFIER
          </button>
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
            <ShieldCheck className="w-10 h-10 text-slate-200 dark:text-slate-800 mb-3" />
            <p className="text-xs text-slate-500 max-w-[200px]">Analysez l'intégrité de votre point de sortie via notre IA auditrice.</p>
        </div>
      )}
    </div>
  );
};
