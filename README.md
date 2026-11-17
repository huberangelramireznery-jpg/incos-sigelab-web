# SIGELAB-INCOS

**Sistema de laboratorios, ambientes e inventario de equipos** del ecosistema INCOS-BENI.

Demo académico conforme al **Contrato de Conformidad v1.1.0** (núcleo SIA-INCOS en Railway). La autenticación institucional se delega en el SIA y solo se guarda `persona_id`. Como **módulo adicional del demo**, también existen cuentas locales SIGELAB con verificación por Gmail/WhatsApp y recuperación de contraseña (ver sección 4.1); este módulo no reemplaza la identidad del SIA.

> **Repositorio:** <https://github.com/huberangelramireznery-jpg/incos-sigelab-web>

---

## 1. Qué hace

- Registra **ambientes** (laboratorios, datacenter, taller) con un responsable del SIA.
- Registra **equipos** con código de activo único, tipo, marca, modelo y características.
- Mantiene el **inventario** con filtros por ambiente, estado, tipo y texto.
- Permite **cambiar el estado** de un equipo (OPERATIVO / EN_MANTENIMIENTO).
- Aplica **baja lógica** (`DE_BAJA`), conservando el historial y sin reutilizar el código.
- Guarda **historial de estados** (una fila por cambio, con `persona_id`).
- Guarda **auditoría** de altas, ediciones y bajas.
- Muestra un **dashboard** con tarjetas por ambiente y resumen por estado.
- Permite **crear cuentas locales SIGELAB** con correo Gmail y teléfono WhatsApp.
- Envía **códigos de 4 dígitos** para verificar la cuenta y para recuperar la contraseña.

---

## 2. Requisitos

- **Node.js 18 o superior** (probado con Node 24).
- Conexión a internet solo si se usa el SIA real. Con el simulador local no hace falta.

---

## 3. Arranque rápido (un solo comando)

```bash
npm install
npm start
```

Abrir: <http://127.0.0.1:4100>

`npm start` levanta automáticamente:
- el **núcleo SIA simulado** en el puerto 3000, y
- la **aplicación SIGELAB** en el puerto 4100.

El archivo `.env` está versionado **sin secretos**:

```env
API_ACADEMICO_URL=http://127.0.0.1:3000
PORT=4100
DB_BACKEND=auto
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_PROJECT_ID=incos-sigelab-2026
AUTH_DEMO_CODES=true
WHATSAPP_PROVIDER=demo
```

**Almacenamiento automático:**
- Si existe `serviceAccountKey.json` → usa **Firebase Firestore**.
- Si no existe → usa el archivo local `data/store.json` y el demo funciona igual.

**Base de datos en Firebase (ya creada):**
- Proyecto: `incos-sigelab-2026`
- Firestore: base `(default)`, región `southamerica-east1` (São Paulo)
- Consola: <https://console.firebase.google.com/project/incos-sigelab-2026/firestore/databases/-default-/data>

> Para usar Firestore en otra máquina, descarga el service account desde
> Firebase Console → Configuración → Cuentas de servicio y guárdalo como
> `serviceAccountKey.json` en la raíz. Sin ese archivo, el sistema usa el
> almacenamiento local automáticamente.

### Conectar con el SIA real

Editar `.env` y reiniciar:

```env
API_ACADEMICO_URL=https://sia-incos-demo.up.railway.app
PORT=4100
```

No se cambia ninguna línea de código (regla del contrato).

> **Nota:** al momento de crear este proyecto, la URL pública de Railway respondía
> `404 Application not found` (despliegue eliminado o expirado). Por eso se incluye el
> simulador local. Cuando el núcleo real vuelva a estar en línea, basta cambiar la variable.

---

## 4. Cuentas de demostración

Contraseña única: **`Demo2026*`**

| Cédula | Nombre | Rol | Cargo | Acceso en SIGELAB |
|---|---|---|---|---|
| 9000006 | Luis Fernando Añez Rivero | ADMINISTRATIVO | Encargado de Laboratorios | Todo |
| 9000007 | Patricia Gutiérrez Nazareno | SERVICIO | Técnico de Laboratorio | Consultar y cambiar estado |
| 9000001 | Ana María Rojas Vaca | ADMINISTRATIVO | Rector | Solo lectura |
| 9000002 | Carlos Eduardo Méndez Suárez | ADMINISTRATIVO | Académico | Solo lectura |
| 9000005 | Juan Pablo Quiroga Salas | Sin acceso | — | 403 (prueba) |
| 9000003 | María Elena Chávez Ortiz | ADMINISTRATIVO | Administrativo | 403 (no tiene SIGELAB) |

