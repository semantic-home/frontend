import {useEffect, useState} from "react";
import buttonStyles from "../../../../styles/Button.module.css";
import styles from "./CreateControllerForm.module.css";
import {
    deleteWateringController,
    makeAgentsApi,
    makeControllersApi,
    updateWateringController
} from "../../../../api/controllers.ts";
import type {
    AgentView,
    WateringControllerCreate,
    WateringControllerUpdate,
    WateringControllerView
} from "../../../../api/types.ts";
import type {ZoneKey} from "../../../MainView.tsx";
import {ApiError} from "../../../../api/http.ts";
import {joinClassNames} from "../../../../utils/classNames.ts";
import {fetchClassifications, type EntityClassificationView} from "../../../../api/classifications.ts";
import {RemoveIconButton} from "./RemoveIconButton.tsx";

type MissingEntitiesErrorDetail = {
    error: "missing_entities"
    missing: string[]
    hint?: string
}

type CreateControllerFormProps = {
    mode: "create" | "edit"
    zoneId: ZoneKey
    zoneLabel: string
    controllerId?: string
    onControllerCreated: () => void
    onControllerDeleted: () => void
}

type CreateControllerDraft = {
    controllerId: string
    displayName: string
    actuatorEntityIds: string
    moistureSensorEntityIds: string
    moistureStartBelow: string
    plantIds: string
    agentId: string
}

type DraftEntityField = "actuatorEntityIds" | "moistureSensorEntityIds"

const DEFAULT_DRAFT: CreateControllerDraft = {
    controllerId: "",
    displayName: "",
    actuatorEntityIds: "",
    moistureSensorEntityIds: "",
    moistureStartBelow: "35",
    plantIds: "",
    agentId: "",
}

const WATERING_AREA_HINTS_BY_ZONE: Partial<Record<ZoneKey, string[]>> = {
    living_room: ["living_room"],
    bedroom: ["bedroom"],
    kitchen_watering: ["kitchen"],
}

function zoneHintsFor(zoneId: ZoneKey): string[] {
    return WATERING_AREA_HINTS_BY_ZONE[zoneId] ?? [zoneId]
}

function compareEntityOptions(left: EntityClassificationView, right: EntityClassificationView, zoneId: ZoneKey): number {
    const zoneHints = zoneHintsFor(zoneId)
    const leftPreferred = left.zone_hint !== null && zoneHints.includes(left.zone_hint)
    const rightPreferred = right.zone_hint !== null && zoneHints.includes(right.zone_hint)

    if (leftPreferred !== rightPreferred) {
        return leftPreferred ? -1 : 1
    }

    return left.label.localeCompare(right.label) || left.entity_id.localeCompare(right.entity_id)
}

function splitEntityOptionsByZone(
    entities: EntityClassificationView[],
    zoneId: ZoneKey,
): {preferred: EntityClassificationView[]; others: EntityClassificationView[]} {
    const zoneHints = zoneHintsFor(zoneId)

    if (zoneHints.length === 0) {
        return {preferred: [], others: entities}
    }

    return {
        preferred: entities.filter((entity) => entity.zone_hint !== null && zoneHints.includes(entity.zone_hint)),
        others: entities.filter((entity) => entity.zone_hint === null || !zoneHints.includes(entity.zone_hint)),
    }
}

function isMissingEntitiesError(detail: unknown): detail is MissingEntitiesErrorDetail {
    if (!detail || typeof detail !== "object") {
        return false
    }

    const value = detail as Record<string, unknown>

    return (
        value.error === "missing_entities"
        && Array.isArray(value.missing)
    )
}

function parseCsvList(value: string): string[] {
    return Array.from(new Set(
        value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
    ))
}

function draftFromController(controller: WateringControllerView): CreateControllerDraft {
    return {
        controllerId: controller.controller_id,
        displayName: controller.display_name,
        actuatorEntityIds: controller.actuator_entity_ids.join(", "),
        moistureSensorEntityIds: controller.moisture_sensor_entity_ids.join(", "),
        moistureStartBelow: controller.moisture_start_below?.toString() ?? "35",
        plantIds: controller.plant_ids.join(", "),
        agentId: controller.agent_id,
    }
}

function errorMessageFrom(err: unknown, fallback: string): string {
    if (err instanceof ApiError) {
        if (isMissingEntitiesError(err.detail)) {
            const missing = err.detail.missing.join(", ")
            const hint = err.detail.hint ? ` ${err.detail.hint}` : ""
            return `Missing entities: ${missing}.${hint}`
        }
        if (err.status === 409) {
            return typeof err.detail === "string" && err.detail.trim()
                ? err.detail
                : "Controller already exists or has a conflict with another controller."
        }
        if (typeof err.detail === "string" && err.detail.trim()) {
            return err.detail
        }
        return `Error ${err.status}`
    }

    if (err instanceof Error) {
        return err.message
    }

    return fallback
}

