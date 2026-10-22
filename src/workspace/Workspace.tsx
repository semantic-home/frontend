import {useEffect, useState} from "react"
import type {FormEvent} from "react"
import {Link, useLocation, useNavigate} from "react-router-dom"
import {ApiError, httpDelete, httpGet, httpPost} from "../api/http.ts"
import {HeaderView} from "../header/HeaderView.tsx"
import {HeaderTools} from "../header/HeaderTools.tsx"
import type {DomainKey} from "../header/domains.ts"
import {DashboardPage} from "../dashboard/DashboardPage.tsx"
import {OnboardingPage} from "../onboarding/OnboardingPage.tsx"
import type {Connection, Device, DevicePage, Home, User} from "./types.ts"
import {errorText, nameOf, useLoad} from "./shared.ts"
import {HouseholdContext} from "./household.ts"
import {Pager} from "./Pager.tsx"
import s from "./Workspace.module.css"


function Auth({onUser}: {onUser: (u: User) => void}) {
    const [register, setRegister] = useState(false)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        setBusy(true); setError("")
        try {
            onUser(await httpPost<User>(`/auth/${register ? "register" : "login"}`, {email: data.get("email"), password: data.get("password"), registration_key: data.get("key") || ""}))
        } catch (e) {setError(errorText(e))} finally {setBusy(false)}
    }
    return <main className={`${s.shell} ${s.auth}`}><Link className={s.brand} to="/">Semantic Home</Link>
        <div className={s.hero}><h1>Your home. Your routines.</h1><p>Connect your devices and create automations that fit your day.</p></div>
        <form className={`${s.card} ${s.form}`} onSubmit={submit}>
            <h2>{register ? "Create account" : "Welcome back"}</h2>
            <label className={s.field}>Email<input required name="email" type="email" autoComplete="username"/></label>
            <label className={s.field}>Password<input required name="password" type="password" minLength={12} maxLength={256} autoComplete={register ? "new-password" : "current-password"}/>
                {register && <span className={s.muted}>At least 12 characters.</span>}</label>
            {register && <label className={s.field}>Registration key, if required<input name="key" type="password" autoComplete="off"/></label>}
            {error && <div role="alert" className={s.error}>{error}</div>}
            <button className={s.primary} disabled={busy}>{busy ? "Please wait …" : register ? "Create account" : "Sign in"}</button>
            <button type="button" onClick={() => {setRegister(!register); setError("")}}>{register ? "I already have an account" : "Create a new account"}</button>
        </form></main>
}

function NewHome({done, cancel}: {done: (h: Home) => void; cancel?: () => void}) {
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault(); setBusy(true)
        const data = new FormData(e.currentTarget)
        try {done(await httpPost<Home>("/homes", {name: data.get("name"), timezone: data.get("timezone")}))}
        catch (e) {setError(errorText(e))} finally {setBusy(false)}
    }
    return <form className={`${s.card} ${s.form} ${s.editor}`} onSubmit={submit}><h2>Add a home</h2>
        <p className={s.muted}>Devices and rules belong to this home. You can add more homes or invite members later.</p>
        <label className={s.field}>Name<input name="name" required maxLength={100} placeholder="For example: Home"/></label>
        <label className={s.field}>Time zone<input name="timezone" required defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} placeholder="Europe/Berlin"/>
            <span className={s.muted}>Home Assistant must use the same time zone for local schedules.</span></label>
        {error && <div role="alert" className={s.error}>{error}</div>}<button className={s.primary} disabled={busy}>Create home</button>{cancel && <button type="button" onClick={cancel}>Cancel</button>}</form>
}

