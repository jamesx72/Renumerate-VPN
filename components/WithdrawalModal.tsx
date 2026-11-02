import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Wallet,
  Smartphone,
  CreditCard,
  Landmark,
  Zap,
  Clock,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Download,
  Bookmark,
  Trash2,
  Loader2,
  History,
} from 'lucide-react';
import {
  AppSettings,
  FiatCurrency,
  PlanTier,
  SavedBeneficiary,
  Transaction,
  WithdrawalMethod,
  WithdrawalSubNetwork,
} from '../types';
import {
  RNC_FIAT_RATES,
  WITHDRAWAL_RAIL_SPECS,
  computeWithdrawalQuote,
  formatFiatValue,
  generateSettlementReference,
  getDefaultSubNetworkForMethod,
  getSubNetworksForMethod,
  validateWithdrawalDestination,
} from '../constants';
import { CreateWithdrawalInput, dbService } from '../services/dbService';

interface WithdrawalModalProps {
  balance: number;
  userId: string;
  userPlan: PlanTier;
  isConnected: boolean;
  currentNodeLabel: string;
  settings: AppSettings;
  onPatchSettings: (patch: Partial<AppSettings>, reason?: string) => void;
  onExecuteWithdrawal: (input: CreateWithdrawalInput) => Promise<Transaction>;
  onOpenHistory: () => void;
  onClose: () => void;
}

