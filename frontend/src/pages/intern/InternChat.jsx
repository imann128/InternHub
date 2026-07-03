import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import chatService from '../../services/chatService';
import { InternNavbar } from './InternDashboard';
import { toast } from 'react-toastify';
import '../../styles/chat.css';

const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const InternChat = () => {
  const { intern, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(() => {
    chatService.getMyMessages()
      .then(res => setMessages(res.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('message', text.trim());
      if (file) fd.append('file', file);
      await chatService.sendMyMessage(fd);
      setText('');
      setFile(null);
      fetchMessages();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Files are now served from an authenticated route, not a static path —
  // fetch with the JWT attached, then open as a blob.
  const handleFileOpen = async (fileUrl, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000${fileUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load file');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      toast.error('Could not open file');
    }
  };

  return (
    <div className="intern-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <InternNavbar name={intern?.name} onLogout={() => { logout(); navigate('/intern/login'); }} navigate={navigate} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 800, width: '100%', margin: '0 auto', padding: '0 16px' }}>
        <h2 style={{ color: 'var(--text)', padding: '16px 0', fontSize: 16, fontWeight: 600 }}>Chat with Admin</h2>

        <div className="chat-messages" style={{ flex: 1, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {messages.length === 0 ? (
            <div className="chat-empty"><div className="chat-empty-icon">💬</div><p>No messages yet</p></div>
          ) : messages.map(msg => {
            const isAnnouncement = msg.is_announcement;
            const bubbleClass = isAnnouncement ? 'announcement' : msg.sender_role;
            return (
              <div key={msg.id} className={`chat-bubble-wrap ${bubbleClass}`}>
                <div className={`chat-bubble ${bubbleClass}`}>
                  {isAnnouncement && <div style={{ fontWeight: 600, marginBottom: 4 }}>📢 Announcement</div>}
                  {msg.message && <div>{msg.message}</div>}
                  {msg.file_url && (
                    <button
                      onClick={() => handleFileOpen(msg.file_url, msg.file_name)}
                      className="chat-file-link"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit', textDecoration: 'underline', padding: 0 }}
                    >
                      📎 {msg.file_name}
                    </button>
                  )}
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{formatTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginTop: 12 }}>
          {file && (
            <div className="chat-file-preview">
              📎 {file.name}
              <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', marginLeft: 'auto' }}>✕</button>
            </div>
          )}
          <div className="chat-input-row">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
            <button className="chat-file-btn" onClick={() => fileInputRef.current.click()}>📎</button>
            <textarea
              className="chat-input"
              placeholder="Type a message..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={sending || (!text.trim() && !file)}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternChat;