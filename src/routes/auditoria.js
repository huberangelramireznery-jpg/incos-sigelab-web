'use strict';

const express = require('express');
const asyncHandler = require('../utils/async');
const { ok } = require('../utils/respuesta');
const store = require('../db');
const { requireAuth, requireManage } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/auditoria
 * Solo el Encargado de Laboratorios. Registro de altas, ediciones y bajas.
 */
router.get(
  '/',
  requireAuth,
  requireManage,
  asyncHandler(async (req, res) => {
    const limite = req.query.limite || 100;
    const datos = await store.listAuditoria(limite);
    return ok(res, datos, { total: datos.length });
  })
);

module.exports = router;
