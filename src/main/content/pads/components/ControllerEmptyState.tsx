import styles from "./ControllerEmptyState.module.css"

export function ControllerEmptyState({unsupported = false}: {unsupported?: boolean}) {
    return <div className={styles.empty} role="status">
        <p>{unsupported ? "No controller type is available for this domain yet." : "No controllers in this zone yet."}</p>
        {!unsupported && <p>Create a controller and assign entities to get started.</p>}
    </div>
}
