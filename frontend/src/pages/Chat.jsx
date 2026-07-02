import { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import chatService from '../services/chatService';
import Loader from '../components/common/Loader';
import { toast } from 'react-toastify';
import '../styles/chat.css';

const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const Chat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [messages, setMessages] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [tab, setTab] = useState('chats');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(() => {
    chatService.getConversations()
      .then(res => setConversations(res.data.data))
      .catch(() => {});
  }, []);

  const fetchMessages = useCallback((intern_id) => {
    chatService.getMessages(intern_id)
      .then(res => setMessages(res.data.data))
      .catch(() => {});
  }, []);

  const fetchAnnouncements = useCallback(() => {
    chatService.getAnnouncements()
      .then(res => setAnnouncements(res.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (!selectedIntern) return;
    setLoading(true);
    chatService.getMessages(selectedIntern.intern_id)
      .then(res => { setMessages(res.data.data); setLoading(false); })
      .catch(() => setLoading(false));

    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchMessages(selectedIntern.intern_id), 5000);
    return () => clearInterval(pollRef.current);
  }, [selectedIntern]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (is_announcement = false) => {
    if (!text.trim() && !file) return;
    if (!is_announcement && !selectedIntern) return;

    setSending(true);
    try {
      const fd = new FormData();
      fd.append('sender_role', 'admin');
      fd.append('message', text.trim());
      fd.append('is_announcement', is_announcement);
      if (!is_announcement) fd.append('intern_id', selectedIntern.intern_id);
      if (file) fd.append('file', file);

      await chatService.sendMessage(fd);
      setText('');
      setFile(null);

      if (is_announcement) {
        fetchAnnouncements();
        toast.success('Announcement sent');
      } else {
        fetchMessages(selectedIntern.intern_id);
        fetchConversations();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend(tab === 'announcements');
  }
};

  const handleDelete = async (id) => {
    try {
      await chatService.deleteMessage(id);
      if (selectedIntern) fetchMessages(selectedIntern.intern_id);
      fetchAnnouncements();
      fetchConversations();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const renderMessage = (msg) => {
    const isAnnouncement = msg.is_announcement;
    const bubbleClass = isAnnouncement ? 'announcement' : msg.sender_role;

    return (
      <div key={msg.id} className={`chat-bubble-wrap ${bubbleClass}`}>
        <div className={`chat-bubble ${bubbleClass}`}>
          {isAnnouncement && <div style={{ fontWeight: 600, marginBottom: 4 }}>📢 Announcement</div>}
          {msg.message && <div>{msg.message}</div>}
          {msg.file_url && (
            <a href={`http://localhost:5000${msg.file_url}`} target="_blank" rel="noreferrer" className="chat-file-link">
              📎 {msg.file_name}
            </a>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{formatTime(msg.created_at)}</span>
            <button onClick={() => handleDelete(msg.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.5, color: 'inherit' }}>✕</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout title="Chat">
      <div className="chat-page">
        {/* SIDEBAR */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-tabs">
            <button className={`chat-tab ${tab === 'chats' ? 'active' : ''}`} onClick={() => setTab('chats')}>Chats</button>
            <button className={`chat-tab ${tab === 'announcements' ? 'active' : ''}`} onClick={() => setTab('announcements')}>Announcements</button>
          </div>

          <div className="chat-list">
            {tab === 'chats' ? (
              conversations.length === 0 ? (
                <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No interns yet</div>
              ) : conversations.map(c => (
                <div
                  key={c.intern_id}
                  className={`chat-list-item ${selectedIntern?.intern_id === c.intern_id ? 'active' : ''}`}
                  onClick={() => setSelectedIntern(c)}
                >
                  <div className="chat-list-name">{c.intern_name}</div>
                  <div className="chat-list-preview">{c.last_message || c.file_name || 'No messages yet'}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: 16 }}>
                <button className="announce-btn" style={{ width: '100%', marginBottom: 12 }} onClick={() => handleSend(true)} disabled={!text.trim()}>
                  📢 Send Announcement
                </button>
                {announcements.map(a => (
                  <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{formatTime(a.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MAIN CHAT */}
        <div className="chat-main">
          {!selectedIntern && tab === 'chats' ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">💬</div>
              <p>Select an intern to start chatting</p>
            </div>
          ) : tab === 'announcements' ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">📢</div>
              <p>Type a message below and click Send Announcement</p>
            </div>
          ) : (
            <>
              <div className="chat-main-header">
                {selectedIntern?.intern_name} — {selectedIntern?.department}
              </div>
              <div className="chat-messages">
                {loading ? <Loader /> : messages.length === 0 ? (
                  <div className="chat-empty"><p>No messages yet. Say hello!</p></div>
                ) : messages.map(renderMessage)}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}

          {/* INPUT */}
          <div className="chat-input-area">
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
                placeholder={tab === 'announcements' ? 'Type announcement...' : 'Type a message...'}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="chat-send-btn"
                onClick={() => handleSend(tab === 'announcements')}
                disabled={sending || (!text.trim() && !file)}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Chat;