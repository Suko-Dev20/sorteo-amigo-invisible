# 🎄 Sorteo Amigo Invisible de Navidad (WhatsApp + MySQL XAMPP)

Aplicación web navideña para organizar sorteos de **Amigo Invisible** en local, gestionando la base de datos directamente en tu **MySQL de XAMPP / phpMyAdmin** y enviando el resultado a cada participante por **WhatsApp**.

## Stack Elegido

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4 + Canvas Confetti
- **Backend**: Node.js + Express + TypeScript + Zod
- **Base de datos**: MySQL / MariaDB local en **XAMPP** (totalmente visible y gestionable en `http://localhost/phpmyadmin`)
- **WhatsApp (4 modos integrados)**:
  1. **Simulador Local**: ideal para probar el flujo completo sin mandar mensajes reales (registra todo en MySQL `notification_logs`).
  2. **Enlaces `wa.me` (1 clic)**: gratis y 0% riesgo; abre WhatsApp con el mensaje y el enlace secreto ya redactados.
  3. **Automático por QR (Baileys)**: escanea un QR desde la propia web (como WhatsApp Web) y envía automáticamente los mensajes con una pausa segura de 2.5–4.5s entre personas.
  4. **Meta WhatsApp Cloud API**: oficial de Meta (configurando `META_WHATSAPP_TOKEN` y `META_PHONE_NUMBER_ID` en `backend/.env`).

---

## Puesta en Marcha en Local (Paso a Paso)

### 1. Arrancar MySQL (y Apache para phpMyAdmin) en XAMPP
1. Abre el **Panel de Control de XAMPP**.
2. Pulsa **Start** en **MySQL** (y en **Apache** si quieres abrir `http://localhost/phpmyadmin`).

### 2. Crear la Base de Datos `amigo_invisible`
Tienes dos formas equivalentes:
- **Automática (recomendada)**:
  ```powershell
  npm run db:init
  ```
- **Manual desde phpMyAdmin**:
  Abre `http://localhost/phpmyadmin`, ve a la pestaña **Importar** y selecciona el archivo [`db/schema.sql`](db/schema.sql).

### 3. Arrancar Backend + Frontend
```powershell
npm run dev
```
- **Web (Frontend)**: `http://localhost:5173`
- **API (Backend)**: `http://localhost:3001`
- **Base de datos (phpMyAdmin)**: `http://localhost/phpmyadmin`

---

## Comandos Útiles

| Comando | Descripción |
| :--- | :--- |
| `npm run install:all` | Instala dependencias de backend y frontend |
| `npm run db:init` | Crea la base de datos `amigo_invisible` y todas sus tablas en XAMPP MySQL |
| `npm run dev` | Arranca API (puerto 3001) y Web (puerto 5173) a la vez |
| `npm test` | Ejecuta las pruebas unitarias del algoritmo de sorteo y exclusiones |
| `npm run build` | Compila backend y frontend para producción |

---

## Modo Anti-Spoiler

Por defecto, cada sorteo se crea con el **Modo Anti-Spoiler** activado:
- El organizador nunca ve en pantalla a quién le tocó regalar cada persona.
- Cada participante recibe un enlace único (`/revelar/<token>`) que abre un sobre navideño animado con confeti.
- El panel indica quién ha abierto ya su sobre (`Visto`) sin revelar su amigo invisible.
