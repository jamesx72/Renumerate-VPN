import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Smartphone,
  CreditCard,
  Landmark,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  History,
  Download,
  Copy,
  Check,
  Zap,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { FiatCurrency, Transaction } from '../types';
import { formatFiatValue } from '../constants';

interface Props {
  transactions: Transaction[];
  preferredFiat?: FiatCurrency;
  onCancelTransaction?: (txId: string) => Promise<void>;
  onAccelerateTransaction?: (txId: string) => Promise<void>;
  onOpenWithdraw?: () => void;
  onClose: () => void;
}

type StatusFilter = 'all' | 'processing' | 'completed' | 'cancelled';

export const TransactionHistoryModal: React.FC<Props> = ({
  transactions,
  preferredFiat = 'EUR',
  onCancelTransaction,
  onAccelerateTransaction,
  onOpenWithdraw,
  onClose,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [busyTxId, setBusyTxId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const itemsPerPage = 8;

  const hasProcessing = useMemo(
    () => transactions.some((tx) => tx.status === 'processing'),
    [transactions]
  );

  useEffect(() => {
    if (!hasProcessing) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasProcessing]);

  const metrics = useMemo(() => {
    let settledRnc = 0;
    let pendingRnc = 0;
    let countSettled = 0;
    for (const tx of transactions) {
      if (tx.status === 'completed') {
        settledRnc += tx.netAmountRnc ?? tx.amount;
        countSettled += 1;
      } else if (tx.status === 'processing') {
        pendingRnc += tx.amount;
      }
    }
    return {
      settledRnc,
      pendingRnc,
      countSettled,
      totalCount: transactions.length,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (!q) return true;
      const methodLabel =
        tx.method === 'bank_transfer'
          ? 'virement sepa iban'
          : tx.method === 'mobile_money'
            ? 'mobile money wave orange mtn moov'
            : tx.method;
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.method.toLowerCase().includes(q) ||
        methodLabel.includes(q) ||
        (tx.networkLabel || '').toLowerCase().includes(q) ||
        tx.status.toLowerCase().includes(q) ||
        tx.address.toLowerCase().includes(q) ||
        (tx.txHash || '').toLowerCase().includes(q)
      );
    });
  }, [transactions, searchTerm, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / itemsPerPage)
  );
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentTransactions = filteredTransactions.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard restrictions
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Date',
      'Statut',
      'Mode',
      'Canal',
      'Reseau',
      'Montant_Brut_RNC',
      'Frais_RNC',
      'Montant_Net_RNC',
      'Devise',
      'Montant_Fiat',
      'Destination',
      'Reference_Hash',
    ];
    const escapeCell = (val: string | number | undefined) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = filteredTransactions.map((tx) =>
      [
        tx.id,
        tx.date,
        tx.status,
        tx.executionMode || 'instant',
        tx.method,
        tx.networkLabel || tx.subNetwork || tx.method,
        tx.amount.toFixed(4),
        (tx.feeRnc ?? 0).toFixed(4),
        (tx.netAmountRnc ?? tx.amount).toFixed(4),
        tx.fiatCurrency || preferredFiat,
        (tx.fiatAmount ?? 0).toFixed(2),
        tx.address,
        tx.txHash || '',
      ]
        .map(escapeCell)
        .join(',')
    );

    const csv = `\uFEFF${[headers.join(','), ...rows].join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-retraits-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadReceipt = (tx: Transaction) => {
    const content = [
      'RENUMERATE VPN — REÇU D’OPÉRATION RNC',
      '--------------------------------------------',
      `ID Transaction : ${tx.id}`,
      `Date           : ${tx.date}`,
      `Statut         : ${tx.status.toUpperCase()}`,
      `Mode           : ${(tx.executionMode || 'instant').toUpperCase()}`,
      `Canal / Réseau : ${tx.networkLabel || tx.method}`,
      `Destination    : ${tx.address}`,
      `Montant Brut   : ${tx.amount.toFixed(4)} RNC`,
      `Frais Réseau   : ${(tx.feeRnc ?? 0).toFixed(4)} RNC`,
      `Montant Net    : ${(tx.netAmountRnc ?? tx.amount).toFixed(4)} RNC`,
      `Contre-valeur  : ${formatFiatValue(
        tx.netAmountRnc ?? tx.amount,
        tx.fiatCurrency || preferredFiat,
        tx.exchangeRate
      )}`,
      `Référence      : ${tx.txHash || 'N/A'}`,
      '--------------------------------------------',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bordereau-${tx.id.toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderMethodIcon = (method: Transaction['method']) => {
    switch (method) {
      case 'mobile_money':
        return <Smartphone className="w-4 h-4 text-emerald-500" />;
      case 'paypal':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'bank_transfer':
        return <Landmark className="w-4 h-4 text-purple-500" />;
      default:
        return <Wallet className="w-4 h-4 text-cyan-500" />;
    }
  };

  const getMethodTitle = (tx: Transaction) => {
    if (tx.networkLabel) return tx.networkLabel;
    if (tx.method === 'bank_transfer') return 'Virement SEPA';
    if (tx.method === 'mobile_money') return 'Mobile Money';
    if (tx.method === 'paypal') return 'PayPal Express';
    return 'Crypto On-Chain';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-600 dark:text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Grand Livre des Retraits RNC
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suivi des règlements, bordereaux et file de compensation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-cyan-500 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-cyan-500" />
                <span>Exporter CSV</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div>
            <span className="text-[11px] text-slate-500 block">
              Total net réglé
            </span>
            <span className="text-sm font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.settledRnc.toFixed(4)} RNC
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">
              Valeur réglée ({preferredFiat})
            </span>
            <span className="text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white">
              {formatFiatValue(metrics.settledRnc, preferredFiat)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">
              En compensation
            </span>
            <span className="text-sm font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
              {metrics.pendingRnc.toFixed(4)} RNC
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block">
              Opérations enregistrées
            </span>
            <span className="text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white">
              {metrics.totalCount} ({metrics.countSettled} réglées)
            </span>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher par ID, réseau, adresse, hash..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 outline-none focus:border-cyan-500 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(
              [
                { id: 'all', label: 'Tous' },
                { id: 'processing', label: 'En cours' },
                { id: 'completed', label: 'Complétés' },
                { id: 'cancelled', label: 'Annulés' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setStatusFilter(f.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Rows */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <History className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Aucune transaction ne correspond aux filtres'
                    : 'Aucun retrait RNC enregistré'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Modifiez votre recherche ou réinitialisez le filtre de statut.'
                    : 'Vos retraits Crypto, Mobile Money, PayPal et SEPA apparaîtront ici avec leurs bordereaux signés.'}
                </p>
              </div>
              {onOpenWithdraw && !searchTerm && statusFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWithdraw();
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Ouvrir le terminal de retrait
                </button>
              )}
            </div>
          ) : (
            currentTransactions.map((tx) => {
              const totalEta = tx.etaSeconds || 45;
              const elapsedSec = tx.createdAt
                ? Math.floor((nowTs - tx.createdAt) / 1000)
                : totalEta;
              const remainingSec = Math.max(0, totalEta - elapsedSec);
              const netRnc = tx.netAmountRnc ?? tx.amount;
              const modeLabel =
                tx.executionMode === 'auto'
                  ? 'Auto'
                  : tx.executionMode === 'standard'
                    ? 'Standard'
                    : 'Instantané';

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                        {renderMethodIcon(tx.method)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {getMethodTitle(tx)}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {tx.id}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Mode {modeLabel}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                          <span>{tx.date}</span>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(`addr-${tx.id}`, tx.address)
                            }
                            className="inline-flex items-center gap-1 hover:text-cyan-600 dark:hover:text-cyan-400 truncate max-w-[200px] sm:max-w-[260px] cursor-pointer"
                            title={`Copier : ${tx.address}`}
                          >
                            <span className="truncate">{tx.address}</span>
                            {copiedKey === `addr-${tx.id}` ? (
                              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-60 shrink-0" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Amount & Status */}
                    <div className="text-right font-mono tabular-nums shrink-0 ml-auto">
                      <div
                        className={`text-sm font-extrabold ${
                          tx.status === 'cancelled'
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        -{tx.amount.toFixed(4)} RNC
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Net : {netRnc.toFixed(4)} RNC ·{' '}
                        {formatFiatValue(
                          netRnc,
                          tx.fiatCurrency || preferredFiat,
                          tx.exchangeRate
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Secondary Action & Status Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      {tx.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complété</span>
                        </span>
                      )}
                      {tx.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            En compensation ({remainingSec}s restantes)
                          </span>
                        </span>
                      )}
                      {tx.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Annulé · +{tx.amount.toFixed(4)} RNC recrédités</span>
                        </span>
                      )}

                      {tx.txHash && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(`hash-${tx.id}`, tx.txHash || '')
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer"
                            title="Copier l'empreinte de règlement"
                          >
                            <span>
                              Réf {tx.txHash.slice(0, 10)}...
                            </span>
                            {copiedKey === `hash-${tx.id}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-60" />
                            )}
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {tx.status === 'processing' && onAccelerateTransaction && (
                        <button
                          type="button"
                          disabled={busyTxId === tx.id}
                          onClick={async () => {
                            setBusyTxId(tx.id);
                            await onAccelerateTransaction(tx.id);
                            setBusyTxId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Finaliser</span>
                        </button>
                      )}

                      {tx.status === 'processing' &&
                        onCancelTransaction &&
                        (confirmCancelId === tx.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyTxId === tx.id}
                              onClick={async () => {
                                setBusyTxId(tx.id);
                                await onCancelTransaction(tx.id);
                                setBusyTxId(null);
                                setConfirmCancelId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold whitespace-nowrap cursor-pointer"
                            >
                              Confirmer remboursement
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(null)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 cursor-pointer"
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(tx.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/25 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Annuler & Rembourser</span>
                          </button>
                        ))}

                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(tx)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <FileText className="w-3 h-3 text-cyan-500" />
                        <span>Reçu</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Page {safePage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};