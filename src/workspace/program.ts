import type {SemanticController, Spec} from './types.ts'

export type Anchor = {event:'clock'|'sunrise'|'sunset'|'elevation'|'elapsed'; at?:string|null; offset_minutes?:number; elevation?:number|null; direction?:'rising'|'setting'; minutes?:number|null}
export type EventTrigger = {kind:'anchor';key:string;anchor:Anchor}|{kind:'state';key:string;device_id:string;state:string}|{kind:'threshold';key:string;device_id:string;comparison:'above'|'below';value:number}
export type Condition = Group | {kind:'state';device_id:string;state:string} | {kind:'number';device_id:string;comparison:'above'|'below'|'at_least'|'at_most';value:number;max_age_seconds:number} | {kind:'trigger';key:string} | {kind:'clock';start:string;end:string}
export type Group = {kind:'all'|'any'|'not';terms:Condition[]}
export type SetStep = {kind:'set';action:'turn_on'|'turn_off'|'start'|'pause'|'return_to_base';targets:string[]|null;brightness_pct?:number|null;kelvin?:number|null;transition_seconds?:number}
export type Step = SetStep|{kind:'wait';seconds:number}|{kind:'choose';condition:Group;then:Step[];otherwise:Step[]}
export type Timing = {mode:'always'}|{mode:'window';start:Anchor;end:Anchor}|{mode:'events';triggers:EventTrigger[]}
export type BandControl = {kind:'band';sensor_ids:string[];aggregation:'maximum'|'minimum'|'average';demand:'above'|'below';lower:number;upper:number;min_cycle_seconds:number;max_age_seconds:number}
export type CurvePoint = {position:number;brightness_pct:number;kelvin:number}
export type CurveControl = {kind:'curve';driver:'sun_elevation'|'elapsed_minutes'|'measurement';solar_direction:'rising'|'setting'|'any';sensor_id?:string|null;max_age_seconds:number;color_mode:'brightness'|'white';points:CurvePoint[];evening_points?:CurvePoint[]|null;initial_brightness_pct:number;initial_kelvin:number;startup_minutes:number;respect_manual_off:boolean}
export type Control = BandControl|CurveControl|{kind:'sequence';steps:Step[]}|{kind:'switch';brightness_pct?:number|null;kelvin?:number|null}
export type Program = {version:2;timing:Timing;conditions:Group;control:Control;end_action:'hold'|'off';condition_failure:'hold'|'off';max_run_minutes:number}
export type Measurement = {value:number|null;last_reported_at:string|null;age_seconds:number|null;max_age_seconds:number;valid:boolean;issue:string|null}
export type ProgramPreview = {version:2;timezone:string;now:string;location_name:string|null;connection_name:string;connected:boolean;conditions_met:boolean;aggregate?:number|null;
    measurements:(Measurement&{id:string;name:string})[];events:{at:string;event:string}[];warnings:string[];timeline:null|{start:string;stop:string;available:boolean;driver:string;samples:{at:string;input:number;brightness_pct:number;kelvin:number}[]}}

export const clock = (at:string):Anchor => ({event:'clock',at})
export const emptyGroup = ():Group => ({kind:'all',terms:[]})
export const defaultAction = (domain:string):SetStep => ({kind:'set',action:domain==='cleaning'?'start':'turn_on',targets:null})
export const pointDefaults = [{position:-18,brightness_pct:1,kelvin:2702},{position:-12,brightness_pct:10,kelvin:3000},{position:-6,brightness_pct:45,kelvin:4000},{position:0,brightness_pct:100,kelvin:5500}]
export const blankCurve = ():CurveControl => ({kind:'curve',driver:'sun_elevation',solar_direction:'rising',color_mode:'white',max_age_seconds:1800,points:structuredClone(pointDefaults),initial_brightness_pct:1,initial_kelvin:2702,startup_minutes:10,respect_manual_off:true})

