export type DomainKey = "watering" | "lighting" | "power" | "surveillance";

export type Domain = {
    key: DomainKey,
    value: string
}

export const DOMAINS: Domain[] = [
    {key: "watering", value: "Watering"},
    {key: "lighting", value: "Lighting"},
    {key: "power", value: "Power"},
    {key: "surveillance", value: "Surveillance"}
]
