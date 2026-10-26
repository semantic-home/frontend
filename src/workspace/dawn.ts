import type {DawnPhase, DawnRamp} from "./types.ts"

export const phases: {key: DawnPhase; name: string; angle: string}[] = [
    {key: "astronomical", name: "Astronomical", angle: "−18°"}, {key: "nautical", name: "Nautical", angle: "−12°"},
    {key: "civil", name: "Civil", angle: "−6°"}, {key: "daylight", name: "Daylight", angle: "0°"},
]
export const rampPhases = (ramp: DawnRamp) => ramp.direction === "dusk" ? [...phases].reverse() : phases
export const defaultRamp = (direction: "dawn" | "dusk" = "dawn"): DawnRamp => ({direction, start_at: direction === "dusk" ? "16:00" : "06:00", stop_at: direction === "dusk" ? "23:00" : "12:00", off_at_end: direction === "dusk", startup_minutes: 10,
    initial_brightness_pct: direction === "dusk" ? 100 : 1, color_mode: "white", astronomical: {brightness_pct: 1, kelvin: 2702}, nautical: {brightness_pct: 10, kelvin: 3000},
    civil: {brightness_pct: 45, kelvin: 4000}, daylight: {brightness_pct: 100, kelvin: 5500}})
export function rampValid(ramp: DawnRamp | null | undefined) {
    if (!ramp || !ramp.start_at || !ramp.stop_at || ramp.start_at >= ramp.stop_at || !Number.isInteger(ramp.startup_minutes) || ramp.startup_minutes < 1 || ramp.startup_minutes > 120) return false
    const values = [ramp.initial_brightness_pct, ...rampPhases(ramp).map(p => ramp[p.key].brightness_pct)]
    return values.every((v, i) => Number.isInteger(v) && v >= 1 && v <= 100 && (!i || (ramp.direction === "dusk" ? v <= values[i - 1] : v >= values[i - 1]))) &&
        phases.every(p => Number.isInteger(ramp[p.key].kelvin) && ramp[p.key].kelvin >= 1000 && ramp[p.key].kelvin <= 10000)
}

