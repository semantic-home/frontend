import {useEffect, useState} from 'react'
import type {FormEvent} from 'react'
import {httpPost, httpPut} from '../api/http.ts'
import type {Automation, Home, Preview, SemanticController, Spec} from './types.ts'
import type {Anchor, BandControl, Condition, Control, CurveControl, EventTrigger, Group, Program, SetStep, Step, Timing} from './program.ts'
import {anchorText, blankCurve, briefLightingRule, clock, defaultAction, emptyGroup, fromLegacy, preset, programDescription, programValid} from './program.ts'
import {DevicePicker} from './DevicePicker.tsx'
import {errorText} from './shared.ts'
import s from './Workspace.module.css'
import c from './ProgramEditor.module.css'

const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const actionNames:Record<SetStep['action'],string>={turn_on:'Switch on',turn_off:'Switch off',start:'Start cleaning',pause:'Pause cleaning',return_to_base:'Return to dock'}
type Context={controller:SemanticController;triggers:EventTrigger[]}

function NumberField({label,value,change,min,max,step=1}:{label:string;value:number;change:(n:number)=>void;min?:number;max?:number;step?:number}) {
    return <label className={s.field}>{label}<input type="number" required value={Number.isFinite(value)?value:''} min={min} max={max} step={step} onChange={e=>change(e.target.value===''?NaN:Number(e.target.value))}/></label>
}

export function AnchorEditor({label,value,change,end=false}:{label:string;value:Anchor;change:(a:Anchor)=>void;end?:boolean}) {
    const choose=(event:Anchor['event'])=>change(event==='clock'?clock(end?'22:00':'06:00'):event==='elevation'?{event,elevation:end?-20:-18,direction:end?'setting':'rising'}:event==='elapsed'?{event,minutes:60}:{event,offset_minutes:0})
    const phases=[[-6,'Civil twilight'],[-12,'Nautical twilight'],[-18,'End of astronomical twilight'],[-20,'After astronomical twilight']] as const
    return <fieldset className={c.anchor}><legend>{label}</legend>
        <label className={s.field}>{label} at<select value={value.event} onChange={e=>choose(e.target.value as Anchor['event'])}>
            <option value="clock">A clock time</option><option value="sunrise">Sunrise</option><option value="sunset">Sunset</option><option value="elevation">A twilight phase</option>{end&&<option value="elapsed">After a duration</option>}
        </select></label>
        {value.event==='clock'?<label className={s.field}>{label} time<input type="time" required value={value.at || ''} onChange={e=>change({...value,at:e.target.value})}/></label>
            :value.event==='elapsed'?<NumberField label={`${label} after (minutes)`} min={1} max={1440} value={value.minutes || 0} change={minutes=>change({...value,minutes})}/>
            :value.event==='elevation'?<><label className={s.field}>{label} twilight phase<select value={String(value.elevation)} onChange={e=>change({...value,elevation:Number(e.target.value)})}>
                {phases.map(([angle,name])=><option key={angle} value={angle}>{name}</option>)}{!phases.some(([angle])=>angle===value.elevation)&&<option value={String(value.elevation)}>Custom · {value.elevation}°</option>}
            </select></label><label className={s.field}>{label} part of day<select value={value.direction || 'setting'} onChange={e=>change({...value,direction:e.target.value as 'rising'|'setting'})}><option value="rising">Morning</option><option value="setting">Evening</option></select></label>
                <details className={c.details}><summary>Use a custom sun angle</summary><NumberField label={`${label} sun elevation (°)`} min={-89} max={89} step={0.1} value={value.elevation || 0} change={elevation=>change({...value,elevation})}/><p className={s.muted}>Civil −6° · nautical −12° · astronomical −18°. Lower evening angles happen later.</p></details></>
                :<details className={c.details}><summary>Adjust timing · {value.offset_minutes?anchorText(value):'at the event'}</summary><NumberField label={`${label} offset (minutes)`} min={-180} max={180} value={value.offset_minutes || 0} change={offset_minutes=>change({...value,offset_minutes})}/><p className={s.muted}>Negative = before · positive = after.</p></details>}
    </fieldset>
}

function InputPicker({value,change,context,label='Input entity',numeric=false,multiple=false}:{value:string[];change:(v:string[])=>void;context:Context;label?:string;numeric?:boolean;multiple?:boolean}) {
    return <DevicePicker capability={numeric?'measurement':''} selected={value} change={change} multiple={multiple} agentId={context.controller.agent_id} title={label}/>
}

