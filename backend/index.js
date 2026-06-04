const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL in .env. Set it before starting the server.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
  log: ['query', 'info', 'warn', 'error'],
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: "v1" });

const upload = multer({ dest: uploadsDir });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

async function ensureTablesExist() {
  const existing = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('User', 'Reunion', 'Procesamiento');"
  );
  const tables = (existing || []).map((row) => row.tablename || row.table_name || "");

  if (!tables.includes('User')) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  if (!tables.includes('Reunion')) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Reunion" (
        id uuid PRIMARY KEY,
        titulo text NOT NULL,
        fecha timestamptz NOT NULL,
        "duracionAudio" integer NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "Reunion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id)
      );
    `);
  }

  if (!tables.includes('Procesamiento')) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Procesamiento" (
        id uuid PRIMARY KEY,
        "transcripcionCruda" text NOT NULL,
        "resumenEstructurado" text NOT NULL,
        "reunionId" uuid UNIQUE NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "Procesamiento_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "Reunion"(id)
      );
    `);
  }
}

function extractGeminiText(result) {
  const candidate = result?.response?.candidates?.[0];
  const content = candidate?.content;
  const parts = content?.parts || [];
  const textParts = parts
    .map((part) => part?.text)
    .filter((value) => typeof value === "string");
  return textParts.join("\n") || "";
}

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  const { audioBase64, mimeType } = req.body || {};
  let finalAudioBase64 = audioBase64;
  let finalMimeType = mimeType;
  let uploadedFilePath;

  if (req.file) {
    finalMimeType = req.file.mimetype;
    uploadedFilePath = req.file.path;
    finalAudioBase64 = fs.readFileSync(uploadedFilePath, { encoding: "base64" });
  }

  if (!finalAudioBase64 || !finalMimeType) {
    return res.status(400).json({
      success: false,
      message: "Se requiere audioBase64 y mimeType en el cuerpo de la petición, o bien un archivo `audio` en multipart/form-data.",
    });
  }

  try {
    const promptText =
      "Eres un asistente de reuniones experto. Analiza este audio y devuelve un resumen en Markdown con: 1. Resumen Ejecutivo, 2. Puntos Clave Tratados, 3. Acuerdos y 4. Tareas Pendientes. Responde únicamente con el Markdown estructurado.";

    const audioBytes = finalAudioBase64.replace(/^data:[^;]+;base64,/, "");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: finalMimeType,
          data: audioBytes,
        },
      },
      promptText,
    ]);

    const resumenEstructurado = result.response.text();

    const user = await prisma.user.upsert({
      where: { email: "system@local" },
      update: {},
      create: { email: "system@local" },
    });

    const reunion = await prisma.reunion.create({
      data: {
        titulo: `Reunión - ${new Date().toISOString().slice(0, 10)}`,
        fecha: new Date(),
        duracionAudio: 0,
        userId: user.id,
        procesamiento: {
          create: {
            transcripcionCruda: "",
            resumenEstructurado,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      geminiResponse: resumenEstructurado,
      reunionId: reunion.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error procesando el audio con Gemini.",
      error: error?.message || "Unknown error",
    });
  } finally {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (unlinkError) {
        console.error("Error removing temp audio file:", unlinkError);
      }
    }
  }
});

ensureTablesExist()
  .then(() => {
    app.listen(port, () => {
      console.log(`Servidor escuchando en el puerto ${port}`);
    });
  })
  .catch((error) => {
    console.error("Error inicializando la base de datos:", error);
    process.exit(1);
  });
