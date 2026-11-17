'use strict';

/**
 * Recarga los datos ficticios de demostracion.
 * Uso: npm run seed
 */

const store = require('./index');

(async function () {
  try {
    await store.resetStore();
    console.log('[SIGELAB] Datos de ejemplo recargados en el backend: ' + store.backend);
    process.exit(0);
  } catch (e) {
    console.error('[SIGELAB] No se pudo recargar el seed:', e.message);
    process.exit(1);
  }
})();
