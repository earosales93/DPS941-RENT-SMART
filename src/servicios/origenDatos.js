/**
 * Registro del origen de los datos.
 *
 * La aplicación prefiere siempre Cloud Firestore. Cuando una lectura falla
 * porque el dispositivo está sin red o porque Firebase no está configurado,
 * el servicio devuelve los datos de demostración y avisa aquí; la pantalla
 * muestra entonces la franja de "modo sin conexión".
 *
 * La distinción importa: un error de permisos o una regla de seguridad que
 * rechaza la operación NO son fallos de red. Esos deben llegar a la pantalla
 * tal cual, porque ocultarlos tras datos de ejemplo haría creer al usuario
 * —y al desarrollador— que todo funciona.
 */

let enModoRespaldo = false;
const suscriptores = new Set();

/** Códigos de Firestore que sí justifican recurrir al respaldo. */
const CODIGOS_DE_RED = new Set([
  'unavailable',
  'deadline-exceeded',
  'failed-precondition',
  'cancelled',
]);

export function estaEnModoRespaldo() {
  return enModoRespaldo;
}

export function esFalloDeRed(error) {
  if (!error) return false;
  const codigo = String(error.code || '').replace('firestore/', '');
  if (CODIGOS_DE_RED.has(codigo)) return true;
  // Firebase sin configurar: la app debe seguir siendo navegable.
  return /no está configurado|Network request failed|client is offline/i.test(error.message || '');
}

function anunciar(valor) {
  if (enModoRespaldo === valor) return;
  enModoRespaldo = valor;
  suscriptores.forEach((fn) => {
    try {
      fn(valor);
    } catch (e) {
      console.warn('[origenDatos] suscriptor falló:', e);
    }
  });
}

/** Devuelve la función para cancelar la suscripción. */
export function alCambiarOrigen(callback) {
  suscriptores.add(callback);
  return () => suscriptores.delete(callback);
}

/**
 * Ejecuta una lectura de Firestore y, si falla por red, devuelve el respaldo.
 *
 *   const lista = await conRespaldo(
 *     () => getDocs(consulta),
 *     () => VEHICULOS
 *   );
 */
export async function conRespaldo(llamada, respaldo) {
  try {
    const datos = await llamada();
    anunciar(false);
    return datos;
  } catch (e) {
    if (esFalloDeRed(e)) {
      anunciar(true);
      return typeof respaldo === 'function' ? respaldo() : respaldo;
    }
    throw e;
  }
}

/** Solo para las pruebas: devuelve el registro a su estado inicial. */
export function reiniciarOrigen() {
  enModoRespaldo = false;
  suscriptores.clear();
}
