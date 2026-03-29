import {useEffect, useState} from "react"
import type {ClassificationSource, EntityClassificationView} from "../../api/classifications.ts"
import {fetchClassifications} from "../../api/classifications.ts"
import {createWateringController} from "../../api/controllers.ts"
import {httpGet} from "../../api/http.ts"
import type {WateringControllerCreate, WateringControllerView, ZoneView} from "../../api/types.ts"
import styles from "./Details.module.css"
import buttonStyles from "../../styles/Button.module.css"
import {joinClassNames} from "../../utils/classNames.ts"

type Props = {
    onComplete: () => void
    requiresAgent?: boolean
    onControllerCreated?: (controllerId: string) => void
    source?: ClassificationSource
}

const WATERING_ZONES: {zoneId: string; label: string; areas: string[]}[] = [
    {zoneId: "living_room", label: "Living Room", areas: ["living_room"]},
    {zoneId: "bedroom", label: "Bedroom", areas: ["bedroom"]},
    {zoneId: "kitchen_watering", label: "Kitchen", areas: ["kitchen"]},
]

interface ControllerSuggestion {
    key: string
    domain: string
    name: string
    controllerIdBase: string
    sensorCandidates: EntityClassificationView[]
    actuators: EntityClassificationView[]
    existingController: WateringControllerView | null
    guessedZone: ZoneView | null
}

function plantKey(entityId: string): string {
    const slug = entityId.split(".")[1] ?? ""
    const parts = slug.split("_")
    return parts.slice(0, -1).join("_") || slug
}

function capitalize(slug: string): string {
    return slug.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}

function stripSuggestionSuffix(label: string): string {
    return label
        .replace(/\s+(pump|valve)$/i, "")
        .replace(/\s+(soil sensor|soil moisture sensor|moisture sensor|moisture)$/i, "")
        .trim()
}

function suggestionNameFromEntities(
    slug: string,
    actuators: EntityClassificationView[],
    sensors: EntityClassificationView[],
): string {
    const genericLabels = new Set([
        "Water Pump",
        "Soil Moisture Sensor",
        "Moisture Sensor",
        "Tank Level Sensor",
        "Sensor",
    ])

    for (const entity of [...actuators, ...sensors]) {
        const label = entity.label.trim()
        if (!label || genericLabels.has(label)) {
            continue
        }
        const stripped = stripSuggestionSuffix(label)
        if (stripped && !genericLabels.has(stripped)) {
            return stripped
        }
    }

    return capitalize(slug)
}

function guessZone(entities: EntityClassificationView[]): ZoneView | null {
    for (const entity of entities) {
        if (!entity.zone_hint) {
            continue
        }
        const match = WATERING_ZONES.find((zone) => zone.areas.includes(entity.zone_hint!))
        if (match) {
            return {zone_id: match.zoneId, display_name: match.label}
        }
    }
    return null
}

function uniqueEntityIds(entities: EntityClassificationView[]): string[] {
    return Array.from(new Set(entities.map((entity) => entity.entity_id)))
}

function sameMembers(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false
    }

    return left.every((item, index) => item === right[index])
}

function defaultSelectedSensorIds(suggestion: ControllerSuggestion): string[] {
    if (suggestion.existingController?.moisture_sensor_entity_ids?.length) {
        return suggestion.existingController.moisture_sensor_entity_ids
    }

    if (suggestion.sensorCandidates.length === 0) {
        return []
    }

    return [suggestion.sensorCandidates[0].entity_id]
}

function resolveSelectedSensorIds(
    suggestions: ControllerSuggestion[],
    currentSelections: Record<string, string[]>,
): Record<string, string[]> {
    const reservedSensorIds = new Set<string>()
    const nextSelections: Record<string, string[]> = {}

    for (const suggestion of suggestions) {
        if (suggestion.domain !== "watering" || suggestion.existingController === null) {
            continue
        }

        const resolved = Array.from(new Set(suggestion.existingController.moisture_sensor_entity_ids))
        nextSelections[suggestion.key] = resolved
        for (const entityId of resolved) {
            reservedSensorIds.add(entityId)
        }
    }

    for (const suggestion of suggestions) {
        if (suggestion.domain !== "watering" || suggestion.existingController !== null) {
            continue
        }

        const validCandidateIds = uniqueEntityIds(suggestion.sensorCandidates)
        const current = (currentSelections[suggestion.key] ?? []).filter((entityId) => (
            validCandidateIds.includes(entityId) && !reservedSensorIds.has(entityId)
        ))
        const fallback = defaultSelectedSensorIds(suggestion).filter((entityId) => (
            validCandidateIds.includes(entityId) && !reservedSensorIds.has(entityId)
        ))
        const resolved = current.length > 0 ? current : fallback.slice(0, 1)

        nextSelections[suggestion.key] = resolved
        for (const entityId of resolved) {
            reservedSensorIds.add(entityId)
        }
    }

    return nextSelections
}

