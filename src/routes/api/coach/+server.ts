import type { RequestHandler } from './$types'
import { handleAiCoachRequest } from '$lib/server/ai-coach'

const handle: RequestHandler = ({ request, platform }) => handleAiCoachRequest(request, platform?.env)

export const GET = handle
export const POST = handle
