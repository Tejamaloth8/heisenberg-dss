import axios from 'axios'

const BASE_URL = typeof __API_URL__ !== 'undefined' && __API_URL__
  ? __API_URL__
  : ''

const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export const authAPI = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login:    (email, password) => api.post('/auth/login',    { email, password }),
  me:       ()                => api.get('/auth/me'),
}

export const filesAPI = {
  list: () => api.get('/files/'),

  upload: (formData) => api.post('/files/upload', formData),

  download: (fileId, keyHex, filename) => {
    const fd = new FormData()
    fd.append('key_hex', keyHex)
    return api.post(`/files/download/${fileId}`, fd, { responseType: 'blob' })
      .then(res => _saveBlob(res.data, filename))
  },

  share: (fileId, recipientEmail, ownerKeyHex) => {
    const fd = new FormData()
    fd.append('recipient_email', recipientEmail)
    fd.append('owner_key_hex', ownerKeyHex)
    return api.post(`/files/share/${fileId}`, fd)
  },

  downloadShare: (shareId, keyHex, filename) => {
    const fd = new FormData()
    fd.append('key_hex', keyHex)
    return api.post(`/files/download-share/${shareId}`, fd, { responseType: 'blob' })
      .then(res => _saveBlob(res.data, filename))
  },

  verify: (fileId) => api.get(`/files/verify/${fileId}`),
}

function _saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
