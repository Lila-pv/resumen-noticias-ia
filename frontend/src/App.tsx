// frontend/src/App.tsx
import React, { useState } from 'react';
import axios from 'axios';
import './App.css'; 

// URL de tu API local (Backend)
const API_URL = 'https://generador-de-resumen-ia.onrender.com/api/summarize';
function App() {
  const [url, setUrl] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSummary('');

    try {
      const response = await axios.post(API_URL, { url });
      if (response.data.success) {
        setSummary(response.data.summary);
      } else {
        setError(response.data.error || 'Error desconocido al resumir.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Función para renderizar el contenido con formato básico (negritas y saltos de línea)
  const renderSummary = () => {
    if (!summary) return null;
    return (
      <div 
        dangerouslySetInnerHTML={{ 
          __html: summary
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Transforma **Texto** a <strong>Texto</strong>
            .replace(/\n/g, '<br/>') // Transforma saltos de línea a <br/>
        }} 
      />
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>📰 Generador de Resúmenes | Gemini AI</h1>
        <p>Introduce la URL de un artículo para obtener un resumen rápido en puntos clave.</p>
      </header>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pega la URL de la noticia aquí (ej: https://bbc.com/mundo/...)"
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading || !url}>
          {loading ? 'Generando...' : 'Resumir Ahora'}
        </button>
      </form>

      {(loading || summary || error) && (
        <div className="result-box">
          {loading && <div className="loading-spinner"></div>}

          {error && <p className="error-message">⚠️ Error: {error}</p>}

          {summary && (
            <div className="summary-content">
              <h2>Resumen Generado:</h2>
              {renderSummary()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;