function TriggerEditor({value,change,remove,context,index}:{value:EventTrigger;change:(t:EventTrigger)=>void;remove:()=>void;context:Context;index:number}) {
    return <fieldset className={c.block}><legend>Event {index+1}</legend><div className={s.row}>
        <label className={s.field}>Event type<select value={value.kind} onChange={e=>change(e.target.value==='anchor'?{kind:'anchor',key:value.key,anchor:clock('08:00')}:e.target.value==='state'?{kind:'state',key:value.key,device_id:'',state:'on'}:{kind:'threshold',key:value.key,device_id:'',comparison:'above',value:55})}>
            <option value="anchor">Time or solar event</option><option value="state">Entity changes to a state</option><option value="threshold">Measurement crosses a threshold</option></select></label>
        <button type="button" onClick={remove}>Remove event</button></div>
        {value.kind==='anchor'?<AnchorEditor label={`Event ${index+1}`} value={value.anchor} change={anchor=>change({...value,anchor})}/>:<>
            <InputPicker context={context} value={value.device_id?[value.device_id]:[]} change={v=>change({...value,device_id:v[0] || ''})} numeric={value.kind==='threshold'}/>
            {value.kind==='state'?<label className={s.field}>Changes to state<input required value={value.state} onChange={e=>change({...value,state:e.target.value})} placeholder="on, off, home, open …"/></label>:<div className={s.split}>
                <label className={s.field}>Crossing direction<select value={value.comparison} onChange={e=>change({...value,comparison:e.target.value as 'above'|'below'})}><option value="above">Crosses above</option><option value="below">Crosses below</option></select></label>
                <NumberField label="Threshold (entity units)" step={0.1} value={value.value} change={n=>change({...value,value:n})}/></div>}
        </>}
    </fieldset>
}

function conditionDefault(kind:Condition['kind'],context:Context):Condition {
    if(kind==='all'||kind==='any'||kind==='not') return {kind,terms:kind==='all'?[]:[{kind:'state',device_id:'',state:'on'}]}
    if(kind==='clock') return {kind,start:'08:00',end:'22:00'}
    if(kind==='trigger') return {kind,key:context.triggers[0]?.key || ''}
    return kind==='state'?{kind,device_id:'',state:'on'}:{kind:'number',device_id:'',comparison:'above',value:0,max_age_seconds:1800}
}

function ConditionEditor({value,change,context,depth=0}:{value:Group;change:(v:Group)=>void;context:Context;depth?:number}) {
    const update=(i:number,next:Condition)=>change({...value,terms:value.terms.map((v,n)=>n===i?next:v)})
    const add=(kind:Condition['kind'])=>change({...value,terms:[...value.terms,conditionDefault(kind,context)]})
    return <div className={c.conditions}>
        <label className={s.field}>Match conditions<select value={value.kind} onChange={e=>{const kind=e.target.value as Group['kind'];change({kind,terms:kind==='not'?(value.terms.length===1?value.terms:[{kind:'all',terms:value.terms}]):value.terms})}}><option value="all">All of these</option><option value="any">Any of these</option><option value="not">Not this condition/group</option></select></label>
        {!value.terms.length&&<p className={s.muted}>No extra conditions.</p>}
        {value.terms.map((item,i)=><div className={c.condition} key={i}><div className={c.conditionHeader}>
            <label className={s.field}>Condition {i+1}<select value={item.kind==='all'||item.kind==='any'||item.kind==='not'?'group':item.kind} onChange={e=>update(i,conditionDefault(e.target.value==='group'?'all':e.target.value as Condition['kind'],context))}>
                <option value="state">Entity state</option><option value="number">Numeric comparison</option><option value="clock">Within clock hours</option>{context.triggers.length>0&&<option value="trigger">Started by event</option>}<option value="group">Condition group</option></select></label>
            <button type="button" onClick={()=>change({...value,terms:value.terms.filter((_,n)=>n!==i)})}>Remove condition</button></div>
            {'terms' in item?<ConditionEditor value={item} context={context} change={next=>update(i,next)} depth={depth+1}/>:item.kind==='clock'?<div className={s.split}>
                <label className={s.field}>Condition from<input required type="time" value={item.start} onChange={e=>update(i,{...item,start:e.target.value})}/></label><label className={s.field}>Condition until<input required type="time" value={item.end} onChange={e=>update(i,{...item,end:e.target.value})}/></label></div>
                :item.kind==='trigger'?<label className={s.field}>Started by<select required value={item.key} onChange={e=>update(i,{...item,key:e.target.value})}><option value="">Choose an event</option>{context.triggers.map((t,n)=><option key={t.key} value={t.key}>Event {n+1} · {t.kind==='anchor'?anchorText(t.anchor):t.kind==='state'?`state → ${t.state}`:`crosses ${t.comparison} ${t.value}`}</option>)}</select></label>:<>
                    <InputPicker context={context} numeric={item.kind==='number'} value={item.device_id?[item.device_id]:[]} change={ids=>update(i,{...item,device_id:ids[0] || ''})}/>
                    {item.kind==='state'?<label className={s.field}>Required state<input required value={item.state} onChange={e=>update(i,{...item,state:e.target.value})}/></label>:<>
                        <div className={s.split}><label className={s.field}>Comparison<select value={item.comparison} onChange={e=>update(i,{...item,comparison:e.target.value as 'above'|'below'|'at_least'|'at_most'})}><option value="above">Above</option><option value="below">Below</option><option value="at_least">At least</option><option value="at_most">At most</option></select></label>
                            <NumberField label="Condition value (entity units)" step={0.1} value={item.value} change={n=>update(i,{...item,value:n})}/></div>
                        <NumberField label="Condition measurement age limit (minutes)" min={1} max={1440} value={item.max_age_seconds/60} change={n=>update(i,{...item,max_age_seconds:n*60})}/>
                    </>}
                </>}
        </div>)}
        {(value.kind!=='not'||value.terms.length===0)&&value.terms.length<16&&<div className={s.row}>
            <button type="button" onClick={()=>add('state')}>+ State condition</button><button type="button" onClick={()=>add('number')}>+ Numeric condition</button>{depth<3&&<button type="button" onClick={()=>add('all')}>+ Group</button>}
        </div>}
    </div>
}

