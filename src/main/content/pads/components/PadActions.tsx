import styles from "./PadActions.module.css"
import buttonstyles from "./../../../../styles/Button.module.css"
import iconStyles from "./../../../../styles/Icon.module.css"
import type {DomainKey} from "../../../../header/domains.ts";
import {
    Droplet,
    Power,
    SlidersHorizontal,
    ShieldCheck,
    Pause,
    Play,
    SkipForward,
    Pencil,
    Settings2,
    type LucideIcon,
} from "lucide-react";
import {makeRuntimeApiCall, makeWateringSchedulerApi} from "../../../../api/controllers.ts";
import type {ControllerBaseFields, WateringNextView} from "../../../../api/types.ts";
import type {RightPanelState, ZoneKey} from "../../../MainView.tsx";
import {joinClassNames} from "../../../../utils/classNames.ts";

export type ActionKey =
    | "water_now"
    | "turn_on_all"
    | "apply_mode_now"
    | "arm_now"
    | "pause"
    | "skip_next"
    | "edit_rules"
    | "edit_controller";

type ActionEntry = {
    key: ActionKey,
    value: string
}

type ActionDomainEntry = {
    key: DomainKey,
    value: ActionEntry[]
}

const ActionButtons: ActionDomainEntry[] = [
    {
        key: "watering",
        value: [
            { key: "water_now", value: "Water Now" },
            { key: "pause", value: "Pause" },
            { key: "skip_next", value: "Skip Next" },
            { key: "edit_controller", value: "Edit Controller" },
            { key: "edit_rules", value: "Edit Rules" },
        ],
    },
    {
        key: "lighting",
        value: [
            { key: "turn_on_all", value: "Turn On All" },
            { key: "pause", value: "Pause" },
            { key: "skip_next", value: "Skip Next" },
            { key: "edit_rules", value: "Edit Rules" },
        ],
    },
    {
        key: "power",
        value: [
            { key: "apply_mode_now", value: "Apply Mode" },
            { key: "pause", value: "Pause" },
            { key: "skip_next", value: "Skip Next" },
            { key: "edit_rules", value: "Edit Rules" },
        ],
    },
    {
        key: "surveillance",
        value: [
            { key: "arm_now", value: "Arm Now" },
            { key: "pause", value: "Pause" },
            { key: "skip_next", value: "Skip Next" },
            { key: "edit_rules", value: "Edit Rules" },
        ],
    },
];

const ACTION_ICONS: Record<ActionKey, LucideIcon> = {
    water_now: Droplet,
    turn_on_all: Power,
    apply_mode_now: SlidersHorizontal,
    arm_now: ShieldCheck,
    pause: Pause,
    skip_next: SkipForward,
    edit_rules: Pencil,
    edit_controller: Settings2,
};

export function PadActions(
    {
        controller,
        activeDomain,
        onEditRules,
        isRightPanelOpen,
        rightPanel,
        closeRightPanel,
        next,
        onControllerAction,
        activeZoneKey,
        activeZoneText,
        onEditController
    }: {
        controller: ControllerBaseFields,
        activeDomain: DomainKey,
        onEditRules: (controllerId: string) => void,
        isRightPanelOpen: boolean,
        rightPanel: RightPanelState,
        closeRightPanel: () => void,
        next?: WateringNextView,
        onControllerAction: (controllerId: string) => void
        activeZoneKey: ZoneKey,
        activeZoneText: string,
        onEditController: (controllerId: string, zoneId: ZoneKey, zoneLabel: string) => void
    }
) {

    const isWateringDomain = activeDomain === "watering"
    const isPaused = next?.is_paused ?? false
    const pauseActionLabel = isPaused ? "Resume" : "Pause"

    const actions = ActionButtons.find(
        item => item.key === activeDomain
    )?.value ?? [];

    const handleActionClick = async (actionKey: ActionKey, isRightPanelOpen: boolean) => {
        if (actionKey === "edit_rules") {
            onEditRules(controller.controller_id);
            if (
                isRightPanelOpen
                && rightPanel.mode === "edit_rule"
                && controller.controller_id === rightPanel.controllerId) {
                closeRightPanel();
            }
            return;
        }

        if (actionKey === "edit_controller") {
            onEditController(controller.controller_id, activeZoneKey, activeZoneText)
            if (
                isRightPanelOpen
                && rightPanel.mode === "edit_controller"
                && controller.controller_id === rightPanel.controllerId
            ) {
                closeRightPanel()
            }
            return
        }

        if (actionKey === "pause") {
            if (!isWateringDomain) {
                return
            }
            try {
                if (isPaused) {
                    await makeWateringSchedulerApi().resume(controller.controller_id)
                } else {
                    await makeWateringSchedulerApi().pause(controller.controller_id)
                }
                onControllerAction(controller.controller_id)
            } catch (err) {
                console.error(`Controller action failed (${actionKey}) for ${controller.controller_id}:`, err);
            }
            return
        }

        if (actionKey === "skip_next") {
            if (!isWateringDomain) {
                return
            }
            try {
                await makeWateringSchedulerApi().skipNext(controller.controller_id)
                onControllerAction(controller.controller_id)
            } catch (err) {
                console.error(`Controller action failed (${actionKey}) for ${controller.controller_id}:`, err);
            }
            return
        }

        try {
            await makeRuntimeApiCall(activeDomain).execute(
                controller.controller_id,
                actionKey,
                {"seconds": 5}
            );
            onControllerAction(controller.controller_id)
        } catch (err) {
            console.error(`Controller action failed (${actionKey}) for ${controller.controller_id}:`, err);
        }
    };


    return (
        <div className={styles.padActions}>

            {actions.map(
                (action) => {
                    const Icon: LucideIcon = action.key === "pause" && isPaused ? Play : ACTION_ICONS[action.key];
                    const actionLabel = action.key === "pause" ? pauseActionLabel : action.value
                    const isActionActive = (
                        (action.key === "edit_rules"
                            && rightPanel.mode == "edit_rule"
                            && controller.controller_id === rightPanel.controllerId
                            && isRightPanelOpen)
                        || (action.key === "edit_controller"
                            && rightPanel.mode === "edit_controller"
                            && controller.controller_id === rightPanel.controllerId
                            && isRightPanelOpen)
                        || (action.key === "pause" && isPaused)
                        || (action.key === "skip_next" && Boolean(next?.skip_next_pending))
                    )
                    return (
                        <button
                            className={joinClassNames(
                                buttonstyles.button,
                                buttonstyles.actionButton,
                                isActionActive ? buttonstyles.isActive : "",
                            )}
                            key={action.key}
                            onClick={() => {
                                void handleActionClick(action.key, isRightPanelOpen);
                            }}
                            disabled={
                                (action.key === "skip_next" && isWateringDomain && (!next?.next_run_at || Boolean(next?.skip_next_pending)))
                            }
                        >
                            <Icon className={iconStyles.icon} aria-hidden="true"/>
                            {actionLabel}

                        </button>
                    )
                }
            )}

        </div>
    )
}
