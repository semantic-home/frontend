import type {Spec} from "./types.ts"

export type ScheduleEdge = "start" | "end"
export const usesSun = (spec: Spec) => (spec.start_event || "time") !== "time" || (spec.end_event || "time") !== "time"
export function timingText(spec: Spec, edge: ScheduleEdge) {
    const event = spec[`${edge}_event`] || "time", offset = spec[`${edge}_offset_minutes`] || 0
    if (event === "time") return spec[edge] || "Choose a time"
    const name = event === "sunrise" ? "sunrise" : "sunset"
    return offset ? `${Math.abs(offset)} min ${offset < 0 ? "before" : "after"} ${name}` : name
}

export function rampText(spec: Spec) {
    const ramp = spec.ramp
    return ramp ? `Dim start at ${ramp.start_at} · Follow natural dawn · ${ramp.off_at_end ? "Off" : "Stop adjusting"} at ${ramp.stop_at}` : "Natural dawn ramp"
}

export function humidityText(spec: Spec) {
    const thresholds = `On at ${spec.upper}%, off at ${spec.lower}%`
    return spec.start && spec.end ? `${thresholds} · ${spec.start}–${spec.end}${spec.start > spec.end ? " next day" : ""} · Forced off outside these hours` : `${thresholds} · All day on selected days`
}
