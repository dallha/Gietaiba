import { Client, Inscription, Payment, PilgrimDocument, Visa, Flight, Hotel, Room, VoyagePackage } from '../../types.js';

export type PilgrimTab = 
  | 'accueil'
  | 'voyages'
  | 'dossier'
  | 'documents'
  | 'finances'
  | 'logistique'
  | 'badge'
  | 'profil'
  | 'notifications';

export interface PilgrimDossierProgress {
  dossierComplete: boolean;
  documentsComplete: boolean;
  documentsRatio: { validated: number; total: number };
  visaComplete: boolean;
  flightComplete: boolean;
  hotelComplete: boolean;
  financeComplete: boolean;
  readyForDeparture: boolean;
  overallPercentage: number;
}


