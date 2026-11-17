'use strict';

const store = require('../db');

/**
 * Mapa persona_id -> nombre para mostrar.
 * Usa unicamente la cache de lectura local (nunca decide permisos).
 */
async function mapaNombres() {
  const cache = await store.listCachePersonas();
  const mapa = {};
  for (const p of cache) {
    mapa[Number(p.persona_id)] = p.nombre_completo || '';
  }
  return mapa;
}

module.exports = { mapaNombres };
