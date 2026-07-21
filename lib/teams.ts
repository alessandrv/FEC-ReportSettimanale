/**
 * Shared Teams JS SDK initialization.
 * The promise is created once and reused across all callers so
 * app.initialize() is only ever called once per page load.
 */
let initPromise: Promise<boolean> | null = null

export function getTeamsInitPromise(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { app } = await import('@microsoft/teams-js')
        await Promise.race([
          app.initialize(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Not in Teams')), 5000)
          ),
        ])
        return true
      } catch {
        return false
      }
    })()
  }
  return initPromise
}
