import React, { useState, useMemo } from 'react';
import {
  SlidersVertical,
  Plus,
  Play,
  FileCode2,
  Trash2,
  Edit3,
  Copy,
  Check,
  Zap,
  Globe,
  Hash,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Search,
  Filter,
  RefreshCw,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Info,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  IdsFilterRule,
  IdsRuleProtocol,
  IdsRuleDirection,
  IdsRuleAction,
  IntrusionSeverity,
  IntrusionAttempt,
} from '../types';
import {
  DEFAULT_IDS_CUSTOM_RULES,
  generateNftablesRuleSyntax,
} from '../constants';

interface IdsRulesPanelProps {
  rules: IdsFilterRule[];
  onAddRule: (rule: Omit<IdsFilterRule, 'id' | 'hitsCount' | 'lastHitAt' | 'createdAt'>) => Promise<void> | void;
  onUpdateRule: (id: string, patch: Partial<IdsFilterRule>) => Promise<void> | void;
  onToggleRule: (id: string) => Promise<void> | void;
  onDeleteRule: (id: string) => Promise<void> | void;
  onTestRule: (rule: IdsFilterRule) => Promise<void> | void;
  onResetDefaults: () => Promise<void> | void;
  onExportRules?: () => void;
  onImportRules?: (importedRules: IdsFilterRule[]) => void;
}

const TEMPLATE_PRESETS: Array<{
  name: string;
  protocol: IdsRuleProtocol;
  ports?: string;
  ipRange?: string;
  direction: IdsRuleDirection;
  action: IdsRuleAction;
  severity: IntrusionSeverity;
  description: string;
}> = [
  {
    name: 'Blocage P2P & BitTorrent Egress (TCP/UDP 6881-6889)',
    protocol: 'ALL',
    ports: '6881-6889',
    direction: 'outbound',
    action: 'drop',
    severity: 'medium',
    description: 'Empêche tout trafic torrent ou partage peer-to-peer non autorisé de fuiter hors du tunnel VPN.',
  },
  {
    name: 'Interdiction HTTP Clair Port 80 (Forçage HTTPS)',
    protocol: 'TCP',
    ports: '80',
    direction: 'outbound',
    action: 'reject',
    severity: 'high',
    description: 'Rejette les connexions en clair non chiffrées pour prévenir le vol de cookies et l’écoute passive.',
  },
  {
    name: 'Blocage Requêtes DNS Non Sécurisées (UDP 53)',
    protocol: 'UDP',
    ports: '53',
    direction: 'outbound',
    action: 'drop',
    severity: 'critical',
    description: 'Interdit les requêtes DNS en clair vers le réseau local, garantissant l’usage exclusif de DoH/DoT.',
  },
  {
    name: 'Neutralisation SSDP / UPnP Amplification (UDP 1900)',
    protocol: 'UDP',
    ports: '1900',
    direction: 'inbound',
    action: 'drop',
    severity: 'medium',
    description: 'Bloque les paquets multicast UPnP susceptibles d’exploiter des vulnérabilités de découverte locale.',
  },
  {
    name: 'Isolation Scanners Censys (162.142.125.0/24)',
    protocol: 'ALL',
    ipRange: '162.142.125.0/24',
    direction: 'inbound',
    action: 'quarantine',
    severity: 'high',
    description: 'Isole immédiatement toute sonde réseau émanant du sous-réseau de cartographie automatisée Censys.',
  },
  {
    name: 'Blocage Protocoles Obsolètes Rexec / Rlogin (TCP 512-514)',
    protocol: 'TCP',
    ports: '512-514',
    direction: 'both',
    action: 'drop',
    severity: 'high',
    description: 'Filtre les démons UNIX d’exécution distante non chiffrés.',
  },
];

