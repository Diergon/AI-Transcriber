const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
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
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

const upload = multer({ dest: uploadsDir });

app.use(cors());
app.use(express.json());

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
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No se recibió el archivo de audio.",
    });
  }

  try {
      const uploadResponse = await fileManager.uploadFile(req.file.path, {
        mimeType: req.file.mimetype || "audio/mpeg",
        displayName: req.file.originalname || req.file.filename,
      });

      const promptText =
        "Eres un asistente de reuniones experto. Analiza este audio y devuelve un resumen en Markdown con: 1. Resumen Ejecutivo, 2. Puntos Clave Tratados, 3. Acuerdos y 4. Tareas Pendientes. Responde únicamente con el Markdown estructurado.";

      const geminiResponse = await model.generateContent([
        {
          fileData: {
            mimeType: uploadResponse.file.mimeType,
            fileUri: uploadResponse.file.uri,
          },
        },
        promptText,
      ]);
    const resumenEstructurado = extractGeminiText(geminiResponse);

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

    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      success: true,
      geminiResponse: resumenEstructurado,
      reunionId: reunion.id,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Error removing temp audio file:", unlinkError);
      }
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error procesando el audio con Gemini.",
      error: error?.message || "Unknown error",
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
