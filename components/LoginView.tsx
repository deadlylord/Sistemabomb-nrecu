
import React, { useState, useMemo, useRef } from 'react';
import { MailIcon, LockIcon, EyeIcon } from './Icons';
import { APP_VERSIONS } from '../constants';

interface LoginViewProps {
  onLogin: (username: string, password: string) => void | Promise<void>;
  isAppReady: boolean;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, isAppReady }) => {
  const submitRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const currentVersion = APP_VERSIONS.find(v => v.isCurrent)?.version || '1.0.0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitRef.current || !isAppReady) return;
    if (username && password) {
      submitRef.current = true; setSubmitting(true);
      try { await onLogin(username, password); }
      finally { submitRef.current = false; setSubmitting(false); }
    } else {
      alert('Por favor, ingresa tu usuario y contraseña.');
    }
  };

  return (
    <div className="bg-white/10 dark:bg-slate-900/50 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl shadow-black/20 w-full max-w-sm text-center animate-fade-in border border-white/20 dark:border-slate-800">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900/60 shadow-2xl ring-1 ring-white/10 p-2 overflow-hidden">
        <img 
          src="/assets/vestika.png?v=1.1.107" 
          alt="Logo Vestika" 
          className="w-full h-full object-contain drop-shadow-xl" 
        />
      </div>
      
      <h1 className="text-5xl sm:text-[3.5rem] font-semibold text-slate-850 dark:text-text-light mb-2 tracking-tight leading-none" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <span className="text-accent normal-case"><span aria-label="Vestika" style={{ color: '#ffffff' }}><span>Vest</span><span style={{ backgroundImage: 'linear-gradient(110deg, #38bdf8 0%, #a855f7 48%, #ec4899 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextStroke: '0.3px rgba(240, 246, 255, 0.8)', filter: 'drop-shadow(0 0 2px rgba(210, 228, 255, 0.7)) drop-shadow(0 0 5px rgba(216, 192, 245, 0.35))' }}>ik</span><span>a</span></span></span>
      </h1>
      <p className="text-xs text-slate-500 dark:text-text-dark mb-7 font-semibold uppercase tracking-wider">POS para tiendas de moda</p>
      
      <form onSubmit={handleSubmit} className="space-y-6 text-left">
        <div className="relative">
          <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-text-dark" />
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-200/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl p-4 pl-12 text-slate-800 dark:text-text-light placeholder-slate-400 dark:placeholder-text-dark focus:ring-2 focus:ring-accent focus:border-accent outline-none transition"
            placeholder="Usuario"
            required
            disabled={!isAppReady || submitting}
            autoComplete="username"
          />
        </div>

        <div className="relative">
          <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-text-dark" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-200/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl p-4 pl-12 text-slate-800 dark:text-text-light placeholder-slate-400 dark:placeholder-text-dark focus:ring-2 focus:ring-accent focus:border-accent outline-none transition"
            placeholder="Contraseña"
            required
            disabled={!isAppReady || submitting}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-text-dark cursor-pointer"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <EyeIcon />
          </button>
        </div>
        
        <button
          type="submit"
          disabled={!isAppReady || submitting}
          className="w-full bg-accent text-white font-bold py-4 px-4 rounded-xl transition-all duration-300 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/40 disabled:bg-slate-500 disabled:cursor-not-allowed"
        >
          {submitting ? 'Verificando…' : isAppReady ? 'Ingresar' : 'Conectando…'}
        </button>
      </form>
      
      <div className="mt-8 flex justify-center">
          <span className="text-[10px] font-black text-slate-400 dark:text-text-dark">
            {currentVersion}
          </span>
      </div>
    </div>
  );
};

export default LoginView;
