/**
 * Perfil del usuario en Firestore.
 *
 * Firebase Authentication guarda credenciales, no datos de negocio: admite
 * displayName y photoURL, nada más. El DUI, el teléfono y el rol del usuario
 * viven en el documento `usuarios/{uid}` de Firestore, cuyo identificador es
 * el mismo uid que emite Authentication. Esa coincidencia es lo que permite
 * que las reglas de seguridad comparen `request.auth.uid` con el documento.
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { obtenerDb, COLECCIONES } from '../firebase/configuracion';

function referencia(uid) {
  return doc(obtenerDb(), COLECCIONES.usuarios, uid);
}

export const PerfilService = {
  async obtener(uid) {
    const instantanea = await getDoc(referencia(uid));
    return instantanea.exists() ? { uid, ...instantanea.data() } : null;
  },

  /**
   * Crea el documento solo si no existía. Se llama en el registro y también
   * en cada acceso con Google, porque ahí no hay un paso de registro previo.
   */
  async crearSiNoExiste(usuarioFirebase, datos = {}) {
    const ref = referencia(usuarioFirebase.uid);
    const instantanea = await getDoc(ref);
    if (instantanea.exists()) return { uid: usuarioFirebase.uid, ...instantanea.data() };

    const perfil = {
      nombre: datos.nombre || usuarioFirebase.displayName || usuarioFirebase.email,
      email: usuarioFirebase.email,
      documento: datos.documento || '',
      telefono: datos.telefono || '',
      direccion: datos.direccion || '',
      rol: 'cliente',
      proveedor: usuarioFirebase.providerData?.[0]?.providerId || 'password',
      creadoEn: serverTimestamp(),
    };

    await setDoc(ref, perfil);
    return { uid: usuarioFirebase.uid, ...perfil };
  },

  async actualizar(uid, cambios) {
    await updateDoc(referencia(uid), { ...cambios, actualizadoEn: serverTimestamp() });
    return this.obtener(uid);
  },
};

export default PerfilService;
