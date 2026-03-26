import type {EntityClassificationView} from "../../api/classifications.ts"
import {fetchClassifications} from "../../api/classifications.ts"
import {usePolling} from "../hooks/usePolling.ts"
import styles from "./Details.module.css"
import buttonStyles from "../../styles/Button.module.css"
import {joinClassNames} from "../../utils/classNames.ts"

type Props = { onComplete: () => void }

function groupByDomain(entities: EntityClassificationView[]): Record<string, EntityClassificationView[]> {
    const groups: Record<string, EntityClassificationView[]> = {}
    for (const e of entities) {
        const key = e.domain_hint ?? "other"
        ;(groups[key] ??= []).push(e)
    }
    return groups
}

export function EntityDiscoveryDetails({onComplete}: Props) {
    const {data} = usePolling(() => fetchClassifications("agent"), {intervalMs: 3000})
    const entities = data ?? []
    const grouped = groupByDomain(entities)

    return (
        <div className={styles.panel}>
            <p className={styles.panelStatus}>
                {entities.length === 0
                    ? "Scanning for entities..."
                    : `${entities.length} entities discovered`
                }
            </p>

            {Object.entries(grouped).map(([domain, items]) => (
                <div key={domain} className={styles.domainGroup}>
                    <h4 className={styles.domainLabel}>{domain} ({items.length})</h4>
                    {items.map(e => (
                        <div key={e.entity_id} className={styles.entityRow}>
                            <span className={styles.entityLabel}>{e.label}</span>
                            <span className={styles.entityId}>{e.entity_id}</span>
                        </div>
                    ))}
                </div>
            ))}

            {entities.length > 0 && (
                <button
                    className={joinClassNames(buttonStyles.button, buttonStyles.onboardingTabButton)}
                    onClick={onComplete}
                >
                    Continue
                </button>
            )}
        </div>
    )
}
