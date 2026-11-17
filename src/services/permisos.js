'use strict';

/**
 * Permisos del SIGELAB derivados del token del SIA.
 *
 * Regla de la guia:
 *  - ADMINISTRATIVO + cargo "Encargado de Laboratorios" -> todo.
 *  - SERVICIO + cargo "Tecnico de Laboratorio"          -> consultar y cambiar estado.
 *  - ADMINISTRATIVO con otro cargo (Rector, Academico)  -> solo lectura.
 *  - Sin rol SIGELAB en el token                        -> 403 (se valida al ingresar).
 */

function normalizarCargos(cargos) {
  if (!Array.isArray(cargos)) return [];
  return cargos
    .map((c) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object') return c.nombre || c.cargo || '';
      return '';
    })
    .filter(Boolean);
}

function permisosDe(user) {
  const cargos = normalizarCargos(user && user.cargos);
  const roles = (user && user.roles) || {};
  const rol = roles.SIGELAB || null;

  // Comparacion tolerante a tildes y mayusculas.
  const texto = cargos
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const esEncargado = texto.includes('encargado');
  const esTecnico = texto.includes('tecnico');

  const canRead = Boolean(rol);
  const canManage = rol === 'ADMINISTRATIVO' && esEncargado;
  const canChangeState = canManage || (rol === 'SERVICIO' && esTecnico);

  return {
    rol,
    cargos,
    esEncargado,
    esTecnico,
    canRead,
    canManage,
    canChangeState,
  };
}

module.exports = { permisosDe, normalizarCargos };
