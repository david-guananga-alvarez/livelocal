# LiveLocal Modular v6.4 — Google Login

Esta versión añade autenticación con Google usando Supabase Auth.

## Ejecutar en local

```bash
npm install
npm run dev
```

## Modo desarrollo sin Supabase

Si no configuras variables de entorno, el botón **Continuar con Google** crea una sesión demo local para que puedas probar la app sin backend.

## Activar login real con Gmail/Google

### 1. Crear proyecto en Supabase

1. Entra en Supabase.
2. Crea un proyecto nuevo.
3. Ve a **Project Settings → API**.
4. Copia:
   - Project URL
   - anon public key

### 2. Crear `.env.local`

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Rellena:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

### 3. Activar Google Provider en Supabase

En Supabase:

**Authentication → Providers → Google → Enable**

Necesitarás crear credenciales OAuth en Google Cloud Console y pegar:

- Client ID
- Client Secret

En Google Cloud, añade como redirect URI autorizado:

```txt
https://TU-PROYECTO.supabase.co/auth/v1/callback
```

### 4. URLs permitidas en Supabase

En Supabase:

**Authentication → URL Configuration**

Para desarrollo:

```txt
http://localhost:5173
```

Para producción en Vercel:

```txt
https://tu-dominio.vercel.app
```

## Qué incluye

- Módulo `auth/` separado.
- Login con Google mediante Supabase OAuth.
- Cierre de sesión.
- Menú de usuario.
- Estado local separado por usuario.
- Fallback demo si Supabase no está configurado.

## Siguiente paso

Ahora el login existe, pero las peticiones siguen guardándose en `localStorage`. Para multiusuario real hay que migrar requests, locals, messages y ubicación a Supabase Database + Realtime.
