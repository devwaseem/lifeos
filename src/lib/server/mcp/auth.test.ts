import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateMcpRequest, type McpAuthEnvironment } from './auth'

const { jwtVerify } = vi.hoisted(() => ({ jwtVerify: vi.fn() }))

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => Symbol('access-key-set')),
  jwtVerify,
}))

const environment: McpAuthEnvironment = {
  MCP_RESOURCE_URL: 'https://life.w9m.app/mcp',
  MCP_ALLOWED_HOSTS: 'life.w9m.app',
  MCP_ALLOWED_SUBJECT: 'owner-subject',
  CF_ACCESS_TEAM_DOMAIN: 'w9m',
  CF_ACCESS_AUD: 'lifeos-audience',
}

describe('MCP authentication', () => {
  beforeEach(() => {
    jwtVerify.mockReset()
  })

  it('authenticates a managed OAuth request using the Access assertion instead of the opaque bearer token', async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: 'owner-subject',
        exp: 2_000_000_000,
      },
    })
    const request = new Request('https://life.w9m.app/mcp', {
      headers: {
        Authorization: 'Bearer oauth:opaque-access-token',
        'Cf-Access-Jwt-Assertion': 'signed-access-assertion',
      },
    })

    const result = await authenticateMcpRequest(request, environment)

    expect(result).not.toBeInstanceOf(Response)
    expect(jwtVerify).toHaveBeenCalledWith(
      'signed-access-assertion',
      expect.anything(),
      {
        issuer: 'https://w9m.cloudflareaccess.com',
        audience: 'lifeos-audience',
      },
    )
    if (!(result instanceof Response)) {
      expect(result.token).toBe('oauth:opaque-access-token')
      expect(result.extra).toEqual({ subject: 'owner-subject' })
    }
  })
})