type ModalMode = 'instant' | 'standard' | 'auto';
type ManualStep = 'configure' | 'confirm' | 'receipt';

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  balance,
  userId,
  userPlan,
  isConnected,
  currentNodeLabel,
  settings,
  onPatchSettings,
  onExecuteWithdrawal,
  onOpenHistory,
  onClose,
}) => {
  const [activeMode, setActiveMode] = useState<ModalMode>('instant');
  const [step, setStep] = useState<ManualStep>('configure');
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>(
    settings.preferredFiat || 'EUR'
  );
  const [liveRates, setLiveRates] = useState<Record<FiatCurrency, number>>({
    EUR: RNC_FIAT_RATES.EUR.rate,
    USD: RNC_FIAT_RATES.USD.rate,
    XOF: RNC_FIAT_RATES.XOF.rate,
  });

  // Manual withdrawal form states
  const [method, setMethod] = useState<WithdrawalMethod>('crypto');
  const [subNetwork, setSubNetwork] =
    useState<WithdrawalSubNetwork>('polygon');
  const [amountInput, setAmountInput] = useState<string>(() =>
    balance >= 0.25 ? balance.toFixed(4) : ''
  );
  const [address, setAddress] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [saveAsBeneficiary, setSaveAsBeneficiary] = useState(false);
  const [beneficiaryLabel, setBeneficiaryLabel] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<SavedBeneficiary[]>(() =>
    dbService.getBeneficiaries(userId)
  );

  // Security verification step states
  const [expectedCode, setExpectedCode] = useState('4829');
  const [enteredCode, setEnteredCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-withdraw draft states (isolated until user clicks Save so typing never fires premature withdrawals)
  const [autoEnabled, setAutoEnabled] = useState<boolean>(settings.autoWithdraw);
  const [autoMethod, setAutoMethod] = useState<WithdrawalMethod>(
    settings.autoWithdrawMethod || 'crypto'
  );
  const [autoSubNetwork, setAutoSubNetwork] = useState<WithdrawalSubNetwork>(
    settings.autoWithdrawSubNetwork || 'polygon'
  );
  const [autoThreshold, setAutoThreshold] = useState<string>(
    String(settings.autoWithdrawThreshold || 5)
  );
  const [autoReserve, setAutoReserve] = useState<string>(
    String(settings.autoWithdrawReserve || 0)
  );
  const [autoAddress, setAutoAddress] = useState<string>(
    settings.autoWithdrawAddress || ''
  );
  const [autoFeedback, setAutoFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/withdrawals/rates')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.rates) return;
        setLiveRates({
          EUR: Number(data.rates.EUR) || RNC_FIAT_RATES.EUR.rate,
          USD: Number(data.rates.USD) || RNC_FIAT_RATES.USD.rate,
          XOF: Number(data.rates.XOF) || RNC_FIAT_RATES.XOF.rate,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSelectCurrency = (curr: FiatCurrency) => {
    setFiatCurrency(curr);
    if (settings.preferredFiat !== curr) {
      onPatchSettings({ preferredFiat: curr });
    }
  };

  const handleSelectMethod = (nextMethod: WithdrawalMethod) => {
    setMethod(nextMethod);
    const defaultSub = getDefaultSubNetworkForMethod(nextMethod);
    setSubNetwork(defaultSub);
    setFormError('');
    if (nextMethod === 'mobile_money' && fiatCurrency === 'EUR') {
      handleSelectCurrency('XOF');
    }
  };

  const handleSelectAutoMethod = (nextMethod: WithdrawalMethod) => {
    setAutoMethod(nextMethod);
    setAutoSubNetwork(getDefaultSubNetworkForMethod(nextMethod));
    setAutoFeedback(null);
  };

  const availableSubNetworks = useMemo(
    () => getSubNetworksForMethod(method),
    [method]
  );

  const activeRail =
    WITHDRAWAL_RAIL_SPECS[subNetwork] || WITHDRAWAL_RAIL_SPECS.polygon;

  const parsedAmount = useMemo(() => {
    const clean = amountInput.replace(',', '.').trim();
    const num = parseFloat(clean);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [amountInput]);

  const quote = useMemo(
    () =>
      computeWithdrawalQuote({
        amountRnc: parsedAmount,
        method,
        subNetwork,
        executionMode: activeMode === 'standard' ? 'standard' : 'instant',
        plan: userPlan,
        fiatCurrency,
        overrideRate: liveRates[fiatCurrency],
      }),
    [
      parsedAmount,
      method,
      subNetwork,
      activeMode,
      userPlan,
      fiatCurrency,
      liveRates,
    ]
  );

  const destinationCheck = useMemo(
    () =>
      validateWithdrawalDestination(
        method,
        subNetwork,
        address,
        accountHolder,
        method === 'bank_transfer'
      ),
    [method, subNetwork, address, accountHolder]
  );

  const filteredBeneficiaries = useMemo(
    () => beneficiaries.filter((b) => b.method === method),
    [beneficiaries, method]
  );

  const setAmountByPct = (pct: number) => {
    const raw = (balance * pct) / 100;
    setAmountInput(raw > 0 ? raw.toFixed(4) : '0.0000');
    setFormError('');
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (parsedAmount <= 0) {
      setFormError('Veuillez saisir un montant RNC supérieur à 0.');
      return;
    }
    if (parsedAmount < activeRail.minRnc) {
      setFormError(
        `Le seuil minimal sur ${activeRail.shortLabel} est de ${activeRail.minRnc.toFixed(2)} RNC.`
      );
      return;
    }
    if (parsedAmount > balance + 0.000001) {
      setFormError(
        `Montant supérieur à votre solde disponible (${balance.toFixed(4)} RNC).`
      );
      return;
    }
    if (quote.netRnc <= 0) {
      setFormError(
        'Le montant net après déduction des frais réseau doit être positif.'
      );
      return;
    }
    if (!destinationCheck.valid) {
      setFormError(
        destinationCheck.error || 'Destination de retrait invalide.'
      );
      return;
    }

    const randomPin = String(Math.floor(1000 + Math.random() * 9000));
    setExpectedCode(randomPin);
    setEnteredCode('');
    setStep('confirm');
  };

  const handleConfirmExecution = async () => {
    if (enteredCode.trim() !== expectedCode) {
      setFormError(
        'Le code de contrôle à 4 chiffres ne correspond pas. Vérifiez la saisie.'
      );
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const execMode = activeMode === 'standard' ? 'standard' : 'instant';
      let signedTxHash = generateSettlementReference(method, subNetwork);

      try {
        const res = await fetch('/api/withdrawals/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            amount: quote.grossRnc,
            netAmountRnc: quote.netRnc,
            method,
            subNetwork,
            address: destinationCheck.normalized,
            executionMode: execMode,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.txHash) signedTxHash = String(data.txHash);
        }
      } catch {
        // Fallback local reference already generated
      }

      // Brief settlement handshake for clear UX feedback
      await new Promise((r) => setTimeout(r, execMode === 'instant' ? 850 : 500));

      if (saveAsBeneficiary) {
        const updatedList = dbService.saveBeneficiary(userId, {
          label:
            beneficiaryLabel.trim() ||
            `${activeRail.shortLabel} (${destinationCheck.normalized.slice(0, 10)}...)`,
          method,
          subNetwork,
          address: destinationCheck.normalized,
          accountHolder:
            method === 'bank_transfer' ? accountHolder.trim() : undefined,
        });
        setBeneficiaries(updatedList);
      }

      const tx = await onExecuteWithdrawal({
        amount: quote.grossRnc,
        method,
        subNetwork,
        networkLabel: activeRail.shortLabel,
        executionMode: execMode,
        feeRnc: quote.feeRnc,
        netAmountRnc: quote.netRnc,
        fiatCurrency: quote.fiatCurrency,
        fiatAmount: quote.netFiat,
        exchangeRate: quote.exchangeRate,
        address: destinationCheck.normalized,
        accountHolder:
          method === 'bank_transfer' ? accountHolder.trim() : undefined,
        status: execMode === 'instant' ? 'completed' : 'processing',
        txHash: signedTxHash,
        etaSeconds: execMode === 'standard' ? 45 : 0,
      });

      setCompletedTx(tx);
      setStep('receipt');
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Échec de l’exécution du retrait. Réessayez.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAutoWithdrawRule = (e: React.FormEvent) => {
    e.preventDefault();
    setAutoFeedback(null);

    const parsedThr = parseFloat(autoThreshold.replace(',', '.'));
    const parsedRes = parseFloat(autoReserve.replace(',', '.')) || 0;
    const targetSpec =
      WITHDRAWAL_RAIL_SPECS[autoSubNetwork] || WITHDRAWAL_RAIL_SPECS.polygon;

    if (!Number.isFinite(parsedThr) || parsedThr < targetSpec.minRnc) {
      setAutoFeedback({
        tone: 'error',
        text: `Le seuil doit être d'au moins ${targetSpec.minRnc.toFixed(2)} RNC pour ${targetSpec.shortLabel}.`,
      });
      return;
    }

    if (parsedRes < 0 || parsedRes >= parsedThr) {
      setAutoFeedback({
        tone: 'error',
        text: 'La réserve de sécurité doit être inférieure au seuil de déclenchement.',
      });
      return;
    }

    if (autoEnabled) {
      const check = validateWithdrawalDestination(
        autoMethod,
        autoSubNetwork,
        autoAddress,
        undefined,
        false
      );
      if (!check.valid) {
        setAutoFeedback({
          tone: 'error',
          text:
            check.error ||
            'Adresse de destination invalide pour le retrait automatique.',
        });
        return;
      }

      onPatchSettings(
        {
          autoWithdraw: true,
          autoWithdrawMethod: autoMethod,
          autoWithdrawSubNetwork: autoSubNetwork,
          autoWithdrawThreshold: parseFloat(parsedThr.toFixed(2)),
          autoWithdrawReserve: parseFloat(parsedRes.toFixed(2)),
          autoWithdrawAddress: check.normalized,
        },
        `Mode Auto-Retrait activé (${targetSpec.shortLabel} · Seuil ${parsedThr.toFixed(2)} RNC)`
      );
      setAutoAddress(check.normalized);
      setAutoFeedback({
        tone: 'success',
        text: `Règle enregistrée : transfert automatique vers ${targetSpec.shortLabel} dès ${parsedThr.toFixed(2)} RNC (réserve conservée : ${parsedRes.toFixed(2)} RNC).`,
      });
    } else {
      onPatchSettings(
        {
          autoWithdraw: false,
          autoWithdrawMethod: autoMethod,
          autoWithdrawSubNetwork: autoSubNetwork,
          autoWithdrawThreshold: parseFloat(parsedThr.toFixed(2)),
          autoWithdrawReserve: parseFloat(parsedRes.toFixed(2)),
          autoWithdrawAddress: autoAddress.trim(),
        },
        'Mode Auto-Retrait désactivé'
      );
      setAutoFeedback({
        tone: 'success',
        text: 'Le retrait automatique a été désactivé. Vos paramètres restent mémorisés.',
      });
    }
  };

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleDownloadReceipt = (tx: Transaction) => {
    const lines = [
      '====================================================',
      '        RENUMERATE VPN — BORDEREAU DE RETRAIT       ',
      '====================================================',
      `Identifiant Opération : ${tx.id}`,
      `Date & Heure          : ${tx.date}`,
      `Statut                : ${tx.status === 'completed' ? 'COMPLÉTÉ (RÉGLÉ)' : 'EN FILE DE COMPENSATION (STANDARD)'}`,
      `Mode d'exécution      : ${(tx.executionMode || 'instant').toUpperCase()}`,
      `Canal / Réseau        : ${tx.networkLabel || tx.method.toUpperCase()}`,
      `Destination           : ${tx.address}`,
      ...(tx.accountHolder ? [`Titulaire             : ${tx.accountHolder}`] : []),
      '----------------------------------------------------',
      `Montant Brut Débité   : ${tx.amount.toFixed(4)} RNC`,
      `Frais Réseau          : ${(tx.feeRnc ?? 0).toFixed(4)} RNC`,
      `Montant Net Réglé     : ${(tx.netAmountRnc ?? tx.amount).toFixed(4)} RNC`,
      `Contre-valeur Nette   : ${formatFiatValue(
        tx.netAmountRnc ?? tx.amount,
        tx.fiatCurrency || fiatCurrency,
        tx.exchangeRate
      )}`,
      `Référence / Hash      : ${tx.txHash || 'N/A'}`,
      '====================================================',
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-${tx.id.toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const channelCards: Array<{
    id: WithdrawalMethod;
    label: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'crypto',
      label: 'Crypto',
      sub: 'Polygon · TRC20 · SOL · LN',
      icon: Wallet,
    },
    {
      id: 'mobile_money',
      label: 'Mobile Money',
      sub: 'Wave · Orange · MTN',
      icon: Smartphone,
    },
    {
      id: 'paypal',
      label: 'PayPal',
      sub: 'Express EUR / USD',
      icon: CreditCard,
    },
    {
      id: 'bank_transfer',
      label: 'Virement SEPA',
      sub: 'IBAN International',
      icon: Landmark,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={!isSubmitting ? onClose : undefined}
      />

      <div className="relative w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Terminal de Retrait RNC
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                1 RNC = {formatFiatValue(1, fiatCurrency, liveRates[fiatCurrency])}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Fiat Currency Selector */}
            <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              {(['EUR', 'USD', 'XOF'] as FiatCurrency[]).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => handleSelectCurrency(curr)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    fiatCurrency === curr
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHistory();
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Historique des retraits"
            >
              <History className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Withdrawal Execution Mode Selector (Visible unless viewing receipt) */}
        {step !== 'receipt' && (
          <div className="px-6 pt-4 shrink-0">
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setActiveMode('instant');
                  setStep('configure');
                  setFormError('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  activeMode === 'instant'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>Instantané</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setActiveMode('standard');
                  setStep('configure');
                  setFormError('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  activeMode === 'standard'
                    ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Standard (-50% frais)</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setActiveMode('auto');
                  setStep('configure');
                  setFormError('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  activeMode === 'auto'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Auto-Retrait</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Balance Summary Strip */}
          {step !== 'receipt' && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Solde disponible
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-mono tabular-nums font-extrabold text-slate-900 dark:text-white">
                    {balance.toFixed(4)}
                  </span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    RNC
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    · ≈ {formatFiatValue(balance, fiatCurrency, liveRates[fiatCurrency])}
                  </span>
                </div>
              </div>

              <div className="text-right text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  Forfait {userPlan.toUpperCase()}
                </div>
                <div className="font-mono tabular-nums text-[11px]">
                  {userPlan === 'elite'
                    ? 'Avantage : -50% sur tous les frais'
                    : userPlan === 'pro'
                      ? 'Avantage : -15% sur les frais'
                      : 'Tarification réseau standard'}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODE 3 : CONFIGURATION AUTO-RETRAIT                            */}
          {/* ============================================================== */}
          {activeMode === 'auto' && step !== 'receipt' && (
            <form onSubmit={handleSaveAutoWithdrawRule} className="space-y-5">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Activer le virement automatique sur seuil
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Déclenche automatiquement un retrait sécurisé dès que votre solde franchit le seuil choisi, tout en préservant votre réserve.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoEnabled}
                  onClick={() => {
                    setAutoEnabled(!autoEnabled);
                    setAutoFeedback(null);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    autoEnabled
                      ? 'bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Channel selection for Auto-Withdraw */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Canal de réception automatique
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {channelCards.map((ch) => {
                    const Icon = ch.icon;
                    const selected = autoMethod === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleSelectAutoMethod(ch.id)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-emerald-500 bg-emerald-500/10 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 mb-1.5 ${
                            selected ? 'text-emerald-500' : 'text-slate-400'
                          }`}
                        />
                        <div className="text-xs font-bold whitespace-nowrap">
                          {ch.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-network for Auto-Withdraw */}
              {getSubNetworksForMethod(autoMethod).length > 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Réseau / Opérateur cible
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {getSubNetworksForMethod(autoMethod).map((net) => (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => {
                          setAutoSubNetwork(net.id);
                          setAutoFeedback(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          autoSubNetwork === net.id
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {net.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Threshold & Reserve */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Seuil de déclenchement (RNC)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="1000"
                    value={autoThreshold}
                    onChange={(e) => {
                      setAutoThreshold(e.target.value);
                      setAutoFeedback(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2.5, 5, 10, 25].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAutoThreshold(String(val))}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        {val} RNC
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Réserve minimale conservée (RNC)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="500"
                    value={autoReserve}
                    onChange={(e) => {
                      setAutoReserve(e.target.value);
                      setAutoFeedback(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 0.5, 1, 2].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAutoReserve(String(val))}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        {val === 0 ? 'Aucune (0)' : `${val} RNC`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Auto Destination */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {WITHDRAWAL_RAIL_SPECS[autoSubNetwork]?.inputLabel ||
                      'Destination automatique'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAutoAddress(
                        WITHDRAWAL_RAIL_SPECS[autoSubNetwork]?.sampleAddress ||
                          ''
                      )
                    }
                    className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Insérer format exemple
                  </button>
                </div>
                <input
                  type="text"
                  value={autoAddress}
                  onChange={(e) => {
                    setAutoAddress(e.target.value);
                    setAutoFeedback(null);
                  }}
                  placeholder={
                    WITHDRAWAL_RAIL_SPECS[autoSubNetwork]?.placeholder || ''
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              {autoFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    autoFeedback.tone === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300'
                  }`}
                >
                  {autoFeedback.tone === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{autoFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Enregistrer la règle Auto-Retrait</span>
              </button>
            </form>
          )}

          {/* ============================================================== */}
          {/* MODES 1 & 2 : ÉTAPE 1 — CONFIGURATION DU RETRAIT MANUEL        */}
          {/* ============================================================== */}
          {activeMode !== 'auto' && step === 'configure' && (
            <form onSubmit={handleProceedToConfirm} className="space-y-5">
              {/* 1. Payout Channel */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  1. Canal de règlement
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {channelCards.map((ch) => {
                    const Icon = ch.icon;
                    const selected = method === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleSelectMethod(ch.id)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 mb-1.5 ${
                            selected
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : 'text-slate-400'
                          }`}
                        />
                        <div className="text-xs font-bold whitespace-nowrap">
                          {ch.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {ch.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Sub-Network / Operator */}
              {availableSubNetworks.length > 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    2. Réseau ou opérateur de transfert
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableSubNetworks.map((rail) => {
                      const active = subNetwork === rail.id;
                      return (
                        <button
                          key={rail.id}
                          type="button"
                          onClick={() => {
                            setSubNetwork(rail.id);
                            setFormError('');
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="text-xs font-bold truncate">
                            {rail.shortLabel}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                            Min {rail.minRnc} RNC · {activeMode === 'instant' ? rail.etaInstant : rail.etaStandard}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Amount Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Montant à retirer (RNC)
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    Min requis : {activeRail.minRnc.toFixed(2)} RNC
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max={balance}
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setFormError('');
                    }}
                    placeholder="0.0000"
                    className="w-full px-4 py-3 pr-28 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-cyan-500 outline-none font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 pointer-events-none">
                    ≈ {formatFiatValue(parsedAmount, fiatCurrency, liveRates[fiatCurrency])}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAmountInput(activeRail.minRnc.toFixed(4));
                      setFormError('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer"
                  >
                    MIN ({activeRail.minRnc})
                  </button>
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAmountByPct(pct)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer"
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmountByPct(100)}
                    className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[11px] font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap cursor-pointer"
                  >
                    MAX ({balance.toFixed(4)})
                  </button>
                </div>
              </div>

              {/* 4. Saved Beneficiaries + Destination Input */}
              <div className="space-y-2.5">
                {filteredBeneficiaries.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-cyan-500" />
                      Comptes enregistrés ({filteredBeneficiaries.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredBeneficiaries.map((ben) => (
                        <div
                          key={ben.id}
                          className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSubNetwork(ben.subNetwork);
                              setAddress(ben.address);
                              if (ben.accountHolder) {
                                setAccountHolder(ben.accountHolder);
                              }
                              setFormError('');
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            {ben.label}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBeneficiaries(
                                dbService.deleteBeneficiary(userId, ben.id)
                              )
                            }
                            className="px-1.5 py-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Supprimer ce bénéficiaire"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {activeRail.inputLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddress(activeRail.sampleAddress);
                      if (method === 'bank_transfer' && !accountHolder.trim()) {
                        setAccountHolder('Opérateur Renumerate');
                      }
                      setFormError('');
                    }}
                    className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Exemple de test
                  </button>
                </div>

                <input
                  type={method === 'paypal' ? 'email' : 'text'}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setFormError('');
                  }}
                  placeholder={activeRail.placeholder}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border outline-none font-mono text-xs sm:text-sm text-slate-900 dark:text-white transition-colors ${
                    address.trim().length > 0
                      ? destinationCheck.valid
                        ? 'border-emerald-500/70 focus:border-emerald-500'
                        : 'border-amber-500/70 focus:border-amber-500'
                      : 'border-slate-200 dark:border-slate-700 focus:border-cyan-500'
                  }`}
                />

                {method === 'bank_transfer' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Nom complet du titulaire IBAN
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => {
                        setAccountHolder(e.target.value);
                        setFormError('');
                      }}
                      placeholder="Ex: Jean Dupont"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-cyan-500 outline-none text-xs sm:text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Option to save beneficiary */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveAsBeneficiary}
                      onChange={(e) => setSaveAsBeneficiary(e.target.checked)}
                      className="rounded accent-cyan-600"
                    />
                    <span>Mémoriser ce compte bénéficiaire</span>
                  </label>
                  {saveAsBeneficiary && (
                    <input
                      type="text"
                      value={beneficiaryLabel}
                      onChange={(e) => setBeneficiaryLabel(e.target.value)}
                      placeholder="Nom du compte (ex: Portefeuille Principal)"
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                    />
                  )}
                </div>
              </div>

              {/* 5. Live Fee & Net Payout Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Montant brut débité</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {quote.grossRnc.toFixed(4)} RNC
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>
                    Frais réseau ({activeRail.shortLabel}
                    {quote.discountPct > 0 ? ` · -${quote.discountPct}%` : ''})
                  </span>
                  <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    -{quote.feeRnc.toFixed(4)} RNC
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Net crédité au bénéficiaire
                  </span>
                  <div className="text-right font-mono tabular-nums">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      {quote.netRnc.toFixed(4)} RNC
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      ≈ {formatFiatValue(quote.netRnc, fiatCurrency, liveRates[fiatCurrency])}
                    </span>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={balance < activeRail.minRnc}
                className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>
                  {balance < activeRail.minRnc
                    ? `Solde insuffisant pour ${activeRail.shortLabel} (Min ${activeRail.minRnc} RNC)`
                    : 'Vérifier & Signer le retrait'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ============================================================== */}
          {/* ÉTAPE 2 : SIGNATURE DE SÉCURITÉ AVANT ÉMISSION                 */}
          {/* ============================================================== */}
          {activeMode !== 'auto' && step === 'confirm' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mode & Réseau</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {activeMode === 'instant'
                      ? 'Instantané Prioritaire'
                      : 'Standard (Annulable 45s)'}{' '}
                    · {activeRail.shortLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 shrink-0">Destination</span>
                  <span className="font-mono text-slate-900 dark:text-white truncate">
                    {destinationCheck.normalized}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Débit total portefeuille</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {quote.grossRnc.toFixed(4)} RNC (Frais : {quote.feeRnc.toFixed(4)} RNC)
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Montant net transféré
                  </span>
                  <span className="font-mono tabular-nums font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                    {quote.netRnc.toFixed(4)} RNC (
                    {formatFiatValue(
                      quote.netRnc,
                      fiatCurrency,
                      liveRates[fiatCurrency]
                    )}
                    )
                  </span>
                </div>
              </div>

              {/* Tunnel Privacy Indicator */}
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  isConnected
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                {isConnected ? (
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {isConnected
                    ? `Métadonnées de transaction routées via le tunnel chiffré (${currentNodeLabel}).`
                    : 'Tunnel VPN hors ligne : le retrait reste chiffré en TLS mais votre IP locale n’est pas masquée.'}
                </span>
              </div>

              {/* 4-Digit Anti-Error Security Check */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Code de validation opérateur
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Saisissez le code à 4 chiffres ci-contre pour autoriser la signature irrévocable.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEnteredCode(expectedCode);
                      setFormError('');
                    }}
                    title="Cliquer pour pré-remplir le code"
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-sm font-extrabold tracking-widest text-cyan-600 dark:text-cyan-400 cursor-pointer"
                  >
                    {expectedCode}
                  </button>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={enteredCode}
                  onChange={(e) => {
                    setEnteredCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setFormError('');
                  }}
                  placeholder="Saisir les 4 chiffres..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-cyan-500 outline-none font-mono tabular-nums text-center text-base font-bold tracking-widest text-slate-900 dark:text-white"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setStep('configure');
                    setFormError('');
                  }}
                  className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Modifier</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || enteredCode.length !== 4}
                  onClick={handleConfirmExecution}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signature & Diffusion...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirmer & Émettre ({quote.netRnc.toFixed(4)} RNC)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ÉTAPE 3 : REÇU CRYPTOGRAPHIQUE & SUIVI                         */}
          {/* ============================================================== */}
          {step === 'receipt' && completedTx && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-2">
                <div
                  className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border ${
                    completedTx.status === 'completed'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                  }`}
                >
                  {completedTx.status === 'completed' ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : (
                    <Clock className="w-7 h-7" />
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {completedTx.status === 'completed'
                    ? 'Retrait exécuté et réglé'
                    : 'Retrait placé en file de compensation'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {completedTx.status === 'completed'
                    ? 'Les fonds ont été signés et transmis sur le réseau sélectionné.'
                    : 'Mode Standard actif : règlement automatique sous ~45 secondes. Vous pouvez suivre ou annuler cet ordre dans l’historique.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ID Opération</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {completedTx.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Canal / Réseau</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {completedTx.networkLabel || completedTx.method}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Net réglé</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {(completedTx.netAmountRnc ?? completedTx.amount).toFixed(4)} RNC (
                    {formatFiatValue(
                      completedTx.netAmountRnc ?? completedTx.amount,
                      completedTx.fiatCurrency || fiatCurrency,
                      completedTx.exchangeRate
                    )}
                    )
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Destination</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                    {completedTx.address}
                  </span>
                </div>
                {completedTx.txHash && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <span className="text-slate-500 shrink-0">
                      Référence / Hash
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText('hash', completedTx.txHash || '')
                      }
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline truncate max-w-[260px] cursor-pointer"
                    >
                      <span className="truncate">{completedTx.txHash}</span>
                      {copiedKey === 'hash' ? (
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadReceipt(completedTx)}
                  className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-cyan-500 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Bordereau .txt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenHistory();
                  }}
                  className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-cyan-500 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Suivre l’historique</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};