import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Clock,
  Globe,
  Shield,
  Trash2,
  Calendar,
  Download,
  Search,
} from 'lucide-react';
import { ConnectionSession } from '../types';

interface Props {
  history: ConnectionSession[];
  onClose: () => void;
  onClear: () => void;
}

export const ConnectionHistoryModal: React.FC<Props> = ({
  history,
  onClose,
  onClear,
}) => {
  const [query, setQuery] = useState('');

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (s) =>
        s.serverCountry.toLowerCase().includes(q) ||
        s.serverIp.includes(q) ||
        s.protocol.toLowerCase().includes(q) ||
        s.mode.toLowerCase().includes(q)
    );
  }, [history, query]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportCsv = () => {
    const header = 'ID,Pays,IP_Relais,Debut,Protocole,Mode,Duree';
    const rows = filteredHistory.map(
      (s) =>
        `${s.id},"${s.serverCountry}",${s.serverIp},"${new Date(s.startTime).toISOString()}",${s.protocol},"${s.mode}","${s.durationString}"`
    );
    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-sessions-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[82vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Historique des sessions VPN
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {history.length} session{history.length > 1 ? 's' : ''} archivée
                {history.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Exporter les sessions au format CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="px-3 py-1.5 hover:bg-red-500/10 hover:text-red-500 text-slate-500 dark:text-slate-400 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  title="Effacer l'historique"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Purger</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {history.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer par pays, IP, protocole ou mode..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/70 dark:bg-slate-950">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-600 text-center">
              <History className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {history.length === 0
                  ? 'Aucune session enregistrée'
                  : 'Aucune session ne correspond à ce filtre'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Vos connexions sécurisées apparaîtront automatiquement ici.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHistory.map((session) => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-cyan-500" />
                          {session.serverCountry}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/70 dark:border-slate-700">
                          {session.serverIp}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(session.startTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" />
                          {session.protocol.toUpperCase()} · {session.mode}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right pl-5 sm:pl-0">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Durée
                    </div>
                    <div className="font-mono tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center sm:justify-end gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-500" />
                      {session.durationString}
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