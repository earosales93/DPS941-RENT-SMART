/**
 * Pruebas del formato de los datos del vehículo.
 *
 * Firestore no impone esquema: un documento puede llegar con campos
 * ausentes, con números guardados como texto o con un campo de más. Estas
 * pruebas fijan el contrato que las pantallas esperan, de modo que un
 * documento mal formado no se propague hasta la interfaz.
 */

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock('../src/firebase/configuracion', () => ({
  obtenerDb: jest.fn(),
  obtenerAuth: jest.fn(),
  COLECCIONES: { usuarios: 'usuarios', vehiculos: 'vehiculos', reservas: 'reservas', actividad: 'actividad' },
  firebaseConfigurado: jest.fn(() => true),
}));

import { mapearVehiculo } from '../src/servicios/vehiculoService';
import { VEHICULOS } from '../src/datos/demo';
import { ESTADOS_VEHICULO } from '../src/lib/negocio';

const CAMPOS_NUMERICOS = ['anio', 'capacidad', 'kilometraje', 'precioPorDia'];
const CAMPOS_TEXTO = [
  'marca', 'modelo', 'placa', 'categoria', 'color',
  'transmision', 'combustible', 'estado', 'imagenUrl', 'descripcion',
];

function instantanea(id, datos) {
  return { id, data: () => datos };
}

const COMPLETO = {
  marca: 'Toyota', modelo: 'Corolla', anio: 2023, placa: 'P123456',
  categoria: 'Sedán', color: 'Blanco', transmision: 'Automática',
  combustible: 'Gasolina', capacidad: 5, kilometraje: 24500,
  precioPorDia: 38, estado: 'disponible', imagenUrl: '', descripcion: 'Sedán económico.',
};

describe('mapearVehiculo · contrato de datos', () => {
  test('conserva el identificador del documento', () => {
    expect(mapearVehiculo(instantanea('v1', COMPLETO)).id).toBe('v1');
  });

  test('todos los campos numéricos salen como número', () => {
    const v = mapearVehiculo(instantanea('v1', COMPLETO));
    for (const campo of CAMPOS_NUMERICOS) {
      expect(typeof v[campo]).toBe('number');
      expect(Number.isNaN(v[campo])).toBe(false);
    }
  });

  test('todos los campos de texto salen como cadena', () => {
    const v = mapearVehiculo(instantanea('v1', COMPLETO));
    for (const campo of CAMPOS_TEXTO) {
      expect(typeof v[campo]).toBe('string');
    }
  });

  test('convierte a número un precio guardado como texto', () => {
    const v = mapearVehiculo(instantanea('v1', { ...COMPLETO, precioPorDia: '45.5' }));
    expect(v.precioPorDia).toBe(45.5);
    expect(typeof v.precioPorDia).toBe('number');
  });

  test('un documento vacío no produce undefined ni NaN', () => {
    const v = mapearVehiculo(instantanea('v0', {}));
    // El estado es el único campo con valor por defecto propio.
    for (const campo of CAMPOS_TEXTO.filter((c) => c !== 'estado')) {
      expect(v[campo]).toBe('');
    }
    for (const campo of CAMPOS_NUMERICOS) expect(v[campo]).toBe(0);
  });

  test('el estado por defecto es disponible', () => {
    expect(mapearVehiculo(instantanea('v0', {})).estado).toBe('disponible');
  });

  test('descarta los campos que no forman parte del contrato', () => {
    const v = mapearVehiculo(instantanea('v1', { ...COMPLETO, campoInesperado: 'x' }));
    expect(v.campoInesperado).toBeUndefined();
  });

  test('la forma del objeto es siempre la misma, falten o sobren campos', () => {
    const completo = Object.keys(mapearVehiculo(instantanea('v1', COMPLETO))).sort();
    const vacio = Object.keys(mapearVehiculo(instantanea('v0', {}))).sort();
    expect(vacio).toEqual(completo);
  });
});

describe('datos de respaldo', () => {
  test('todos los vehículos cumplen el mismo contrato que Firestore', () => {
    const esperados = Object.keys(mapearVehiculo(instantanea('v1', COMPLETO)));
    for (const vehiculo of VEHICULOS) {
      for (const campo of esperados) {
        expect(vehiculo).toHaveProperty(campo);
      }
    }
  });

  test('los identificadores coinciden con los que escribe el script de carga', () => {
    for (const vehiculo of VEHICULOS) {
      expect(String(vehiculo.id)).toMatch(/^v\d+$/);
    }
  });

  test('las placas no se repiten', () => {
    const placas = VEHICULOS.map((v) => v.placa);
    expect(new Set(placas).size).toBe(placas.length);
  });

  test('todos los estados pertenecen al catálogo', () => {
    for (const vehiculo of VEHICULOS) {
      expect(ESTADOS_VEHICULO).toContain(vehiculo.estado);
    }
  });

  test('todos los precios por día son positivos', () => {
    for (const vehiculo of VEHICULOS) {
      expect(vehiculo.precioPorDia).toBeGreaterThan(0);
    }
  });
});
