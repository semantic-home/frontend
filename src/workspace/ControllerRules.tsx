import {useState} from "react"
import {httpDelete, httpPost} from "../api/http.ts"
import type {Activity, Automation, Connection, Home, SemanticController} from "./types.ts"
import {errorText, messageOf, useLoad} from "./shared.ts"
import {ProgramRuleEditor} from "./ProgramEditor.tsx"
import {programDescription, programText} from "./program.ts"
import {humidityText, rampText, timingText} from "./schedule.ts"
import s from "./Workspace.module.css"
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const status: Record<string, string> = {draft: "Draft", pending: "Awaiting confirmation", active: "Active", paused: "Paused", error: "Deployment failed"}
const reasons: Record<string, string> = {upper_threshold: "Upper threshold reached", lower_threshold: "Lower threshold reached", keep_state: "Keep the current state between thresholds", sensor_unavailable: "Measurement missing or stale", outside_window: "Outside selected days or hours · forced off", time_window: "Time window evaluated", solar_schedule: "Runs at the scheduled sun or clock event", lighting_ramp: "Follows the natural twilight light levels", ramp_finished: "Lighting ramp finished", program_action: "Action step", program_curve: "Curve adjustment", program_finished: "Permitted period ended", condition_not_met: "Extra condition not satisfied"}
export {DevicePicker} from "./DevicePicker.tsx"

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
    if (editing !== undefined) return <ProgramRuleEditor key={home.id + controller.controller_id + (editing?.id || "new")} home={home} controller={controller} rule={editing} cancel={() => setEditing(undefined)} done={() => {setEditing(undefined); changed(); report("Draft saved. Activate the rule to deploy it locally.")}}/>
    return <><div className={s.row} style={{justifyContent: "space-between", marginBottom: 22}}><p className={s.muted}>Rules for this controller. Entity assignments are managed on the controller.</p><button className={s.primary} disabled={!writable} onClick={() => setEditing(null)}>+ Add Rule</button></div>
        {result?.error && <div role="alert" className={s.error}>{result.error}</div>}
        {result?.data?.length === 0 && <div className={s.empty}>No rules for this controller yet.<br/>Set thresholds or a schedule.</div>}
        <div className={s.grid}>{result?.data?.map(rule => <article className={s.card} key={rule.id}><span className={s.badge}>{rule.deleted ? "Removal pending" : status[rule.status] || rule.status}{connections?.data && !connections.data.some(c => c.id === rule.agent_id && c.connected) ? " · Connection offline" : ""}</span>
            <h3 style={{marginTop: 14}}>{rule.spec.name}</h3><p className={s.muted}>{rule.spec.targets.length} target device{rule.spec.targets.length !== 1 ? "s" : ""} · {rule.spec.weekdays.map(i => days[i]).join(", ")}</p>
            <p>{rule.spec.kind === "program" && rule.spec.program ? programText(rule.spec.program) : rule.spec.kind === "humidity_band" ? humidityText(rule.spec) : rule.spec.kind === "cleaning" ? `Cleaning at ${rule.spec.at}` : rule.spec.kind === "lighting_ramp" ? rampText(rule.spec) : `On at ${timingText(rule.spec, "start")} · Off at ${timingText(rule.spec, "end")}`}</p>
            {rule.spec.program && (rule.spec.program.control.kind!=='curve'||rule.spec.program.conditions.terms.length>0) && <p className={s.muted}>{programDescription(rule.spec.program,Object.fromEntries(controller.entities.map(d=>[d.device_id,d.name])))}</p>}
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
