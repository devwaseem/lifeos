import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { handleWorkoutSyncRequest, type WorkoutSyncEnvironment } from './workout-sync'

const issuer = 'https://lifeos-test.cloudflareaccess.com'
const audience = 'lifeos-access-audience'
const keyId = 'lifeos-test-key'
let privateKey: CryptoKey
let publicJwk: JWK

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256', { extractable: true })
  privateKey = keyPair.privateKey
  publicJwk = { ...await exportJWK(keyPair.publicKey), kid: keyId, alg: 'RS256', use: 'sig' }
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ keys: [publicJwk] })))
})

async function accessToken(overrides: {
  audience?: string
  expirationTime?: number | string
  signingKey?: CryptoKey
} = {}) {
  return new SignJWT({ email: 'owner@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setIssuer(issuer)
    .setAudience(overrides.audience ?? audience)
    .setIssuedAt()
    .setExpirationTime(overrides.expirationTime ?? '5m')
    .sign(overrides.signingKey ?? privateKey)
}

function request(assertion?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (assertion) headers.set('Cf-Access-Jwt-Assertion', assertion)
  return new Request('https://app.example.com/api/sync', {
    method: 'POST',
    headers,
    body: '{}',
  })
}

function environment(): WorkoutSyncEnvironment {
  return {
    DB: {} as D1Database,
    CF_ACCESS_TEAM_DOMAIN: 'lifeos-test',
    CF_ACCESS_AUD: audience,
  }
}

describe('POST /api/sync authentication', () => {
  it('accepts a valid Cloudflare Access assertion before validating the sync body', async () => {
    const response = await handleWorkoutSyncRequest(request(await accessToken()), environment())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid sync payload' })
  })

  it('accepts the complete workout archive above the former one-megabyte limit', async () => {
    const archiveRequest = request(await accessToken())
    archiveRequest.headers.set('Content-Length', String(1_100_000))

    const response = await handleWorkoutSyncRequest(archiveRequest, environment())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid sync payload' })
  })

  it('rejects a request without a Cloudflare Access assertion', async () => {
    const response = await handleWorkoutSyncRequest(request(), environment())

    expect(response.status).toBe(401)
  })

  it('rejects an assertion issued for a different Access application', async () => {
    const response = await handleWorkoutSyncRequest(
      request(await accessToken({ audience: 'another-application' })),
      environment(),
    )

    expect(response.status).toBe(401)
  })

  it('rejects an expired Access assertion', async () => {
    const response = await handleWorkoutSyncRequest(
      request(await accessToken({ expirationTime: Math.floor(Date.now() / 1000) - 60 })),
      environment(),
    )

    expect(response.status).toBe(401)
  })

  it('rejects an assertion with an invalid signature', async () => {
    const untrustedKeys = await generateKeyPair('RS256')
    const response = await handleWorkoutSyncRequest(
      request(await accessToken({ signingKey: untrustedKeys.privateKey })),
      environment(),
    )

    expect(response.status).toBe(401)
  })

  it('accepts the development-only bearer token for the local Worker', async () => {
    const localRequest = request()
    localRequest.headers.set('Authorization', 'Bearer lifeos-local-dev')
    const localEnvironment: WorkoutSyncEnvironment = {
      DB: {} as D1Database,
      LOCAL_SYNC_TOKEN: 'lifeos-local-dev',
    }

    const response = await handleWorkoutSyncRequest(localRequest, localEnvironment)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid sync payload' })
  })

  it('does not expose a cross-origin preflight response', async () => {
    const response = await handleWorkoutSyncRequest(
      new Request('https://app.example.com/api/sync', { method: 'OPTIONS' }),
      environment(),
    )

    expect(response.status).toBe(405)
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false)
  })

})
