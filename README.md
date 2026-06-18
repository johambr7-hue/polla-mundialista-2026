# Polla Mundialista

Aplicacion web sencilla para administrar una polla mundialista de futbol. Incluye participantes, partidos, predicciones, ranking automatico, buscador, graficas, panel administrativo, exportacion CSV y datos de ejemplo.

## Tecnologia

- React + Vite
- Persistencia local con `localStorage`
- Modelo listo para Firebase Firestore o Supabase en [docs/database-model.md](./docs/database-model.md)
- Interfaz responsive en espanol

## Instalacion

1. Instala dependencias:

```bash
npm install
```

2. Ejecuta el servidor de desarrollo:

```bash
npm run dev
```

3. Abre la URL que muestre Vite, normalmente:

```text
http://localhost:5173
```

## Uso rapido

- La app inicia con participantes, partidos y predicciones de ejemplo.
- Selecciona el participante activo en la parte superior para ingresar predicciones.
- Las predicciones de partidos jugados quedan bloqueadas.
- El ranking se recalcula automaticamente cuando cambian los marcadores reales.
- Para entrar como administrador usa la clave de prueba:

```text
admin123
```

## Puntuacion

- 5 puntos si acierta marcador exacto.
- 3 puntos si acierta ganador o empate.
- 1 punto si acierta la cantidad de goles de un equipo.
- 0 puntos si no acierta nada.

## Estructura

```text
src/
  components/        Componentes de cada modulo
  data/              Datos de ejemplo
  services/          Persistencia local y utilidades de IDs
  utils/             Puntuacion y exportacion CSV
  App.jsx            Composicion principal
  styles.css         Diseno responsive
docs/
  database-model.md  Modelo de datos para Firebase o Supabase
```

## Siguiente paso recomendado

Conectar `src/services/storage.js` a Firebase o Supabase manteniendo la misma forma de datos que usa la interfaz.
