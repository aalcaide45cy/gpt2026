# Estudio Web + Motoyayos

Catálogo de 45 gremios con tres composiciones por gremio (135 webs): editorial, inmersiva y directa. Cada versión dispone de su propia URL y contenido específico del sector. Incluye búsqueda, filtros por categoría y ticket alto, comparador por gremio y formularios de demostración que no envían ni almacenan datos.

Motoyayos tiene una identidad propia basada en el llavero proporcionado: logotipo recreado con fondo transparente en WebP, blog, filtros por categoría y seis artículos de muestra. Los textos e imágenes se identifican como demostraciones, pendientes de sustituir por experiencias y fotografías reales del propietario.

## Desarrollo y validación

No se necesitan dependencias externas. Node.js 20 o posterior.

```sh
npm run build
npm test
npm start
```

Abre http://localhost:3000. El comando de servidor usa Python. Edita `src/sectors.mjs` para los gremios, `src/posts.mjs` para el blog, `scripts/build.mjs` para las composiciones y `src/style.css` para los estilos.

## Publicación

Vercel publica la rama `main`. `vercel.json` configura una compilación estática a `dist`, sin framework ni variables de entorno. Mantener Framework Preset en Other si existiera un override manual en Vercel. La página de inicio está en `/`, las comparaciones en `/sectores/{gremio}/`, las demos en `/demos/{gremio}/{1|2|3}/` y Motoyayos en `/motoyayos/`.

Todos los archivos raster publicados son WebP. Se incluyen imágenes temáticas específicas de los 45 gremios y recursos para el blog, generados para esta demostración; no son fotografías de empresas reales. El logotipo es una recreación a partir de la referencia, no una vectorización exacta. No se utiliza la fotografía del llavero ni se publica información de contacto inventada.

La web de prueba anterior se reemplaza por completo en el árbol actual. El historial Git se conserva para poder revertir y mantener la conexión con Vercel.
