import React, { useState } from 'react';
import { X, Wallet, CreditCard, ArrowRight, CheckCircle, Loader2, AlertCircle, Landmark } from 'lucide-react';

interface Props {
  balance: number;
  onClose: () => void;
  onConfirm: (method: string, address: string) => void;
}

export const WithdrawalModal: React.FC<Props> = ({ balance, onClose, onConfirm }) => {
  const [method, setMethod] = useState<'crypto' | 'paypal' | 'bank_transfer'>('crypto');
  const [address, setAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError('Veuillez entrer une adresse ou un compte valide');
      return;
    }
    setError('');
    setIsProcessing(true);

    // Simulate processing delay within the modal for UX
    setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
        setTimeout(() => {
            onConfirm(method, address);
        }, 1500);
    }, 2000);
  };

  const getInputLabel = () => {
      switch(method) {
          case 'paypal': return 'Adresse e-mail PayPal';
          case 'bank_transfer': return 'IBAN (International Bank Account Number)';
          default: return 'Adresse du portefeuille (ERC-20)';
      }
  };

  const getInputPlaceholder = () => {
      switch(method) {
          case 'paypal': return 'exemple@email.com';
          case 'bank_transfer': return 'FR76 3000 ...';
          default: return '0x...';
      }
  };

  if (isSuccess) {
      return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full border border-emerald-500/30 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Retrait Initié !</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Vos {balance.toFixed(4)} RNC sont en route.</p>
            </div>
          </div>
      )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!isProcessing ? onClose : undefined} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
             <Wallet className="w-5 h-5 text-brand-500" />
             Retrait des Fonds
           </h3>
           <button onClick={onClose} disabled={isProcessing} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
             <X className="w-5 h-5" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-700">
                <span className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Solde Disponible</span>
                <div className="text-3xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                    {balance.toFixed(4)} <span className="text-amber-500 text-lg">RNC</span>
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Méthode de retrait</label>
                <div className="grid grid-cols-3 gap-3">
                    <button
                        type="button"
                        onClick={() => setMethod('crypto')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'crypto' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                        <Wallet className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Crypto</span>
                    </button>
                    <button
                         type="button"
                         onClick={() => setMethod('paypal')}
                         className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'paypal' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-[10px] font-bold">PayPal</span>
                    </button>
                    <button
                         type="button"
                         onClick={() => setMethod('bank_transfer')}
                         className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${method === 'bank_transfer' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                        <Landmark className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Virement</span>
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {getInputLabel()}
                 </label>
                 <input 
                    type={method === 'paypal' ? 'email' : 'text'}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={getInputPlaceholder()}
                    className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-brand-500 transition-colors font-mono text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                    disabled={isProcessing}
                 />
                 {error && (
                     <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">
                         <AlertCircle className="w-3 h-3" />
                         {error}
                     </div>
                 )}
            </div>

            <button
                type="submit"
                disabled={isProcessing || !address}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Traitement...
                    </>
                ) : (
                    <>
                        Confirmer le retrait
                        <ArrowRight className="w-4 h-4" />
                    </>
                )}
            </button>
        </form>
      </div>
    </div>
  );
};