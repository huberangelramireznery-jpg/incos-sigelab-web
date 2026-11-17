'use strict';

const express = require('express');
const asyncHandler = require('../utils/async');
const { ok, creado, fail } = require('../utils/respuesta');
const store = require('../db');
const config = require('../config');
const { requireAuth, requireManage, requireChangeState } = require('../middleware/auth');
const { mapaNombres } = require('../services/nombres');

const router = express.Router();

const ESTADOS = ['OPERATIVO', 'EN_MANTENIMIENTO', 'DE_BAJA'];

async function validarEquipo(datos, esNuevo) {
  const errores = [];

  if (esNuevo || datos.ambiente_id !== undefined) {
    if (!datos.ambiente_id) {
      errores.push('El ambiente es obligatorio.');
    } else {
      const ambiente = await store.getAmbiente(datos.ambiente_id);
      if (!ambiente) errores.push('El ambiente seleccionado no existe.');
      else if (ambiente.activo === false) errores.push('El ambiente seleccionado está inactivo.');
    }
  }

  if (esNuevo || datos.codigo_activo !== undefined) {
    if (!datos.codigo_activo || !String(datos.codigo_activo).trim()) {
      errores.push('El código de activo es obligatorio.');
    }
  }
  for (const campo of ['tipo', 'marca', 'modelo']) {
    if (esNuevo || datos[campo] !== undefined) {
      if (!datos[campo] || !String(datos[campo]).trim()) errores.push(`El campo ${campo} es obligatorio.`);
    }
  }
  if (datos.estado !== undefined && !ESTADOS.includes(datos.estado)) {
    errores.push('El estado no es válido.');
  }
  if (datos.estado === 'DE_BAJA') {
    errores.push('Un equipo nuevo no puede crearse como DE_BAJA. Use la baja lógica.');
  }
  return errores;
}

// Inventario con filtros (estado, tipo, código) y ambiente.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const filtros = {
      ambiente_id: req.query.ambiente_id,
      estado: req.query.estado,
      tipo: req.query.tipo,
      q: req.query.q,
      incluir_baja: req.query.incluir_baja,
    };
    const equipos = await store.listEquipos(filtros);
    const ambientes = await store.listAmbientes();
    const mapaAmbientes = {};
    for (const a of ambientes) mapaAmbientes[a.id] = a;

    const datos = equipos.map((e) => ({
      ...e,
      ambiente_codigo: mapaAmbientes[e.ambiente_id] ? mapaAmbientes[e.ambiente_id].codigo : '',
      ambiente_nombre: mapaAmbientes[e.ambiente_id] ? mapaAmbientes[e.ambiente_id].nombre : '',
    }));

    return ok(res, datos, { total: datos.length });
  })
);

// Catalogos para formularios y filtros.
router.get('/catalogos', requireAuth, (req, res) => {
  return ok(res, {
    estados: ESTADOS,
    tipos_ambiente: ['LABORATORIO', 'DATACENTER', 'TALLER', 'OTRO'],
    tipos_equipo: [
      'COMPUTADORA',
      'SERVIDOR',
      'PROYECTOR',
      'SWITCH',
      'ROUTER',
      'UPS',
      'OSCILOSCOPIO',
      'MULTIMETRO',
      'FUENTE',
      'ESTACION_SOLDADURA',
      'COMPRESOR',
      'OTRO',
    ],
    max_equipos_por_sala: config.maxEquiposPorSala,
  });
});

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const equipo = await store.getEquipo(req.params.id);
    if (!equipo) return fail(res, 404, 'NO_ENCONTRADO', 'El equipo no existe.');
    const ambiente = await store.getAmbiente(equipo.ambiente_id);
    return ok(res, { ...equipo, ambiente_codigo: ambiente ? ambiente.codigo : '', ambiente_nombre: ambiente ? ambiente.nombre : '' });
  })
);

