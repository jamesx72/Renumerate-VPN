import React from 'react';
import { X, History, Clock, Globe, Shield, Trash2, Calendar } from 'lucide-react';
import { ConnectionSession } from '../types';

interface Props {
  history: ConnectionSession[];
  onClose: () => void;
  onClear: () => void;
}

export const ConnectionHistoryModal: React.FC<Props> = ({ history, onClose, onClear }) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-100 dark:bg-brand-500/20 rounded-lg text-brand-600 dark:text-brand-400">
                <History className="w-5 h-5" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Historique de Connexion</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Vos sessions VPN récentes</p>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
               {history.length > 0 && (
                   <button 
                    onClick={onClear}
                    className="p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:text-slate-400 dark:hover:text-red-400 rounded-lg transition-colors text-slate-500 text-xs font-medium flex items-center gap-1"
                    title="Effacer l'historique"
                   >
                     <Trash2 className="w-4 h-4" />
                     <span className="hidden sm:inline">Effacer</span>
                   </button>
               )}
               <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                 <X className="w-5 h-5" />
               </button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 dark:bg-slate-950">
            {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-600">
                    <History className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-medium">Aucune session enregistrée</p>
                    <p className="text-sm">Vos futures connexions apparaîtront ici.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map((session) => (
                        <div key={session.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                
                                <div className="flex items-start gap-3">
                                    <div className="mt-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mx-auto my-1"></div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-brand-500" />
                                                {session.serverCountry}
                                            </span>
                                            <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                {session.serverIp}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(session.startTime)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Shield className="w-3 h-3" />
                                                {session.protocol.toUpperCase()} • {session.mode}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pl-5 sm:pl-0 border-l-2 sm:border-l-0 border-slate-100 dark:border-slate-800 sm:text-right">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Durée</div>
                                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-brand-500" />
                                            {session.durationString}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};