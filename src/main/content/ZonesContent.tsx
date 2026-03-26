import styles from "./ZonesContent.module.css"
import {type DomainKey, DOMAINS, type Domain} from "../../header/domains.ts";
import type {RightPanelState, ZoneKey, ZoneMenuEntry} from "../MainView.tsx";
import {ControllerPads} from "./pads/ControllerPads.tsx";
import {
    makeControllersApi, makeNext, makeRuntimeApiCall,
    makeWhy
} from "../../api/controllers.ts";
import type {
    ControllerViewBase,
    WateringNextView,
    WateringRuntimeView,
    WhyViewBase
} from "../../api/types.ts";
import {useEffect, useEffectEvent, useState} from "react";
import type {UiRuntimeStatus} from "../../api/statusTypes.ts";
import {mapDomainModeToUiStatus} from "../../api/statusMappers.ts";

const WHY_WARNING_REASON_CODES = new Set([
    "condition_source_missing",
    "condition_value_invalid",
    "condition_field_unsupported",
])

const NEXT_WARNING_REASON_CODES = new Set([
    "schedule_slot_missed",
    "runtime_start_failed",
    "missing_controller",
])

function formatZoneNextEvent(nextRecords: Record<string, WateringNextView>): string {
    const nextTimestamps = Object.values(nextRecords)
        .map((record) => record.next_run_at)
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value))
        .filter((value) => !Number.isNaN(value.getTime()))
        .sort((left, right) => left.getTime() - right.getTime())

    const nextEvent = nextTimestamps[0]
    if (!nextEvent) {
        return "No upcoming event"
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
    const startOfDayAfterTomorrow = new Date(startOfTomorrow)
    startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1)

    const timeLabel = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    }).format(nextEvent)

    if (nextEvent >= startOfToday && nextEvent < startOfTomorrow) {
        return `today at ${timeLabel}`
    }

    if (nextEvent >= startOfTomorrow && nextEvent < startOfDayAfterTomorrow) {
        return `tomorrow at ${timeLabel}`
    }

    const dateLabel = new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(nextEvent)
    return dateLabel
}

function countZoneWarnings(
    controllers: ControllerViewBase[],
    whyRecords: Record<string, WhyViewBase>,
    nextRecords: Record<string, WateringNextView>,
    statusLights: Record<string, UiRuntimeStatus>,
): number {
    const warningControllerIds = new Set<string>()

    for (const controller of controllers) {
        const controllerId = controller.controller_id
        const why = whyRecords[controllerId]
        const next = nextRecords[controllerId]
        const status = statusLights[controllerId]

        if (status === "FAILED") {
            warningControllerIds.add(controllerId)
            continue
        }

        if (why?.decision === "unknown" || (why && WHY_WARNING_REASON_CODES.has(why.reason_code))) {
            warningControllerIds.add(controllerId)
            continue
        }

        if (next?.last_error || (next?.last_reason_code && NEXT_WARNING_REASON_CODES.has(next.last_reason_code))) {
            warningControllerIds.add(controllerId)
        }
    }

    return warningControllerIds.size
}


