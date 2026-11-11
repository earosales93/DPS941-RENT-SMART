/**
 * Acceso con Google.
 *
 * Firebase no puede abrir por sí mismo la pantalla de consentimiento de Google
 * en React Native: eso corresponde al sistema operativo. El flujo es:
 *
 *   1. expo-auth-session abre el navegador del sistema en la URL de Google.
 *   2. El usuario elige su cuenta y Google devuelve un id_token.
 *   3. Ese id_token se cambia por una sesión de Firebase (authService).
 *
 * Si no se han configurado los identificadores de cliente OAuth, el hook
 * devuelve `disponible: false` y la pantalla oculta el botón en lugar de
 * ofrecer una acción que fallaría.
 */

import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import AuthService from './authService';

// Cierra la ventana del navegador en cuanto Google redirige de vuelta.
WebBrowser.maybeCompleteAuthSession();

const IDS = {
  // Usado por Expo Go y por la versión web.
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

export function googleConfigurado() {
  return Boolean(IDS.webClientId || IDS.androidClientId || IDS.iosClientId);
}

/**
 * Devuelve { disponible, entrando, error, entrarConGoogle }.
 * La pantalla solo necesita llamar a entrarConGoogle().
 */
export function useGoogleSignIn() {
  const disponible = googleConfigurado();

  // El hook debe invocarse siempre, aunque no haya configuración: las reglas
  // de los hooks prohíben llamadas condicionales.
  const [peticion, respuesta, pedirAcceso] = Google.useIdTokenAuthRequest(
    disponible ? IDS : { webClientId: 'sin-configurar' }
  );

  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!respuesta) return;

    if (respuesta.type === 'dismiss' || respuesta.type === 'cancel') {
      setEntrando(false);
      return;
    }

    if (respuesta.type === 'error') {
      setEntrando(false);
      setError('No se pudo completar el acceso con Google.');
      return;
    }

    if (respuesta.type === 'success') {
      const idToken = respuesta.params?.id_token || respuesta.authentication?.idToken;
      if (!idToken) {
        setEntrando(false);
        setError('Google no devolvió un token de identidad.');
        return;
      }

      (async () => {
        try {
          await AuthService.iniciarSesionConGoogle(idToken);
          // El observador de sesión del AuthContext se encarga de navegar.
        } catch (e) {
          setError(e.message);
        } finally {
          setEntrando(false);
        }
      })();
    }
  }, [respuesta]);

  const entrarConGoogle = async () => {
    if (!disponible || !peticion) return;
    setError(null);
    setEntrando(true);
    try {
      await pedirAcceso();
    } catch {
      setEntrando(false);
      setError('No se pudo abrir la ventana de Google.');
    }
  };

  return { disponible: disponible && Boolean(peticion), entrando, error, entrarConGoogle };
}

export default useGoogleSignIn;