export const IdsRulesPanel: React.FC<IdsRulesPanelProps> = ({
  rules,
  onAddRule,
  onUpdateRule,
  onToggleRule,
  onDeleteRule,
  onTestRule,
  onResetDefaults,
  onExportRules,
  onImportRules,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [filterDirection, setFilterDirection] = useState<'all' | 'inbound' | 'outbound' | 'both'>('all');

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRule, setEditingRule] = useState<IdsFilterRule | null>(null);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [syntaxModalRule, setSyntaxModalRule] = useState<IdsFilterRule | null>(null);
  const [copiedCodeType, setCopiedCodeType] = useState<string | null>(null);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formProtocol, setFormProtocol] = useState<IdsRuleProtocol>('TCP');
  const [formPorts, setFormPorts] = useState('');
  const [formIpRange, setFormIpRange] = useState('');
  const [formDirection, setFormDirection] = useState<IdsRuleDirection>('inbound');
  const [formAction, setFormAction] = useState<IdsRuleAction>('drop');
  const [formSeverity, setFormSeverity] = useState<IntrusionSeverity>('high');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Stats calculation
  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.enabled).length;
  const totalHits = rules.reduce((acc, r) => acc + (r.hitsCount || 0), 0);
  const quarantinedCount = rules.filter((r) => r.action === 'quarantine' && r.enabled).length;

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (filterStatus === 'enabled' && !rule.enabled) return false;
      if (filterStatus === 'disabled' && rule.enabled) return false;
      if (filterProtocol !== 'all' && rule.protocol !== filterProtocol) return false;
      if (filterDirection !== 'all' && rule.direction !== filterDirection) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = rule.name.toLowerCase().includes(query);
        const matchesDesc = (rule.description || '').toLowerCase().includes(query);
        const matchesPort = (rule.ports || '').toLowerCase().includes(query);
        const matchesIp = (rule.ipRange || '').toLowerCase().includes(query);
        const matchesAction = rule.action.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesPort && !matchesIp && !matchesAction) {
          return false;
        }
      }

      return true;
    });
  }, [rules, filterStatus, filterProtocol, filterDirection, searchQuery]);

  const openAddModal = () => {
    setEditingRule(null);
    setFormName('');
    setFormProtocol('TCP');
    setFormPorts('');
    setFormIpRange('');
    setFormDirection('inbound');
    setFormAction('drop');
    setFormSeverity('high');
    setFormDescription('');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (rule: IdsFilterRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormProtocol(rule.protocol);
    setFormPorts(rule.ports || '');
    setFormIpRange(rule.ipRange || '');
    setFormDirection(rule.direction);
    setFormAction(rule.action);
    setFormSeverity(rule.severity);
    setFormDescription(rule.description || '');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleApplyPreset = (preset: (typeof TEMPLATE_PRESETS)[0]) => {
    setEditingRule(null);
    setFormName(preset.name);
    setFormProtocol(preset.protocol);
    setFormPorts(preset.ports || '');
    setFormIpRange(preset.ipRange || '');
    setFormDirection(preset.direction);
    setFormAction(preset.action);
    setFormSeverity(preset.severity);
    setFormDescription(preset.description);
    setFormError(null);
    setShowPresetsModal(false);
    setShowFormModal(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Veuillez renseigner un intitulé descriptif pour la règle.');
      return;
    }

    if (formProtocol !== 'ICMP' && !formPorts.trim() && !formIpRange.trim()) {
      setFormError('Définissez au moins un critère de filtrage : soit des ports, soit une plage d’IP.');
      return;
    }

    setFormError(null);

    const payload = {
      name: formName.trim(),
      enabled: editingRule ? editingRule.enabled : true,
      protocol: formProtocol,
      ports: formPorts.trim() || undefined,
      ipRange: formIpRange.trim() || undefined,
      direction: formDirection,
      action: formAction,
      severity: formSeverity,
      description: formDescription.trim() || undefined,
    };

    if (editingRule) {
      await onUpdateRule(editingRule.id, payload);
    } else {
      await onAddRule(payload);
    }

    setShowFormModal(false);
  };

  const handleTriggerTest = async (rule: IdsFilterRule) => {
    setTestingRuleId(rule.id);
    try {
      await onTestRule(rule);
    } finally {
      setTimeout(() => setTestingRuleId(null), 600);
    }
  };

  const copySyntax = (text: string, type: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCodeType(type);
    setTimeout(() => setCopiedCodeType(null), 2000);
  };

  // Preview syntax for current form modal values
  const previewRuleMock: IdsFilterRule = useMemo(() => ({
    id: editingRule ? editingRule.id : 'preview-temp',
    name: formName || 'Nouvelle règle',
    enabled: true,
    protocol: formProtocol,
    ports: formPorts || undefined,
    ipRange: formIpRange || undefined,
    direction: formDirection,
    action: formAction,
    severity: formSeverity,
    hitsCount: 0,
    createdAt: new Date().toISOString(),
  }), [editingRule, formName, formProtocol, formPorts, formIpRange, formDirection, formAction, formSeverity]);

  const formSyntax = useMemo(() => generateNftablesRuleSyntax(previewRuleMock), [previewRuleMock]);

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Metrics */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shrink-0">
              <SlidersVertical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Panneau de Filtrage Personnalisé &amp; Politiques Noyau
                </h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-md font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25">
                  eBPF/XDP &amp; nftables
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Définissez des règles de neutralisation sur mesure : blocage par ports spécifiques (TCP/UDP),
                isolation de plages d'adresses IPv4/CIDR, filtrage des paquets ICMP et détection proactive au niveau de la couche réseau.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPresetsModal(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Modèles Rapides</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une Règle</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/70">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Règles Définies</div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {totalRules}{' '}
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                ({activeRules} actives)
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Paquets Neutralisés</div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {totalHits.toLocaleString('fr-FR')}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Politiques Quarantaine</div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {quarantinedCount}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Moteur de Filtrage</div>
            <div className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Inline XDP_DROP &amp; Netfilter</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, port, IP/CIDR, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={filterProtocol}
            onChange={(e) => setFilterProtocol(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Tous protocoles</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="ICMP">ICMP</option>
            <option value="ALL">ALL (Tous)</option>
          </select>

          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Toutes directions</option>
            <option value="inbound">Entrant (Inbound)</option>
            <option value="outbound">Sortant (Outbound)</option>
            <option value="both">Bidirectionnel</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Tous statuts</option>
            <option value="enabled">Actives uniquement</option>
            <option value="disabled">Désactivées</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {onExportRules && (
            <button
              type="button"
              onClick={onExportRules}
              title="Exporter les règles au format JSON"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onResetDefaults}
            title="Restaurer les règles de filtrage par défaut"
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </button>
        </div>
      </div>

      {/* Rules Cards / List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Filter className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Aucune règle ne correspond aux critères
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Modifiez votre recherche ou utilisez le bouton "Créer une Règle" pour ajouter une politique de filtrage.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer une règle</span>
            </button>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isTesting = testingRuleId === rule.id;

            // Protocol styling (Zero-pill discipline)
            let protoBadgeBg = 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
            if (rule.protocol === 'UDP') {
              protoBadgeBg = 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
            } else if (rule.protocol === 'ICMP') {
              protoBadgeBg = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
            } else if (rule.protocol === 'ALL') {
              protoBadgeBg = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
            }

            // Action badge
            let actionBadgeBg = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30';
            let actionLabel = 'DROP (eBPF)';
            if (rule.action === 'reject') {
              actionBadgeBg = 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30';
              actionLabel = 'REJECT (RST)';
            } else if (rule.action === 'quarantine') {
              actionBadgeBg = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
              actionLabel = 'QUARANTAINE';
            } else if (rule.action === 'alert_only') {
              actionBadgeBg = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
              actionLabel = 'ALERTE SEULE';
            }

            return (
              <div
                key={rule.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 transition-all duration-200 ${
                  rule.enabled
                    ? 'border-slate-200 dark:border-slate-800 shadow-xs'
                    : 'border-slate-200/50 dark:border-slate-800/40 opacity-60 bg-slate-50/50 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Rule Header & Identification */}
                  <div className="flex items-start gap-3">
                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => onToggleRule(rule.id)}
                      title={rule.enabled ? 'Désactiver la règle' : 'Activer la règle'}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 mt-0.5 ${
                        rule.enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${protoBadgeBg}`}>
                          {rule.protocol}
                        </span>

                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {rule.name}
                        </span>

                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${actionBadgeBg}`}>
                          {actionLabel}
                        </span>

                        {rule.isSystemPreset && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            PRESET
                          </span>
                        )}
                      </div>

                      {rule.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {rule.description}
                        </p>
                      )}

                      {/* Criteria Badges Strip */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                        {rule.ports && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            <Hash className="w-3 h-3 text-cyan-500" />
                            <span>Ports: {rule.ports}</span>
                          </span>
                        )}

                        {rule.ipRange && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            <Globe className="w-3 h-3 text-emerald-500" />
                            <span>IP/CIDR: {rule.ipRange}</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          {rule.direction === 'inbound' && <ArrowDownLeft className="w-3 h-3 text-cyan-500" />}
                          {rule.direction === 'outbound' && <ArrowUpRight className="w-3 h-3 text-amber-500" />}
                          {rule.direction === 'both' && <ArrowLeftRight className="w-3 h-3 text-purple-500" />}
                          <span>
                            {rule.direction === 'inbound'
                              ? 'Entrant'
                              : rule.direction === 'outbound'
                              ? 'Sortant'
                              : 'Bidirectionnel'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Hit Counter */}
                  <div className="flex items-center gap-2 self-end lg:self-center pl-12 lg:pl-0">
                    {/* Hits counter badge */}
                    <div className="text-right mr-2">
                      <div className="text-xs font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1 justify-end">
                        <Zap className="w-3 h-3 text-cyan-500" />
                        <span>{rule.hitsCount || 0} hits</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {rule.lastHitAt || 'Aucun hit'}
                      </div>
                    </div>

                    {/* Test Button */}
                    <button
                      type="button"
                      disabled={isTesting}
                      onClick={() => handleTriggerTest(rule)}
                      title="Simuler un paquet déclenchant cette règle pour vérifier le filtrage et la notification"
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Play className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-cyan-500' : 'text-cyan-500'}`} />
                      <span>{isTesting ? 'Test...' : 'Tester'}</span>
                    </button>

                    {/* Kernel Syntax Inspector */}
                    <button
                      type="button"
                      onClick={() => setSyntaxModalRule(rule)}
                      title="Inspecter la commande nftables / iptables / eBPF générée"
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <FileCode2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(rule)}
                      title="Modifier les critères de la règle"
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      title="Supprimer cette règle"
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preset Templates Modal */}
      {showPresetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Modèles de Sécurité Prédéfinis (Presets)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sélectionnez un modèle éprouvé pour charger instantanément ses critères de blocage (ports sensibles, protocoles ou adresses à risque) dans l'éditeur :
              </p>

              <div className="space-y-2">
                {TEMPLATE_PRESETS.map((preset, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25">
                          {preset.protocol}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {preset.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                        {preset.ports && <span>Ports: {preset.ports}</span>}
                        {preset.ipRange && <span>CIDR: {preset.ipRange}</span>}
                        <span>Action: {preset.action.toUpperCase()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Appliquer</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rule Creation / Edition Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <SlidersVertical className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingRule ? 'Modifier la Règle de Filtrage' : 'Créer une Nouvelle Règle de Filtrage'}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Politique eBPF XDP &amp; Netfilter
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Rule Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intitulé de la Règle *
                </label>
                <input
                  type="text"
                  placeholder="ex: Bloquer Telnet &amp; RDP Inbound, Anti-Port Scan 8080..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Protocol Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Protocole de Transport L4 *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['TCP', 'UDP', 'ICMP', 'ALL'] as IdsRuleProtocol[]).map((proto) => (
                    <button
                      key={proto}
                      type="button"
                      onClick={() => setFormProtocol(proto)}
                      className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer text-center ${
                        formProtocol === proto
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {proto}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ports and IP Ranges Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ports */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Ports Spécifiques (Cible)
                    </label>
                    {formProtocol === 'ICMP' && (
                      <span className="text-[10px] text-slate-400">Non applicable à ICMP</span>
                    )}
                  </div>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled={formProtocol === 'ICMP'}
                      placeholder="ex: 23, 3389 ou 8000-8080"
                      value={formPorts}
                      onChange={(e) => setFormPorts(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-40"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => setFormPorts('22, 23')}
                      className="hover:text-cyan-500 underline cursor-pointer"
                    >
                      SSH/Telnet (22, 23)
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFormPorts('445, 137-139')}
                      className="hover:text-cyan-500 underline cursor-pointer"
                    >
                      SMB (445)
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFormPorts('3389')}
                      className="hover:text-cyan-500 underline cursor-pointer"
                    >
                      RDP (3389)
                    </button>
                  </div>
                </div>

                {/* IP Range / CIDR */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plage d'IP ou CIDR
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ex: 198.51.100.0/24 ou 45.142.214.10"
                      value={formIpRange}
                      onChange={(e) => setFormIpRange(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => setFormIpRange('198.51.100.0/24')}
                      className="hover:text-cyan-500 underline cursor-pointer"
                    >
                      Scan CIDR /24
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFormIpRange('185.220.101.0/24')}
                      className="hover:text-cyan-500 underline cursor-pointer"
                    >
                      Tor Exit subnet
                    </button>
                  </div>
                </div>
              </div>

              {/* Direction & Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Direction */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sens du Trafic
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormDirection('inbound')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                        formDirection === 'inbound'
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Entrant
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDirection('outbound')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                        formDirection === 'outbound'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Sortant
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDirection('both')}
                      className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                        formDirection === 'both'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Deux sens
                    </button>
                  </div>
                </div>

                {/* Defense Action */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Action de Neutralisation
                  </label>
                  <select
                    value={formAction}
                    onChange={(e) => setFormAction(e.target.value as IdsRuleAction)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="drop">DROP immédiat (eBPF/XDP - Silencieux)</option>
                    <option value="reject">REJECT (nftables - Réponse RST/ICMP)</option>
                    <option value="quarantine">QUARANTAINE (Bannissement nftables)</option>
                    <option value="alert_only">ALERTE SEULE (Journalisation sans drop)</option>
                  </select>
                </div>
              </div>

              {/* Severity & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Niveau d'Alerte
                  </label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as IntrusionSeverity)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="critical">Critique (Alarme WebAudio)</option>
                    <option value="high">Élevé</option>
                    <option value="medium">Moyen</option>
                    <option value="low">Faible</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description ou Justification Tactique
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Prévention des attaques par force brute ou scans automatisés..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Live Kernel Command Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1.5 text-slate-300">
                <div className="text-[10px] text-cyan-400 font-semibold flex items-center justify-between">
                  <span>Aperçu de la règle nftables générée :</span>
                  <span className="text-slate-500">Live Kernel Gen</span>
                </div>
                <div className="text-emerald-400 select-all overflow-x-auto whitespace-pre">
                  {formSyntax.nftables}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingRule ? 'Mettre à jour la règle' : 'Enregistrer la règle'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Syntax Inspector Modal */}
      {syntaxModalRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-cyan-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Commandes Noyau Générées · {syntaxModalRule.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSyntaxModalRule(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {(() => {
                const syntax = generateNftablesRuleSyntax(syntaxModalRule);
                return (
                  <>
                    {/* nftables */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Format moderne Linux Netfilter (nftables)
                        </span>
                        <button
                          type="button"
                          onClick={() => copySyntax(syntax.nftables, 'nft')}
                          className="text-cyan-500 hover:text-cyan-400 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          {copiedCodeType === 'nft' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCodeType === 'nft' ? 'Copié !' : 'Copier'}</span>
                        </button>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-400 select-all overflow-x-auto">
                        {syntax.nftables}
                      </div>
                    </div>

                    {/* iptables */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Format compatible Legacy iptables
                        </span>
                        <button
                          type="button"
                          onClick={() => copySyntax(syntax.iptables, 'ipt')}
                          className="text-cyan-500 hover:text-cyan-400 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          {copiedCodeType === 'ipt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCodeType === 'ipt' ? 'Copié !' : 'Copier'}</span>
                        </button>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-cyan-300 select-all overflow-x-auto">
                        {syntax.iptables}
                      </div>
                    </div>

                    {/* eBPF XDP hook */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Programme C eBPF / XDP Driver Hook
                        </span>
                        <button
                          type="button"
                          onClick={() => copySyntax(syntax.ebpfHook, 'bpf')}
                          className="text-cyan-500 hover:text-cyan-400 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          {copiedCodeType === 'bpf' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCodeType === 'bpf' ? 'Copié !' : 'Copier'}</span>
                        </button>
                      </div>
                      <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 select-all overflow-x-auto whitespace-pre">
                        {syntax.ebpfHook}
                      </pre>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