export const darkPoint = (points:CurvePoint[]) => points.reduce((low,p)=>p.position<low.position?p:low,points[0])
export function withNightBrightness(points:CurvePoint[],brightness:number):CurvePoint[] {
    const dark=darkPoint(points),day=points.reduce((high,p)=>p.position>high.position?p:high,points[0])
    return points.map(p=>({...p,brightness_pct:p===dark?brightness:p===day?day.brightness_pct:
        Math.round(Math.max(1,Math.min(100,day.brightness_pct===dark.brightness_pct?brightness:
            brightness+(p.brightness_pct-dark.brightness_pct)/(day.brightness_pct-dark.brightness_pct)*(day.brightness_pct-brightness))))}))
}
export function preset(name:string,controller:SemanticController):Program {
    const white=controller.entities.filter(d=>controller.bindings.targets.includes(d.device_id)).every(d=>d.capabilities?.color_temp?.supported)
    const curve=():CurveControl=>({...blankCurve(),color_mode:white?'white':'brightness'})
    const base:Program={version:2,timing:{mode:'events',triggers:[{kind:'anchor',key:'start',anchor:clock('08:00')}]},conditions:emptyGroup(),control:{kind:'sequence',steps:[defaultAction(controller.domain)]},end_action:'hold',condition_failure:'hold',max_run_minutes:720}
    if(name==='band') return {...base,timing:{mode:'always'},control:{kind:'band',sensor_ids:controller.bindings.sensor_ids || [],aggregation:'maximum',demand:'above',lower:52,upper:55,min_cycle_seconds:180,max_age_seconds:1800},end_action:'off',condition_failure:'off'}
    if(name==='dawn') return {...base,timing:{mode:'window',start:clock('06:00'),end:clock('12:00')},control:curve()}
    if(name==='dusk') return {...base,timing:{mode:'window',start:{event:'sunset',offset_minutes:0},end:{event:'elevation',elevation:-20,direction:'setting'}},max_run_minutes:360,
        control:{...curve(),solar_direction:'setting',initial_brightness_pct:100,initial_kelvin:5500,startup_minutes:1,points:[...structuredClone(pointDefaults).reverse().map(p=>p.position===-18?{...p,brightness_pct:5}:p),{position:-20,brightness_pct:1,kelvin:2702}]}}
    if(name==='schedule') return {...base,timing:{mode:'window',start:clock('08:00'),end:clock('22:00')},control:{kind:'switch'},end_action:'off',condition_failure:'off'}
    if(name==='cleaning') return {...base,timing:{mode:'events',triggers:[{kind:'anchor',key:'clean',anchor:clock('10:00')}]}}
    return base
}

export function fromLegacy(spec:Spec,controller:SemanticController):Program {
    if(spec.program) return structuredClone(spec.program)
    if(spec.kind==='humidity_band') {
        const p=preset('band',controller)
        p.control={kind:'band',sensor_ids:spec.sensor_ids || (spec.sensor_id?[spec.sensor_id]:[]),aggregation:'maximum',demand:'above',lower:spec.lower,upper:spec.upper,min_cycle_seconds:spec.min_cycle_seconds,max_age_seconds:spec.sensor_stale_seconds}
        if(spec.start && spec.end) p.timing={mode:'window',start:clock(spec.start),end:clock(spec.end)}
        return p
    }
    if(spec.kind==='lighting_ramp' && spec.ramp) {
        const r=spec.ramp,p=preset(r.direction==='dusk'?'dusk':'dawn',controller)
        p.timing={mode:'window',start:clock(r.start_at),end:clock(r.stop_at)}
        p.control={...blankCurve(),solar_direction:r.direction==='dusk'?'setting':'rising',initial_brightness_pct:r.initial_brightness_pct,initial_kelvin:r.direction==='dusk'?r.daylight.kelvin:r.astronomical.kelvin,startup_minutes:r.startup_minutes,color_mode:r.color_mode,
            points:[{position:-18,...r.astronomical},{position:-12,...r.nautical},{position:-6,...r.civil},{position:0,...r.daylight}]}
        p.end_action=r.off_at_end?'off':'hold'
        return p
    }
    if(spec.kind==='cleaning') return {...preset('cleaning',controller),timing:{mode:'events',triggers:[{kind:'anchor',key:'clean',anchor:clock(spec.at)}]}}
    const p=preset('schedule',controller)
    const anchor=(edge:'start'|'end'):Anchor => (spec[`${edge}_event`] || 'time')==='time'?clock(spec[edge] || (edge==='start'?'08:00':'22:00')):{event:spec[`${edge}_event`] as 'sunrise'|'sunset',offset_minutes:spec[`${edge}_offset_minutes`] || 0}
    p.timing={mode:'window',start:anchor('start'),end:anchor('end')}
    if(p.control.kind==='switch') p.control.brightness_pct=spec.brightness_pct
    return p
}

