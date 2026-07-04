import api from './api';

const taskService = {
  getAll: (params) => api.get('/tasks', { params }),
  getOne: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  updateStatus: (id, status, version) => api.put(`/tasks/${id}`, { status, version }),
  update: (id, data) => api.put(`/tasks/${id}/edit`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  getComments: (id) => api.get(`/tasks/${id}/comments`),
  addComment: (id, comment) => api.post(`/tasks/${id}/comments`, { comment }),
};

export default taskService;