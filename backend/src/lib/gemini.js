'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

// Returns { score: number in [-1, 1], urgency: 'High' | 'Medium' | 'Low' }
async function analyzeSentiment(text) {
  const genAI = getClient();
  if (!genAI) {
    return heuristicSentiment(text);
  }
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const prompt = `Analyze the sentiment of this patient feedback about a health facility. ` +
      `Respond with ONLY a compact JSON object like {"score": -0.8, "urgency": "High"} — ` +
      `score is a number from -1 (very negative) to 1 (very positive), ` +
      `urgency is "High" for feedback describing danger, neglect, or medical harm, "Medium" for complaints, "Low" for neutral/positive feedback.\n\n` +
      `Feedback: "${text}"`;
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    const score = Math.max(-1, Math.min(1, Number(parsed.score)));
    const urgency = ['High', 'Medium', 'Low'].includes(parsed.urgency) ? parsed.urgency : 'Low';
    return { score, urgency };
  } catch (err) {
    return heuristicSentiment(text);
  }
}

function heuristicSentiment(text) {
  const negative = /(danger|neglect|died|death|worse|hypothermia|frostbite|broken|no oxygen|no doctor|rude|dirty|infection|bleeding|emergency)/i;
  const positive = /(thank|great|excellent|good|helpful|clean|fast|caring|recovered)/i;
  if (negative.test(text)) return { score: -0.7, urgency: 'High' };
  if (positive.test(text)) return { score: 0.6, urgency: 'Low' };
  return { score: 0, urgency: 'Medium' };
}

// Returns { text: string } — best-effort OCR/extraction from a base64 image
async function extractFromImage(imageBase64, mimeType) {
  const genAI = getClient();
  if (!genAI) throw new Error('OCR is unavailable: GEMINI_API_KEY is not configured on the server');
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  const cleaned = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  const result = await model.generateContent([
    { inlineData: { data: cleaned, mimeType: mimeType || 'image/jpeg' } },
    { text: 'Extract all readable text and any tabular health indicator values from this document image. Return the raw extracted text.' },
  ]);
  return { text: result.response.text() };
}

// history: [{ role: 'user' | 'model', text: string }]. Returns the assistant's reply text.
async function chat(message, history) {
  const genAI = getClient();
  if (!genAI) throw new Error('AI assistant is unavailable: GEMINI_API_KEY is not configured on the server');
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    systemInstruction: 'You are an AI assistant built into HealthConnect Pro, an Enterprise Health Management Information System for Shimla, Himachal Pradesh. Help the user navigate the platform and provide brief, professional healthcare answers.',
  });
  const chatSession = model.startChat({
    history: (history || []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
  });
  const result = await chatSession.sendMessage(message);
  return result.response.text();
}

module.exports = { analyzeSentiment, extractFromImage, chat };
