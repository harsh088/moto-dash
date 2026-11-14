import { TOMTOM_KEY } from '../map/provider'
import { getUsage, markTomTomBlocked, recordTomTomRequest } from './usage'

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const tomtomAvailable = (): boolean => !!TOMTOM_KEY && !getUsage().blockedDay

/**
 * fetch() for TomTom REST APIs: adds the key, counts the request and
 * switches the whole app to free fallbacks for today on 401/403 (bad key / over limit).
 */
export async function tomtomFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  init?: RequestInit,
): Promise<T> {
  if (!TOMTOM_KEY) throw new HttpError(0, 'No TomTom key')
  const q = new URLSearchParams({ key: TOMTOM_KEY })
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v))
  const url = `https://api.tomtom.com${path}?${q}`
  recordTomTomRequest(url)
  const res = await fetch(url, init)
  if (res.status === 401 || res.status === 403) {
    markTomTomBlocked(`HTTP ${res.status}`)
    throw new HttpError(res.status, 'TomTom refused the request (key, domain or free limit)')
  }
  if (!res.ok) {
    let msg = `TomTom error ${res.status}`
    try {
      const body = (await res.json()) as { error?: { description?: string }; detailedError?: { message?: string } }
      msg = body.detailedError?.message ?? body.error?.description ?? msg
    } catch {
      /* not JSON */
    }
    throw new HttpError(res.status, msg)
  }
  return (await res.json()) as T
}
