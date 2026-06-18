# Modelo de base de datos

La app actual usa `localStorage` para poder probarse sin credenciales. Este modelo se puede implementar en Firebase Firestore o Supabase/PostgreSQL.

## participants

| Campo | Tipo | Notas |
| --- | --- | --- |
| id | string/uuid | Identificador principal |
| name | string | Requerido |
| email | string | Opcional |
| phone | string | Opcional |
| created_at | timestamp | Fecha de creacion |

## matches

| Campo | Tipo | Notas |
| --- | --- | --- |
| id | string/uuid | Identificador principal |
| date | date | Fecha del partido |
| time | time | Hora local |
| group | string | Grupo o llave |
| stage | string | Fase de grupos, octavos, cuartos, semifinal, final |
| home_team | string | Equipo local |
| away_team | string | Equipo visitante |
| real_home_score | integer/null | Marcador real local |
| real_away_score | integer/null | Marcador real visitante |
| status | enum | `pendiente` o `jugado` |

## predictions

| Campo | Tipo | Notas |
| --- | --- | --- |
| id | string/uuid | Identificador principal |
| participant_id | string/uuid | Relacion con `participants.id` |
| match_id | string/uuid | Relacion con `matches.id` |
| home_score | integer | Prediccion local |
| away_score | integer | Prediccion visitante |
| created_at | timestamp | Fecha de creacion |
| updated_at | timestamp | Fecha de actualizacion |

Restriccion recomendada:

```sql
unique (participant_id, match_id)
```

## Reglas de seguridad sugeridas

Firebase:

- `participants`: lectura para usuarios autenticados; escritura del propio perfil o administrador.
- `matches`: lectura para usuarios autenticados; escritura solo administrador.
- `predictions`: lectura para usuarios autenticados; crear/editar solo si `request.auth.uid` corresponde al participante y el partido no esta jugado; administrador puede editar todo.

Supabase:

- Activar Row Level Security.
- Politica de lectura para usuarios autenticados.
- Politicas de escritura por `auth.uid()` en predicciones.
- Rol o columna `is_admin` para permitir administracion completa.

## Puntuacion

- 5 puntos por marcador exacto.
- 3 puntos por acertar ganador o empate.
- 1 punto por acertar goles de un equipo.
- 0 puntos si no acierta nada.

Los puntos se calculan al vuelo desde `matches` y `predictions`, asi se recalculan automaticamente cuando cambia un resultado real.
