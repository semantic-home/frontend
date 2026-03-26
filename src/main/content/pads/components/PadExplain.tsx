import type {ControllerBaseFields, WateringWhyView, WhyViewBase} from "../../../../api/types.ts";
import styles from "./PadExplain.module.css"
import buttonStyles from "../../../../styles/Button.module.css"
import {AttachedPopover} from "../../right_panel/components/AttachedPopover.tsx";

function isWateringWhyView(why: WhyViewBase | undefined): why is WateringWhyView {
    return Boolean(
        why
        && (
            "moisture_value" in why
            || "moisture_start_below" in why
            || "moisture_sensor_entity_ids" in why
        )
    )
}

export function PadExplain(
    {controller, whyRecords}:
    {controller: ControllerBaseFields, whyRecords: Record<string, WhyViewBase>}
) {
    const why = whyRecords[controller.controller_id];
    const reasonText = why?.message ?? "No reason available yet.";
    const wateringWhy = isWateringWhyView(why) ? why : null

    return (
        <div className={styles.padExplain}>
            <div className={styles.padExplainWhy}>
                Status
            </div>
            <div className={styles.padExplainBody}>
                <div className={styles.padExplainWhyText}>
                    {reasonText}
                </div>
                {why && (
                    <AttachedPopover
                        dialogAriaLabel="Reason details"
                        anchorClassName={styles.reasonDetailsAnchor}
                        triggerClassName={`${buttonStyles.detailsButton} ${styles.reasonDetailsTrigger}`}
                        popoverClassName={styles.reasonDetailsPopover}
                        arrowClassName={styles.reasonDetailsPopoverArrow}
                        trigger={<span className={styles.reasonDetailsText}>Details &gt;</span>}
                    >
                        <div className={styles.reasonDetailsContent}>
                            <div><span className={styles.detailLabel}>Decision:</span>{why.decision}</div>
                            <div><span className={styles.detailLabel}>Reason Code:</span>{why.reason_code}</div>
                            <div><span className={styles.detailLabel}>At:</span>{why.at}</div>
                            {wateringWhy?.moisture_value !== undefined && wateringWhy.moisture_value !== null && (
                                <div><span className={styles.detailLabel}>Moisture:</span>{wateringWhy.moisture_value}%</div>
                            )}
                            {wateringWhy?.moisture_start_below !== undefined && wateringWhy.moisture_start_below !== null && (
                                <div><span className={styles.detailLabel}>Threshold:</span>{wateringWhy.moisture_start_below}%</div>
                            )}
                            {wateringWhy?.moisture_sensor_entity_ids && wateringWhy.moisture_sensor_entity_ids.length > 0 && (
                                <div>
                                    <span className={styles.detailLabel}>Sensors:</span>
                                    {wateringWhy.moisture_sensor_entity_ids.join(", ")}
                                </div>
                            )}
                        </div>
                    </AttachedPopover>
                )}
            </div>
        </div>
    )
}
