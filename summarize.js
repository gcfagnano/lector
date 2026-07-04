// api/summarize.js
// Función serverless de Vercel. Recibe texto y devuelve una versión procesada en hebreo.
// Soporta dos modos:
//   - 'summary'  : resumen temático y conciso
//   - 'friendly' : versión narrada, cálida y explicativa, que empieza anunciando el título
// La clave de API queda protegida en el servidor (variable de entorno ANTHROPIC_API_KEY),
// nunca se expone en el navegador.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const text = body && body.text;
  const mode = (body && body.mode) || 'summary';
  const title = (body && body.title) || '';

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'חסר טקסט לעיבוד' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'המפתח ANTHROPIC_API_KEY לא הוגדר בשרת' });
  }

  const clipped = text.slice(0, 120000);

  let prompt;
  if (mode === 'friendly') {
    prompt =
      'קיבלת טקסט בעברית. המשימה שלך היא להפוך אותו לגרסה נעימה להאזנה בקול רם, ' +
      'כאילו אדם חם ומקצועי מסביר את התוכן לחבר תוך כדי נהיגה.\n\n' +
      'הנחיות:\n' +
      '1. פתח באמירת שם המסמך: "' + (title || 'המסמך') + '".\n' +
      '2. הסבר את התוכן בשפה טבעית, זורמת וידידותית — לא קריאה מילולית ומכנית.\n' +
      '3. חבר בין הרעיונות במשפטי קישור טבעיים, שמור על הנתונים והשמות החשובים.\n' +
      '4. השתמש במשפטים קצרים וברורים שקל להאזין להם.\n' +
      '5. אל תוסיף הקדמות מיותרות כמו "הנה הגרסה" — פשוט התחל בתוכן.\n\n' +
      '--- הטקסט ---\n' + clipped;
  } else {
    prompt =
      'סכם את הטקסט הבא בעברית בצורה ברורה ותמציתית. ' +
      'שמור על הנקודות המרכזיות, השמות והנתונים החשובים. ' +
      'כתוב את התקציר בפסקאות קצרות וקריאות, מתאים להאזנה בקול.\n\n' +
      '--- הטקסט ---\n' + clipped;
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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await anthropicRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'שגיאה מהשירות' });
    }

    const result = (data.content || [])
      .map(c => (c && c.type === 'text' ? c.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!result) {
      return res.status(500).json({ error: 'לא התקבלה תשובה' });
    }

    return res.status(200).json({ summary: result });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'שגיאת רשת' });
  }
}
