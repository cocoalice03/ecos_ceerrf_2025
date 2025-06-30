import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Configuration Firebase directement définie ici
// En production, il serait préférable d'utiliser des variables d'environnement
const firebaseConfig = {
  apiKey: "AIzaSyA880kh-hCSEApiFX5gAnr-B25Q5ZM-NE0",
  authDomain: "sqltry-d4ebb.firebaseapp.com",
  databaseURL: "https://sqltry-d4ebb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sqltry-d4ebb",
  storageBucket: "sqltry-d4ebb.firebasestorage.app",
  messagingSenderId: "472326334906",
  appId: "1:472326334906:web:43e734faf2ffcd0e395583",
  measurementId: "G-G9Y5PML2RJ"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser Firestore
export const db = getFirestore(app);

// Initialiser Analytics (uniquement côté client)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;
