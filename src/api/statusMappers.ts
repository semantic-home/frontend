import type {LightingMode, PowerMode, SurveillanceMode, UiRuntimeStatus} from "./statusTypes.ts";

export type WateringMode = "OFF" | "STARTING" | "ON" | "STOPPING" | "FAILED";


type DomainRuntimeMode =
    | { domain: "watering"; mode: WateringMode }
    | { domain: "lighting"; mode: LightingMode }
    | { domain: "power"; mode: PowerMode }
    | { domain: "surveillance"; mode: SurveillanceMode };


function mapPowerModeToUiStatus(mode: PowerMode) {
    switch (mode) {
        case "IDLE": return "IDLE";
        case "APPLYING": return "ACTIVATING";
        case "APPLIED": return "ACTIVE";
        case "ROLLING_BACK": return "DEACTIVATING";
        case "FAILED": return "FAILED";
    }
}

function mapSurveillanceModeToUiStatus(mode: SurveillanceMode) {
    switch (mode) {
        case "DISARMED": return "IDLE";
        case "ARMING": return "ACTIVATING";
        case "ARMED": return "ACTIVE";
        case "DISARMING": return "DEACTIVATING";
        case "FAILED": return "FAILED";
    }
}



function mapWateringModeToUiStatus(mode: WateringMode): UiRuntimeStatus {
    switch (mode) {
        case "OFF": return "IDLE";
        case "STARTING": return "ACTIVATING";
        case "ON": return "ACTIVE";
        case "STOPPING": return "DEACTIVATING";
        case "FAILED": return "FAILED";
    }
}

function mapLightingModeToUiStatus(mode: LightingMode): UiRuntimeStatus {
    switch (mode) {
        case "IDLE": return "IDLE";
        case "APPLYING_SCENE": return "ACTIVATING";
        case "ACTIVE": return "ACTIVE";
        case "STOPPING": return "DEACTIVATING";
        case "FAILED": return "FAILED";
    }
}

export function mapDomainModeToUiStatus(input: DomainRuntimeMode): UiRuntimeStatus {
    switch (input.domain) {
        case "watering":
            return mapWateringModeToUiStatus(input.mode);
        case "lighting":
            return mapLightingModeToUiStatus(input.mode);
        case "power":
            return mapPowerModeToUiStatus(input.mode);
        case "surveillance":
            return mapSurveillanceModeToUiStatus(input.mode);
    }
}