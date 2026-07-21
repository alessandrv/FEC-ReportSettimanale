export async function jsonFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const payload = await response.json()

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : 'Request failed'

    throw new Error(message)
  }

  return payload as T
}