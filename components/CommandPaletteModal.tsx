import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Power,
  RefreshCw,
  ShieldAlert,
  Lock,
  Cpu,
  Globe,
  Terminal,
  SlidersVertical,
  Sun,
  Moon,
  Download,
  Shield,
  Zap,
  Ghost,
  Orbit,
  CornerDownLeft,
  X,
  Fingerprint,
  Network,
  ShieldCheck,
} from 'lucide-react';
import {
  AppSettings,
  ConnectionMode,
  DeviceNode,
  LogEntry,
  VirtualIdentity,
} from '../types';

export type PaletteSectionTarget = 'cockpit' | 'vault' | 'network' | 'system';

type CommandCategory =
  | 'all'
  | 'navigation'
  | 'tunnel'
  | 'presets'
  | 'relays'
  | 'vault_logs';

interface PaletteCommandItem {
  id: string;
  category: Exclude<CommandCategory, 'all'>;
  categoryLabel: string;
  title: string;
  subtitle: string;
  keywords: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'cyan' | 'emerald' | 'purple' | 'danger' | 'amber';
  onExecute: () => void;
}

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  activeSection: PaletteSectionTarget;
  onNavigateSection: (section: PaletteSectionTarget) => void;
  isConnected: boolean;
  isEmergency: boolean;
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  currentIdentity: VirtualIdentity;
  nodes: DeviceNode[];
  vaultUnlocked: boolean;
  vaultCount: number;
  hardeningScore: number;
  settings: AppSettings;
  logs: LogEntry[];
  onConnectVpn: () => void;
  onDisconnectVpn: () => void;
  onConnectNode: (nodeId: string) => void;
  onTriggerRenumberHop: () => void;
  onGlobalScramble: () => void;
  onToggleEmergency: () => void;
  onExecutePanic: () => void;
  onLockVault: () => void;
  onFlushDnsCache: () => void;
  onPatchSettings: (patch: Partial<AppSettings>, reason?: string) => void;
  onOpenLogs: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenIds?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  isDark,
  onToggleTheme,
  onNavigateSection,
  isConnected,
  isEmergency,
  onModeChange,
  currentIdentity,
  nodes,
  vaultUnlocked,
  vaultCount,
  hardeningScore,
  settings,
  logs,
  onConnectVpn,
  onDisconnectVpn,
  onConnectNode,
  onTriggerRenumberHop,
  onGlobalScramble,
  onToggleEmergency,
  onExecutePanic,
  onLockVault,
  onFlushDnsCache,
  onPatchSettings,
  onOpenLogs,
  onOpenSettings,
  onOpenHistory,
  onOpenIds,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CommandCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategoryFilter('all');
      setSelectedIndex(0);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 25);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  const handleExportLogsFile = () => {
    const lines = logs.map(
      (l) =>
        `[${l.timestamp}] [${l.type.toUpperCase()}]${l.ip ? ` [${l.ip}]` : ''} ${l.event}`
    );
    const content = [
      `# Renumerate VPN — Export journal opérateur (${new Date().toISOString()})`,
      `# Passerelle : ${currentIdentity.city}, ${currentIdentity.country} (${currentIdentity.ip})`,
      ...lines,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renumerate-session-${Date.now()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const allCommands = useMemo<PaletteCommandItem[]>(() => {
    const items: PaletteCommandItem[] = [
      // Tunnel & Identité
      {
        id: 'toggle-vpn',
        category: 'tunnel',
        categoryLabel: 'Tunnel & Identité',
        title: isConnected
          ? 'Déconnecter le tunnel chiffré'
          : 'Établir le tunnel VPN chiffré',
        subtitle: isConnected
          ? `Session active vers ${currentIdentity.city}, ${currentIdentity.country} (${currentIdentity.ip})`
          : `Ouvrir ${settings.protocol.toUpperCase()} :${settings.tunnelPort} vers ${currentIdentity.city}`,
        keywords: 'connect disconnect vpn tunnel wireguard connexion deconnexion',
        shortcut: 'Ctrl+S',
        icon: Power,
        tone: isConnected ? 'amber' : 'emerald',
        onExecute: () => {
          if (isConnected) onDisconnectVpn();
          else onConnectVpn();
        },
      },
      {
        id: 'renumber-hop',
        category: 'tunnel',
        categoryLabel: 'Tunnel & Identité',
        title: 'Exécuter un saut de re-numérotation immédiat',
        subtitle: `Bascule IP, MAC et User-Agent selon la posture ${settings.anonymityLevel.toUpperCase()}`,
        keywords: 'hop saut rotation renumerotation ip mac identite',
        icon: RefreshCw,
        tone: 'cyan',
        onExecute: onTriggerRenumberHop,
      },
      {
        id: 'scramble-hardware',
        category: 'tunnel',
        categoryLabel: 'Tunnel & Identité',
        title: 'Brouiller l’adresse MAC et l’empreinte User-Agent',
        subtitle: `Actuel : ${currentIdentity.mac} · ${currentIdentity.userAgentShort}`,
        keywords: 'mac user-agent spoof morphing empreinte matériel',
        shortcut: 'Ctrl+R',
        icon: Fingerprint,
        tone: 'cyan',
        onExecute: onGlobalScramble,
      },
      {
        id: 'flush-dns',
        category: 'tunnel',
        categoryLabel: 'Tunnel & Identité',
        title: 'Purger le cache DNS local',
        subtitle: `Résolveur actif : ${settings.dns.toUpperCase()} · Anti-fuite ${settings.dnsLeakProtection ? 'actif' : 'inactif'}`,
        keywords: 'dns flush cache fuite resolver',
        icon: Shield,
        tone: 'default',
        onExecute: onFlushDnsCache,
      },
      {
        id: 'emergency-killswitch',
        category: 'tunnel',
        categoryLabel: 'Tunnel & Identité',
        title: isEmergency
          ? 'Désamorcer le coupe-circuit réseau d’urgence'
          : 'Verrouiller le coupe-circuit d’urgence (Kill Switch)',
        subtitle: isEmergency
          ? 'Rétablir l’autorisation de sortie vers les interfaces tunnel'
          : 'Bloquer immédiatement tout paquet sortant hors boucle locale',
        keywords: 'kill switch urgence emergency lockdown pare-feu',
        shortcut: 'Ctrl+Maj+K',
        icon: ShieldAlert,
        tone: 'danger',
        onExecute: onToggleEmergency,
      },
      {
        id: 'execute-panic',
        category: 'tunnel',
        categoryLabel: 'Tunnel & Identité',
        title: 'Exécuter le protocole Panique d’urgence',
        subtitle: `Directive configurée : ${
          settings.panicAction === 'disconnect_wipe'
            ? 'Déconnexion + Purge RAM'
            : settings.panicAction === 'lock_vault_and_scramble'
              ? 'Verrouillage Coffre + Rotation furtive'
              : 'Verrouillage noyau strict'
        }`,
        keywords: 'panic panique urgence purge wipe verrouiller',
        shortcut: 'Ctrl+Maj+X',
        icon: ShieldAlert,
        tone: 'danger',
        onExecute: onExecutePanic,
      },

      // Navigation
      {
        id: 'nav-cockpit',
        category: 'navigation',
        categoryLabel: 'Navigation',
        title: 'Ouvrir l’espace Cockpit VPN',
        subtitle: 'Contrôle du tunnel, télémétrie binaire, audit DNS et matrice des relais',
        keywords: 'cockpit dashboard accueil vpn',
        icon: Shield,
        tone: 'cyan',
        onExecute: () => onNavigateSection('cockpit'),
      },
      {
        id: 'nav-vault',
        category: 'navigation',
        categoryLabel: 'Navigation',
        title: 'Ouvrir le Coffre-fort local AES-256-GCM',
        subtitle: `${vaultCount} élément${vaultCount > 1 ? 's' : ''} chiffré${vaultCount > 1 ? 's' : ''} · Clé RAM ${vaultUnlocked ? 'déverrouillée' : 'verrouillée'}`,
        keywords: 'coffre vault aes pbkdf2 fichiers secrets mots de passe',
        icon: Lock,
        tone: 'emerald',
        onExecute: () => onNavigateSection('vault'),
      },
      {
        id: 'nav-network',
        category: 'navigation',
        categoryLabel: 'Navigation',
        title: 'Ouvrir la Topologie Réseau & Chaînage Multi-Sauts',
        subtitle: `Carte mondiale interactive, sondes RTT/ASN et constructeur de circuits`,
        keywords: 'topologie reseau carte map noeuds multi-hop circuit',
        icon: Globe,
        tone: 'cyan',
        onExecute: () => onNavigateSection('network'),
      },
      {
        id: 'nav-system',
        category: 'navigation',
        categoryLabel: 'Navigation',
        title: 'Ouvrir la Console Système & Noyau',
        subtitle: `Durcissement actuel : ${hardeningScore}% · Compilateur wg0/nftables/sysctl et simulateur`,
        keywords: 'systeme noyau kernel ebpf xdp pqc sysctl nftables wireguard',
        shortcut: 'Ctrl+Y',
        icon: Cpu,
        tone: 'purple',
        onExecute: () => onNavigateSection('system'),
      },
      {
        id: 'nav-inspector',
        category: 'navigation',
        categoryLabel: 'Navigation',
        title: 'Ouvrir l’Inspecteur de Trames & Sonde Netfilter',
        subtitle:
          'Capture eBPF en direct, entropie Shannon (b/o), verdicts pare-feu et analyse hexadécimale',
        keywords:
          'inspecteur trames netfilter ebpf pcap capture dump hex paquets shannon wireshark sondes',
        icon: Network,
        tone: 'cyan',
        onExecute: () => {
          try {
            localStorage.setItem(
              'renumerate_system_workspace_tab',
              'inspector'
            );
          } catch {
            // ignore
          }
          window.dispatchEvent(
            new CustomEvent('renumerate_switch_system_tab', {
              detail: 'inspector',
            })
          );
          onNavigateSection('system');
        },
      },
      {
        id: 'nav-ids',
        category: 'navigation',
        categoryLabel: 'Navigation',
        title: 'Ouvrir la Sentinelle IDS · Détection d’intrusions',
        subtitle:
          'Surveillance NIDS/HIDS temps réel, quarantaine nftables et laboratoire de simulation d’attaques',
        keywords:
          'ids intrusion detection alerte attaque scan nmap hacker quarantaine sentinelle ebpf xdp ban',
        icon: ShieldAlert,
        tone: 'danger',
        onExecute: () => {
          try {
            localStorage.setItem('renumerate_system_workspace_tab', 'ids');
          } catch {
            // ignore
          }
          window.dispatchEvent(
            new CustomEvent('renumerate_switch_system_tab', {
              detail: 'ids',
            })
          );
          if (onOpenIds) {
            onOpenIds();
          } else {
            onNavigateSection('system');
          }
        },
      },
      {
        id: 'ids-toggle-protection',
        category: 'presets',
        categoryLabel: 'Profils & Durcissement',
        title: `${
          settings.idsEnabled
            ? 'Mettre en veille la Sentinelle IDS'
            : 'Activer la Sentinelle IDS (eBPF/XDP)'
        }`,
        subtitle: settings.idsEnabled
          ? 'Suspendre la détection des balayages et quarantaine automatique'
          : 'Démarrer la capture et la détection d’intrusions multi-vecteurs',
        keywords: 'ids sentinelle intrusion activer desactiver securite parefeu',
        icon: ShieldCheck,
        tone: 'cyan',
        onExecute: () => {
          onPatchSettings(
            { idsEnabled: !settings.idsEnabled },
            `Sentinelle IDS ${!settings.idsEnabled ? 'activée' : 'désactivée'}`
          );
        },
      },

      // Profils & Durcissement
      {
        id: 'preset-pqc-kernel',
        category: 'presets',
        categoryLabel: 'Profils & Durcissement',
        title: 'Appliquer le profil : Noyau PQC Durci',
        subtitle: 'WireGuard + ML-KEM-1024 + eBPF/XDP + Kill Switch strict + BBR',
        keywords: 'preset profil pqc post-quantique ml-kem kernel durci',
        icon: Cpu,
        tone: 'emerald',
        onExecute: () => {
          onModeChange(ConnectionMode.DOUBLE_HOP);
          onPatchSettings(
            {
              protocol: 'wireguard',
              postQuantumKex: 'ml-kem-1024',
              tcpCongestionControl: 'bbr',
              ebpfXdpAcceleration: true,
              killSwitch: true,
              killSwitchMode: 'strict',
              dnsLeakProtection: true,
              ipv6LeakProtection: true,
              webrtcLeakShield: true,
              blockQuicUdp443: true,
              strictMemoryLock: true,
              anonymityLevel: 'balanced',
              excludeEyesJurisdictions: '5-eyes',
            },
            'Profil « Noyau PQC Durci » activé via la palette opérateur'
          );
        },
      },
      {
        id: 'preset-stealth-max',
        category: 'presets',
        categoryLabel: 'Profils & Durcissement',
        title: 'Appliquer le profil : Furtivité Maximale (Hors 14-Eyes)',
        subtitle: 'Sanctuaires exclusifs, fragmentation TLS anti-DPI, bourrage Chaff 40 ms',
        keywords: 'preset profil furtivite extreme stealth 14-eyes anti-dpi',
        icon: Ghost,
        tone: 'purple',
        onExecute: () => {
          onModeChange(ConnectionMode.STEALTH);
          onPatchSettings(
            {
              anonymityLevel: 'extreme',
              excludeEyesJurisdictions: '14-eyes',
              obfuscationLevel: 'ultra',
              tlsClientHelloFragmentation: true,
              trafficPaddingJitterMs: 40,
              killSwitch: true,
              killSwitchMode: 'strict',
              webrtcLeakShield: true,
              ipv6LeakProtection: true,
              dnsLeakProtection: true,
              fingerprintProtection: {
                canvasNoise: true,
                webglMask: true,
                audioContextSpoof: true,
                timezoneSync: true,
              },
            },
            'Profil « Furtivité Maximale (Hors 14-Eyes) » appliqué'
          );
        },
      },
      {
        id: 'preset-vortex-deep',
        category: 'presets',
        categoryLabel: 'Profils & Durcissement',
        title: 'Appliquer le profil : Onion Vortex Profond (5 sauts)',
        subtitle: 'Chaînage 5 relais + pont obfs4 + isolation NoScript stricte',
        keywords: 'preset profil onion vortex tor obfs4 5 sauts',
        icon: Orbit,
        tone: 'purple',
        onExecute: () => {
          onModeChange(ConnectionMode.ONION_VORTEX);
          onPatchSettings(
            {
              vortexBridge: 'obfs4',
              vortexCircuitLength: 5,
              vortexNoScript: true,
              anonymityLevel: 'extreme',
              excludeEyesJurisdictions: '14-eyes',
            },
            'Mode « Onion Vortex Profond (5 sauts obfs4) » activé'
          );
        },
      },
      {
        id: 'preset-speed-ultra',
        category: 'presets',
        categoryLabel: 'Profils & Durcissement',
        title: 'Appliquer le profil : Vélocité Basse Latence',
        subtitle: 'WireGuard direct + XDP Zero-Copy + BBR + MTU 1420 + 0 ms Chaff',
        keywords: 'preset profil vitesse speed rapide latence wireguard',
        icon: Zap,
        tone: 'cyan',
        onExecute: () => {
          onModeChange(ConnectionMode.STANDARD);
          onPatchSettings(
            {
              protocol: 'wireguard',
              anonymityLevel: 'low',
              tcpCongestionControl: 'bbr',
              ebpfXdpAcceleration: true,
              multiQueueTun: true,
              trafficPaddingJitterMs: 0,
              tlsClientHelloFragmentation: false,
              mtuSize: 1420,
              powerProfile: 'performance',
            },
            'Profil « Vélocité Basse Latence » activé'
          );
        },
      },

      // Coffre & Journaux
      ...(vaultUnlocked
        ? [
            {
              id: 'lock-vault-ram',
              category: 'vault_logs' as const,
              categoryLabel: 'Coffre & Journaux',
              title: 'Purger la clé maîtresse RAM et verrouiller le coffre',
              subtitle: 'Efface immédiatement le secret PBKDF2 en mémoire vive',
              keywords: 'verrouiller lock coffre vault cle ram securite',
              icon: Lock,
              tone: 'amber' as const,
              onExecute: onLockVault,
            },
          ]
        : []),
      {
        id: 'open-logs',
        category: 'vault_logs',
        categoryLabel: 'Coffre & Journaux',
        title: 'Consulter le journal d’événements système',
        subtitle: `${logs.length} entrée${logs.length > 1 ? 's' : ''} en mémoire · Rétention ${settings.logRetentionHours}h`,
        keywords: 'logs journal evenements console audit',
        shortcut: 'Ctrl+L',
        icon: Terminal,
        tone: 'default',
        onExecute: onOpenLogs,
      },
      {
        id: 'export-logs',
        category: 'vault_logs',
        categoryLabel: 'Coffre & Journaux',
        title: 'Exporter les journaux de session (.log)',
        subtitle: 'Télécharger une trace horodatée locale des événements réseau',
        keywords: 'exporter download telecharger logs fichier',
        icon: Download,
        tone: 'default',
        onExecute: handleExportLogsFile,
      },
      {
        id: 'open-history',
        category: 'vault_logs',
        categoryLabel: 'Coffre & Journaux',
        title: 'Ouvrir l’historique des sessions VPN',
        subtitle: 'Consulter les durées cumulées et reconnecter une passerelle récente',
        keywords: 'historique sessions connexions duree',
        icon: RefreshCw,
        tone: 'default',
        onExecute: onOpenHistory,
      },
      {
        id: 'open-settings',
        category: 'vault_logs',
        categoryLabel: 'Coffre & Journaux',
        title: 'Ouvrir le panneau des paramètres complets',
        subtitle: 'Réseau, protocoles, Split Tunneling, monétisation RNC et système',
        keywords: 'parametres settings configuration reglages',
        shortcut: 'Ctrl+,',
        icon: SlidersVertical,
        tone: 'default',
        onExecute: onOpenSettings,
      },
      {
        id: 'open-config-audit',
        category: 'vault_logs',
        categoryLabel: 'Coffre & Journaux',
        title: 'Audit de cohérence & détection de conflits de configuration',
        subtitle:
          'Analyser les directives MTU, Kill Switch, PQC et règles pare-feu',
        keywords:
          'audit conflit coherence configuration reglages mtu fuite invariants',
        icon: ShieldAlert,
        tone: 'amber',
        onExecute: onOpenSettings,
      },
      {
        id: 'toggle-theme',
        category: 'vault_logs',
        categoryLabel: 'Coffre & Journaux',
        title: isDark ? 'Basculer en mode Clair' : 'Basculer en mode Sombre',
        subtitle: 'Adapter immédiatement le contraste de toute la console',
        keywords: 'theme clair sombre dark light apparence',
        icon: isDark ? Sun : Moon,
        tone: 'default',
        onExecute: onToggleTheme,
      },

      // Relais directs
      ...nodes.map((node): PaletteCommandItem => ({
        id: `relay-${node.id}`,
        category: 'relays',
        categoryLabel: 'Relais directs',
        title: `Connecter le relais ${node.name} (${node.city || node.country})`,
        subtitle: `${node.country} · ${node.ip} · ${node.latency} ms · ${node.asn || 'Transit chiffré'}`,
        keywords: `relais serveur node ${node.name} ${node.country} ${node.city || ''} ${node.ip}`,
        icon: Globe,
        tone:
          node.ip === currentIdentity.ip && isConnected ? 'emerald' : 'default',
        onExecute: () => onConnectNode(node.id),
      })),
    ];

    return items;
  }, [
    isConnected,
    isEmergency,
    currentIdentity,
    settings,
    vaultCount,
    vaultUnlocked,
    hardeningScore,
    logs,
    isDark,
    nodes,
    onConnectVpn,
    onDisconnectVpn,
    onTriggerRenumberHop,
    onGlobalScramble,
    onFlushDnsCache,
    onToggleEmergency,
    onExecutePanic,
    onNavigateSection,
    onModeChange,
    onPatchSettings,
    onLockVault,
    onOpenLogs,
    onOpenHistory,
    onOpenSettings,
    onToggleTheme,
    onConnectNode,
  ]);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCommands.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${item.title} ${item.subtitle} ${item.keywords} ${item.categoryLabel}`.toLowerCase();
      return q.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [allCommands, query, categoryFilter]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, categoryFilter]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredCommands.length === 0 ? 0 : (prev + 1) % filteredCommands.length
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredCommands.length === 0
            ? 0
            : (prev - 1 + filteredCommands.length) % filteredCommands.length
        );
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        const chosen = filteredCommands[selectedIndex];
        onClose();
        chosen.onExecute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-palette-idx="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const toneIconClass = (tone: PaletteCommandItem['tone']) => {
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25';
      case 'cyan':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25';
      case 'purple':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25';
      case 'danger':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25';
      case 'amber':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-12 sm:pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes opérateur"
    >
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[78vh]">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une action, un profil PQC, un relais (Suisse, Islande...) ou un espace..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              Effacer
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la palette"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Category Segmented Bar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'Toutes' },
              { id: 'tunnel', label: 'Tunnel & Identité' },
              { id: 'navigation', label: 'Espaces' },
              { id: 'presets', label: 'Profils noyau' },
              { id: 'relays', label: 'Relais directs' },
              { id: 'vault_logs', label: 'Coffre & Outils' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Command Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center px-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Aucune commande ne correspond à « {query} »
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Essayez un pays (« Suisse », « Islande »), un protocole (« ML-KEM », « Vortex ») ou « Coffre ».
              </p>
            </div>
          ) : (
            filteredCommands.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-palette-idx={idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    onClose();
                    item.onExecute();
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30'
                      : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl border shrink-0 ${toneIconClass(item.tone)}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                          {item.categoryLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {item.shortcut}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span>↑↓ Naviguer</span>
            <span>·</span>
            <span>Entrée Exécuter</span>
            <span>·</span>
            <span>Échap Fermer</span>
          </div>
          <span className="font-mono tabular-nums">
            {filteredCommands.length} action{filteredCommands.length > 1 ? 's' : ''} disponible
            {filteredCommands.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
