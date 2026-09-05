import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  QrCode,
  CreditCard,
  FileCheck,
  UserCheck,
  Phone,
  Plane,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { Inscription, Client, Voyage, VoyagePackage, Payment } from '../../types.js';
import { formatFCFA, formatDate, getPaymentStatusBadge } from '../../utils/format.js';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inscriptions: Inscription[];
  clients: Client[];
  voyages: Voyage[];
  packages: VoyagePackage[];
  onSelectInscription: (inscription: Inscription) => void;
  onNavigateToPayment: (clientId: string, inscriptionId: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  inscriptions,
  clients,
  voyages,
  packages,
  onSelectInscription,
  onNavigateToPayment,
}) => {
  const [mode, setMode] = useState<'CAMERA' | 'FILE' | 'MANUAL'>('CAMERA');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scannedResultCode, setScannedResultCode] = useState<string | null>(null);
  const [matchedInscription, setMatchedInscription] = useState<Inscription | null>(null);
  const [showBadgeQrPreview, setShowBadgeQrPreview] = useState(false);
  const [generatedQrMap, setGeneratedQrMap] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Generate QR code data URLs for sample quick-test inscriptions
  useEffect(() => {
    if (!isOpen) return;
    const generateQrs = async () => {
      const map: Record<string, string> = {};
      for (const ins of inscriptions.slice(0, 4)) {
        try {
          const qrData = JSON.stringify({
            code: ins.code,
            clientId: ins.clientId,
            clientName: ins.client ? `${ins.client.firstName} ${ins.client.lastName}` : '',
            voyageId: ins.voyageId,
          });
          const url = await QRCode.toDataURL(qrData, { width: 180, margin: 1 });
          map[ins.code] = url;
        } catch (err) {
          console.error(err);
        }
      }
      setGeneratedQrMap(map);
    };
    generateQrs();
  }, [isOpen, inscriptions]);

  // Lookup inscription by parsed string
  const handleLookupCode = (rawCode: string) => {
    let cleanCode = rawCode.trim();

    // If it's a JSON payload from a digital badge QR
    try {
      if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
        const parsed = JSON.parse(cleanCode);
        if (parsed.code) cleanCode = parsed.code;
      }
    } catch {
      // not json, proceed with raw text
    }

    setScannedResultCode(cleanCode);

    // Search by inscription code, client code, or client phone
    const found = inscriptions.find((ins) => {
      if (ins.code.toLowerCase() === cleanCode.toLowerCase()) return true;
      if (ins.id.toLowerCase() === cleanCode.toLowerCase()) return true;
      if (ins.client?.code?.toLowerCase() === cleanCode.toLowerCase()) return true;
      if (ins.client?.phone && ins.client.phone.includes(cleanCode)) return true;
      if (ins.client?.passportNumber && ins.client.passportNumber.toLowerCase() === cleanCode.toLowerCase()) return true;
      return false;
    });

    if (found) {
      setMatchedInscription(found);
      stopCamera();
    } else {
      setMatchedInscription(null);
    }
  };

  // Start video stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        scanFrame();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        'Impossible d’accéder à la caméra (autorisation refusée ou appareil indisponible). Vous pouvez importer une image ou utiliser la saisie express.'
      );
      setCameraActive(false);
      setMode('MANUAL');
    }
  };

  // Stop video stream
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Scan video frames with jsQR
  const scanFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            handleLookupCode(code.data);
            return; // stop scanning after successful read
          }
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  // Process uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleLookupCode(code.data);
          } else {
            alert('Aucun code QR détecté sur l’image importée. Veuillez essayer une photo plus nette.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Switch modes
  useEffect(() => {
    if (isOpen && mode === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  // Clean on close
  const handleClose = () => {
    stopCamera();
    setMatchedInscription(null);
    setScannedResultCode(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight">
                Vérification Express Pèlerin via QR Code
              </h3>
              <p className="text-[11px] text-slate-400">
                Scan instantané des badges d'inscription, fiches de versement ou cartes biométriques
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verification Result Card (When code is found) */}
        {matchedInscription ? (
          <div className="p-5 sm:p-6 space-y-4">
            {/* Header Success Banner */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    Pèlerin Certifié & Conforme
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                    {matchedInscription.code}
                  </span>
                </div>
                <h4 className="text-base font-black text-slate-900 mt-1">
                  {matchedInscription.client?.civility}{' '}
                  {matchedInscription.client?.firstName} {matchedInscription.client?.lastName}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Code Pèlerin :{' '}
                  <strong className="text-slate-800">{matchedInscription.client?.code}</strong> • N°
                  Passeport :{' '}
                  <strong className="text-slate-800">
                    {matchedInscription.client?.passportNumber || 'En cours'}
                  </strong>
                </p>
              </div>
            </div>

            {/* Campaign & Package Info */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Campagne & Vol</span>
                <span className="font-bold text-slate-900 text-right">
                  {matchedInscription.voyage?.title || 'Voyage Hajj'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Formule Souscrite</span>
                <span className="font-bold text-amber-800">
                  {matchedInscription.package?.name || 'Standard'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Statut Inscription</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {matchedInscription.status}
                </span>
              </div>

              {/* Financial Health */}
              <div className="pt-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-slate-700">Situation Caisse & Règlement</span>
                  {getPaymentStatusBadge(matchedInscription.paymentStatus)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Dû</span>
                    <span className="font-bold text-slate-900">
                      {formatFCFA(matchedInscription.totalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Encaissé</span>
                    <span className="font-bold text-emerald-700">
                      {formatFCFA(matchedInscription.paidAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Reste à Payer</span>
                    <span
                      className={`font-black ${
                        matchedInscription.remainingAmount > 0
                          ? 'text-rose-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {formatFCFA(matchedInscription.remainingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => {
                  onSelectInscription(matchedInscription);
                  handleClose();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>Ouvrir Fiche Inscription</span>
              </button>

              {matchedInscription.remainingAmount > 0 && (
                <button
                  onClick={() => {
                    onNavigateToPayment(matchedInscription.clientId, matchedInscription.id);
                    handleClose();
                  }}
                  className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Encaisser Solde</span>
                </button>
              )}

              <button
                onClick={() => {
                  setMatchedInscription(null);
                  setScannedResultCode(null);
                  setMode('CAMERA');
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Scanner un autre</span>
              </button>
            </div>
          </div>
        ) : (
          /* Scanning View (Modes) */
          <div className="p-5 sm:p-6 space-y-5">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setMode('CAMERA')}
                className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'CAMERA'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Caméra en Direct</span>
              </button>
              <button
                onClick={() => setMode('FILE')}
                className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'FILE'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer Image</span>
              </button>
              <button
                onClick={() => setMode('MANUAL')}
                className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'MANUAL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Saisie Rapide</span>
              </button>
            </div>

            {/* Mode 1: Live Camera Scanner */}
            {mode === 'CAMERA' && (
              <div className="space-y-3">
                <div className="relative w-full h-64 sm:h-72 bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Target Scanner Reticle Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-amber-400/80 rounded-2xl relative shadow-2xl">
                      {/* Corner Accents */}
                      <span className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl" />
                      <span className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr" />
                      <span className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl" />
                      <span className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br" />

                      {/* Laser scanning line */}
                      <div className="absolute left-2 right-2 h-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-bounce" />
                    </div>
                    <p className="text-[11px] text-amber-200/90 font-bold mt-4 bg-slate-950/70 px-3 py-1 rounded-full backdrop-blur-xs">
                      Pointez le QR code du pèlerin dans le cadre
                    </p>
                  </div>
                </div>

                {cameraError && (
                  <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <p>{cameraError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: File Upload Scanner */}
            {mode === 'FILE' && (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-56 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-amber-50/30"
                >
                  <Upload className="w-10 h-10 text-amber-600 mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    Cliquez pour choisir une photo ou capture du QR Code
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    PNG, JPG, JPEG ou badge numérisé
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Mode 3: Manual Code or Barcode Scanner Emulation */}
            {mode === 'MANUAL' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualCode) {
                        handleLookupCode(manualCode);
                      }
                    }}
                    placeholder="Ex : INS-2027-001 ou CLI-2027-001..."
                    className="flex-1 bg-slate-50 border border-slate-300 text-xs rounded-xl p-3 text-slate-900 focus:outline-hidden focus:border-amber-500 font-mono font-bold"
                  />
                  <button
                    onClick={() => manualCode && handleLookupCode(manualCode)}
                    className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Vérifier
                  </button>
                </div>
              </div>
            )}

            {/* Not found warning */}
            {scannedResultCode && !matchedInscription && (
              <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Aucun pèlerin trouvé pour le code : <strong>{scannedResultCode}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setScannedResultCode(null)}
                  className="text-rose-700 hover:underline font-bold text-[11px] cursor-pointer"
                >
                  Réessayer
                </button>
              </div>
            )}

            {/* One-click quick test chips for demonstration & testing */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600">
                  Simulation & Test Immédiat (Pèlerins Enregistrés) :
                </span>
                <button
                  onClick={() => setShowBadgeQrPreview(!showBadgeQrPreview)}
                  className="text-[11px] text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3 h-3" />
                  <span>{showBadgeQrPreview ? 'Masquer QR Badges' : 'Afficher QR Badges'}</span>
                </button>
              </div>

              {/* Quick Click Chips */}
              <div className="flex flex-wrap gap-1.5">
                {inscriptions.slice(0, 4).map((ins) => (
                  <button
                    key={ins.id}
                    onClick={() => handleLookupCode(ins.code)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3 h-3 text-amber-600" />
                    <span>
                      {ins.code} ({ins.client?.lastName})
                    </span>
                  </button>
                ))}
              </div>

              {/* Visual Digital Badge QR preview (Staff can scan with external phone or verify visually) */}
              {showBadgeQrPreview && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {inscriptions.slice(0, 4).map((ins) => (
                    <div
                      key={ins.id}
                      onClick={() => handleLookupCode(ins.code)}
                      className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs hover:border-amber-400 cursor-pointer transition-all flex flex-col items-center"
                    >
                      {generatedQrMap[ins.code] ? (
                        <img
                          src={generatedQrMap[ins.code]}
                          alt={`QR ${ins.code}`}
                          className="w-24 h-24 object-contain rounded"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-slate-100 animate-pulse rounded" />
                      )}
                      <span className="text-[10px] font-bold text-slate-900 mt-1 truncate max-w-full">
                        {ins.code}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate max-w-full">
                        {ins.client?.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