export function CreateControllerForm(
    {
        mode,
        zoneId,
        zoneLabel,
        controllerId,
        onControllerCreated,
        onControllerDeleted,
    }: CreateControllerFormProps
) {
    const isEditMode = mode === "edit"
    const [draft, setDraft] = useState<CreateControllerDraft>(DEFAULT_DRAFT)
    const [connectedAgents, setConnectedAgents] = useState<AgentView[]>([])
    const [agentsLoadState, setAgentsLoadState] = useState<"loading" | "ready" | "error">("loading")
    const [agentsMessage, setAgentsMessage] = useState("")
    const [classifications, setClassifications] = useState<EntityClassificationView[]>([])
    const [classificationsLoadState, setClassificationsLoadState] = useState<"loading" | "ready" | "error">("loading")
    const [classificationsMessage, setClassificationsMessage] = useState("")
    const [controllerLoadState, setControllerLoadState] = useState<"loading" | "ready" | "error">(
        isEditMode ? "loading" : "ready"
    )
    const [controllerMessage, setControllerMessage] = useState("")
    const [submitState, setSubmitState] = useState<"idle" | "saving" | "deleting" | "saved" | "error">("idle")
    const [submitMessage, setSubmitMessage] = useState("")
    const [selectedActuatorToAdd, setSelectedActuatorToAdd] = useState("")
    const [selectedMoistureSensorToAdd, setSelectedMoistureSensorToAdd] = useState("")

    const updateDraft = (patch: Partial<CreateControllerDraft>) => {
        setDraft((currentDraft) => ({...currentDraft, ...patch}))
    }

    const updateDraftEntityIds = (field: DraftEntityField, entityIds: string[]) => {
        const nextValue = entityIds.join(", ")
        if (field === "actuatorEntityIds") {
            updateDraft({actuatorEntityIds: nextValue})
            return
        }
        updateDraft({moistureSensorEntityIds: nextValue})
    }

    const removeDraftEntity = (field: DraftEntityField, entityId: string) => {
        const currentEntityIds = parseCsvList(field === "actuatorEntityIds" ? draft.actuatorEntityIds : draft.moistureSensorEntityIds)
        updateDraftEntityIds(
            field,
            currentEntityIds.filter((currentEntityId) => currentEntityId !== entityId),
        )
    }

    const addDraftEntity = (field: DraftEntityField, entityId: string) => {
        if (!entityId) {
            return
        }

        const currentEntityIds = parseCsvList(field === "actuatorEntityIds" ? draft.actuatorEntityIds : draft.moistureSensorEntityIds)
        if (currentEntityIds.includes(entityId)) {
            return
        }
        updateDraftEntityIds(field, [...currentEntityIds, entityId])
    }

    useEffect(() => {
        let cancelled = false

        const loadAgents = async () => {
            setAgentsLoadState("loading")
            setAgentsMessage("")

            try {
                const response = await makeAgentsApi().list()
                if (cancelled) {
                    return
                }

                const nextConnectedAgents = response.agents.filter((agent) => agent.connected)
                setConnectedAgents(nextConnectedAgents)

                if (nextConnectedAgents.length === 0) {
                    setAgentsLoadState("error")
                    setAgentsMessage("No connected agent found.")
                    setDraft((currentDraft) => ({...currentDraft, agentId: ""}))
                    return
                }

                setAgentsLoadState("ready")
                setDraft((currentDraft) => {
                    if (nextConnectedAgents.some((agent) => agent.id === currentDraft.agentId)) {
                        return currentDraft
                    }
                    return {
                        ...currentDraft,
                        agentId: nextConnectedAgents[0].id,
                    }
                })
            } catch (err) {
                if (cancelled) {
                    return
                }

                console.error(err)
                setConnectedAgents([])
                setAgentsLoadState("error")
                setAgentsMessage("Could not load connected agents.")
                setDraft((currentDraft) => ({...currentDraft, agentId: ""}))
            }
        }

        void loadAgents()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        const loadClassifications = async () => {
            setClassificationsLoadState("loading")
            setClassificationsMessage("")

            try {
                const nextClassifications = await fetchClassifications("all")
                if (cancelled) {
                    return
                }
                setClassifications(nextClassifications)
                setClassificationsLoadState("ready")
            } catch (err) {
                if (cancelled) {
                    return
                }
                console.error(err)
                setClassifications([])
                setClassificationsLoadState("error")
                setClassificationsMessage("Could not load available entities.")
            }
        }

        void loadClassifications()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!isEditMode || !controllerId) {
            return
        }

        let cancelled = false

        const loadController = async () => {
            setControllerLoadState("loading")
            setControllerMessage("")

            try {
                const controller = await makeControllersApi<WateringControllerCreate, WateringControllerView>("watering", zoneId)
                    .get(controllerId)
                if (cancelled) {
                    return
                }
                setDraft(draftFromController(controller))
                setControllerLoadState("ready")
            } catch (err) {
                if (cancelled) {
                    return
                }
                console.error(err)
                setControllerLoadState("error")
                setControllerMessage("Could not load controller.")
            }
        }

        void loadController()

        return () => {
            cancelled = true
        }
    }, [controllerId, isEditMode, zoneId])

    const submitController = async () => {
        const actuatorEntityIds = parseCsvList(draft.actuatorEntityIds)
        const moistureSensorEntityIds = parseCsvList(draft.moistureSensorEntityIds)
        const plantIds = parseCsvList(draft.plantIds)
        const threshold = Number(draft.moistureStartBelow)
        const selectedAgentId = draft.agentId.trim()

        if (!draft.controllerId.trim() || !draft.displayName.trim()) {
            setSubmitState("error")
            setSubmitMessage("Controller ID and display name are required.")
            return
        }

        if (actuatorEntityIds.length === 0 || moistureSensorEntityIds.length === 0) {
            setSubmitState("error")
            setSubmitMessage("Add at least one actuator and one moisture sensor.")
            return
        }

        if (Number.isNaN(threshold)) {
            setSubmitState("error")
            setSubmitMessage("Threshold must be a number.")
            return
        }

        if (selectedAgentId.length === 0) {
            setSubmitState("error")
            setSubmitMessage("Select a connected agent.")
            return
        }

        if (!connectedAgents.some((agent) => agent.id === selectedAgentId)) {
            setSubmitState("error")
            setSubmitMessage("Selected agent is not connected.")
            return
        }

        setSubmitState("saving")
        setSubmitMessage("")

        try {
            if (isEditMode && controllerId) {
                const request: WateringControllerUpdate = {
                    display_name: draft.displayName.trim(),
                    actuator_entity_ids: actuatorEntityIds,
                    moisture_sensor_entity_ids: moistureSensorEntityIds,
                    moisture_start_below: threshold,
                    plant_ids: plantIds,
                    agent_id: selectedAgentId,
                    zone: {
                        zone_id: zoneId,
                        display_name: zoneLabel,
                    },
                }
                const updatedController = await updateWateringController(controllerId, request)
                setDraft(draftFromController(updatedController))
                setSubmitState("saved")
                setSubmitMessage("Controller saved")
                onControllerCreated()
                return
            }

            await makeControllersApi<WateringControllerCreate, WateringControllerView>("watering", zoneId).create({
                controller_id: draft.controllerId.trim(),
                display_name: draft.displayName.trim(),
                actuator_entity_ids: actuatorEntityIds,
                moisture_sensor_entity_ids: moistureSensorEntityIds,
                moisture_start_below: threshold,
                plant_ids: plantIds,
                agent_id: selectedAgentId,
                zone: {
                    zone_id: zoneId,
                    display_name: zoneLabel,
                },
            })
            setSubmitState("saved")
            setSubmitMessage("Controller created")
            onControllerCreated()
        } catch (err) {
            console.error(err)
            setSubmitState("error")
            setSubmitMessage(errorMessageFrom(err, isEditMode ? "Save failed" : "Create failed"))
        }
    }

    const handleDeleteController = async () => {
        if (!controllerId) {
            return
        }

        if (!window.confirm(`Delete controller "${draft.displayName || controllerId}"?`)) {
            return
        }

        setSubmitState("deleting")
        setSubmitMessage("")

        try {
            await deleteWateringController(controllerId)
            setSubmitState("saved")
            setSubmitMessage("Controller deleted")
            onControllerDeleted()
        } catch (err) {
            console.error(err)
            setSubmitState("error")
            setSubmitMessage(errorMessageFrom(err, "Delete failed"))
        }
    }

    const actuatorEntityIds = parseCsvList(draft.actuatorEntityIds)
    const moistureSensorEntityIds = parseCsvList(draft.moistureSensorEntityIds)
    const entityById = new Map(classifications.map((entity) => [entity.entity_id, entity]))
    const availableActuatorOptions = classifications
        .filter((entity) => (
            entity.domain_hint === "watering"
            && entity.role === "actuator"
            && entity.semantic_type === "water_pump"
            && !actuatorEntityIds.includes(entity.entity_id)
        ))
        .sort((left, right) => compareEntityOptions(left, right, zoneId))
    const availableMoistureSensorOptions = classifications
        .filter((entity) => (
            entity.domain_hint === "watering"
            && entity.role === "sensor"
            && entity.semantic_type === "moisture_sensor"
            && !moistureSensorEntityIds.includes(entity.entity_id)
        ))
        .sort((left, right) => compareEntityOptions(left, right, zoneId))
    const groupedActuatorOptions = splitEntityOptionsByZone(availableActuatorOptions, zoneId)
    const groupedMoistureSensorOptions = splitEntityOptionsByZone(availableMoistureSensorOptions, zoneId)

    if (controllerLoadState === "loading") {
        return <div className={styles.form}>Loading controller...</div>
    }

    if (controllerLoadState === "error") {
        return <div className={styles.form}>{controllerMessage}</div>
    }

    return (
        <form
            className={styles.form}
            onSubmit={(event) => {
                event.preventDefault()
                void submitController()
            }}
        >
            <div className={styles.section}>
                <div className={styles.sectionTitle}>BASICS</div>
                <div className={styles.sectionBody}>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Zone</div>
                        <div className={styles.readonlyField}>{zoneLabel}</div>
                    </div>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Controller ID</div>
                        <input
                            className={styles.formField}
                            type="text"
                            value={draft.controllerId}
                            onChange={(event) => updateDraft({controllerId: event.target.value})}
                            placeholder="right_window_controller"
                            disabled={isEditMode}
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Display name</div>
                        <input
                            className={styles.formField}
                            type="text"
                            value={draft.displayName}
                            onChange={(event) => updateDraft({displayName: event.target.value})}
                            placeholder="Right Window"
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Agent ID</div>
                        <select
                            className={styles.formField}
                            value={draft.agentId}
                            onChange={(event) => updateDraft({agentId: event.target.value})}
                            disabled={agentsLoadState === "loading" || connectedAgents.length === 0}
                        >
                            <option value="">
                                {agentsLoadState === "loading" ? "Loading connected agents..." : "Select agent"}
                            </option>
                            {connectedAgents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name ? `${agent.name} (${agent.id})` : agent.id}
                                </option>
                            ))}
                        </select>
                        {agentsMessage ? (
                            <div className={styles.fieldHint}>{agentsMessage}</div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.sectionTitle}>ENTITIES</div>
                <div className={styles.sectionBody}>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Actuator entities</div>
                        <div className={styles.linkedEntityList}>
                            {actuatorEntityIds.length > 0 ? actuatorEntityIds.map((entityId) => {
                                const entity = entityById.get(entityId)
                                return (
                                    <div key={entityId} className={styles.linkedEntityRow}>
                                        <div className={styles.linkedEntityCopy}>
                                            <span className={styles.linkedEntityLabel}>
                                                {entity?.label ?? "Linked actuator"}
                                            </span>
                                            <span className={styles.linkedEntityId}>{entityId}</span>
                                        </div>
                                        <RemoveIconButton
                                            className={styles.removeEntityButton}
                                            onClick={() => removeDraftEntity("actuatorEntityIds", entityId)}
                                            ariaLabel={`Remove actuator ${entity?.label ?? entityId}`}
                                            title="Remove actuator"
                                        />
                                    </div>
                                )
                            }) : (
                                <div className={styles.linkedEntityEmpty}>No actuator linked yet.</div>
                            )}
                        </div>
                        <div className={styles.entityPickerRow}>
                            <select
                                className={styles.formField}
                                value={selectedActuatorToAdd}
                                onChange={(event) => setSelectedActuatorToAdd(event.target.value)}
                                disabled={classificationsLoadState !== "ready" || availableActuatorOptions.length === 0}
                            >
                                <option value="">Select actuator</option>
                                {groupedActuatorOptions.preferred.length > 0 && (
                                    <optgroup label={`Same zone (${zoneLabel})`}>
                                        {groupedActuatorOptions.preferred.map((entity) => (
                                            <option key={entity.entity_id} value={entity.entity_id}>
                                                {entity.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                {groupedActuatorOptions.others.length > 0 && (
                                    <optgroup label="Other watering actuators">
                                        {groupedActuatorOptions.others.map((entity) => (
                                            <option key={entity.entity_id} value={entity.entity_id}>
                                                {entity.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                            <button
                                className={joinClassNames(buttonStyles.button, styles.addEntityButton)}
                                type="button"
                                disabled={!selectedActuatorToAdd}
                                onClick={() => {
                                    addDraftEntity("actuatorEntityIds", selectedActuatorToAdd)
                                    setSelectedActuatorToAdd("")
                                }}
                            >
                                Add actuator
                            </button>
                        </div>
                        <div className={styles.fieldHint}>
                            {classificationsMessage || "Only watering actuators are shown here."}
                        </div>


                    </div>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Moisture sensors</div>
                        <div className={styles.linkedEntityList}>
                            {moistureSensorEntityIds.length > 0 ? moistureSensorEntityIds.map((entityId) => {
                                const entity = entityById.get(entityId)
                                return (
                                    <div key={entityId} className={styles.linkedEntityRow}>
                                        <div className={styles.linkedEntityCopy}>
                                            <span className={styles.linkedEntityLabel}>
                                                {entity?.label ?? "Linked moisture sensor"}
                                            </span>
                                            <span className={styles.linkedEntityId}>{entityId}</span>
                                        </div>
                                        <RemoveIconButton
                                            className={styles.removeEntityButton}
                                            onClick={() => removeDraftEntity("moistureSensorEntityIds", entityId)}
                                            ariaLabel={`Remove moisture sensor ${entity?.label ?? entityId}`}
                                            title="Remove moisture sensor"
                                        />
                                    </div>
                                )
                            }) : (
                                <div className={styles.linkedEntityEmpty}>No moisture sensor linked yet.</div>
                            )}
                        </div>
                        <div className={styles.entityPickerRow}>
                            <select
                                className={styles.formField}
                                value={selectedMoistureSensorToAdd}
                                onChange={(event) => setSelectedMoistureSensorToAdd(event.target.value)}
                                disabled={classificationsLoadState !== "ready" || availableMoistureSensorOptions.length === 0}
                            >
                                <option value="">Select moisture sensor</option>
                                {groupedMoistureSensorOptions.preferred.length > 0 && (
                                    <optgroup label={`Same zone (${zoneLabel})`}>
                                        {groupedMoistureSensorOptions.preferred.map((entity) => (
                                            <option key={entity.entity_id} value={entity.entity_id}>
                                                {entity.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                {groupedMoistureSensorOptions.others.length > 0 && (
                                    <optgroup label="Other watering sensors">
                                        {groupedMoistureSensorOptions.others.map((entity) => (
                                            <option key={entity.entity_id} value={entity.entity_id}>
                                                {entity.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                            <button
                                className={joinClassNames(buttonStyles.button, styles.addEntityButton)}
                                type="button"
                                disabled={!selectedMoistureSensorToAdd}
                                onClick={() => {
                                    addDraftEntity("moistureSensorEntityIds", selectedMoistureSensorToAdd)
                                    setSelectedMoistureSensorToAdd("")
                                }}
                            >
                                Add sensor
                            </button>
                        </div>
                        <div className={styles.fieldHint}>
                            {classificationsMessage || "Only moisture sensors classified for watering are shown here."}
                        </div>



                    </div>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Start below</div>
                        <input
                            className={styles.formField}
                            type="number"
                            value={draft.moistureStartBelow}
                            onChange={(event) => updateDraft({moistureStartBelow: event.target.value})}
                            placeholder="35"
                        />
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.sectionTitle}>PLANTS</div>
                <div className={styles.sectionBody}>
                    <div className={styles.fieldGroup}>
                        <div className={styles.fieldLabel}>Plant IDs</div>
                        <input
                            className={styles.formField}
                            type="text"
                            value={draft.plantIds}
                            onChange={(event) => updateDraft({plantIds: event.target.value})}
                            placeholder="calathea_orbifolia, ficus_elastica"
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
                    {isEditMode && (
                        <button
                            className={joinClassNames(buttonStyles.button, styles.dangerButton)}
                            type="button"
                            disabled={submitState === "saving" || submitState === "deleting"}
                            onClick={() => {
                                void handleDeleteController()
                            }}
                        >
                            {submitState === "deleting" ? "Deleting..." : "Delete controller"}
                        </button>
                    )}
                    <button
                        className={joinClassNames(buttonStyles.button, buttonStyles.submitButton)}
                        type="submit"
                        disabled={
                            submitState === "saving"
                            || submitState === "deleting"
                            || agentsLoadState === "loading"
                            || connectedAgents.length === 0
                        }
                    >
                        {submitState === "saving"
                            ? isEditMode ? "Saving..." : "Creating..."
                            : isEditMode ? "Save controller" : "Create controller"}
                    </button>
                </div>
            </div>
        </form>
    )
}