router.get(
  '/:id/historial',
  requireAuth,
  asyncHandler(async (req, res) => {
    const equipo = await store.getEquipo(req.params.id);
    if (!equipo) return fail(res, 404, 'NO_ENCONTRADO', 'El equipo no existe.');

    const historial = await store.listHistorial(equipo.id);
    const nombres = await mapaNombres();
    const datos = historial.map((h) => ({
      ...h,
      persona_nombre: nombres[Number(h.persona_id)] || null,
    }));
    return ok(res, { equipo, historial: datos });
  })
);

router.post(
  '/',
  requireAuth,
  requireManage,
  asyncHandler(async (req, res) => {
    const datos = req.body || {};
    const errores = await validarEquipo(datos, true);
    if (errores.length) return fail(res, 400, 'DATOS_INVALIDOS', errores.join(' '));

    const equipo = await store.createEquipo(datos);
    await store.addAuditoria({
      persona_id: req.user.persona_id,
      accion: 'ALTA',
      entidad: 'EQUIPO',
      entidad_id: equipo.id,
    });

    const conteo = await store.countEquiposPorAmbiente(equipo.ambiente_id);
    const meta = { total_ambiente: conteo.total, max_equipos_por_sala: config.maxEquiposPorSala };
    if (conteo.total > config.maxEquiposPorSala) {
      meta.advertencia =
        'El ambiente supera el límite informativo de ' + config.maxEquiposPorSala + ' equipos.';
    }
    return creado(res, equipo, meta);
  })
);

router.put(
  '/:id',
  requireAuth,
  requireManage,
  asyncHandler(async (req, res) => {
    const datos = req.body || {};
    const existente = await store.getEquipo(req.params.id);
    if (!existente) return fail(res, 404, 'NO_ENCONTRADO', 'El equipo no existe.');

    const errores = await validarEquipo(datos, false);
    if (errores.length) return fail(res, 400, 'DATOS_INVALIDOS', errores.join(' '));

    const equipo = await store.updateEquipo(req.params.id, datos);
    await store.addAuditoria({
      persona_id: req.user.persona_id,
      accion: 'EDICION',
      entidad: 'EQUIPO',
      entidad_id: equipo.id,
    });
    return ok(res, equipo);
  })
);

// Cambio de estado: Encargado o Tecnico. Genera una fila de historial.
router.post(
  '/:id/estado',
  requireAuth,
  requireChangeState,
  asyncHandler(async (req, res) => {
    const { estado_nuevo, observacion } = req.body || {};
    const permitidos = ['OPERATIVO', 'EN_MANTENIMIENTO'];
    if (!permitidos.includes(estado_nuevo)) {
      return fail(
        res,
        400,
        'DATOS_INVALIDOS',
        'El estado nuevo debe ser OPERATIVO o EN_MANTENIMIENTO. Para la baja use la acción de baja lógica.'
      );
    }

    const existente = await store.getEquipo(req.params.id);
    if (!existente) return fail(res, 404, 'NO_ENCONTRADO', 'El equipo no existe.');

    const resultado = await store.changeEstadoEquipo(req.params.id, {
      estado_nuevo,
      observacion: observacion || '',
      persona_id: req.user.persona_id,
    });

    await store.addAuditoria({
      persona_id: req.user.persona_id,
      accion: 'CAMBIO_ESTADO',
      entidad: 'EQUIPO',
      entidad_id: Number(req.params.id),
    });

    return ok(res, resultado);
  })
);

// Baja logica: solo el Encargado (el Tecnico recibe 403).
router.delete(
  '/:id',
  requireAuth,
  requireManage,
  asyncHandler(async (req, res) => {
    const existente = await store.getEquipo(req.params.id);
    if (!existente) return fail(res, 404, 'NO_ENCONTRADO', 'El equipo no existe.');

    const resultado = await store.darDeBajaEquipo(req.params.id, {
      observacion: (req.body && req.body.observacion) || '',
      persona_id: req.user.persona_id,
    });

    await store.addAuditoria({
      persona_id: req.user.persona_id,
      accion: 'BAJA',
      entidad: 'EQUIPO',
      entidad_id: Number(req.params.id),
    });

    return ok(res, resultado);
  })
);

module.exports = router;