Las cuentas son ficticias (Anexo B del contrato).

### 4.1 Cuentas locales SIGELAB (módulo adicional)

Además de las cuentas SIA, el demo permite registrarse con:

- **Correo real de Google** (`@gmail.com` o `@googlemail.com`).
- **Número de WhatsApp** con código de país (Bolivia: `+591`).
- **Contraseña** de al menos 8 caracteres, con al menos una letra y un número.

Flujo:

1. En `/registro.html` se crea la cuenta y se envían **dos códigos de 4 dígitos**: uno al Gmail y otro al WhatsApp.
2. El código del correo **activa la cuenta**. El de WhatsApp confirma el número.
3. En `/login.html`, pestaña **Cuenta SIGELAB**, se ingresa con el Gmail o el teléfono.
4. En `/recuperar.html` (enlace **¿Olvidaste tu contraseña?**) se solicita un código por Gmail o WhatsApp y se define una nueva contraseña.

#### Modo demostración (por defecto)

```env
AUTH_DEMO_CODES=true
WHATSAPP_PROVIDER=demo
```

Los códigos se muestran en pantalla y en la consola del servidor. No requiere credenciales externas.

> **Importante:** el registro en modo real exige **ambos canales** configurados (Gmail y WhatsApp). Si falta uno, el servidor responde `503` antes de crear la cuenta. La recuperación de contraseña solo necesita el canal que el usuario elija.

#### Envío real por Gmail

1. Activar la verificación en dos pasos de la cuenta Gmail.
2. Crear una **contraseña de aplicación**: <https://myaccount.google.com/apppasswords>.
3. Completar en `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu-cuenta@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=SIGELAB-INCOS <tu-cuenta@gmail.com>
AUTH_DEMO_CODES=false
```

