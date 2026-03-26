export type UiRuntimeStatus =
    | "IDLE"
    | "ACTIVATING"
    | "ACTIVE"
    | "DEACTIVATING"
    | "FAILED"
    | "PAUSED"
    | "UNKNOWN";


export type WateringMode = "OFF" | "STARTING" | "ON" | "STOPPING" | "FAILED";

export type LightingMode =
    | "IDLE"
    | "APPLYING_SCENE"
    | "ACTIVE"
    | "STOPPING"
    | "FAILED";

export type PowerMode =
    | "IDLE"
    | "APPLYING"
    | "APPLIED"
    | "ROLLING_BACK"
    | "FAILED";

export type SurveillanceMode =
    | "DISARMED"
    | "ARMING"
    | "ARMED"
    | "DISARMING"
    | "FAILED";