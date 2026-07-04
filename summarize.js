// api/summarize.js
// Función serverless de Vercel. Recibe texto y devuelve un resumen en hebreo.
// La clave de API queda protegida en el servidor (variable de entorno ANTHROPIC_API_KEY),
// nunca se expone en el navegador.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel parsea el body automáticamente, pero por las dudas soportamos ambos casos.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const text = body && body.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'חסר טקסט לתקציר' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'המפתח ANTHROPIC_API_KEY לא הוגדר בשרת' });
  }

  // Recortamos por seguridad para no mandar textos gigantes (límite generoso).
  const clipped = text.slice(0, 120000);

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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content:
            'סכם את הטקסט הבא בעברית בצורה ברורה ותמציתית. ' +
            'שמור על הנקודות המרכזיות, השמות והנתונים החשובים. ' +
            'כתוב את התקציר בפסקאות קצרות וקריאות, מתאים להאזנה בקול.\n\n' +
            '--- הטקסט ---\n' + clipped
        }]
      })
    });

    const data = await anthropicRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'שגיאה מהשירות' });
    }

    const summary = (data.content || [])
      .map(c => (c && c.type === 'text' ? c.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!summary) {
      return res.status(500).json({ error: 'לא התקבל תקציר' });
    }

    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'שגיאת רשת' });
  }
}