function availableSensorCandidates(
    suggestion: ControllerSuggestion,
    suggestions: ControllerSuggestion[],
    resolvedSelections: Record<string, string[]>,
): EntityClassificationView[] {
    if (suggestion.domain !== "watering") {
        return suggestion.sensorCandidates
    }

    const chosenSensorIds = new Set(resolvedSelections[suggestion.key] ?? [])
    const reservedElsewhere = new Set<string>()

    for (const otherSuggestion of suggestions) {
        if (otherSuggestion.domain !== "watering" || otherSuggestion.key === suggestion.key) {
            continue
        }
        for (const entityId of resolvedSelections[otherSuggestion.key] ?? []) {
            reservedElsewhere.add(entityId)
        }
    }

    return suggestion.sensorCandidates.filter((entity) => (
        chosenSensorIds.has(entity.entity_id) || !reservedElsewhere.has(entity.entity_id)
    ))
}

function buildSuggestions(
    entities: EntityClassificationView[],
    controllers: WateringControllerView[],
): ControllerSuggestion[] {
    const entityById = new Map(entities.map((entity) => [entity.entity_id, entity]))
    const wateringActuators = entities.filter((entity) => (
        entity.domain_hint === "watering"
        && entity.role === "actuator"
        && entity.semantic_type === "water_pump"
    ))

    const findExistingController = (actuatorIds: string[]): WateringControllerView | null => (
        controllers.find((controller) => (
            actuatorIds.every((actuatorId) => controller.actuator_entity_ids.includes(actuatorId))
        )) ?? null
    )

    const wateringSuggestions: ControllerSuggestion[] = wateringActuators.map((actuator) => {
        const sensorCandidates = actuator.suggested_moisture_sensor_entity_ids
            .map((entityId) => entityById.get(entityId))
            .filter((entity): entity is EntityClassificationView => (
                entity !== undefined && entity.semantic_type === "moisture_sensor"
            ))
        const controllerIdBase = plantKey(actuator.entity_id)
        return {
            key: actuator.entity_id,
            domain: "watering",
            name: suggestionNameFromEntities(controllerIdBase, [actuator], sensorCandidates),
            controllerIdBase,
            sensorCandidates,
            actuators: [actuator],
            existingController: findExistingController([actuator.entity_id]),
            guessedZone: guessZone([actuator, ...sensorCandidates]),
        }
    })

    const otherByDomain: Record<string, {sensors: EntityClassificationView[]; actuators: EntityClassificationView[]}> = {}
    for (const entity of entities) {
        if (!entity.domain_hint || entity.domain_hint === "watering") {
            continue
        }
        const group = otherByDomain[entity.domain_hint] ??= {sensors: [], actuators: []}
        if (entity.role === "actuator") {
            group.actuators.push(entity)
        } else if (entity.role === "sensor" || entity.role === "binary_sensor") {
            group.sensors.push(entity)
        }
    }

    const otherSuggestions: ControllerSuggestion[] = Object.entries(otherByDomain)
        .filter(([, group]) => group.actuators.length > 0)
        .map(([domain, group]) => ({
            key: domain,
            domain,
            name: capitalize(domain),
            controllerIdBase: domain,
            sensorCandidates: group.sensors,
            actuators: group.actuators,
            existingController: null,
            guessedZone: null,
        }))

    return [...wateringSuggestions, ...otherSuggestions]
}

