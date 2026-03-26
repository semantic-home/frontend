import {useEffect, useState} from "react"
import type {EntityClassificationView} from "../../api/classifications.ts"
import {fetchClassifications, seedDemoData} from "../../api/classifications.ts"
import styles from "./Details.module.css"
import buttonStyles from "../../styles/Button.module.css"
import {joinClassNames} from "../../utils/classNames.ts"

type Props = { onComplete: () => void }

export function DemoLoadDetails({onComplete}: Props) {
    const [entities, setEntities] = useState<EntityClassificationView[] | null>(null)

    useEffect(() => {
        seedDemoData()
            .then(() => fetchClassifications("seed"))
            .then(setEntities)
    }, [])

    const loaded = entities !== null
    const domainCounts = loaded
        ? entities.reduce<Record<string, number>>((acc, e) => {
            const key = e.domain_hint ?? "other"
            acc[key] = (acc[key] ?? 0) + 1
            return acc
        }, {})
        : {}

    return (
        <div className={styles.panel}>
            {!loaded && (
                <p className={styles.panelStatus}>Loading simulated home environment...</p>
            )}

            {loaded && (
                <>
                    <p className={styles.panelStatus}>
                        {entities.length} demo entities loaded
                    </p>
                    {Object.entries(domainCounts).map(([domain, count]) => (
                        <div key={domain} className={styles.entityRow}>
                            <span className={styles.entityLabel}>{domain}</span>
                            <span className={styles.muted}>{count} entities</span>
                        </div>
                    ))}
                    <button
                        className={joinClassNames(buttonStyles.button, buttonStyles.onboardingTabButton)}
                        onClick={onComplete}
                    >
                        Continue
                    </button>
                </>
            )}
        </div>
    )
}
