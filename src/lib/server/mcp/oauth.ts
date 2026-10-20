import OAuthProvider, {
  AuthorizationError,
  CimdFetchError,
  insufficientScope,
  type OAuthHelpers,
  type OAuthResourceAuth,
} from '@cloudflare/workers-oauth-provider'
import type { AuthInfo } from '@modelcontextprotocol/server'
import { verifyAccessIdentity, type AccessIdentity } from './auth'
import { handleAuthorizedMcpRequest, type McpEnvironment } from './server'
import { renderMcpConsentPage } from './consent'
import { createMcpAuthorizationRedirect, getMcpAuthorizationServerMetadata } from './oauth-compatibility'

const requiredScopes = ['training:read', 'routines:read']

export interface McpOAuthEnvironment extends McpEnvironment {
  OAUTH_KV: KVNamespace
  OAUTH_PROVIDER?: OAuthHelpers
}

interface McpOAuthProps {
  subject: string
}

type OAuthExecutionContext = ExecutionContext & {
  auth?: OAuthResourceAuth
  props?: McpOAuthProps
}

const providers = new Map<string, OAuthProvider<McpOAuthEnvironment>>()


async function authorizationIdentity(request: Request, environment: McpOAuthEnvironment): Promise<AccessIdentity | null> {
  const authorization = request.headers.get('Authorization')
  if (environment.MCP_LOCAL_TOKEN && authorization === `Bearer ${environment.MCP_LOCAL_TOKEN}`) {
    return {
      subject: 'local-development',
      clientId: 'lifeos-local-mcp',
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
    }
  }
  return verifyAccessIdentity(request.headers.get('Cf-Access-Jwt-Assertion'), environment)
}


async function handleAuthorizationRequest(request: Request, environment: McpOAuthEnvironment) {
  const oauth = environment.OAUTH_PROVIDER
  if (!oauth) return Response.json({ error: 'OAuth provider unavailable' }, { status: 503 })

  const identity = await authorizationIdentity(request, environment)
  if (!identity) return Response.json({ error: 'Owner authentication required' }, { status: 401 })

  try {
    if (request.method === 'GET') {
      const oauthRequest = await oauth.parseAuthRequest(request)
      const details = await oauth.describeConsent(oauthRequest)
      const consent = await oauth.beginConsent(oauthRequest)
      consent.headers.set('Content-Type', 'text/html; charset=utf-8')
      return new Response(renderMcpConsentPage(details, consent.handle), { headers: consent.headers })
    }

    if (request.method === 'POST') {
      const form = await request.formData()
      const handle = String(form.get('handle') ?? '')
      if (form.get('decision') !== 'approve') {
        const denied = await oauth.denyConsent(request, handle)
        return createMcpAuthorizationRedirect(denied.headers.get('Location')!, denied.headers)
      }

      const approved = await oauth.approveConsent(request, handle, {
        scope: form.getAll('scope').map(String),
      })
      const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId: 'lifeos-owner',
        metadata: { label: 'LifeOS owner' },
        scope: approved.request.scope,
        props: { subject: identity.subject } satisfies McpOAuthProps,
      })
      return createMcpAuthorizationRedirect(redirectTo, approved.headers)
    }

    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) {
      return createMcpAuthorizationRedirect(error.redirectTo)
    }
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      const message = error instanceof AuthorizationError ? error.description : 'This app could not be verified.'
      return new Response(message, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    throw error
  }
}

const apiHandler = {
  async fetch(request: Request, environment: McpOAuthEnvironment, context: ExecutionContext) {
    const oauthContext = context as OAuthExecutionContext
    if (!oauthContext.auth || !oauthContext.props?.subject) {
      return Response.json({ error: 'OAuth authorization context unavailable' }, { status: 500 })
    }
    if (!requiredScopes.every((scope) => oauthContext.auth!.scope.includes(scope))) {
      return insufficientScope(oauthContext.auth, requiredScopes)
    }

    const resource = new URL(environment.MCP_RESOURCE_URL ?? new URL('/mcp', request.url).toString())
    const authentication: AuthInfo = {
      token: oauthContext.auth.token,
      clientId: oauthContext.auth.clientId ?? 'registered-oauth-client',
      scopes: oauthContext.auth.scope,
      expiresAt: oauthContext.auth.expiresAt,
      resource,
      extra: { subject: oauthContext.props.subject },
    }
    return handleAuthorizedMcpRequest(request, environment, authentication)
  },
}

const defaultHandler = {
  fetch(request: Request, environment: McpOAuthEnvironment) {
    if (new URL(request.url).pathname === '/authorize') return handleAuthorizationRequest(request, environment)
    return new Response('Not found', { status: 404 })
  },
}

function oauthProvider(environment: McpOAuthEnvironment, request: Request) {
  const resource = new URL(environment.MCP_RESOURCE_URL ?? new URL('/mcp', request.url).toString())
  const key = resource.toString()
  let provider = providers.get(key)
  if (provider) return provider

  provider = new OAuthProvider<McpOAuthEnvironment>({
    apiRoute: resource.pathname,
    apiHandler,
    defaultHandler,
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/token',
    clientRegistrationEndpoint: '/oauth/register',
    clientIdMetadataDocumentEnabled: false,
    accessTokenTTL: 15 * 60,
    refreshTokenTTL: 14 * 24 * 60 * 60,
    clientRegistrationTTL: 7 * 24 * 60 * 60,
    scopesSupported: requiredScopes,
    requiredScopes,
    resourceMetadata: {
      resource: resource.toString(),
      authorization_servers: [resource.origin],
      bearer_methods_supported: ['header'],
      resource_name: 'LifeOS Training MCP',
    },
  })
  providers.set(key, provider)
  return provider
}

export function handleMcpOAuthRequest(
  request: Request,
  environment: McpOAuthEnvironment,
  context: ExecutionContext,
) {
  if (new URL(request.url).pathname === '/.well-known/oauth-authorization-server') {
    const resource = new URL(environment.MCP_RESOURCE_URL ?? new URL('/mcp', request.url).toString())
    return Response.json(getMcpAuthorizationServerMetadata(resource.origin))
  }
  return oauthProvider(environment, request).fetch(request, environment, context)
}
