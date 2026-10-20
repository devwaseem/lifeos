import { describe, expect, it } from 'vitest'
import { createMcpAuthorizationRedirect, getMcpAuthorizationServerMetadata } from './oauth-compatibility'
import { renderMcpConsentPage, type McpConsentDetails } from './consent'

describe('LifeOS MCP OAuth consent', () => {
  it('escapes client-controlled consent details before rendering them', () => {
    const details: McpConsentDetails = {
      clientName: '<script>alert(1)</script>',
      clientDomain: 'example.com<img src=x onerror=alert(1)>',
      redirectHost: 'oauth-redirect.googleusercontent.com',
      redirectIsLoopback: false,
      scope: ['training:read\"><script>alert(2)</script>'],
    }

    const html = renderMcpConsentPage(details, 'handle"><script>alert(3)</script>')

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&#60;script&#62;alert(1)&#60;/script&#62;')
    expect(html).toContain('handle&#34;&#62;&#60;script&#62;alert(3)&#60;/script&#62;')
  })
})

describe('LifeOS MCP OAuth Gemini compatibility', () => {
  it('returns a 302 callback without the optional authorization response issuer', () => {
    const headers = new Headers({ 'Set-Cookie': 'consent=approved; Secure' })
    const response = createMcpAuthorizationRedirect(
      'https://oauth-redirect.googleusercontent.com/r/lifeos?code=code-1&state=state-1&iss=https%3A%2F%2Flife.w9m.app',
      headers,
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://oauth-redirect.googleusercontent.com/r/lifeos?code=code-1&state=state-1',
    )
    expect(response.headers.get('Set-Cookie')).toBe('consent=approved; Secure')
  })

  it('publishes the minimal OAuth discovery fields supported by Gemini', () => {
    expect(getMcpAuthorizationServerMetadata('https://life.w9m.app')).toEqual({
      issuer: 'https://life.w9m.app',
      authorization_endpoint: 'https://life.w9m.app/authorize',
      token_endpoint: 'https://life.w9m.app/token',
      registration_endpoint: 'https://life.w9m.app/oauth/register',
      scopes_supported: ['training:read', 'routines:read'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
    })
  })
})
