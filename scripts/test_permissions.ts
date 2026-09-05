import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'fs/promises';

// We want to test client-side permissions, so we need to use the client SDK, not admin!
