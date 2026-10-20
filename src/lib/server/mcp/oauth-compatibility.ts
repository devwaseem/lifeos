const supportedScopes = ['training:read', 'routines:read']

export function createMcpAuthorizationRedirect(redirectTo: string, headers = new Headers()) {
  const redirect = new URL(redirectTo)
  // Google's account-linking callback contract accepts `code` and `state`; omit
  // RFC 9207's optional authorization response issuer for this client.
  redirect.searchParams.delete('iss')
  headers.set('Location', redirect.toString())
  return new Response(null, { status: 302, headers })
}

export function getMcpAuthorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/oauth/register`,
    scopes_supported: supportedScopes,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
  }
}
