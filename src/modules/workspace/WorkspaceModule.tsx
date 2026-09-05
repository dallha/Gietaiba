import React, { useState } from 'react';
import { FileSpreadsheet, FileText, CheckSquare, FileInput, Plus, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { exportToSheets, createDocument, createTask, createForm } from '../../services/workspace.service';
import { useAuth } from '../../auth/AuthContext';

export const WorkspaceModule = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExportSheets = async () => {
    setLoading('sheets');
    setError(null);
    setSuccess(null);
    try {
      const csv = 'Name,Role,Status\nJohn Doe,Admin,Active\nJane Smith,Agent,Active';
      const res = await exportToSheets(`Rapport ERP - ${new Date().toLocaleDateString()}`, csv);
      setSuccess(`Tableur Sheets créé : ${res.name}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCreateDoc = async () => {
    setLoading('docs');
    setError(null);
    setSuccess(null);
    try {
      const res = await createDocument(`Note ERP - ${new Date().toLocaleDateString()}`, "Voici une note générée automatiquement depuis l'ERP GIE TAIBA VOYAGES.");
      setSuccess(`Document Docs créé : ${res.title}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCreateTask = async () => {
    setLoading('tasks');
    setError(null);
    setSuccess(null);
    try {
      const res = await createTask(`Tâche de vérification ERP`, `Vérifier les inscriptions en attente.`);
      setSuccess(`Tâche Tasks créée : ${res.title}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCreateForm = async () => {
    setLoading('forms');
    setError(null);
    setSuccess(null);
    try {
      const res = await createForm(`Formulaire de satisfaction pèlerins`);
      setSuccess(`Formulaire Forms créé : ${res.info.title}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          Intégrations Google Workspace
        </h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl flex items-start gap-3 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Sheets */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Google Sheets</h3>
                <p className="text-xs text-slate-500">Exporter les données vers un tableur</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleExportSheets}
            disabled={loading !== null}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            {loading === 'sheets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Générer un rapport CSV
          </button>
        </div>

        {/* Google Docs */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Google Docs</h3>
                <p className="text-xs text-slate-500">Générer une note ou un courrier</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleCreateDoc}
            disabled={loading !== null}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            {loading === 'docs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer un document
          </button>
        </div>

        {/* Google Tasks */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Google Tasks</h3>
                <p className="text-xs text-slate-500">Créer une tâche de suivi</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleCreateTask}
            disabled={loading !== null}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            {loading === 'tasks' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter une tâche
          </button>
        </div>

        {/* Google Forms */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <FileInput className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Google Forms</h3>
                <p className="text-xs text-slate-500">Générer un formulaire d'évaluation</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleCreateForm}
            disabled={loading !== null}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            {loading === 'forms' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer un formulaire
          </button>
        </div>
      </div>
    </div>
  );
};
