import React, { useState } from 'react';
import { Shield, Mail, ArrowRight, Loader2, KeyRound, CheckCircle } from 'lucide-react';

interface Props {
  onLogin: (email: string) => void;
}

export const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation spécifique côté client
    if (!email) {
        setError('L\'adresse email est requise.');
        return;
    }
    if (!email.includes('@')) {
        setError('Format d\'email invalide.');
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

    setIsLoading(true);
    
    // Simulate API call authentication delay
    setTimeout(() => {
        // Simulation des erreurs serveur pour démonstration
        if (isLogin) {
            // Pour tester "Aucun compte", utiliser cet email
            if (email === 'inconnu@exemple.com') {
                setIsLoading(false);
                setError('Aucun compte trouvé pour cet email.');
                return;
            }
            // Pour tester "Mot de passe incorrect", utiliser ce mot de passe
            if (password === 'faux') {
                setIsLoading(false);
                setError('Mot de passe incorrect.');
                return;
            }
        }

        setIsLoading(false);
        setIsSuccess(true);
        setTimeout(() => {
             onLogin(email);
        }, 1500);
    }, 1500);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800 text-center animate-in fade-in zoom-in duration-300">
           <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-lg shadow-emerald-500/20">
              <CheckCircle className="w-10 h-10" />
           </div>
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
             {isLogin ? 'Connexion réussie !' : 'Compte créé avec succès !'}
           </h2>
           <p className="text-slate-500 dark:text-slate-400">
             Redirection vers votre interface sécurisée...
           </p>
           <div className="mt-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative">
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-emerald-500"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <div className="p-8 relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4 shadow-inner border border-slate-200 dark:border-slate-700">
               <Shield className="w-8 h-8 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              Renumerate<span className="text-brand-500">VPN</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium tracking-wide mb-2">
               Redéfinissez votre identité numérique.
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-xs">
              {isLogin ? 'Bon retour parmi nous' : 'Commencez votre expérience sécurisée'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
             <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Email</label>
                <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        placeholder="nom@exemple.com"
                    />
                </div>
             </div>

             <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Mot de passe</label>
                <div className="relative group">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        placeholder="••••••••"
                    />
                </div>
             </div>

             {error && (
                 <div className="text-red-500 text-xs text-center font-medium bg-red-50 dark:bg-red-900/10 py-2 rounded-lg border border-red-100 dark:border-red-500/20 animate-in fade-in slide-in-from-top-2">
                     {error}
                 </div>
             )}

             <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
             >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        {isLogin ? 'Se connecter' : "S'inscrire"}
                        <ArrowRight className="w-5 h-5" />
                    </>
                )}
             </button>
          </form>

          <div className="mt-6 text-center">
            <button 
                onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                }} 
                className="text-sm text-slate-500 hover:text-brand-500 transition-colors font-medium underline underline-offset-4 decoration-transparent hover:decoration-brand-500"
            >
                {isLogin ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};