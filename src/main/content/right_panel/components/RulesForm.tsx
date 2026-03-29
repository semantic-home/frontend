import type {
    PolicyFactView,
    PolicyOutcome,
    RuleUpsertDraft,
    WateringRulePreviewView,
    WateringRuleView
} from "./formTypes.ts";
import buttonStyles from "../../../../styles/Button.module.css";
import styles from "./RulesForm.module.css"
import iconStyles from "../../../../styles/Icon.module.css";
import {useCallback, useEffect, useEffectEvent, useState} from "react";
import {CircleHelp} from "lucide-react";
import {makeRuleApiCall} from "../../../../api/rules.ts";
import {AttachedPopover} from "./AttachedPopover.tsx";
import {joinClassNames} from "../../../../utils/classNames.ts";
import {RemoveIconButton} from "./RemoveIconButton.tsx";


type RulesFormProps = {
    controllerId: string
    onRuleSaved: () => void
    refreshTokenFromSkipNext: number
}

type FormEntry = "enabled" | "paused"
type Day = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU"
type Frequency = "Weekly" | "Daily"

type FormLabelItem = {
    label: FormEntry,
    displayName: string,
    className: string
}

type FrequencyItem = {
    displayName: Frequency,
    varName: string,
}

const formLabels: FormLabelItem[] = [
    {
        label: "enabled",
        displayName: "Enabled",
        className: styles.controlRowElementContainer
    },
    {
        label: "paused",
        displayName: "Paused",
        className: styles.controlRowElementContainer
    }
]

