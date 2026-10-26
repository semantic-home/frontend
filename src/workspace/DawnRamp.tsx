import {useEffect, useId, useState} from "react"
import {Sunrise} from "lucide-react"
import {httpGet, httpPost} from "../api/http.ts"
import {errorText} from "./shared.ts"
import type {DawnRamp, Device, Preview, RampPreview, Spec} from "./types.ts"
import {defaultRamp, phases, rampValid} from "./dawn.ts"
import s from "./Workspace.module.css"


export function DawnRampEditor({spec, update, valid, homeId}: {spec: Spec; update: (patch: Partial<Spec>) => void; valid: boolean; homeId: string}) {
    const ramp = spec.ramp || defaultRamp(), payload = JSON.stringify(spec), key = homeId + payload
    const targetKey = JSON.stringify(spec.targets)
    const [devices, setDevices] = useState<{key: string; items?: Device[]; error?: string}>()
    const [result, setResult] = useState<{key: string; data?: RampPreview; error?: string}>()
    function change(patch: Partial<DawnRamp>) {update({ramp: {...ramp, ...patch}})}
    useEffect(() => {
        let alive = true
        void Promise.all((JSON.parse(targetKey) as string[]).map(id => httpGet<Device>(`/devices/${id}`)))
            .then(items => {if (alive) setDevices({key: targetKey, items})})
            .catch(error => {if (alive) setDevices({key: targetKey, error: errorText(error)})})
        return () => {alive = false}
    }, [targetKey, homeId])
    useEffect(() => {
        if (!valid) return
        let alive = true
        const load = async () => {
            try {
                const preview = await httpPost<Preview>("/automations/preview", JSON.parse(payload))
                if (alive) setResult({key, data: preview.ramp || undefined})
            } catch (error) {if (alive) setResult({key, error: errorText(error)})}
        }
        const debounce = window.setTimeout(() => void load(), 400)
        const timer = window.setInterval(() => {if (!document.hidden) void load()}, 60000)
        return () => {alive = false; window.clearTimeout(debounce); window.clearInterval(timer)}
    }, [key, payload, valid])
    const current = result?.key === key && valid ? result : undefined
    const lamps = devices?.key === targetKey ? devices.items : undefined
    const white = lamps?.every(d => d.capabilities.color_temp?.supported)
    return <>
        <div className={s.split}><label className={s.field}>Switch on dim at<input required type="time" value={ramp.start_at} onChange={e => change({start_at: e.target.value})}/></label>
            <label className={s.field}>Stop adjusting at<input required type="time" value={ramp.stop_at} onChange={e => change({stop_at: e.target.value})}/></label></div>
        <label className={s.field}>When the ramp ends<select value={ramp.off_at_end ? "off" : "hold"} onChange={e => change({off_at_end: e.target.value === "off"})}>
            <option value="hold">Leave the lights at their last level</option><option value="off">Switch the lights off</option></select></label>
        <div className={s.split}><label className={s.field}>Dim start (%)<input required type="number" min={1} max={100} step={1} value={ramp.initial_brightness_pct} onChange={e => change({initial_brightness_pct: Number(e.target.value)})}/></label>
            <label className={s.field}>Gentle start (minutes)<input required type="number" min={1} max={120} step={1} value={ramp.startup_minutes} onChange={e => change({startup_minutes: Number(e.target.value)})}/></label></div>
        <p className={s.muted}>The lights always start dim. Over the first {ramp.startup_minutes} minutes they catch up to the real dawn level, then follow the sun. Phases that have already passed are not replayed.</p>
        <label className={s.field}>What changes<select value={ramp.color_mode} onChange={e => change({color_mode: e.target.value as DawnRamp["color_mode"]})}>
            <option value="white">Brightness and warm-to-cool white</option><option value="brightness">Brightness only</option></select></label>
        {devices?.key === targetKey && devices.error && <p className={s.error} role="alert">{devices.error}</p>}
        {lamps && <p className={s.muted}>{lamps.length} lamp{lamps.length === 1 ? "" : "s"} in this controller. {ramp.color_mode === "brightness" ? "Adjusts brightness only." : white ? "White temperature adapts to each lamp’s supported range." : "Some lamps do not support white temperature. Choose brightness only, or change the controller’s lamps."}
            {white && ramp.color_mode === "white" && <> {lamps.map(d => `${d.attributes.friendly_name || d.entity_id}: ${d.capabilities.color_temp!.min_kelvin}–${d.capabilities.color_temp!.max_kelvin} K`).join(" · ")}</>}</p>}
        <section className={s.solarPreview} aria-label="Natural dawn preview" aria-live="polite">
            <div className={s.row}><Sunrise size={20} aria-hidden="true"/><strong>Natural dawn · local time preview</strong></div>
            {!valid ? <p className={s.muted}>Choose a same-day start and stop, and increasing brightness levels to see the timeline.</p>
                : current?.error ? <p className={s.error} role="alert">{current.error}</p>
                : !current?.data ? <p className={s.muted}>Calculating the dawn at your home …</p>
                : <DawnTimeline key={key} data={current.data} color={ramp.color_mode === "white"} offAtEnd={ramp.off_at_end}/>}
            <p className={s.muted}>Real dawn follows the home location in Home Assistant. Previewing sends no device commands.</p>
        </section>
        <fieldset className={s.timingPoint}><legend>Dawn light levels</legend>
            <p className={s.muted}>{ramp.color_mode === "white" ? "Brightness and white temperature blend gradually between these sun positions. Lower K = warmer white; higher K = cooler white." : "Brightness blends gradually between these sun positions."} Daylight here means the sun’s centre at 0°.</p>
            {phases.map(phase => <div className={s.rampPhase} key={phase.key}>
                <strong>{phase.name}<small className={s.muted}>{phase.angle}</small></strong>
                <label className={s.field}>{phase.name} brightness (%)<input required type="number" min={1} max={100} step={1} value={ramp[phase.key].brightness_pct} onChange={e => change({[phase.key]: {...ramp[phase.key], brightness_pct: Number(e.target.value)}})}/></label>
                {ramp.color_mode === "white" && <label className={s.field}>{phase.name} white (K)<input required type="number" min={1000} max={10000} step={1} value={ramp[phase.key].kelvin} onChange={e => change({[phase.key]: {...ramp[phase.key], kelvin: Number(e.target.value)}})}/></label>}
            </div>)}
            {!rampValid(ramp) && <p role="alert" className={s.error}>Stop must follow start on the same day. Brightness must stay level or increase from the dim start through daylight. Use 1–100%, white 1000–10000 K and a gentle start of 1–120 minutes.</p>}
        </fieldset>
        <p className={s.muted}>A manual switch-off stays off until the next scheduled start. After a Home Assistant restart, lamps that are still on resume at the current dawn level. The rule leaves other lamps off. The stop trigger is not replayed if Home Assistant was stopped at that time.</p>
    </>
}

