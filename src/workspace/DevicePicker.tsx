import {useEffect, useState} from "react"
import {httpGet} from "../api/http.ts"
import type {Device, DevicePage} from "./types.ts"
import {nameOf, useLoad} from "./shared.ts"
import {Pager} from "./Pager.tsx"
import s from "./Workspace.module.css"

export function DevicePicker({capability, selected, change, multiple = true, agentId, title, zoneId}: {capability: string; selected: string[]; change: (ids: string[]) => void; multiple?: boolean; agentId?: string; title?: string; zoneId?: string}) {
    const [expanded, setExpanded] = useState(selected.length === 0)
    const [query, setQuery] = useState("")
    const [offset, setOffset] = useState(0)
    const result = useLoad<DevicePage>(expanded ? `/devices?${new URLSearchParams({q: query, ...(capability ? {capability} : {}), offset: String(offset), ...(agentId ? {agent_id: agentId} : {})})}` : null)
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
        {expanded && <><label className={s.field}>{capability === "humidity" ? "Select humidity sensors" : title ? `Select ${title.toLowerCase()}` : "Select target devices"}
        <input type="search" value={query} placeholder="Search devices …" onChange={e => {setQuery(e.target.value); setOffset(0)}}/></label>
        {result?.error && <p role="alert">{result.error}</p>}
        <div className={s.list}>{result?.data?.items.filter(d => capability !== "cleaning" || d.capabilities.actions?.includes("start")).map(d => <label className={s.choice} key={d.id}>
            <input type="checkbox" checked={selected.includes(d.id)} onChange={() => {change(selected.includes(d.id) ? selected.filter(x => x !== d.id) : multiple ? [...selected, d.id] : [d.id]); if (!multiple) setExpanded(false)}}/>
            <span>{nameOf(d)}{zoneId && d.attributes.area_id === zoneId && <small>Matches this zone · Suggested</small>}<small className={s.muted}>{d.attributes.area_name || "No room"} · {d.state} {d.attributes.unit_of_measurement || ""}{!d.available ? " · offline" : ""}{d.connection_name ? ` · ${d.connection_name}` : ""}</small></span>
        </label>)}</div>
        {result?.data && <>{result.data.total > 50 && <Pager offset={offset} total={result.data.total} change={setOffset}/>}<span className={s.muted}>{result.data.total ? `${result.data.total} matching device entities` : "No matching devices found. Check the Home Assistant connection."}</span></>}
        {multiple && <div className={s.row}><button type="button" disabled={!selected.length} onClick={() => setExpanded(false)}>Use selection</button></div>}</>}
    </div>
}
