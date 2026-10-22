export type Home = {id: string; name: string; timezone: string; role: "owner" | "editor" | "viewer"}
export type User = {id: string; email: string; homes: Home[]}
export type Device = {
    id: string; agent_id: string; entity_id: string; state: string; available: boolean; connection_name?: string;
    attributes: {friendly_name?: string; device_name?: string; area_id?: string; area_name?: string;
        unit_of_measurement?: string; device_class?: string; device_id?: string};
    capabilities: {actions?: string[]; brightness?: {supported: boolean}}
}
export type DevicePage = {items: Device[]; total: number; offset: number; limit: number; areas: {id: string; name: string | null}[]}
export type Spec = {
    name: string; kind: "humidity_band" | "time_window" | "cleaning"; targets: string[];
    sensor_id: string | null; lower: number; upper: number; weekdays: number[];
    start: string | null; end: string | null; at: string; min_cycle_seconds: number;
    sensor_stale_seconds: number; brightness_pct: number | null; enabled: boolean
}
export type Automation = {id: string; agent_id: string; spec: Spec; version: number; deployed_version: number | null;
    controller_id: string; deployed_spec?: Spec | null; requested: boolean; status: string; error: string | null; deleted: boolean}
export type SemanticController = {
    controller_id: string; display_name: string; domain: "humidity" | "lighting" | "power" | "cleaning";
    zone_id: string; zone_name: string; zone: {zone_id: string; display_name: string};
    agent_id: string; version: number; bindings: {targets: string[]; sensor_id: string | null};
    entities: {device_id: string; entity_id: string; name: string; role: string; state: string; unit: string | null; available: boolean}[];
    rules: Automation[]; rule_count: number
}
export type Connection = {id: string; name: string; connected: boolean; revoked: boolean;
    metadata: {timezone?: string; ha_version?: string; stub?: boolean}}
export type Preview = {humidity: number | null; timezone: string; items: {id: string; name: string; current: string; desired: string; reason: string}[]}
export type Activity = {id: number; name: string; kind: string; created_at: string; detail: {entity_id?: string; state?: string; desired?: string; reason?: string; message?: string}}