function Devices({revision, writable, report}: {revision: number; writable: boolean; report: (s: string) => void}) {
    const [query, setQuery] = useState("")
    const [area, setArea] = useState("")
    const [offset, setOffset] = useState(0)
    const [busy, setBusy] = useState("")
    const [updated, setUpdated] = useState(0)
    const result = useLoad<DevicePage>(`/devices?${new URLSearchParams({q: query, area, offset: String(offset)})}`, revision + updated)
    async function act(d: Device, action: string) {
        setBusy(d.id)
        try {
            const result = await httpPost<{accepted: boolean; error: string | null}>(`/devices/${d.id}/actions`, {action})
            report(result.accepted ? "Command accepted. The device state will update when the device reports back." : result.error || "Command not confirmed.")
            setUpdated(n => n + 1)
        } catch (e) {report(errorText(e))} finally {setBusy("")}
    }
    return <><div className={s.split}>
        <label className={s.field}>Search devices<input type="search" value={query} onChange={e => {setQuery(e.target.value); setOffset(0)}} placeholder="Search by name or capability …"/></label>
        <label className={s.field}>Room<select value={area} onChange={e => {setArea(e.target.value); setOffset(0)}}><option value="">All rooms</option>
            {result?.data?.areas.map(a => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}</select></label>
    </div>{result?.error && <div role="alert" className={s.error}>{result.error}</div>}
        {!result && <p role="status">Loading devices …</p>}
        {result?.data && <><Pager offset={offset} total={result.data.total} change={setOffset}/>
            {!result.data.total && <div className={s.empty}>Device entities from your connected Home Assistant instance will appear here.<br/>Set up your local agent under Connections.</div>}
            <div className={s.grid}>{result.data.items.map(d => <article className={s.card} key={d.id}>
                <span className={s.badge}>{d.attributes.area_name || "No room"}</span><h3 style={{marginTop: 14}}>{nameOf(d)}</h3>
                {d.attributes.device_name && <div className={s.muted}>{d.attributes.device_name}</div>}
                <div className={s.value}>{!d.available || d.state === "unavailable" ? "Unavailable" : d.state === "on" ? "On" : d.state === "off" ? "Off" : `${d.state} ${d.attributes.unit_of_measurement || ""}`}</div>
                <div className={s.row}>{(d.capabilities.actions || []).filter(a => a !== "set_brightness" && a !== "set_humidity").map(a => <button key={a} disabled={!writable || !d.available || busy === d.id}
                    onClick={() => void act(d, a)}>{({turn_on: "Turn on", turn_off: "Turn off", start: "Start cleaning", pause: "Pause", return_to_base: "Return to dock"} as Record<string, string>)[a] || a}</button>)}</div>
            </article>)}</div></>}
    </>
}


function Connections({home, revision, changed, report}: {home: Home; revision: number; changed: () => void; report: (s: string) => void}) {
    const result = useLoad<Connection[]>("/connections", revision)
    const members = useLoad<{id: string; email: string; role: string}[]>(home.role === "owner" ? "/members" : null, revision)
    const [pairing, setPairing] = useState<{id: string; token: string} | null>(null)
    const [busy, setBusy] = useState(false)
    async function create(e: FormEvent<HTMLFormElement>) {
        e.preventDefault(); setBusy(true)
        const name = new FormData(e.currentTarget).get("name")
        try {setPairing(await httpPost("/connections", {name})); changed()} catch (e) {report(errorText(e))} finally {setBusy(false)}
    }
    const base = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api`
    const command = pairing ? `export SEMANTIC_HOME_AGENT_TOKEN='${pairing.token}'\nexport HA_URL='http://YOUR-HOME-ASSISTANT:8123'\n# Set HA_TOKEN locally; it stays on your local agent.\nhome-automation-agent --base-url '${base}' --id '${pairing.id}'` : ""
    return <><p className={s.muted}>A local agent connects this home to Home Assistant. Each connection has its own credentials. The Home Assistant access token stays on the local agent.</p>
        <form className={`${s.card} ${s.form}`} onSubmit={create}><h2>Connect Home Assistant</h2><label className={s.field}>Connection name<input name="name" required maxLength={100} placeholder="For example: House"/></label>
            <button className={s.primary} disabled={busy || home.role === "viewer"}>Create agent credentials</button></form>
        {pairing && <div className={s.notice}><strong>Save these credentials securely</strong><p>This key is shown only once. Set HA_TOKEN locally and start the updated agent.</p>
            <pre className={s.code}>{command}</pre><div className={s.row}><button onClick={() => void navigator.clipboard.writeText(command).then(() => report("Setup copied.")).catch(() => report("Please copy the setup instructions manually."))}>Copy setup</button><button onClick={() => setPairing(null)}>Hide key</button></div></div>}
        {result?.error && <div className={s.error}>{result.error}</div>}
        <div className={s.grid} style={{marginTop: 24}}>{result?.data?.map(c => <article className={s.card} key={c.id}><span className={s.badge}>{c.revoked ? "Access revoked" : c.connected ? "Connected" : "Offline"}{c.metadata.stub ? " · Simulation" : ""}</span><h3 style={{marginTop: 14}}>{c.name}</h3><p className={s.muted}>{c.metadata.timezone || "Waiting for Home Assistant"}{c.metadata.ha_version ? ` · HA ${c.metadata.ha_version}` : ""}</p>
            {c.metadata.timezone && c.metadata.timezone !== home.timezone && <p className={s.error}>Time zones do not match. Check the setting in Home Assistant.</p>}
            <div className={s.row}><button disabled={home.role === "viewer"} onClick={() => void httpPost<{id: string; token: string}>(`/connections/${c.id}/rotate`, {}).then(pairing => {setPairing(pairing); changed()}).catch(e => report(errorText(e)))}>Renew credentials</button>
            {!c.revoked && <button disabled={home.role === "viewer"} onClick={() => void httpDelete(`/connections/${c.id}`).then(() => {changed(); report("Access revoked. Local automations may still run: check them in Home Assistant. Renew credentials to restore this connection.")}).catch(e => report(errorText(e)))}>Revoke access</button>}</div></article>)}</div>
        {home.role === "owner" && <form style={{marginTop: 28}} className={`${s.card} ${s.form}`} onSubmit={e => {e.preventDefault(); const data = new FormData(e.currentTarget); void httpPost("/members", {user_id: data.get("user_id"), role: data.get("role")}).then(() => {changed(); report("Member added.")}).catch(e => report(errorText(e)))}}>
            <h2>Share home</h2><p className={s.muted}>Ask the intended member for their account ID from Account. An email address alone does not verify their identity here.</p><div className={s.split}><label className={s.field}>Member account ID<input name="user_id" required placeholder="Account ID from the other person"/></label><label className={s.field}>Permission<select name="role"><option value="editor">Control devices and rules</option><option value="viewer">View only</option></select></label></div><button>Add member</button>
            {members?.data?.map(member => <div className={s.row} key={member.id}><span>{member.email} · {member.role === "owner" ? "Owner" : member.role === "editor" ? "Control" : "View"}</span>{member.role !== "owner" && <button type="button" onClick={() => void httpDelete(`/members/${member.id}`).then(() => {changed(); report("Membership removed.")}).catch(e => report(errorText(e)))}>Remove access</button>}</div>)}</form>}
    </>
}


export function Workspace() {
    const location = useLocation()
    const navigate = useNavigate()
    const [user, setUser] = useState<User | null | undefined>()
    const [selected, setSelected] = useState(localStorage.getItem("semantic-home.household") || "")
    const [newHome, setNewHome] = useState(false)
    const [connectionRevision, setConnectionRevision] = useState(0)
    const [initialError, setInitialError] = useState("")
    useEffect(() => {let alive = true; void httpGet<User>("/auth/me").then(u => {if (alive) {
        const home = u.homes.find(h => h.id === localStorage.getItem("semantic-home.household")) || u.homes[0]
        if (home) localStorage.setItem("semantic-home.household", home.id)
        else localStorage.removeItem("semantic-home.household")
        setUser(u)
    }}).catch(e => {if (alive) {setUser(null); if (!(e instanceof ApiError && e.status === 401)) setInitialError(errorText(e))}}); return () => {alive = false}}, [])
    const home = user?.homes.find(h => h.id === selected) || user?.homes[0]
    useEffect(() => {if (home) localStorage.setItem("semantic-home.household", home.id)}, [home])
    if (user === undefined) return <main className={s.shell}><p role="status">Loading Semantic Home …</p></main>
    if (!user) return <>{initialError && <div role="alert" className={`${s.shell} ${s.error}`}>Could not connect to the service: {initialError}</div>}<Auth onUser={u => {setUser(u); setInitialError(""); setSelected(u.homes[0]?.id || ""); if (u.homes[0]) localStorage.setItem("semantic-home.household", u.homes[0].id); else localStorage.removeItem("semantic-home.household")}}/></>
    const selectHome = (id: string) => {
        localStorage.setItem("semantic-home.household", id); setSelected(id); setNewHome(false); setInitialError("")
    }
    const leaveSetup = () => {setNewHome(false); setInitialError("")}
    const selectDomain = (domain: DomainKey) => {leaveSetup(); navigate({pathname: "/", search: new URLSearchParams({domain}).toString()})}
    const signOut = async () => {
        await httpPost("/auth/logout", {})
        setUser(null); setSelected(""); setNewHome(false); setInitialError(""); localStorage.removeItem("semantic-home.household")
    }
    const tools = <HeaderTools key={home?.id || "no-home"} user={user} home={home} revision={connectionRevision}
        selectHome={selectHome} addHome={() => setNewHome(true)} navigate={leaveSetup} signOut={signOut}/>
    const dashboard = home && !newHome && !["/devices", "/connections", "/onboarding"].some(path => location.pathname.startsWith(path))
    if (dashboard) return <HouseholdContext.Provider value={home}><DashboardPage key={home.id} tools={tools}/></HouseholdContext.Provider>
    return <>
        <HeaderView active={null} onSelect={selectDomain} tools={tools}/>
        {(!home || newHome) ? <main className={s.shell}><NewHome cancel={home ? () => setNewHome(false) : undefined} done={created => {
            localStorage.setItem("semantic-home.household", created.id); setUser({...user, homes: [...user.homes, created]}); setSelected(created.id); setNewHome(false)
        }}/></main> : <HouseholdContext.Provider value={home}>
            {location.pathname.startsWith("/devices") ? <main className={s.shell}><h1>Device Inventory</h1><p className={s.muted}>Available device entities. Assign their roles and zone on a controller.</p><Devices key={home.id} revision={0} writable={home.role !== "viewer"} report={setInitialError}/>{initialError && <p role="status">{initialError}</p>}</main>
                : location.pathname.startsWith("/connections") ? <main className={s.shell}><Connections key={home.id} home={home} revision={connectionRevision} changed={() => setConnectionRevision(n => n + 1)} report={setInitialError}/>{initialError && <p role="status">{initialError}</p>}</main>
                : <OnboardingPage key={home.id}/>}
        </HouseholdContext.Provider>}
    </>
}
