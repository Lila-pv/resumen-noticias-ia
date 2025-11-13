// backend/server.js
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // <-- CORREGIDO: Importa y configura las variables de entorno
import axios from 'axios';
import * as cheerio from 'cheerio';

// Obtener la clave de Gemini del entorno
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Verificación de la clave: Crucial para el diagnóstico de fallos
if (!GEMINI_API_KEY) {
    console.error("=========================================================================");
    console.error("ERROR CRÍTICO: La variable GEMINI_API_KEY no está configurada.");
    console.error("Asegúrate de tenerla en el archivo .env (local) y en la configuración de Render.");
    console.error("=========================================================================");
    // Si la clave falta, forzamos la salida para evitar que el servidor se cuelgue silenciosamente
    process.exit(1); 
}

// Inicializa Gemini.
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const app = express();
const port = process.env.PORT || 3000; // Usa la variable PORT proporcionada por Render o 3000

// Middleware para JSON y CORS 
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://resumen-noticias-ia.onrender.com'] // Añade tu dominio de Render y localhost
})); 

// Función para obtener contenido y resumir con Gemini
async function generateSummary(url) {
    try {
        // 1. Web Scraping para obtener texto
        const { data } = await axios.get(url, {
            headers: {
                // Simula un agente de navegador/bot para evitar bloqueos simples
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            },
            timeout: 15000 // Añadido timeout de 15 segundos para Axios (para evitar cuelgues)
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
        // En caso de error, el log de Render mostrará el mensaje del error
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`\nServidor Gemini corriendo en http://localhost:${port}`);
});