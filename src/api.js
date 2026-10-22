export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-MockMate-Request': '1', ...options.headers },
    signal: options.signal || AbortSignal.timeout(15000),
  })
  if (response.status === 204) return null
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Request failed. Please try again.')
  return body
}
export const send = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
