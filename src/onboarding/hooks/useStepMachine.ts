import {useState} from "react"

export type StepStatus = "locked" | "active" | "completed"

export function useStepMachine(stepCount: number) {
    const [currentIndex, setCurrentIndex] = useState(0)

    const advance = () => {
        setCurrentIndex(prev => Math.min(prev + 1, stepCount))
    }

    const statusOf = (index: number): StepStatus => {
        if (index < currentIndex) return "completed"
        if (index === currentIndex) return "active"
        return "locked"
    }

    const isComplete = currentIndex >= stepCount

    return {currentIndex, advance, statusOf, isComplete}
}
