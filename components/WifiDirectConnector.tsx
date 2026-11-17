import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Power,
  Radio,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  AppSettings,
  VirtualIdentity,
  WifiCardAdapter,
  WifiDirectBindingState,
} from '../types';

export interface WifiDirectConnectorProps {
  isConnected: boolean;
  isDisconnecting?: boolean;
  currentIdentity: VirtualIdentity;
  settings: AppSettings;
  activeBinding: WifiDirectBindingState | null;
  onApplyPatch: (patch: Partial<AppSettings>, reason?: string) => void;
  onConnectViaWifi: (
    adapter: WifiCardAdapter,
    binding: WifiDirectBindingState
  ) => Promise<void> | void;
  onDisconnectWifiTunnel: () => void;
  addLog?: (
    event: string,
    type?: 'info' | 'warning' | 'success' | 'error',
    ip?: string
  ) => void;
}

interface BrowserRadioStats {
  supported: boolean;
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
  type?: string;
}

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  type?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getBrowserConnectionInfo(): BrowserRadioStats {
  if (typeof navigator === 'undefined') {
    return { supported: false };
  }
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!conn) return { supported: false };

  return {
    supported: true,
    effectiveType: conn.effectiveType,
    downlinkMbps: typeof conn.downlink === 'number' ? conn.downlink : undefined,
    rttMs: typeof conn.rtt === 'number' ? conn.rtt : undefined,
    type: conn.type,
  };
}

