import { describe, expect, it } from 'vitest'
import { authenticateMcpRequest, type McpAuthEnvironment } from './auth'

const environment: McpAuthEnvironment = {
  MCP_SHARED_KEY: 'lifeos-shared-test-key',
  MCP_RESOURCE_URL: 'https://life.w9m.app/mcp',
  MCP_ALLOWED_HOSTS: 'life.w9m.app',
}

describe('MCP shared-key authentication', () => {
  it('authenticates the exact query key without propagating the secret', async () => {
    const request = new Request('https://life.w9m.app/mcp?key=lifeos-shared-test-key')

    const result = await authenticateMcpRequest(request, environment)

    expect(result).not.toBeInstanceOf(Response)
    if (!(result instanceof Response)) {
      expect(result.token).toBe('shared-key-authenticated')
      expect(result.token).not.toBe(environment.MCP_SHARED_KEY)
      expect(result.clientId).toBe('lifeos-owner')
      expect(result.extra).toEqual({ subject: 'lifeos-owner' })
    }
  })

  it.each([
    'https://life.w9m.app/mcp',
    'https://life.w9m.app/mcp?key=wrong',
    'https://life.w9m.app/mcp?key=lifeos-shared-test-key&key=lifeos-shared-test-key',
  ])('rejects an absent, incorrect, or ambiguous key: %s', async (url) => {
    const result = await authenticateMcpRequest(new Request(url), environment)

    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(401)
      expect(result.headers.get('Cache-Control')).toBe('no-store')
    }
  })

  it('fails closed when the shared key is not configured', async () => {
    const result = await authenticateMcpRequest(
      new Request('https://life.w9m.app/mcp?key=anything'),
      { MCP_RESOURCE_URL: environment.MCP_RESOURCE_URL },
    )

    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) expect(result.status).toBe(503)
  })
})
