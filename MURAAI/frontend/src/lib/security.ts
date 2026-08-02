// Input sanitization utilities
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim()
}

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return ''
  
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
}

// File validation utilities
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
]

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface FileValidationResult {
  isValid: boolean
  error?: string
}

export function validateFile(file: File): FileValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    }
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} is not allowed`,
    }
  }

  // Check file name for suspicious patterns
  const fileName = file.name.toLowerCase()
  if (fileName.includes('.exe') || fileName.includes('.bat') || fileName.includes('.sh')) {
    return {
      isValid: false,
      error: 'Executable files are not allowed',
    }
  }

  return { isValid: true }
}

export function validateMultipleFiles(files: File[]): FileValidationResult[] {
  return files.map(validateFile)
}

// XSS prevention utilities
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return ''
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// URL validation
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// Email validation (basic)
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Phone number validation (basic)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-+\()]{10,}$/
  return phoneRegex.test(phone)
}

// Token storage utilities (secure storage)
export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem('access_token')
  },
  
  setAccessToken: (token: string): void => {
    localStorage.setItem('access_token', token)
  },
  
  getRefreshToken: (): string | null => {
    return localStorage.getItem('refresh_token')
  },
  
  setRefreshToken: (token: string): void => {
    localStorage.setItem('refresh_token', token)
  },
  
  clearTokens: (): void => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },
  
  // Check if token is expired (if it has an expiry time)
  isTokenExpired: (): boolean => {
    const token = localStorage.getItem('access_token')
    if (!token) return true
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp
      if (!exp) return false
      
      return Date.now() >= exp * 1000
    } catch {
      return true
    }
  },
}
