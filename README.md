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

Versión 0.3. Interfaz para OCR local de pedidos y DNI con Tesseract.js (español) y PDF.js. Motor, modelo y workers se sirven desde el sitio; no hay API de subida a Vercel. Los archivos, el texto y los valores OCR se mantienen en memoria. `localStorage` conserva la estructura del formulario, las asignaciones, los valores fijos y las reglas. Una plantilla exportada contiene esos valores fijos y las opciones del formulario: revisarla antes de compartirla.

La extensión Manifest V3 (`extension/ocrtrabajo`) se descarga como ZIP. Reconoce controles HTML, radios, checkboxes y switches ARIA, incluyendo los campos presentes en paneles ocultos. Recorre pestañas ARIA y Bootstrap con destino en la misma página, incluidas pestañas anidadas y paneles que cargan sus controles después del clic. Excluye contraseñas, campos hidden y botones de acción. No copia los valores escritos al esquema. La sesión de Google permanece en la intranet.

«Explorar variantes» prueba opciones en un expediente de prueba, acumula campos y registra las selecciones necesarias para que aparezcan. Guarda el estado inicial únicamente en memoria del content script e intenta restaurarlo al finalizar. No puede revertir efectos de autoguardado del servidor. La búsqueda está limitada a 120 estados, 75 segundos, 25 opciones por campo y profundidad 3; prioriza controles recién revelados y explora pares de opciones. El informe indica límites y dependencias no resueltas; no promete explorar todas las combinaciones posibles. No navega a rutas distintas ni entra en iframes.

Las reglas comparan datos o texto, validan fechas y permiten valores alternativos explícitos ante datos ausentes. El estado del DNI usa su caducidad y el tipo DNI/NIE requiere una letra de control válida. La comparación de domicilios solo declara coincidencia tras normalizar; una diferencia requiere revisión. El OCR por etiquetas es orientativo y debe revisarse con documentos de ejemplo representativos.

El rellenado filtra ramas que no aplican, acciona primero controles de elección, reintenta campos dependientes y comprueba que el navegador haya aceptado el valor. Se confirma en la intranet y el usuario decide si reemplazar valores existentes. No pulsa Guardar. Los inputs de archivo compatibles reciben los documentos elegidos mediante DataTransfer (hasta 20 MB por operación); esto puede iniciar una subida a la intranet, igual que al adjuntar manualmente.

No se ha validado aún contra una sesión autenticada de Autocarpe. Las pruebas usan formularios ficticios con estructura equivalente y la extensión real en Chromium:

```sh
npm run build
npm test
node scripts/check-ocr-rules.mjs
python3 scripts/check-ocr.py
python3 scripts/check-ocr-extension.py
```

Para los scripts Python se necesitan Playwright y Chromium instalados; `check-ocr.py` usa el sitio servido en localhost:3000. El modelo español de tessdata_fast se distribuye bajo Apache-2.0, ver `assets/ocr-models/LICENSE`. Las dependencias están fijadas en package-lock.json.

El perfil Autocarpe interpreta el resumen comercial de pedidos Renault/Dacia, mantiene la prioridad del DNI, separa marca/modelo/versión/motor y une opciones con « + ». PFF suma modelo, color, tapicería y opciones; TTE es transporte y Total a cobrar no descuenta señal ni vehículo entregado. Los descuentos Crédito/Preference indican financiación. El previo editable muestra procedencia y dudas. Los valores habituales, categoría tribrid y criterio de fecha se configuran localmente. El lector conserva las columnas del PDF y combina orientaciones y lecturas OCR del documento de identidad.

Comprobaciones OCR: scripts/check-ocr-rules.mjs, scripts/check-ocr-autocarpe.mjs, scripts/check-ocr.py (servidor local en 3000) y scripts/check-ocr-extension.py (Playwright/Chromium). Las pruebas del repositorio usan datos ficticios; no incluir documentos reales ni resultados privados. La prueba de la extensión simula la intranet, no sustituye la comprobación en una sesión real de Autocarpe.
