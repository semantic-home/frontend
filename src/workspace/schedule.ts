import type {Spec} from "./types.ts"

export type ScheduleEdge = "start" | "end"
export const usesSun = (spec: Spec) => (spec.start_event || "time") !== "time" || (spec.end_event || "time") !== "time"
export function timingText(spec: Spec, edge: ScheduleEdge) {
    const event = spec[`${edge}_event`] || "time", offset = spec[`${edge}_offset_minutes`] || 0
    if (event === "time") return spec[edge] || "Choose a time"
    const name = event === "sunrise" ? "sunrise" : "sunset"
    return offset ? `${Math.abs(offset)} min ${offset < 0 ? "before" : "after"} ${name}` : name
}
