// backend/server.js
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Carga las variables de entorno para ES Modules
import axios from 'axios';
import * as cheerio from 'cheerio';

// ====================================================================
// 1. CONFIGURACIÓN CRÍTICA
// ====================================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Verificación de clave: CRUCIAL para evitar fallos silenciosos
if (!GEMINI_API_KEY) {
    console.error("=========================================================================");
    console.error("ERROR CRÍTICO: La variable GEMINI_API_KEY no está configurada.");
    console.error("=========================================================================");
    process.exit(1); 
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const app = express();
const port = process.env.PORT || 3000; 

// Lista blanca de dominios permitidos para CORS
const whitelist = [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'https://resumen-noticias-ia.onrender.com',
    // TU DOMINIO DE VERSEL INSERTADO AQUÍ
    'https://resumen-noticias-ia-assq722oj-lilas-projects-d4fef991.vercel.app' 
];

// Configuración dinámica de CORS
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || whitelist.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Acceso CORS no permitido por el servidor.'), false);
        }
    }
};

// ====================================================================
// 2. MIDDLEWARE
// ====================================================================
app.use(express.json());
app.use(cors(corsOptions)); 

// ====================================================================
// 3. LÓGICA DE RESUMEN
// ====================================================================
async function generateSummary(url) {
    try {
        // 1. Web Scraping para obtener texto
        const { data } = await axios.get(url, {
            headers: {
                // CORRECCIÓN FINAL: Simular un navegador Chrome real para evitar el error 403 Forbidden
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
            },
            timeout: 20000 // Aumentado a 20s para dar tiempo al scraping y a la red
        });
        
        const $ = cheerio.load(data);
        // Extracción optimizada de texto
        const textContent = $('p, h1, h2, h3, h4').map((i, el) => $(el).text()).get().join('\n').trim();
        
        if (textContent.length < 100) {
            throw new Error("Contenido insuficiente o el sitio web bloqueó el scraping.");
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
        // Manejo de errores específicos (403, 404, Timeout)
        if (error.response) {
            console.error(`Error de Scraping: HTTP ${error.response.status}`);
            throw new Error(`El sitio web respondió con error: Código ${error.response.status}.`);
        } else if (error.code === 'ECONNABORTED' || error.code === 'ERR_SOCKET_TIMEOUT') {
             console.error(`Error de Timeout: ${error.message}`);
             throw new Error('Timeout al intentar acceder a la URL. Intenta con una URL diferente.');
        } else {
            console.error('Error al generar resumen:', error.message);
            throw new Error(`Fallo en el procesamiento: ${error.message}`);
        }
    }
}

// ====================================================================
// 4. ENDPOINT
// ====================================================================
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

// ====================================================================
// 5. INICIO DEL SERVIDOR
// ====================================================================
app.listen(port, () => {
    console.log(`\nServidor Gemini corriendo en http://localhost:${port}`);
});