import {useEffect, useState} from "react"
import {Clock3, Sunrise, Sunset} from "lucide-react"
import {httpPost} from "../api/http.ts"
import {errorText} from "./shared.ts"
import type {Preview, SolarPreview, Spec} from "./types.ts"
import type {ScheduleEdge} from "./schedule.ts"
import s from "./Workspace.module.css"

export function TimingPoint({edge, spec, update}: {edge: ScheduleEdge; spec: Spec; update: (patch: Partial<Spec>) => void}) {
    const event = spec[`${edge}_event`] || "time", label = edge === "start" ? "Switch on" : "Switch off"
    const Icon = event === "sunrise" ? Sunrise : event === "sunset" ? Sunset : Clock3
    return <fieldset className={s.timingPoint}><legend><Icon size={18} aria-hidden="true"/> {label}</legend>
        <label className={s.field}>{label} trigger<select value={event} onChange={e => update({
            [`${edge}_event`]: e.target.value,
            [edge]: e.target.value === "time" ? edge === "start" ? "08:00" : "22:00" : null,
            [`${edge}_offset_minutes`]: 0,
        } as Partial<Spec>)}><option value="time">Fixed time</option><option value="sunrise">Sunrise</option><option value="sunset">Sunset</option></select></label>
        {event === "time" ? <label className={s.field}>{label} time<input type="time" required value={spec[edge] || ""} onChange={e => update({[edge]: e.target.value})}/></label>
            : <label className={s.field}>{label} offset (minutes)<input type="number" min={-180} max={180} step={1} required value={spec[`${edge}_offset_minutes`] || 0}
                onChange={e => update({[`${edge}_offset_minutes`]: Number(e.target.value)})}/><span className={s.muted}>Negative = before · positive = after · 0 = at {event}</span></label>}
    </fieldset>
}

export function LocalTimePreview({spec, valid, homeId}: {spec: Spec; valid: boolean; homeId: string}) {
    const payload = JSON.stringify(spec), key = homeId + payload
    const [result, setResult] = useState<{key: string; data?: SolarPreview; error?: string}>()
    useEffect(() => {
        if (!valid) return
        let alive = true
        const load = async () => {
            try {
                const preview = await httpPost<Preview>("/automations/preview", JSON.parse(payload))
                if (alive) setResult({key, data: preview.schedule || undefined})
            } catch (error) {if (alive) setResult({key, error: errorText(error)})}
        }
        const debounce = window.setTimeout(() => void load(), 400)
        const timer = window.setInterval(() => {if (!document.hidden) void load()}, 60000)
        return () => {alive = false; window.clearTimeout(debounce); window.clearInterval(timer)}
    }, [payload, key, valid])
    const current = result?.key === key ? result : undefined, data = current?.data
    const clock = (value: string) => new Date(value).toLocaleTimeString("en-GB", {timeZone: data?.timezone, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})
    const date = (value: string) => new Date(value).toLocaleDateString("en-GB", {timeZone: data?.timezone, weekday: "short", day: "numeric", month: "short"})
    return <section className={s.solarPreview} aria-label="Local time preview" aria-live="polite">
        <div className={s.row}><Clock3 size={18} aria-hidden="true"/><strong>Local time preview</strong></div>
        {!valid ? <p className={s.muted}>Choose distinct triggers and at least one active day to preview local times.</p>
            : current?.error ? <p className={s.error} role="alert">{current.error}</p>
            : !data ? <p className={s.muted}>Calculating local times …</p> : <>
                <p className={s.muted}>Home Assistant location: <strong>{data.location_name || "Not reported"}</strong> · {data.connection_name}<br/>{data.timezone} · {date(data.now)} · {clock(data.now)}</p>
                {data.available && <><div className={s.sunTimes}>
                    <div><Sunrise size={20} aria-hidden="true"/><span>Sunrise today<strong>{data.sunrise ? clock(data.sunrise) : "No sunrise today"}</strong></span></div>
                    <div><Sunset size={20} aria-hidden="true"/><span>Sunset today<strong>{data.sunset ? clock(data.sunset) : "No sunset today"}</strong></span></div>
                </div><p className={s.muted}>Upcoming actions · offsets included</p>
                    <ol className={s.solarEvents}>{data.events.slice(0, 6).map((event, i) => <li key={`${event.at}-${event.action}-${i}`}>
                        <span className={s.badge}>{event.action === "on" ? "On" : "Off"}</span><span><strong>{date(event.at)} · {clock(event.at)}</strong>
                        <small className={s.muted}>{event.event === "time" ? "Fixed time" : event.offset_minutes ? `${Math.abs(event.offset_minutes)} min ${event.offset_minutes < 0 ? "before" : "after"} ${event.event}` : event.event === "sunrise" ? "Sunrise" : "Sunset"}</small></span>
                    </li>)}</ol>{!data.events.length && <p>No upcoming actions could be calculated.</p>}</>}
                {data.warnings.map(warning => <p className={s.notice} key={warning}>{warning}</p>)}
            </>}
        <p className={s.muted}>Uses the home location configured in Home Assistant. Solar times adjust daily and follow its local time zone. Previewing sends no device commands.</p>
    </section>
}
