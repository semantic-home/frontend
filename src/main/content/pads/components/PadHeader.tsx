import styles from "./PadHeader.module.css"
import type {LucideIcon} from "lucide-react";
import {Droplets, Flower2, Leaf, Sprout, Trees} from "lucide-react";
import {StatusLight} from "../../../../styles/StatusLight.tsx";
import type {UiRuntimeStatus} from "../../../../api/statusTypes.ts";

const PLANT_ICON: Record<string, LucideIcon> = {
    leaf: Leaf,
    sprout: Sprout,
    flower: Flower2,
    trees: Trees,
    droplets: Droplets
};

export function PadHeader(
    {controller_name, uiStatus, icon_keys = [], plant_count}:
    {controller_name: string, uiStatus: UiRuntimeStatus, icon_keys?: string[], plant_count?: number}
) {
    const total = plant_count ?? icon_keys.length;
    const primary_key = icon_keys[0] ?? "leaf";
    const additional_count = Math.max(0, total - 1);
    const PrimaryIcon = PLANT_ICON[primary_key] ?? Leaf;




    return (
        <div className={styles.padHeader}>
            <span className={styles.avatar} aria-hidden="true">
                <PrimaryIcon className={styles.avatarIcon}/>
                {additional_count > 0 && <span className={styles.avatarBadge}>+{additional_count}</span>}
            </span>

            <h4 className={styles.padTitle}>{controller_name}</h4>

            <StatusLight status={uiStatus} />

        </div>
    )
}