function DawnTimeline({data, color, offAtEnd}: {data: RampPreview; color: boolean; offAtEnd: boolean}) {
    const id = useId().replaceAll(":", ""), [index, setIndex] = useState(0)
    const clock = (at: string) => new Date(at).toLocaleTimeString("en-GB", {timeZone: data.timezone, hour: "2-digit", minute: "2-digit"})
    const date = new Date(data.now).toLocaleDateString("en-GB", {timeZone: data.timezone, day: "numeric", month: "short", year: "numeric"})
    const samples = data.samples, point = samples[Math.min(index, samples.length - 1)]
    const from = samples.length ? new Date(samples[0].at).getTime() : 0, to = samples.length ? new Date(samples[samples.length-1].at).getTime() : 1
    const x = (at: string) => (new Date(at).getTime() - from) / (to - from || 1) * 510
    const path = samples.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${(120 - p.brightness_pct * 1.2).toFixed(1)}`).join(" ")
    return <>
        <p className={s.muted}><strong>{data.location_name || "Location not reported"}</strong> · {date} · {data.timezone}<br/>{data.connection_name} · All times are local to this home.</p>
        {data.available && point && <>
            <div className={s.rampPlot}>
                <div className={s.rampYAxis} aria-hidden="true">{[100, 50, 0].map(v => <span key={v} style={{top: `${(120-v*1.2)/140*100}%`}}>{v}%</span>)}</div>
                <div className={s.rampGraphic}>
                    <svg className={s.rampChart} viewBox="0 0 510 140" preserveAspectRatio="none" role="img" aria-label="Brightness curve from the dim start to natural daylight">
                        <defs><linearGradient id={id}><stop offset="0" stopColor="#f3b066"/><stop offset="1" stopColor="#c9e4ff"/></linearGradient></defs>
                        {[0, 50, 100].map(v => <line key={v} x1="0" x2="510" y1={120-v*1.2} y2={120-v*1.2} className={s.rampGrid}/>)}
                        <path d={`${path} L510,120 L0,120 Z`} fill={`url(#${id})`} opacity=".12"/>
                        <path d={path} fill="none" stroke={`url(#${id})`} strokeWidth="3" vectorEffect="non-scaling-stroke"/>
                        <line x1={x(point.at)} x2={x(point.at)} y1="0" y2="120" stroke="currentColor" opacity=".45" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
                    </svg>
                    <i className={s.rampMarker} aria-hidden="true" style={{left: `${x(point.at)/510*100}%`, top: `${(120-point.brightness_pct*1.2)/140*100}%`}}/>
                </div>
                <div className={s.rampXAxis}><span>{clock(samples[0].at)}</span><span>{clock(samples[samples.length-1].at)}</span></div>
            </div>
            <label className={s.field}>Explore the light level<input type="range" min={0} max={samples.length-1} step={1} value={index} onChange={e => setIndex(Number(e.target.value))}/></label>
            <p className={s.rampReadout}><strong>{clock(point.at)}</strong><span>{point.brightness_pct === 0 ? "Switch off" : <>{point.brightness_pct}% brightness{color ? ` · ${point.kelvin} K white` : ""}</>}</span></p>
            <ol className={s.phaseTimes}>{data.phases.map(phase => <li key={phase.key}><span><strong>{phase.label}</strong><small>{phase.elevation}°{phase.before_start ? " · before switch-on" : phase.at && data.stop && new Date(phase.at) > new Date(data.stop) ? " · after ramp ends" : ""}</small></span><strong>{phase.at ? clock(phase.at) : "No crossing today"}</strong></li>)}</ol>
            <p className={s.muted}>{offAtEnd ? "Switch off" : "Stop adjusting and keep the last level"} at {data.stop ? clock(data.stop) : "the chosen stop time"}.</p>
            {color && <p className={s.muted}>The curve shows your chosen levels. Each lamp’s white temperature is limited to its supported range.</p>}
        </>}
        {!data.selected_day && <p className={s.notice}>Today is not an active day. This timeline illustrates today’s dawn; the rule will not switch on today.</p>}
        {data.warnings.map(warning => <p className={s.notice} key={warning}>{warning}</p>)}
    </>
}
