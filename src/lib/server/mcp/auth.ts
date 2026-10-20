import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { AuthInfo } from '@modelcontextprotocol/server'

export interface McpAuthEnvironment {
  MCP_LOCAL_TOKEN?: string
  MCP_RESOURCE_URL?: string
  MCP_ALLOWED_HOSTS?: string
  MCP_ALLOWED_ORIGINS?: string
  MCP_ALLOWED_SUBJECT?: string
  CF_ACCESS_TEAM_DOMAIN?: string
  CF_ACCESS_AUD?: string
}
const accessKeySets = new Map<string, JWTVerifyGetKey>()

function list(value: string | undefined) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? []
}

function resourceUrl(environment: McpAuthEnvironment, request: Request) {
  return new URL(environment.MCP_RESOURCE_URL ?? new URL('/mcp', request.url).toString())
}

function challenge(environment: McpAuthEnvironment, request: Request, status = 401, error = 'invalid_token') {
  const resource = resourceUrl(environment, request)
  const metadata = new URL(`/.well-known/oauth-protected-resource${resource.pathname}`, resource.origin)
  return Response.json({ error }, {
    status,
    headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadata}"` },
  })
}

export function validateMcpRequestOrigin(request: Request, environment: McpAuthEnvironment) {
  const resource = resourceUrl(environment, request)
  const allowedHosts = list(environment.MCP_ALLOWED_HOSTS)
  if (allowedHosts.length === 0) allowedHosts.push(resource.hostname)
  const host = request.headers.get('Host')
  if (!host) return Response.json({ error: 'Missing Host header' }, { status: 400 })
  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    return Response.json({ error: 'Invalid Host header' }, { status: 400 })
  }
  if (!allowedHosts.includes(hostname)) return Response.json({ error: 'Invalid Host header' }, { status: 403 })

  const origin = request.headers.get('Origin')
  if (!origin) return null
  const allowedOrigins = list(environment.MCP_ALLOWED_ORIGINS)
  if (allowedOrigins.length === 0) allowedOrigins.push(resource.origin)
  if (!allowedOrigins.includes(origin)) return Response.json({ error: 'Invalid Origin header' }, { status: 403 })
  return null
}

export async function authenticateMcpRequest(request: Request, environment: McpAuthEnvironment): Promise<AuthInfo | Response> {
  const authorization = request.headers.get('Authorization')
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  const accessAssertion = request.headers.get('Cf-Access-Jwt-Assertion')
  const resource = resourceUrl(environment, request)

  if (environment.MCP_LOCAL_TOKEN) {
    if (bearerToken !== environment.MCP_LOCAL_TOKEN) return challenge(environment, request)
    return {
      token: bearerToken,
      clientId: 'lifeos-local-mcp',
      scopes: ['training:read', 'routines:read'],
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      resource,
      extra: { subject: 'local-development' },
    }
  }

  if (!environment.CF_ACCESS_TEAM_DOMAIN || !environment.CF_ACCESS_AUD || !environment.MCP_ALLOWED_SUBJECT) {
    return Response.json({ error: 'MCP authentication is not configured' }, { status: 503 })
  }
  const assertion = accessAssertion ?? bearerToken
  if (!assertion) return challenge(environment, request)

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
    if (payload.sub !== environment.MCP_ALLOWED_SUBJECT || typeof payload.exp !== 'number') return challenge(environment, request)
    return {
      token: bearerToken ?? assertion,
      clientId: typeof payload.client_id === 'string' ? payload.client_id : payload.sub,
      scopes: ['training:read', 'routines:read'],
      expiresAt: payload.exp,
      resource,
      extra: { subject: payload.sub },
    }
  } catch {
    return challenge(environment, request)
  }
}

export function protectedResourceMetadata(request: Request, environment: McpAuthEnvironment) {
  const resource = resourceUrl(environment, request)
  const authorizationServer = environment.CF_ACCESS_TEAM_DOMAIN
    ? `https://${environment.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`
    : resource.origin
  return Response.json({
    resource: resource.toString(),
    authorization_servers: [authorizationServer],
    scopes_supported: ['training:read', 'routines:read'],
    bearer_methods_supported: ['header'],
    resource_name: 'LifeOS Training MCP',
  })
}
