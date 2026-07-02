import api from './api';

const chatService = {
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (intern_id) => api.get(`/chat/${intern_id}/messages`),
  getAnnouncements: () => api.get('/chat/announcements'),
  sendMessage: (formData) => api.post('/chat/send', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMessage: (id) => api.delete(`/chat/${id}`),
  getMyMessages: () => api.get('/chat/my-messages'),
  sendMyMessage: (formData) => api.post('/chat/my-messages', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default chatService;