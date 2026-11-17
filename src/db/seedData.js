'use strict';

/**
 * Datos ficticios de demostracion para el SIGELAB.
 * Ambientes, equipos e historial de ejemplo.
 */

const ahora = '2026-10-20T09:00:00-04:00';

const ambientes = [
  {
    id: 1,
    codigo: 'LAB-1',
    nombre: 'Laboratorio de Computación 1',
    tipo: 'LABORATORIO',
    capacidad_maxima: 30,
    persona_responsable_id: 6,
    activo: true,
    creado_en: ahora,
    actualizado_en: ahora,
  },
  {
    id: 2,
    codigo: 'LAB-2',
    nombre: 'Laboratorio de Redes y Telecomunicaciones',
    tipo: 'LABORATORIO',
    capacidad_maxima: 25,
    persona_responsable_id: 6,
    activo: true,
    creado_en: ahora,
    actualizado_en: ahora,
  },
  {
    id: 3,
    codigo: 'LAB-3',
    nombre: 'Laboratorio de Electrónica',
    tipo: 'LABORATORIO',
    capacidad_maxima: 20,
    persona_responsable_id: null,
    activo: true,
    creado_en: ahora,
    actualizado_en: ahora,
  },
  {
    id: 4,
    codigo: 'DC-1',
    nombre: 'Datacenter Principal',
    tipo: 'DATACENTER',
    capacidad_maxima: 10,
    persona_responsable_id: 6,
    activo: true,
    creado_en: ahora,
    actualizado_en: ahora,
  },
  {
    id: 5,
    codigo: 'TAL-1',
    nombre: 'Taller de Mantenimiento',
    tipo: 'TALLER',
    capacidad_maxima: 15,
    persona_responsable_id: null,
    activo: true,
    creado_en: ahora,
    actualizado_en: ahora,
  },
];

