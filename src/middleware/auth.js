'use strict';

const sia = require('../sia/client');
const { permisosDe, normalizarCargos } = require('../services/permisos');
const { fail } = require('../utils/respuesta');

/**
 * Valida el token del SIA en cada peticion autenticada.
 * Adjunta req.user, req.token y req.permisos.
 */
async function requireAuth(req, res, next) {
  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Bearer ')) {
    return fail(res, 401, 'NO_AUTENTICADO', 'Falta la cabecera Authorization: Bearer <token>.');
  }
  const token = cabecera.slice('Bearer '.length).trim();
  try {
    const payload = await sia.verifyToken(token);
    const user = sia.usuarioDesdeToken(payload);
    const permisos = permisosDe(user);

    if (!permisos.canRead) {
      return fail(res, 403, 'SIN_PERMISO', 'La cuenta no tiene acceso al sistema SIGELAB.');
    }

    req.token = token;
    req.user = user;
    req.permisos = permisos;
    return next();
  } catch (e) {
    if (e instanceof sia.SiaError) {
      return fail(res, e.status, e.codigo, e.message);
    }
    return fail(res, 401, 'TOKEN_INVALIDO', 'No fue posible validar el token.');
  }
}

function requireManage(req, res, next) {
  if (!req.permisos || !req.permisos.canManage) {
    return fail(
      res,
      403,
      'SIN_PERMISO',
      'Solo el Encargado de Laboratorios puede realizar esta acción.'
    );
  }
  return next();
}

function requireChangeState(req, res, next) {
  if (!req.permisos || !req.permisos.canChangeState) {
    return fail(
      res,
      403,
      'SIN_PERMISO',
      'Su cargo no permite cambiar el estado de un equipo.'
    );
  }
  return next();
}

module.exports = { requireAuth, requireManage, requireChangeState, normalizarCargos };
