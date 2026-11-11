import React, { useRef, useEffect, useState, useMemo } from 'react';
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
  FileDown,
  Pause,
  Play,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Copy,
  RefreshCw,
  Sparkles,
  Flame,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { LogEntry } from '../types';
import {
  isHmacLoggingEnabled,
  setHmacLoggingEnabled,
  signLogsBatch,
  verifyLogEntryHmac,
  getSessionHmacKey,
  getCachedHmacInfo,
} from '../services/logHmacService';

interface Props {
  logs: LogEntry[];
  onClear?: () => void;
  retentionHours?: number;
  onRetentionChange?: (hours: number) => void;
  onUpdateLogs?: (newLogs: LogEntry[]) => void;
}

export const SystemLogs: React.FC<Props> = ({
  logs,
  onClear,
  retentionHours = 168,
  onRetentionChange,
  onUpdateLogs,
}) => {
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const downloadFeedbackTimeoutRef = useRef<number | null>(null);

  const [filter, setFilter] = useState<
    'all' | 'error' | 'warning' | 'success' | 'info'
  >('all');
  const [ipSearch, setIpSearch] = useState('');
  const [showRetentionMenu, setShowRetentionMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logDownloaded, setLogDownloaded] = useState(false);

  // HMAC Cryptographic Timestamping State
  const [isHmacActive, setIsHmacActive] = useState<boolean>(() => isHmacLoggingEnabled());
  const [sessionKeyFp, setSessionKeyFp] = useState<string>('HMAC:CHARGEMENT...');
  const [isSealingBatch, setIsSealingBatch] = useState(false);
  const [isAuditingBatch, setIsAuditingBatch] = useState(false);
  const [auditSummaryToast, setAuditSummaryToast] = useState<{
    total: number;
    valid: number;
    timestamp: string;
  } | null>(null);

  // Log Inspection Modal State
  const [inspectedLog, setInspectedLog] = useState<LogEntry | null>(null);
  const [inspectedTamperedText, setInspectedTamperedText] = useState<string | null>(null);
  const [inspectedVerificationResult, setInspectedVerificationResult] = useState<{
    valid: boolean;
    isTampered: boolean;
    errorDetail?: string;
  } | null>(null);
  const [copiedSig, setCopiedSig] = useState(false);

  // Initialize and retrieve session HMAC key fingerprint
  useEffect(() => {
    getSessionHmacKey()
      .then((info) => {
        setSessionKeyFp(info.fingerprint);
      })
      .catch(() => {
        setSessionKeyFp('HMAC:ACTIF');
      });
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesType = filter === 'all' || log.type === filter;
    const q = ipSearch.trim().toLowerCase();
    const matchesIp =
      !q ||
      (log.ip && log.ip.toLowerCase().includes(q)) ||
      log.event.toLowerCase().includes(q);
    return matchesType && matchesIp;
  });

  const signedCount = useMemo(
    () => logs.filter((l) => Boolean(l.hmacSignature)).length,
    [logs]
  );

  useEffect(() => {
    if (!autoScroll || !logsContainerRef.current) return;
    logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
  }, [filteredLogs.length, autoScroll]);

  useEffect(() => {
    return () => {
      if (downloadFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(downloadFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const retentionOptions = [
    { label: 'Volatile (RAM 0h)', value: 0 },
    { label: '24 heures', value: 24 },
    { label: '7 jours', value: 168 },
    { label: '30 jours', value: 720 },
  ];

  // Toggle HMAC Signing Option
  const handleToggleHmacSigning = async () => {
    const nextVal = !isHmacActive;
    setIsHmacActive(nextVal);
    setHmacLoggingEnabled(nextVal);

    if (nextVal && onUpdateLogs) {
      // Seal any currently unsigned logs in batch
      setIsSealingBatch(true);
      try {
        const signed = await signLogsBatch(logs);
        onUpdateLogs(signed);
      } finally {
        setIsSealingBatch(false);
      }
    }
  };

  // Run full integrity audit over all signed logs
  const handleAuditAllLogs = async () => {
    setIsAuditingBatch(true);
    let validCount = 0;
    const targetLogs = logs.filter((l) => Boolean(l.hmacSignature));

    try {
      for (const log of targetLogs) {
        const res = await verifyLogEntryHmac(log);
        if (res.valid) validCount++;
      }

      setAuditSummaryToast({
        total: targetLogs.length,
        valid: validCount,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
      });

      setTimeout(() => setAuditSummaryToast(null), 5000);
    } finally {
      setIsAuditingBatch(false);
    }
  };

  // Open Log HMAC Inspector
  const handleInspectLogHmac = async (log: LogEntry) => {
    setInspectedLog(log);
    setInspectedTamperedText(null);
    setCopiedSig(false);

    const res = await verifyLogEntryHmac(log);
    setInspectedVerificationResult({
      valid: res.valid,
      isTampered: false,
      errorDetail: res.errorDetail,
    });
  };

  // Simulate Tamper on inspected log
  const handleTestTamperInspected = async () => {
    if (!inspectedLog) return;
    const alteredEvent = inspectedLog.event + ' [ALTÉRÉ_SANS_AUTORISATION]';
    setInspectedTamperedText(alteredEvent);

    const tamperedEntry: LogEntry = {
      ...inspectedLog,
      event: alteredEvent,
    };

    const res = await verifyLogEntryHmac(tamperedEntry);
    setInspectedVerificationResult({
      valid: res.valid,
      isTampered: true,
      errorDetail: 'Signature HMAC invalide : le contenu a été altéré depuis son scellement !',
    });
  };

  // Restore original log in inspector
  const handleRestoreOriginalInspected = async () => {
    if (!inspectedLog) return;
    setInspectedTamperedText(null);
    const res = await verifyLogEntryHmac(inspectedLog);
    setInspectedVerificationResult({
      valid: res.valid,
      isTampered: false,
      errorDetail: res.errorDetail,
    });
  };

  const handleDownloadLogFile = () => {
    if (filteredLogs.length === 0) return;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateSlug = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(
      now.getSeconds()
    )}`;

    const filterLabels: Record<typeof filter, string> = {
      all: 'Tous',
      info: 'Info',
      success: 'OK',
      warning: 'Alerte',
      error: 'Erreur',
    };

    const levelLabels: Record<LogEntry['type'], string> = {
      info: 'INFO   ',
      success: 'SUCCESS',
      warning: 'WARNING',
      error: 'ERROR  ',
    };

    const retentionLabel =
      retentionHours === 0 ? 'Volatile (RAM 0h)' : `${retentionHours}h`;

    const headerLines = [
      '# ============================================================================',
      '# ReNumerate VPN — Journal système local (.log)',
      `# Généré le         : ${now.toLocaleString('fr-FR')} (${now.toISOString()})`,
      `# Horodatage HMAC   : ${isHmacActive ? `ACTIF (${sessionKeyFp})` : 'DÉSACTIVÉ'}`,
      `# Filtre niveau     : ${filterLabels[filter]}`,
      `# Recherche         : ${ipSearch.trim() || 'Aucune'}`,
      `# Rétention         : ${retentionLabel}`,
      `# Entrées           : ${filteredLogs.length} affichée(s) sur ${logs.length} au total`,
      '# ============================================================================',
      '',
    ];

    const bodyLines = filteredLogs.map((entry) => {
      let fullTimestamp = entry.timestamp;
      if (Number.isFinite(entry.timestampRaw) && entry.timestampRaw > 0) {
        const d = new Date(entry.timestampRaw);
        fullTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )} ${entry.timestamp}`;
      }
      const ipColumn = `[${(entry.ip || 'local').padEnd(15, ' ')}]`;
      const hmacPart = entry.hmacSignature
        ? ` [HMAC:${entry.hmacSignature.slice(0, 12)}...]`
        : '';
      return `[${fullTimestamp}] [${levelLabels[entry.type]}] ${ipColumn}${hmacPart} ${entry.event}`;
    });

    const logContent = [...headerLines, ...bodyLines, ''].join('\n');
    const blob = new Blob([logContent], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-system-${dateSlug}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setLogDownloaded(true);
    if (downloadFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(downloadFeedbackTimeoutRef.current);
    }
    downloadFeedbackTimeoutRef.current = window.setTimeout(() => {
      setLogDownloaded(false);
    }, 1800);
  };

  const handleExportLogs = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      sessionHmacKeyFingerprint: sessionKeyFp,
      hmacSigningActive: isHmacActive,
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 h-[420px] flex flex-col shadow-xs relative overflow-hidden font-sans">
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

            {/* HMAC Session Status Badge */}
            {isHmacActive && (
              <span
                title={`Horodatage cryptographique HMAC-SHA256 actif (${sessionKeyFp})`}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-mono font-semibold"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>{sessionKeyFp}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* HMAC SIGNING OPTION TOGGLE */}
            <button
              type="button"
              onClick={handleToggleHmacSigning}
              disabled={isSealingBatch}
              title={
                isHmacActive
                  ? `Désactiver l'horodatage HMAC (${sessionKeyFp})`
                  : 'Activer l’horodatage cryptographique HMAC-SHA256 de chaque entrée'
              }
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isHmacActive
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-cyan-500'
              }`}
            >
              <KeyRound className={`w-3 h-3 ${isHmacActive ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className="hidden md:inline">
                {isHmacActive ? 'Sceau HMAC Actif' : 'Activer HMAC'}
              </span>
            </button>

            {/* Sécuriser et sceller les logs non signés */}
            {logs.length > signedCount && onUpdateLogs && (
              <button
                type="button"
                onClick={async () => {
                  setIsSealingBatch(true);
                  try {
                    const signed = await signLogsBatch(logs);
                    onUpdateLogs(signed);
                  } finally {
                    setIsSealingBatch(false);
                  }
                }}
                disabled={isSealingBatch}
                title={`Sécuriser et sceller cryptographiquement les ${logs.length - signedCount} entrées de logs non signées`}
                className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
              >
                <Lock className={`w-3 h-3 ${isSealingBatch ? 'animate-spin' : ''}`} />
                <span>Sécuriser ({logs.length - signedCount})</span>
              </button>
            )}

            {/* Audit All Signed Logs Button */}
            {signedCount > 0 && (
              <button
                type="button"
                onClick={handleAuditAllLogs}
                disabled={isAuditingBatch}
                title="Vérifier l’intégrité mathématique de l’ensemble des signatures HMAC de session"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${isAuditingBatch ? 'animate-spin text-cyan-500' : ''}`} />
              </button>
            )}

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
              onClick={handleDownloadLogFile}
              disabled={filteredLogs.length === 0}
              title="Télécharger les logs actuels sous forme de fichier texte (.log)"
              aria-label="Télécharger les logs actuels (.log)"
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold flex items-center gap-1 border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                logDownloaded
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400'
              }`}
            >
              {logDownloaded ? (
                <Check className="w-3 h-3 shrink-0" />
              ) : (
                <FileDown className="w-3 h-3 shrink-0" />
              )}
              <span>.log</span>
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

        {/* Audit summary banner */}
        {auditSummaryToast && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Audit HMAC : {auditSummaryToast.valid}/{auditSummaryToast.total} signatures vérifiées intègres à {auditSummaryToast.timestamp}.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAuditSummaryToast(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        )}

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
            className="flex gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors items-start group"
          >
            {/* Timestamp & IP */}
            <div className="flex flex-col shrink-0 tabular-nums text-[10px] text-slate-400 dark:text-slate-500">
              <span>[{log.timestamp}]</span>
              {log.ip && (
                <span className="text-[9px] flex items-center gap-1 text-slate-400">
                  <Globe className="w-2.5 h-2.5" />
                  {log.ip}
                </span>
              )}
            </div>

            {/* Level Icon */}
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

            {/* Event Description */}
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

            {/* Cryptographic HMAC 'Vérification Active' Icon */}
            {log.hmacSignature ? (
              <button
                type="button"
                onClick={() => handleInspectLogHmac(log)}
                title={`Vérification active : Scellement HMAC-SHA256 certifié (${log.sessionKeyFingerprint || 'Session'})\nCliquez pour auditer l’intégrité`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono font-bold shrink-0 hover:bg-emerald-500/25 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="hidden sm:inline">Vérifié</span>
              </button>
            ) : isHmacActive ? (
              <span
                title="En attente de scellement"
                className="text-[9px] text-slate-400 font-mono px-1 opacity-50"
              >
                —
              </span>
            ) : null}
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 space-y-1.5 py-8">
            <Terminal className="w-7 h-7 opacity-40" />
            <span className="text-xs font-sans">Aucune entrée dans ce filtre</span>
          </div>
        )}
      </div>

      {/* Floating HMAC Seal Inspector Modal / Drawer */}
      {inspectedLog && (
        <div className="absolute inset-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-4 flex flex-col justify-between border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Inspecteur de Sceau HMAC-SHA256</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                      FIPS 198-1
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ID : {inspectedLog.id} · Horodatage : {inspectedLog.timestamp} ({inspectedLog.timestampRaw})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold px-2 py-1 cursor-pointer"
              >
                ✕ Fermer
              </button>
            </div>

            {/* Event text preview */}
            <div className="space-y-1 text-xs">
              <span className="text-[10px] text-slate-400 block font-semibold">Contenu scellé du log :</span>
              <div
                className={`p-2 rounded-lg text-xs font-sans border ${
                  inspectedTamperedText
                    ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 font-mono'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                {inspectedTamperedText || inspectedLog.event}
              </div>
            </div>

            {/* Signature Digest */}
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>Signature HMAC (Clé : {inspectedLog.sessionKeyFingerprint || sessionKeyFp}) :</span>
                <button
                  type="button"
                  onClick={() => {
                    if (inspectedLog.hmacSignature) {
                      navigator.clipboard.writeText(inspectedLog.hmacSignature);
                      setCopiedSig(true);
                      setTimeout(() => setCopiedSig(false), 2000);
                    }
                  }}
                  className="text-cyan-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedSig ? 'Copié !' : 'Copier signature'}</span>
                </button>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] text-cyan-600 dark:text-cyan-400 break-all font-bold">
                {inspectedLog.hmacSignature}
              </div>
            </div>

            {/* Verification result feedback */}
            {inspectedVerificationResult && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                  inspectedVerificationResult.valid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
                }`}
              >
                {inspectedVerificationResult.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>Intégrité Confirmée :</strong> Le sceau cryptographique HMAC correspond exactement à l'état canonique d'origine.
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                    <span>
                      <strong>Alerte de Sécurité :</strong> {inspectedVerificationResult.errorDetail}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tamper testing actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            {inspectedTamperedText ? (
              <button
                type="button"
                onClick={handleRestoreOriginalInspected}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:border-cyan-500 transition-colors cursor-pointer"
              >
                Restaurer Texte Original
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestTamperInspected}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Injecte une modification pour vérifier que l'HMAC rejette immédiatement le log"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Tester Altération (Simulation Falsification)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setInspectedLog(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
            >
              Terminé
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
