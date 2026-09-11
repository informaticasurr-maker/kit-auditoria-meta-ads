/**
 * Módulo de Conexión Independiente de Firebase
 * Proyecto: agente-url
 * Soporta: Auth (Google), Firestore Database, Cloud Storage y Analytics
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadString, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { 
  getAnalytics, 
  isSupported as isAnalyticsSupported, 
  logEvent 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";

// Configuración oficial de Firebase del proyecto agente-url
export const firebaseConfig = {
  apiKey: "AIzaSyD7W9hgErncObvWBqmLqNQdWi9REij77sw",
  authDomain: "agente-url.firebaseapp.com",
  projectId: "agente-url",
  storageBucket: "agente-url.firebasestorage.app",
  messagingSenderId: "15831139768",
  appId: "1:15831139768:web:c2c61719a2791ec072fb4d"
};

// 1. Inicialización de la App Firebase
export const app = initializeApp(firebaseConfig);

// 2. Servicios de Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 3. Analytics (con detección de compatibilidad)
export let analytics = null;
isAnalyticsSupported().then(supported => {
  if (supported) {
    try {
      analytics = getAnalytics(app);
      console.log('📊 Firebase Analytics inicializado correctamente.');
    } catch (e) {
      console.warn('⚠️ No se pudo inicializar Analytics:', e.message);
    }
  }
}).catch(() => {});

/**
 * Iniciar sesión con Google Popup
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (analytics) {
      try { logEvent(analytics, 'login', { method: 'Google' }); } catch (e) {}
    }
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Error al iniciar sesión con Google:', error);

    let userFriendlyMessage = error.message;
    const code = error.code || '';

    if (code === 'auth/operation-not-allowed') {
      userFriendlyMessage = 'El proveedor de inicio de sesión con Google no está activado en tu Firebase Console. Debes ir a Firebase Console -> Build -> Authentication -> Sign-in method y habilitar "Google".';
    } else if (code === 'auth/unauthorized-domain') {
      userFriendlyMessage = 'Este dominio (localhost) no está en la lista de dominios autorizados de Firebase. Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade "localhost".';
    } else if (code === 'auth/popup-blocked') {
      userFriendlyMessage = 'El navegador bloqueó la ventana emergente de Google. Haz clic en el ícono de la barra de direcciones para permitir ventanas emergentes.';
    } else if (code === 'auth/popup-closed-by-user') {
      userFriendlyMessage = 'Has cerrado la ventana de inicio de sesión de Google antes de finalizar.';
    } else if (code === 'auth/network-request-failed') {
      userFriendlyMessage = 'Error de conexión con los servidores de Google/Firebase. Revisa tu conexión a internet.';
    }

    return { 
      success: false, 
      code: error.code, 
      error: userFriendlyMessage,
      rawError: error.message 
    };
  }
}

/**
 * Cerrar sesión de Firebase
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Escuchar cambios en el estado de autenticación
 */
export function onUserChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Obtener usuario autenticado actual
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Guardar una auditoría en Firestore y opcionalmente subir HTML a Storage
 */
export async function saveAuditToCloud({ businessName, landingUrl, provider, html, reportUrl, score, metadata = {} }) {
  try {
    const user = auth.currentUser;
    const reportId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let storageUrl = null;

    // Subir archivo HTML a Firebase Storage si existe contenido
    if (html && storage) {
      try {
        const storageRef = ref(storage, `reportes/${user ? user.uid : 'public'}/${reportId}.html`);
        await uploadString(storageRef, html, 'raw', {
          contentType: 'text/html; charset=utf-8'
        });
        storageUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn('Storage no disponible o sin permisos, continuando con Firestore:', storageErr.message);
      }
    }

    // Guardar documento en colección 'auditorias' en Firestore
    const docData = {
      businessName: businessName || 'Auditoría Meta Ads',
      landingUrl: landingUrl || '',
      provider: provider || 'offline',
      score: score || 0,
      reportUrl: storageUrl || reportUrl || '',
      storageUrl: storageUrl || null,
      userId: user ? user.uid : 'anonimo',
      userEmail: user ? user.email : null,
      userName: user ? user.displayName : 'Anónimo',
      userPhoto: user ? user.photoURL : null,
      createdAt: serverTimestamp(),
      createdDate: new Date().toLocaleString(),
      metadata: metadata || {}
    };

    const docRef = await addDoc(collection(db, 'auditorias'), docData);

    if (analytics) {
      logEvent(analytics, 'audit_saved_cloud', { businessName, provider });
    }

    return { 
      success: true, 
      id: docRef.id, 
      storageUrl,
      message: 'Auditoría guardada exitosamente en Firestore / Cloud Storage' 
    };
  } catch (error) {
    console.error('Error al guardar en Firestore:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtener las auditorías guardadas en la nube (Firestore)
 */
export async function getCloudAudits() {
  try {
    const user = auth.currentUser;
    const auditsRef = collection(db, 'auditorias');
    const q = query(auditsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const audits = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      audits.push({
        id: docSnap.id,
        ...data,
        createdAtFormatted: data.createdDate || 'Reciente'
      });
    });

    return { success: true, audits };
  } catch (error) {
    console.error('Error al obtener auditorías de Firestore:', error);
    return { success: false, error: error.message, audits: [] };
  }
}

/**
 * Eliminar una auditoría de Firestore
 */
export async function deleteCloudAudit(auditId) {
  try {
    await deleteDoc(doc(db, 'auditorias', auditId));
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar auditoría en Firestore:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registrar evento personalizado en Analytics
 */
export function trackCustomEvent(eventName, params = {}) {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
    } catch (e) {
      console.warn('Analytics event error:', e);
    }
  }
}
