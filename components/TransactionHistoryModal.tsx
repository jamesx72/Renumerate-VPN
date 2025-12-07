import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Wallet, CreditCard, CheckCircle, Clock, Search, History } from 'lucide-react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  onClose: () => void;
}

export const TransactionHistoryModal: React.FC<Props> = ({ transactions, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTransactions = transactions.slice(startIndex, startIndex + itemsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(curr => curr + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(curr => curr - 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
           <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
             <History className="w-5 h-5 text-brand-500" />
             Historique des Transactions
             <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-xs text-slate-500 font-mono">
                {transactions.length}
             </span>
           </h3>
           <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <History className="w-12 h-12 mb-3 opacity-20" />
                    <p>Aucune transaction trouvée.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {currentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={`p-2.5 rounded-full ${tx.method === 'crypto' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-500' : tx.method === 'paypal' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-500' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-500'}`}>
                                    {tx.method === 'crypto' ? <Wallet className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Retrait {tx.method === 'bank_transfer' ? 'Bancaire' : tx.method === 'crypto' ? 'Crypto' : 'PayPal'}</span>
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                            #{tx.id.split('-')[1]}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        {tx.date}
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span className="font-mono text-[10px] opacity-70 truncate max-w-[100px] sm:max-w-[200px]" title={tx.address}>
                                            {tx.address}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold font-mono text-emerald-500">-{tx.amount} RNC</div>
                                <div className="flex items-center justify-end gap-1.5 text-[10px]">
                                    {tx.status === 'completed' ? (
                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                            <CheckCircle className="w-3 h-3" /> Complété
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                                            <Clock className="w-3 h-3" /> En cours
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Footer / Pagination */}
        {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Page {currentPage} sur {totalPages}
                </span>
                
                <div className="flex gap-2">
                    <button 
                        onClick={prevPage}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-300"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={nextPage}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-300"
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