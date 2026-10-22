import type { RequestHandler } from './$types'
import { handleAiInsightsRequest } from '$lib/server/ai-coach'

export const POST: RequestHandler = ({ request, platform }) => handleAiInsightsRequest(request, platform?.env)
