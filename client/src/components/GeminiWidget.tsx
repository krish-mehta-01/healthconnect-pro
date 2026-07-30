import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './GeminiWidget.css';

export default function GeminiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Hi! I am your AI assistant for HealthConnect Pro. Ask me anything about the platform, clinical guidelines, or data trends.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automatically pull the API key from your frontend .env file
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !apiKey) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const systemContext = "You are an AI assistant built into HealthConnect Pro, an Enterprise Health Management Information System for Shimla, Himachal Pradesh. Help the user navigate the platform and provide brief, professional healthcare answers.";

      const result = await model.generateContent(systemContext + "\n\nUser: " + userMessage);
      const text = result.response.text();
      setMessages(prev => [...prev, { role: 'bot', text }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'bot', text: `Error: ${err.message || 'Failed to fetch response'}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`gemini-widget ${isOpen ? 'open' : ''}`}>
      {!isOpen && (
        <button className="gemini-fab" onClick={() => setIsOpen(true)}>
          <Sparkles size={24} />
        </button>
      )}

      {isOpen && (
        <div className="gemini-chat-container">
          <div className="gemini-header">
            <div className="gemini-header-title">
              <Bot size={20} />
              <span>HealthConnect AI</span>
            </div>
            <div className="gemini-header-actions">
              <button onClick={() => setIsOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="gemini-messages">
            {!apiKey && (
              <div className="gemini-warning">
                Please configure VITE_GEMINI_API_KEY in your frontend .env file to enable AI.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`gemini-msg ${msg.role}`}>
                {msg.text}
              </div>
            ))}
            {loading && <div className="gemini-msg bot loading">...</div>}
            <div ref={messagesEndRef} />
          </div>
          <form className="gemini-input-area" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={!apiKey || loading}
            />
            <button type="submit" disabled={!apiKey || loading || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}