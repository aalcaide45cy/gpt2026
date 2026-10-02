# Revisión funcional de las demostraciones

Revisión del 2 de octubre de 2026. Se sustituyen las páginas genéricas por experiencias orientadas a las tareas del cliente. Las referencias se utilizan para identificar patrones de navegación y funcionalidades; los diseños, textos y datos de ejemplo son propios.

## Referencias consultadas

| Referencia | Observación contrastada | Aplicación |
|---|---|---|
| [Fresha](https://www.fresha.com/es) y [Treatwell](https://www.treatwell.es/) | Búsqueda de servicios y reserva online de belleza | Servicios con duración y precio, profesional, fecha, horarios, confirmación y cancelación |
| [Clicars](https://www.clicars.com/) | Stock de vehículos, favoritos y financiación | Catálogo filtrable, fichas, comparación, simulador de cuota y reserva de unidad |
| [Fotocasa](https://www.fotocasa.es/) | Búsqueda por operación, alertas, valoración y calculadora hipotecaria | Compra/alquiler, filtros, favoritos, comparación y visitas; cuota hipotecaria orientativa |
| [La Tagliatella](https://www.latagliatella.es/) | Carta por categorías, información de alérgenos, reserva de mesa, recogida y reparto | Carta filtrable, selección de platos, fecha, turno, número de comensales; pedidos en los gremios de obrador y cafetería |
| [Habitissimo](https://www.habitissimo.es/) | Gremios específicos, guías de precios y petición de presupuesto | Configuradores propios con unidades, acabados, extras y desglose descargable |
| [Holaluz](https://www.holaluz.com/) | Información de autoconsumo y precios de placas solares | Dimensionado orientativo por potencia y opciones de batería, cargador y monitorización |
| [Doctoralia](https://www.doctoralia.es/) | Especialidades, consulta presencial/online y cita | Servicio, profesional, duración y agenda adaptada a cada clínica |
| [Basic-Fit](https://www.basic-fit.com/es-es) | Precios, instalaciones, entrenamiento personal y suscripción | Actividades, entrenadores, horario, reserva y comparación de bonos |
| [EscapadaRural](https://www.escapadarural.com/) | Búsqueda de casas y reserva de escapadas | Fechas, ocupación, capacidad, noches, extras y total |
| [Europcar](https://www.europcar.es/es-es) | Categorías de flota, alquiler por duración y gestión de reserva | Fechas, pasajeros, vehículo, segundo conductor y cancelación |
| [IKEA](https://www.ikea.com/es/es/) | Carrito, recogida, planificadores y asesoramiento | Cestas con cantidades, recogida/entrega; configuración de muebles |
| [Arriaga Asociados](https://www.arriagaasociados.com/) | Áreas jurídicas y cita | Consulta por especialidad y agenda |
| [Bodas.net](https://www.bodas.net/) | Agenda, invitados, mesas y presupuestador | Invitados, fecha, coordinación y extras con presupuesto desglosado |
| [Domestika](https://www.domestika.org/es/courses) | Catálogo de cursos organizado por especialidad | Programa, categoría, profesor, duración y solicitud de plaza |

La Tagliatella se revisó en navegador porque la respuesta HTML inicial solo contenía la aplicación vacía. Otras páginas devolvieron controles de acceso o errores (entre ellas Coches.net, Idealista, TheFork, Leroy Merlin y Norauto); no se utilizan como evidencia de una revisión completada. Indexa redirigió a una versión francesa, por lo que no se trasladan sus tarifas ni supuestos a la demo de inversiones.

## Alcance de las demostraciones

Las operaciones son completas dentro del prototipo: elegir, calcular, revisar, confirmar, descargar y cancelar. Los datos y los horarios son ilustrativos. Las gestiones se guardan en el navegador por gremio y se comparten entre sus tres versiones. No se envían solicitudes a empresas, no se procesa ningún pago, no existe disponibilidad multiusuario y no se bloquea stock real. Para convertir una demo en una web comercial se conectaría su servicio de reservas, catálogo, pasarela y base de datos.

La reserva de coches muestra una señal ilustrativa sin solicitar datos bancarios. Las simulaciones de financiación muestran capital, intereses y total con los parámetros introducidos. La calculadora de inversiones admite escenarios negativos y no promete resultados. Los presupuestos explican sus unidades y exclusiones.

## Validación

La revisión automatizada comprueba enlaces, recursos y estructura de las 189 páginas. El recorrido de navegador recorre las 135 demos: ejecuta su operación principal hasta la confirmación, descarga el resumen y cancela la gestión. También comprueba desbordamientos a 390 px y errores JavaScript. Los casos específicos incluyen favoritos, comparación, cestas, extras, agenda, datos de fechas y presupuestos. Se inspeccionan visualmente las composiciones representativas en escritorio y móvil.
