import type { AxiosError } from 'axios'

/**
 * FastAPI returns `detail` as a string for HTTPException and as an array for 422.
 * Anything else (network error, empty body) falls back to the axios message.
 */
export function readDetail(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const detail = (data as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => (item && typeof item === 'object' ? (item as { msg?: unknown }).msg : null))
      .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0)
    return messages.length > 0 ? messages.join('; ') : null
  }
  return null
}

/** Human readable message for a failed request. */
export function apiErrorMessage(error: unknown): string | null {
  if (!error) return null
  const axiosError = error as AxiosError
  return (
    readDetail(axiosError.response?.data)
    ?? axiosError.message
    ?? 'Something went wrong'
  )
}
