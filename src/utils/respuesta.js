'use strict';

/**
 * Sobre unico de respuesta del ecosistema INCOS:
 * { exito, datos, meta, error }
 */

function ok(res, datos, meta) {
  return res.status(200).json({
    exito: true,
    datos: datos === undefined ? null : datos,
    meta: meta || null,
    error: null,
  });
}

function creado(res, datos, meta) {
  return res.status(201).json({
    exito: true,
    datos: datos === undefined ? null : datos,
    meta: meta || null,
    error: null,
  });
}

function fail(res, status, codigo, mensaje) {
  return res.status(status).json({
    exito: false,
    datos: null,
    meta: null,
    error: { codigo, mensaje },
  });
}

module.exports = { ok, creado, fail };
