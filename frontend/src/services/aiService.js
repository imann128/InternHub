import api from './api';

const aiService = {
  // messages: [{ role: 'user'|'assistant', content }]. The server picks the
  // right system prompt based on the logged-in user's role -- the client
  // never sends or chooses one.
  chat: (messages) => api.post('/ai/chat', { messages }),
  enhanceTask: (title, description) => api.post('/ai/enhance-task', { title, description }),
  // Lets the UI hide the chat bubble / Enhance button instead of showing
  // them and then failing on every click when no Groq key is configured.
  status: () => api.get('/ai/status'),
};

export default aiService;
