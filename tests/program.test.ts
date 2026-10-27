import assert from 'node:assert/strict'
import test from 'node:test'
import {blankCurve, briefLightingRule, clock, darkPoint, emptyGroup, programValid, withNightBrightness} from '../src/workspace/program.ts'
import type {CurveControl, Program} from '../src/workspace/program.ts'

function daylight():Program&{control:CurveControl} {
    return {version:2,timing:{mode:'window',start:clock('06:00'),end:clock('22:00')},conditions:emptyGroup(),
        control:{...blankCurve(),solar_direction:'any'},end_action:'hold',condition_failure:'hold',max_run_minutes:720}
}

test('an independent 45% dusk endpoint preserves the dim morning and daylight level',()=>{
    const p=daylight(),before=structuredClone(p.control.points)
    p.control.evening_points=withNightBrightness(structuredClone(p.control.points),45)
    assert.deepEqual(p.control.points,before)
    assert.equal(darkPoint(p.control.points).brightness_pct,1)
    assert.equal(darkPoint(p.control.evening_points).brightness_pct,45)
    assert.equal(p.control.evening_points.at(-1)?.brightness_pct,100)
    assert.deepEqual(p.control.evening_points.map(v=>v.brightness_pct),[45,50,69,100])
    assert.deepEqual(p.control.evening_points.map(v=>[v.position,v.kelvin]),before.map(v=>[v.position,v.kelvin]))
    assert.ok(programValid(p))
    assert.match(briefLightingRule(p)!,/separate morning and evening curves/)
    assert.match(briefLightingRule(p)!,/reaches 45%/)
})

test('shared profiles remain valid and turning off at the end is explicit',()=>{
    const p=daylight()
    assert.ok(programValid(p))
    assert.doesNotMatch(briefLightingRule(p)!,/separate/)
    p.end_action='off'
    assert.match(briefLightingRule(p)!,/At 22:00, switch off/)
})

test('invalid evening profiles cannot be saved',()=>{
    const valid=daylight();valid.control.evening_points=structuredClone(valid.control.points)
    const variants=[
        {...valid.control,solar_direction:'setting' as const},
        {...valid.control,driver:'elapsed_minutes' as const},
        {...valid.control,evening_points:[]},
        {...valid.control,evening_points:[valid.control.points[0],valid.control.points[0]]},
        {...valid.control,evening_points:[{...valid.control.points[0],brightness_pct:0},valid.control.points[1]]},
    ]
    for(const control of variants)assert.equal(programValid({...valid,control}),false)
})

test('night-level adjustment handles flat profiles and never changes the caller’s points',()=>{
    const points=blankCurve().points.map(p=>({...p,brightness_pct:100})),before=structuredClone(points)
    const adjusted=withNightBrightness(points,45)
    assert.deepEqual(points,before)
    assert.equal(darkPoint(adjusted).brightness_pct,45)
    assert.equal(adjusted.at(-1)?.brightness_pct,100)
    assert.ok(adjusted.every(p=>Number.isInteger(p.brightness_pct)&&p.brightness_pct>=1&&p.brightness_pct<=100))
})
