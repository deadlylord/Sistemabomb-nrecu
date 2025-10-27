import React, { useState } from 'react';
import { LockKeyholeIcon, MailIcon, LockIcon, EyeIcon } from './Icons';

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
    <div className="bg-secondary/50 backdrop-blur-xl p-8 rounded-3xl shadow-accent w-full max-w-sm text-center animate-fade-in">
      <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
        <LockKeyholeIcon className="h-10 w-10 text-accent" />
      </div>
      <h1 className="text-3xl font-bold text-text-light mb-2">Facturación Street/ <span className="text-accent">Bombón</span></h1>
      <p className="text-text-dark mb-8">Ingresa para continuar</p>
      
      <form onSubmit={handleSubmit} className="space-y-6 text-left">
        <div className="relative">
          <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-dark" />
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-primary border border-secondary rounded-xl p-4 pl-12 text-text-light placeholder-text-dark focus:ring-2 focus:ring-accent focus:border-accent outline-none transition"
            placeholder="Usuario"
            required
            disabled={!isAppReady}
            autoComplete="username"
          />
        </div>

        <div className="relative">
          <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-dark" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-primary border border-secondary rounded-xl p-4 pl-12 text-text-light placeholder-text-dark focus:ring-2 focus:ring-accent focus:border-accent outline-none transition"
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;"
            required
            disabled={!isAppReady}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-dark cursor-pointer"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <EyeIcon />
          </button>
        </div>
        
        <button
          type="submit"
          disabled={!isAppReady}
          className="w-full bg-accent text-white font-bold py-4 px-4 rounded-xl transition-colors duration-300 hover:bg-accent-hover disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isAppReady ? 'Ingresar' : 'Cargando...'}
        </button>
      </form>
    </div>
  );
};

export default LoginView;