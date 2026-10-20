import { Hono } from 'hono'
import { handleWorkoutSyncRequest, type WorkoutSyncEnvironment } from '../lib/server/workout-sync'
import { handleMcpRequest, type McpEnvironment } from '../lib/server/mcp/server'
type WorkerEnvironment = {
  Bindings: WorkoutSyncEnvironment & McpEnvironment
}

const app = new Hono<WorkerEnvironment>()

app.get('/api/health', async (context) => {
  await context.env.DB.prepare('SELECT 1 AS healthy').first()
  return context.json({ status: 'ok', storage: 'd1-local' })
})

app.post('/api/sync', (context) => handleWorkoutSyncRequest(context.req.raw, context.env))
app.post('/mcp', (context) => handleMcpRequest(context.req.raw, context.env))
app.get('/.well-known/oauth-protected-resource/mcp', (context) => handleMcpRequest(context.req.raw, context.env))

app.notFound((context) => context.json({ error: 'Not found' }, 404))
app.onError((error, context) => {
  console.error('Local worker request failed', error)
  return context.json({ error: 'Local worker request failed' }, 500)
})

export default app
