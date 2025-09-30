export const API_BASE = '/api/chat_08_rag'
export const API_BASE_SESSION = '/api/chat_08_rag/session'


// export const API_BASE = '/api/chat_07_tool_calling_sample'
// export const API_BASE_SESSION = '/api/chat_07_tool_calling_sample/session'

export function buildApiUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint
  }
  
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  
  const queryString = searchParams.toString()
  return queryString ? `${endpoint}?${queryString}` : endpoint
}