import React from 'react';
import { 
  FileCheck2, 
  Download, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { PilgrimDocument } from '../../types.js';
import { formatDate } from '../../utils/format.js';

interface PilgrimDocumentsViewProps {
  documents: PilgrimDocument[];
}

export const PilgrimDocumentsView: React.FC<PilgrimDocumentsViewProps> = ({
  documents,
}) => {
  // Absolute Security Gate: Strictly filter only documents with isClientVisible === true
  const visibleDocs = documents.filter(d => d.isClientVisible === true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-emerald-700" />
            <span>Mes Documents & Pièces Officielles</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consultez les pièces administratives validées et transmises par l'agence pour votre voyage
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Espace GED Sécurisé Pèlerin</span>
        </div>
      </div>

      {visibleDocs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Aucun document publié pour le moment</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Les documents validés par l'administration (passeport certifié, attestation d'inscription, visa officiel, convocation de vol) s'afficheront ici au fur et à mesure.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDocs.map((doc) => {
            const isValid = doc.status === 'VALIDE' || doc.status === 'VALIDATED';
            const isRejected = doc.status === 'REJETE' || doc.status === 'REJECTED';

            return (
              <div 
                key={doc.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${
                      isValid 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : isRejected 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isValid ? <CheckCircle className="w-3 h-3" /> : isRejected ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {doc.status || 'EN COURS'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1">
                      {doc.name || doc.type}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase">
                      Type : {doc.type}
                    </p>
                    {doc.createdAt && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Ajouté le : {formatDate(doc.createdAt)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Visible Pèlerin
                  </span>

                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-2xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>Télécharger</span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Fichier en traitement</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
