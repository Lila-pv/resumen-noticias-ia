// backend/server.js
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

// Inicializa Gemini.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();
const port = 3000;

// Middleware para JSON y CORS 
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://tu-dominio-vercel.vercel.app']
})); 

// Función para obtener contenido y resumir con Gemini
async function generateSummary(url) {
  try {
    // 1. Web Scraping para obtener texto
    const { data } = await axios.get(url, {
        headers: {
            // Simula un agente de navegador/bot para evitar bloqueos simples
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
    });
    
    const $ = cheerio.load(data);
    // Extracción de párrafos
    const textContent = $('p').map((i, el) => $(el).text()).get().join('\n');
    
    if (textContent.length < 50) {
        throw new Error("Contenido insuficiente o bloqueado por el sitio web.");
    }
    
    // 2. Prompt para Gemini
    const prompt = `Actúa como un editor experto. Genera un título atractivo y resume el siguiente artículo de prensa en 4 a 5 puntos clave. Formatea la salida SOLAMENTE con el título en negrita seguido de los puntos clave. Texto: \n\n---\n\n${textContent}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 2048 }
    });

    return response.text.trim();
  } catch (error) {
    console.error('Error al generar resumen:', error.message);
    throw new Error(`Fallo en el procesamiento: ${error.message}`);
  }
}

// Endpoint POST: /api/summarize
app.post('/api/summarize', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Proporciona una URL válida.' });
  }

  try {
    const summary = await generateSummary(url);
    res.json({ success: true, summary: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`\nServidor Gemini corriendo en http://localhost:${port}`);
});