# Gemini Apps custom MCP compatibility

## Conclusion

A separate OAuth-protected `/googlemcp` endpoint is the MCP-standard implementation path for a Gemini Apps custom connected app, while the existing shared-key `/mcp` endpoint remains available to its current clients. It **cannot** make an otherwise ineligible Google account eligible. Google requires the person adding the app to be 18 or older, in the US, using a personal (not work or school) Google Account, with Keep Activity enabled; custom apps are currently English-only and are connected in the Gemini web app ([Google Gemini Apps Help](https://support.google.com/gemini/answer/17209137?hl=en&co=GENIE.Platform%3DDesktop)).

**Recommendation:** retain `/mcp` unchanged and add `/googlemcp` as a separately configured OAuth/MCP resource that delegates to the same LifeOS tool and business-logic layer. Treat Google-account eligibility as a prerequisite to using or validating the Gemini connection, not as a server-integration problem. Google documents the DCR/manual-credentials choice, but not Gemini-specific transport, grant, redirect-URI, PKCE, token, or credential-field requirements; an eligible-account connection is still required to establish client-specific interoperability ([Google Gemini Apps Help](https://support.google.com/gemini/answer/17209137?hl=en&co=GENIE.Platform%3DDesktop)).

## Eligibility is not a server capability

Google's documented prerequisites are applied to the Gemini user and its UI: the user signs in to Gemini, opens Connected Apps, and supplies an MCP server URL ([Google Gemini Apps Help](https://support.google.com/gemini/answer/17209137?hl=en&co=GENIE.Platform%3DDesktop)). **[Inference]** Because the URL is entered only after those account-side prerequisites, changing an endpoint path, adding OAuth, or implementing MCP metadata cannot cause the Custom apps UI to appear for an ineligible account or bypass the age, location, account-type, Keep Activity, language, or web-app restrictions.

## Authentication compatibility

Gemini documents two connection paths:

- Enter the custom app's MCP server URL; when the server supports Dynamic Client Registration (DCR), continue the connection flow.
- If it does **not** support DCR, open **Advanced features** and enter credentials before continuing ([Google Gemini Apps Help](https://support.google.com/gemini/answer/17209137?hl=en&co=GENIE.Platform%3DDesktop)).

The MCP authorization specification explains the protocol counterpart: a protected HTTP MCP server advertises OAuth protected-resource metadata, its authorization server publishes authorization-server metadata, and DCR is an optional registration mechanism. When DCR is unavailable, pre-registered static client credentials may be supplied through a client UI ([MCP Authorization: discovery and registration](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#client-registration-approaches), [MCP Authorization: preregistration](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#preregistration)). Google documents that it will offer credential entry in the no-DCR case, but does not publish a Gemini-specific client-registration contract on that help page; the OAuth authorization server must therefore accept the client and redirect flow Gemini actually presents.

The existing route is intentionally different: it accepts one `key` query parameter and maps it to the owner identity ([current shared-key authenticator](../../src/lib/server/mcp/auth.ts)). It is not the OAuth bearer-token flow described by MCP, which requires `Authorization: Bearer <access-token>` on each HTTP request and prohibits access tokens in query strings ([MCP Authorization: access-token usage](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#access-token-usage)). Do not attempt to reinterpret the shared key as a Gemini OAuth client credential.

## Proposed dual-endpoint design

| Endpoint | Authentication transport | Responsibility |
| --- | --- | --- |
| `/mcp` | Existing `?key=` shared-key gate | Preserve current non-Gemini clients and behavior. |
| `/googlemcp` | OAuth 2.1 bearer access token | Gemini-specific custom-app connection and per-user authorization. |

Both routes should invoke one shared MCP server/tool registration and the existing bounded read-model/business logic. Only request authentication, subject construction, and deployment configuration should differ.

For `/googlemcp`:

1. Expose it as a Streamable HTTP MCP endpoint. MCP permits a distinct endpoint path, and a path-qualified resource URI is a valid canonical MCP resource identifier ([MCP Transports: Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http), [MCP Authorization: canonical server URI](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#canonical-server-uri)).
2. On an unauthenticated request, return the OAuth challenge and expose protected-resource metadata for this resource (for example, `/.well-known/oauth-protected-resource/googlemcp`), identifying its authorization server. The MCP specification defines both the `WWW-Authenticate` discovery path and the path-qualified well-known metadata location ([MCP Authorization: protected-resource metadata discovery](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#protected-resource-metadata-discovery-requirements)).
3. Configure that authorization server for OAuth metadata discovery. Advertise a `registration_endpoint` if using DCR; otherwise create a pre-registered client and enter the credential values that Gemini's Advanced features actually requests. Validate bearer tokens for the `/googlemcp` resource and derive the LifeOS subject/scopes before invoking the shared tool layer ([MCP Authorization: authorization flow](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#authorization-flow-steps)). Google does not document the required Gemini redirect URI or credential fields, so do not assume a particular client registration will work without an eligible-account connection.
4. Keep `/mcp` and `/googlemcp` resource URLs, metadata, credentials, token audiences, and origin/host policies separate. The old shared key must neither authenticate `/googlemcp` nor be exposed to Gemini.

## What `/googlemcp` solves—and does not solve

It can provide the MCP-standard OAuth discovery, DCR-or-manual-credential path, bearer-token validation, and endpoint-specific resource identity without migrating existing shared-key clients. For an already eligible user, it addresses the authorization-transport gap that the current `?key=` route does not implement. It is not, by itself, evidence that Gemini will interoperate with a particular OAuth provider; Google's public custom-app guidance leaves those client-specific details unspecified.

It cannot grant Google-account eligibility, enable the feature for a work or school account, change the US/age/Keep Activity/English/web-app requirements, or eliminate the user's authorization/consent step. It also cannot make an arbitrary shared query key a supported OAuth credential. Those are separate account-policy and authorization-server concerns, respectively ([Google Gemini Apps Help](https://support.google.com/gemini/answer/17209137?hl=en&co=GENIE.Platform%3DDesktop), [MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)).