#### Envío real por WhatsApp con Twilio

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
AUTH_DEMO_CODES=false
```

- Con el **sandbox de Twilio**, cada destinatario debe unirse enviando el código `join ...` al número del sandbox.
- Para producción se necesita un número de WhatsApp aprobado.

#### Alternativa: Meta WhatsApp Cloud API

```env
WHATSAPP_PROVIDER=meta
META_WHATSAPP_TOKEN=...
META_WHATSAPP_PHONE_NUMBER_ID=...
META_WHATSAPP_API_VERSION=v20.0
AUTH_DEMO_CODES=false
```

Meta exige una **plantilla aprobada** para mensajes iniciados por la empresa fuera de la ventana de 24 horas.

#### Seguridad de las cuentas locales

- Las contraseñas se guardan con **scrypt** y sal aleatoria; nunca en texto plano.
- Los códigos se guardan como **HMAC-SHA256**, vencen en **10 minutos**, admiten **5 intentos** y tienen límite de reenvío.
- El secreto de las sesiones locales se genera en `data/local-jwt-secret` (ignorado por Git) o se toma de `JWT_LOCAL_SECRET`.
- Las cuentas locales nacen con rol `CONSULTA` (**solo lectura**). Para darles más permisos, cambiar el campo `rol` en `sigelab_usuarios` a `ADMINISTRATIVO` (Encargado) o `SERVICIO` (Técnico) y volver a iniciar sesión.
- Las cuentas locales **no reemplazan** al SIA: la cuenta SIA `9000006` sigue siendo la cuenta administrativa principal.

---

## 5. Reglas de permisos

Los permisos salen del **claim `roles`** y de los **cargos** del token, nunca de una tabla local.

| Rol `roles.SIGELAB` | Cargo | Permisos |
|---|---|---|
| `ADMINISTRATIVO` | Encargado de Laboratorios | Registrar/editar equipos, gestionar ambientes, dar de baja, cambiar estado, auditoría |
| `SERVICIO` | Técnico de Laboratorio | Consultar inventario y cambiar estado (no dar de baja ni crear/editar) |
| `ADMINISTRATIVO` | Otro (Rector, Académico) | Solo lectura |
| Sin `SIGELAB` | — | 403 al ingresar |

---

## 6. Reglas de negocio

- **Código de activo único:** si ya existe, la API responde `400 REGISTRO_DUPLICADO`.
- **Baja lógica:** el estado oficial es `DE_BAJA`; se conserva el historial y el código no se reutiliza.
- **Ambiente con equipos:** no se puede dar de baja (`409 CONFLICTO`). No hay borrado en cascada.
- **Cambio de estado:** inserta una fila en `sigelab_historial_estados` con el `persona_id` que lo hizo.
- **Ambiente en formulario:** se elige de una lista desplegable, no se escribe el ID.
- **Límite de 20 equipos por sala:** es **informativo**; la API devuelve una advertencia al superarlo.

---

## 7. Endpoints del SIGELAB

Todas las respuestas usan el sobre único del ecosistema:

```json
{ "exito": true, "datos": {}, "meta": null, "error": null }
```

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login contra el SIA y validación local del JWT |
| POST | `/api/auth/login-local` | Login con cuenta SIGELAB (Gmail/teléfono + contraseña) |
| POST | `/api/auth/registro` | Crear cuenta local y enviar códigos por Gmail/WhatsApp |
| POST | `/api/auth/verificar-codigo` | Verificar el código de correo o de WhatsApp |
| POST | `/api/auth/reenviar-codigo` | Reenviar un código de verificación |
| POST | `/api/auth/recuperar` | Solicitar código de recuperación de contraseña |
| POST | `/api/auth/restablecer` | Cambiar la contraseña usando el código |
| GET | `/api/auth/me` | Datos y permisos del token actual |
| GET | `/api/auth/config` | Configuración pública (SIA, modo demo, canales) |
| GET | `/api/dashboard` | Resumen por estado y por ambiente |
| GET | `/api/ambientes` | Ambientes con contador de equipos |
| POST | `/api/ambientes` | Crear ambiente (Encargado) |
| PUT | `/api/ambientes/:id` | Editar ambiente (Encargado) |
| DELETE | `/api/ambientes/:id` | Baja de ambiente sin equipos (Encargado) |
| GET | `/api/equipos` | Inventario con filtros |
| GET | `/api/equipos/catalogos` | Estados y tipos para formularios |
| GET | `/api/equipos/:id` | Detalle de equipo |
| POST | `/api/equipos` | Registrar equipo (Encargado) |
| PUT | `/api/equipos/:id` | Editar equipo (Encargado) |
| POST | `/api/equipos/:id/estado` | Cambiar estado (Encargado o Técnico) |
| DELETE | `/api/equipos/:id` | Baja lógica (solo Encargado) |
| GET | `/api/equipos/:id/historial` | Historial del equipo |
| GET | `/api/auditoria` | Auditoría (solo Encargado) |
| GET | `/api/personas` | Proxy autenticado al SIA (con respaldo en caché) |
| GET | `/api/personas/:id/cargos` | Cargos de una persona |
| GET | `/salud-integracion` | **Obligatorio del contrato** (público) |
| GET | `/health` | Chequeo simple del demo |
| GET | `/api/estado` | Diagnóstico del demo |

### Endpoints del SIA que consume

- `POST /api/v1/auth/ingresar`
- `GET /api/v1/auth/clave-publica` y `GET /.well-known/jwks.json`
- `GET /api/v1/personas`
- `GET /api/v1/personas/:id/cargos`

---

## 8. Seguridad e integración

- El login **SIA** nunca valida contraseñas localmente: las envía al núcleo.
- El JWT del SIA se valida **en el servidor** con la clave pública (`RS256`, emisor `sia-incos`, expiración).
- Las **cuentas locales** usan contraseñas con `scrypt` y un JWT propio (`HS256`, emisor `sigelab-local`) que el middleware también valida. La versión del token (`tv`) permite invalidar sesiones al cambiar la contraseña.
- La clave pública del SIA se cachea **10 minutos**.
- Los códigos de 4 dígitos se guardan como HMAC, vencen a los 10 minutos y tienen límite de intentos y reenvíos.
- En modo real (`AUTH_DEMO_CODES=false`), la solicitud de recuperación responde igual exista o no la cuenta, para no revelar correos/teléfonos registrados.
- Si el SIA no responde:
  - el demo sigue en línea y en **modo lectura** con lo ya guardado;
  - `/salud-integracion` reporta `siaEstado: "SIN_CONEXION"`;
  - se reconecta solo cuando el núcleo vuelve.
- Solo se guarda `persona_id`. Los nombres son **caché de lectura** y nunca deciden permisos.
- No se accede a MySQL ni se abren puertos del núcleo.

---

## 9. Base de datos en Firebase

La base de datos propia está **creada y operativa en Firebase Firestore**:

| Dato | Valor |
|---|---|
| Proyecto | `incos-sigelab-2026` |
| Base de datos | `(default)` |
| Región | `southamerica-east1` (São Paulo) |
| Consola | <https://console.firebase.google.com/project/incos-sigelab-2026/firestore/databases/-default-/data> |
| Credencial | `serviceAccountKey.json` (cuenta `sigelab-backend@incos-sigelab-2026.iam.gserviceaccount.com`) |

### Configuración aplicada

- `firebase.json` y `.firebaserc` apuntan al proyecto.
- `firestore.rules` **bloquea todo acceso directo desde el navegador**: solo el backend (Admin SDK) lee y escribe.
- `firestore.indexes.json` define índices para equipos e historial.
- Reglas e índices desplegados con:
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes --project incos-sigelab-2026
  ```

