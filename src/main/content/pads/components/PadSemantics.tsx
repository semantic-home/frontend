import {PadExplain} from "./PadExplain.tsx";
import type {ControllerViewBase, WateringNextView, WhyViewBase} from "../../../../api/types.ts";
import styles from "./PadSemantics.module.css"
import {PadPredict} from "./PadPredict.tsx";

export function PadSemantics (
    {
        controller,
        whyRecords,
        nextRecords
    }: {
        controller: ControllerViewBase,
        whyRecords: Record<string, WhyViewBase>,
        nextRecords: Record<string, WateringNextView>
    }
) {
    return (
        <div className={styles.padSemantics}>
            <PadExplain controller={controller} whyRecords={whyRecords} />
            <PadPredict next={nextRecords[controller.controller_id]} />
        </div>
    )

}
