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
  RefreshCw,
} from 'lucide-react';
import { ConnectionSession } from '../types';

interface Props {
  history: ConnectionSession[];
  onClose: () => void;
  onClear: () => void;
  onReconnectIp?: (ip: string) => void;
}

function formatTotalDurationSeconds(totalSec: number): string {
  if (totalSec <= 0) return '0s';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export const ConnectionHistoryModal: React.FC<Props> = ({
  history,
  onClose,
  onClear,
  onReconnectIp,
}) => {
  const [query, setQuery] = useState('');
  const [confirmPurge, setConfirmPurge] = useState(false);

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

  const analytics = useMemo(() => {
    let totalSec = 0;
    const countries = new Set<string>();
    const protoCount: Record<string, number> = {};

    for (const s of history) {
      countries.add(s.serverCountry);
      const pKey = s.protocol.toUpperCase();
      protoCount[pKey] = (protoCount[pKey] || 0) + 1;
      const hourMatch = s.durationString.match(/(\d+)\s*h/i);
      const minMatch = s.durationString.match(/(\d+)\s*m/i);
      const secMatch = s.durationString.match(/(\d+)\s*s/i);
      const colonParts = s.durationString.split(':').map((part) => Number(part));
      if (
        colonParts.length === 3 &&
        colonParts.every((n) => Number.isFinite(n))
      ) {
        totalSec += colonParts[0] * 3600 + colonParts[1] * 60 + colonParts[2];
      } else {
        totalSec +=
          (hourMatch ? parseInt(hourMatch[1], 10) * 3600 : 0) +
          (minMatch ? parseInt(minMatch[1], 10) * 60 : 0) +
          (secMatch ? parseInt(secMatch[1], 10) : 0);
      }
    }

    let topProto = 'WIREGUARD';
    let maxP = 0;
    for (const [k, v] of Object.entries(protoCount)) {
      if (v > maxP) {
        maxP = v;
        topProto = k;
      }
    }

    return {
      totalDurationLabel: formatTotalDurationSeconds(totalSec),
      uniqueCountries: countries.size,
      topProtocol: topProto,
    };
  }, [history]);

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

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Historique &amp; télémétrie des sessions VPN
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {history.length} session{history.length > 1 ? 's' : ''} archivée
                {history.length > 1 ? 's' : ''} localement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:border-cyan-500 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Exporter les sessions au format CSV"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span className="hidden sm:inline">CSV</span>
                </button>

                {confirmPurge ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClear();
                        setConfirmPurge(false);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmPurge(false)}
                      className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmPurge(true)}
                    className="px-3 py-1.5 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-slate-400 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Purger l'historique"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Purger</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Analytics Strip */}
        {history.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-3 gap-3 shrink-0 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Temps cumulé sous tunnel
              </span>
              <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {analytics.totalDurationLabel}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Juridictions visitées
              </span>
              <span className="font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                {analytics.uniqueCountries} pays
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Protocole dominant
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {analytics.topProtocol}
              </span>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {history.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer par pays, adresse IP, protocole ou mode..."
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
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          {session.serverCountry}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
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

                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-5 sm:pl-0">
                    <div className="sm:text-right">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Durée
                      </div>
                      <div className="font-mono tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center sm:justify-end gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        {session.durationString}
                      </div>
                    </div>

                    {onReconnectIp && (
                      <button
                        type="button"
                        onClick={() => {
                          onReconnectIp(session.serverIp);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        title={`Reconnecter le tunnel vers ${session.serverCountry} (${session.serverIp})`}
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Relier</span>
                      </button>
                    )}
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