import type {WateringMode} from "./statusTypes.ts";


export interface ControllerBaseFields {
    controller_id: string
    display_name: string
    agent_id: string
    requires_agent?: boolean
}

export interface ZoneView {
    zone_id: string
    display_name: string
}

export interface ControllerViewBase extends ControllerBaseFields {
    readonly zone?: ZoneView | null
    readonly plant_ids: string[]
    readonly icon_keys: string[]
    readonly plant_count: number
}

export interface WateringControllerCreate  extends ControllerBaseFields {
    actuator_entity_ids: string[],
    moisture_sensor_entity_ids: string[],
    moisture_start_below: number,
    plant_ids?: string[],
    zone?: ZoneView | null,
}

export interface WateringControllerUpdate {
    display_name: string
    actuator_entity_ids: string[]
    moisture_sensor_entity_ids: string[]
    moisture_start_below: number
    plant_ids?: string[]
    agent_id: string
    requires_agent?: boolean
    zone?: ZoneView | null
}

export interface WateringControllerView extends ControllerViewBase {
    readonly actuator_entity_ids: string[]
    readonly moisture_sensor_entity_ids: string[]
    readonly moisture_start_below?: number | null
}

type Decision = "start" | "skip" | "unknown"

export interface WhyViewBase {
    readonly controller_id: string,
    readonly decision: Decision,
    readonly reason_code: string,
    readonly message: string,
    readonly at: string
}

export interface WateringWhyView extends WhyViewBase{
    readonly moisture_sensor_entity_ids?: string[],
    readonly moisture_state_raw?: string | null,
    readonly moisture_value?: number | null,
    readonly moisture_start_below?: number | null
}

export interface WateringNextView {
    readonly controller_id: string
    readonly next_run_at: string | null
    readonly last_evaluated_at: string | null
    readonly last_outcome: string | null
    readonly last_reason_code: string | null
    readonly last_error: string | null
    readonly is_paused: boolean
    readonly skip_next_pending: boolean
}


export interface WateringRuntimeView {
    readonly mode: WateringMode;
    readonly run_id: string | null;
    readonly agent_id: string | null;
    readonly ttl_s: number | null;
    readonly targets: readonly string[];
    readonly pending_on: ReadonlySet<string>;
    readonly pending_off: ReadonlySet<string>;
    readonly started_at_s: number | null;
    readonly last_error: string | null;
}

export interface AgentView {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly created_at: string
    readonly connected: boolean
    readonly last_seen_at: string
}
