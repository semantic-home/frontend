import {useEffect, useState} from "react"
import type {FormEvent} from "react"
import {httpDelete, httpGet, httpPost, httpPut} from "../api/http.ts"
import type {Activity, Automation, Connection, Device, DevicePage, Home, Preview, Spec, SemanticController} from "./types.ts"
import {displayZone, errorText, messageOf, nameOf, useLoad} from "./shared.ts"
import {Pager} from "./Pager.tsx"
import {LocalTimePreview, TimingPoint} from "./SolarSchedule.tsx"
import {HumiditySchedule} from "./HumiditySchedule.tsx"
import {LightingRampEditor} from "./LightingRamp.tsx"
import {defaultRamp, rampValid} from "./dawn.ts"
import {humidityText, rampText, timingText, usesSun} from "./schedule.ts"
import s from "./Workspace.module.css"
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const status: Record<string, string> = {draft: "Draft", pending: "Awaiting confirmation", active: "Active", paused: "Paused", error: "Deployment failed"}
const reasons: Record<string, string> = {upper_threshold: "Upper threshold reached", lower_threshold: "Lower threshold reached", keep_state: "Keep the current state between thresholds", sensor_unavailable: "Measurement missing or stale", outside_window: "Outside selected days or hours · forced off", time_window: "Time window evaluated", solar_schedule: "Runs at the scheduled sun or clock event", lighting_ramp: "Follows the natural twilight light levels", ramp_finished: "Lighting ramp finished"}
export function DevicePicker({capability, selected, change, multiple = true, agentId, title, zoneId}: {capability: string; selected: string[]; change: (ids: string[]) => void; multiple?: boolean; agentId?: string; title?: string; zoneId?: string}) {
    const [expanded, setExpanded] = useState(selected.length === 0)
    const [query, setQuery] = useState("")
    const [offset, setOffset] = useState(0)
    const result = useLoad<DevicePage>(expanded ? `/devices?${new URLSearchParams({q: query, capability, offset: String(offset), ...(agentId ? {agent_id: agentId} : {})})}` : null)
    const [names, setNames] = useState<Record<string, string>>({})
    useEffect(() => {
        let alive = true
        void Promise.all(selected.map(id => httpGet<Device>(`/devices/${id}`).then(d => [id, nameOf(d)]).catch(() => [id, "Device no longer exists"])))
            .then(entries => {if (alive) setNames(Object.fromEntries(entries))})
        return () => {alive = false}
    }, [selected])
    return <div><div className={s.row} style={{justifyContent: "space-between"}}><strong>{title || (capability === "humidity" ? "Humidity measurements" : "Target devices")}</strong><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Close selection" : "Change selection"}</button></div>
        <div className={s.chips}>{selected.map(id => <button type="button" key={id} onClick={() => change(selected.filter(x => x !== id))} aria-label={`${names[id] || "Device"} remove from selection`}>{names[id] || "Loading …"} ×</button>)}</div>
        {!expanded && !selected.length && <button type="button" onClick={() => setExpanded(true)}>Select device</button>}
        {expanded && <><label className={s.field}>{capability === "humidity" ? "Select humidity sensors" : "Select target devices"}
        <input type="search" value={query} placeholder="Search devices …" onChange={e => {setQuery(e.target.value); setOffset(0)}}/></label>
        {result?.error && <p role="alert">{result.error}</p>}
        <div className={s.list}>{result?.data?.items.filter(d => capability !== "cleaning" || d.capabilities.actions?.includes("start")).map(d => <label className={s.choice} key={d.id}>
            <input type="checkbox" checked={selected.includes(d.id)} onChange={() => {change(selected.includes(d.id) ? selected.filter(x => x !== d.id) : multiple ? [...selected, d.id] : [d.id]); if (!multiple) setExpanded(false)}}/>
            <span>{nameOf(d)}{zoneId && d.attributes.area_id === zoneId && <small>Matches this zone · Suggested</small>}<small className={s.muted}>{d.attributes.area_name || "No room"} · {d.state}{!d.available ? " · offline" : ""}{d.connection_name ? ` · ${d.connection_name}` : ""}</small></span>
        </label>)}</div>
        {result?.data && <>{result.data.total > 50 && <Pager offset={offset} total={result.data.total} change={setOffset}/>}<span className={s.muted}>{result.data.total ? `${result.data.total} matching device entities` : "No matching devices found. Check the Home Assistant connection."}</span></>}
        {multiple && <div className={s.row}><button type="button" disabled={!selected.length} onClick={() => setExpanded(false)}>Use selection</button></div>}</>}
    </div>
}

