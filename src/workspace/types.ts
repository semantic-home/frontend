export type Home = {id: string; name: string; timezone: string; role: "owner" | "editor" | "viewer"}
export type User = {id: string; email: string; homes: Home[]}
export type Device = {
    id: string; agent_id: string; entity_id: string; state: string; available: boolean; connection_name?: string;
    attributes: {friendly_name?: string; device_name?: string; area_id?: string; area_name?: string;
        unit_of_measurement?: string; device_class?: string; device_id?: string};
    capabilities: {actions?: string[]; brightness?: {supported: boolean}; color_temp?: {supported: boolean; min_kelvin: number; max_kelvin: number}; transition?: boolean}
}
export type DevicePage = {items: Device[]; total: number; offset: number; limit: number; areas: {id: string; name: string | null}[]}
export type DawnPhase = "astronomical" | "nautical" | "civil" | "daylight"
export type LightLevel = {brightness_pct: number; kelvin: number}
export type DawnRamp = {direction?: "dawn" | "dusk"; start_at: string; stop_at: string; off_at_end: boolean; startup_minutes: number; initial_brightness_pct: number; color_mode: "white" | "brightness"} & Record<DawnPhase, LightLevel>
export type Spec = {
    name: string; kind: "humidity_band" | "time_window" | "cleaning" | "lighting_ramp"; targets: string[];
    sensor_id: string | null; sensor_ids?: string[]; lower: number; upper: number; weekdays: number[];
    start: string | null; end: string | null; at: string; min_cycle_seconds: number;
    start_event?: "time" | "sunrise" | "sunset"; end_event?: "time" | "sunrise" | "sunset";
    start_offset_minutes?: number; end_offset_minutes?: number;
    ramp?: DawnRamp | null; sensor_stale_seconds: number; brightness_pct: number | null; enabled: boolean
}
export type Automation = {id: string; agent_id: string; spec: Spec; version: number; deployed_version: number | null;
    controller_id: string; deployed_spec?: Spec | null; requested: boolean; status: string; error: string | null; deleted: boolean}
export type SemanticController = {
    controller_id: string; display_name: string; domain: "humidity" | "lighting" | "power" | "cleaning";
    zone_id: string; zone_name: string; zone: {zone_id: string; display_name: string};
    agent_id: string; version: number; bindings: {targets: string[]; sensor_id: string | null; sensor_ids?: string[]};
    entities: {device_id: string; entity_id: string; name: string; role: string; state: string; unit: string | null; available: boolean}[];
    rules: Automation[]; rule_count: number
}
export type Connection = {id: string; name: string; connected: boolean; revoked: boolean;
    metadata: {timezone?: string; ha_version?: string; stub?: boolean}}
export type SolarPreview = {timezone: string; location_name: string | null; connection_name: string; connected: boolean;
    now: string; sunrise: string | null; sunset: string | null; available: boolean; warnings: string[];
    events: {at: string; action: "on" | "off"; event: "time" | "sunrise" | "sunset"; offset_minutes: number; anchor_date: string}[]}
export type RampPreview = {timezone: string; date: string; location_name: string | null; connection_name: string; connected: boolean; available: boolean; now: string; start: string | null; stop: string | null; selected_day: boolean; warnings: string[]; phases: ({key: DawnPhase; label: string; elevation: number; at: string | null; before_start: boolean} & LightLevel)[]; samples: ({at: string} & LightLevel)[]; lamps: {name: string; color_temp: {min_kelvin: number; max_kelvin: number} | null; transition: boolean}[]}
export type Preview = {humidity: number | null; sensor_count?: number; timezone: string; schedule?: SolarPreview | null; ramp?: RampPreview | null; items: {id: string; name: string; current: string; desired: string; reason: string}[]}
export type Activity = {id: number; name: string; kind: string; created_at: string; detail: {entity_id?: string; state?: string; desired?: string; reason?: string; message?: string}}
