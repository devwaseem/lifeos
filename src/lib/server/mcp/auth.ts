import type { AuthInfo } from '@modelcontextprotocol/server'

export interface McpAuthEnvironment {
  MCP_SHARED_KEY?: string
  MCP_RESOURCE_URL?: string
  MCP_ALLOWED_HOSTS?: string
  MCP_ALLOWED_ORIGINS?: string
}

function list(value: string | undefined) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? []
}

function resourceUrl(environment: McpAuthEnvironment, request: Request) {
  return new URL(environment.MCP_RESOURCE_URL ?? new URL('/mcp', request.url).toString())
}

async function keysMatch(presented: string, expected: string) {
  const encoder = new TextEncoder()
  const [presentedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(presented)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const left = new Uint8Array(presentedHash)
  const right = new Uint8Array(expectedHash)
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

function unauthorized() {
  return Response.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  )
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

export async function authenticateMcpRequest(
  request: Request,
  environment: McpAuthEnvironment,
): Promise<AuthInfo | Response> {
  if (!environment.MCP_SHARED_KEY) {
    return Response.json({ error: 'MCP authentication is not configured' }, { status: 503 })
  }

  const presentedKeys = new URL(request.url).searchParams.getAll('key')
  if (presentedKeys.length !== 1 || !await keysMatch(presentedKeys[0], environment.MCP_SHARED_KEY)) {
    return unauthorized()
  }

  return {
    token: 'shared-key-authenticated',
    clientId: 'lifeos-owner',
    scopes: ['training:read', 'routines:read'],
    resource: resourceUrl(environment, request),
    extra: { subject: 'lifeos-owner' },
  }
}
