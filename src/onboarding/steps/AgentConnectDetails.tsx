import {useEffect, useMemo, useState} from "react"
import {makeAgentsApi} from "../../api/controllers.ts"
import {usePolling} from "../hooks/usePolling.ts"
import styles from "./Details.module.css"

type Props = { onComplete: () => void }

type TerminalLine = {
    prompt?: boolean
    tone?: "default" | "muted"
    text: string
}

const TERMINAL_LINES: TerminalLine[] = [
    {
        prompt: true,
        text: 'export HA_URL="http://your.homeassistant.host:8123"',
    },
    {
        prompt: true,
        text: 'export HA_TOKEN="**********************"',
    },
    {
        prompt: true,
        text: 'export SEMANTIC_HOME_BETA_KEY="beta-key-from-semantic-home"',
    },
    {
        prompt: true,
        text: "uv tool install --from git+https://github.com/semantic-home/agent.git home-automation-agent",
    },
    {
        tone: "muted",
        text: "Resolved 2 packages and installed the Semantic Home agent.",
    },
    {
        prompt: true,
        text: 'home-automation-agent --base-url "wss://semantic-home.myhometech.de/api" --id home1',
    },
    {
        tone: "muted",
        text: "The beta key gates cloud pairing. Without it, the backend rejects the agent connection.",
    },
]

export function AgentConnectDetails({onComplete}: Props) {
    const {data} = usePolling(() => makeAgentsApi().list(), {intervalMs: 3000})
    const connectedAgent = useMemo(
        () => data?.agents?.find((agent) => agent.connected) ?? null,
        [data],
    )
    const connected = connectedAgent !== null
    const [activeLineIndex, setActiveLineIndex] = useState(0)
    const [activeCharCount, setActiveCharCount] = useState(0)
    useEffect(() => {
        if (activeLineIndex >= TERMINAL_LINES.length) {
            return
        }

        const activeLine = TERMINAL_LINES[activeLineIndex]
        const lineDone = activeCharCount >= activeLine.text.length
        const delayMs = lineDone ? 450 : 18

        const timer = window.setTimeout(() => {
            if (lineDone) {
                setActiveLineIndex((currentIndex) => currentIndex + 1)
                setActiveCharCount(0)
                return
            }

            setActiveCharCount((currentCount) => currentCount + 1)
        }, delayMs)

        return () => window.clearTimeout(timer)
    }, [activeCharCount, activeLineIndex])

    useEffect(() => {
        if (!connected) {
            return
        }

        const timer = window.setTimeout(() => onComplete(), 1800)

        return () => window.clearTimeout(timer)
    }, [connected, onComplete])

    return (
        <div className={styles.panel}>
            <p className={styles.panelStatus}>Install and start the local agent</p>
            <p className={styles.panelHint}>
                Copy the commands below on the machine that can reach Home Assistant. The terminal shows the intended install flow once and then stays visible as a reference.
            </p>
            <div className={styles.betaNotice}>
                <p className={styles.betaTitle}>Closed beta access</p>
                <p className={styles.betaBody}>
                    The agent is publicly installable, but connecting it to Semantic Home Cloud currently requires a valid beta key.
                    Without the key, the agent can run locally but cloud pairing will be rejected.
                </p>
            </div>
            <div className={styles.terminal}>
                <div className={styles.terminalHeader}>
                    <span className={styles.dot} data-color="red"/>
                    <span className={styles.dot} data-color="yellow"/>
                    <span className={styles.dot} data-color="green"/>
                    <span className={styles.terminalTitle}>bash — agent-setup</span>
                </div>
                <div className={styles.terminalBody}>
                    {TERMINAL_LINES.map((line, index) => {
                        if (index > activeLineIndex) {
                            return null
                        }

                        const visibleText = index < activeLineIndex
                            ? line.text
                            : line.text.slice(0, activeCharCount)
                        const isTyping = index === activeLineIndex && activeLineIndex < TERMINAL_LINES.length

                        return (
                            <code
                                key={`${index}-${line.text}`}
                                className={line.tone === "muted" ? styles.muted : undefined}
                            >
                                {line.prompt && <span className={styles.prompt}>$</span>}
                                {line.prompt && " "}
                                {visibleText}
                                {isTyping && <span className={styles.cursor} aria-hidden="true">|</span>}
                            </code>
                        )
                    })}
                </div>
            </div>
            {connected
                ? (
                    <div className={styles.liveStatus}>
                        <p className={styles.success}>✓ Agent connected — {connectedAgent.id}</p>
                        <p className={styles.panelHint}>Connection established with the backend. Continuing to entity discovery...</p>
                    </div>
                )
                : (
                    <div className={styles.liveStatus}>
                        <p className={styles.waiting}>Waiting for agent connection...</p>
                        <p className={styles.panelHint}>This status is live and updates automatically as soon as the backend sees the agent.</p>
                    </div>
                )
            }


            {/*
                The connection status is intentionally rendered outside the simulated terminal
                so the install example stays readable while the live backend state updates independently.
            */}
        </div>
    )
}
