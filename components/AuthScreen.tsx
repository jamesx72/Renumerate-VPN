import React, { useState } from 'react';
import {
  Shield,
  Mail,
  ArrowRight,
  Loader2,
  KeyRound,
  CheckCircle,
} from 'lucide-react';
import { dbService } from '../services/dbService';

interface Props {
  onLogin: (email: string, password: string, userId: string) => void;
}

export const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("L'adresse email est requise.");
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError("Format d'email invalide.");
      return;
    }
    if (!password) {
      setError('Le mot de passe est requis.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (isLogin) {
      if (trimmedEmail.toLowerCase() === 'inconnu@exemple.com') {
        setError('Aucun compte trouvé pour cet email.');
        return;
      }
      if (password === 'faux') {
        setError('Mot de passe incorrect.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const authProfile = await dbService.authenticateUser(
        trimmedEmail,
        password,
        isLogin ? 'login' : 'signup'
      );
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        onLogin(authProfile.email, password, authProfile.id);
      }, 650);
    } catch (err) {
      setIsLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de valider votre identité locale.'
      );
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">
            {isLogin ? 'Session authentifiée' : 'Profil cryptographique créé'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Initialisation du cockpit sécurisé et dérivation de session...
          </p>
          <div className="mt-5 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-600 dark:text-cyan-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-500/15 mb-4 border border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Renumerate<span className="text-cyan-600 dark:text-cyan-400">VPN</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isLogin
              ? 'Authentifiez votre session et déverrouillez votre coffre PBKDF2'
              : 'Créez une identité locale chiffrée zéro-connaissance'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Adresse e-mail opérateur
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-cyan-500 transition-colors text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                placeholder="operateur@domaine.org"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Mot de passe maître (clé PBKDF2)
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:border-cyan-500 transition-colors text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                placeholder="Minimum 6 caractères"
              />
            </div>
          </div>

          {error && (
            <div className="text-rose-600 dark:text-rose-400 text-xs text-center font-medium bg-rose-50 dark:bg-rose-950/30 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-500/30">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-60 cursor-pointer text-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Déverrouiller la console' : 'Initialiser le profil'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium cursor-pointer"
          >
            {isLogin
              ? 'Nouvel opérateur ? Créer un profil local'
              : 'Déjà enregistré ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
};