export function anchorText(a:Anchor) {
    if(a.event==='clock') return a.at || 'Choose a time'
    if(a.event==='elapsed') return `${a.minutes} min after start`
    if(a.event==='elevation') return `${a.elevation}° ${a.direction==='rising'?'rising':'setting'} sun`
    const offset=a.offset_minutes || 0
    return offset?`${Math.abs(offset)} min ${offset<0?'before':'after'} ${a.event}`:a.event
}
export function briefLightingRule(program:Program) {
    const t=program.timing,c=program.control
    if(c.kind!=='curve'||t.mode!=='window')return null
    const when=(a:Anchor)=>a.event==='elevation'?`${a.elevation===-20?'after astronomical twilight':a.elevation===-18?'at the end of astronomical twilight':a.elevation===-12?'at nautical twilight':a.elevation===-6?'at civil twilight':`at ${a.elevation}° sun`} (${a.direction==='rising'?'morning':'evening'})`:`at ${anchorText(a)}`
    const ordered=[...c.points].sort((a,b)=>a.position-b.position)
    const natural=ordered[0].brightness_pct<ordered.at(-1)!.brightness_pct&&ordered.every((p,i)=>i===0||p.brightness_pct>=ordered[i-1].brightness_pct)
    const effect=c.driver==='sun_elevation'?(c.evening_points?'Follow separate morning and evening curves':!natural?'Follow the custom daylight curve':c.solar_direction==='setting'?'Dim with the evening light':c.solar_direction==='rising'?'Brighten with the morning light':'Follow morning and evening light'):c.driver==='elapsed_minutes'?'Change gradually after switch-on':'Adjust to the selected sensor'
    const evening=c.evening_points||c.points,night=darkPoint(evening)
    const resting=c.driver==='sun_elevation'&&c.solar_direction!=='rising'?` At ${night.position}° evening sun, the curve reaches ${night.brightness_pct}% and holds beyond that point.`:''
    return `Switch on ${when(t.start)} at ${c.initial_brightness_pct}%. ${effect}.${resting} ${when(t.end)[0].toUpperCase()+when(t.end).slice(1)}, ${program.end_action==='off'?'switch off':'stop adjusting and keep the last level'}.`
}

