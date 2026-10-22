import {useEffect, useRef, useState} from "react"
import {Link, useLocation} from "react-router-dom"
import {Check, ChevronDown, Copy, House, LogOut, Plug, Plus, Radio, UserRound, X} from "lucide-react"
import type {Connection, Home, User} from "../workspace/types.ts"
import type {UiRuntimeStatus} from "../api/statusTypes.ts"
import {StatusLight} from "../styles/StatusLight.tsx"
import {errorText, useLoad} from "../workspace/shared.ts"
import styles from "./HeaderTools.module.css"

function AgentIndicator({revision, navigate}: {revision: number; navigate: () => void}) {
    const result = useLoad<Connection[]>("/connections", revision)
    const agents = result?.data?.filter(agent => !agent.revoked) || []
    const online = agents.filter(agent => agent.connected)
    const simulated = online.filter(agent => agent.metadata.stub).length
    let status: UiRuntimeStatus = "UNKNOWN"
    let label = "No agents"
    let description = "No active agent connections. Open Connections to add one."
    if (!result) {
        status = "ACTIVATING"; label = "Checking agents"; description = "Checking local agent availability."
    } else if (result.error) {
        label = "Status unavailable"; description = "Agent status could not be checked. Open Connections for details."
    } else if (agents.length) {
        status = online.length === agents.length ? "ACTIVE" : online.length ? "PAUSED" : "IDLE"
        label = !online.length ? (agents.length === 1 ? "Agent offline" : "Agents offline")
            : online.length < agents.length ? `${online.length}/${agents.length} agents online`
            : simulated === online.length ? "Preview online"
            : online.length === 1 ? "Agent online" : `${online.length} agents online`
        description = `${online.length} of ${agents.length} local agents connected.${simulated ? ` ${simulated} simulated; no real devices on those connections.` : ""} Open Connections for details.`
    }
    return <Link to="/connections" onClick={navigate} className={styles.agentLink} title={description} aria-label={`${label}. ${description}`}>
        <StatusLight status={status} label={label}/><span className={styles.agentLabel}>{label}</span>
    </Link>
}

export function HeaderTools({user, home, revision, selectHome, addHome, navigate, signOut}: {
    user: User; home?: Home; revision: number; selectHome: (id: string) => void;
    addHome: () => void; navigate: () => void; signOut: () => Promise<void>
}) {
    const [open, setOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const root = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const location = useLocation()
    const name = user.email.split("@")[0]
    const initials = name.split(/[._\s-]+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()
    useEffect(() => {
        if (!open) return
        const dismiss = (event: PointerEvent) => {if (!root.current?.contains(event.target as Node)) setOpen(false)}
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {event.stopPropagation(); setOpen(false); trigger.current?.focus()}
        }
        const leave = (event: FocusEvent) => {
            if (event.relatedTarget && !root.current?.contains(event.relatedTarget as Node)) setOpen(false)
        }
        const element = root.current
        document.addEventListener("pointerdown", dismiss)
        document.addEventListener("keydown", escape, true)
        element?.addEventListener("focusout", leave)
        return () => {
            document.removeEventListener("pointerdown", dismiss)
            document.removeEventListener("keydown", escape, true)
            element?.removeEventListener("focusout", leave)
        }
    }, [open])
    const visit = () => {setOpen(false); navigate()}
    return <div className={styles.tools}>
        {home && <AgentIndicator key={home.id} revision={revision} navigate={navigate}/>}
        <div className={styles.account} ref={root}>
            <button ref={trigger} type="button" className={styles.accountButton} aria-label={`Account menu for ${user.email}`}
                aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(value => !value)}>
                <span className={styles.avatar} aria-hidden="true">{initials || <UserRound size={16}/>}</span>
                <span className={styles.accountName}>{name}</span><ChevronDown size={14} className={styles.chevron} aria-hidden="true"/>
            </button>
            {open && <section id="account-menu" className={styles.dropdown} aria-label="Account menu">
                <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{initials}</span><div><strong>{name}</strong><span>{user.email}</span></div>
                    <button type="button" className={styles.close} aria-label="Close account menu" onClick={() => {setOpen(false); trigger.current?.focus()}}><X size={16}/></button></div>
                <div className={styles.homeSection}>
                    <label htmlFor="current-home">Current home</label>
                    {home ? <select id="current-home" value={home.id} onChange={event => {selectHome(event.target.value); setOpen(false)}}>
                        {user.homes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select> : <p>No home yet</p>}
                    <button type="button" className={styles.menuItem} onClick={() => {setOpen(false); addHome()}}><Plus size={16}/>Add a home</button>
                </div>
                <nav className={styles.navigation} aria-label="Workspace">
                    <Link className={styles.menuItem} to="/" onClick={visit} aria-current={location.pathname === "/" || location.pathname === "/watering" ? "page" : undefined}><House size={16}/>Controllers & Zones</Link>
                    {home && <><Link className={styles.menuItem} to="/devices" onClick={visit} aria-current={location.pathname.startsWith("/devices") ? "page" : undefined}><Radio size={16}/>Device Inventory</Link>
                        <Link className={styles.menuItem} to="/connections" onClick={visit} aria-current={location.pathname.startsWith("/connections") ? "page" : undefined}><Plug size={16}/>Connections & Members</Link></>}
                </nav>
                <details className={styles.details}><summary>Account details</summary><span>Your account ID</span><code>{user.id}</code>
                    <button type="button" className={styles.menuItem} onClick={() => void navigator.clipboard.writeText(user.id).then(() => setCopied(true)).catch(() => setError("Could not copy the ID. Select it and copy it manually."))}>
                        {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "ID copied" : "Copy account ID"}</button>
                    <p>Share this ID with the person inviting you to their home.</p>
                </details>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.signOut}><button type="button" disabled={busy} className={styles.menuItem} onClick={() => {
                    setBusy(true); setError(""); void signOut().catch(error => setError(errorText(error))).finally(() => setBusy(false))
                }}><LogOut size={16}/>{busy ? "Signing out …" : "Sign out"}</button></div>
            </section>}
        </div>
    </div>
}
