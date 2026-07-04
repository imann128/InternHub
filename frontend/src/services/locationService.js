import api from './api';

const locationService = {
  getAll: () => api.get('/locations'),
  getOne: (id) => api.get(`/locations/${id}`),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  deactivate: (id, version) => api.patch(`/locations/${id}/deactivate`, { version }),
  activate: (id, version) => api.patch(`/locations/${id}/activate`, { version }),
  assignInterns: (id, internIds) => api.put(`/locations/${id}/interns`, { intern_ids: internIds }),
};

export default locationService;