### Backends disponibles

| `DB_BACKEND` | Comportamiento |
|---|---|
| `auto` (por defecto) | Firestore si existe la clave; si no, archivo JSON |
| `firestore` | Obliga a Firebase Firestore |
| `file` | Archivo `data/store.json` (sin internet) |

### Colecciones (prefijo `sigelab_`)

- `sigelab_ambientes`
- `sigelab_equipos`
- `sigelab_historial_estados`
- `sigelab_auditoria`
- `sigelab_cache_personas`
- `sigelab_usuarios` (cuentas locales; contraseñas con scrypt)
- `sigelab_codigos` (códigos de verificación/recuperación)
- `sigelab_contadores` (IDs numéricos)

El **borrado nunca es en cascada**: la baja de equipos es lógica (`estado = DE_BAJA`).
Las colecciones `sigelab_usuarios` y `sigelab_codigos` **no se borran** al ejecutar `npm run seed`; así las cuentas creadas sobreviven a la recarga de datos de laboratorio.

### Volver a sembrar los datos

```bash
npm run seed
```

### Usar otro proyecto o el emulador

```env
# Otro proyecto Firebase
GOOGLE_APPLICATION_CREDENTIALS=./otra-clave.json
FIREBASE_PROJECT_ID=otro-proyecto

# Emulador local (sin credenciales)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_PROJECT_ID=demo-sigelab
DB_BACKEND=firestore
```

> `serviceAccountKey.json` está en `.gitignore`: nunca se sube al repositorio.
> Si se pierde, se regenera en Firebase Console → Configuración → Cuentas de servicio.

---

## 10. Verificación de conformidad

Con el demo en ejecución:

```bash
npm run verify
```

El script `scripts/verificar-demo.js` prueba, entre otras cosas:

- `/salud-integracion` con el contrato del Anexo A;
- login contra el SIA y validación del token;
- 403 para cuentas sin acceso o sin rol SIGELAB;
- **registro local con Gmail/WhatsApp, código de 4 dígitos, activación y login**;
- **cuenta local solo lectura: no puede crear equipos (403)**;
- **recuperación de contraseña con código y bloqueo de la contraseña anterior**;
- código de activo duplicado → 400;
- Técnico intentando dar de baja → 403;
- Técnico cambiando estado → 200 + fila de historial;
- borrar un ambiente con equipos → 409;
- baja lógica y conservación del historial.

Resultado esperado: **65 pruebas aprobadas, 0 fallidas**.

---

## 11. Checklist del contrato

