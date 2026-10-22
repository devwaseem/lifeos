declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database
        CF_ACCESS_TEAM_DOMAIN: string
        CF_ACCESS_AUD: string
        MCP_SHARED_KEY?: string
        MCP_RESOURCE_URL?: string
        MCP_ALLOWED_HOSTS?: string
        MCP_ALLOWED_ORIGINS?: string
        AI?: Ai
        AI_DEFAULT_PROVIDER?: 'workers-ai' | 'gemini' | 'anthropic'
        CLOUDFLARE_AI_MODEL?: string
        GEMINI_API_KEY?: string
        GEMINI_MODEL?: string
        GEMINI_BASE_URL?: string
        ANTHROPIC_API_KEY?: string
        ANTHROPIC_MODEL?: string
        ANTHROPIC_BASE_URL?: string
      }
      context: ExecutionContext
      caches: CacheStorage
    }
  }
}

export {}
