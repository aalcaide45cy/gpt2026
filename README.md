# Norte Reformas

Landing page para una empresa de reformas, construida con Next.js y preparada para desplegarse en Vercel.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Producción

```bash
npm run build
npm start
```

El proyecto usa el App Router de Next.js y no requiere variables de entorno.

## Despliegue en Vercel

1. Importa el repositorio en Vercel.
2. Deja el directorio raíz en `.` y selecciona el preset **Next.js**.
3. Usa Node.js 20 o posterior. No es necesario configurar variables de entorno.

El archivo `vercel.json` fija explícitamente los comandos de instalación y compilación. Las tipografías usan alternativas del sistema para que el build no dependa de descargar archivos desde Google Fonts.
