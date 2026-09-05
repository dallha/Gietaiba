import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase Admin
if (!getApps().length) {
  const configRaw = fs.readFileSync('./firebase-applet-config.json', 'utf8');
  const config = JSON.parse(configRaw);
  initializeApp({
    projectId: config.projectId,
    // Optional: database URL or other settings if needed
  });
}

export const adminDb = getFirestore();
