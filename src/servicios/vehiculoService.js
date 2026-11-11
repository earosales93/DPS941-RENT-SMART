/**
 * Catálogo de vehículos en Cloud Firestore.
 *
 * Sustituye al servicio que consumía el API REST sobre MySQL. La flota es
 * información pública dentro de la aplicación: cualquier usuario autenticado
 * puede leerla, pero solo un administrador puede modificarla, y esa
 * restricción se aplica en las reglas de seguridad, no aquí.
 *
 * Las pantallas siguen llamando a los mismos métodos con los mismos nombres
 * que en la entrega anterior, de modo que el cambio de MySQL a Firestore no
 * obligó a tocar una sola pantalla.
 */

import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';

import { obtenerDb, COLECCIONES } from '../firebase/configuracion';
import { conRespaldo } from './origenDatos';
import { VEHICULOS } from '../datos/demo';

/** Normaliza un documento de Firestore a la forma que esperan las pantallas. */
export function mapearVehiculo(documento) {
  const d = documento.data();
  return {
    id: documento.id,
    marca: d.marca ?? '',
    modelo: d.modelo ?? '',
    anio: Number(d.anio ?? 0),
    placa: d.placa ?? '',
    categoria: d.categoria ?? '',
    color: d.color ?? '',
    transmision: d.transmision ?? '',
    combustible: d.combustible ?? '',
    capacidad: Number(d.capacidad ?? 0),
    kilometraje: Number(d.kilometraje ?? 0),
    precioPorDia: Number(d.precioPorDia ?? 0),
    estado: d.estado ?? 'disponible',
    imagenUrl: d.imagenUrl ?? '',
    descripcion: d.descripcion ?? '',
  };
}

function filtrarLocal(filtros = {}) {
  const texto = String(filtros.texto || '').trim().toLowerCase();
  return VEHICULOS.filter((v) => {
    if (filtros.estado && v.estado !== filtros.estado) return false;
    if (filtros.categoria && v.categoria !== filtros.categoria) return false;
    if (!texto) return true;
    return [v.marca, v.modelo, v.placa, v.categoria, v.color]
      .join(' ').toLowerCase().includes(texto);
  });
}

export const VehiculoService = {
  /** filtros: { estado, categoria, texto }. El texto se filtra en memoria. */
  obtenerVehiculos(filtros = {}) {
    return conRespaldo(async () => {
      const restricciones = [];
      if (filtros.estado) restricciones.push(where('estado', '==', filtros.estado));
      if (filtros.categoria) restricciones.push(where('categoria', '==', filtros.categoria));
      restricciones.push(orderBy('marca'), orderBy('modelo'));

      const consulta = query(collection(obtenerDb(), COLECCIONES.vehiculos), ...restricciones);
      const instantanea = await getDocs(consulta);
      const lista = instantanea.docs.map(mapearVehiculo);

      // Firestore no ofrece búsqueda por subcadena; con una flota de este
      // tamaño el filtro se resuelve en el teléfono, sin coste de lectura.
      const texto = String(filtros.texto || '').trim().toLowerCase();
      if (!texto) return lista;
      return lista.filter((v) =>
        [v.marca, v.modelo, v.placa, v.categoria, v.color]
          .join(' ').toLowerCase().includes(texto));
    }, () => filtrarLocal(filtros));
  },

  obtenerVehiculo(id) {
    return conRespaldo(async () => {
      const instantanea = await getDoc(doc(obtenerDb(), COLECCIONES.vehiculos, String(id)));
      return instantanea.exists() ? mapearVehiculo(instantanea) : null;
    }, () => VEHICULOS.find((v) => String(v.id) === String(id)) || null);
  },

  buscarDisponibles(filtros = {}) {
    return this.obtenerVehiculos({ ...filtros, estado: 'disponible' });
  },

  async obtenerCategorias() {
    const lista = await this.obtenerVehiculos();
    return [...new Set(lista.map((v) => v.categoria))].filter(Boolean).sort();
  },

  /** Las cuatro unidades más económicas, para la pantalla de inicio. */
  masEconomicos(cantidad = 4) {
    return conRespaldo(async () => {
      const consulta = query(
        collection(obtenerDb(), COLECCIONES.vehiculos),
        where('estado', '==', 'disponible'),
        orderBy('precioPorDia'),
        limit(cantidad)
      );
      const instantanea = await getDocs(consulta);
      return instantanea.docs.map(mapearVehiculo);
    }, () => filtrarLocal({ estado: 'disponible' })
      .sort((a, b) => a.precioPorDia - b.precioPorDia)
      .slice(0, cantidad));
  },
};

export default VehiculoService;
