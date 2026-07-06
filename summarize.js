// api/summarize.js
// Función serverless de Vercel. Recibe texto y devuelve una versión procesada en hebreo,
// usando la API de Google Gemini.
// Soporta dos modos:
//   - 'summary'  : resumen temático y conciso
//   - 'podcast'  : versión narrada, cálida y explicativa, tipo podcast
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

  const text = body && body.text;
  const mode = (body && body.mode) || 'summary';
  const title = (body && body.title) || '';

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'חסר טקסט לעיבוד' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'המפתח GEMINI_API_KEY לא הוגדר בשרת' });
  }

  const clipped = text.slice(0, 120000);

  let prompt;
  if (mode === 'podcast') {
    prompt =
      'קיבלת טקסט בעברית. הפוך אותו לפרק פודקאסט קצר בעברית, שנעים להאזנה תוך כדי נהיגה.\n\n' +
      'הנחיות:\n' +
      '1. פתח במשפט פתיחה חם שמזכיר את שם הנושא: "' + (title || 'המסמך') + '".\n' +
      '2. ספר את התוכן בגוף ראשון, בטון אנושי, זורם וידידותי — כמו מנחה פודקאסט שמסביר למאזין.\n' +
      '3. חבר בין הרעיונות בצורה טבעית, הדגש את הנקודות המעניינות, ושמור על השמות והנתונים החשובים.\n' +
      '4. השתמש במשפטים קצרים וברורים שקל להאזין להם.\n' +
      '5. סיים במשפט סיכום קצר.\n' +
      '6. אל תוסיף הערות טכניות או כותרות — רק את הטקסט המדובר של הפרק.\n\n' +
      '--- הטקסט ---\n' + clipped;
  } else {
    prompt =
      'סכם את הטקסט הבא בעברית בצורה ברורה ותמציתית. ' +
      'שמור על הנקודות המרכזיות, השמות והנתונים החשובים. ' +
      'כתוב את התקציר בפסקאות קצרות וקריאות, מתאים להאזנה בקול.\n\n' +
      '--- הטקסט ---\n' + clipped;
  }

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await geminiRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'שגיאה מהשירות' });
    }

    const candidate = data.candidates && data.candidates[0];
    const result = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map(p => p.text || '').join('\n').trim()
      : '';

    if (!result) {
      return res.status(500).json({ error: 'לא התקבלה תשובה' });
    }

    return res.status(200).json({ summary: result });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'שגיאת רשת' });
  }
}
