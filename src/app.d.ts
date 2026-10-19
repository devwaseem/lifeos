declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database
        CF_ACCESS_TEAM_DOMAIN: string
        CF_ACCESS_AUD: string
      }
      context: ExecutionContext
      caches: CacheStorage
    }
  }
}

export {}
