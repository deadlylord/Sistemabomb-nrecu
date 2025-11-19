
import React, { useState } from 'react';
import { MailIcon, LockIcon, EyeIcon } from './Icons';

interface LoginViewProps {
  onLogin: (username: string, password: string) => void;
  isAppReady: boolean;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, isAppReady }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      onLogin(username, password);
    } else {
      alert('Por favor, ingresa tu usuario y contraseña.');
    }
  };

  return (
    <div className="bg-white/10 dark:bg-slate-900/50 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl shadow-black/20 w-full max-w-sm text-center animate-fade-in border border-white/20 dark:border-slate-800">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/5 shadow-2xl ring-1 ring-white/10">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" className="h-20 w-20 drop-shadow-lg">
          <defs>
            <linearGradient id="bsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff007f" stopOpacity="1" />
              <stop offset="100%" stopColor="#00aaff" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#bsGradient)"/>
          <text x="50" y="65" fontFamily="Arial, Helvetica, sans-serif" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">BS</text>
        </svg>
      </div>
      
      <h1 className="text-4xl font-serif font-bold text-slate-800 dark:text-text-light mb-2 tracking-wide">
        Facturación <span className="text-blue-500">Street</span>/<span className="text-accent">Bombón</span>
      </h1>
      <p className="text-slate-500 dark:text-text-dark mb-8 font-light">Ingresa para continuar</p>
      
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
            disabled={!isAppReady}
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
            disabled={!isAppReady}
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
          disabled={!isAppReady}
          className="w-full bg-accent text-white font-bold py-4 px-4 rounded-xl transition-all duration-300 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/40 disabled:bg-slate-500 disabled:cursor-not-allowed"
        >
          {isAppReady ? 'Ingresar' : 'Cargando...'}
        </button>
      </form>
    </div>
  );
};

export default LoginView;
