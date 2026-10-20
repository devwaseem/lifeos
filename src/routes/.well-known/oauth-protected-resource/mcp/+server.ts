import type { RequestHandler } from './$types'
import { handleMcpRequest } from '$lib/server/mcp/server'

export const GET: RequestHandler = ({ request, platform }) => {
  if (!platform?.env) return Response.json({ error: 'Cloudflare bindings unavailable' }, { status: 503 })
  return handleMcpRequest(request, platform.env)
}
