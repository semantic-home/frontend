import type {AgentView, WateringControllerCreate, WateringControllerUpdate, WateringControllerView} from "./types.ts";
import {httpDelete, httpGet, httpPost, httpPut} from "./http.ts";
import type {DomainKey} from "../header/domains.ts";
import type {ZoneKey} from "../main/MainView.tsx";
import type {ActionKey} from "../main/content/pads/components/PadActions.tsx";



export async function createWateringController(req: WateringControllerCreate):
    Promise<WateringControllerView> {
    // Send WateringControllerCreate request to the backend
    const payload = {
        "controller_id": req.controller_id,
        "display_name": req.display_name,
        "actuator_entity_ids": req.actuator_entity_ids,
        "moisture_sensor_entity_ids": req.moisture_sensor_entity_ids,
        "moisture_start_below": req.moisture_start_below,
        "agent_id": req.agent_id,
        "requires_agent": req.requires_agent ?? true,
        "plant_ids": req.plant_ids ?? [],
        "zone": req.zone ?? null,
    }
    return await httpPost<WateringControllerView>(`/domains/watering/controllers`, payload)

}

export async function updateWateringController(
    controllerId: string,
    req: WateringControllerUpdate,
): Promise<WateringControllerView> {
    return await httpPut<WateringControllerView>(`/domains/watering/controllers/${controllerId}`, req)
}

export async function deleteWateringController(
    controllerId: string,
): Promise<{deleted: boolean; controller_id: string}> {
    return await httpDelete<{deleted: boolean; controller_id: string}>(`/domains/watering/controllers/${controllerId}`)
}

export function makeControllersApi<TCreate, TView>(domain: DomainKey, zone: ZoneKey) {
  return {
    create: (req: TCreate) =>
      httpPost<TView>(`/domains/${domain}/controllers`, req),

    get: (controllerId: string) =>
      httpGet<TView>(`/domains/${domain}/zones/${zone}/controllers/${controllerId}`),

    list: () =>
      httpGet<TView[]>(`/domains/${domain}/zones/${zone}/controllers`),
  }
}

export function makeWhy(domain: DomainKey) {
    return {
        get: (controller_id: string) => httpGet(
            `/domains/${domain}/controllers/${controller_id}/why`
        )
    }
}

export function makeNext(domain: DomainKey) {
    return {
        get: (controller_id: string) => httpGet(
            `/domains/${domain}/controllers/${controller_id}/next`
        )
    }
}

export function makeWateringSchedulerApi() {
    return {
        pause: (controllerId: string) =>
            httpPost(`/domains/watering/controllers/${controllerId}/pause`, {}),
        resume: (controllerId: string) =>
            httpPost(`/domains/watering/controllers/${controllerId}/resume`, {}),
        skipNext: (controllerId: string) =>
            httpPost(`/domains/watering/controllers/${controllerId}/skip_next`, {}),
    }
}

export function makeAgentsApi() {
    return {
        list: () =>
            httpGet<{agents: AgentView[]}>(`/agent/list_agents`),
    }
}



export function makeRuntimeApiCall<TCreate, TView>(domain: DomainKey){
    // Api request to /api/v1/domains/{domain}/controllers/{controller_id}/{switch(actionKey)}
    const action: Record<ActionKey, string> = {
        'water_now': 'start',
        'turn_on_all': 'turn_on_all',
        'apply_mode_now': 'apply_mode',
        'arm_now': 'arm',
        'pause': '',
        'skip_next': '',
        'edit_rules': '',
        'edit_controller': ''
    }
    return {
        state: (controllerId: string) =>
            httpGet<TView>(`/domains/${domain}/controllers/${controllerId}/state`),

        execute: (controllerId: string, actionKey: ActionKey, req: TCreate)=>
            httpPost<TView>(`/domains/${domain}/controllers/${controllerId}/${action[actionKey]}`, req)
    }


}
