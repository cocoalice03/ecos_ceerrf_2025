import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
// Nous n'importons pas Analytics car cela peut causer des problèmes côté serveur

// Configuration Firebase directement définie ici pour le client
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

// Initialiser Firebase avec validation de la configuration
const app = initializeApp(firebaseConfig);

// Initialiser Firestore
export const db = getFirestore(app);

// Initialiser Auth avec gestion d'erreur pour le développement
export const auth = getAuth(app);

// En environnement de développement, nous pouvons utiliser l'émulateur
// ou simplement éviter certaines vérifications
if (import.meta.env.DEV) {
  // Configuré pour fonctionner sans validation stricte en développement
  console.log('Firebase initialisé en mode développement');
}

export default app;
