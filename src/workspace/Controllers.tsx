import {useState} from "react"
import type {FormEvent} from "react"
import {useSearchParams} from "react-router-dom"
import {Droplets, Lamp, Plug, Bot} from "lucide-react"
import type {DomainKey} from "../header/domains.ts"
import type {ZoneMenuEntry} from "../main/MainView.tsx"
import type {Device, SemanticController} from "./types.ts"
import {useHousehold} from "./household.ts"
import {displayZone, errorText, useLoad} from "./shared.ts"
import {ControllerEmptyState} from "../main/content/pads/components/ControllerEmptyState.tsx"
import {httpDelete, httpPost, httpPut} from "../api/http.ts"
import {DevicePicker, Rules} from "./ControllerRules.tsx"
import s from "./Workspace.module.css"
import c from "./Controllers.module.css"
import pads from "../main/content/pads/ControllerPads.module.css"
import feed from "../main/content/ZonesContent.module.css"
import button from "../styles/Button.module.css"

const purposes: Record<string, string> = {humidity: "Humidity", lighting: "Lighting", power: "Power", cleaning: "Cleaning"}
const roleLabels: Record<string, string> = {humidity_sensor: "Measures room humidity", dehumidifier_power: "Powers the dehumidifier", lighting_output: "Lighting", power_output: "Switchable device", cleaner: "Robot vacuum"}
const icons = {humidity: Droplets, lighting: Lamp, power: Plug, cleaning: Bot}
const valueOf = (entity: SemanticController["entities"][number]) => !entity.available ? "Unavailable" : entity.state === "on" ? "On" : entity.state === "off" ? "Off" : `${entity.state} ${entity.unit || ""}`

export function ControllerZone({domain, zoneId, zoneName, revision, create, open}: {
    domain: DomainKey; zoneId: string; zoneName: string; revision: number; create: () => void;
    open: (id: string, rules: boolean) => void
}) {
    const home = useHousehold()
    const result = useLoad<SemanticController[]>(`/domains/${domain}/zones/${encodeURIComponent(zoneId)}/controllers`, revision)
    const Icon = icons[domain as keyof typeof icons] || Plug
    return <div className={feed.feed}><div className={feed.zonesContent}>
        <div className={feed.zonesHeader}><h1>{purposes[domain] || "Surveillance"} · {zoneName}</h1><p className={s.muted}>Zone → Controller → Entities and rules</p></div>
        <div className={pads.padHeading}><h3 className={pads.padHeadingText}>Controller Pads</h3>
            {domain !== "surveillance" && <button className={`${button.button} ${button.createFormButton}`} disabled={home.role === "viewer"} onClick={create}>+ Create Controller</button>}</div>
        {result?.error && <p className={s.error} role="alert">{result.error}</p>}
        {!result && <p role="status">Loading controllers …</p>}
        {result?.data?.length === 0 && <ControllerEmptyState unsupported={domain === "surveillance"}/>}
        <div className={pads.padList}>{result?.data?.map(controller => <article className={pads.pad} key={controller.controller_id}>
            <header className={c.cardHeader}><span className={c.icon}><Icon size={22}/></span><h2>{controller.display_name}</h2><span className={s.badge}>{controller.entities.some(e => !e.available) ? "Check connection" : controller.rules.some(r => r.status === "active") ? "Active" : "Ready"}</span></header>
            <p className={c.meaning}>{controller.domain === "humidity" ? "The humidity measurement determines when the assigned dehumidifiers switch on and off." : controller.domain === "lighting" ? "These entities form the lighting group managed by this controller." : controller.domain === "cleaning" ? "This controller schedules cleaning with the assigned robot vacuums." : "This controller switches the assigned devices according to its rules."}</p>
            <div className={c.roles}>{controller.entities.map(entity => <div key={entity.device_id}><span className={s.muted}>{roleLabels[entity.role]}</span><strong>{entity.name}</strong><span>{valueOf(entity)}</span></div>)}</div>
            <div className={c.ruleSummary}>{controller.rules.length ? controller.rules.map(rule => <p key={rule.id}><strong>{rule.spec.name}</strong> · {rule.spec.kind === "humidity_band" ? `On at ${rule.spec.upper}%, off at ${rule.spec.lower}%` : rule.spec.kind === "cleaning" ? `At ${rule.spec.at}` : `${rule.spec.start}–${rule.spec.end}`}<span className={s.muted}> · {rule.status === "draft" ? "Draft" : rule.status === "active" ? "Active" : rule.status === "paused" ? "Paused" : rule.status === "pending" ? "Awaiting confirmation" : "Check deployment"}</span></p>) : <p className={s.muted}>No rules yet. The entities are already assigned.</p>}</div>
            <div className={s.row}><button className={`${button.button} ${button.actionButton}`} onClick={() => open(controller.controller_id, false)}>Edit Controller</button><button className={`${button.button} ${button.actionButton}`} onClick={() => open(controller.controller_id, true)}>Edit Rules · {controller.rule_count}</button></div>
        </article>)}</div>
    </div></div>
}

