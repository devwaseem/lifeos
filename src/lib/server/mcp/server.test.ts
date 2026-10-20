import { describe, expect, it } from 'vitest'
import { handleMcpRequest, type McpEnvironment } from './server'

const environment: McpEnvironment = {
  DB: {} as D1Database,
  MCP_LOCAL_TOKEN: 'lifeos-mcp-test',
  MCP_RESOURCE_URL: 'http://localhost:8787/mcp',
  MCP_ALLOWED_HOSTS: 'localhost',
  MCP_ALLOWED_ORIGINS: 'http://localhost:5173',
}

function request(headers: Record<string, string> = {}, body: object = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'lifeos-test', version: '1.0.0' },
  },
}) {
  return new Request('http://localhost:8787/mcp', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      Host: 'localhost:8787',
      Origin: 'http://localhost:5173',
      'MCP-Protocol-Version': '2025-06-18',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

async function responseBody(response: Response) {
  const text = await response.text()
  const payload = text.startsWith('event:') ? text.split('\ndata: ')[1]?.trim() : text
  return JSON.parse(payload ?? '{}') as Record<string, unknown>
}

describe('LifeOS MCP HTTP interface', () => {
  it('requires a bearer token on every MCP request', async () => {
    const response = await handleMcpRequest(request(), environment)

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer')
  })

  it('rejects an unapproved origin before invoking MCP', async () => {
    const response = await handleMcpRequest(request({
      Authorization: 'Bearer lifeos-mcp-test',
      Origin: 'https://untrusted.example',
    }), environment)

    expect(response.status).toBe(403)
  })

  it('serves a stateless MCP initialization request for an authorized owner', async () => {
    const response = await handleMcpRequest(request({ Authorization: 'Bearer lifeos-mcp-test' }), environment)
    const body = await responseBody(response) as { result?: { serverInfo?: { name?: string } } }

    expect(response.status).toBe(200)
    expect(body.result?.serverInfo?.name).toBe('lifeos-training')
  })

  it('advertises only bounded read-only analytics tools', async () => {
    const response = await handleMcpRequest(request(
      { Authorization: 'Bearer lifeos-mcp-test' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    ), environment)
    const body = await responseBody(response) as { result?: { tools?: Array<{ name: string }> } }

    expect(response.status).toBe(200)
    expect(body.result?.tools?.map((tool) => tool.name)).toEqual([
      'get_training_overview',
      'get_exercise_progress',
      'review_routine',
      'get_training_state',
    ])
  })
})
