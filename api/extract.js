// api/extract.js
// Función serverless de Vercel. Recibe un PDF (base64) y devuelve el texto en hebreo,
// extraído por Gemini mediante lectura visual. Esto resuelve los PDFs en hebreo cuyo
// texto interno sale corrupto con los extractores tradicionales.
// La clave queda protegida en el servidor (variable de entorno GEMINI_API_KEY).

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const pdfBase64 = body && body.pdf;
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return res.status(400).json({ error: 'חסר קובץ PDF' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'המפתח GEMINI_API_KEY לא הוגדר בשרת' });
  }

  const prompt =
    'חלץ את כל הטקסט מהמסמך הזה בעברית, בדיוק כפי שהוא מופיע. ' +
    'שמור על סדר הפסקאות והמשפטים. אל תוסיף הערות, כותרות משלך או הסברים — ' +
    'החזר רק את הטקסט הנקי של המסמך.';

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
              { text: prompt }
            ]
          }]
        })
      }
    );

    const data = await geminiRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'שגיאה מהשירות' });
    }

    const candidate = data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map(p => p.text || '').join('\n').trim()
      : '';

    if (!text) {
      return res.status(500).json({ error: 'לא הצלחתי לחלץ טקסט' });
    }

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'שגיאת רשת' });
  }
}
