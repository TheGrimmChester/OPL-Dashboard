import { createOplClient } from '@open-family/client/opl'
import { readSessionToken } from '@open-family/ui'
import { API_BASE } from './apiBase'

/** Shared OPL control-plane client (health / future typed calls). */
export function getOplClient() {
  return createOplClient({
    baseUrl: API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8092'),
    getAccessToken: () => readSessionToken('auth_token'),
  })
}