const equipos = [
  { id: 1, ambiente_id: 1, codigo_activo: 'LAB1-PC-001', tipo: 'COMPUTADORA', marca: 'Dell', modelo: 'OptiPlex 7090', caracteristicas: 'Intel i5, 16GB RAM, SSD 512GB', estado: 'OPERATIVO', fecha_alta: '2024-03-15', eliminado_en: null },
  { id: 2, ambiente_id: 1, codigo_activo: 'LAB1-PC-002', tipo: 'COMPUTADORA', marca: 'Dell', modelo: 'OptiPlex 7090', caracteristicas: 'Intel i5, 16GB RAM, SSD 512GB', estado: 'OPERATIVO', fecha_alta: '2024-03-15', eliminado_en: null },
  { id: 3, ambiente_id: 1, codigo_activo: 'LAB1-PC-003', tipo: 'COMPUTADORA', marca: 'HP', modelo: 'ProDesk 600 G6', caracteristicas: 'Intel i5, 8GB RAM, SSD 256GB', estado: 'EN_MANTENIMIENTO', fecha_alta: '2023-08-10', eliminado_en: null },
  { id: 4, ambiente_id: 1, codigo_activo: 'LAB1-PC-004', tipo: 'COMPUTADORA', marca: 'HP', modelo: 'ProDesk 600 G6', caracteristicas: 'Intel i5, 8GB RAM, SSD 256GB', estado: 'OPERATIVO', fecha_alta: '2023-08-10', eliminado_en: null },
  { id: 5, ambiente_id: 1, codigo_activo: 'LAB1-PC-005', tipo: 'COMPUTADORA', marca: 'Lenovo', modelo: 'ThinkCentre M70', caracteristicas: 'Intel i7, 16GB RAM, SSD 512GB', estado: 'OPERATIVO', fecha_alta: '2024-06-01', eliminado_en: null },
  { id: 6, ambiente_id: 1, codigo_activo: 'LAB1-PC-006', tipo: 'COMPUTADORA', marca: 'Lenovo', modelo: 'ThinkCentre M70', caracteristicas: 'Intel i7, 16GB RAM, SSD 512GB', estado: 'OPERATIVO', fecha_alta: '2024-06-01', eliminado_en: null },
  { id: 7, ambiente_id: 1, codigo_activo: 'LAB1-PROY-001', tipo: 'PROYECTOR', marca: 'Epson', modelo: 'PowerLite X49', caracteristicas: '3400 lúmenes, HDMI', estado: 'OPERATIVO', fecha_alta: '2023-02-20', eliminado_en: null },
  { id: 8, ambiente_id: 1, codigo_activo: 'LAB1-SW-001', tipo: 'SWITCH', marca: 'TP-Link', modelo: 'TL-SG1024', caracteristicas: '24 puertos Gigabit', estado: 'OPERATIVO', fecha_alta: '2022-11-05', eliminado_en: null },

  { id: 9, ambiente_id: 2, codigo_activo: 'LAB2-PC-001', tipo: 'COMPUTADORA', marca: 'Dell', modelo: 'OptiPlex 3080', caracteristicas: 'Intel i5, 8GB RAM, SSD 256GB', estado: 'OPERATIVO', fecha_alta: '2023-04-12', eliminado_en: null },
  { id: 10, ambiente_id: 2, codigo_activo: 'LAB2-PC-002', tipo: 'COMPUTADORA', marca: 'Dell', modelo: 'OptiPlex 3080', caracteristicas: 'Intel i5, 8GB RAM, SSD 256GB', estado: 'OPERATIVO', fecha_alta: '2023-04-12', eliminado_en: null },
  { id: 11, ambiente_id: 2, codigo_activo: 'LAB2-RT-001', tipo: 'ROUTER', marca: 'Cisco', modelo: 'RV340', caracteristicas: 'Router VPN, 4 puertos', estado: 'OPERATIVO', fecha_alta: '2022-09-30', eliminado_en: null },
  { id: 12, ambiente_id: 2, codigo_activo: 'LAB2-SW-001', tipo: 'SWITCH', marca: 'Cisco', modelo: 'Catalyst 2960', caracteristicas: '24 puertos FastEthernet', estado: 'EN_MANTENIMIENTO', fecha_alta: '2021-07-15', eliminado_en: null },
  { id: 13, ambiente_id: 2, codigo_activo: 'LAB2-SRV-001', tipo: 'SERVIDOR', marca: 'HPE', modelo: 'ProLiant DL380', caracteristicas: '2x Xeon, 32GB RAM', estado: 'OPERATIVO', fecha_alta: '2022-01-10', eliminado_en: null },

  { id: 14, ambiente_id: 3, codigo_activo: 'LAB3-OSC-001', tipo: 'OSCILOSCOPIO', marca: 'Tektronix', modelo: 'TBS1052B', caracteristicas: '2 canales, 50 MHz', estado: 'OPERATIVO', fecha_alta: '2023-03-03', eliminado_en: null },
  { id: 15, ambiente_id: 3, codigo_activo: 'LAB3-FUENTE-001', tipo: 'FUENTE', marca: 'B&K Precision', modelo: '1550', caracteristicas: 'Fuente DC regulable', estado: 'OPERATIVO', fecha_alta: '2023-03-03', eliminado_en: null },
  { id: 16, ambiente_id: 3, codigo_activo: 'LAB3-MULTI-001', tipo: 'MULTIMETRO', marca: 'Fluke', modelo: '117', caracteristicas: 'Multímetro digital', estado: 'EN_MANTENIMIENTO', fecha_alta: '2022-05-18', eliminado_en: null },
  { id: 17, ambiente_id: 3, codigo_activo: 'LAB3-SOLD-001', tipo: 'ESTACION_SOLDADURA', marca: 'Weller', modelo: 'WE1010', caracteristicas: 'Estación de soldadura 70W', estado: 'OPERATIVO', fecha_alta: '2023-10-01', eliminado_en: null },

  { id: 18, ambiente_id: 4, codigo_activo: 'DC-SRV-001', tipo: 'SERVIDOR', marca: 'Dell', modelo: 'PowerEdge R740', caracteristicas: '2x Xeon, 64GB RAM, RAID', estado: 'OPERATIVO', fecha_alta: '2021-12-01', eliminado_en: null },
  { id: 19, ambiente_id: 4, codigo_activo: 'DC-UPS-001', tipo: 'UPS', marca: 'APC', modelo: 'Smart-UPS 3000', caracteristicas: '3000VA, rack', estado: 'OPERATIVO', fecha_alta: '2021-12-01', eliminado_en: null },

  { id: 20, ambiente_id: 5, codigo_activo: 'TAL-COMP-001', tipo: 'COMPRESOR', marca: 'Schulz', modelo: 'MSV 20', caracteristicas: 'Compresor 20 pies', estado: 'DE_BAJA', fecha_alta: '2018-02-14', eliminado_en: '2025-01-20T15:30:00-04:00' },
];

const historial = [
  {
    id: 1,
    equipo_id: 3,
    estado_anterior: 'OPERATIVO',
    estado_nuevo: 'EN_MANTENIMIENTO',
    observacion: 'Falla detectada en el disco principal.',
    persona_id: 7,
    fecha_hora: '2024-09-10T10:00:00-04:00',
  },
  {
    id: 2,
    equipo_id: 20,
    estado_anterior: 'OPERATIVO',
    estado_nuevo: 'DE_BAJA',
    observacion: 'Equipo obsoleto, dado de baja por el Encargado.',
    persona_id: 6,
    fecha_hora: '2025-01-20T15:30:00-04:00',
  },
];

const auditoria = [];

const cachePersonas = [
  { persona_id: 1, ci: '9000001', nombre_completo: 'Ana María Rojas Vaca', cargo: 'Rector', actualizado_en: ahora },
  { persona_id: 2, ci: '9000002', nombre_completo: 'Carlos Eduardo Méndez Suárez', cargo: 'Académico', actualizado_en: ahora },
  { persona_id: 6, ci: '9000006', nombre_completo: 'Luis Fernando Añez Rivero', cargo: 'Encargado de Laboratorios', actualizado_en: ahora },
  { persona_id: 7, ci: '9000007', nombre_completo: 'Patricia Gutiérrez Nazareno', cargo: 'Técnico de Laboratorio', actualizado_en: ahora },
];

// Completar campos de control en equipos
for (const e of equipos) {
  if (!e.creado_en) e.creado_en = ahora;
  if (!e.actualizado_en) e.actualizado_en = ahora;
}

module.exports = { ambientes, equipos, historial, auditoria, cachePersonas };
