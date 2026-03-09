# Explicación simple de cómo funciona DondeEsHoy

*Versión pensada para entender el sistema sin hablar “en programador”.*

---

## 1. Qué hace este sistema

Imaginá que DondeEsHoy es como una **agenda gigante de eventos de Uruguay**.

En vez de que una persona cargue todo a mano, el sistema:

1. va a distintas páginas de eventos,
2. recoge la información,
3. la ordena,
4. borra repeticiones,
5. corrige cosas si puede,
6. y la muestra en la web.

La idea es que una persona entre al sitio y vea en un solo lugar:

- conciertos,
- fiestas,
- teatro,
- ferias,
- eventos culturales,
- deporte,
- y más.

---

## 2. Las partes del sistema, explicadas fácil

### Las fuentes

Son páginas externas de donde sale la información.

Por ejemplo:

- RedTickets
- CobraTicket
- TicketFacil
- Cartelera
- MVD Eventos
- Entraste
- MiEntrada

Cada una publica eventos a su manera.

El problema es que **ninguna usa exactamente el mismo formato**.

Una puede poner bien la fecha.
Otra puede escribirla raro.
Otra puede tener precio pero no dirección.
Otra puede tener dirección pero no coordenadas.

Entonces el sistema tiene que hacer de “traductor”.

---

### Los scrapers

Los scrapers son como **robots recolectores**.

Van a esas páginas y traen los datos.

No deciden todavía si un evento está bien o mal. Primero solo lo juntan.

Es como si fueran personas que llenan cajas con información que encontraron.

---

### La base de datos cruda

Después de recolectar, el sistema guarda todo en una especie de depósito inicial.

Ahí todavía está la información “sin peinar”.

Puede venir con:

- textos desordenados,
- fechas raras,
- nombres duplicados,
- lugares mal escritos,
- o cosas que ni siquiera son eventos reales.

Ese depósito existe para no perder nada y poder procesarlo después con más calma.

---

### El pipeline

El pipeline es la **línea de producción**.

Ahí el sistema toma cada evento crudo y lo transforma en algo usable.

Hace cosas como:

- limpiar textos,
- entender fechas y horas,
- detectar si es gratis o pago,
- adivinar de qué tipo de evento se trata,
- ubicarlo en un departamento,
- encontrar si ya existía,
- y dejar una versión final prolija.

Si pensás en una fábrica, el scraper trae materia prima y el pipeline la convierte en producto final.

---

### La web

Una vez que el evento ya está limpio, aparece en la web.

Ahí el usuario puede:

- ver qué hay hoy,
- ver próximos eventos,
- mirar el mapa,
- filtrar por tipo,
- buscar por texto,
- ver eventos gratis,
- ordenar por cercanía,
- y abrir el detalle de cada evento.

---

## 3. Qué es una API, explicado sin vueltas

Una **API** es una forma ordenada de pedirle algo a un sistema.

Pensalo como una **ventanilla**.

En vez de meter mano en la base de datos o en las tripas del sistema, otra parte le hace un pedido claro:

- “dame eventos de hoy”
- “guardá esta suscripción”
- “contá una vista”
- “procesá nuevos eventos”

La API recibe el pedido, hace el trabajo y devuelve una respuesta.

---

## 4. Cómo se conectan las APIs en este sistema

Acá hay varios tipos de APIs.

### APIs que usa la parte visible del sitio

Estas ayudan a que la web funcione.

Por ejemplo:

- una para buscar eventos,
- una para contar visitas,
- una para ver qué eventos están en tendencia,
- una para mandar formularios,
- una para suscribirse al newsletter.

Entonces el flujo sería algo así:

1. una persona entra a la web,
2. toca un filtro o manda un formulario,
3. la web llama a una API interna,
4. la API revisa o guarda datos,
5. y devuelve el resultado.

---

### APIs internas de administración

Hay otras APIs que no son para la gente normal que entra al sitio, sino para el panel admin.

Sirven para:

- iniciar sesión,
- ver estadísticas,
- revisar eventos enviados,
- volver a procesar datos,
- correr scrapers a mano,
- revisar errores.

O sea: son como una sala de control.

---

### APIs automáticas

También hay APIs que no las llama una persona, sino el propio sistema en horarios programados.

Eso pasa con:

- los scrapers diarios,
- el procesamiento de eventos,
- la actualización de eventos pasados,
- la reclasificación,
- y el envío del newsletter.

Es como si el sistema tuviera alarmas y tareas automáticas.

---

## 5. Flujo completo del sistema

Acá está el camino completo, en versión simple:

### Paso 1: buscar eventos

Los scrapers visitan distintas páginas y traen eventos.

### Paso 2: guardar lo encontrado

Todo eso se guarda primero en una zona intermedia, aunque venga medio desordenado.

### Paso 3: limpiar y entender

El pipeline intenta responder preguntas como:

- ¿qué fecha es esta realmente?
- ¿esto es un concierto o una feria?
- ¿es gratis o pago?
- ¿en qué departamento queda?
- ¿ya lo teníamos?

