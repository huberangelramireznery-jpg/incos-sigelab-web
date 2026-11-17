'use strict';

/**
 * Arranque del demo completo con `npm start`.
 *
 * - Si API_ACADEMICO_URL apunta al simulador local (127.0.0.1:3000 o
 *   localhost:3000), levanta tambien el nucleo SIA simulado.
 * - Si apunta al SIA real, solo levanta la aplicacion SIGELAB.
 *
 * Asi el proyecto funciona al clonarlo y ejecutar:
 *   npm install
 *   npm start
 */

const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(RAIZ, '.env') });

const urlSia = (process.env.API_ACADEMICO_URL || '').trim();
const usaSimuladorLocal = /^https?:\/\/(127\.0\.0\.1|localhost):3000\/?$/i.test(urlSia);
const PUERTO_SIMULADOR = 3000;

const procesos = [];

function puertoOcupado(puerto) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port: puerto, host: '127.0.0.1' });
    let terminado = false;
    const finalizar = (valor) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      resolve(valor);
    };
    socket.once('connect', () => finalizar(true));
    socket.once('error', () => finalizar(false));
    setTimeout(() => finalizar(false), 600);
  });
}

function lanzar(nombre, archivo) {
  const hijo = spawn(process.execPath, [path.join(RAIZ, archivo)], {
    cwd: RAIZ,
    stdio: 'inherit',
    env: process.env,
  });
  hijo.on('exit', (codigo, senal) => {
    if (senal) return;
    if (codigo && codigo !== 0) {
      console.error('[SIGELAB] ' + nombre + ' termino con codigo ' + codigo + '.');
    }
  });
  procesos.push(hijo);
  return hijo;
}

function detener(senal) {
  for (const proceso of procesos) {
    if (!proceso.killed) {
      try {
        proceso.kill(senal);
      } catch (_) {
        // El proceso ya pudo haber terminado.
      }
    }
  }
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', () => detener('SIGINT'));
process.on('SIGTERM', () => detener('SIGTERM'));

(async () => {
  if (usaSimuladorLocal) {
    if (await puertoOcupado(PUERTO_SIMULADOR)) {
      console.log('[SIGELAB] El SIA simulado ya esta escuchando en el puerto ' + PUERTO_SIMULADOR + '.');
    } else {
      console.log('[SIGELAB] Levantando el nucleo SIA simulado en el puerto ' + PUERTO_SIMULADOR + '...');
      lanzar('SIA simulado', path.join('mock-sia', 'server.js'));
    }
  }

  console.log('[SIGELAB] Levantando la aplicacion SIGELAB...');
  lanzar('SIGELAB', path.join('src', 'server.js'));
})();
