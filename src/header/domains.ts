export type DomainKey = "humidity" | "cleaning" | "watering" | "lighting" | "power" | "surveillance";

export type Domain = {
    key: DomainKey,
    value: string
}

export const DOMAINS: Domain[] = [
    {key: "watering", value: "Watering"},
    {key: "lighting", value: "Lighting"},
    {key: "humidity", value: "Humidity"},
    {key: "cleaning", value: "Cleaning"},
    {key: "power", value: "Power"},
    {key: "surveillance", value: "Surveillance"}
]