function ControllerForm({domain, zoneId, zones, controller, saved, cancel}: {
    domain: DomainKey; zoneId: string; zones: ZoneMenuEntry[]; controller?: SemanticController; saved: () => void; cancel: () => void
}) {
    const home = useHousehold()
    const [name, setName] = useState(controller?.display_name || "")
    const [zone, setZone] = useState(controller?.zone_id || zoneId)
    const [targets, setTargets] = useState<string[]>(controller?.bindings.targets || [])
    const [sensor, setSensor] = useState<string | null>(controller?.bindings.sensor_id || null)
    const [expectedVersion] = useState(controller?.version || null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const first = useLoad<Device>(targets[0] ? `/devices/${targets[0]}` : null)
    const locked = controller?.rules.some(r => r.deployed_spec?.enabled || (r.requested && r.status !== "paused"))
    const writable = home.role !== "viewer"
    async function save(e: FormEvent) {
        e.preventDefault(); setBusy(true); setError("")
        const body = {display_name: name, zone_id: zone, targets, sensor_id: sensor, expected_version: expectedVersion}
        try {
            if (controller) await httpPut(`/domains/${domain}/controllers/${controller.controller_id}`, body)
            else await httpPost(`/domains/${domain}/controllers`, body)
            saved()
        } catch (e) {setError(errorText(e))} finally {setBusy(false)}
    }
    return <form className={s.form} onSubmit={save}>
        <p className={s.muted}>{purposes[domain]}. A controller gives its entities a shared purpose. Set thresholds and schedules under Rules afterwards.</p>
        <label className={s.field}>Controller name<input required maxLength={100} disabled={!writable} value={name} onChange={e => setName(e.target.value)} placeholder={domain === "humidity" ? "For example: Cellar humidity" : domain === "lighting" ? "For example: Evening lights" : "Name this controller"}/></label>
        <label className={s.field}>Zone<select disabled={!writable} value={zone} onChange={e => setZone(e.target.value)}>{zones.map(z => <option key={z.key} value={z.key}>{z.value}</option>)}</select><span className={s.muted}>The zone groups the controller. Its entities can also come from other rooms.</span></label>
        {first?.data?.attributes.area_id && first.data.attributes.area_id !== zone && zones.some(z => z.key === first.data?.attributes.area_id) && <button type="button" disabled={!writable} onClick={() => setZone(first.data!.attributes.area_id!)}>Use suggested zone: {first.data.attributes.area_name || first.data.attributes.area_id}</button>}
        {locked && <p className={s.notice}>Pause the rules and wait for local confirmation before changing entity assignments. You can still edit the name and zone.</p>}
        <fieldset disabled={!writable || locked || busy} className={c.entityFields}>
            <legend>Entities and roles</legend>
            <DevicePicker capability={domain === "cleaning" ? "cleaning" : "switching"} title={domain === "humidity" ? "Powers the dehumidifier" : domain === "lighting" ? "Controls the lights" : domain === "cleaning" ? "Performs cleaning" : "Powers the device"} selected={targets} agentId={first?.data?.agent_id} zoneId={zone} change={setTargets}/>
            {domain === "humidity" && <DevicePicker title="Measures room humidity" capability="humidity" multiple={false} selected={sensor ? [sensor] : []} agentId={first?.data?.agent_id} zoneId={zone} change={ids => setSensor(ids[0] || null)}/>}
        </fieldset>
        {error && <p className={s.error} role="alert">{error}</p>}
        <div className={s.row}><button className={s.primary} disabled={!writable || busy || !name.trim() || !targets.length || (domain === "humidity" && !sensor)}>Save Controller</button><button type="button" onClick={cancel}>Cancel</button></div>
        {controller && <button type="button" disabled={!writable || busy || controller.rule_count > 0} onClick={() => {setBusy(true); void httpDelete(`/domains/${domain}/controllers/${controller.controller_id}`).then(saved).catch(e => setError(errorText(e))).finally(() => setBusy(false))}}>Remove Controller</button>}
    </form>
}

export function ControllerPanel({domain, zoneId, zones, controllerId, showRules, revision, saved, close}: {
    domain: DomainKey; zoneId: string; zones: ZoneMenuEntry[]; controllerId?: string; showRules: boolean; revision: number; saved: () => void; close: () => void
}) {
    const home = useHousehold()
    const [params, setParams] = useSearchParams()
    const tab = showRules ? "rules" : "entities"
    const setTab = (value: string) => {const next = new URLSearchParams(params); next.set("panel", value); setParams(next, {replace: true})}
    const [notice, setNotice] = useState("")
    const [localRevision, setLocalRevision] = useState(0)
    const changed = () => {setLocalRevision(n => n + 1); saved()}
    const result = useLoad<SemanticController>(controllerId ? `/domains/${domain}/controllers/${controllerId}` : null, revision + localRevision)
    const controller = result?.data
    async function act(action: string) {
        if (!controller) return
        const responses = await Promise.all(controller.bindings.targets.map(async id => {
            try {const r = await httpPost<{accepted: boolean; error: string | null}>(`/devices/${id}/actions`, {action}); return r.accepted ? "Accepted" : r.error || "Not confirmed"}
            catch (e) {return errorText(e)}
        }))
        setNotice(responses.map((r, i) => `${controller.entities.find(e => e.device_id === controller.bindings.targets[i])?.name}: ${r}`).join("\n"))
    }
    if (!controllerId) return <div className={`${s.shell} ${c.panel}`}><ControllerForm domain={domain} zoneId={zoneId} zones={zones} saved={() => {saved(); close()}} cancel={close}/></div>
    return <div className={`${s.shell} ${c.panel}`}>
        {result?.error && <p role="alert" className={s.error}>{result.error}</p>}
        {!controller && <p role="status">Loading controller …</p>}
        {controller && <><p className={s.muted}>{displayZone(controller.zone_id, controller.zone_name)} → {controller.display_name}</p>
            <nav className={s.tabs} aria-label="Controller"><button className={tab === "entities" ? s.active : ""} onClick={() => setTab("entities")}>Entities & Roles</button><button className={tab === "rules" ? s.active : ""} onClick={() => setTab("rules")}>Rules · {controller.rule_count}</button></nav>
            {notice && <p className={s.notice} role="status">{notice}</p>}
            {tab === "entities" ? <><div className={c.roles}>{controller.entities.map(e => <div key={e.device_id}><span>{roleLabels[e.role]}</span><strong>{e.name}</strong><span>{valueOf(e)}</span></div>)}</div>
                <div className={s.row}>{(domain === "cleaning" ? [["start", "Start cleaning"], ["pause", "Pause cleaning"], ["return_to_base", "Return to dock"]] : [["turn_on", "Turn on"], ["turn_off", "Turn off"]]).map(([action, title]) => <button key={action} disabled={home.role === "viewer"} onClick={() => void act(action)}>{title}</button>)}</div>
                <ControllerForm key={`${controller.controller_id}-${localRevision}`} domain={domain} zoneId={zoneId} zones={zones} controller={controller} saved={changed} cancel={close}/></>
                : <Rules home={home} controller={controller} revision={revision + localRevision} changed={changed} report={setNotice}/>}</>}
    </div>
}
