import React from 'react';
import { VirtualIdentity, ConnectionMode } from '../types';
import { Fingerprint, Globe, Monitor, Network, ArrowRight, ShieldCheck, Server } from 'lucide-react';

interface Props {
  identity: VirtualIdentity;
  entryIdentity: VirtualIdentity | null;
  isRotating: boolean;
  mode: ConnectionMode;
}

export const IdentityMatrix: React.FC<Props> = ({ identity, entryIdentity, isRotating, mode }) => {
  return (
    <div className="space-y-4">
      {mode === ConnectionMode.DOUBLE_HOP && entryIdentity && (
        <div className="bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg border border-brand-200 dark:border-brand-500/30 flex items-center justify-between text-xs sm:text-sm animate-pulse-fast">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
             <div className="w-2 h-2 rounded-full bg-slate-400"></div>
             <span className="hidden sm:inline">Source</span>
          </div>
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 mx-2 relative">
             <ArrowRight className="w-3 h-3 text-brand-500 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-medium">
                <Server className="w-4 h-4" />
                <span className="hidden sm:inline">{entryIdentity.country}</span>
                <span className="sm:hidden">{entryIdentity.country.slice(0,2).toUpperCase()}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:block">{entryIdentity.ip}</span>
          </div>
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 mx-2 relative">
             <ArrowRight className="w-3 h-3 text-brand-500 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="flex items-center gap-2 text-emerald-500 font-bold">
             <Globe className="w-4 h-4" />
             <span>{isRotating ? '...' : identity.country}</span>
          </div>
        </div>
      )}

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
    </div>
  );
};