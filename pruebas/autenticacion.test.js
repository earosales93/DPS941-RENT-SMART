/**
 * Pruebas del servicio de autenticación.
 *
 * Firebase se sustituye por dobles de prueba: lo que se verifica no es que
 * Firebase funcione —de eso responde Google— sino que nuestro servicio le
 * pase los datos correctos y traduzca sus respuestas como corresponde.
 */

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithCredential: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updateProfile: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn((token) => ({ token })) },
}));

jest.mock('../src/firebase/configuracion', () => ({
  obtenerAuth: jest.fn(() => ({ nombre: 'auth-de-prueba' })),
  obtenerDb: jest.fn(),
  COLECCIONES: { usuarios: 'usuarios', vehiculos: 'vehiculos', reservas: 'reservas', actividad: 'actividad' },
  firebaseConfigurado: jest.fn(() => true),
}));

jest.mock('../src/servicios/perfilService', () => ({
  __esModule: true,
  default: { crearSiNoExiste: jest.fn(async () => ({ uid: 'uid-1', rol: 'cliente' })) },
}));

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
} from 'firebase/auth';

import AuthService, { traducirError, mapearUsuario, ErrorAuth } from '../src/servicios/authService';
import PerfilService from '../src/servicios/perfilService';

const usuarioFalso = {
  uid: 'uid-1',
  email: 'erick@rentsmart.com',
  displayName: 'Erick Rosales',
  photoURL: null,
  emailVerified: false,
  providerData: [{ providerId: 'password' }],
};

beforeEach(() => jest.clearAllMocks());

describe('iniciarSesion', () => {
  test('normaliza el correo a minúsculas y sin espacios', async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: usuarioFalso });

    await AuthService.iniciarSesion({ email: '  Erick@RentSmart.com ', password: 'Clave2026' });

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(), 'erick@rentsmart.com', 'Clave2026'
    );
  });

  test('devuelve el usuario cuando las credenciales son correctas', async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: usuarioFalso });
    await expect(AuthService.iniciarSesion({ email: 'a@b.sv', password: 'x' }))
      .resolves.toBe(usuarioFalso);
  });

  test('traduce la credencial inválida a un mensaje en español', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-credential' });

    await expect(AuthService.iniciarSesion({ email: 'a@b.sv', password: 'mala' }))
      .rejects.toThrow('Correo o contraseña incorrectos.');
  });

  test('no revela si el fallo fue del correo o de la contraseña', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/user-not-found' });
    const noExiste = await AuthService.iniciarSesion({ email: 'a@b.sv', password: 'x' }).catch((e) => e.message);

    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });
    const claveMala = await AuthService.iniciarSesion({ email: 'a@b.sv', password: 'x' }).catch((e) => e.message);

    expect(noExiste).toBe(claveMala);
  });
});

describe('registrar', () => {
  test('crea la cuenta, guarda el nombre y crea el perfil en Firestore', async () => {
    createUserWithEmailAndPassword.mockResolvedValue({ user: usuarioFalso });

    await AuthService.registrar({
      nombre: '  Erick Rosales ',
      email: 'Erick@RentSmart.com',
      password: 'Clave2026',
      documento: '01234567-8',
      telefono: '7777-7777',
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(), 'erick@rentsmart.com', 'Clave2026'
    );
    expect(updateProfile).toHaveBeenCalledWith(usuarioFalso, { displayName: 'Erick Rosales' });
    expect(PerfilService.crearSiNoExiste).toHaveBeenCalledWith(
      usuarioFalso,
      expect.objectContaining({ documento: '01234567-8', telefono: '7777-7777' })
    );
  });

  test('informa cuando el correo ya está registrado', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });

    await expect(AuthService.registrar({ nombre: 'X', email: 'a@b.sv', password: 'Clave2026' }))
      .rejects.toThrow('Ya existe una cuenta registrada con este correo.');
  });
});

describe('iniciarSesionConGoogle', () => {
  test('convierte el id_token en credencial y abre sesión', async () => {
    const usuarioGoogle = { ...usuarioFalso, providerData: [{ providerId: 'google.com' }] };
    signInWithCredential.mockResolvedValue({ user: usuarioGoogle });

    await AuthService.iniciarSesionConGoogle('token-de-google');

    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('token-de-google');
    expect(signInWithCredential).toHaveBeenCalled();
    // La primera vez que entra por Google no hay registro previo: el perfil
    // debe crearse en ese momento.
    expect(PerfilService.crearSiNoExiste).toHaveBeenCalledWith(
      usuarioGoogle, expect.objectContaining({ nombre: 'Erick Rosales' })
    );
  });

  test('traduce el conflicto de proveedores', async () => {
    signInWithCredential.mockRejectedValue({ code: 'auth/account-exists-with-different-credential' });

    await expect(AuthService.iniciarSesionConGoogle('token'))
      .rejects.toThrow('Ese correo ya está registrado con otro método de acceso.');
  });
});

describe('recuperar contraseña', () => {
  test('envía el correo de restablecimiento', async () => {
    sendPasswordResetEmail.mockResolvedValue(undefined);
    await expect(AuthService.recuperar('Erick@RentSmart.com ')).resolves.toBe(true);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'erick@rentsmart.com');
  });

  test('responde igual aunque el correo no exista, para no filtrar cuentas', async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    await expect(AuthService.recuperar('nadie@rentsmart.com')).resolves.toBe(true);
  });

  test('sí propaga un fallo de red', async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(AuthService.recuperar('a@b.sv')).rejects.toThrow('No hay conexión con Firebase. Revisa tu red.');
  });
});

describe('traducirError', () => {
  test('devuelve un ErrorAuth con el código original', () => {
    const error = traducirError({ code: 'auth/too-many-requests' });
    expect(error).toBeInstanceOf(ErrorAuth);
    expect(error.codigo).toBe('auth/too-many-requests');
    expect(error.message).toMatch(/Demasiados intentos/);
  });

  test('tiene un mensaje por defecto para códigos desconocidos', () => {
    expect(traducirError({ code: 'auth/algo-nuevo' }).message)
      .toBe('No se pudo completar la operación. Inténtalo de nuevo.');
  });
});

describe('mapearUsuario', () => {
  test('null si no hay sesión', () => {
    expect(mapearUsuario(null)).toBeNull();
  });

  test('usa el nombre del perfil de Firestore por encima del displayName', () => {
    const u = mapearUsuario(usuarioFalso, { nombre: 'Erick A. Rosales', rol: 'administrador' });
    expect(u.nombre).toBe('Erick A. Rosales');
    expect(u.rol).toBe('administrador');
  });

  test('cae al displayName y luego al correo si no hay perfil', () => {
    expect(mapearUsuario(usuarioFalso).nombre).toBe('Erick Rosales');
    expect(mapearUsuario({ ...usuarioFalso, displayName: null }).nombre).toBe('erick@rentsmart.com');
  });

  test('el rol por defecto es cliente', () => {
    expect(mapearUsuario(usuarioFalso).rol).toBe('cliente');
  });

  test('identifica el proveedor de acceso', () => {
    expect(mapearUsuario(usuarioFalso).proveedor).toBe('password');
    expect(mapearUsuario({ ...usuarioFalso, providerData: [{ providerId: 'google.com' }] }).proveedor)
      .toBe('google.com');
  });
});
