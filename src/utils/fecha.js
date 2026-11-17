'use strict';

/**
 * Hora oficial de Bolivia (America/La_Paz, UTC-4 sin horario de verano).
 * Formato ISO-8601 con offset -04:00, como exige el contrato.
 */
function horaBolivia(fecha) {
  const base = fecha ? new Date(fecha) : new Date();
  const d = new Date(base.getTime() - 4 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    '-' +
    pad(d.getUTCMonth() + 1) +
    '-' +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    ':' +
    pad(d.getUTCMinutes()) +
    ':' +
    pad(d.getUTCSeconds()) +
    '-04:00'
  );
}

module.exports = { horaBolivia };
