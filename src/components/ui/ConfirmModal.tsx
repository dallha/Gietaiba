import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Oui, supprimer définitivement',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  type = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className={`flex items-center gap-3 mb-4 ${type === 'danger' ? 'text-red-600' : 'text-amber-600'}`}>
            <div className={`p-3 rounded-full ${type === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
              {type === 'danger' ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <h3 className="text-lg font-black">{title}</h3>
          </div>
          <div className="text-sm text-slate-600 mb-6">
            {message}
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer text-sm disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg font-bold transition-colors cursor-pointer text-sm shadow-sm disabled:opacity-50 ${
                type === 'danger' 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {isLoading ? 'En cours...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