function StepEditor({value,change,context,depth=0}:{value:Step[];change:(v:Step[])=>void;context:Context;depth?:number}) {
    const update=(i:number,next:Step)=>change(value.map((v,n)=>n===i?next:v))
    const outputs=context.controller.entities.filter(d=>context.controller.bindings.targets.includes(d.device_id))
    const selectedOutputs=(step:SetStep)=>outputs.filter(d=>step.targets===null||step.targets.includes(d.device_id))
    const move=(i:number,direction:number)=>{const next=[...value];[next[i],next[i+direction]]=[next[i+direction],next[i]];change(next)}
    return <div className={c.steps}>{value.map((step,i)=><fieldset className={c.block} key={i}><legend>Step {i+1} · {step.kind==='set'?'Action':step.kind==='wait'?'Wait':'Choose'}</legend>
        <div className={s.row}><button type="button" disabled={!i} onClick={()=>move(i,-1)}>Move up</button><button type="button" disabled={i===value.length-1} onClick={()=>move(i,1)}>Move down</button><button type="button" onClick={()=>change(value.filter((_,n)=>n!==i))}>Remove step</button></div>
        {step.kind==='wait'?<NumberField label="Wait (seconds)" min={1} max={86400} value={step.seconds} change={seconds=>update(i,{...step,seconds})}/>:step.kind==='choose'?<>
            <p className={c.partLabel}>If</p><ConditionEditor context={context} value={step.condition} change={condition=>update(i,{...step,condition})}/>
            <p className={c.partLabel}>Then</p><StepEditor context={context} value={step.then} change={then=>update(i,{...step,then})} depth={depth+1}/>
            <p className={c.partLabel}>Otherwise</p><StepEditor context={context} value={step.otherwise} change={otherwise=>update(i,{...step,otherwise})} depth={depth+1}/>
        </>:<>
            <label className={s.field}>Action targets<select value={step.targets===null?'all':'selected'} onChange={e=>update(i,{...step,targets:e.target.value==='all'?null:[outputs[0]?.device_id].filter(Boolean)})}><option value="all">All outputs assigned to this controller</option><option value="selected">Choose outputs from this controller</option></select></label>
            {step.targets!==null&&<div className={s.chips}>{outputs.map(d=><label key={d.device_id} className={c.check}><input type="checkbox" checked={step.targets!.includes(d.device_id)} onChange={e=>update(i,{...step,targets:e.target.checked?[...step.targets!,d.device_id]:step.targets!.filter(id=>id!==d.device_id)})}/>{d.name}</label>)}</div>}
            <label className={s.field}>Action<select value={step.action} onChange={e=>update(i,{kind:'set',targets:step.targets,action:e.target.value as SetStep['action']})}>
                {(Object.keys(actionNames) as SetStep['action'][]).filter(action=>selectedOutputs(step).every(d=>d.capabilities?.actions?.includes(action))).map(action=><option key={action} value={action}>{actionNames[action]}</option>)}
            </select></label>
            {step.action==='turn_on'&&<div className={s.split}>
                {selectedOutputs(step).every(d=>d.capabilities?.brightness?.supported)&&<label className={s.field}>Brightness (optional, %)<input type="number" min={1} max={100} value={step.brightness_pct??''} placeholder="Keep current level" onChange={e=>update(i,{...step,brightness_pct:e.target.value?Number(e.target.value):null})}/></label>}
                {selectedOutputs(step).every(d=>d.capabilities?.color_temp?.supported)&&<label className={s.field}>White temperature (optional, K)<input type="number" min={1000} max={10000} value={step.kelvin??''} placeholder="Keep current white" onChange={e=>update(i,{...step,kelvin:e.target.value?Number(e.target.value):null})}/></label>}
                {selectedOutputs(step).every(d=>d.capabilities?.transition)&&<NumberField label="Native fade (seconds)" min={0} max={3600} value={step.transition_seconds || 0} change={transition_seconds=>update(i,{...step,transition_seconds})}/>}
            </div>}
        </>}
    </fieldset>)}
        {value.length<32&&<div className={s.row}><button type="button" onClick={()=>change([...value,defaultAction(context.controller.domain)])}>+ Action</button><button type="button" onClick={()=>change([...value,{kind:'wait',seconds:60}])}>+ Wait</button>{depth<3&&<button type="button" onClick={()=>change([...value,{kind:'choose',condition:emptyGroup(),then:[defaultAction(context.controller.domain)],otherwise:[]}])}>+ Choice</button>}</div>}
    </div>
}

