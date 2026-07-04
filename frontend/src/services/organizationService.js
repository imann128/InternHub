import api from './api';

const organizationService = {
  getSettings: () => api.get('/organizations/settings'),
  regenerateInviteCode: () => api.post('/organizations/invite-code/regenerate'),
  updateGroqKey: (groq_api_key) => api.put('/organizations/groq-key', { groq_api_key }),
};

export default organizationService;
