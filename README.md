# Instrucciones para Configuración y Ejecución Local

## Requisitos Previos

- Node.js (v18 o superior recomendado)
- npm o yarn

## Instalación

1. Clona el repositorio:
   ```sh
   git clone <URL-del-repositorio>
   cd todo-webapp
   ```
2. Instala las dependencias:
   ```sh
   npm install
   # o
   yarn install
   ```

## Ejecución en Desarrollo

Inicia el servidor de desarrollo con:

```sh
npm run dev
# o
yarn dev
```

Esto abrirá la aplicación en `http://localhost:5173` (puerto por defecto de Vite).

## Scripts Útiles

- `npm run dev` — Inicia el entorno de desarrollo
- `npm run build` — Genera la build de producción
- `npm run preview` — Previsualiza la build de producción localmente
- `npm run lint` — Ejecuta ESLint para análisis de código

---

# Arquitectura del Sistema

## Tecnologías Principales

- **React**: Librería principal para la UI
- **TypeScript**: Tipado estático para mayor robustez
- **Vite**: Bundler rápido para desarrollo y producción
- **ESLint**: Linter para mantener la calidad del código

## Estructura de Carpetas

- `src/` — Código fuente principal
  - `components/` — Componentes reutilizables de UI
  - `pages/` — Páginas principales de la app
  - `layouts/` — Layouts reutilizables
  - `hooks/` — Custom hooks
  - `lib/` — Utilidades y helpers
  - `assets/` — Imágenes y recursos estáticos
- `public/` — Archivos públicos y estáticos

## Decisiones Técnicas

- **Vite** se eligió por su rapidez en el desarrollo y soporte nativo para TypeScript y React.
- **TypeScript** asegura un desarrollo más seguro y escalable.
- **Componentización**: La UI está dividida en componentes pequeños y reutilizables para facilitar el mantenimiento.
- **ESLint**: Configuración estricta para mantener buenas prácticas y calidad de código.

## Consideraciones Especiales

- El proyecto está preparado para ser extendido fácilmente con nuevas páginas o componentes.
- Se recomienda seguir la convención de nombres y estructura de carpetas para mantener la coherencia.
- Para producción, asegúrate de configurar correctamente las variables de entorno y el servidor donde se desplegará la build.

---

# Contacto

Para dudas o sugerencias, contacta al responsable del proyecto.
