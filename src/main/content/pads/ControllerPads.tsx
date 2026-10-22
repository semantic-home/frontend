import styles from "./ControllerPads.module.css";
import iconStyles from "../../../styles/Icon.module.css";
import buttonStyles from "../../../styles/Button.module.css";
import type {ControllerViewBase, WateringNextView, WhyViewBase} from "../../../api/types.ts";
import {PadHeader} from "./components/PadHeader.tsx";
import {PadFooter} from "./components/PadFooter.tsx";
import {PadSemantics} from "./components/PadSemantics.tsx";
import {PadActions} from "./components/PadActions.tsx";
import type {DomainKey} from "../../../header/domains.ts";
import type {UiRuntimeStatus} from "../../../api/statusTypes.ts";
import type {RightPanelState, ZoneKey} from "../../MainView.tsx";
import {Plus} from "lucide-react";
import {joinClassNames} from "../../../utils/classNames.ts";
import {ControllerEmptyState} from "./components/ControllerEmptyState.tsx";


export function ControllerPads(
    {
        controllers,
        whyRecords,
        nextRecords,
        activeDomain,
        activeZoneKey,
        activeZoneText,
        uiStatus,
        onEditRules,
        isRightPanelOpen,
        rightPanel,
        closeRightPanel,
        onControllerAction,
        onCreateController,
        onEditController,
        loading = false,
        error

}: {
    controllers: ControllerViewBase[],
    whyRecords: Record<string, WhyViewBase>,
    nextRecords: Record<string, WateringNextView>,
    activeDomain: DomainKey,
    activeZoneKey: ZoneKey,
    activeZoneText: string,
    uiStatus: Record<string, UiRuntimeStatus>,
    onEditRules: (controllerId: string) => void,
    isRightPanelOpen: boolean,
    rightPanel: RightPanelState,
    closeRightPanel: () => void,
    onControllerAction: (controllerId: string) => void,
    onCreateController: (zoneId: ZoneKey, activeZone: string) => void
    onEditController: (controllerId: string, zoneId: ZoneKey, zoneLabel: string) => void
    loading?: boolean
    error?: string
}) {

    const handleCreateController = () => {
        if (
            isRightPanelOpen
            && rightPanel.mode === "create_controller"
        ) {
            closeRightPanel();
            return;
        }
        onCreateController(activeZoneKey, activeZoneText);
    }


    return (
        <div className={styles.controllerPads}>
            <div className={styles.padHeading}>
                <h3>
                   <span className={styles.padHeadingText}>Controller Pads</span>
                </h3>
                {activeDomain === "watering" && activeZoneKey && (
                    <button
                        type="button"
                        className={joinClassNames(
                            buttonStyles.button,
                            buttonStyles.createFormButton,
                            buttonStyles.createControllerButton,
                            rightPanel.mode === "create_controller" ? buttonStyles.isActive : ""
                        )}
                        onClick={handleCreateController}
                    >
                        <Plus className={iconStyles.icon} aria-hidden="true"/>
                        Create Controller
                    </button>
                )}
            </div>

            {loading && <p role="status">Loading controllers …</p>}
            {error && <p role="alert">{error}</p>}
            {!loading && !error && controllers.length === 0 && <ControllerEmptyState/>}
            {!loading && !error && <div className={styles.padList}>
                {controllers.map((controller) => {
                    return (
                        <div
                            key={controller.controller_id}
                            className={styles.pad}
                            data-controller-id={controller.controller_id}
                        >

                            <PadHeader
                                controller_name={controller.display_name}
                                uiStatus={uiStatus[controller.controller_id] ?? "UNKNOWN"}
                                icon_keys={controller.icon_keys}
                                plant_count={controller.plant_count}
                            />
                            <PadSemantics
                                controller={controller}
                                whyRecords={whyRecords}
                                nextRecords={nextRecords}
                            />
                            <PadActions
                                controller={controller}
                                activeDomain={activeDomain}
                                onEditRules={onEditRules}
                                isRightPanelOpen={isRightPanelOpen}
                                rightPanel={rightPanel}
                                closeRightPanel={closeRightPanel}
                                next={nextRecords[controller.controller_id]}
                                onControllerAction={onControllerAction}
                                activeZoneKey={activeZoneKey}
                                activeZoneText={activeZoneText}
                                onEditController={onEditController}
                            />

                            <PadFooter />

                        </div>
                    )
                })}
            </div>}
        </div>
    )

}
