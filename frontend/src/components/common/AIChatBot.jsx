import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import aiService from '../../services/aiService';
import { CloseIcon, SparkleIcon } from './Icons';

// The system prompts describing what admins/interns can do now live
// server-side (backend/src/controllers/aiController.js), chosen based on
// req.user.role -- the client just sends the conversation and never talks
// to Groq directly. See that file if you need to update the assistant's
// knowledge of portal features.

const AIChatBot = () => {
  const { admin, intern } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true); // assume available until checked, to avoid a flash of "hidden then shown"
  const bottomRef = useRef(null);

  const isAdmin = !!admin;
  const isIntern = !!intern;
  const isLoggedIn = isAdmin || isIntern;

  // No point showing the bubble at all if neither this org nor the server
  // has a Groq key configured -- every click would just fail.
  useEffect(() => {
    if (!isLoggedIn) return;
    aiService.status()
      .then(res => setAvailable(res.data.data.available))
      .catch(() => setAvailable(true)); // fail open -- don't hide the feature over a transient network error
  }, [isLoggedIn]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: isAdmin
          ? `Hi ${admin?.name}! I can help you with anything in the portal — interns, tasks, attendance, exports, and more. What do you need?`
          : `Hi ${intern?.name}! I can help you navigate your intern portal — tasks, attendance, and more. What do you need?`,
      }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isLoggedIn || !available) return null;

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const res = await aiService.chat(updated.map(m => ({ role: m.role, content: m.content })));
      const reply = res.data.data.reply;
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: '#4F46E5', color: '#fff', fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        title="AI Assistant"
      >
        {open ? <CloseIcon size={20} /> : <SparkleIcon size={20} />}
      </button>

      {/* Chat Window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 1000,
          width: 360, height: 480, background: '#fff',
          borderRadius: 16, border: '1px solid #E2E8F0',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: '#4F46E5', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex' }}><SparkleIcon size={18} /></span>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Portal Assistant</div>
              <div style={{ color: '#C7D2FE', fontSize: 11 }}>{isAdmin ? 'Admin mode' : 'Intern mode'}</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                  background: m.role === 'user' ? '#4F46E5' : '#F8FAFC',
                  color: m.role === 'user' ? '#fff' : '#0F172A',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12,
                  border: m.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 13, color: '#64748B' }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about the portal..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                fontSize: 13, outline: 'none', color: '#0F172A',
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: loading || !input.trim() ? '#E2E8F0' : '#4F46E5',
                color: loading || !input.trim() ? '#94A3B8' : '#fff',
                cursor: loading || !input.trim() ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 500,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatBot;
