import styles from "./onboardingTutorial.module.css";
import buttonStyles from "../styles/Button.module.css";
import {joinClassNames} from "../utils/classNames.ts";
import {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useStepMachine} from "./hooks/useStepMachine.ts";
import {INSTALL_STEPS, DEMO_STEPS} from "./steps/types.ts";
import {StepList} from "./steps/StepList.tsx";
import {AgentConnectDetails} from "./steps/AgentConnectDetails.tsx";
import {EntityDiscoveryDetails} from "./steps/EntityDiscoveryDetails.tsx";
import {ClassifyDetails} from "./steps/ClassifyDetails.tsx";
import {CreateControllerDetails} from "./steps/CreateControllerDetails.tsx";
import {DemoLoadDetails} from "./steps/DemoLoadDetails.tsx";
import {RuleSetupDetails} from "./steps/RuleSetupDetails.tsx";

type PathKey = "install_agent" | "start_with_demo_entities";

const pathButtons: {key: PathKey; value: string}[] = [
    {key: "install_agent", value: "Install Agent"},
    {key: "start_with_demo_entities", value: "Start with Demo Entities"},
]

type PathButtonsProps = {
    active: PathKey
    onSelect: (key: PathKey) => () => void
}

function PathButtons({active, onSelect}: PathButtonsProps) {
    return (
        <div className={styles.tutorialButtons}>
            {pathButtons.map((b) => (
                <div key={b.key} className={styles.tutorialButtonSlot}>
                    <button
                        type="button"
                        className={joinClassNames(
                            buttonStyles.button,
                            buttonStyles.onboardingTabButton,
                            active === b.key ? buttonStyles.isActive : "",
                        )}
                        onClick={onSelect(b.key)}
                    >
                        {b.value}
                    </button>
                </div>
            ))}
        </div>
    )
}

function InstallFlow() {
    const {currentIndex, advance, statusOf, isComplete} = useStepMachine(INSTALL_STEPS.length)
    const stepKey = INSTALL_STEPS[currentIndex]?.key
    const navigate = useNavigate()
    const [recentControllerIds, setRecentControllerIds] = useState<string[]>([])

    useEffect(() => {
        if (isComplete) {
            const timer = setTimeout(() => navigate("/dashboard"), 1500)
            return () => clearTimeout(timer)
        }
    }, [isComplete, navigate])

    return (
        <div className={styles.sectionBody}>
            <StepList steps={INSTALL_STEPS} statusOf={statusOf}/>
            <div className={styles.details}>
                {isComplete && <p>Setup complete — redirecting to dashboard...</p>}
                {stepKey === "connect" && <AgentConnectDetails onComplete={advance}/>}
                {stepKey === "discover" && <EntityDiscoveryDetails onComplete={advance}/>}
                {stepKey === "classify" && <ClassifyDetails onComplete={advance} source="agent"/>}
                {stepKey === "create" && (
                    <CreateControllerDetails
                        onComplete={advance}
                        requiresAgent={true}
                        source="agent"
                        onControllerCreated={(controllerId) => {
                            setRecentControllerIds((currentIds) => (
                                currentIds.includes(controllerId) ? currentIds : [...currentIds, controllerId]
                            ))
                        }}
                    />
                )}
                {stepKey === "rules" && (
                    <RuleSetupDetails
                        onComplete={advance}
                        preferredControllerIds={recentControllerIds}
                    />
                )}
            </div>
        </div>
    )
}

function DemoFlow() {
    const {currentIndex, advance, statusOf, isComplete} = useStepMachine(DEMO_STEPS.length)
    const stepKey = DEMO_STEPS[currentIndex]?.key
    const navigate = useNavigate()
    const [recentControllerIds, setRecentControllerIds] = useState<string[]>([])

    useEffect(() => {
        if (isComplete) {
            const timer = setTimeout(() => navigate("/dashboard"), 1500)
            return () => clearTimeout(timer)
        }
    }, [isComplete, navigate])

    return (
        <div className={styles.sectionBody}>
            <StepList steps={DEMO_STEPS} statusOf={statusOf}/>
            <div className={styles.details}>
                {isComplete && <p>Setup complete — redirecting to dashboard...</p>}
                {stepKey === "load" && <DemoLoadDetails onComplete={advance}/>}
                {stepKey === "classify" && <ClassifyDetails onComplete={advance} source="seed"/>}
                {stepKey === "create" && (
                    <CreateControllerDetails
                        onComplete={advance}
                        requiresAgent={false}
                        source="seed"
                        onControllerCreated={(controllerId) => {
                            setRecentControllerIds((currentIds) => (
                                currentIds.includes(controllerId) ? currentIds : [...currentIds, controllerId]
                            ))
                        }}
                    />
                )}
                {stepKey === "rules" && (
                    <RuleSetupDetails
                        onComplete={advance}
                        preferredControllerIds={recentControllerIds}
                    />
                )}
            </div>
        </div>
    )
}

export function OnboardingTutorial() {
    const [path, setPath] = useState<PathKey>("install_agent")
    const selectPath = (key: PathKey) => () => setPath(key)

    return (
        <div className={styles.tutorialContainer}>
            <PathButtons active={path} onSelect={selectPath}/>
            <div className={styles.sectionContent}>
                <h3 className={styles.sectionTitle}>Setup Progress</h3>
                {/* key={path} remounts the flow, resetting step state */}
                {path === "install_agent"
                    ? <InstallFlow key="install"/>
                    : <DemoFlow key="demo"/>
                }
            </div>
        </div>
    )
}
