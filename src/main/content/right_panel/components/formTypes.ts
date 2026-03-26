type Schedule = {
    type: string,
    days: Array<string>,
    at: string,
    tz: string
}

type Condition = {
    field: string,
    op: string,
    value: number | string,
    unit?: string | null
}

type Action = {
    type: string,
    seconds: number
}

export interface RuleUpsertDraft {
    enabled: boolean,
    paused: boolean,
    schedule: Schedule,
    conditions: Array<Condition>,
    action: Action,
    expected_version?: number | null
}


export interface WateringRuleView {
    controller_id: string;
    version: number;
    enabled: boolean
    paused: boolean
    schedule: Schedule
    conditions: Array<Condition>
    action: Action
    created_at: string | null
    updated_at: string | null
}

export type PolicyFactStatus = "ok" | "missing" | "invalid" | "unsupported"
export type PolicyOutcome = "allow" | "deny" | "unknown"

export interface PolicyFactView {
    field: string
    status: PolicyFactStatus
    message: string
    source_entity_ids: string[]
    selected_entity_id: string | null
    selected_state_raw: string | null
    selected_value: number | null
    comparison_passed: boolean | null
    operator: string | null
    expected_value: number | string | null
    unit?: string | null
}

export interface PolicyDecisionView {
    outcome: PolicyOutcome
    reason_code: string
    message: string
    evaluated_at: string
    effective_seconds: number | null
    facts: PolicyFactView[]
}

export interface WateringRulePreviewView {
    controller_id: string
    summary: string
    next_run_at: string | null
    decision: PolicyDecisionView
}
