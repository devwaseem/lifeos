import type { RequestHandler } from './$types'
import { handleWorkoutSyncRequest } from '$lib/server/workout-sync'

const handle: RequestHandler = ({ request, platform }) => handleWorkoutSyncRequest(request, platform?.env)

export const POST = handle
