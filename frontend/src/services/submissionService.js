import api from './api';

const submissionService = {
  getAll: (params) => api.get('/submissions', { params }),
  getOne: (id) => api.get(`/submissions/${id}`),
  create: (formData) => api.post('/submissions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  review: (id, data) => api.post(`/submissions/${id}/review`, data),
  download: async (id, fileId, fileName) => {
    const res = await api.get(`/submissions/${id}/files/${fileId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'download';
    a.click();
    window.URL.revokeObjectURL(url);
  },
};

export default submissionService;