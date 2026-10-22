import {createContext, useContext} from "react"
import type {Home} from "./types.ts"

export const HouseholdContext = createContext<Home | null>(null)
export function useHousehold() {
    const home = useContext(HouseholdContext)
    if (!home) throw new Error("Select a household first")
    return home
}
