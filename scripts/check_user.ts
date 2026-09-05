import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'fs/promises';

async function main() {
  const firebaseConfig = JSON.parse(await readFile('./firebase-applet-config.json', 'utf8'));
  const app = initializeApp({
    projectId: firebaseConfig.projectId
  });
  const db = getFirestore(app);
  db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
  const auth = getAuth(app);

  try {
    const user = await auth.getUserByEmail('mr.niass@gmail.com');
    console.log('Auth User UID:', user.uid);
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      console.log('User Document:', doc.data());
    } else {
      console.log('User document does not exist.');
    }
  } catch (e) {
    console.error(e);
  }
}

main().catch(console.error);
