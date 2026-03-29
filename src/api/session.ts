const SESSION_STORAGE_KEY = "semantic-home.tab-session-id"
const SESSION_HEADER = "X-Semantic-Home-Session"

function createSessionId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getOrCreateTabSessionId(): string | null {
    if (typeof window === "undefined") {
        return null
    }

    try {
        const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
        if (existing) {
            return existing
        }

        const created = createSessionId()
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, created)
        return created
    } catch {
        return null
    }
}

export function buildSessionHeader(): HeadersInit {
    const sessionId = getOrCreateTabSessionId()
    if (!sessionId) {
        return {}
    }
    return {[SESSION_HEADER]: sessionId}
}
