import styles from "../styles/StatusLight.module.css";
import type {UiRuntimeStatus} from "../api/statusTypes.ts";




const STATUS_META: Record<UiRuntimeStatus, { variant: string; label: string }> = {
    IDLE: { variant: "idle", label: "Idle" },
    ACTIVATING: { variant: "activating", label: "Activating" },
    ACTIVE: { variant: "active", label: "Active" },
    DEACTIVATING: { variant: "deactivating", label: "Deactivating" },
    FAILED: { variant: "failed", label: "Failed" },
    PAUSED: { variant: "paused", label: "Paused" },
    UNKNOWN: { variant: "unknown", label: "Unknown" },
};

export function StatusLight({ status, label }: { status: UiRuntimeStatus; label?: string }) {
    const meta = STATUS_META[status] ?? STATUS_META.UNKNOWN;
    const className = `${styles.statusLight} ${styles[meta.variant]}`;  // link to CSS

    return <span
        className={className}
        role="status"
        aria-label={label || meta.label}
        data-tooltip={label || meta.label}
    />;
}
