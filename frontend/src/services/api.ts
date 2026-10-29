import axios from 'axios'

const defaultBaseURL = `${window.location.protocol}//${window.location.hostname}:8000/api`

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseURL,
  headers: { 'Content-Type': 'application/json' },
})

export default api