- [x] Arranca con `npm install` y `npm start`.
- [x] Lee `API_ACADEMICO_URL` y `PORT` del entorno.
- [x] Login contra `POST /api/v1/auth/ingresar` (sin validar contraseñas localmente).
- [x] Valida la firma RS256 con la clave pública del núcleo.
- [x] Rechaza con 403 si el claim `roles` no contiene `SIGELAB`.
- [x] Guarda solo `persona_id`; los nombres son caché.
- [x] Expone `GET /salud-integracion` con el contrato del Anexo A.
- [x] Modo lectura y aviso si el núcleo se cae; reconexión automática.
- [x] HTTPS al dominio publicado, sin IPs fijas.
- [x] No incluye cadenas de conexión a MySQL ni accede a la base del núcleo.
- [x] Incluye `scripts/verificar-demo.js` con pruebas aprobadas.
- [x] `README.md` con puerto, variables, cuentas y arranque.
- [x] `.env.example` versionado, sin secretos reales.

> **Nota sobre el contrato:** el módulo de cuentas locales es una extensión solicitada para el demo. La autenticación institucional del contrato sigue siendo el SIA; las cuentas locales se almacenan aparte (`sigelab_usuarios`) y no interfieren con `persona_id` ni con los permisos del SIA.

---

## 12. Estructura del proyecto

```
incos-sigelab-web/
├── public/                 Frontend (mismo origen, sin CORS)
│   ├── login.html
│   ├── registro.html      Crear cuenta + códigos Gmail/WhatsApp
│   ├── recuperar.html     ¿Olvidaste tu contraseña?
│   ├── index.html          Dashboard
│   ├── inventario.html
│   ├── equipos.html        Alta / edición
│   ├── ambientes.html
│   ├── historial.html
│   ├── css/app.css
│   └── js/api.js, ui.js
├── src/
│   ├── server.js           Express
│   ├── config.js
│   ├── sia/client.js       Login, clave pública, validación JWT
│   ├── middleware/auth.js  Autenticación SIA + cuentas locales
│   ├── routes/             auth, ambientes, equipos, personas, dashboard, auditoría, salud
│   ├── services/           permisos, nombres, localAuth, email, whatsapp, rateLimit
│   ├── db/                 fileStore, firestore, seed
│   └── utils/              respuesta, async, fecha
├── mock-sia/server.js      Núcleo SIA simulado (contrato v1)
├── scripts/verificar-demo.js
├── firebase.json           Configuración de Firebase CLI
├── .firebaserc             Proyecto incos-sigelab-2026
├── firestore.rules         Reglas (acceso solo desde el backend)
├── firestore.indexes.json  Índices de Firestore
├── serviceAccountKey.json  Credencial del backend (no se versiona)
├── data/store.json         Solo si DB_BACKEND=file
├── data/local-jwt-secret   Secreto local de sesiones (no se versiona)
├── .env.example
└── README.md
```

---

## 13. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `SIN_CONEXION` al ingresar | El simulador o el SIA real no está en línea | Ejecutar `npm run mock-sia` o revisar `API_ACADEMICO_URL` |
| `403 SIN_PERMISO` | La cuenta no tiene `SIGELAB` en `roles` | Usar 9000006, 9000007, 9000001 o 9000002 |
| Cuenta local no puede crear equipos | Rol local `CONSULTA` (solo lectura) | Cambiar `rol` en `sigelab_usuarios` a `ADMINISTRATIVO` o `SERVICIO` y volver a ingresar |
| No llega el código por Gmail | SMTP no configurado o contraseña de aplicación incorrecta | Completar `SMTP_*` y revisar la consola; en demo el código aparece en pantalla |
| No llega el código por WhatsApp | `WHATSAPP_PROVIDER=demo` o sandbox sin unirse | Configurar Twilio/Meta o enviar `join ...` al sandbox |
| `ESPERAR` al reenviar código | Límite de 60 segundos entre reenvíos | Esperar un minuto |
| `CODIGO_EXPIRADO` | El código vence a los 10 minutos | Solicitar uno nuevo |
| `401 TOKEN_INVALIDO` | Token vencido o clave distinta | Volver a ingresar |
| `404 RUTA_NO_ENCONTRADA` | Ruta con tilde | Usar `/api/v1/auth/clave-publica` sin tilde |
| El SIA real no resuelve | Dominio de Railway eliminado | Usar el simulador y reportarlo al equipo del SIA |
| `EADDRINUSE` | Puerto ocupado | Cambiar `PORT` o cerrar el proceso anterior |

---

**Equipo SIGELAB-INCOS · Ecosistema INCOS-BENI · 2026**
