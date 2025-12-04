import React from 'react';
import { Settings, Shield, Globe, Zap, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<Props> = ({ settings, updateSettings, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto animate-shimmer">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-500" />
            Configuration
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          {/* Protocol Section */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Protocole Tunnel
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {(['wireguard', 'openvpn', 'ikev2'] as const).map((proto) => (
                <button
                  key={proto}
                  onClick={() => updateSettings('protocol', proto)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    settings.protocol === proto
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span className="font-mono capitalize">{proto}</span>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    settings.protocol === proto ? 'border-brand-500 bg-brand-500' : 'border-slate-300 dark:border-slate-600'
                  }`} />
                </button>
              ))}
            </div>
          </section>

          {/* Security Features */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Sécurité Avancée
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium">Kill Switch</div>
                  <div className="text-xs text-slate-500">Coupe Internet si le VPN lâche</div>
                </div>
                <button onClick={() => updateSettings('killSwitch', !settings.killSwitch)}>
                  {settings.killSwitch ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-medium">AdBlocker NetShield</div>
                  <div className="text-xs text-slate-500">Bloque pubs et traqueurs</div>
                </div>
                <button onClick={() => updateSettings('adBlocker', !settings.adBlocker)}>
                  {settings.adBlocker ? (
                    <ToggleRight className="w-10 h-10 text-brand-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* DNS Settings */}
          <section>
             <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Serveurs DNS
            </h3>
            <select 
              value={settings.dns}
              onChange={(e) => updateSettings('dns', e.target.value)}
              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-brand-500 transition-colors"
            >
              <option value="cloudflare">Cloudflare (1.1.1.1) - Rapide</option>
              <option value="google">Google (8.8.8.8) - Standard</option>
              <option value="custom">Renumerate Secure DNS - Privé</option>
            </select>
          </section>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-center text-slate-400">
              Version 2.4.0-stable • Build 20240315
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
