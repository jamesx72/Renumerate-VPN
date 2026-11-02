import React, { useRef, useEffect, useState } from 'react';
import {
  Terminal,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  Trash2,
  Clock,
  Check,
  Search,
  Globe,
  Download,
  Pause,
  Play,
} from 'lucide-react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  onClear?: () => void;
  retentionHours?: number;
  onRetentionChange?: (hours: number) => void;
}

export const SystemLogs: React.FC<Props> = ({
  logs,
  onClear,
  retentionHours = 168,
  onRetentionChange,
}) => {
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<
    'all' | 'error' | 'warning' | 'success' | 'info'
  >('all');
  const [ipSearch, setIpSearch] = useState('');
  const [showRetentionMenu, setShowRetentionMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredLogs = logs.filter((log) => {
    const matchesType = filter === 'all' || log.type === filter;
    const q = ipSearch.trim().toLowerCase();
    const matchesIp =
      !q ||
      (log.ip && log.ip.toLowerCase().includes(q)) ||
      log.event.toLowerCase().includes(q);
    return matchesType && matchesIp;
  });

  useEffect(() => {
    if (!autoScroll || !logsContainerRef.current) return;
    logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
  }, [filteredLogs.length, autoScroll]);

  const retentionOptions = [
    { label: 'Volatile (RAM 0h)', value: 0 },
    { label: '24 heures', value: 24 },
    { label: '7 jours', value: 168 },
    { label: '30 jours', value: 720 },
  ];

  const handleExportLogs = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      filter,
      count: filteredLogs.length,
      entries: filteredLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 h-[400px] flex flex-col shadow-xs relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2.5 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Journal système
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              ({filteredLogs.length})
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSearch((s) => !s)}
              title="Rechercher dans le journal"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showSearch || ipSearch
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setAutoScroll((a) => !a)}
              title={
                autoScroll
                  ? 'Figer le défilement automatique'
                  : 'Reprendre le défilement automatique'
              }
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                !autoScroll
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {autoScroll ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleExportLogs}
              disabled={filteredLogs.length === 0}
              title="Exporter les entrées affichées (JSON)"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {onRetentionChange && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRetentionMenu(!showRetentionMenu)}
                  title="Durée de rétention des journaux"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    showRetentionMenu
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>

                {showRetentionMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowRetentionMenu(false)}
                    />
                    <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1">
                      <div className="px-3 py-1 text-[10px] text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700 mb-1">
                        Rétention locale
                      </div>
                      {retentionOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onRetentionChange(opt.value);
                            setShowRetentionMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer ${
                            retentionHours === opt.value
                              ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {retentionHours === opt.value && (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {onClear && (
              <button
                type="button"
                onClick={onClear}
                title="Purger le journal"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'info', label: 'Info' },
              { id: 'success', label: 'OK' },
              { id: 'warning', label: 'Alerte' },
              { id: 'error', label: 'Erreur' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                filter === f.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {(showSearch || ipSearch) && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={ipSearch}
              onChange={(e) => setIpSearch(e.target.value)}
              placeholder="Filtrer par IP ou événement..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-8 pr-7 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
            />
            {ipSearch && (
              <button
                type="button"
                onClick={() => setIpSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Logs Feed */}
      <div
        ref={logsContainerRef}
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs"
      >
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className="flex gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors items-start"
          >
            <div className="flex flex-col shrink-0 tabular-nums text-[10px] text-slate-400 dark:text-slate-500">
              <span>[{log.timestamp}]</span>
              {log.ip && (
                <span className="text-[9px] flex items-center gap-1 text-slate-400">
                  <Globe className="w-2.5 h-2.5" />
                  {log.ip}
                </span>
              )}
            </div>

            <span className="shrink-0 pt-0.5">
              {log.type === 'error' && (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              )}
              {log.type === 'warning' && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
              {log.type === 'success' && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              )}
              {log.type === 'info' && (
                <Info className="w-3.5 h-3.5 text-cyan-500" />
              )}
            </span>

            <span
              className={`text-[11px] leading-relaxed break-words flex-1 font-sans ${
                log.type === 'success'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : log.type === 'warning'
                    ? 'text-amber-700 dark:text-amber-400'
                    : log.type === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {log.event}
            </span>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 space-y-1.5 py-8">
            <Terminal className="w-7 h-7 opacity-40" />
            <span className="text-xs font-sans">Aucune entrée dans ce filtre</span>
          </div>
        )}
      </div>
    </div>
  );
};
