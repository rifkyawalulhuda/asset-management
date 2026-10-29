import axios from 'axios'

const defaultBaseURL = `${window.location.protocol}//${window.location.hostname}:8000/api`
const configuredBaseURL = (import.meta.env.VITE_API_URL ?? '').trim()

const api = axios.create({
  baseURL: configuredBaseURL || defaultBaseURL,
  // NOTE: no global Content-Type here. Axios already sends application/json for
  // plain objects, and a global JSON header makes it convert FormData uploads
  // into JSON (the file is silently dropped).
})

export default api

