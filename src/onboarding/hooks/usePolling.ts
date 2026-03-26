import {useEffect, useRef, useState} from "react"

/**
 * Polls a fetcher function on an interval using the project's
 * setTimeout-with-cancellation pattern.
 */
export function usePolling<T>(
    fetcher: () => Promise<T>,
    options: { intervalMs?: number; enabled?: boolean } = {},
) {
    const {intervalMs = 3000, enabled = true} = options
    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<string | null>(null)
    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    useEffect(() => {
        if (!enabled) return

        let cancelled = false
        let timerId: number | undefined

        const tick = async () => {
            try {
                const result = await fetcherRef.current()
                if (!cancelled) {
                    setData(result)
                    setError(null)
                }
            } catch (e) {
                if (!cancelled) setError(String(e))
            } finally {
                if (!cancelled) timerId = window.setTimeout(tick, intervalMs)
            }
        }

        void tick()

        return () => {
            cancelled = true
            if (timerId) window.clearTimeout(timerId)
        }
    }, [intervalMs, enabled])

    return {data, error}
}
