/**
 * Normalizes API error shapes into a single, user-friendly string.
 *
 * Backend validation errors look like:
 *   { "error": "Validation error", "details": { "": "Value error, notification_email is required..." } }
 *
 * The axios response interceptor (see `api/axios.ts`) may also wrap errors as:
 *   { message: string, code?: string, details?: any }
 *
 * This helper understands both a raw AxiosError (`error.response.data`) and the
 * wrapped `ApiError` shape (`error.details`), and falls back gracefully when
 * neither is present.
 */

const GENERIC_MESSAGES = new Set([
  'an error occurred',
  'something went wrong',
  'request failed',
])

function pickFirstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

function extractFromDetails(details: unknown): string | null {
  if (!details) return null
  if (typeof details === 'string') return details
  if (Array.isArray(details)) return pickFirstNonEmptyString(details)
  if (typeof details === 'object') {
    return pickFirstNonEmptyString(Object.values(details as Record<string, unknown>))
  }
  return null
}

/** Cleans up Pydantic-style messages, e.g. "Value error, notification_email is required" */
function humanizeMessage(message: string): string {
  let cleaned = message.replace(/^value error,\s*/i, '').trim()
  cleaned = cleaned.replace(/_/g, ' ')
  if (!cleaned) return message
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  if (!/[.!?]$/.test(cleaned)) cleaned += '.'
  return cleaned
}

/** Extracts a meaningful message from a backend JSON error body. */
function extractBackendMessage(data: unknown): string | null {
  if (!data) return null
  if (typeof data === 'string') return humanizeMessage(data)
  if (typeof data !== 'object') return null

  const obj = data as Record<string, unknown>

  const fromDetails = extractFromDetails(obj.details)
  if (fromDetails) return humanizeMessage(fromDetails)

  const direct = pickFirstNonEmptyString([
    obj.message as string,
    obj.error as string,
  ])
  if (direct) return humanizeMessage(direct)

  return null
}

/**
 * Returns a safe, user-friendly error message from any error shape the app
 * might encounter (raw AxiosError, wrapped ApiError, plain Error, or string).
 * Never throws.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error) return fallback
  if (typeof error === 'string' && error.trim()) return error

  const err = error as Record<string, unknown>

  // Raw AxiosError shape: error.response.data
  const responseData = (err.response as { data?: unknown } | undefined)?.data
  const fromResponse = extractBackendMessage(responseData)
  if (fromResponse) return fromResponse

  // Wrapped ApiError shape: error.details holds the original backend body
  const fromDetails = extractBackendMessage(err.details)
  if (fromDetails) return fromDetails

  const message = err.message
  if (typeof message === 'string' && message.trim() && !GENERIC_MESSAGES.has(message.trim().toLowerCase())) {
    return message
  }

  return fallback
}
