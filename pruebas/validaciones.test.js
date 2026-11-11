/**
 * Pruebas de las validaciones de formularios (requerimiento funcional 4).
 *
 * Se comprueban tanto los casos que deben pasar como los que deben fallar.
 * Probar solo lo que funciona no demuestra nada: una función que siempre
 * devolviera "válido" pasaría esa mitad de la suite.
 */

import {
  validarLogin,
  validarRegistro,
  validarReserva,
  validarRecuperar,
  hayErrores,
  REGEX_EMAIL,
  REGEX_DUI,
  REGEX_TELEFONO,
} from '../src/lib/validaciones';

describe('validarLogin', () => {
  test('acepta credenciales con formato correcto', () => {
    const errores = validarLogin({ email: 'cliente@rentsmart.com', password: 'Cliente123' });
    expect(hayErrores(errores)).toBe(false);
  });

  test('rechaza el formulario vacío e informa los dos campos', () => {
    const errores = validarLogin({});
    expect(errores.email).toBe('Ingresa tu correo.');
    expect(errores.password).toBe('Ingresa tu contraseña.');
  });

  test.each([
    ['sin arroba', 'correo.ejemplo.com'],
    ['sin dominio', 'correo@'],
    ['sin extensión', 'correo@ejemplo'],
    ['con espacio', 'correo @ejemplo.com'],
  ])('rechaza un correo %s', (_caso, email) => {
    const errores = validarLogin({ email, password: 'Cliente123' });
    expect(errores.email).toBe('Formato de correo inválido.');
  });
});

describe('validarRegistro', () => {
  const VALIDO = {
    nombre: 'Erick Rosales',
    email: 'erick@rentsmart.com',
    documento: '01234567-8',
    telefono: '7777-7777',
    password: 'Clave2026',
    confirmarPassword: 'Clave2026',
  };

  test('acepta un registro completo y correcto', () => {
    expect(hayErrores(validarRegistro(VALIDO))).toBe(false);
  });

  test('exige que las contraseñas coincidan', () => {
    const errores = validarRegistro({ ...VALIDO, confirmarPassword: 'Otra2026' });
    expect(errores.confirmarPassword).toBe('Las contraseñas no coinciden.');
  });

  test('exige al menos ocho caracteres en la contraseña', () => {
    const errores = validarRegistro({ ...VALIDO, password: 'Abc123', confirmarPassword: 'Abc123' });
    expect(errores.password).toBe('La contraseña debe tener al menos 8 caracteres.');
  });

  test('exige combinar letras y números', () => {
    const errores = validarRegistro({
      ...VALIDO, password: 'solamenteletras', confirmarPassword: 'solamenteletras',
    });
    expect(errores.password).toBe('La contraseña debe combinar letras y números.');
  });

  test('rechaza un DUI con formato incorrecto', () => {
    const errores = validarRegistro({ ...VALIDO, documento: '123456' });
    expect(errores.documento).toMatch(/DUI inválido/);
  });

  test('acepta el DUI con y sin guion', () => {
    expect(validarRegistro({ ...VALIDO, documento: '012345678' }).documento).toBeUndefined();
    expect(validarRegistro({ ...VALIDO, documento: '01234567-8' }).documento).toBeUndefined();
  });

  test('rechaza un teléfono que no tenga ocho dígitos', () => {
    const errores = validarRegistro({ ...VALIDO, telefono: '777-777' });
    expect(errores.telefono).toMatch(/ocho dígitos|8 dígitos/i);
  });

  test('rechaza un nombre de menos de tres caracteres', () => {
    expect(validarRegistro({ ...VALIDO, nombre: 'Er' }).nombre).toBe('Escribe tu nombre completo.');
  });
});

describe('validarReserva', () => {
  const VALIDA = {
    vehiculoId: 'v1',
    fechaInicio: '2026-11-10',
    fechaFin: '2026-11-14',
    lugarEntrega: 'Sucursal San Salvador',
  };

  test('acepta un rango de fechas correcto', () => {
    expect(hayErrores(validarReserva(VALIDA))).toBe(false);
  });

  test('rechaza una devolución anterior al inicio', () => {
    const errores = validarReserva({ ...VALIDA, fechaFin: '2026-11-08' });
    expect(errores.fechaFin).toBe('La devolución debe ser posterior al inicio.');
  });

  test('rechaza una devolución el mismo día del inicio', () => {
    const errores = validarReserva({ ...VALIDA, fechaFin: VALIDA.fechaInicio });
    expect(errores.fechaFin).toBe('La devolución debe ser posterior al inicio.');
  });

  test('exige seleccionar un vehículo', () => {
    expect(validarReserva({ ...VALIDA, vehiculoId: null }).vehiculoId).toBe('Selecciona un vehículo.');
  });

  test('exige el lugar de entrega', () => {
    expect(validarReserva({ ...VALIDA, lugarEntrega: '  ' }).lugarEntrega).toBe('Indica el lugar de entrega.');
  });
});

describe('validarRecuperar', () => {
  test('acepta un correo válido', () => {
    expect(hayErrores(validarRecuperar({ email: 'erick@rentsmart.com' }))).toBe(false);
  });

  test('rechaza un correo vacío', () => {
    expect(validarRecuperar({ email: '' }).email).toBe('Ingresa tu correo.');
  });
});

describe('expresiones regulares', () => {
  test('REGEX_EMAIL distingue correos válidos de inválidos', () => {
    expect(REGEX_EMAIL.test('a@b.sv')).toBe(true);
    expect(REGEX_EMAIL.test('a@b.c')).toBe(false); // extensión de una sola letra
  });

  test('REGEX_DUI admite nueve dígitos con guion opcional', () => {
    expect(REGEX_DUI.test('01234567-8')).toBe(true);
    expect(REGEX_DUI.test('012345678')).toBe(true);
    expect(REGEX_DUI.test('0123456-78')).toBe(false);
  });

  test('REGEX_TELEFONO admite separador opcional', () => {
    expect(REGEX_TELEFONO.test('77777777')).toBe(true);
    expect(REGEX_TELEFONO.test('7777-7777')).toBe(true);
    expect(REGEX_TELEFONO.test('7777 7777')).toBe(true);
    expect(REGEX_TELEFONO.test('777-7777')).toBe(false);
  });
});
