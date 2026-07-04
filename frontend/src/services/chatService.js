import api from './api';

const chatService = {
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (intern_id, params) => api.get(`/chat/${intern_id}/messages`, { params }),
  getAnnouncements: (params) => api.get('/chat/announcements', { params }),
  sendMessage: (formData) => api.post('/chat/send', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMessage: (id) => api.delete(`/chat/${id}`),
  getMyMessages: (params) => api.get('/chat/my-messages', { params }),
  sendMyMessage: (formData) => api.post('/chat/my-messages', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default chatService;