export function programText(p:Program) {
    const lighting=briefLightingRule(p)
    if(lighting)return lighting
    const c=p.control,t=p.timing
    const timing=t.mode==='always'?'All day':t.mode==='window'?`${anchorText(t.start)} → ${anchorText(t.end)}`:`${t.triggers.length} event${t.triggers.length===1?'':'s'}`
    return `${c.kind==='band'?`Maintain ${c.lower}–${c.upper} · ${c.aggregation} measurement`:c.kind==='curve'?`Follow ${c.driver.replaceAll('_',' ')} · ${c.points.length} curve points`:c.kind==='switch'?'Switch while active':`${c.steps.length} action step${c.steps.length===1?'':'s'}`} · ${timing}`
}
export function programDescription(p:Program,names:Record<string,string>={}) {
    const device=(id:string)=>names[id]||'the selected input'
    const condition=(x:Condition):string=>'terms' in x?x.terms.length?`(${x.kind==='not'?'not ':''}${x.terms.map(condition).join(x.kind==='any'?' or ':' and ')})`:'no extra condition':
        x.kind==='clock'?`the local time is ${x.start}–${x.end}`:x.kind==='trigger'?`event ${p.timing.mode==='events'?p.timing.triggers.findIndex(t=>t.key===x.key)+1:'?'} started this run`:
        x.kind==='state'?`${device(x.device_id)} is ${x.state}`:`${device(x.device_id)} is ${{above:'above',below:'below',at_least:'at least',at_most:'at most'}[x.comparison]} ${x.value}`
    const steps=(items:Step[]):string=>items.map(x=>x.kind==='wait'?`wait ${x.seconds} seconds`:x.kind==='choose'?`if ${condition(x.condition)}, ${steps(x.then)}${x.otherwise.length?`; otherwise ${steps(x.otherwise)}`:''}`:
        `${{turn_on:'switch on',turn_off:'switch off',start:'start cleaning',pause:'pause cleaning',return_to_base:'return to dock'}[x.action]}${x.targets?` (${x.targets.map(id=>names[id]||'selected output').join(', ')})`:''}${x.brightness_pct!=null?` at ${x.brightness_pct}%`:''}${x.kelvin!=null?` and ${x.kelvin} K`:''}${x.transition_seconds?` with a ${x.transition_seconds}-second fade`:''}`).join('; then ')
    const t=p.timing,c=p.control
    const when=t.mode==='always'?'On the selected days, all day':t.mode==='window'?`From ${anchorText(t.start)} until ${anchorText(t.end)} on the selected start days`:
        `When ${t.triggers.map(x=>x.kind==='anchor'?anchorText(x.anchor):x.kind==='state'?`${device(x.device_id)} changes to ${x.state}`:`${device(x.device_id)} crosses ${x.comparison} ${x.value}`).join(' or ')}`
    const behaviour=c.kind==='sequence'?steps(c.steps):c.kind==='switch'?'keep the outputs on':c.kind==='curve'?`start at ${c.initial_brightness_pct}% and follow the editable ${c.driver.replaceAll('_',' ')} curve${c.respect_manual_off?', respecting a manual switch-off':''}`:
        `use the ${c.aggregation} of ${c.sensor_ids.length} measurement${c.sensor_ids.length===1?'':'s'}: switch on at ${c.demand==='above'?`${c.upper} or above`:`${c.lower} or below`}, and off at ${c.demand==='above'?`${c.lower} or below`:`${c.upper} or above`}; keep the current state between those values. Missing or stale measurements force off`
    return `${when}, ${behaviour}.${p.conditions.terms.length?` Only if ${condition(p.conditions)}.`:''}${c.kind!=='sequence'?` At the end, ${p.end_action==='off'?'force the outputs off':'leave their last state'}.`:''}`
}
export function anchorValid(a:Anchor) {
    if(a.event==='clock') return /^([01]\d|2[0-3]):[0-5]\d$/.test(a.at || '')
    if(a.event==='elapsed') return Number.isInteger(a.minutes) && a.minutes!>=1 && a.minutes!<=1440
    if(a.event==='elevation') return Number.isFinite(a.elevation) && a.elevation!>=-89 && a.elevation!<=89
    return Number.isInteger(a.offset_minutes || 0) && Math.abs(a.offset_minutes || 0)<=180
}
export function programValid(p:Program) {
    const c=p.control,t=p.timing
    const inRange=(n:number,min:number,max:number,integer=false)=>Number.isFinite(n)&&n>=min&&n<=max&&(!integer||Number.isInteger(n))
    const time=(at:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(at)
    const optional=(n:number|null|undefined,min:number,max:number)=>n==null||inRange(n,min,max,true)
    const curvePointsValid=(points:CurvePoint[])=>points.length>=2&&points.length<=16&&new Set(points.map(x=>x.position)).size===points.length&&points.every(x=>Number.isFinite(x.position)&&inRange(x.brightness_pct,1,100,true)&&inRange(x.kelvin,1000,10000,true)&&(c.kind!=='curve'||c.driver==='measurement'||inRange(x.position,c.driver==='sun_elevation'?-90:0,c.driver==='sun_elevation'?90:1440)))
    const keys=t.mode==='events'?new Set(t.triggers.map(x=>x.key)):new Set<string>()
    const cond=(g:Group):boolean => g.terms.length<=16&&(g.kind!=='not'||g.terms.length===1)&&(g.kind!=='any'||!!g.terms.length)&&g.terms.every(x=>
        'terms' in x?cond(x):x.kind==='trigger'?keys.has(x.key):x.kind==='clock'?time(x.start)&&time(x.end)&&x.start!==x.end:
        !!x.device_id&&(x.kind==='state'?!!x.state.trim():Number.isFinite(x.value)&&inRange(x.max_age_seconds,60,86400,true)))
    const step=(s:Step):boolean => s.kind==='wait'?inRange(s.seconds,1,86400,true):s.kind==='choose'?cond(s.condition)&&!!s.then.length&&s.then.length<=32&&s.otherwise.length<=32&&[...s.then,...s.otherwise].every(step):
        (s.targets===null||!!s.targets.length)&&optional(s.brightness_pct,1,100)&&optional(s.kelvin,1000,10000)&&inRange(s.transition_seconds||0,0,3600,true)
    const duration=(steps:Step[]):number=>steps.reduce((n,s)=>n+(s.kind==='wait'?s.seconds:s.kind==='choose'?Math.max(duration(s.then),duration(s.otherwise)):0),0)
    const timing=t.mode==='always'||(t.mode==='window'?anchorValid(t.start)&&anchorValid(t.end)&&t.start.event!=='elapsed'&&JSON.stringify(t.start)!==JSON.stringify(t.end):
        !!t.triggers.length&&t.triggers.length<=16&&keys.size===t.triggers.length&&t.triggers.every(x=>/^[a-zA-Z0-9_-]{1,40}$/.test(x.key)&&(x.kind==='anchor'?anchorValid(x.anchor)&&x.anchor.event!=='elapsed':!!x.device_id&&(x.kind==='state'?!!x.state.trim():Number.isFinite(x.value)))))
    const control=c.kind==='band'?!!c.sensor_ids.length&&new Set(c.sensor_ids).size===c.sensor_ids.length&&Number.isFinite(c.lower)&&Number.isFinite(c.upper)&&c.lower<c.upper&&inRange(c.min_cycle_seconds,0,86400,true)&&inRange(c.max_age_seconds,60,86400,true):
        c.kind==='curve'?curvePointsValid(c.points)&&(!c.evening_points||(c.driver==='sun_elevation'&&c.solar_direction==='any'&&curvePointsValid(c.evening_points)))&&inRange(c.initial_brightness_pct,1,100,true)&&inRange(c.initial_kelvin,1000,10000,true)&&inRange(c.startup_minutes,0,120,true)&&inRange(c.max_age_seconds,60,86400,true)&&(c.driver!=='measurement'||!!c.sensor_id):
        c.kind==='switch'?optional(c.brightness_pct,1,100)&&optional(c.kelvin,1000,10000):!!c.steps.length&&c.steps.length<=32&&c.steps.every(step)&&duration(c.steps)<=p.max_run_minutes*60
    return timing&&cond(p.conditions)&&control&&inRange(p.max_run_minutes,1,1440,true)
}
