import { Hono, type Context } from 'hono'
import { handleWorkoutSyncRequest, type WorkoutSyncEnvironment } from '../lib/server/workout-sync'
import { handleMcpOAuthRequest, type McpOAuthEnvironment } from '../lib/server/mcp/oauth'
type WorkerEnvironment = {
  Bindings: WorkoutSyncEnvironment & McpOAuthEnvironment
}

const app = new Hono<WorkerEnvironment>()

app.get('/api/health', async (context) => {
  await context.env.DB.prepare('SELECT 1 AS healthy').first()
  return context.json({ status: 'ok', storage: 'd1-local' })
})

app.post('/api/sync', (context) => handleWorkoutSyncRequest(context.req.raw, context.env))
const handleOAuth = (context: Context<WorkerEnvironment>) =>
  handleMcpOAuthRequest(context.req.raw, context.env, context.executionCtx as unknown as ExecutionContext)

app.all('/mcp', handleOAuth)
app.all('/authorize', handleOAuth)
app.all('/token', handleOAuth)
app.all('/oauth/register', handleOAuth)
app.all('/.well-known/oauth-authorization-server', handleOAuth)
app.all('/.well-known/oauth-protected-resource/mcp', handleOAuth)

app.notFound((context) => context.json({ error: 'Not found' }, 404))
app.onError((error, context) => {
  console.error('Local worker request failed', error)
  return context.json({ error: 'Local worker request failed' }, 500)
})

export default app
