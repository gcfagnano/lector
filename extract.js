// api/extract.js
// Función serverless de Vercel. Recibe un PDF (base64) y devuelve el texto en hebreo,
// extraído por Claude mediante lectura visual (OCR). Esto resuelve los PDFs en hebreo
// cuyo texto interno sale corrupto con los extractores tradicionales.
// La clave queda protegida en el servidor (variable de entorno ANTHROPIC_API_KEY).

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'המפתח ANTHROPIC_API_KEY לא הוגדר בשרת' });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text:
                'חלץ את כל הטקסט מהמסמך הזה בעברית, בדיוק כפי שהוא מופיע. ' +
                'שמור על סדר הפסקאות והמשפטים. אל תוסיף הערות, כותרות משלך או הסברים — ' +
                'החזר רק את הטקסט הנקי של המסמך.'
            }
          ]
        }]
      })
    });

    const data = await anthropicRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'שגיאה מהשירות' });
    }

    const text = (data.content || [])
      .map(c => (c && c.type === 'text' ? c.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) {
      return res.status(500).json({ error: 'לא הצלחתי לחלץ טקסט' });
    }

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'שגיאת רשת' });
  }
}
