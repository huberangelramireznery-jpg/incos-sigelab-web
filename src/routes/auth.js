'use strict';

const express = require('express');
const asyncHandler = require('../utils/async');
const { ok, fail } = require('../utils/respuesta');
const sia = require('../sia/client');
const store = require('../db');
const { permisosDe } = require('../services/permisos');
const { requireAuth } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/auth/login
 * El SIGELAB no valida contraseñas: delega en el nucleo y valida el JWT.
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { identificador, clave } = req.body || {};
    if (!identificador || !clave) {
      return fail(res, 400, 'DATOS_INVALIDOS', 'Ingrese su cédula o correo y su contraseña.');
    }

    let sesion;
    try {
      sesion = await sia.login(String(identificador).trim(), String(clave));
    } catch (e) {
      if (e instanceof sia.SiaError) {
        return fail(res, e.status, e.codigo, e.message);
      }
      throw e;
    }

    // Validacion local de firma RS256, emisor y expiracion.
    let payload;
    try {
      payload = await sia.verifyToken(sesion.token);
    } catch (e) {
      if (e instanceof sia.SiaError) {
        return fail(res, e.status, e.codigo, e.message);
      }
      throw e;
    }

    const user = sia.usuarioDesdeToken(payload);
    const permisos = permisosDe(user);

    if (!permisos.canRead) {
      return fail(res, 403, 'SIN_PERMISO', 'La cuenta no tiene acceso al sistema SIGELAB.');
    }

    // Cache de lectura (nombre/cargo). Nunca decide permisos.
    await store.upsertCachePersona({
      persona_id: user.persona_id,
      ci: user.ci,
      nombre: user.nombre,
      cargo: permisos.cargos.join(', '),
    });

    return ok(res, {
      token: sesion.token,
      usuario: {
        persona_id: user.persona_id,
        ci: user.ci,
        nombre: user.nombre,
        roles: user.roles,
        cargos: permisos.cargos,
      },
      permisos,
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    return ok(res, { usuario: req.user, permisos: req.permisos });
  })
);

// Informacion publica para la pantalla de ingreso.
router.get('/config', (req, res) => {
  return ok(res, {
    sistema: config.sistema,
    version: config.version,
    siaUrl: config.siaUrl,
    puerto: config.port,
  });
});

module.exports = router;