function BandFields({value,change,context}:{value:BandControl;change:(v:BandControl)=>void;context:Context}) {
    return <><InputPicker label="Measurements to combine" context={context} numeric multiple value={value.sensor_ids} change={sensor_ids=>change({...value,sensor_ids})}/>
        <div className={s.split}><label className={s.field}>Combine measurements<select value={value.aggregation} onChange={e=>change({...value,aggregation:e.target.value as BandControl['aggregation']})}><option value="maximum">Highest reading</option><option value="minimum">Lowest reading</option><option value="average">Average reading</option></select></label>
            <label className={s.field}>Run outputs when<select value={value.demand} onChange={e=>change({...value,demand:e.target.value as 'above'|'below'})}><option value="above">The measurement is too high</option><option value="below">The measurement is too low</option></select></label></div>
        <div className={s.split}><NumberField label="Lower threshold (sensor units)" step={0.1} value={value.lower} change={lower=>change({...value,lower})}/><NumberField label="Upper threshold (sensor units)" step={0.1} value={value.upper} change={upper=>change({...value,upper})}/></div>
        <p className={s.muted}>Between the thresholds, keep the current state. {value.demand==='above'?`Switch on at ${value.upper} or above, off at ${value.lower} or below.`:`Switch on at ${value.lower} or below, off at ${value.upper} or above.`} All selected measurements must be fresh and use the same units.</p>
        <details className={c.details}><summary>Sensor reporting and switching protection</summary><div className={s.split}><NumberField label="Minimum switching interval (seconds)" min={0} max={86400} value={value.min_cycle_seconds} change={min_cycle_seconds=>change({...value,min_cycle_seconds})}/>
            <NumberField label="Maximum measurement age (minutes)" min={1} max={1440} value={value.max_age_seconds/60} change={n=>change({...value,max_age_seconds:n*60})}/></div>
        <p className={s.muted}>This age limit must exceed the sensors’ normal reporting interval. A stale measurement forces the outputs off, even when the other readings still call for running.</p></details>
    </>
}

function SharedDaylightCurve({value}:{value:CurveControl}) {
    const points=value.points.filter(p=>Number.isFinite(p.position)&&Number.isFinite(p.brightness_pct)).sort((a,b)=>a.position-b.position)
    const low=points[0]?.position||0,span=(points.at(-1)?.position||0)-low||1
    return <section className={c.sharedCurve} aria-label="Shared morning and evening curve">
        <strong>One shared curve for morning and evening</strong>
        <p>Changing a point changes both periods. The morning follows these points as the sun rises; the evening follows the same points in reverse as the sun sets.</p>
        <div className={c.sharedDirections}>{(['Morning','Evening'] as const).map(period=>{
            const ordered=period==='Morning'?points:[...points].reverse()
            const x=(position:number)=>12+(period==='Morning'?(position-low)/span:1-(position-low)/span)*156
            const path=ordered.map((point,i)=>`${i?'L':'M'}${x(point.position)},${58-point.brightness_pct*.5}`).join(' ')
            return <figure key={period}><figcaption>{period} · sun {period==='Morning'?'rising':'setting'}</figcaption>
                <svg viewBox="0 0 180 68" role="img" aria-label={`${period} curve: ${ordered.map(p=>p.brightness_pct+'%').join(' → ')}`}><path d={path}/>{ordered.map((point,i)=><circle key={i} cx={x(point.position)} cy={58-point.brightness_pct*.5} r="3"/>)}</svg>
                <p className={c.readout}>{ordered.map(p=>p.brightness_pct+'%').join(' → ')}</p>
            </figure>
        })}</div>
        <small>Curve shape, not a clock schedule. The local-time preview below includes your start, switch-on level and end time.</small>
    </section>
}

