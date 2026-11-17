'use strict';

/**
 * Limitador de intentos en memoria (suficiente para el demo de un proceso).
 * Para produccion con varias instancias conviene Redis o similar.
 */

const ventanas = new Map();

function limpiar() {
  const ahora = Date.now();
  for (const [clave, valor] of ventanas) {
    if (valor.fin < ahora) ventanas.delete(clave);
  }
}

function permitir(clave, maximo, ventanaMs) {
  const ahora = Date.now();
  if (ventanas.size > 5000) limpiar();

  let valor = ventanas.get(clave);
  if (!valor || valor.fin < ahora) {
    valor = { contador: 0, fin: ahora + ventanaMs };
    ventanas.set(clave, valor);
  }
  valor.contador += 1;
  return valor.contador <= maximo;
}

module.exports = { permitir };
