# GTA RIG GAME: diseño

Fecha: 2026-11-26. Estado: borrador para aprobación.

## Intención y por qué

Un juego 3D web de misiones, en tercera persona y estilo GTA, para recorrer el Equipo 10 (pulling/workover SK-575) y su locación a pie y en camioneta. Quien juega acepta misiones de un instructor por radio, se mueve por el mapa con radar, llega a los equipos y completa objetivos. Las misiones enseñan el equipo y su locación usando datos ya documentados en el visor `exertion-solutions/visor-equipo-de-torre`.

El dueño pidió "un juego con misiones, estilo GTA". No indicó audiencia. Mi llamado: el núcleo sirve a inducción, clientes y juego libre; un selector de modo cambia solo qué misiones y fichas se muestran.

## Metas

- Mundo abierto con la locación (78,5 x 61 m según los viewpoints del visor) y los 16 componentes SK-575 como escenografía.
- Personaje a pie y camioneta conducible, cámara de seguimiento con colisión, radar/minimapa, HUD con lista de objetivos, ciclo día/noche, sonido, radio con voz del instructor.
- Estructura de misión tipo GTA: marcador en el mapa, objetivos encadenados, pantalla de misión completada, reintento ilimitado.
- Intro y tráiler como video pre-renderizado (Remotion). Fuera del runtime del juego.
- 8 misiones iniciales, derivadas solo de datos existentes (ver Misiones).
- Rendimiento: desktop 60 FPS con menos de 250 draw calls y menos de 1 M triángulos visibles. Móvil 30 FPS con menos de 120 draw calls y menos de 300 k triángulos.

## No metas

- Policía, nivel de búsqueda, armas, violencia, tráfico, multijugador, economía, personalización.
- Simulación de izamiento, cargas, tiempos o dinámica del equipo.
- Edición o reemplazo de los datos del visor.

## Anti metas (fracaso aunque funcione)

- Que se lea como simulación, cálculo o validación de seguridad.
- Que muestre distancias, radios, zonas de exclusión o "área segura" no documentados.
- Que diga "aprobado", "habilitado" o "certificado".
- Que presente `goodPractice` o `pendingValidation` como requisito.
- Que filtre marca, documentos internos o fotos del equipo real, o que el repo deje de ser privado.

## Restricciones

- Repo privado `exertion-solutions/gta-rig-game`. El visor es privado y sin licencia: el repo no se publica sin autorización escrita del dueño.
- Marco del visor: 1 unidad = 1 m, Y arriba, origen en la boca de pozo, +X hacia el mástil, carrier en −X. El signo lateral (+Y = este) del layout sigue pendiente de verificar.
- Geometría de confianza B/C, `as_built: false`.
- Todo dato numérico o de seguridad en pantalla lleva su `sourceId` y su estatus de evidencia (`confirmed`, `procedure`, `goodPractice`, `pendingValidation`). Solo `confirmed` y `procedure` pueden presentarse como requisito.
- Fuentes en conflicto se muestran las dos, rotuladas "Fuente en conflicto".
- Los GLB traen aristas LINES horneadas: el juego las descarta. KTX2 no aplica (sin `toktx`); texturas en webp.

## Enfoques considerados

- **A. Modo `GAME` dentro del visor.** Reusa stores y datos, pero acopla el juego al ciclo del visor. El dueño lo descartó al pedir repo separado.
- **B. Repo separado que consume los GLB (elegido por el dueño).** Aislado y privado. Costo: copia de assets que puede desfasarse; se mitiga con `assets.lock.json` (commit del visor + sha256) y un script `sync-assets`.
- **C. Inyectar en el visor V2 legacy.** Descartado: `public/legacy/` es un archivo generado.

## Decisiones del dueño

- Repo separado, privado, nombre "GTA RIG GAME" (`gta-rig-game`).
- GLB copiados al repo nuevo (hecho).
- Juego de misiones estilo GTA.
- Usar todos los recursos disponibles: Remotion, Fusion, Blender MCP, 3D AI Studio, ElevenLabs, Codex y agentes en paralelo.

## Llamados míos (a revisar)

- **Stack:** React 19, TypeScript ~6.0, Vite 8, three + @react-three/fiber 9 + drei 10, zustand, Tailwind 4, npm; `@react-three/rapier` para física. Versiones exactas por confirmar con `npm view`.
- **Colisión:** cajas y cápsulas por componente (nada de trimesh de los GLB); 1 a 3 convex hull para mástil, BOP y carrier si hace falta; planchada y piso como suelo/rampa.
- **Vehículo:** `DynamicRayCastVehicleController` de Rapier. Personaje: `KinematicCharacterController`.
- **Cámara:** seguimiento propio con lerp y raycast. Radar: cámara ortográfica cenital o canvas 2D desde las cajas de colisión.
- **Assets nuevos:** camioneta, personaje, props y terreno con Blender MCP o modelos CC0 (Kenney, Quaternius, Mixamo con licencia revisada). 3D AI Studio plan gratis solo como apoyo (Prism preview). Fusion solo si hay cotas reales.
- **Voz y sonido:** ElevenLabs para el instructor (texto tomado de las fichas, sin inventar procedimientos). Motor y pasos genéricos.
- **Fallo de misión:** no hay muerte ni arresto. Salir de la misión o reintentar.
- **Datos del visor:** `vendor/visor/` de solo lectura (tipos y DROPS), traído por `sync-assets` a un commit fijado.

