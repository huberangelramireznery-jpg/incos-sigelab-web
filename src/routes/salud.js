'use strict';

const express = require('express');
const asyncHandler = require('../utils/async');
const { ok } = require('../utils/respuesta');
const sia = require('../sia/client');
const config = require('../config');
const { horaBolivia } = require('../utils/fecha');

const router = express.Router();

/**
 * GET /salud-integracion  (publico, sin token)
 * Contrato de Conformidad v1.1.0, Anexo A.
 * Responde 200 siempre que el demo este en ejecucion.
 */
router.get(
  '/salud-integracion',
  asyncHandler(async (req, res) => {
    // Si aun no hay clave en memoria, se intenta cargar para reportar el estado real.
    if (!sia.estadoJwt().claveCacheada) {
      try {
        await sia.getPublicKeyPem();
      } catch (e) {
        // El nucleo puede estar caido: se reporta SIN_CONEXION.
      }
    }

    const siaEstado = await sia.estadoNucleo();

    return res.status(200).json({
      sistema: config.sistema,
      version: config.version,
      siaUrl: config.siaUrl,
      siaEstado,
      jwt: sia.estadoJwt(),
      hora: horaBolivia(),
    });
  })
);

/**
 * GET /health  (publico)
 * Chequeo simple de que el demo esta en linea.
 */
router.get('/health', (req, res) => {
  return res.status(200).json({
    estado: 'ok',
    sistema: config.sistema,
    version: config.version,
    backend: require('../db').backend,
    hora: horaBolivia(),
  });
});

/**
 * GET /api/estado  (publico)
 * Diagnostico del demo en el sobre unico del contrato.
 */
router.get(
  '/api/estado',
  asyncHandler(async (req, res) => {
    const siaEstado = await sia.estadoNucleo();
    return ok(res, {
      sistema: config.sistema,
      version: config.version,
      siaUrl: config.siaUrl,
      siaEstado,
      jwt: sia.estadoJwt(),
      backend: require('../db').backend,
      hora: horaBolivia(),
    });
  })
);

module.exports = router;
