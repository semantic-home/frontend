import {useEffect} from "react";
import styles from "./RightPanel.module.css"
import type {RightPanelState} from "../../MainView.tsx";
import {RulesForm} from "./components/RulesForm.tsx";
import {CreateControllerForm} from "./components/CreateControllerForm.tsx";

type RightPanelProps = {
    isRightPanelOpen: boolean,
    closeRightPanel: () => void,
    rightPanel: RightPanelState,
    onRuleSaved: () => void
    onControllerCreated: () => void
    refreshTokenFromSkipNext: number
}

export function RightPanel(
    {
        isRightPanelOpen,
        closeRightPanel,
        rightPanel,
        onRuleSaved,
        onControllerCreated,
        refreshTokenFromSkipNext
    }: RightPanelProps
) {
    useEffect(() => {
        if (!isRightPanelOpen) {
            return
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeRightPanel()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [closeRightPanel, isRightPanelOpen])

    if (!isRightPanelOpen) {
        return null;
    }

    const title = rightPanel.mode === "create_controller"
        ? "Create Controller"
        : rightPanel.mode === "edit_controller"
            ? "Edit Controller"
            : "Edit Rules"
    const subtitle = rightPanel.mode === "edit_rule"
        ? rightPanel.controllerId
        : rightPanel.mode === "create_controller" || rightPanel.mode === "edit_controller"
            ? rightPanel.zoneLabel
            : null

    return (
        <div className={styles.panelShell}>
            <button
                type="button"
                className={styles.panelBackdrop}
                onClick={closeRightPanel}
                aria-label="Close panel"
            />
            <aside className={styles.rightPanel} aria-label="Controller sidebar">
                <div className={styles.rightPanelHeader}>
                    <div className={styles.rightPanelHeaderCopy}>
                        <h3 className={styles.rightPanelTitle}>
                            {title}
                        </h3>
                        {subtitle && (
                            <p className={styles.rightPanelSubtitle}>{subtitle}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={closeRightPanel}
                        aria-label="Close sidebar"
                    >
                        Close
                    </button>
                </div>
                <div className={styles.rightPanelBody}>
                    {rightPanel.mode === "edit_rule" && (
                        <RulesForm
                            key={rightPanel.controllerId}
                            controllerId={rightPanel.controllerId}
                            onRuleSaved={onRuleSaved}
                            refreshTokenFromSkipNext={refreshTokenFromSkipNext}
                        />
                    )}
                    {(rightPanel.mode === "create_controller" || rightPanel.mode === "edit_controller") && (
                        <CreateControllerForm
                            key={rightPanel.mode === "edit_controller"
                                ? `${rightPanel.zoneId}-${rightPanel.controllerId}-controller-form`
                                : `${rightPanel.zoneId}-controller-form`}
                            mode={rightPanel.mode === "edit_controller" ? "edit" : "create"}
                            zoneId={rightPanel.zoneId}
                            zoneLabel={rightPanel.zoneLabel}
                            controllerId={rightPanel.mode === "edit_controller" ? rightPanel.controllerId : undefined}
                            onControllerCreated={() => {
                                onControllerCreated()
                                if (rightPanel.mode === "create_controller") {
                                    closeRightPanel()
                                }
                            }}
                            onControllerDeleted={() => {
                                onControllerCreated()
                                closeRightPanel()
                            }}
                        />
                    )}
                </div>
            </aside>
        </div>
    )
}