const initialSpec: Spec = {name: "", kind: "humidity_band", targets: [], sensor_id: null, sensor_ids: [], lower: 52, upper: 55, weekdays: [0,1,2,3,4,5,6],
    start: null, end: null, start_event: "time", end_event: "time", start_offset_minutes: 0, end_offset_minutes: 0,
    at: "10:00", min_cycle_seconds: 180, sensor_stale_seconds: 1800, brightness_pct: null, enabled: true}

function RuleEditor({home, controller, rule, done, cancel}: {home: Home; controller: SemanticController; rule: Automation | null; done: () => void; cancel: () => void}) {
    const [spec, setSpec] = useState<Spec>(rule ? {...rule.spec} : {...initialSpec, name: `${controller.display_name} · Rule`.slice(0, 100), kind: controller.domain === "humidity" ? "humidity_band" : controller.domain === "cleaning" ? "cleaning" : "time_window", ...controller.bindings, ...(controller.domain === "lighting" || controller.domain === "power" ? {start: "08:00", end: "22:00"} : {})})
    const [preview, setPreview] = useState<Preview | null>(null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const sensorCount = spec.sensor_ids?.length || (spec.sensor_id ? 1 : 0)
    const solar = usesSun(spec)
    function update(patch: Partial<Spec>) {setSpec(old => ({...old, ...patch})); setPreview(null); setError("")}
    const timingValid = spec.kind === "lighting_ramp" ? rampValid(spec.ramp) : solar ? (["start", "end"] as const).every(edge => (spec[`${edge}_event`] || "time") !== "time" || !!spec[edge]) &&
        timingText(spec, "start") !== timingText(spec, "end") && (["start", "end"] as const).every(edge => Number.isInteger(spec[`${edge}_offset_minutes`] || 0) && Math.abs(spec[`${edge}_offset_minutes`] || 0) <= 180)
        : (spec.kind !== "time_window" || !!(spec.start && spec.end)) && (!!spec.start === !!spec.end) && (!spec.start || spec.start !== spec.end)
    const valid = !!(spec.name.trim() && spec.targets.length && spec.weekdays.length && (spec.kind !== "humidity_band" || (sensorCount && spec.lower < spec.upper)) && timingValid)
    async function inspect() {
        setBusy(true); setError("")
        try {setPreview(await httpPost<Preview>("/automations/preview", spec))} catch (e) {setError(errorText(e))} finally {setBusy(false)}
    }
    async function save(e: FormEvent) {
        e.preventDefault(); setBusy(true); setError("")
        try {
            const body = {spec, controller_id: controller.controller_id, expected_version: rule?.version || null}
            if (rule) await httpPut(`/automations/${rule.id}`, body)
            else await httpPost("/automations", body)
            done()
        } catch (e) {setError(errorText(e))} finally {setBusy(false)}
    }
    return <section className={`${s.card} ${s.editor}`}><div className={s.row} style={{justifyContent: "space-between"}}><h2>{rule ? "Edit Rule" : "Add Rule"}</h2><button onClick={cancel}>Close</button></div>
        <p className={s.muted}>This rule uses the controller’s entities and roles. Define when and under which conditions it acts.</p>
        <form className={s.form} onSubmit={save}>
            <p className={s.muted}>{displayZone(controller.zone_id, controller.zone_name)} → {controller.display_name} → Rule</p>
            <label className={s.field}>Name<input required maxLength={100} value={spec.name} onChange={e => update({name: e.target.value})} placeholder="For example: Keep the cellar dry"/></label>
            {controller.domain === "lighting" && <label className={s.field}>Lighting rule<select value={spec.kind === "lighting_ramp" ? spec.ramp?.direction || "dawn" : spec.kind} onChange={e => update(e.target.value !== "time_window"
                ? {kind: "lighting_ramp", ramp: defaultRamp(e.target.value as "dawn" | "dusk"), start: null, end: null, start_event: "time", end_event: "time", start_offset_minutes: 0, end_offset_minutes: 0, brightness_pct: null}
                : {kind: "time_window", ramp: null, start: "08:00", end: "22:00"})}>
                <option value="time_window">On / off schedule</option><option value="dawn">Natural dawn ramp</option><option value="dusk">Natural dusk ramp</option></select></label>}
            <div className={s.sentence} aria-live="polite">{spec.kind === "humidity_band" ? <>Switch on when any selected sensor reaches <strong>{spec.upper} %</strong>. Switch off once all selected sensors are at or below <strong>{spec.lower} %</strong>. {spec.start && spec.end ? <>Apply these thresholds from <strong>{spec.start}</strong> to <strong>{spec.end}</strong>{spec.start > spec.end ? " the next day" : ""}. Outside those hours, <strong>force off regardless of humidity</strong>.</> : <>Apply thresholds all day on the selected days.</>}</> : spec.kind === "time_window" ? <>Switch the assigned devices on at <strong>{timingText(spec, "start")}</strong> on the selected days. Switch off at <strong>{timingText(spec, "end")}</strong>{solar ? " every day." : "."}</> : spec.kind === "lighting_ramp" ? <>{spec.ramp?.direction === "dusk" ? <>Start at <strong>{spec.ramp.initial_brightness_pct}%</strong> at <strong>{spec.ramp.start_at}</strong>, then gradually dim from daylight through real civil, nautical and astronomical dusk.</> : <>Start dim at <strong>{spec.ramp?.start_at}</strong>, then gradually follow the real astronomical, nautical and civil dawn into daylight.</>} {spec.ramp?.off_at_end ? "Switch off" : "Stop adjusting and leave the lights on"} at <strong>{spec.ramp?.stop_at}</strong>.</> : <>Start cleaning on the selected days at <strong>{spec.at}</strong>.</>}</div>
            <div className={s.notice}><strong>Entities from this controller</strong>{controller.entities.map(entity => <p key={entity.device_id}>{entity.name} · {entity.role === "humidity_sensor" ? "Measures room humidity" : controller.domain === "humidity" ? "Powers the dehumidifier" : controller.domain === "cleaning" ? "Performs cleaning" : controller.domain === "lighting" ? "Controls the lights" : "Switchable target"}</p>)}</div>
            {spec.kind === "humidity_band" && <>
                <div className={s.split}><label className={s.field}>Switch on at or above (%)<input required type="number" min={0} max={100} step="0.1" value={spec.upper} onChange={e => update({upper: Number(e.target.value)})}/></label>
                    <label className={s.field}>Switch off at or below (%)<input required type="number" min={0} max={100} step="0.1" value={spec.lower} onChange={e => update({lower: Number(e.target.value)})}/></label></div>
                <p className={s.muted}>Uses the highest reading from {sensorCount} selected sensor{sensorCount !== 1 ? "s" : ""}. Between {spec.lower}% and {spec.upper}% the current state is kept.</p>
                {spec.lower >= spec.upper && <p className={s.error} role="alert">The off threshold must be lower than the on threshold.</p>}
                <details><summary>Device protection and measurement age</summary><div className={s.split} style={{marginTop: 16}}><label className={s.field}>Minimum switching interval (seconds)<input required type="number" min={0} max={86400} value={spec.min_cycle_seconds} onChange={e => update({min_cycle_seconds: Number(e.target.value)})}/></label>
                    <label className={s.field}>Maximum measurement age (minutes)<input required type="number" min={1} max={1440} value={spec.sensor_stale_seconds / 60} onChange={e => update({sensor_stale_seconds: Number(e.target.value) * 60})}/></label></div>
                <p className={s.muted}>Choose the switching interval according to the device specifications. If any selected sensor is missing or stale, the outputs switch off. Scheduled force-off bypasses the minimum switching interval.</p></details>
                <HumiditySchedule spec={spec} update={update} timezone={home.timezone}/></>}
            <div className={s.field}><span>Active days</span><div className={s.days}>{days.map((day, index) => <button type="button" key={day} aria-pressed={spec.weekdays.includes(index)} className={spec.weekdays.includes(index) ? s.active : ""}
                onClick={() => update({weekdays: spec.weekdays.includes(index) ? spec.weekdays.filter(i => i !== index) : [...spec.weekdays, index].sort()})}>{day}</button>)}</div></div>
            {spec.kind === "lighting_ramp" ? <LightingRampEditor spec={spec} update={update} valid={valid} homeId={home.id}/> : spec.kind === "cleaning" ? <label className={s.field}>Start cleaning at<input type="time" required value={spec.at} onChange={e => update({at: e.target.value})}/></label> : <>
                {spec.kind === "time_window" ? <>
                    <div className={s.split}><TimingPoint edge="start" spec={spec} update={update}/><TimingPoint edge="end" spec={spec} update={update}/></div>
                    {!timingValid && <p className={s.error} role="alert">Choose distinct on and off triggers. Solar offsets must be whole minutes between −180 and 180.</p>}
                    {solar && <><LocalTimePreview spec={spec} valid={valid} homeId={home.id}/><p className={s.muted}>Selected days apply to the sunrise/sunset date before its offset, or the fixed switch-on date. The off trigger runs every day, including after an overnight schedule. Missed events while Home Assistant is stopped are not replayed.</p></>}
                </> : null}
                {spec.kind === "time_window" && spec.start && !solar && <p className={s.muted}>Switch off outside the time window. For overnight windows, the selected weekday is the starting day.</p>}
                {spec.kind === "time_window" && <label className={s.field}>Brightness, optional (1–100%)<input type="number" min={1} max={100} value={spec.brightness_pct ?? ""} placeholder="Keep current brightness" onChange={e => update({brightness_pct: e.target.value ? Number(e.target.value) : null})}/><span className={s.muted}>Only for targets that support dimming.</span></label>}
            </>}
            <p className={s.muted}>Time zone: {home.timezone}. Deployed rules continue running locally. {spec.kind === "lighting_ramp" ? "The Sun integration supplies the real solar position. The rule checks light levels once a minute; native fades depend on lamp support." : solar ? "Sunrise and sunset triggers follow Home Assistant’s configured home location." : spec.kind === "humidity_band" && spec.start ? "Scheduled force-off runs at the end time and is checked again every minute and when an output turns on." : "Time windows and stale measurements are checked at least once a minute."}</p>
            {error && <div className={s.error} role="alert">{error}</div>}
            {preview && <div className={s.notice} aria-live="polite"><strong>Preview without device commands</strong>{spec.kind === "humidity_band" && <p>Highest humidity across {preview.sensor_count ?? sensorCount} sensor{(preview.sensor_count ?? sensorCount) !== 1 ? "s" : ""}: {preview.humidity === null ? "a selected measurement is missing or stale" : `${preview.humidity} %`}</p>}
                {preview.items.map(item => <p key={item.id}>{item.name}: {item.desired === "scheduled" ? spec.kind === "lighting_ramp" ? `Scheduled · see ${spec.ramp?.direction || "dawn"} timeline above` : solar ? "Scheduled · see local times above" : `Scheduled at ${spec.at}` : item.desired === "on" ? "On" : "Off"} · {reasons[item.reason] || item.reason}</p>)}
                <small>{spec.kind === "humidity_band" && spec.start ? "Scheduled force-off bypasses the minimum switching interval. Device availability still applies." : "Availability and minimum switching intervals may delay execution."}</small></div>}
            <div className={s.row}><button type="button" disabled={!valid || busy} onClick={() => void inspect()}>Preview effect</button><button className={s.primary} disabled={!valid || busy}>Save Draft</button></div>
        </form></section>
}

export function Rules({home, controller, revision, changed, report}: {home: Home; controller: SemanticController; revision: number; changed: () => void; report: (s: string) => void}) {
    const result = useLoad<Automation[]>(`/automations?controller_id=${controller.controller_id}`, revision)
    const connections = useLoad<Connection[]>("/connections", revision)
    const [editing, setEditing] = useState<Automation | null | undefined>()
    const [busy, setBusy] = useState("")
    const writable = home.role !== "viewer"
    async function operate(rule: Automation, operation: string) {
        setBusy(rule.id)
        try {
            const updated = operation === "delete" ? await httpDelete<Automation>(`/automations/${rule.id}`) : await httpPost<Automation>(`/automations/${rule.id}/${operation}`, {})
            report(updated.error ? messageOf(updated.error) : (updated.status === "pending" ? "This change is waiting for confirmation from the local agent. A previously active rule may continue running until then." : "Local state confirmed."))
            changed()
        } catch (e) {report(errorText(e))} finally {setBusy("")}
    }
    if (editing !== undefined) return <RuleEditor key={editing?.id || "new"} home={home} controller={controller} rule={editing} cancel={() => setEditing(undefined)} done={() => {setEditing(undefined); changed(); report("Draft saved. Activate the rule to deploy it locally.")}}/>
    return <><div className={s.row} style={{justifyContent: "space-between", marginBottom: 22}}><p className={s.muted}>Rules for this controller. Entity assignments are managed on the controller.</p><button className={s.primary} disabled={!writable} onClick={() => setEditing(null)}>+ Add Rule</button></div>
        {result?.error && <div role="alert" className={s.error}>{result.error}</div>}
        {result?.data?.length === 0 && <div className={s.empty}>No rules for this controller yet.<br/>Set thresholds or a schedule.</div>}
        <div className={s.grid}>{result?.data?.map(rule => <article className={s.card} key={rule.id}><span className={s.badge}>{rule.deleted ? "Removal pending" : status[rule.status] || rule.status}{connections?.data && !connections.data.some(c => c.id === rule.agent_id && c.connected) ? " · Connection offline" : ""}</span>
            <h3 style={{marginTop: 14}}>{rule.spec.name}</h3><p className={s.muted}>{rule.spec.targets.length} target device{rule.spec.targets.length !== 1 ? "s" : ""} · {rule.spec.weekdays.map(i => days[i]).join(", ")}</p>
            <p>{rule.spec.kind === "humidity_band" ? humidityText(rule.spec) : rule.spec.kind === "cleaning" ? `Cleaning at ${rule.spec.at}` : rule.spec.kind === "lighting_ramp" ? rampText(rule.spec) : `On at ${timingText(rule.spec, "start")} · Off at ${timingText(rule.spec, "end")}`}</p>
            {rule.error && <p role="alert" className={s.error}>{messageOf(rule.error)}</p>}
            {rule.deployed_version && rule.deployed_version !== rule.version && <p className={s.muted}>Saved version: {rule.version}. Locally confirmed version: {rule.deployed_version}.</p>}
            {!rule.deleted && <div className={s.row}>
                <button disabled={!writable || busy === rule.id} onClick={() => void operate(rule, rule.deployed_spec?.enabled || (rule.requested && rule.spec.enabled) ? "pause" : !rule.spec.enabled ? "resume" : "deploy")}>{rule.deployed_spec?.enabled || (rule.requested && rule.spec.enabled) ? "Pause" : rule.status === "paused" ? "Resume" : "Activate / retry deployment"}</button>
                <button title={rule.deployed_spec?.enabled ? "Pause before editing" : ""} disabled={!writable || busy === rule.id || !!rule.deployed_spec?.enabled} onClick={() => setEditing(rule)}>Edit</button>
                <button disabled={!writable || busy === rule.id} onClick={() => void operate(rule, "delete")}>Remove</button>
            </div>}
        </article>)}</div><ActivityFeed controllerId={controller.controller_id} revision={revision} timezone={home.timezone}/></>
}

function ActivityFeed({revision, timezone, controllerId}: {revision: number; timezone: string; controllerId: string}) {
    const result = useLoad<Activity[]>(`/automation-events?controller_id=${controllerId}`, revision)
    if (!result?.data?.length) return null
    return <section className={s.card} style={{marginTop: 28}}><h2>Activity</h2><p className={s.muted}>Requested commands and reported device states are shown separately. Activity may be incomplete while disconnected.</p>
        <div className={s.list}>{result.data.map(event => <div key={event.id} className={s.choice}><span>
            <strong>{event.name}</strong><span>{({saved: "Draft saved", active: "Rule activated locally", paused: "Rule paused locally", deleted: "Rule removed locally", deployment_failed: "Change not confirmed", action_requested: "Device command requested", device_state: "Device state reported"} as Record<string,string>)[event.kind] || event.kind}
                {event.detail.state ? `: ${event.detail.state === "on" ? "On" : event.detail.state === "off" ? "Off" : event.detail.state}` : ""}{event.detail.reason ? ` · ${reasons[event.detail.reason] || event.detail.reason}` : ""}</span>
            <small className={s.muted}>{new Date(event.created_at).toLocaleString("en-GB", {timeZone: timezone})}{event.detail.entity_id ? ` · ${event.detail.entity_id}` : ""}</small></span></div>)}</div></section>
}
