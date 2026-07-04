import api from './api';

const attendanceService = {
  getAll: (params) => api.get('/attendance', { params }),
  getWeeklySummary: (params) => api.get('/attendance/weekly-summary', { params }),
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: (data) => api.post('/attendance/check-out', data),
  mark: (data) => api.post('/attendance', data),
  exportCSV: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    const url = `${process.env.REACT_APP_API_URL}/attendance/export?${query}`;

    // GET request — no CSRF header needed, but credentials must be
    // explicitly opted into on a raw fetch() the same way axios needs
    // withCredentials, or the auth cookie won't be attached.
    fetch(url, { credentials: 'include' })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'attendance.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
  },
};

export default attendanceService;