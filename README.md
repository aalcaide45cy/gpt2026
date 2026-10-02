# Estudio Web + Motoyayos

Catálogo de 45 gremios con tres experiencias por gremio (135 webs). Cada versión tiene su propia URL, composición y funciones de negocio. Incluye stock de vehículos con favoritos, comparador, financiación y reserva; agendas por servicio y profesional; búsqueda inmobiliaria y visitas; cartas y reservas de mesa; tiendas con cestas, recogida y entrega; configuradores de presupuestos; alojamientos y alquiler por fechas; cursos, clases y planificación de inversiones.

Las gestiones de demostración se guardan en localStorage por gremio: se pueden revisar, descargar y cancelar. No se procesan pagos ni se envían solicitudes, y no se bloquea disponibilidad real. Los formularios no solicitan tarjetas ni datos clínicos. Para uso comercial hay que conectar reservas, stock y pagos a servicios reales.

Motoyayos tiene una identidad propia basada en el llavero proporcionado: logotipo recreado con fondo transparente en WebP, blog, filtros por categoría y seis artículos de muestra. Los textos e imágenes se identifican como demostraciones, pendientes de sustituir por experiencias y fotografías reales del propietario.

## Desarrollo y validación

No se necesitan dependencias externas. Node.js 20 o posterior.

```sh
npm run build
npm test
npm start
```

Abre http://localhost:3000. El comando de servidor usa Python. Edita `src/sectors.mjs` para el catálogo y `src/verticals.mjs` para productos, servicios, personal, capacidades y precios de cada gremio. Las experiencias se generan en `src/experience.mjs`, sus funciones están en `src/experience.js` y sus estilos en `src/experience.css`. El blog usa `src/posts.mjs`.

La revisión funcional y sus referencias están en `research/REFERENCIAS.md` y el detalle de los 45 gremios en `research/AUDITORIA.md`. Con Python y Playwright instalados se puede ejecutar `python scripts/browser-check.py http://localhost:3000` para probar los 135 recorridos completos. `scripts/render-previews.py` genera las vistas previas reales en WebP con un servidor en el puerto 3002.

## Publicación

Vercel publica la rama `main`. `vercel.json` configura una compilación estática a `dist`, sin framework ni variables de entorno. Mantener Framework Preset en Other si existiera un override manual en Vercel. La página de inicio está en `/`, las comparaciones en `/sectores/{gremio}/`, las demos en `/demos/{gremio}/{1|2|3}/` y Motoyayos en `/motoyayos/`.

Todos los archivos raster publicados son WebP. Se incluyen imágenes temáticas específicas de los 45 gremios y recursos para el blog, generados para esta demostración; no son fotografías de empresas reales. El logotipo es una recreación a partir de la referencia, no una vectorización exacta. No se utiliza la fotografía del llavero ni se publica información de contacto inventada.

La web de prueba anterior se reemplaza por completo en el árbol actual. El historial Git se conserva para poder revertir y mantener la conexión con Vercel.

## OCR Trabajo · `/ocrtrabajo/`

Interfaz para OCR local de pedidos y DNI con Tesseract.js (español) y PDF.js. Motor, modelo y workers se sirven desde el propio sitio; los archivos se procesan en el navegador. No hay API de subida. Solo la plantilla de etiquetas y asignaciones se guarda en localStorage; documentos, texto y valores OCR se mantienen en memoria. Descargar una plantilla exporta las reglas y las opciones fijas seleccionadas: revisarlas antes de compartirla.

La extensión Manifest V3 de `extension/ocrtrabajo` se distribuye como ZIP en la página. Reconoce controles HTML visibles en la pestaña activa de la intranet y acumula las secciones en `chrome.storage.session` sin leer valores existentes. La interfaz importa ese esquema y permite elegir los campos, el dato de origen y opciones fijas de desplegables. El intercambio página–extensión es local. El usuario inicia sesión con Google directamente en la intranet.

El rellenado requiere confirmación en la intranet, evita sobrescribir valores y no pulsa Guardar. Puede abrir pestañas con `role=tab` y selectores únicos. Los controles personalizados, las pestañas sin identificadores, las rutas distintas, los adjuntos y los campos que dependen de otros requieren adaptación con el formulario real. Todavía no se ha validado contra una sesión autenticada de Autocarpe. La extracción por etiquetas es orientativa y necesita revisión; no supone reconocimiento semántico completo de un DNI.

Validación adicional: `python3 scripts/check-ocr.py` y `python3 scripts/check-ocr-extension.py` con Playwright y Chromium instalados. Prueba asignaciones, persistencia sin valores personales, limpieza y rellenado de un formulario representativo. Las dependencias están fijadas en package-lock.json. El modelo español de `tessdata_fast` está bajo licencia Apache-2.0; ver `assets/ocr-models/LICENSE`.
