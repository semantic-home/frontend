import {useRef} from "react"
import {Clock3} from "lucide-react"
import type {Spec} from "./types.ts"
import s from "./Workspace.module.css"

export function HumiditySchedule({spec, update, timezone}: {spec: Spec; update: (patch: Partial<Spec>) => void; timezone: string}) {
    const scheduled = spec.start !== null && spec.start !== undefined
    const previous = useRef({start: spec.start || "06:00", end: spec.end || "22:00"})
    const overnight = !!(spec.start && spec.end && spec.start > spec.end)
    return <fieldset className={s.timingPoint}><legend><Clock3 size={18} aria-hidden="true"/> Operating schedule</legend>
        <label className={s.field}>Apply humidity thresholds<select value={scheduled ? "scheduled" : "all_day"} onChange={e => {
            if (e.target.value === "all_day") {
                previous.current = {start: spec.start || "06:00", end: spec.end || "22:00"}
                update({start: null, end: null})
            } else update(previous.current)
        }}><option value="all_day">All day on selected days</option><option value="scheduled">Only during scheduled hours</option></select></label>
        {scheduled ? <>
            <div className={s.split}>
                <label className={s.field}>Start humidity control<input required type="time" value={spec.start || ""} onChange={e => update({start: e.target.value})}/></label>
                <label className={s.field}>Force off at<input required type="time" value={spec.end || ""} onChange={e => update({end: e.target.value})}/></label>
            </div>
            <p className={s.sentence}><strong>Time takes priority.</strong> At <strong>{spec.end || "the end time"}</strong>{overnight ? " the following day" : ""}, switch the assigned dehumidifiers off, regardless of humidity.</p>
            <p className={s.muted}>The minimum switching interval does not delay this stop. Devices stay off outside the scheduled hours.</p>
            <p className={s.muted}>{overnight ? "This is an overnight window. Selected days refer to the day it starts." : "Selected days apply to this time window."} At {spec.start || "the start time"}, humidity control resumes; devices switch on only if the humidity conditions allow it.</p>
            {spec.start === spec.end && <p className={s.error} role="alert">Choose different start and force-off times. For 24-hour control, select “All day”.</p>}
        </> : <p className={s.muted}>Humidity thresholds apply throughout each selected day. Outputs switch off on other days. Choose scheduled hours to add a daily force-off time, such as 22:00.</p>}
        <p className={s.muted}>Time zone: {timezone}. Home Assistant enforces the schedule locally.</p>
    </fieldset>
}
