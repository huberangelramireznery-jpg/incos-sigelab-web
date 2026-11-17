'use strict';

const express = require('express');
const asyncHandler = require('../utils/async');
const { ok, creado, fail } = require('../utils/respuesta');
const store = require('../db');
const { requireAuth, requireManage } = require('../middleware/auth');

const router = express.Router();

const TIPOS_AMBIENTE = ['LABORATORIO', 'DATACENTER', 'TALLER', 'OTRO'];

function validarAmbiente(datos, esNuevo) {
  const errores = [];
  if (esNuevo || datos.codigo !== undefined) {
    if (!datos.codigo || !String(datos.codigo).trim()) errores.push('El código es obligatorio.');
  }
  if (esNuevo || datos.nombre !== undefined) {
    if (!datos.nombre || !String(datos.nombre).trim()) errores.push('El nombre es obligatorio.');
  }
  if (esNuevo || datos.tipo !== undefined) {
    if (!TIPOS_AMBIENTE.includes(datos.tipo)) {
      errores.push('El tipo debe ser LABORATORIO, DATACENTER, TALLER u OTRO.');
    }
  }
  if (datos.capacidad_maxima !== undefined && Number(datos.capacidad_maxima) < 0) {
    errores.push('La capacidad máxima no puede ser negativa.');
  }
  return errores;
}

// Listado de ambientes con contador de equipos.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ambientes = await store.listAmbientes();
    const datos = [];
    for (const a of ambientes) {
      const conteo = await store.countEquiposPorAmbiente(a.id);
      datos.push({ ...a, equipos_total: conteo.total, equipos_activos: conteo.activos });
    }
    datos.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    return ok(res, datos);
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ambiente = await store.getAmbiente(req.params.id);
    if (!ambiente) return fail(res, 404, 'NO_ENCONTRADO', 'El ambiente no existe.');
    const conteo = await store.countEquiposPorAmbiente(ambiente.id);
    return ok(res, { ...ambiente, equipos_total: conteo.total, equipos_activos: conteo.activos });
  })
);

router.post(
  '/',
  requireAuth,
  requireManage,
  asyncHandler(async (req, res) => {
    const datos = req.body || {};
    const errores = validarAmbiente(datos, true);
    if (errores.length) return fail(res, 400, 'DATOS_INVALIDOS', errores.join(' '));

    const ambiente = await store.createAmbiente(datos);
    await store.addAuditoria({
      persona_id: req.user.persona_id,
      accion: 'ALTA',
      entidad: 'AMBIENTE',
      entidad_id: ambiente.id,
    });
    return creado(res, ambiente);
  })
);

router.put(
  '/:id',
  requireAuth,
  requireManage,
  asyncHandler(async (req, res) => {
    const datos = req.body || {};
    const errores = validarAmbiente(datos, false);
    if (errores.length) return fail(res, 400, 'DATOS_INVALIDOS', errores.join(' '));

    const ambiente = await store.updateAmbiente(req.params.id, datos);
    if (!ambiente) return fail(res, 404, 'NO_ENCONTRADO', 'El ambiente no existe.');

    await store.addAuditoria({
      persona_id: req.user.persona_id,
      accion: 'EDICION',
      entidad: 'AMBIENTE',
      entidad_id: ambiente.id,
    });
    return ok(res, ambiente);
  })
);

// Baja de ambiente: prohibida si tiene equipos.
router.delete(
  '/:id',
  requireAuth,
  requireManage,
  asyncHandler(async (req, res) => {
    const ambiente = await store.getAmbiente(req.params.id);
    if (!ambiente) return fail(res, 404, 'NO_ENCONTRADO', 'El ambiente no existe.');

    const conteo = await store.countEquiposPorAmbiente(ambiente.id);
    if (conteo.total > 0) {
      return fail(
        res,
        409,
        'CONFLICTO',
        `No se puede dar de baja un ambiente que tiene ${conteo.total} equipo(s). Reasigne o dé de baja los equipos primero.`
      );
    }

    const actualizado = await store.updateAmbiente(ambiente.id, { activo: false });
    await store.addAuditoria({
      persona_id: req.user.persona_id,
      accion: 'BAJA',
      entidad: 'AMBIENTE',
      entidad_id: ambiente.id,
    });
    return ok(res, actualizado);
  })
);

module.exports = router;