export function CreateControllerDetails(
    {
        onComplete,
        requiresAgent = true,
        onControllerCreated,
        source = "all",
    }: Props,
) {
    const [entities, setEntities] = useState<EntityClassificationView[]>([])
    const [existingControllers, setExistingControllers] = useState<WateringControllerView[]>([])
    const [selectedSensorIds, setSelectedSensorIds] = useState<Record<string, string[]>>({})
    const [created, setCreated] = useState<Set<string>>(new Set())
    const [creating, setCreating] = useState<string | null>(null)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [selectedZones, setSelectedZones] = useState<Record<string, string>>({})

    useEffect(() => {
        Promise.all([
            fetchClassifications(source),
            httpGet<WateringControllerView[]>("/domains/watering/controllers"),
        ]).then(([classifications, controllers]) => {
            setEntities(classifications)
            setExistingControllers(controllers)
        })
    }, [source])

    const suggestions = buildSuggestions(entities, existingControllers)
    const resolvedSelections = resolveSelectedSensorIds(suggestions, selectedSensorIds)
    const suggestionCandidates = Object.fromEntries(
        suggestions.map((suggestion) => [
            suggestion.key,
            availableSensorCandidates(suggestion, suggestions, resolvedSelections),
        ]),
    )
    const pumpsWithoutSensorCandidates = suggestions.filter((suggestion) => (
        suggestion.domain === "watering"
        && suggestion.existingController === null
        && (suggestionCandidates[suggestion.key]?.length ?? 0) === 0
    )).length

    useEffect(() => {
        setSelectedSensorIds((currentSelections) => {
            const nextSelections = resolveSelectedSensorIds(suggestions, currentSelections)
            const wateringKeys = suggestions
                .filter((suggestion) => suggestion.domain === "watering")
                .map((suggestion) => suggestion.key)
            const changed = wateringKeys.some((key) => (
                !sameMembers(currentSelections[key] ?? [], nextSelections[key] ?? [])
            ))

            if (!changed) {
                for (const key of Object.keys(currentSelections)) {
                    if (!wateringKeys.includes(key) && currentSelections[key]?.length) {
                        return nextSelections
                    }
                }
            }

            return changed ? nextSelections : currentSelections
        })
    }, [suggestions])

    const readyControllerCount = suggestions.filter(
        (suggestion) => suggestion.domain === "watering" && (
            suggestion.existingController !== null || created.has(suggestion.key)
        )
    ).length

    const getZoneForSuggestion = (suggestion: ControllerSuggestion): ZoneView | null => {
        const selectedId = selectedZones[suggestion.key]
        if (selectedId) {
            const preset = WATERING_ZONES.find((zone) => zone.zoneId === selectedId)
            if (preset) {
                return {zone_id: preset.zoneId, display_name: preset.label}
            }
        }
        return suggestion.guessedZone
    }

    const toggleSensorCandidate = (suggestionKey: string, sensorId: string) => {
        setSelectedSensorIds((currentSelections) => {
            const current = currentSelections[suggestionKey] ?? []
            const next = current.includes(sensorId)
                ? current.filter((entityId) => entityId !== sensorId)
                : [...current, sensorId]
            return {...currentSelections, [suggestionKey]: next}
        })
    }

    const handleCreate = async (suggestion: ControllerSuggestion) => {
        const zone = getZoneForSuggestion(suggestion)
        if (!zone) {
            return
        }

        const chosenSensorIds = selectedSensorIds[suggestion.key] ?? []
        if (chosenSensorIds.length === 0) {
            setErrors((currentErrors) => ({
                ...currentErrors,
                [suggestion.key]: "Select at least one moisture sensor candidate.",
            }))
            return
        }

        setCreating(suggestion.key)
        setErrors((currentErrors) => {
            const next = {...currentErrors}
            delete next[suggestion.key]
            return next
        })

        try {
            const request: WateringControllerCreate = {
                controller_id: `${suggestion.controllerIdBase}_controller`,
                display_name: suggestion.name,
                agent_id: requiresAgent ? "home1" : "demo-seed",
                requires_agent: requiresAgent,
                actuator_entity_ids: suggestion.actuators.map((entity) => entity.entity_id),
                moisture_sensor_entity_ids: chosenSensorIds,
                moisture_start_below: 35.0,
                zone,
            }
            const createdController = await createWateringController(request)
            setCreated((currentCreated) => new Set(currentCreated).add(suggestion.key))
            setExistingControllers((currentControllers) => [...currentControllers, createdController])
            onControllerCreated?.(createdController.controller_id)
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to create controller"
            setErrors((currentErrors) => ({...currentErrors, [suggestion.key]: message}))
        } finally {
            setCreating(null)
        }
    }

    return (
        <div className={styles.panel}>
            <p className={styles.panelStatus}>
                Create controllers for your plants
            </p>
            <p className={styles.panelHint}>
                {readyControllerCount > 0
                    ? `${readyControllerCount} controller${readyControllerCount === 1 ? "" : "s"} ready for rule setup`
                    : "Create at least one watering controller before moving on to automation rules"}
            </p>
            {pumpsWithoutSensorCandidates > 0 && (
                <p className={styles.panelHint}>
                    {pumpsWithoutSensorCandidates} pump{pumpsWithoutSensorCandidates === 1 ? "" : "s"} still need a moisture sensor match
                </p>
            )}

            {suggestions.map((suggestion) => {
                const effectiveZone = getZoneForSuggestion(suggestion)
                const zoneValue = selectedZones[suggestion.key] ?? suggestion.guessedZone?.zone_id ?? ""
                const chosenSensorIds = resolvedSelections[suggestion.key] ?? []
                const availableCandidatesForSuggestion = suggestionCandidates[suggestion.key] ?? suggestion.sensorCandidates

                return (
                    <div key={suggestion.key} className={styles.suggestion}>
                        <h4 className={styles.domainLabel}>{suggestion.name}</h4>
                        <div className={styles.suggestionBody}>
                            <div>
                                <span className={styles.suggestionRole}>
                                    {suggestion.domain === "watering" ? "Suggested moisture sensors" : "Sensors"}
                                </span>
                                {availableCandidatesForSuggestion.length > 0 ? (
                                    <div className={styles.candidateList}>
                                        {availableCandidatesForSuggestion.map((entity) => {
                                            const isSelected = chosenSensorIds.includes(entity.entity_id)
                                            return (
                                                <label
                                                    key={entity.entity_id}
                                                    className={joinClassNames(
                                                        styles.candidateOption,
                                                        isSelected ? styles.candidateOptionSelected : "",
                                                    )}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className={styles.candidateCheckbox}
                                                        checked={isSelected}
                                                        disabled={
                                                            suggestion.domain !== "watering"
                                                            || suggestion.existingController !== null
                                                            || created.has(suggestion.key)
                                                        }
                                                        onChange={() => toggleSensorCandidate(suggestion.key, entity.entity_id)}
                                                    />
                                                    <span className={styles.entityCopy}>
                                                        <span className={styles.entityLabel}>{entity.label}</span>
                                                        <span className={styles.entityId}>{entity.entity_id}</span>
                                                    </span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <span className={styles.muted}>
                                        {suggestion.domain === "watering"
                                            ? suggestion.sensorCandidates.length > 0
                                                ? "Matching moisture sensors are already used by other controllers"
                                                : "No moisture sensor candidates found yet"
                                            : "none"}
                                    </span>
                                )}
                            </div>
                            <div>
                                <span className={styles.suggestionRole}>Actuators</span>
                                {suggestion.actuators.map((entity) => (
                                    <div key={entity.entity_id} className={styles.entityRow}>
                                        <span className={styles.entityLabel}>{entity.label}</span>
                                        <span className={styles.entityId}>{entity.entity_id}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.suggestionActions}>
                            {suggestion.domain !== "watering" ? (
                                <span className={styles.muted}>This device type needs to be configured manually</span>
                            ) : created.has(suggestion.key) || suggestion.existingController !== null ? (
                                <span className={styles.successText}>
                                    {created.has(suggestion.key)
                                        ? "Controller created"
                                        : `Already configured as ${suggestion.existingController!.display_name}`}
                                </span>
                            ) : (
                                <>
                                    <select
                                        className={styles.editSelect}
                                        value={zoneValue}
                                        onChange={(event) => setSelectedZones((currentZones) => ({
                                            ...currentZones,
                                            [suggestion.key]: event.target.value,
                                        }))}
                                    >
                                        <option value="">Select zone...</option>
                                        {WATERING_ZONES.map((zone) => (
                                            <option key={zone.zoneId} value={zone.zoneId}>{zone.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        className={joinClassNames(buttonStyles.button, buttonStyles.onboardingTabButton)}
                                        disabled={creating === suggestion.key || !effectiveZone || chosenSensorIds.length === 0}
                                        onClick={() => handleCreate(suggestion)}
                                    >
                                        {creating === suggestion.key ? "Creating..." : "Create Controller"}
                                    </button>
                                </>
                            )}
                            {errors[suggestion.key] && (
                                <span className={styles.errorText}>{errors[suggestion.key]}</span>
                            )}
                        </div>
                    </div>
                )
            })}

            <button
                className={joinClassNames(buttonStyles.button, buttonStyles.onboardingTabButton)}
                onClick={onComplete}
                disabled={readyControllerCount === 0}
            >
                Continue to rule setup
            </button>
        </div>
    )
}
