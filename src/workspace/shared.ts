import {useEffect, useState} from "react"
import {ApiError, httpGet} from "../api/http.ts"
import type {Device} from "./types.ts"
export const nameOf = (d: Device) => d.attributes.friendly_name || d.entity_id
export const displayZone = (id: string, name: string) => id === "unassigned" ? "Unassigned" : name
export const messageOf = (text: string) => ({"Simulation mode cannot deploy real automations": "The preview does not activate real automations.",
    "Home Assistant and household timezones must match before deployment": "Match the Home Assistant and household time zones before activating this rule.",
    "Selected devices are unavailable; reconnect and retry": "A selected device is unavailable. Check the connection and try again.",
    "Connection revoked. Local rules may still run; check Home Assistant or reconnect with new credentials.": "Access revoked. Local rules may still run. Check Home Assistant or reconnect the agent with new credentials."} as Record<string, string>)[text] || text

export function errorText(error: unknown): string {
    if (error instanceof ApiError) {
        const detail = error.detail
        if (error.status === 401) return "Please sign in again. The email or password was not accepted."
        if (error.status === 403) return "You do not have permission for this action. Check the registration key if required."
        if (error.status === 429) return "Too many requests. Please try again later."
        if (Array.isArray(detail)) return detail.map(d => d.msg).join(" · ")
        if (typeof detail === "string") {
            if (detail.startsWith("Pause the")) return "Pause the affected rule and wait for confirmation before controlling its devices or changing its settings."
            return messageOf(detail)
        }
    }
    return error instanceof Error ? error.message : "The request could not be completed."
}

export function useLoad<T>(path: string | null, revision = 0) {
    const [result, setResult] = useState<{path: string; data?: T; error?: string}>()
    useEffect(() => {
        if (!path) return
        let alive = true
        const load = () => httpGet<T>(path).then(data => {
            if (alive) setResult({path, data})
        }).catch(e => {
            if (alive) setResult(previous => ({path, error: errorText(e),
                // Keep forms mounted during a transient polling failure. Never
                // retain data after permission, authentication or not-found errors.
                data: (!(e instanceof ApiError) || e.status >= 500) && previous?.path === path ? previous.data : undefined}))
        })
        void load()
        const timer = window.setInterval(() => {if (!document.hidden) void load()}, 15000)
        return () => {alive = false; window.clearInterval(timer)}
    }, [path, revision])
    return result?.path === path ? result : undefined
}
