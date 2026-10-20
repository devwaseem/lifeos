import { McpServer, createMcpHandler, type AuthInfo } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { buildExerciseProgress, buildRoutineReview, buildTrainingOverview, buildTrainingState } from '../training-analysis'
import { loadTrainingDataset } from '../training-read-model'
import { authenticateMcpRequest, protectedResourceMetadata, validateMcpRequestOrigin, type McpAuthEnvironment } from './auth'

export interface McpEnvironment extends McpAuthEnvironment {
  DB: D1Database
}

const methodology = `# LifeOS training analysis boundaries

LifeOS distinguishes observed values, validated constructs, derived estimates, and pragmatic heuristics. Training logs can describe completed work, perceived effort, and logged performance changes. They cannot diagnose fatigue, recovery, overtraining, injury, or illness. Modeled readiness is deterministic decay of logged exposure, not a physiological measurement. Subjective check-ins provide context and never produce training clearance.`

const metricGlossary = `# LifeOS metric glossary

- Session load: session RPE multiplied by elapsed session minutes, in arbitrary units.
- Muscle dose: contribution-weighted completed working sets at RPE 7 or above.
- Estimated 1RM: exercise-specific Epley estimate adjusted by logged RPE/RIR.
- Performance suppression: newest three comparable exposures versus the preceding three under explicit heuristic thresholds.
- Modeled readiness: fixed-window linear decay of logged contribution-weighted exposure.
- Confidence: logged sample count and required-field coverage, not certainty about recovery or adaptation.`


function toolResult(value: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
  }
}

function timestamp(value: string | undefined) {
  if (!value) return Date.now()
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Invalid asOf timestamp')
  return parsed
}

export function createLifeOsMcpServer(database: D1Database) {
  const server = new McpServer({ name: 'lifeos-training', version: '0.1.0' }, { maxToolInputElements: 100 })

  server.registerResource('training-methodology', 'lifeos://methodology/training-science', {
    title: 'LifeOS training analysis boundaries',
    description: 'Evidence categories and non-medical claims boundary for LifeOS metrics.',
    mimeType: 'text/markdown',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: methodology }] }))

  server.registerResource('metric-glossary', 'lifeos://methodology/metric-glossary', {
    title: 'LifeOS metric glossary',
    description: 'Definitions for the calculations returned by LifeOS analytics tools.',
    mimeType: 'text/markdown',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: metricGlossary }] }))

  server.registerTool('get_training_overview', {
    title: 'Get training overview',
    description: 'Return evidence-labelled recent training load, muscle dose, performance signal, profile, check-in, and synchronization freshness.',
    inputSchema: z.object({ asOf: z.iso.datetime().optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ asOf }) => toolResult(buildTrainingOverview(await loadTrainingDataset(database), timestamp(asOf))))

  server.registerTool('get_exercise_progress', {
    title: 'Get exercise progress',
    description: 'Return bounded same-exercise exposure history and exercise-specific estimated strength context.',
    inputSchema: z.object({
      exerciseId: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(24).default(12),
      asOf: z.iso.datetime().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ exerciseId, limit, asOf }) => toolResult(buildExerciseProgress(await loadTrainingDataset(database), exerciseId, limit, timestamp(asOf))))

  server.registerTool('review_routine', {
    title: 'Review routine',
    description: 'Review one routine against explicit profile constraints, logged training, muscle distribution, and modeled readiness without claiming medical or technique correctness.',
    inputSchema: z.object({ routineId: z.string().min(1).max(200), asOf: z.iso.datetime().optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ routineId, asOf }) => toolResult(buildRoutineReview(await loadTrainingDataset(database), routineId, timestamp(asOf))))

  server.registerTool('get_training_state', {
    title: 'Get training state',
    description: 'Combine the latest subjective check-in, modeled readiness, consecutive training days, and repeated performance suppression. This is not a medical fatigue assessment.',
    inputSchema: z.object({ routineId: z.string().min(1).max(200).nullable().default(null), asOf: z.iso.datetime().optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ routineId, asOf }) => toolResult(buildTrainingState(await loadTrainingDataset(database), routineId, timestamp(asOf))))


  return server
}

export async function handleAuthorizedMcpRequest(
  request: Request,
  environment: McpEnvironment,
  authentication: AuthInfo,
) {
  const originFailure = validateMcpRequestOrigin(request, environment)
  if (originFailure) return originFailure

  const handler = createMcpHandler(() => createLifeOsMcpServer(environment.DB), {
    legacy: 'stateless',
    responseMode: 'json',
    maxRequestBodySize: 64 * 1024,
  })
  return handler.fetch(request, { authInfo: authentication })
}

export async function handleMcpRequest(request: Request, environment: McpEnvironment) {
  const resourcePath = new URL(environment.MCP_RESOURCE_URL ?? new URL('/mcp', request.url).toString()).pathname
  if (request.method === 'GET' && new URL(request.url).pathname === `/.well-known/oauth-protected-resource${resourcePath}`) {
    return protectedResourceMetadata(request, environment)
  }
  const authentication = await authenticateMcpRequest(request, environment)
  if (authentication instanceof Response) return authentication
  return handleAuthorizedMcpRequest(request, environment, authentication as AuthInfo)
}
