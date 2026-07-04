import { useState, useEffect, useRef, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import chatService from '../services/chatService';
import Loader from '../components/common/Loader';
import { toast } from 'react-toastify';
import { CloseIcon, PaperclipIcon, MegaphoneIcon, ChatBubbleIcon } from '../components/common/Icons';
import '../styles/chat.css';

const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

// Merge a page of messages into the existing chronological list, deduping by
// id and re-sorting -- this lets both "load older page" and "poll for
// newest page" share one code path without ever producing duplicates or
// clobbering messages loaded from a different page.
const mergeMessages = (existing, incoming) => {
  const map = new Map(existing.map(m => [m.id, m]));
  incoming.forEach(m => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
};

const Chat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesPagination, setMessagesPagination] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsPagination, setAnnouncementsPagination] = useState(null);
  const [loadingMoreAnnouncements, setLoadingMoreAnnouncements] = useState(false);
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

  // Polling always re-fetches just the newest page (page 1) and merges it in
  // -- this picks up new messages without disturbing older pages the user
  // has loaded via "Load older messages".
  const fetchMessages = useCallback((intern_id) => {
    chatService.getMessages(intern_id, { page: 1, limit: 50 })
      .then(res => {
        setMessages(prev => mergeMessages(prev, res.data.data));
        setMessagesPagination(res.data.pagination || null);
      })
      .catch(() => {});
  }, []);

  const loadOlderMessages = () => {
    if (!selectedIntern || !messagesPagination || messagesPagination.page >= messagesPagination.totalPages) return;
    setLoadingOlder(true);
    chatService.getMessages(selectedIntern.intern_id, { page: messagesPagination.page + 1, limit: 50 })
      .then(res => {
        setMessages(prev => mergeMessages(prev, res.data.data));
        setMessagesPagination(res.data.pagination || null);
      })
      .catch(() => {})
      .finally(() => setLoadingOlder(false));
  };

  const fetchAnnouncements = useCallback(() => {
    chatService.getAnnouncements({ page: 1, limit: 50 })
      .then(res => {
        setAnnouncements(res.data.data);
        setAnnouncementsPagination(res.data.pagination || null);
      })
      .catch(() => {});
  }, []);

  const loadMoreAnnouncements = () => {
    if (!announcementsPagination || announcementsPagination.page >= announcementsPagination.totalPages) return;
    setLoadingMoreAnnouncements(true);
    chatService.getAnnouncements({ page: announcementsPagination.page + 1, limit: 50 })
      .then(res => {
        setAnnouncements(prev => {
          const map = new Map(prev.map(a => [a.id, a]));
          res.data.data.forEach(a => map.set(a.id, a));
          return Array.from(map.values());
        });
        setAnnouncementsPagination(res.data.pagination || null);
      })
      .catch(() => {})
      .finally(() => setLoadingMoreAnnouncements(false));
  };

  useEffect(() => {
    fetchConversations();
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (!selectedIntern) return;
    setLoading(true);
    setMessages([]);
    setMessagesPagination(null);
    chatService.getMessages(selectedIntern.intern_id, { page: 1, limit: 50 })
      .then(res => {
        setMessages(res.data.data);
        setMessagesPagination(res.data.pagination || null);
        setLoading(false);
      })
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

  const renderMessage = (msg) => {
    const isAnnouncement = msg.is_announcement;
    // "me"/"them" relative to the viewer (an admin, on this page) — not the
    // raw sender_role, which would hardcode "admin" to always render on the
    // right even when this same message is viewed from the intern's side.
    const bubbleClass = isAnnouncement ? 'announcement' : (msg.sender_role === 'admin' ? 'me' : 'them');

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{formatTime(msg.created_at)}</span>
            <button onClick={() => handleDelete(msg.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, color: 'inherit', display: 'flex' }}>
              <CloseIcon size={11} />
            </button>
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
              <div style={{ padding: '0 4px' }}>
                {announcements.map(a => (
                  <div key={a.id} style={{ padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{formatTime(a.created_at)}</div>
                  </div>
                ))}
                {announcementsPagination && announcementsPagination.page < announcementsPagination.totalPages && (
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <button className="btn-ghost" onClick={loadMoreAnnouncements} disabled={loadingMoreAnnouncements}>
                      {loadingMoreAnnouncements ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MAIN CHAT */}
        <div className="chat-main">
          {!selectedIntern && tab === 'chats' ? (
            <div className="chat-empty">
              <div className="chat-empty-icon"><ChatBubbleIcon size={30} /></div>
              <p>Select an intern to start chatting</p>
            </div>
          ) : tab === 'announcements' ? (
            <div className="chat-empty">
              <div className="chat-empty-icon"><MegaphoneIcon size={30} /></div>
              <p>Type a message below and send it to every intern</p>
            </div>
          ) : (
            <>
              <div className="chat-main-header">
                {selectedIntern?.intern_name} — {selectedIntern?.department}
              </div>
              <div className="chat-messages">
                {loading ? <Loader /> : messages.length === 0 ? (
                  <div className="chat-empty"><p>No messages yet. Say hello!</p></div>
                ) : (
                  <>
                    {messagesPagination && messagesPagination.page < messagesPagination.totalPages && (
                      <div style={{ textAlign: 'center', marginBottom: 12 }}>
                        <button className="btn-ghost" onClick={loadOlderMessages} disabled={loadingOlder}>
                          {loadingOlder ? 'Loading...' : 'Load older messages'}
                        </button>
                      </div>
                    )}
                    {messages.map(renderMessage)}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}

          {/* INPUT */}
          <div className="chat-input-area">
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
              {tab !== 'announcements' && (
                <button className="chat-file-btn" onClick={() => fileInputRef.current.click()}>
                  <PaperclipIcon size={16} />
                </button>
              )}
              <div className="chat-input-pill">
                <textarea
                  className="chat-input"
                  placeholder={tab === 'announcements' ? 'Type announcement…' : 'Type a message…'}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
              </div>
              {tab === 'announcements' ? (
                <button
                  className="chat-announce-btn"
                  onClick={() => handleSend(true)}
                  disabled={sending || !text.trim()}
                >
                  Send announcement
                </button>
              ) : (
                <button
                  className="chat-send-btn"
                  onClick={() => handleSend(false)}
                  disabled={sending || (!text.trim() && !file)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"></path></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Chat;
