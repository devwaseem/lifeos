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
      }
      context: ExecutionContext
      caches: CacheStorage
    }
  }
}

export {}
