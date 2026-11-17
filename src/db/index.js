'use strict';

const config = require('../config');
const fileStore = require('./fileStore');
const firestore = require('./firestore');

/**
 * Selecciona el backend de almacenamiento propio.
 *
 * DB_BACKEND=firestore -> Firestore (debe estar configurado)
 * DB_BACKEND=file      -> archivo JSON local
 * DB_BACKEND=auto      -> Firestore si hay credenciales; si no, archivo JSON
 */

let store;

if (config.dbBackend === 'firestore') {
  store = firestore;
} else if (config.dbBackend === 'file') {
  store = fileStore;
} else {
  store = firestore.estaConfigurado() ? firestore : fileStore;
}

module.exports = store;
