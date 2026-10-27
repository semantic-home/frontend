import {useId, useRef} from "react"
import type {Spec} from "./types.ts"
import s from "./Workspace.module.css"

export function HumiditySchedule({spec, update, timezone}: {spec: Spec; update: (patch: Partial<Spec>) => void; timezone: string}) {
    const scheduled = spec.start !== null && spec.start !== undefined
    const previous = useRef({start: spec.start || "06:00", end: spec.end || "22:00"})
    const hoursId = useId(), descriptionId = useId()
    const overnight = !!(spec.start && spec.end && spec.start > spec.end)
    return <fieldset className={s.humiditySchedule}><legend>Operating hours</legend>
        <label className={s.scheduleToggle}><input type="checkbox" checked={scheduled} aria-controls={scheduled ? hoursId : undefined} aria-describedby={descriptionId} onChange={e => {
            if (!e.target.checked) {
                previous.current = {start: spec.start || "06:00", end: spec.end || "22:00"}
                update({start: null, end: null})
            } else update(previous.current)
        }}/><span>Only during set hours</span></label>
        {scheduled ? <>
            <div className={s.split} id={hoursId}>
                <label className={s.field}>From<input required type="time" value={spec.start || ""} onChange={e => update({start: e.target.value})}/></label>
                <label className={s.field}>Until<input required type="time" value={spec.end || ""} onChange={e => update({end: e.target.value})}/></label>
            </div>
            <p className={s.muted} id={descriptionId}>Outside these hours, devices switch off regardless of humidity. Times use {timezone}.</p>
            {overnight && <p className={s.muted}>Ends the following day. Selected days refer to the day it starts.</p>}
            {spec.start === spec.end && <p className={s.error} role="alert">Choose different start and end times, or uncheck “Only during set hours” for all-day control.</p>}
        </> : <p className={s.muted} id={descriptionId}>Humidity control runs all day on the selected days.</p>}
    </fieldset>
}
