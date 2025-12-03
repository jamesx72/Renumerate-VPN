import React from 'react';
import { VirtualIdentity } from '../types';
import { Fingerprint, Globe, Monitor, Network } from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  isRotating: boolean;
}

export const IdentityMatrix: React.FC<Props> = ({ identity, isRotating }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 mb-2">
          <Network className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Adresse IP Publique</span>
        </div>
        <div className={`font-mono text-xl tracking-wider ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
           {isRotating ? 'RENUMBERING...' : identity.ip}
        </div>
      </div>

      <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 mb-2">
          <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Localisation Virtuelle</span>
        </div>
        <div className={`font-mono text-lg ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
          {isRotating ? '---' : `${identity.city}, ${identity.country}`}
        </div>
      </div>

      <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 mb-2">
          <Fingerprint className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">MAC Virtuelle</span>
        </div>
        <div className={`font-mono text-base ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
           {isRotating ? 'XX:XX:XX:XX:XX:XX' : identity.mac}
        </div>
      </div>

      <div className="bg-white dark:bg-brand-800/50 p-4 rounded-lg border border-slate-200 dark:border-brand-500/20 backdrop-blur-sm shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 mb-2">
          <Monitor className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">User Agent Spoof</span>
        </div>
        <div className={`font-mono text-sm ${isRotating ? 'text-brand-600 dark:text-brand-400 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
           {isRotating ? 'Generating Profile...' : identity.userAgentShort}
        </div>
      </div>
    </div>
  );
};