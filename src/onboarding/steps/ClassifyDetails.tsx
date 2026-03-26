import {useEffect, useState} from "react"
import type {ClassificationSource, EntityClassificationView} from "../../api/classifications.ts"
import {fetchClassifications, updateClassification} from "../../api/classifications.ts"
import styles from "./Details.module.css"
import buttonStyles from "../../styles/Button.module.css"
import {joinClassNames} from "../../utils/classNames.ts"

type Props = {
    onComplete: () => void
    source?: ClassificationSource
}

const ROLE_OPTIONS = ["actuator", "sensor", "binary_sensor", "panel", "camera", "unknown"]
const DOMAIN_OPTIONS = ["watering", "lighting", "power", "surveillance"]

export function ClassifyDetails({onComplete, source = "all"}: Props) {
    const [entities, setEntities] = useState<EntityClassificationView[]>([])

    useEffect(() => {
        fetchClassifications(source).then(setEntities)
    }, [source])

    const highConfidence = entities.filter(e => e.confidence === "high")
    const needsReview = entities.filter(e => e.confidence !== "high")

    const handleChange = (entityId: string, field: "role" | "domain_hint", value: string) => {
        const override = {[field]: value || null}
        updateClassification(entityId, override).then(updated => {
            setEntities(prev => prev.map(e => e.entity_id === entityId ? updated : e))
        })
    }

    return (
        <div className={styles.panel}>
            <p className={styles.panelStatus}>
                Review entity classifications — {highConfidence.length} confirmed, {needsReview.length} need review
            </p>

            {needsReview.length > 0 && (
                <div className={styles.domainGroup}>
                    <h4 className={styles.domainLabel}>Needs review</h4>
                    {needsReview.map(e => (
                        <div key={e.entity_id} className={joinClassNames(styles.entityRow, styles.reviewRow)}>
                            <span className={styles.confidenceBadge}>{e.confidence}</span>
                            <span className={styles.entityCopy}>
                                <span className={styles.entityLabel}>{e.label}</span>
                                <span className={styles.entityId}>{e.entity_id}</span>
                            </span>
                            <select
                                className={styles.editSelect}
                                value={e.role}
                                onChange={ev => handleChange(e.entity_id, "role", ev.target.value)}
                            >
                                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select
                                className={styles.editSelect}
                                value={e.domain_hint ?? ""}
                                onChange={ev => handleChange(e.entity_id, "domain_hint", ev.target.value)}
                            >
                                <option value="">none</option>
                                {DOMAIN_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            )}

            {highConfidence.length > 0 && (
                <div className={styles.domainGroup}>
                    <h4 className={styles.domainLabel}>Confirmed</h4>
                    {highConfidence.map(e => (
                        <div key={e.entity_id} className={styles.entityRow}>
                            <span className={styles.entityLabel}>{e.label}</span>
                            <span className={styles.entityId}>{e.entity_id}</span>
                        </div>
                    ))}
                </div>
            )}

            <button
                className={joinClassNames(buttonStyles.button, buttonStyles.onboardingTabButton)}
                onClick={onComplete}
            >
                Confirm Classifications
            </button>
        </div>
    )
}
