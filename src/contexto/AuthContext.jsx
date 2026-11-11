/**
 * Estado global de sesión.
 *
 * Context API + useReducer, igual que la versión web. Lo que cambia respecto
 * de la entrega anterior es el origen de la verdad: ya no se guarda la sesión
 * a mano en AsyncStorage, sino que se escucha a Firebase con
 * `onAuthStateChanged`. Firebase persiste la sesión, renueva el token cuando
 * vence y avisa aquí en cada cambio. Eso elimina la posibilidad de que la app
 * crea que hay sesión cuando el servidor ya la invalidó.
 */

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';

import AuthService, { mapearUsuario } from '../servicios/authService';
import PerfilService from '../servicios/perfilService';
import { firebaseConfigurado } from '../firebase/configuracion';

const ESTADO_INICIAL = {
  usuario: null,       // forma propia de la app, no el objeto de Firebase
  perfil: null,        // documento usuarios/{uid} de Firestore
  cargando: true,      // true hasta que Firebase informa el primer estado
  error: null,
};

function reductor(estado, accion) {
  switch (accion.tipo) {
    case 'SESION':
      return {
        usuario: accion.usuario,
        perfil: accion.perfil ?? null,
        cargando: false,
        error: null,
      };
    case 'SIN_SESION':
      return { usuario: null, perfil: null, cargando: false, error: null };
    case 'ERROR':
      return { ...estado, cargando: false, error: accion.error };
    case 'PERFIL':
      return { ...estado, perfil: { ...estado.perfil, ...accion.cambios } };
    default:
      return estado;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [estado, despachar] = useReducer(reductor, ESTADO_INICIAL);
  const [configurado] = useState(() => firebaseConfigurado());

  useEffect(() => {
    if (!configurado) {
      despachar({
        tipo: 'ERROR',
        error:
          'Firebase no está configurado. Copia .env.example como .env y completa las variables EXPO_PUBLIC_FIREBASE_*.',
      });
      return undefined;
    }

    // Firebase devuelve la función para cancelar la suscripción.
    const cancelar = AuthService.observarSesion(async (usuarioFirebase) => {
      if (!usuarioFirebase) {
        despachar({ tipo: 'SIN_SESION' });
        return;
      }

      let perfil = null;
      try {
        perfil = await PerfilService.obtener(usuarioFirebase.uid);
        // Un usuario puede existir en Authentication sin documento de perfil
        // si se creó desde la consola; se repara aquí en silencio.
        if (!perfil) perfil = await PerfilService.crearSiNoExiste(usuarioFirebase);
      } catch (e) {
        console.warn('[AuthContext] no se pudo leer el perfil:', e.message);
      }

      despachar({
        tipo: 'SESION',
        usuario: mapearUsuario(usuarioFirebase, perfil),
        perfil,
      });
    });

    return cancelar;
  }, [configurado]);

  const valor = useMemo(
    () => ({
      ...estado,
      configurado,
      autenticado: Boolean(estado.usuario),
      uid: estado.usuario?.uid ?? null,
      rol: estado.usuario?.rol ?? null,

      // Estas funciones no navegan ni actualizan el estado: solo piden el
      // cambio a Firebase. Quien actualiza el estado es el observador de
      // arriba, de modo que hay una sola ruta de entrada y de salida.
      iniciarSesion: (credenciales) => AuthService.iniciarSesion(credenciales),
      registrar: (formulario) => AuthService.registrar(formulario),
      cerrarSesion: () => AuthService.cerrarSesion(),
      recuperar: (email) => AuthService.recuperar(email),

      async actualizarPerfil(cambios) {
        if (!estado.usuario) return null;
        const perfil = await PerfilService.actualizar(estado.usuario.uid, cambios);
        despachar({ tipo: 'PERFIL', cambios });
        return perfil;
      },
    }),
    [estado, configurado]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return contexto;
}

export default AuthContext;
