'use strict';

const express = require('express');
const asyncHandler = require('../utils/async');
const { ok } = require('../utils/respuesta');
const store = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ESTADOS = ['OPERATIVO', 'EN_MANTENIMIENTO', 'DE_BAJA'];

function vacioPorEstado() {
  const obj = {};
  for (const e of ESTADOS) obj[e] = 0;
  return obj;
}

/**
 * GET /api/dashboard
 * Tarjetas por ambiente y panel resumen por estado.
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ambientes = await store.listAmbientes();
    const equipos = await store.listEquipos({});

    const resumen = vacioPorEstado();
    for (const e of equipos) {
      if (resumen[e.estado] !== undefined) resumen[e.estado] += 1;
    }

    const porAmbiente = ambientes
      .slice()
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)))
      .map((a) => {
        const eqs = equipos.filter((e) => e.ambiente_id === a.id);
        const porEstado = vacioPorEstado();
        for (const e of eqs) {
          if (porEstado[e.estado] !== undefined) porEstado[e.estado] += 1;
        }
        return {
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          tipo: a.tipo,
          activo: a.activo,
          total_equipos: eqs.length,
          equipos_activos: eqs.filter((e) => e.estado !== 'DE_BAJA').length,
          por_estado: porEstado,
        };
      });

    return ok(res, {
      total_equipos: equipos.length,
      total_activos: equipos.filter((e) => e.estado !== 'DE_BAJA').length,
      resumen_por_estado: resumen,
      ambientes: porAmbiente,
    });
  })
);

module.exports = router;