const DAYS: Day[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

const FREQUENCIES: FrequencyItem[] = [
    {
        displayName: "Weekly",
        varName: "weekly"
    },
    {
        displayName: "Daily",
        varName: "daily"
    }
]

const CONDITION_FIELDS = [
    {value: "moisture", label: "Moisture"},
    {value: "tank_level", label: "Tank Level"}
]

const CONDITION_OPERATORS = [
    {value: "<", label: "is below"},
    {value: ">", label: "is above"},
    {value: "<=", label: "is at most"},
    {value: ">=", label: "is at least"},
    {value: "=", label: "equals"}
]

const TIMEZONES = ["Europe/Berlin", "UTC"]

const DEFAULT_CONDITION: RuleUpsertDraft["conditions"][number] = {
    field: "moisture",
    op: "<",
    value: 35,
    unit: "%"
}

const WATERING_ACTIONS = [
    {value: "watering.start", label: "Start watering"}
]

const DEFAULT_DRAFT: RuleUpsertDraft = {
    enabled: true,
    paused: false,
    schedule: {
        type: "daily",
        days: [],
        at: "07:00",
        tz: "Europe/Berlin"
    },
    conditions: [{...DEFAULT_CONDITION}],
    action: {
        type: "watering.start",
        seconds: 60
    },
    expected_version: 1
}

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

function previewTriggerText(
    decision: WateringRulePreviewView["decision"] | null,
    previewState: "idle" | "loading" | "ready" | "error",
    previewMessage: string,
): string {
    if (decision?.outcome === "allow") {
        return "Would trigger"
    }
    if (decision?.outcome === "deny") {
        return "Would not trigger, find out why"
    }
    if (decision?.outcome === "unknown") {
        return "Can't evaluate, find out why"
    }
    if (previewState === "loading") {
        return "Checking live status..."
    }
    if (previewMessage) {
        return `${previewMessage}, find out why`
    }
    return "Waiting for live check..."
}

function previewBadgeLabel(outcome: PolicyOutcome): string {
    if (outcome === "allow") {
        return "Would trigger"
    }
    if (outcome === "deny") {
        return "Would skip"
    }
    return "Can’t evaluate"
}

function previewStatusClass(outcome: PolicyOutcome): string {
    if (outcome === "allow") {
        return styles.previewStatusAllow
    }
    if (outcome === "deny") {
        return styles.previewStatusDeny
    }
    return styles.previewStatusUnknown
}

function stringifyFactValue(value: string | number | null, unit?: string | null): string {
    if (value === null) {
        return "n/a"
    }
    return `${value}${unit ?? ""}`
}

function factOutcomeLabel(fact: PolicyFactView): string {
    if (fact.comparison_passed === true) {
        return "condition met"
    }
    if (fact.comparison_passed === false) {
        return "condition not met"
    }
    if (fact.status === "ok") {
        return "evaluated"
    }
    return fact.status
}


export function RulesForm({controllerId, onRuleSaved, refreshTokenFromSkipNext}: RulesFormProps) {
    const [draft, setDraft] = useState<RuleUpsertDraft>(DEFAULT_DRAFT)
    const [preview, setPreview] = useState<WateringRulePreviewView | null>(null)
    const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
    const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle")
    const [submitState, setSubmitState] = useState<"idle" | "saving" | "deleting" | "saved" | "error">("idle")
    const [submitMessage, setSubmitMessage] = useState("")
    const [previewMessage, setPreviewMessage] = useState("")
    const [hydratedControllerId, setHydratedControllerId] = useState<string | null>(null)
    const [ruleExists, setRuleExists] = useState(false)

    const updateCondition = (
        index: number,
        patch: Partial<RuleUpsertDraft["conditions"][number]>
    ) => {
        setDraft((currentDraft) => ({
            ...currentDraft,
            conditions: currentDraft.conditions.map((condition, conditionIndex) => (
                conditionIndex === index ? {...condition, ...patch} : condition
            ))
        }))
    }

    const addCondition = () => {
        setDraft((currentDraft) => ({
            ...currentDraft,
            conditions: [...currentDraft.conditions, {...DEFAULT_CONDITION}]
        }))
    }

    const removeCondition = (index: number) => {
        setDraft((currentDraft) => ({
            ...currentDraft,
            conditions: currentDraft.conditions.filter((_, conditionIndex) => conditionIndex !== index)
        }))
    }

    const requestPreview = useEffectEvent(async (rule: RuleUpsertDraft) => {
        setPreviewState("loading")
        setPreviewMessage("")

        try {
            const nextPreview = await makeRuleApiCall<RuleUpsertDraft, WateringRulePreviewView>("watering")
                .preview(controllerId, rule)
            setPreview(nextPreview)
            setPreviewState("ready")
        } catch (err) {
            console.error(err)
            setPreviewState("error")
            setPreviewMessage("Preview unavailable")
        }
    })

    const hydrateFromServerRule = useCallback((rule: WateringRuleView) => {
        setDraft({
            enabled: rule.enabled,
            paused: rule.paused,
            schedule: rule.schedule,
            conditions: rule.conditions,
            action: rule.action,
            expected_version: rule.version
        })
        setHydratedControllerId(controllerId)
        setLoadState("ready")
    }, [controllerId])

    const submitRule = async (rule: RuleUpsertDraft) => {
        setSubmitState("saving")
        setSubmitMessage("")

        try {
            const savedRule = await makeRuleApiCall<RuleUpsertDraft, WateringRuleView>("watering").upsert(controllerId, rule)
            setDraft((currentDraft) => ({
                ...currentDraft,
                expected_version: savedRule.version
            }))
            setRuleExists(true)
            setSubmitState("saved")
            setSubmitMessage("Rule saved")
            onRuleSaved()
        } catch (err) {
            const message = err instanceof Error ? err.message : "Save failed"
            console.error(err)

            if (message.includes("HTTP 409")) {
                try {
                    const latestRule = await makeRuleApiCall<RuleUpsertDraft, WateringRuleView>("watering").get(controllerId)
                    hydrateFromServerRule(latestRule)
                    setSubmitState("error")
                    setSubmitMessage("Rule changed on the server. Reloaded latest version.")
                    return
                } catch (reloadErr) {
                    console.error(reloadErr)
                }
            }

            setSubmitState("error")
            setSubmitMessage(
                message.includes("HTTP 409")
                    ? "Save failed: rule changed on the server"
                    : "Save failed"
            )
        }
    }

    useEffect(() => {
        let cancelled = false

        const loadRule = async () => {
            setLoadState("loading")
            setPreview(null)
            setSubmitState("idle")
            setSubmitMessage("")
            setPreviewState("idle")
            setPreviewMessage("")
            setHydratedControllerId(null)
            setRuleExists(false)

            try {
                const currentRule = await makeRuleApiCall<RuleUpsertDraft, WateringRuleView>("watering").get(controllerId)
                if (cancelled) {
                    return
                }

                setRuleExists(true)
                hydrateFromServerRule(currentRule)
            } catch (err) {
                if (cancelled) {
                    return
                }

                const message = err instanceof Error ? err.message : "Could not load rule"
                if (message.includes("HTTP 404")) {
                    setDraft({...DEFAULT_DRAFT})
                    setHydratedControllerId(controllerId)
                    setRuleExists(false)
                    setLoadState("ready")
                    return
                }

                console.error(err)
                setLoadState("error")
                setPreviewState("error")
                setPreviewMessage("Could not load rule")
            }
        }

        void loadRule()

        return () => {
            cancelled = true
        }
    }, [controllerId, hydrateFromServerRule])

    useEffect(() => {
        if (hydratedControllerId !== controllerId) {
            return
        }

        const timerId = window.setTimeout(() => {
            void requestPreview(draft)
        }, 300)

        return () => {
            window.clearTimeout(timerId)
        }
    }, [controllerId, draft, hydratedControllerId, refreshTokenFromSkipNext])

    const deleteRule = async () => {
        if (!ruleExists) {
            return
        }

        if (!window.confirm(`Delete rule for "${controllerId}"?`)) {
            return
        }

        setSubmitState("deleting")
        setSubmitMessage("")

        try {
            await makeRuleApiCall<RuleUpsertDraft, WateringRuleView>("watering").delete(controllerId)
            setDraft({...DEFAULT_DRAFT})
            setPreview(null)
            setPreviewState("idle")
            setPreviewMessage("")
            setRuleExists(false)
            setSubmitState("saved")
            setSubmitMessage("Rule deleted")
            onRuleSaved()
        } catch (err) {
            const message = err instanceof Error ? err.message : "Delete failed"
            console.error(err)
            setSubmitState("error")
            setSubmitMessage(message)
        }
    }

    const checkboxInput = (entry: FormEntry) => {
        return (
            <div
                className={formLabels.find((label) => label.label === entry)?.className}
                key={entry}
            >
                <label className={styles.switchRow}>
                    <span className={styles.switchText}>
                        {formLabels.find((label) => label.label === entry)?.displayName}
                    </span>
                    <span className={styles.switch}>
                        <input
                            className={styles.switchInput}
                            type="checkbox"
                            checked={draft[entry]}
                            onChange={(event) => {
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    [entry]: event.target.checked
                                }))
                            }}
                        />
                        <span className={styles.switchSlider} aria-hidden="true"/>
                    </span>
                </label>
            </div>
        )
    }

    const repeatBox = (frequency: FrequencyItem) => {
        return (
            <button
                key={frequency.varName}
                type="button"
                className={joinClassNames(
                    buttonStyles.button,
                    styles.controlRowElementContainer,
                    styles.optionChip,
                    draft.schedule.type === frequency.varName ? styles.optionChipActive : "",
                )}
                onClick={() => (
                    setDraft((currentDraft) => ({
                        ...currentDraft,
                        schedule: {
                            ...currentDraft.schedule,
                            type: frequency.varName
                        }
                    }))
                )}
            >
                {frequency.displayName}
            </button>
        )
    }

    const dayCheckbox = (day: Day) => {
        const isDailySchedule = draft.schedule.type === "daily"
        const isDayActive = isDailySchedule || draft.schedule.days.includes(day)

        return (
            <button
                key={day}
                type="button"
                className={joinClassNames(
                    buttonStyles.button,
                    styles.controlRowElementContainer,
                    styles.optionChip,
                    isDayActive ? styles.optionChipActive : "",
                )}
                onClick={() => {
                    if (isDailySchedule) {
                        return
                    }

                    setDraft((currentDraft) => ({
                        ...currentDraft,
                        schedule: {
                            ...currentDraft.schedule,
                            days: currentDraft.schedule.days.includes(day)
                                ? currentDraft.schedule.days.filter((selectedDay) => selectedDay !== day)
                                : [...currentDraft.schedule.days, day]
                        }
                    }))
                }}
                aria-pressed={isDayActive}
                aria-disabled={isDailySchedule}
            >
                {day}
            </button>
        )
    }

    const renderFact = (fact: PolicyFactView, index: number) => {
        const selectedValue = stringifyFactValue(fact.selected_value, fact.unit)
        const expectedValue = stringifyFactValue(fact.expected_value, fact.unit)

        return (
            <div key={`${fact.field}-${index}`} className={styles.factCard}>
                <div className={styles.factHeader}>
                    <span className={styles.factField}>{fact.field}</span>
                    <span className={styles.factStatus}>{factOutcomeLabel(fact)}</span>
                </div>
                <div className={styles.factMessage}>{fact.message}</div>
                <div className={styles.factDetails}>
                    {fact.selected_entity_id && (
                        <span className={styles.infoChip}>sensor {fact.selected_entity_id}</span>
                    )}
                    {fact.operator && (
                        <span className={styles.infoChip}>{selectedValue} {fact.operator} {expectedValue}</span>
                    )}
                </div>
            </div>
        )
    }

    const previewDecision = preview?.decision ?? null
    const previewSummary = preview?.summary ?? "Waiting for summary"
    const nextRunLabel = formatNextRun(preview?.next_run_at ?? null)
    const previewInfoText = previewDecision?.message
        ?? (previewState === "loading" ? "Refreshing preview..." : previewMessage || "Waiting for preview")
    const triggerText = previewTriggerText(previewDecision, previewState, previewMessage)

    if (loadState === "loading") {
        return <div className={styles.rulesForm}>Loading rule...</div>
    }

    if (loadState === "error") {
        return <div className={styles.rulesForm}>Could not load rule.</div>
    }

    return (
        <form
            className={styles.rulesForm}
            key={controllerId}
            onSubmit={(event) => {
                event.preventDefault()
                void submitRule(draft)
            }}
        >
            <div className={`${styles.formElementContainer} ${styles.statusContainer}`}>
                <div className={styles.controlContainerTitle}>STATUS</div>
                <div className={styles.controlRow}>
                    {checkboxInput("enabled")}
                    {checkboxInput("paused")}
                </div>
            </div>

            <div className={`${styles.formElementContainer} ${styles.scheduleContainer}`}>
                <div className={styles.controlContainerTitle}>SCHEDULE</div>
                <div className={styles.sectionBody}>
                    <div className={styles.controlGroup}>
                        <div className={styles.controlContainerSubtitle}>Repeat</div>
                        <div className={styles.controlRow}>
                            {FREQUENCIES.map(repeatBox)}
                        </div>
                    </div>
                    <div className={styles.controlGroup}>
                        <div className={styles.controlContainerSubtitle}>Days</div>
                        <div className={`${styles.controlRow} ${styles.daysRow}`}>
                            {DAYS.map(dayCheckbox)}
                        </div>
                    </div>
                    <div className={styles.controlGroupRow}>
                        <div className={styles.controlGroup}>
                            <div className={styles.controlContainerSubtitle}>Time</div>
                            <div className={styles.controlRow}>
                                <input
                                    className={styles.formField}
                                    type="time"
                                    value={draft.schedule.at}
                                    onChange={(event) => (
                                        setDraft((currentDraft) => ({
                                            ...currentDraft,
                                            schedule: {
                                                ...currentDraft.schedule,
                                                at: event.target.value
                                            }
                                        }))
                                    )}
                                />
                            </div>
                        </div>
                        <div className={styles.controlGroup}>
                            <div className={styles.controlContainerSubtitle}>Timezone</div>
                            <div className={styles.controlRow}>
                                <select
                                    className={styles.formField}
                                    value={draft.schedule.tz}
                                    onChange={(event) => (
                                        setDraft((currentDraft) => ({
                                            ...currentDraft,
                                            schedule: {
                                                ...currentDraft.schedule,
                                                tz: event.target.value
                                            }
                                        }))
                                    )}
                                >
                                    {TIMEZONES.map((timezone) => (
                                        <option key={timezone} value={timezone}>{timezone}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`${styles.formElementContainer} ${styles.conditionsContainer}`}>
                <div className={styles.controlContainerTitle}>CONDITIONS</div>
                <div className={styles.sectionBody}>
                    <div className={styles.conditionsList}>
                        {draft.conditions.map((condition, index) => (
                            <div key={`${condition.field}-${index}`} className={styles.conditionLine}>
                                <div className={styles.conditionRow}>
                                    <select
                                        className={styles.formField}
                                        value={condition.field}
                                        onChange={(event) => updateCondition(index, {field: event.target.value})}
                                    >
                                        {CONDITION_FIELDS.map((field) => (
                                            <option key={field.value} value={field.value}>{field.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        className={styles.formField}
                                        value={condition.op}
                                        onChange={(event) => updateCondition(index, {op: event.target.value})}
                                    >
                                        {CONDITION_OPERATORS.map((operator) => (
                                            <option key={operator.value} value={operator.value}>{operator.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        className={joinClassNames(styles.formField, styles.conditionValueField)}
                                        type="number"
                                        value={condition.value}
                                        onChange={(event) => updateCondition(index, {
                                            value: event.target.value === "" ? "" : Number(event.target.value)
                                        })}
                                    />
                                    <input
                                        className={joinClassNames(styles.formField, styles.conditionUnitField)}
                                        type="text"
                                        value={condition.unit ?? ""}
                                        onChange={(event) => updateCondition(index, {unit: event.target.value})}
                                    />
                                </div>
                                <RemoveIconButton
                                    className={styles.conditionRemoveButton}
                                    onClick={() => removeCondition(index)}
                                    disabled={draft.conditions.length === 1}
                                    ariaLabel={`Remove condition ${index + 1}`}
                                    title="Remove condition"
                                />
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={joinClassNames(buttonStyles.button, buttonStyles.addConditionButton)}
                        onClick={addCondition}
                    >
                        Add condition
                    </button>
                </div>
            </div>

            <div className={`${styles.formElementContainer} ${styles.summaryContainer}`}>
                <div className={styles.controlContainerTitle}>LIVE CHECK</div>
                <div className={`${styles.sectionBody} ${styles.previewSectionBody}`}>
                    <AttachedPopover
                        dialogAriaLabel="Rule explanation"
                        anchorClassName={styles.previewAnchor}
                        triggerClassName={styles.previewTrigger}
                        popoverClassName={styles.previewPopover}
                        arrowClassName={styles.previewPopoverArrow}
                        placement="top"
                        trigger={(
                            <>
                                <CircleHelp className={joinClassNames(iconStyles.icon, styles.previewTriggerIcon)} aria-hidden="true"/>
                                <span className={styles.previewTriggerText}>{triggerText}</span>
                            </>
                        )}
                    >
                        <div className={styles.previewPopoverHeader}>
                            {previewDecision && (
                                <span
                                    className={joinClassNames(
                                        styles.previewStatus,
                                        previewStatusClass(previewDecision.outcome),
                                    )}
                                >
                                    {previewBadgeLabel(previewDecision.outcome)}
                                </span>
                            )}
                            <span className={styles.previewNextRun}>Next run: {nextRunLabel}</span>
                        </div>

                        <div className={styles.previewSummaryLabel}>Summary</div>
                        <div className={styles.previewSummaryCard}>{previewSummary}</div>
                        <p className={styles.previewMessage}>{previewInfoText}</p>

                        {previewDecision && (
                            <div className={styles.previewReason}>
                                Status/Reason: {previewDecision.reason_code}
                                {previewDecision.effective_seconds !== null ? ` · Effective duration: ${previewDecision.effective_seconds}s` : ""}
                            </div>
                        )}

                        {previewDecision && previewDecision.facts.length > 0 && (
                            <AttachedPopover
                                dialogAriaLabel="Rule details"
                                anchorClassName={styles.detailsAnchor}
                                triggerClassName={`${buttonStyles.detailsButton} ${styles.detailsTrigger}`}
                                popoverClassName={styles.detailsPopover}
                                arrowClassName={styles.detailsPopoverArrow}
                                trigger={<span className={styles.detailsTriggerText}>Details &gt;</span>}
                            >
                                <div className={styles.detailsPopoverTitle}>Details</div>
                                <div className={styles.factsList}>
                                    {previewDecision.facts.map(renderFact)}
                                </div>
                            </AttachedPopover>
                        )}
                    </AttachedPopover>
                </div>
            </div>

            <div className={`${styles.formElementContainer} ${styles.actionContainer}`}>
                <div className={styles.controlContainerTitle}>ACTION</div>
                <div className={styles.sectionBody}>
                    <div className={styles.actionLine}>
                        <select
                            className={styles.formField}
                            value={draft.action.type}
                            onChange={(event) => (
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    action: {
                                        ...currentDraft.action,
                                        type: event.target.value
                                    }
                                }))
                            )}
                        >
                            {WATERING_ACTIONS.map((action) => (
                                <option key={action.value} value={action.value}>
                                    {action.label}
                                </option>
                            ))}
                        </select>
                        <input
                            className={styles.formField}
                            type="number"
                            value={draft.action.seconds}
                            onChange={(event) => (
                                setDraft((currentDraft) => ({
                                    ...currentDraft,
                                    action: {
                                        ...currentDraft.action,
                                        seconds: event.target.value === "" ? 0 : Number(event.target.value)
                                    }
                                }))
                            )}
                        />
                    </div>
                </div>
            </div>

            <div className={styles.submitRow}>
                <div
                    className={joinClassNames(
                        styles.submitMessage,
                        submitState === "saved" ? styles.submitMessageSuccess : "",
                        submitState === "error" ? styles.submitMessageError : "",
                    )}
                    aria-live="polite"
                >
                    {submitMessage}
                </div>
                <div className={styles.submitActions}>
                    {ruleExists && (
                        <button
                            className={joinClassNames(buttonStyles.button, styles.deleteButton)}
                            type="button"
                            disabled={submitState === "saving" || submitState === "deleting"}
                            onClick={() => {
                                void deleteRule()
                            }}
                        >
                            {submitState === "deleting" ? "Deleting..." : "Delete rule"}
                        </button>
                    )}
                    <button
                        className={joinClassNames(buttonStyles.button, buttonStyles.submitButton)}
                        type="submit"
                        disabled={submitState === "saving" || submitState === "deleting"}
                    >
                        {submitState === "saving" ? "Saving..." : "Save rule"}
                    </button>
                </div>
            </div>
        </form>
    )
}
