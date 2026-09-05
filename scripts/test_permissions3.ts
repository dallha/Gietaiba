import { initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp as initClientApp } from 'firebase/app';
import { getAuth as getClientAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFile } from 'fs/promises';

async function main() {
  const config = JSON.parse(await readFile('./firebase-applet-config.json', 'utf8'));
  const adminApp = initAdminApp({ projectId: config.projectId });
  const adminAuth = getAdminAuth(adminApp);
  
  const user = await adminAuth.getUserByEmail('mr.niass@gmail.com');
  const customToken = await adminAuth.createCustomToken(user.uid);
  
  const clientApp = initClientApp(config);
  const clientAuth = getClientAuth(clientApp);
  const clientDb = getFirestore(clientApp);
  
  await signInWithCustomToken(clientAuth, customToken);
  console.log("Signed in successfully as client!");
  
  try {
    await getDocs(collection(clientDb, 'users'));
    console.log("Read users successfully!");
  } catch(e) {
    console.error("Failed to read users:", e);
  }
  
  try {
    await getDocs(collection(clientDb, 'roles'));
    console.log("Read roles successfully!");
  } catch(e) {
    console.error("Failed to read roles:", e);
  }

  try {
    await getDocs(collection(clientDb, 'clients'));
    console.log("Read clients successfully!");
  } catch(e) {
    console.error("Failed to read clients:", e);
  }

  try {
    await getDocs(collection(clientDb, 'inscriptions'));
    console.log("Read inscriptions successfully!");
  } catch(e) {
    console.error("Failed to read inscriptions:", e);
  }
}
main().catch(console.error);
