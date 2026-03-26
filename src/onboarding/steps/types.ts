export interface StepDefinition {
    key: string
    label: string
    description: string
}

export const INSTALL_STEPS: StepDefinition[] = [
    {key: "connect", label: "Connect Agent", description: "Install and connect the HA agent"},
    {key: "discover", label: "Discover Entities", description: "Import live entities"},
    {key: "classify", label: "Classify Entities", description: "Review entity classifications"},
    {key: "create", label: "Create Controllers", description: "Turn suggestions into controllers"},
    {key: "rules", label: "Build Automation", description: "Save your first rule"},
]

export const DEMO_STEPS: StepDefinition[] = [
    {key: "load", label: "Load Demo Data", description: "Seed demo entities"},
    {key: "classify", label: "Classify Entities", description: "Review entity classifications"},
    {key: "create", label: "Create Controllers", description: "Turn suggestions into controllers"},
    {key: "rules", label: "Build Automation", description: "Save your first rule"},
]
