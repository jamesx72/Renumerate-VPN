import React from 'react';
import { Contrast, EyeOff, ShieldCheck, Palette } from 'lucide-react';

export type DarknessFilterVariant = 'grayscale' | 'noir_contraste' | 'eink';

export interface DigitalDarknessModeProps {
  enabled: boolean;
  variant: DarknessFilterVariant;
  onToggle: (nextEnabled: boolean) => void;
  onVariantChange: (variant: DarknessFilterVariant) => void;
}

const VARIANT_OPTIONS: Array<{
  id: DarknessFilterVariant;
  label: string;
  description: string;
}> = [
  {
    id: 'grayscale',
    label: 'Niveaux de gris',
    description: 'Désaturation complète (100% achromatique) sans altérer la lisibilité.',
  },
  {
    id: 'noir_contraste',
    label: 'Noir & Blanc',
    description: 'Monochrome à fort contraste pour un rendu terminal tactique strict.',
  },
  {
    id: 'eink',
    label: 'Encre E-Ink',
    description: 'Teinte atténuée anti-fatigue visuelle réduisant la signature lumineuse.',
  },
];

export const DigitalDarknessMode: React.FC<DigitalDarknessModeProps> = ({
  enabled,
  variant,
  onToggle,
  onVariantChange,
}) => {
  const activeOption =
    VARIANT_OPTIONS.find((opt) => opt.id === variant) || VARIANT_OPTIONS[0];

  return (
    <section
      id="digital-darkness-mode"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs"
    >
      {/* Header & Dedicated Master Switch */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 transition-colors ${
              enabled
                ? 'bg-slate-900 dark:bg-slate-100 border-slate-700 dark:border-slate-300 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Contrast className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Mode Obscurité Numérique
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Filtre monochrome global simulant une navigation sans empreinte colorimétrique.
            </p>
          </div>
        </div>

        {/* Dedicated Accessible Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Basculer le Mode Obscurité Numérique"
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none ${
            enabled
              ? 'bg-cyan-600 border-cyan-500'
              : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Filter Style Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold">Profil de rendu optique</span>
          <span className="font-mono">
            {enabled ? 'Filtre actif' : 'Mode couleur sRGB'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800">
          {VARIANT_OPTIONS.map((opt) => {
            const isSelected = variant === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onVariantChange(opt.id);
                  if (!enabled) onToggle(true);
                }}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                  isSelected
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {activeOption.description}
        </p>
      </div>

      {/* Colorimetric Telemetry Readout */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-0.5">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Palette className="w-3 h-3" />
            <span>Empreinte chroma</span>
          </div>
          <div
            className={`font-mono font-bold tabular-nums text-xs ${
              enabled
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {enabled ? '0 bit · Neutralisée' : '24 bits · RVB'}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-0.5">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            {enabled ? (
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            <span>Discrétion écran</span>
          </div>
          <div
            className={`font-mono font-bold text-xs ${
              enabled
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {enabled ? 'Achromatique' : 'Standard'}
          </div>
        </div>
      </div>
    </section>
  );
};
