import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Este arquivo será preenchido com as credenciais reais do seu projeto Firebase.
// Se você estiver usando o Netlify, você pode criar um arquivo firebase-applet-config.json
// ou substituir os valores abaixo diretamente.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBiA8ygjyeERn4TkZjXUKRHI-v6FGiP7zk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nexus-tutoriais.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nexus-tutoriais",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nexus-tutoriais.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "589431918257",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:589431918257:web:1832877e3b49d886d81c90"
};

// No ambiente do AI Studio, o arquivo firebase-applet-config.json é injetado.
// Para evitar erros de compilação quando o arquivo não existe localmente,
// usamos uma abordagem mais segura ou o usuário preenche o objeto acima.
async function getFirebaseConfig() {
  let finalConfig = firebaseConfig;
  try {
    // @ts-ignore
    const configJson = await import('../firebase-applet-config.json');
    if (configJson && configJson.default) {
      finalConfig = configJson.default;
    }
  } catch (e) {
    // Fallback para a config manual
  }
  return finalConfig;
}

const finalConfig = await getFirebaseConfig();
const app = initializeApp(finalConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