### Paso 4: evitar repetidos

Si el mismo evento aparece en dos lugares distintos, el sistema intenta unirlo en vez de mostrarlo dos veces.

### Paso 5: mostrarlo en el sitio

Cuando ya quedó bien armado, aparece en:

- la home,
- próximos eventos,
- el mapa,
- el detalle,
- el newsletter,
- y el admin.

---

## 6. Qué pasa cuando una persona usa la web

### Si busca un evento

La página pide los eventos filtrados y muestra resultados.

### Si abre un evento

El sistema cuenta esa vista. Eso ayuda a detectar cuáles son los más buscados.

### Si manda un evento por formulario

El sistema lo guarda como submission y le avisa al admin.

### Si se suscribe al newsletter

Guarda el email, sus preferencias y manda un correo de verificación.

---

## 7. Qué son los eventos recurrentes

Los eventos recurrentes son los que **no pasan una sola vez**, sino que se repiten.

Ejemplos:

- todos los viernes,
- sábados y domingos,
- de lunes a viernes,
- todo el año,
- todos los fines de semana.

No son iguales a un recital que pasa un día puntual.

---

## 8. Cómo distingue hoy el sistema un evento recurrente de uno normal

Hoy el sistema lo detecta mirando el texto.

Si encuentra frases como:

- “todos los días”
- “cada jueves”
- “lunes a viernes”
- “sábado y domingo”
- “todo el año”

lo marca como **recurrente**.

Si no, lo trata como un evento normal.

O sea: no lo adivina por magia, sino por pistas escritas.

---

## 9. ¿Los recurrentes se guardan en varios días?

**No. Hoy no.**

Y esto es importante.

Actualmente, un evento recurrente se guarda **una sola vez** en la base final.

Se diferencia porque tiene una marca especial que dice, básicamente:

> “ojo, este evento se repite”

Entonces:

- un evento normal depende mucho de su fecha,
- un evento recurrente puede seguir apareciendo aunque esa fecha guardada no sea la de hoy.

---

## 10. Entonces, ¿cómo aparece todos los días o en varias vistas?

Porque cuando el sistema arma algunas listas, no pregunta solo:

> “¿qué eventos son exactamente de esta fecha?”

También pregunta algo como:

> “¿y cuáles están marcados como recurrentes?”

Por eso un recurrente puede aparecer en la home o en próximas fechas aunque no tenga guardada cada una de sus repeticiones por separado.

---

## 11. Ventaja de cómo está hecho hoy

La ventaja es que este sistema es:

- más simple,
- más rápido,
- más barato de mantener,
- y evita crear mil copias del mismo evento.

Sirve bastante bien para el objetivo de mostrar:

> “esto es algo que pasa seguido”

---

## 12. Problema de cómo está hecho hoy

La desventaja es que el sistema **no entiende del todo el calendario exacto** del recurrente.

Por ejemplo, hoy no guarda con precisión cosas como:

- qué días exactos se repite,
- hasta cuándo dura,
- si un feriado no aplica,
- si solo pasa viernes y sábado,
- cuál es la próxima fecha real.

Entonces, a veces el sistema sabe que algo “es recurrente”, pero no sabe describirlo como una agenda perfecta.

---

## 13. Cómo podría mejorarse eso

Hay varias formas.

### Opción 1: mejora simple

Guardar mejor información extra, por ejemplo:

- qué días se repite,
- desde cuándo,
- hasta cuándo,
- texto original de la recurrencia.

Eso ya ayudaría bastante.

### Opción 2: mejora más fuerte

Guardar el evento principal por un lado, y por otro lado guardar sus “ocurrencias”.

O sea:

- un registro dice “este evento existe”,
- y otros registros dicen “pasa tal día, tal otro día, tal otro día”.

Eso sería más correcto, pero también más complejo.

### Mi lectura hoy

Si el proyecto quiere mejorar bastante la precisión, **los recurrentes son uno de los mejores lugares para evolucionar el sistema**.

Porque hoy funcionan, pero todavía están resueltos de forma práctica, no perfecta.

---

## 14. Cómo viaja la información entre piezas

Si lo resumimos como historia:

1. una página externa publica un evento,
2. el scraper lo encuentra,
3. se guarda crudo,
4. el pipeline lo limpia,
5. el sistema decide si sirve,
6. lo clasifica,
7. le busca lugar en el mapa,
8. revisa si ya existía,
9. lo publica,
10. la web lo muestra,
11. si la gente lo abre, suben las vistas,
12. si alguien se suscribe, puede recibirlo por email.

Todo eso se conecta con APIs y con la base de datos.

---

## 15. En una frase: cómo funciona DondeEsHoy

DondeEsHoy es un sistema que **junta eventos de varias páginas, los ordena, corrige, une lo repetido y los muestra de forma clara para que la gente descubra qué hacer en Uruguay**.

Y el punto que hoy más vale la pena revisar si se quiere mejorar precisión es el manejo de **eventos recurrentes**, porque ya está resuelto a nivel práctico, pero todavía no a nivel calendario completo.