export function ZonesContent(
    {activeDomain, activeZone, zones, isRightPanelOpen, onEditRules, onCreateController, onEditController, refreshToken, rightPanel, closeRightPanel, refreshSkipNextToken}:
    {
        activeDomain: DomainKey,
        activeZone: ZoneKey,
        zones: ZoneMenuEntry[],
        isRightPanelOpen: boolean,
        onEditRules: (controllerId: string) => void,
        onCreateController: (zoneId: ZoneKey, zoneLabel: string) => void,
        onEditController: (controllerId: string, zoneId: ZoneKey, zoneLabel: string) => void,
        refreshToken: number,
        rightPanel: RightPanelState,
        closeRightPanel: () => void,
        refreshSkipNextToken: () => void
    }
) {

    const [controllers, setControllers] = useState<ControllerViewBase[]>([])
    const [whyRecords, setWhyRecords] = useState<Record<string, WhyViewBase>>({})
    const [nextRecords, setNextRecords] = useState<Record<string, WateringNextView>>({})
    const [statusLights, setStatusLights] = useState<Record<string, UiRuntimeStatus>>({});



    const loadWhyRecord = async (controllerId: string): Promise<WhyViewBase | null> => {
        try {
            const rawWhy = await makeWhy(activeDomain).get(controllerId)
            return rawWhy as WhyViewBase
        } catch (err) {
            console.log(err)
            return null
        }
    }

    const loadWhyRecords = async (controllerRecords: ControllerViewBase[]): Promise<Record<string, WhyViewBase>> => {
        const nextWhyMap: Record<string, WhyViewBase> = {}

        for (const controller of controllerRecords) {
            const why = await loadWhyRecord(controller.controller_id)
            if (why !== null) {
                nextWhyMap[controller.controller_id] = why
            }
        }

        return nextWhyMap
    }

    const loadWateringRuntimeSnapshot = async (
        controllerRecords: ControllerViewBase[],
    ): Promise<{
        whyMap: Record<string, WhyViewBase>,
        nextMap: Record<string, WateringNextView>,
        statusMap: Record<string, UiRuntimeStatus>,
    }> => {
        const controllerSnapshots: {
            controllerId: string
            status: UiRuntimeStatus
            next: WateringNextView | null
            why: WhyViewBase | null
        }[] = await Promise.all(
            controllerRecords.map(async (controller) => {
                let rawWhy: WhyViewBase | null = null
                let rawNext: WateringNextView | null = null
                let status: UiRuntimeStatus = "UNKNOWN"
                try {
                    rawWhy = await makeWhy("watering").get(controller.controller_id) as WhyViewBase
                } catch {
                    rawWhy = null
                }
                try {
                    rawNext = await makeNext("watering").get(controller.controller_id) as WateringNextView
                } catch {
                    rawNext = null
                }
                try {
                    const rawStatus = await makeRuntimeApiCall<never, WateringRuntimeView>("watering").state(controller.controller_id)
                    const runtimeStatus: UiRuntimeStatus = mapDomainModeToUiStatus(
                        {domain: "watering", mode: rawStatus.mode}
                    )
                    status = rawNext?.is_paused && runtimeStatus === "IDLE"
                        ? "PAUSED"
                        : runtimeStatus
                } catch {
                    status = "UNKNOWN"
                }
                return {
                    controllerId: controller.controller_id,
                    status,
                    next: rawNext,
                    why: rawWhy,
                }


            })
        )

        return {
            whyMap: controllerSnapshots.reduce<Record<string, WhyViewBase>>((acc, entry) => {
                if (entry.why !== null) {
                    acc[entry.controllerId] = entry.why
                }
                return acc
            }, {}),
            statusMap: Object.fromEntries(controllerSnapshots.map((entry) => [entry.controllerId, entry.status])),
            nextMap: controllerSnapshots.reduce<Record<string, WateringNextView>>((acc, entry) => {
                if (entry.next !== null) {
                    acc[entry.controllerId] = entry.next
                }
                return acc
            }, {})
            ,
        }
    }

    const loadWateringRuntimeRecord = async (
        controllerId: string,
    ): Promise<{
        next: WateringNextView | null,
        status: UiRuntimeStatus,
    }> => {
        let rawNext: WateringNextView | null = null
        let status: UiRuntimeStatus = "UNKNOWN"
        try {
            rawNext = await makeNext("watering").get(controllerId) as WateringNextView
        } catch {
            rawNext = null
        }
        try {
            const rawStatus = await makeRuntimeApiCall<never, WateringRuntimeView>("watering").state(controllerId)
            const runtimeStatus: UiRuntimeStatus = mapDomainModeToUiStatus(
                {domain: "watering", mode: rawStatus.mode}
            )
            status = rawNext?.is_paused && runtimeStatus === "IDLE"
                ? "PAUSED"
                : runtimeStatus

        } catch {
            status = "UNKNOWN"
        }
        return {next: rawNext, status}
    }

    const refreshPadSemantics = useEffectEvent(async (controllerRecords: ControllerViewBase[]) => {
        if (activeDomain === "watering") {
            const runtimeSnapshot = await loadWateringRuntimeSnapshot(controllerRecords)
            setWhyRecords(runtimeSnapshot.whyMap)
            setNextRecords(runtimeSnapshot.nextMap)
            setStatusLights(runtimeSnapshot.statusMap)
            return
        }

        setWhyRecords(await loadWhyRecords(controllerRecords))
        setNextRecords({})
        setStatusLights({})
    })

    const refreshControllerSemantics = async (controllerId: string) => {
        refreshSkipNextToken();
        const nextWhy = await loadWhyRecord(controllerId)
        setWhyRecords((currentRecords) => {
            if (nextWhy === null) {
                const nextRecords = {...currentRecords}
                delete nextRecords[controllerId]
                return nextRecords
            }
            return {
                ...currentRecords,
                [controllerId]: nextWhy,
            }
        })

        if (activeDomain !== "watering") {
            return
        }

        const runtimeRecord = await loadWateringRuntimeRecord(controllerId)
        setNextRecords((currentRecords) => {
            if (runtimeRecord.next === null) {
                const nextRecords = {...currentRecords}
                delete nextRecords[controllerId]
                return nextRecords
            }
            return {
                ...currentRecords,
                [controllerId]: runtimeRecord.next,
            }
        })
        setStatusLights((currentStatuses) => ({
            ...currentStatuses,
            [controllerId]: runtimeRecord.status,
        }))
    }

    useEffect(() => {
        (async () => {
            let data: ControllerViewBase[] = []
            try {
                const raw: unknown[] = await makeControllersApi(activeDomain, activeZone).list();
                data = raw as ControllerViewBase[];
                setControllers(data); // Render #2
            } catch (err) {
                console.log(err);
                setControllers([]);
                setWhyRecords({});
                setNextRecords({});
                setStatusLights({});
                return
            }

            await refreshPadSemantics(data)
        })();
    }, [activeDomain, activeZone, refreshToken]);

    useEffect(() => {
        let cancelled = false;
        let timerId: number | undefined;


        const tick = async () => {
            try {
                if (activeDomain !== "watering") {
                    setStatusLights({});
                    setNextRecords({});
                    return;
                } else {
                    const runtimeSnapshot = await loadWateringRuntimeSnapshot(controllers)
                    if (!cancelled) {
                        setStatusLights(runtimeSnapshot.statusMap);
                        setNextRecords(runtimeSnapshot.nextMap);
                        setWhyRecords(runtimeSnapshot.whyMap);
                    }

                }
            } finally {
                if (!cancelled) timerId = window.setTimeout(tick, 2000);
            }
        };

        void tick();


        return () => {
            cancelled = true;
            if (timerId) window.clearTimeout(timerId);
        };
    }, [activeDomain, controllers, refreshToken]);

    const currentDomain: string | undefined = DOMAINS.find(
        (u: Domain) => u.key === activeDomain
    )?.value;
    const currentZone: string = zones.find(
        (z: ZoneMenuEntry) => z.key === activeZone
    )?.value ?? activeZone
    const warningCount = countZoneWarnings(controllers, whyRecords, nextRecords, statusLights)
    const nextEventLabel = formatZoneNextEvent(nextRecords)
    return (
        <div className={`${styles.feed} ${isRightPanelOpen ? styles.feedCentered : ""}`}>
            <div className={styles.zonesContent}>
                <div
                    className={styles.zonesHeader}
                >
                    <div className={styles.headerTopRow}>
                        <div>
                            <h1>{currentDomain} · {currentZone} </h1>
                            <h2
                                className={styles.subtitle}
                            >
                                {controllers?.length ?? 0} {controllers.length === 1 ? "Controller" : "Controllers"} · {warningCount} {warningCount === 1 ? "Warning" : "Warnings"} · Next event: {nextEventLabel}
                            </h2>
                        </div>

                    </div>
                </div>
                <ControllerPads
                    controllers={controllers}
                    whyRecords={whyRecords}
                    nextRecords={nextRecords}
                    activeDomain={activeDomain}
                    activeZoneKey={activeZone}
                    activeZoneText={currentZone}
                    uiStatus={statusLights}
                    onEditRules={onEditRules}
                    isRightPanelOpen={isRightPanelOpen}
                    rightPanel={rightPanel}
                    closeRightPanel={closeRightPanel}
                    onControllerAction={(controllerId) => {
                        void refreshControllerSemantics(controllerId)
                    }}
                    onCreateController={onCreateController}
                    onEditController={onEditController}
                />

            </div>
        </div>

    )
}
