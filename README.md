# AI-Transcriber

Un MVP full-stack personal diseñado para transcribir y resumir automáticamente archivos de audio de reuniones utilizando inteligencia artificial. La aplicación extrae el texto crudo y genera resúmenes ejecutivos, acuerdos y listas de tareas estructuradas en Markdown.

## 🚀 Stack Tecnológico

* **Frontend:** Vue 3 (Composition API, JavaScript puro, Vite)
* **Backend:** Node.js, Express
* **Base de Datos:** PostgreSQL (alojada en Supabase)
* **ORM:** Prisma
* **IA & Procesamiento:** API de Gemini (Google AI Studio)

## 📂 Estructura del Proyecto (Monorepo)

El proyecto está diseñado bajo una arquitectura modular separando las capas lógicas y visuales, orquestadas desde un directorio central:

* `/frontend`: Interfaz de usuario responsiva. Contiene la zona de carga (Drag & Drop) y el visor de resultados.
* `/backend`: API REST. Maneja la recepción de archivos (Multer), la sincronización con la base de datos (Prisma) y el *prompt engineering* dirigido al LLM.

## ⚙️ Instalación y Configuración Local

**1. Clonar el repositorio y configurar la raíz**

git clone <URL_DEL_REPOSITORIO>
cd AI-Transcriber
npm install

2. Configurar el Backend

cd backend
npm install

Crea un archivo .env en la carpeta /backend con las siguientes variables:

PORT=3000
GEMINI_API_KEY=tu_clave_de_google_ai_studio
DATABASE_URL=tu_cadena_de_conexion_prisma_supabase
Sincroniza los modelos con la base de datos:

npx prisma db push
3. Configurar el Frontend

cd ../frontend
npm install
4. Levantar la aplicación
Vuelve a la carpeta raíz (cd ..) y ejecuta el script orquestador para levantar ambos servidores simultáneamente:

npm run dev
👨‍💻 Desarrollo
Desarrollado y mantenido por Diego David Valarezo Luna.

Generado para optimización de tiempos en reuniones de desarrollo y planificación.

para levantar el backend: npx nodemon index.js
para levantar el frontedn: npm run dev