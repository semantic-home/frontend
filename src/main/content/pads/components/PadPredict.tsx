import type {WateringNextView} from "../../../../api/types.ts";
import styles from "./PadPredict.module.css"

function formatNextRun(value: string | null): string {
    if (!value) {
        return "No next run"
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return "No next run"
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

export function PadPredict({next}: {next?: WateringNextView}) {
    return (
        <div className={styles.padPredict}>
            <div className={styles.padPredictNext}>
                Next
            </div>
            <div className={styles.padPredictNextText}>
                {formatNextRun(next?.next_run_at ?? null)}
            </div>
        </div>
    )
}