function CurveFields({value,change,context}:{value:CurveControl;change:(v:CurveControl)=>void;context:Context}) {
    const outputs=context.controller.entities.filter(d=>context.controller.bindings.targets.includes(d.device_id))
    const point=(i:number,patch:Partial<CurveControl['points'][number]>)=>change({...value,points:value.points.map((p,n)=>n===i?{...p,...patch}:p)})
    return <><label className={s.field}>Change the lights with<select value={value.driver} onChange={e=>{const driver=e.target.value as CurveControl['driver'];change({...value,driver,sensor_id:driver==='measurement'?'':null,points:driver==='sun_elevation'?blankCurve().points:[{position:0,brightness_pct:1,kelvin:2702},{position:60,brightness_pct:100,kelvin:5500}]})}}>
            <option value="sun_elevation">Natural daylight</option><option value="elapsed_minutes">Time since switch-on</option><option value="measurement">A sensor reading</option></select></label>
        {value.driver==='sun_elevation'&&<label className={s.field}>Daylight pattern<select value={value.solar_direction} onChange={e=>change({...value,solar_direction:e.target.value as CurveControl['solar_direction']})}><option value="rising">Morning (dawn)</option><option value="setting">Evening (dusk)</option><option value="any">Morning and evening</option></select></label>}
        {value.driver==='sun_elevation'&&value.solar_direction==='any'&&<SharedDaylightCurve value={value}/>}
        {value.driver==='measurement'&&<><InputPicker context={context} label="Curve measurement" numeric value={value.sensor_id?[value.sensor_id]:[]} change={ids=>change({...value,sensor_id:ids[0] || ''})}/><NumberField label="Curve measurement age limit (minutes)" min={1} max={1440} value={value.max_age_seconds/60} change={n=>change({...value,max_age_seconds:n*60})}/></>}
        <NumberField label="Brightness at switch-on (%)" min={1} max={100} value={value.initial_brightness_pct} change={initial_brightness_pct=>change({...value,initial_brightness_pct})}/>
        <p className={c.hint}>This rule switches the lights on at its start and can switch them off at its end. A separate on/off rule is not needed.</p>
        <details className={c.details}><summary>{value.driver==='sun_elevation'&&value.solar_direction==='any'?'Edit shared morning & evening curve':'Fine-tune the light'} · {value.points.length} curve points</summary><div className={c.advancedBody}>
        <label className={s.field}>Adjust<select value={value.color_mode} onChange={e=>change({...value,color_mode:e.target.value as CurveControl['color_mode']})}><option value="brightness">Brightness only</option>{outputs.every(d=>d.capabilities?.color_temp?.supported)&&<option value="white">Brightness and white temperature</option>}</select></label>
        <div className={s.split}>{value.color_mode==='white'&&<NumberField label="White temperature at switch-on (K)" min={1000} max={10000} value={value.initial_kelvin} change={initial_kelvin=>change({...value,initial_kelvin})}/>}
            <NumberField label="Blend into the curve over (minutes)" min={0} max={120} value={value.startup_minutes} change={startup_minutes=>change({...value,startup_minutes})}/></div>
        <div className={c.curvePoints}>{value.points.map((p,i)=><fieldset className={c.point} key={i}><legend>Point {i+1}</legend>
            <NumberField label={value.driver==='sun_elevation'?`Point ${i+1} sun elevation (°)`:value.driver==='elapsed_minutes'?`Point ${i+1} elapsed minutes`:`Point ${i+1} sensor value`} step={0.1} value={p.position} change={position=>point(i,{position})}/>
            <NumberField label={`Point ${i+1} brightness (%)`} min={1} max={100} value={p.brightness_pct} change={brightness_pct=>point(i,{brightness_pct})}/>
            {value.color_mode==='white'&&<NumberField label={`Point ${i+1} white (K)`} min={1000} max={10000} value={p.kelvin} change={kelvin=>point(i,{kelvin})}/>}<button type="button" disabled={value.points.length<=2} onClick={()=>change({...value,points:value.points.filter((_,n)=>n!==i)})}>Remove point</button>
        </fieldset>)}</div>
        <button type="button" disabled={value.points.length>=16} onClick={()=>{let position=value.points.at(-1)!.position+(value.solar_direction==='setting'?-2:6);while(value.points.some(p=>p.position===position)) position+=1;change({...value,points:[...value.points,{position,brightness_pct:1,kelvin:2702}]})}}>+ Curve point</button>
        <p className={s.muted}>Values blend between points and hold at the nearest endpoint outside the range. Brightness can rise, fall or do both. White temperature is clamped to each lamp’s supported range.</p>
        <label className={c.check}><input type="checkbox" checked={value.respect_manual_off} onChange={e=>change({...value,respect_manual_off:e.target.checked})}/>Respect a manual switch-off until the next start</label></div></details>
    </>
}

