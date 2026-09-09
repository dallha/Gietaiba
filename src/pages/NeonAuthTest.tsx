/// <reference types="vite/client" />
import React, { useState } from 'react';
import { neonAuthClient as authClient } from '../auth/neonClient.js';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL || '';

export const NeonAuthTest: React.FC = () => {
  const [result, setResult] = useState<any>(null);

  const handleGoogleLogin = async () => {
    try {
      if (!authUrl) {
        setResult({ error: "VITE_NEON_AUTH_URL manquant dans l'environnement frontend (.env)." });
        return;
      }
      await authClient.signIn.social({ provider: "google" });
    } catch (e: any) {
      setResult({ error: e.message || "Erreur lors du login Google (Neon Auth)" });
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/neon-me');
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    }
  };

  const handleLogout = async () => {
    try {
      if (!authUrl) return;
      await authClient.signOut();
      setResult({ status: 'Déconnecté de Neon Auth avec succès.' });
    } catch (e: any) {
      setResult({ error: e.message });
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 font-sans">
      <h1 className="text-2xl font-bold">PoC Neon Auth (Étape B)</h1>
      <p className="text-gray-600 text-sm">
        Zone de test isolée pour valider le flux complet :<br/>
        Google → Neon Auth (Session) → Express (Mapping) → GIE TAIBA (RBAC).
      </p>
      
      {(!authUrl || authUrl === '') && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4">
          <p className="font-bold">Attention</p>
          <p>La variable VITE_NEON_AUTH_URL n'est pas définie. Assurez-vous de la configurer sur Render et dans votre .env local pour que le composant frontend sache où rediriger vers Neon Auth.</p>
        </div>
      )}

      <div className="flex gap-4">
        <button 
          onClick={handleGoogleLogin} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow transition-colors"
        >
          1. Connexion Google (Neon Auth)
        </button>
        <button 
          onClick={checkSession} 
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition-colors"
        >
          2. Vérifier le Bridge GIE TAIBA (/neon-me)
        </button>
        <button 
          onClick={handleLogout} 
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow transition-colors"
        >
          3. Déconnexion
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded-md shadow-inner min-h-[200px] overflow-auto">
        <h3 className="font-semibold mb-2 text-gray-700">Résultat JSON :</h3>
        <pre className="text-sm">
          {result ? JSON.stringify(result, null, 2) : "Cliquez sur un bouton pour voir le résultat."}
        </pre>
      </div>
    </div>
  );
};
