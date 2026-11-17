'use strict';

const express = require('express');
const asyncHandler = require('../utils/async');
const { ok } = require('../utils/respuesta');
const sia = require('../sia/client');
const store = require('../db');
const { requireAuth } = require('../middleware/auth');
const { normalizarCargos } = require('../services/permisos');

const router = express.Router();

function extraerLista(cuerpo) {
  if (!cuerpo) return [];
  const datos = cuerpo.datos !== undefined ? cuerpo.datos : cuerpo;
  if (Array.isArray(datos)) return datos;
  if (datos && Array.isArray(datos.personas)) return datos.personas;
  if (datos && Array.isArray(datos.items)) return datos.items;
  if (datos && Array.isArray(datos.cargos)) return datos.cargos;
  return [];
}

/**
 * GET /api/personas
 * Proxy autenticado al SIA para elegir responsables.
 * Si el nucleo no responde, se usa la cache local (modo lectura).
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const params = new URLSearchParams();
    if (req.query.tipo) params.set('tipo', req.query.tipo);
    if (req.query.q) params.set('q', req.query.q);
    if (req.query.pagina) params.set('pagina', req.query.pagina);

    const qs = params.toString();
    const ruta = '/api/v1/personas' + (qs ? '?' + qs : '');

    try {
      const r = await sia.getConToken(ruta, req.token);
      if (r.ok) {
        const lista = extraerLista(r.data);
        for (const p of lista) {
          await store.upsertCachePersona({
            persona_id: p.id || p.persona_id,
            ci: p.ci,
            nombres: p.nombres,
            apellidos: p.apellidos,
            nombre_completo: p.nombre_completo || p.nombre,
            cargo: normalizarCargos(p.cargos).join(', '),
          });
        }
        const meta = r.data && r.data.meta ? r.data.meta : null;
        return ok(res, lista, { ...(meta || {}), origen: 'SIA' });
      }
    } catch (e) {
      // Sin conexion: se intenta la cache.
    }

    const cache = await store.listCachePersonas();
    const q = String(req.query.q || '').toLowerCase();
    const lista = cache.filter((p) => {
      if (!q) return true;
      return (
        String(p.nombre_completo || '').toLowerCase().includes(q) ||
        String(p.ci || '').includes(q)
      );
    });
    return ok(
      res,
      lista.map((p) => ({
        id: p.persona_id,
        persona_id: p.persona_id,
        ci: p.ci,
        nombre_completo: p.nombre_completo,
        cargo: p.cargo,
      })),
      { origen: 'CACHE', aviso: 'Núcleo SIA no disponible: mostrando caché local.' }
    );
  })
);

/**
 * GET /api/personas/:id/cargos
 */
router.get(
  '/:id/cargos',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const r = await sia.getConToken('/api/v1/personas/' + req.params.id + '/cargos', req.token);
      if (r.ok) {
        return ok(res, extraerLista(r.data), { origen: 'SIA' });
      }
    } catch (e) {
      // Sin conexion: se intenta la cache.
    }

    const persona = await store.getCachePersona(req.params.id);
    const cargos = persona && persona.cargo ? persona.cargo.split(',').map((c) => c.trim()) : [];
    return ok(res, cargos, { origen: 'CACHE' });
  })
);

module.exports = router;
