import {httpGet, httpPost, httpPut} from "./http.ts";

export interface EntityClassificationView {
    entity_id: string
    semantic_type: string
    role: string
    domain_hint: string | null
    confidence: string
    label: string
    zone_hint: string | null
    suggested_moisture_sensor_entity_ids: string[]
}

export type ClassificationSource = "all" | "agent" | "seed"

export function fetchClassifications(source: ClassificationSource = "all"): Promise<EntityClassificationView[]> {
    const params = new URLSearchParams({source})
    return httpGet<EntityClassificationView[]>(`/semantic/classifications?${params.toString()}`)
}

export function seedDemoData(): Promise<{seeded: boolean; entity_count: number}> {
    return httpPost<{seeded: boolean; entity_count: number}>("/seed/demo", {})
}

export interface ClassificationOverride {
    role?: string | null
    domain_hint?: string | null
}

export function updateClassification(
    entityId: string,
    override: ClassificationOverride,
): Promise<EntityClassificationView> {
    return httpPut<EntityClassificationView>(
        `/semantic/classifications/${entityId}`,
        override,
    )
}