function PreviewPanel({preview,timezone,showWhite}:{preview:Preview;timezone:string;showWhite:boolean}) {
    const p=preview.program
    const [sample,setSample]=useState(0)
    if(!p) return null
    const clockAt=(at:string)=>new Date(at).toLocaleTimeString('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',timeZoneName:'short'})
    const timeline=p.timeline, samples=timeline?.samples || [], selected=samples[Math.min(sample,samples.length-1)]
    const from=timeline?new Date(timeline.start).getTime():0,to=timeline?new Date(timeline.stop).getTime():1
    const x=(at:string)=>(new Date(at).getTime()-from)/(to-from || 1)*460
    const path=samples.map((pt,i)=>`${i?'L':'M'}${x(pt.at).toFixed(1)},${120-pt.brightness_pct*1.2}`).join(' ')
    const executionNotes=p.warnings.filter(w=>w.startsWith('This event window')||w.startsWith('Control stops')||w.startsWith('Event rules run'))
    const warnings=p.warnings.filter(w=>!executionNotes.includes(w))
    const messages:Record<string,string>={outside_window:'Outside the permitted hours',sensor_unavailable:'A selected reading is missing or stale',upper_threshold:'Upper threshold reached',lower_threshold:'Lower threshold reached',condition_not_met:'An extra condition is not satisfied',keep_state:'Keep the current state between thresholds',program_event:'Runs at the selected event',time_window:'Window determines the output'}
    return <section className={c.preview} aria-label="Rule preview" aria-live="polite"><h3>Preview · no device commands</h3>
        <p className={s.muted}>{p.connection_name} · {p.location_name || 'Home location not reported'} · {timezone}<br/>Conditions now: {p.conditions_met?'satisfied':'not satisfied, or waiting for an event'}</p>
        {timeline?.available&&samples.length>0&&<><div className={c.plot}><svg viewBox="-36 -10 510 155" role="img" aria-label="Brightness over the rule’s local time window" preserveAspectRatio="xMidYMid meet">
            {[0,50,100].map(v=><g key={v}><text x={-8} y={124-v*1.2} textAnchor="end">{v}%</text><line x1="0" x2="460" y1={120-v*1.2} y2={120-v*1.2}/></g>)}
            <path d={path}/><text x="0" y="143">{clockAt(timeline.start)}</text><text x="460" y="143" textAnchor="end">{clockAt(timeline.stop)}</text>
        </svg></div><label className={s.field}>Explore the curve<input type="range" min={0} max={samples.length-1} value={Math.min(sample,samples.length-1)} onChange={e=>setSample(Number(e.target.value))}/></label>
            {selected&&<p className={c.readout}><strong>{clockAt(selected.at)}</strong> · {selected.brightness_pct===0?'Switch off':`${selected.brightness_pct}% brightness${showWhite?` · ${selected.kelvin} K`: ''}`}</p>}</>}
        {p.events.length>0&&<ol className={c.events}>{p.events.slice(0,6).map((event,i)=><li key={`${event.at}-${i}`}><span>{event.event}</span><strong>{new Date(event.at).toLocaleDateString('en-GB',{timeZone:timezone,day:'numeric',month:'short'})} · {clockAt(event.at)}</strong></li>)}</ol>}
        {p.measurements.map(m=><p key={m.id} className={m.valid?s.muted:s.error}>{m.name}: {m.value??'No numeric value'} · {m.age_seconds===null?'Report time unknown':`${Math.floor(m.age_seconds/60)} min old`} · {m.valid?'Fresh':m.issue==='stale'?'Stale — cannot use this reading':'Unavailable or invalid'} (limit {m.max_age_seconds/60} min)</p>)}
        {preview.items.map(item=><p key={item.id}><strong>{item.name}</strong> · {item.desired==='scheduled'?'Scheduled':item.desired==='on'?'On':item.desired==='off'?'Off':item.desired} · {messages[item.reason] || item.reason}</p>)}
        {warnings.map(w=><p className={s.notice} key={w}>{w}</p>)}
        {executionNotes.length>0&&<details className={c.details}><summary>Execution and restart details</summary>{executionNotes.map(w=><p className={s.muted} key={w}>{w}</p>)}</details>}
        <p className={s.muted}>These are requested effects. Availability, identity checks and switching intervals still apply. Actual device states appear in Activity.</p>
    </section>
}

