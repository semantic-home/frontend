import {useEffect} from "react"
import {makeAgentsApi} from "../../api/controllers.ts"
import {usePolling} from "../hooks/usePolling.ts"
import styles from "./Details.module.css"

type Props = { onComplete: () => void }

export function AgentConnectDetails({onComplete}: Props) {
    const {data} = usePolling(() => makeAgentsApi().list(), {intervalMs: 3000})
    const connected = data?.agents?.some(a => a.connected) ?? false

    useEffect(() => {
        if (connected) onComplete()
    }, [connected, onComplete])

    return (
        <div className={styles.terminal}>
            <div className={styles.terminalHeader}>
                <span className={styles.dot} data-color="red"/>
                <span className={styles.dot} data-color="yellow"/>
                <span className={styles.dot} data-color="green"/>
                <span className={styles.terminalTitle}>bash — agent-setup</span>
            </div>
            <div className={styles.terminalBody}>
                <code><span className={styles.prompt}>$</span> uv tool install --from git+https://gitlab.myhometech.de/home-automation/agent.git home-automation-agent</code>
                <code><span className={styles.prompt}>$</span> home-automation-agent --base-url "wss://semantic-home.myhometech.de/api/v1" --id home1</code>
                <code className={styles.muted}>Checking environment...</code>
                <code className={styles.muted}>Installing Semantic Home agent...</code>
                <code><span className={styles.prompt}>$</span> Enter HA Token: **********************</code>
                {connected
                    ? <>
                        <code className={styles.success}>✓ Agent connected — {data!.agents.find(a => a.connected)!.id}</code>
                        <code className={styles.success}>✓ Connection established with backend</code>
                    </>
                    : <code className={styles.waiting}>⏳ Waiting for agent connection...</code>
                }
            </div>
        </div>
    )
}