export const WifiDirectConnector: React.FC<WifiDirectConnectorProps> = ({
  isConnected,
  isDisconnecting = false,
  currentIdentity,
  settings,
  activeBinding,
  onApplyPatch,
  onConnectViaWifi,
  onDisconnectWifiTunnel,
  addLog,
}) => {
  const [adapters, setAdapters] = useState<WifiCardAdapter[]>([]);
  const [hasPhysicalWifi, setHasPhysicalWifi] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customSsid, setCustomSsid] = useState('');
  const [browserRadio, setBrowserRadio] = useState<BrowserRadioStats>(() =>
    getBrowserConnectionInfo()
  );

  const fetchAdapters = useCallback(
    async (announce = false) => {
      setIsScanning(true);
      setErrorMsg(null);
      try {
        const resp = await fetch('/api/network/wifi-adapters');
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = (await resp.json()) as {
          hasPhysicalWifiHardware?: boolean;
          adapters?: WifiCardAdapter[];
        };
        const list = Array.isArray(data.adapters) ? data.adapters : [];
        setAdapters(list);
        setHasPhysicalWifi(Boolean(data.hasPhysicalWifiHardware));

        if (
          list.length > 0 &&
          !list.some((a) => a.id === settings.preferredWifiAdapterId)
        ) {
          onApplyPatch(
            { preferredWifiAdapterId: list[0].id },
            'Sélection automatique de la carte Wi-Fi disponible'
          );
        }

        if (announce) {
          addLog?.(
            `[Wi-Fi Direct] Analyse matérielle terminée : ${list.length} interface(s) sans fil inventoriée(s)`,
            'info',
            currentIdentity.ip
          );
        }
      } catch {
        setErrorMsg(
          'Impossible d’interroger les cartes Wi-Fi auprès du démon système.'
        );
      } finally {
        setIsScanning(false);
      }
    },
    [
      settings.preferredWifiAdapterId,
      onApplyPatch,
      addLog,
      currentIdentity.ip,
    ]
  );

  useEffect(() => {
    fetchAdapters(false);
  }, [fetchAdapters]);

  // Listen to browser Network Information API changes when supported
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      connection?: NetworkInformationLike;
    };
    const conn = nav.connection;
    if (!conn?.addEventListener) return;

    const handleUpdate = () => setBrowserRadio(getBrowserConnectionInfo());
    conn.addEventListener('change', handleUpdate);
    return () => {
      conn.removeEventListener?.('change', handleUpdate);
    };
  }, []);

  const selectedAdapter = useMemo(
    () =>
      adapters.find((a) => a.id === settings.preferredWifiAdapterId) ??
      adapters[0] ??
      null,
    [adapters, settings.preferredWifiAdapterId]
  );

  // Sync SSID input cleanly when switching selected card unless user typed custom SSID
  useEffect(() => {
    if (selectedAdapter?.ssid) {
      setCustomSsid(selectedAdapter.ssid);
    }
  }, [selectedAdapter?.id, selectedAdapter?.ssid]);

  const handleSelectAdapter = (adapter: WifiCardAdapter) => {
    onApplyPatch(
      { preferredWifiAdapterId: adapter.id },
      `Carte Wi-Fi sélectionnée : ${adapter.ifaceName} (${adapter.chipset})`
    );
    if (adapter.ssid) {
      setCustomSsid(adapter.ssid);
    }
  };

  const handleConnectDirect = async () => {
    if (!selectedAdapter || isBinding || isDisconnecting) return;
    setIsBinding(true);
    setErrorMsg(null);

    try {
      const targetSsid =
        customSsid.trim() || selectedAdapter.ssid || 'MeshDirect-6E';
      const resp = await fetch('/api/network/wifi-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adapterId: selectedAdapter.id,
          ifaceName: selectedAdapter.ifaceName,
          chipset: selectedAdapter.chipset,
          ssid: targetSsid,
          band: selectedAdapter.band,
          channel: selectedAdapter.channel,
          rssiDbm: selectedAdapter.rssiDbm,
          bypassBridge: settings.wifiDirectBypassBridge,
          protocol: settings.protocol,
          targetCity: currentIdentity.city,
          targetIp: currentIdentity.ip,
          mtu: selectedAdapter.mtu,
          source: selectedAdapter.source,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Échec liaison carte Wi-Fi (HTTP ${resp.status})`);
      }

      const binding = (await resp.json()) as WifiDirectBindingState;
      onApplyPatch(
        {
          wifiDirectBindEnabled: true,
          preferredWifiAdapterId: selectedAdapter.id,
          mtuSize: binding.clampedMtu,
        },
        `Liaison directe activée sur ${selectedAdapter.ifaceName} (MTU ${binding.clampedMtu})`
      );

      await onConnectViaWifi(selectedAdapter, binding);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la liaison directe sur la carte Wi-Fi.';
      setErrorMsg(msg);
      addLog?.(`[Wi-Fi Direct] ${msg}`, 'error', currentIdentity.ip);
    } finally {
      setIsBinding(false);
    }
  };

  const isBoundToSelected =
    Boolean(activeBinding?.bound) &&
    isConnected &&
    activeBinding?.adapterId === selectedAdapter?.id;

  return (
    <section
      id="wifi-direct-connector"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Connexion Directe Carte Wi-Fi
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Liaison socket directe sur l’adaptateur WLAN sans pont intermédiaire.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchAdapters(true)}
          disabled={isScanning}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
          title="Actualiser la détection des cartes Wi-Fi"
          aria-label="Actualiser la détection des cartes Wi-Fi"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-cyan-500' : ''}`}
          />
        </button>
      </div>

      {/* Hardware Source Strip */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
        <span>
          {hasPhysicalWifi
            ? 'Interface WLAN OS détectée'
            : 'Hôte conteneur · Profils cartes Wi-Fi'}
        </span>
        {browserRadio.supported && (
          <span>
            Lien navigateur :{' '}
            {(browserRadio.type || browserRadio.effectiveType || 'wifi').toUpperCase()}
            {typeof browserRadio.downlinkMbps === 'number'
              ? ` · ${browserRadio.downlinkMbps} Mb/s`
              : ''}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        )}

        {/* Wi-Fi Adapters List */}
        {adapters.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
            <span>
              {isScanning
                ? 'Analyse des interfaces sans fil en cours...'
                : 'Aucune carte Wi-Fi détectée.'}
            </span>
            <button
              type="button"
              onClick={() => fetchAdapters(true)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              Scanner
            </button>
          </div>
        ) : (
          <div className="space-y-2" role="radiogroup" aria-label="Sélectionner une carte Wi-Fi">
            {adapters.map((adapter) => {
              const isSelected = selectedAdapter?.id === adapter.id;
              const isActiveCard =
                Boolean(activeBinding?.bound) &&
                isConnected &&
                activeBinding?.adapterId === adapter.id;

              return (
                <button
                  key={adapter.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectAdapter(adapter)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-500/60'
                      : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Radio
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActiveCard
                            ? 'text-emerald-500'
                            : isSelected
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : 'text-slate-400'
                        }`}
                      />
                      <span className="text-xs font-bold font-mono text-slate-900 dark:text-white shrink-0">
                        {adapter.ifaceName}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {adapter.chipset}
                      </span>
                    </div>

                    <span
                      className={`text-[11px] font-mono tabular-nums font-semibold shrink-0 ${
                        isActiveCard
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isActiveCard ? 'LIÉE' : `${adapter.rssiDbm} dBm`}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>{adapter.band}</span>
                    <span aria-hidden="true">·</span>
                    <span>Ch {adapter.channel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{adapter.linkSpeedMbps} Mb/s</span>
                    <span aria-hidden="true">·</span>
                    <span>{adapter.driver}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {adapter.source === 'os_detected' ? 'Noyau OS' : 'Profil carte'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Adapter Configuration */}
        {selectedAdapter && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <label
                htmlFor="wifi-direct-ssid-input"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                SSID / Point d’accès cible ({selectedAdapter.security})
              </label>
              <input
                id="wifi-direct-ssid-input"
                type="text"
                value={customSsid}
                onChange={(e) => setCustomSsid(e.target.value)}
                placeholder={selectedAdapter.ssid || 'MeshDirect-6E'}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Contournement pont OS
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Option SO_BINDTODEVICE + ajustement MTU 802.11ax
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.wifiDirectBypassBridge}
                onClick={() =>
                  onApplyPatch(
                    { wifiDirectBypassBridge: !settings.wifiDirectBypassBridge },
                    `Contournement pont Wi-Fi ${!settings.wifiDirectBypassBridge ? 'activé' : 'désactivé'}`
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  settings.wifiDirectBypassBridge
                    ? 'bg-cyan-600'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
                aria-label="Basculer le contournement de pont OS"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    settings.wifiDirectBypassBridge
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Active Binding Status Readout */}
            {activeBinding?.bound && isConnected && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Tunnel lié à {activeBinding.ifaceName} ({activeBinding.ssid})
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-[11px]">
                    MTU {activeBinding.clampedMtu}
                  </span>
                </div>
                <div className="text-[11px] font-mono tabular-nums text-emerald-800/80 dark:text-emerald-300/80 flex flex-wrap items-center gap-2">
                  <span>{activeBinding.band}</span>
                  <span aria-hidden="true">·</span>
                  <span>Ch {activeBinding.channel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Sig {activeBinding.bindingDigest.slice(0, 12)}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleConnectDirect}
                disabled={isBinding || isDisconnecting || !selectedAdapter}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  isBoundToSelected
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-cyan-600 hover:bg-cyan-500'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isBinding ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : isBoundToSelected ? (
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                ) : (
                  <Power className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {isBinding
                    ? 'Liaison carte Wi-Fi...'
                    : isBoundToSelected
                      ? `Renégocier sur ${selectedAdapter.ifaceName}`
                      : `Connecter via ${selectedAdapter.ifaceName}`}
                </span>
              </button>

              {activeBinding?.bound && isConnected && (
                <button
                  type="button"
                  onClick={onDisconnectWifiTunnel}
                  disabled={isDisconnecting}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-rose-500/60 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Fermer le tunnel et libérer la carte Wi-Fi"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Libérer</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
