import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export interface OwnerAuthEnvironment {
  LOCAL_SYNC_TOKEN?: string
  CF_ACCESS_TEAM_DOMAIN?: string
  CF_ACCESS_AUD?: string
}

const accessKeySets = new Map<string, JWTVerifyGetKey>()

export async function authenticateOwnerRequest(request: Request, environment: OwnerAuthEnvironment) {
  if (environment.LOCAL_SYNC_TOKEN) {
    return request.headers.get('Authorization') === `Bearer ${environment.LOCAL_SYNC_TOKEN}`
      ? 'local-development'
      : null
  }

  if (!environment.CF_ACCESS_TEAM_DOMAIN || !environment.CF_ACCESS_AUD) return null
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!assertion) return null

  const issuer = `https://${environment.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`
  let keySet = accessKeySets.get(issuer)
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
    accessKeySets.set(issuer, keySet)
  }

  try {
    const { payload } = await jwtVerify(assertion, keySet, {
      issuer,
      audience: environment.CF_ACCESS_AUD,
    })
    return typeof payload.sub === 'string'
      ? payload.sub
      : typeof payload.email === 'string'
        ? payload.email
        : null
  } catch {
    return null
  }
}