## Misiones iniciales

Todas son de lectura, ubicación o registro propio. Ninguna evalúa ni habilita a nadie.

1. **Reconocimiento:** conducir al Acceso y visitar los 14 sectores.
2. **¿Qué hace cada sector?:** emparejar función con sector (8 preguntas, 6/8).
3. **Mapa de zonas:** visitar corona y piso de enganche (Alto), boca de pozo, subestructura y casilla (Medio), piletas (Bajo). En boca de pozo se muestra el conflicto entre A2 (Medio) y RCCO (Alto).
4. **Retención en altura:** leer retención primaria y secundaria de PE-3 y PE-4 y marcar OK/NOK/N/A como registro propio.
5. **¿Secundaria requerida?:** comparar BP-4 y DCO-3 contra PE-3 y PE-4.
6. **Zona sin clasificar:** encontrar piso de trabajo (PT-1 a PT-4) y poste-llave (PRL-1 a PRL-3); mostrar "No clasificada en layout A2", nunca como Baja.
7. **Orden del montaje:** ordenar los 8 pasos de la secuencia típica; rotulado `pendingValidation`, sin tiempos.
8. **Fuente en conflicto:** comparar las dos cifras de anclajes de vientos (25 ± 3 m vs 20 m) y ver que se muestran ambas. Verificar las cifras en la fuente antes de usarlas.

Fuente de las misiones: `src/data/qhse/rig10-drops.json`, `src/data/viewpoints/rig10-viewpoints.json`, `legacy-ext/87-recorridos.js`, `92-checklist-drops.js`, `93-induccion.js`, `docs/secuencia-montaje-tipica.md` del visor.

## Fases de construcción

1. Scaffold del proyecto, `sync-assets`, carga de GLB con el marco del visor, verificación de escala, descarte de aristas LINES.
2. Rapier: cajas de colisión del mundo y personaje a pie.
3. Cámara de seguimiento.
4. Camioneta y subir/bajar.
5. HUD, radar y motor de misiones (marcadores, objetivos, pantalla de completado).
6. Capa de datos DROPS y fichas con insignia de evidencia, rotuladas "ilustrativo, no es validación de seguridad".
7. Las 8 misiones, radio y voz.
8. Ciclo día/noche, sonido, rendimiento (LOD, instancias, carga diferida).
9. Intro y tráiler (Remotion).

## Pendiente para quien construye

- Versiones exactas de dependencias y compatibilidad de Rapier con fiber 9.
- Inspección de nodos internos de los GLB para definir colliders.
- Medición de rendimiento con el carrier (131 k triángulos).
- Verificar el signo lateral del layout y las cifras de vientos en la fuente.
- Registro de misiones: queda en el navegador (localStorage) salvo que el dueño pida envío a un servidor.

## Llamados tras la revisión del diseño (míos, a revisar)

- **Posiciones:** sectores, Acceso, piletas y casilla se toman de `src/data/viewpoints/rig10-viewpoints.json`, de `cad/data/layout_locacion.json` y de las transformadas de los GLB (origen en boca de pozo). Si un dato de posición falta, ese sector no se ubica y se marca "sin posición documentada"; no se inventan distancias.
- **Terreno y caminos:** no existe fuente. El suelo es un plano liso, sin caminos ni anchos de calle. La ruta de la misión 1 es libre entre el Acceso y los sectores.
- **Signo lateral (+Y = este):** se publica sin verificar y con un rótulo visible en el HUD y en `NOTICE.md`. Verificarlo contra el layout interno es tarea del dueño.
- **Datos de las misiones:** el commit del visor queda fijado en `assets.lock.json`. Si un dato de una misión (preguntas, pasos, puntos DROPS, cifras de vientos) no coincide con la fuente o falta, esa misión se reduce o se omite. Nunca se completa con datos inventados.
- **Móvil:** el objetivo es escritorio con teclado y mouse (o gamepad). En móvil solo se exige que cargue y no se rompa; controles táctiles quedan fuera del MVP.
- **Zonas Alto/Medio/Bajo:** solo como texto en las fichas, con `sourceId` e insignia de evidencia. No se dibujan en el radar, en el piso ni como volúmenes, para que no se lean como zonas de exclusión.
- **Idioma y voz:** interfaz y voz en español. La voz del instructor se genera una vez con ElevenLabs y se guarda como archivos de audio estáticos (sin claves de API en tiempo de ejecución). Todo contenido técnico de las líneas sale literal de las fichas; el instructor puede decir saludos y presentar la misión con frases de enlace sin contenido técnico nuevo.
- **Remotion y alcance:** las fases 1 a 8 son el núcleo. La fase 9 (intro y tráiler) es opcional y se recorta primero.
