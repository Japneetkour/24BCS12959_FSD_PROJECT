import axios from 'axios';

/**
 * Single Axios instance. The JWT lives in an httpOnly cookie, so we only need
 * `withCredentials`. VITE_API_URL lets the client talk to an API on another domain.
 */
export const API_BASE = import.meta.env.VITE_API_URL || '';

const http = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
  timeout: 30000,
});

http.interceptors.response.use(
  (res) => res.data, // unwrap axios envelope → { success, message, data }
  (error) => {
    const status = error.response?.status;
    const raw = error.response?.data;
    const body = raw && !(raw instanceof Blob) ? raw : {};
    let fallback = 'Network error — is the server running?';
    if (error.code === 'ECONNABORTED') fallback = 'The request timed out.';
    else if (status) fallback = `Request failed (${status}).`;
    const err = new Error(body.message || fallback);
    err.status = status;
    err.code = body.code;
    err.errors = body.errors;
    // Session expired anywhere in the app → let AuthContext log the user out.
    if (status === 401 && !error.config?.url?.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(err);
  }
);

const data = (p) => p.then((r) => r.data);
const withMessage = (p) => p.then((r) => ({ data: r.data, message: r.message }));

export const authApi = {
  me: () => data(http.get('/auth/me')),
  login: (body) => withMessage(http.post('/auth/login', body)),
  register: (body) => withMessage(http.post('/auth/register', body)),
  logout: () => http.post('/auth/logout'),
  verifyEmail: (token) => withMessage(http.post('/auth/verify-email', { token })),
  resendVerification: (email) => withMessage(http.post('/auth/resend-verification', { email })),
  forgotPassword: (email) => withMessage(http.post('/auth/forgot-password', { email })),
  resetPassword: (token, password) => withMessage(http.post(`/auth/reset-password/${token}`, { password })),
  updatePassword: (body) => withMessage(http.patch('/auth/update-password', body)),
};

export const userApi = {
  updateMe: (body) => data(http.patch('/users/me', body)),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return data(http.post('/users/me/avatar', fd));
  },
  search: (q) => data(http.get('/users/search', { params: { q } })),
  bookmarks: () => data(http.get('/users/me/bookmarks')),
};

export const taskApi = {
  list: (params) => data(http.get('/tasks', { params })),
  stats: () => data(http.get('/tasks/stats')),
  smart: (limit = 5) => data(http.get('/tasks/smart', { params: { limit } })),
  subjects: () => data(http.get('/tasks/subjects')),
  create: (body) => data(http.post('/tasks', body)),
  update: (id, body) => data(http.patch(`/tasks/${id}`, body)),
  toggle: (id) => data(http.patch(`/tasks/${id}/toggle`)),
  remove: (id) => data(http.delete(`/tasks/${id}`)),
};

export const groupApi = {
  list: (params) => data(http.get('/groups', { params })),
  subjects: () => data(http.get('/groups/subjects')),
  invites: () => data(http.get('/groups/invites')),
  get: (id) => data(http.get(`/groups/${id}`)),
  create: (body) => data(http.post('/groups', body)),
  update: (id, body) => data(http.patch(`/groups/${id}`, body)),
  remove: (id) => data(http.delete(`/groups/${id}`)),
  join: (id) => data(http.post(`/groups/${id}/join`)),
  leave: (id) => data(http.post(`/groups/${id}/leave`)),
  invite: (id, email) => withMessage(http.post(`/groups/${id}/invite`, { email })),
  respond: (id, accept) => data(http.post(`/groups/${id}/invite/respond`, { accept })),
  setRole: (id, userId, role) => data(http.patch(`/groups/${id}/members/${userId}`, { role })),
  removeMember: (id, userId) => data(http.delete(`/groups/${id}/members/${userId}`)),
  messages: (id, params) => data(http.get(`/groups/${id}/messages`, { params })),
  sendMessage: (id, content) => data(http.post(`/groups/${id}/messages`, { content })),
};

export const resourceApi = {
  list: (params) => data(http.get('/resources', { params })),
  filters: () => data(http.get('/resources/filters')),
  get: (id) => data(http.get(`/resources/${id}`)),
  upload: (formData, onUploadProgress) => data(http.post('/resources', formData, { onUploadProgress, timeout: 120000 })),
  update: (id, body) => data(http.patch(`/resources/${id}`, body)),
  remove: (id) => data(http.delete(`/resources/${id}`)),
  bookmark: (id) => data(http.post(`/resources/${id}/bookmark`)),
  /** Downloads through the authenticated endpoint and triggers a browser save. */
  download: async (resource) => {
    const blob = await http.get(`/resources/${resource._id}/download`, { responseType: 'blob', timeout: 120000 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resource.file?.originalName || `${resource.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const eventApi = {
  list: (params) => data(http.get('/events', { params })),
  registered: () => data(http.get('/events/registered')),
  get: (id) => data(http.get(`/events/${id}`)),
  create: (body) => data(http.post('/events', body)),
  update: (id, body) => data(http.patch(`/events/${id}`, body)),
  remove: (id) => data(http.delete(`/events/${id}`)),
  register: (id) => data(http.post(`/events/${id}/register`)),
  unregister: (id) => data(http.delete(`/events/${id}/register`)),
  participants: (id, params) => data(http.get(`/events/${id}/participants`, { params })),
};

export const announcementApi = {
  list: (params) => data(http.get('/announcements', { params })),
  get: (id) => data(http.get(`/announcements/${id}`)),
  create: (body) => withMessage(http.post('/announcements', body)),
  update: (id, body) => data(http.patch(`/announcements/${id}`, body)),
  remove: (id) => data(http.delete(`/announcements/${id}`)),
};

export const notificationApi = {
  list: (params) => data(http.get('/notifications', { params })),
  unreadCount: () => data(http.get('/notifications/unread-count')),
  markRead: (id) => data(http.patch(`/notifications/${id}/read`)),
  markAllRead: () => data(http.patch('/notifications/read-all')),
  remove: (id) => data(http.delete(`/notifications/${id}`)),
  clearRead: () => data(http.delete('/notifications/read')),
};

export const insightApi = {
  dashboard: () => data(http.get('/dashboard')),
  analytics: () => data(http.get('/analytics/me')),
  calendar: (start, end) => data(http.get('/calendar', { params: { start, end } })),
  search: (q, limit) => data(http.get('/search', { params: { q, limit } })),
  activity: (params) => data(http.get('/activity', { params })),
};

export const adminApi = {
  stats: () => data(http.get('/admin/stats')),
  users: (params) => data(http.get('/admin/users', { params })),
  user: (id) => data(http.get(`/admin/users/${id}`)),
  updateUser: (id, body) => data(http.patch(`/admin/users/${id}`, body)),
  deleteUser: (id) => data(http.delete(`/admin/users/${id}`)),
  resources: (params) => data(http.get('/admin/resources', { params })),
};

export default http;
