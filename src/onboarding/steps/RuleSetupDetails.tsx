import {useEffect, useState} from "react"
import {ApiError, httpGet} from "../../api/http.ts"
import {makeRuleApiCall} from "../../api/rules.ts"
import type {WateringControllerView} from "../../api/types.ts"
import type {RuleUpsertDraft, WateringRuleView} from "../../main/content/right_panel/components/formTypes.ts"
import {RulesForm} from "../../main/content/right_panel/components/RulesForm.tsx"
import buttonStyles from "../../styles/Button.module.css"
import {joinClassNames} from "../../utils/classNames.ts"
import styles from "./Details.module.css"

type Props = {
    onComplete: () => void
    preferredControllerIds?: string[]
}

function sortControllers(
    controllers: WateringControllerView[],
    preferredControllerIds: string[],
): WateringControllerView[] {
    const priorityById = new Map(preferredControllerIds.map((controllerId, index) => [controllerId, index]))

    return [...controllers].sort((left, right) => {
        const leftPriority = priorityById.get(left.controller_id) ?? Number.MAX_SAFE_INTEGER
        const rightPriority = priorityById.get(right.controller_id) ?? Number.MAX_SAFE_INTEGER
        if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority
        }
        return left.display_name.localeCompare(right.display_name)
    })
}

export function RuleSetupDetails({onComplete, preferredControllerIds = []}: Props) {
    const [controllers, setControllers] = useState<WateringControllerView[]>([])
    const [selectedControllerId, setSelectedControllerId] = useState("")
    const [configuredControllerIds, setConfiguredControllerIds] = useState<Set<string>>(new Set())
    const [savedControllerIds, setSavedControllerIds] = useState<Set<string>>(new Set())
    const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
    const [loadMessage, setLoadMessage] = useState("")

    useEffect(() => {
        let cancelled = false

        const loadControllers = async () => {
            setLoadState("loading")
            setLoadMessage("")

            try {
                const response = await httpGet<WateringControllerView[]>("/domains/watering/controllers")
                const orderedControllers = sortControllers(response, preferredControllerIds)
                const ruleApi = makeRuleApiCall<RuleUpsertDraft, WateringRuleView>("watering")
                const configuredIds = await Promise.all(
                    orderedControllers.map(async (controller) => {
                        try {
                            await ruleApi.get(controller.controller_id)
                            return controller.controller_id
                        } catch (error) {
                            if (error instanceof ApiError && error.status === 404) {
                                return null
                            }
                            console.error(error)
                            return null
                        }
                    })
                )

                if (cancelled) {
                    return
                }

                setControllers(orderedControllers)
                setConfiguredControllerIds(new Set(configuredIds.filter((value): value is string => value !== null)))
                setSelectedControllerId((currentValue) => {
                    if (currentValue && orderedControllers.some((controller) => controller.controller_id === currentValue)) {
                        return currentValue
                    }
                    return orderedControllers[0]?.controller_id ?? ""
                })
                setLoadState("ready")
            } catch (error) {
                if (cancelled) {
                    return
                }

                console.error(error)
                setLoadState("error")
                setLoadMessage("Could not load controllers for rule setup.")
            }
        }

        void loadControllers()

        return () => {
            cancelled = true
        }
    }, [preferredControllerIds])

    const selectedController = controllers.find((controller) => controller.controller_id === selectedControllerId) ?? null
    const readyControllerIds = new Set<string>([...configuredControllerIds, ...savedControllerIds])
    const canFinish = controllers.length > 0 && readyControllerIds.size > 0

    if (loadState === "loading") {
        return (
            <div className={styles.panel}>
                <p className={styles.panelStatus}>Loading controllers for automation rules...</p>
            </div>
        )
    }

    if (loadState === "error") {
        return (
            <div className={styles.panel}>
                <p className={styles.panelStatus}>Rule setup is temporarily unavailable</p>
                <p className={styles.errorText}>{loadMessage}</p>
            </div>
        )
    }

    if (controllers.length === 0) {
        return (
            <div className={styles.panel}>
                <p className={styles.panelStatus}>No controllers ready for rule setup yet</p>
                <p className={styles.panelHint}>Create at least one watering controller before building an automation rule.</p>
            </div>
        )
    }

    return (
        <div className={styles.panel}>
            <p className={styles.panelStatus}>
                Build your first automation rule
            </p>
            <p className={styles.panelHint}>
                {readyControllerIds.size > 0
                    ? `${readyControllerIds.size} controller${readyControllerIds.size === 1 ? "" : "s"} already have a saved rule`
                    : "Choose a controller and save at least one rule to finish onboarding"}
            </p>

            <div className={styles.controllerPicker}>
                {controllers.map((controller) => {
                    const isActive = controller.controller_id === selectedControllerId
                    const isConfigured = readyControllerIds.has(controller.controller_id)

                    return (
                        <button
                            key={controller.controller_id}
                            type="button"
                            className={joinClassNames(
                                buttonStyles.button,
                                buttonStyles.onboardingTabButton,
                                styles.controllerChip,
                                isActive ? styles.controllerChipActive : "",
                            )}
                            onClick={() => setSelectedControllerId(controller.controller_id)}
                        >
                            <span>{controller.display_name}</span>
                            <span className={styles.controllerChipMeta}>
                                {isConfigured ? "Rule saved" : "Needs rule"}
                            </span>
                        </button>
                    )
                })}
            </div>

            {selectedController && (
                <div className={styles.ruleEditorShell}>
                    <div className={styles.ruleEditorHeader}>
                        <h4 className={styles.domainLabel}>{selectedController.display_name}</h4>
                        <span className={styles.muted}>{selectedController.controller_id}</span>
                    </div>
                    <RulesForm
                        key={selectedController.controller_id}
                        controllerId={selectedController.controller_id}
                        onRuleSaved={() => {
                            setSavedControllerIds((currentIds) => new Set(currentIds).add(selectedController.controller_id))
                            setConfiguredControllerIds((currentIds) => new Set(currentIds).add(selectedController.controller_id))
                        }}
                        refreshTokenFromSkipNext={0}
                    />
                </div>
            )}

            <button
                className={joinClassNames(buttonStyles.button, buttonStyles.onboardingTabButton)}
                onClick={onComplete}
                disabled={!canFinish}
            >
                Finish setup
            </button>
        </div>
    )
}
