import api from './api';

const locationService = {
  getAll: () => api.get('/locations'),
  getOne: (id) => api.get(`/locations/${id}`),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  deactivate: (id) => api.patch(`/locations/${id}/deactivate`),
  activate: (id) => api.patch(`/locations/${id}/activate`),
  assignInterns: (id, internIds) => api.put(`/locations/${id}/interns`, { intern_ids: internIds }),
};

export default locationService;
