/**
 * Servicio de autenticación sobre Firebase Authentication.
 *
 * Sustituye al esquema de la entrega anterior, donde la contraseña viajaba en
 * texto plano contra un API propio y el token era un objeto codificado en
 * base64 sin firma. Firebase guarda las contraseñas con `scrypt` del lado del
 * servidor y emite tokens JWT firmados y con vencimiento, que las reglas de
 * Firestore verifican en cada operación (Google, 2025a).
 *
 * Las pantallas no importan nada de 'firebase/auth': llaman a este servicio,
 * igual que antes llamaban al apiClient.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from 'firebase/auth';

import { obtenerAuth } from '../firebase/configuracion';
import PerfilService from './perfilService';

/**
 * Traduce los códigos de Firebase a mensajes que una persona entiende.
 * Firebase responde en inglés y con códigos técnicos; mostrarlos tal cual
 * en la pantalla sería trasladarle al usuario un problema que no es suyo.
 */
const MENSAJES = {
  'auth/invalid-email': 'El correo no tiene un formato válido.',
  'auth/user-disabled': 'La cuenta está desactivada. Contacta al administrador.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta registrada con este correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos.',
  'auth/network-request-failed': 'No hay conexión con Firebase. Revisa tu red.',
  'auth/operation-not-allowed': 'El método de acceso no está habilitado en la consola de Firebase.',
  'auth/account-exists-with-different-credential':
    'Ese correo ya está registrado con otro método de acceso.',
};

export class ErrorAuth extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorAuth';
    this.codigo = codigo;
  }
}

export function traducirError(error) {
  const codigo = error?.code || 'desconocido';
  const mensaje = MENSAJES[codigo] || 'No se pudo completar la operación. Inténtalo de nuevo.';
  return new ErrorAuth(codigo, mensaje);
}

/** Forma del usuario que consumen las pantallas, independiente de Firebase. */
export function mapearUsuario(usuarioFirebase, perfil = null) {
  if (!usuarioFirebase) return null;
  return {
    uid: usuarioFirebase.uid,
    email: usuarioFirebase.email,
    nombre: perfil?.nombre || usuarioFirebase.displayName || usuarioFirebase.email,
    foto: usuarioFirebase.photoURL || null,
    proveedor: usuarioFirebase.providerData?.[0]?.providerId || 'password',
    correoVerificado: usuarioFirebase.emailVerified,
    rol: perfil?.rol || 'cliente',
  };
}

export const AuthService = {
  /** Observador de sesión: Firebase avisa al entrar, salir y al renovar el token. */
  observarSesion(callback) {
    return onAuthStateChanged(obtenerAuth(), callback);
  },

  async iniciarSesion({ email, password }) {
    try {
      const credencial = await signInWithEmailAndPassword(
        obtenerAuth(),
        String(email).trim().toLowerCase(),
        password
      );
      return credencial.user;
    } catch (e) {
      throw traducirError(e);
    }
  },

  async registrar({ nombre, email, password, documento, telefono }) {
    try {
      const credencial = await createUserWithEmailAndPassword(
        obtenerAuth(),
        String(email).trim().toLowerCase(),
        password
      );

      // displayName se guarda en el propio usuario de Authentication; el resto
      // del perfil (DUI, teléfono) vive en Firestore, que sí admite campos libres.
      await updateProfile(credencial.user, { displayName: String(nombre).trim() });

      await PerfilService.crearSiNoExiste(credencial.user, {
        nombre: String(nombre).trim(),
        documento: String(documento || '').trim(),
        telefono: String(telefono || '').trim(),
      });

      return credencial.user;
    } catch (e) {
      throw traducirError(e);
    }
  },

  /**
   * Acceso con Google. Recibe el id_token que devuelve expo-auth-session y lo
   * intercambia por una sesión de Firebase. El flujo de obtención del token
   * vive en `src/servicios/googleAuth.js` porque depende de hooks de React.
   */
  async iniciarSesionConGoogle(idToken) {
    try {
      const credencial = GoogleAuthProvider.credential(idToken);
      const resultado = await signInWithCredential(obtenerAuth(), credencial);

      // La primera vez que entra por Google no existe su documento de perfil.
      await PerfilService.crearSiNoExiste(resultado.user, {
        nombre: resultado.user.displayName || resultado.user.email,
      });

      return resultado.user;
    } catch (e) {
      throw traducirError(e);
    }
  },

  async recuperar(email) {
    try {
      await sendPasswordResetEmail(obtenerAuth(), String(email).trim().toLowerCase());
      return true;
    } catch (e) {
      // No se revela si el correo existe: decirlo permitiría averiguar
      // qué cuentas están registradas en el sistema.
      if (e?.code === 'auth/user-not-found') return true;
      throw traducirError(e);
    }
  },

  async cerrarSesion() {
    try {
      await signOut(obtenerAuth());
    } catch (e) {
      throw traducirError(e);
    }
  },

  usuarioActual() {
    return obtenerAuth().currentUser;
  },
};

export default AuthService;