export function ProgramRuleEditor({home,controller,rule,done,cancel}:{home:Home;controller:SemanticController;rule:Automation|null;done:()=>void;cancel:()=>void}) {
    const initial=controller.domain==='humidity'?'band':controller.domain==='lighting'?'dusk':controller.domain==='cleaning'?'cleaning':'schedule'
    const [program,setProgram]=useState<Program>(()=>rule?fromLegacy(rule.spec,controller):preset(initial,controller))
    const [name,setName]=useState(rule?.spec.name || `${controller.display_name} · Rule`.slice(0,100))
    const [weekdays,setWeekdays]=useState(rule?.spec.weekdays || [0,1,2,3,4,5,6])
    const [chosenPreset,setChosenPreset]=useState('')
    const [result,setResult]=useState<{key:string;preview?:Preview;error?:string}>()
    const [error,setError]=useState(''),[busy,setBusy]=useState(false)
    const context:Context={controller,triggers:program.timing.mode==='events'?program.timing.triggers:[]}
    const outputs=controller.entities.filter(d=>controller.bindings.targets.includes(d.device_id))
    const switchable=outputs.every(d=>d.capabilities?.actions?.includes('turn_on')&&d.capabilities?.actions?.includes('turn_off'))
    const dimmable=outputs.every(d=>d.capabilities?.brightness?.supported)
    const spec:Spec={name,kind:'program',program,targets:controller.bindings.targets,sensor_id:null,sensor_ids:controller.bindings.sensor_ids || [],lower:52,upper:55,weekdays,start:null,end:null,at:'10:00',min_cycle_seconds:180,sensor_stale_seconds:1800,brightness_pct:null,enabled:rule?.spec.enabled??true}
    const payload=JSON.stringify(spec),key=home.id+payload,valid=!!(name.trim()&&weekdays.length&&programValid(program))
    const preview=result?.key===key&&valid?result:undefined
    function update(next:Program){setProgram(next);setError('')}
    useEffect(()=>{if(!valid)return;let alive=true;const load=()=>httpPost<Preview>('/automations/preview',JSON.parse(payload)).then(data=>{if(alive)setResult({key,preview:data})}).catch(e=>{if(alive)setResult({key,error:errorText(e)})});const timer=window.setTimeout(()=>void load(),450);const refresh=window.setInterval(()=>{if(!document.hidden)void load()},60000);return()=>{alive=false;window.clearTimeout(timer);window.clearInterval(refresh)}},[key,payload,valid])
    async function save(e:FormEvent){e.preventDefault();if(!valid)return;setBusy(true);setError('');try{const body={spec,controller_id:controller.controller_id,expected_version:rule?.version || null};if(rule)await httpPut(`/automations/${rule.id}`,body);else await httpPost('/automations',body);done()}catch(e){setError(errorText(e))}finally{setBusy(false)}}
    function changeControl(kind:Control['kind']) {
        const next=kind==='curve'?preset('dawn',controller):kind==='band'?preset('band',controller):kind==='switch'?preset('schedule',controller):preset('custom',controller)
        if(next.control.kind==='curve'&&!outputs.every(d=>d.capabilities?.color_temp?.supported))next.control.color_mode='brightness'
        update({...next,conditions:program.conditions})
    }
    const control=program.control,timing=program.timing
    function timingChange(next:Timing){update({...program,timing:next})}
    return <section className={`${s.card} ${s.editor} ${c.editor}`} data-testid="automation-composer"><div className={s.row}><h2>{rule?'Edit Rule':'Add Rule'}</h2><button type="button" onClick={cancel}>Close</button></div>
        <p className={s.muted}>{controller.zone_name} → {controller.display_name} → Rule. Outputs remain assigned to this controller; inputs can come from its Home Assistant connection.</p>
        {rule&&rule.spec.kind!=='program'&&<p className={s.notice}>Your saved rule has been copied into the reusable editor. Review its timing and preview before saving. The stored rule changes only when you save this draft.</p>}
        <form className={s.form} onSubmit={save}>
            <label className={s.field}>Rule name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
            <label className={s.field}>What should happen?<select value={control.kind} onChange={e=>changeControl(e.target.value as Control['kind'])}>{switchable&&<><option value="switch">Switch on during a period</option><option value="band">Maintain a measurement range</option></>}{dimmable&&<option value="curve">Gradually adjust the lights</option>}<option value="sequence">Run action steps</option></select></label>
            <details className={c.details}><summary>Use a starting point</summary><div className={c.presets}><label className={s.field}>Start from a preset<select value={chosenPreset} onChange={e=>setChosenPreset(e.target.value)}><option value="">Choose a starting point …</option>{switchable&&<><option value="schedule">On / off schedule</option><option value="band">Maintain a measurement range</option></>}{dimmable&&<><option value="dawn">Natural dawn</option><option value="dusk">Natural dusk</option></>}<option value="custom">Custom event and actions</option>{controller.domain==='cleaning'&&<option value="cleaning">Scheduled cleaning</option>}</select></label><button type="button" disabled={!chosenPreset} onClick={()=>{const next=preset(chosenPreset,controller);if(next.control.kind==='curve'&&!outputs.every(d=>d.capabilities?.color_temp?.supported))next.control.color_mode='brightness';update(next);setChosenPreset('')}}>Load preset</button></div>
            <p className={s.muted}>A preset fills the editable parts below. Change its events, inputs, conditions and behaviour to make your own rule.</p>
            </details>
            <div className={s.sentence} aria-live="polite"><strong>Rule in words</strong><p>{briefLightingRule(program)||programDescription(program,Object.fromEntries(controller.entities.map(d=>[d.device_id,d.name])))}</p>{control.kind==='curve'&&program.conditions.terms.length>0&&<small>Only when the conditions below are satisfied.</small>}</div>
            <fieldset className={c.section}><legend>When should it run?</legend>
                {(control.kind==='band'||control.kind==='switch')&&<label className={s.field}>Run this rule<select value={timing.mode} onChange={e=>timingChange(e.target.value==='always'?{mode:'always'}:{mode:'window',start:clock('06:00'),end:clock('22:00')})}><option value="always">All day</option><option value="window">Only during set hours / events</option></select></label>}
                {timing.mode==='window'&&<div className={c.anchors}><AnchorEditor label="Start" value={timing.start} change={start=>timingChange({...timing,start})}/><AnchorEditor label="End" end value={timing.end} change={end=>timingChange({...timing,end})}/></div>}
                {control.kind!=='sequence'&&<label className={s.field}>At the end<select value={program.end_action} onChange={e=>update({...program,end_action:e.target.value as Program['end_action']})}><option value="hold">{control.kind==='curve'?'Stop adjusting; keep the last level':'Leave the last state'}</option><option value="off">Switch off</option></select></label>}
                {timing.mode==='events'&&<>{timing.triggers.map((trigger,i)=><TriggerEditor key={trigger.key} index={i} context={context} value={trigger} change={t=>timingChange({...timing,triggers:timing.triggers.map((x,n)=>n===i?t:x)})} remove={()=>timingChange({...timing,triggers:timing.triggers.filter((_,n)=>n!==i)})}/>)}<button type="button" disabled={timing.triggers.length>=16} onClick={()=>timingChange({...timing,triggers:[...timing.triggers,{kind:'anchor',key:crypto.randomUUID(),anchor:clock('08:00')}]})}>+ Start event</button><p className={s.muted}>Any event can start this rule. A threshold trigger reacts to a crossing, rather than continuously enforcing a value. Use range control for continuous regulation.</p></>}
                <details className={c.details}><summary>Repeat · {weekdays.length===7?'Every day':weekdays.map(i=>days[i]).join(', ')||'Choose days'}</summary><div className={s.field}><span>Active days · local start date</span><div className={s.days}>{days.map((day,i)=><button type="button" key={day} aria-pressed={weekdays.includes(i)} className={weekdays.includes(i)?s.active:''} onClick={()=>setWeekdays(weekdays.includes(i)?weekdays.filter(n=>n!==i):[...weekdays,i].sort())}>{day}</button>)}</div></div></details>
            </fieldset>
            <fieldset className={c.section}><legend>{control.kind==='curve'?'How should the light change?':'What should it do?'}</legend>
                {control.kind==='band'?<BandFields value={control} context={context} change={v=>update({...program,control:v})}/>:control.kind==='curve'?<CurveFields value={control} context={context} change={v=>update({...program,control:v})}/>:control.kind==='sequence'?<StepEditor context={context} value={control.steps} change={steps=>update({...program,control:{...control,steps}})}/>:<>
                    <p className={s.muted}>Keep the outputs on while the timing and extra conditions allow it. With force-off selected, check again every minute and whenever an output turns on.</p>
                    {dimmable&&<label className={s.field}>Brightness (optional, %)<input type="number" min={1} max={100} value={control.brightness_pct??''} onChange={e=>update({...program,control:{...control,brightness_pct:e.target.value?Number(e.target.value):null}})}/></label>}
                </>}
            </fieldset>
            <details className={c.optional} open={program.conditions.terms.length>0}><summary>Only if… · {program.conditions.terms.length?`${program.conditions.terms.length} condition${program.conditions.terms.length===1?'':'s'}`:'optional conditions'}</summary><div className={c.advancedBody}><ConditionEditor context={context} value={program.conditions} change={conditions=>update({...program,conditions})}/><p className={s.muted}>All numeric condition inputs must be fresh, including inside Any and Not groups.</p></div></details>
            <details className={c.optional}><summary>Advanced · limits and overrides</summary><div className={c.advancedBody}>

                <label className={s.field}>If extra conditions are not satisfied<select value={program.condition_failure} onChange={e=>update({...program,condition_failure:e.target.value as Program['condition_failure']})}><option value="hold">Send no new command</option>{switchable&&<option value="off">Force outputs off</option>}</select></label>
                {(timing.mode==='events'||(timing.mode==='window'&&!(timing.start.event==='clock'&&timing.end.event==='clock')))&&<NumberField label={timing.mode==='events'?'Maximum total waits (minutes)':'Stop the event window after at most (minutes)'} min={1} max={1440} value={program.max_run_minutes} change={max_run_minutes=>update({...program,max_run_minutes})}/>}
                <p className={s.muted}>{timing.mode==='events'?'Action steps run in order. After an HA restart, the next matching event starts a new run.':timing.mode==='always'||(timing.mode==='window'&&timing.start.event==='clock'&&timing.end.event==='clock')?'Clock-based control resumes locally after an HA restart. Curves resume only lamps that are already on.':'Solar event windows run locally until their end event or time limit. After an HA restart/reload, they wait for the next start event.'}</p>
            </div></details>
            <p className={s.muted}>Outputs: {outputs.map(d=>d.name).join(' · ')}<br/>Times and solar events use {home.timezone}. Saving a draft and previewing send no device commands.</p>
            {!valid&&<p className={s.notice}>Complete the inputs, timing and steps to preview and save. Curve positions must be distinct; lower thresholds must be below upper thresholds.</p>}
            {preview?.error&&<p className={s.error} role="alert">{preview.error}</p>}{valid&&!preview&&<p role="status">Calculating the rule preview …</p>}
            {preview?.preview&&<PreviewPanel key={key} preview={preview.preview} timezone={home.timezone} showWhite={control.kind==='curve'&&control.color_mode==='white'}/>}
            {error&&<p className={s.error} role="alert">{error}</p>}
            <div className={s.row}><button className={s.primary} type="submit" disabled={!valid||busy}>{busy?'Saving …':'Save Draft'}</button><button type="button" onClick={cancel}>Cancel</button></div>
        </form>
    </section>
}
