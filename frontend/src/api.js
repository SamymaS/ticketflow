const BASE_URL = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('tf_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 204) return null

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // Token présent mais refusé par le serveur → session expirée, on déconnecte
    if (res.status === 401 && token) {
      localStorage.removeItem('tf_token')
      localStorage.removeItem('tf_user')
      window.location.replace('/login')
      return null
    }
    const err = new Error(data.message || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

// Auth
export const register = (name, email, password) =>
  request('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })

export const login = (email, password) =>
  request('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

// Events
export const getEvents = () => request('/api/events')

export const getEvent = (id) => request(`/api/events/${id}`)

// Reservations
export const holdSeats = (eventId, seatIds) =>
  request('/api/reservations/hold', {
    method: 'POST',
    body: JSON.stringify({ eventId, seatIds }),
  })

export const confirmReservation = (eventId, seatIds) =>
  request('/api/reservations', {
    method: 'POST',
    body: JSON.stringify({ eventId, seatIds }),
  })

export const getMyReservations = () => request('/api/reservations/mine')
