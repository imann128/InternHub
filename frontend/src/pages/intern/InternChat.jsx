import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import chatService from '../../services/chatService';
import InternLayout from '../../components/intern/InternLayout';
import { toast } from 'react-toastify';
import { CloseIcon, PaperclipIcon, MegaphoneIcon, ChatBubbleIcon } from '../../components/common/Icons';
import '../../styles/chat.css';

const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

// Merge a page of messages into the existing chronological list, deduping by
// id and re-sorting -- shared by both polling (newest page) and "load older".
const mergeMessages = (existing, incoming) => {
  const map = new Map(existing.map(m => [m.id, m]));
  incoming.forEach(m => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
};

const InternChat = () => {
  const { intern } = useAuth();
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(() => {
    chatService.getMyMessages({ page: 1, limit: 50 })
      .then(res => {
        setMessages(prev => mergeMessages(prev, res.data.data));
        setPagination(res.data.pagination || null);
      })
      .catch(() => {});
  }, []);

  const loadOlderMessages = () => {
    if (!pagination || pagination.page >= pagination.totalPages) return;
    setLoadingOlder(true);
    chatService.getMyMessages({ page: pagination.page + 1, limit: 50 })
      .then(res => {
        setMessages(prev => mergeMessages(prev, res.data.data));
        setPagination(res.data.pagination || null);
      })
      .catch(() => {})
      .finally(() => setLoadingOlder(false));
  };

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
  // auth now travels via the HttpOnly access_token cookie (see AuthContext),
  // not a header, so this just needs credentials: 'include' instead of a
  // Bearer token pulled from localStorage.
  const handleFileOpen = async (fileUrl, fileName) => {
    try {
      const res = await fetch(`http://localhost:5000${fileUrl}`, {
        credentials: 'include',
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
    <InternLayout title="Chat" subtitle="With admin" intern={intern}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        <div className="chat-messages" style={{ flex: 1, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {messages.length === 0 ? (
            <div className="chat-empty"><div className="chat-empty-icon"><ChatBubbleIcon size={30} /></div><p>No messages yet</p></div>
          ) : (<>
          {pagination && pagination.page < pagination.totalPages && (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <button className="btn-ghost" onClick={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}
          {messages.map(msg => {
            const isAnnouncement = msg.is_announcement;
            // "me"/"them" relative to this viewer (an intern) — the intern's
            // own sent messages go on the right, the admin's go on the left.
            // Using raw sender_role here previously hardcoded "intern = left",
            // which is backwards from the intern's own point of view.
            const bubbleClass = isAnnouncement ? 'announcement' : (msg.sender_role === 'intern' ? 'me' : 'them');
            return (
              <div key={msg.id} className={`chat-bubble-wrap ${bubbleClass}`}>
                <div className={`chat-bubble ${bubbleClass}`}>
                  {isAnnouncement && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, marginBottom: 6, color: 'var(--warning-dark)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.4 }}>
                      <MegaphoneIcon size={13} /> Announcement
                    </div>
                  )}
                  {msg.message && <div>{msg.message}</div>}
                  {msg.file_url && (
                    <button
                      onClick={() => handleFileOpen(msg.file_url, msg.file_name)}
                      className="chat-file-link"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit', textDecoration: 'underline', padding: 0 }}
                    >
                      <PaperclipIcon size={13} /> {msg.file_name}
                    </button>
                  )}
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{formatTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })}
          </>)}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginTop: 12 }}>
          {file && (
            <div className="chat-file-preview">
              <PaperclipIcon size={13} /> {file.name}
              <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', marginLeft: 'auto', display: 'flex' }}>
                <CloseIcon size={12} />
              </button>
            </div>
          )}
          <div className="chat-input-row">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
            <button className="chat-file-btn" onClick={() => fileInputRef.current.click()}>
              <PaperclipIcon size={16} />
            </button>
            <textarea
              className="chat-input"
              placeholder="Type a message..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={sending || (!text.trim() && !file)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </InternLayout>
  );
};

export default InternChat;
