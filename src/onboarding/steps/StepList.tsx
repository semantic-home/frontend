import type {StepDefinition} from "./types.ts"
import type {StepStatus} from "../hooks/useStepMachine.ts"
import {Check} from "lucide-react"
import styles from "./StepList.module.css"
import {joinClassNames} from "../../utils/classNames.ts"

type StepListProps = {
    steps: StepDefinition[]
    statusOf: (index: number) => StepStatus
}

export function StepList({steps, statusOf}: StepListProps) {
    return (
        <div className={styles.list}>
            {steps.map((step, i) => {
                const status = statusOf(i)
                return (
                    <div key={step.key} className={joinClassNames(styles.item, styles[status])}>
                        <div className={styles.indicator}>
                            {status === "completed"
                                ? <Check size={14}/>
                                : <span>{i + 1}</span>
                            }
                        </div>
                        <div className={styles.info}>
                            <span className={styles.label}>{step.label}</span>
                            <span className={styles.description}>{step.description}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
