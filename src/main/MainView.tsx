import styles from "./MainView.module.css"
import {ZonesMenu} from "./menu/ZonesMenu";
import {ZonesContent} from "./content/ZonesContent";
import type {DomainKey} from "../header/domains.ts";
import {useState} from "react";
import {RightPanel} from "./content/right_panel/RightPanel.tsx";

export type ZoneKey = "living_room" | "bedroom" | "kitchen_watering" | "kitchen_power" | "kitchen_surveillance" | "bathroom" |
    "relax" | "bright" | "sunset" | "sunrise" | "home_office";

export type ZoneMenuEntry = {
    key: ZoneKey,
    value: string
}

type ZonesDomainEntry = {
    key: DomainKey,
    value: Array<ZoneMenuEntry>,
}

export type RightPanelState =
    | { mode: "closed" }
    | { mode: "edit_rule"; controllerId: string }
    | { mode: "create_controller"; zoneId: ZoneKey; zoneLabel: string }
    | { mode: "edit_controller"; controllerId: string; zoneId: ZoneKey; zoneLabel: string };

const ZONES: Array<ZonesDomainEntry> = [
    {
        key: "watering", value: [
            {key: "living_room", value: "Living Room"},
            {key: "bedroom", value: "Bedroom"},
            {key: "kitchen_watering", value: "Kitchen"}
        ]
    },
    {
        key: "lighting", value: [
            {key: "relax", value: "Relax"},
            {key: "bright", value: "Bright"},
            {key: "sunset", value: "Sunset"},
            {key: "sunrise", value: "Sunrise"}
        ]
    },
    {
        key: "power", value: [
            {key: "home_office", value: "Home Office"},
            {key: "kitchen_power", value: "Kitchen"},
            {key: "bedroom", value: "Bedroom"}

        ]
    },
    {
        key: "surveillance", value: [
            {key: "living_room", value: "Living Room"},
            {key: "kitchen_surveillance", value: "Kitchen"},
            {key: "bedroom", value: "Bedroom"},
            {key: "bathroom", value: "Bathroom"}
        ]
    }
]

export function MainView(
    {
        activeDomain,
        isSidebarOpen,
        closeSidebar
    }: {
        activeDomain: DomainKey
        isSidebarOpen: boolean
        closeSidebar: () => void
    }
) {
    const [activeZone, setActiveZone] = useState<ZoneKey>(() => (
        ZONES.find((item) => item.key === activeDomain)?.value[0]?.key ?? ZONES[0].value[0].key
    ))
    const selectedZonesMenu: ZonesDomainEntry | undefined =  ZONES.find(
        item => item.key === activeDomain
    )
    const zones = selectedZonesMenu?.value ?? [];
    const [rightPanel, setRightPanel] = useState<RightPanelState>({ mode: "closed" });
    const [padsRefreshToken, setPadsRefreshToken] = useState(0)

    const [refreshTokenFromSkipNext, setRefreshTokenFromSkipNext] = useState<number>(0);

    const refreshSkipNextToken = () => {
        setRefreshTokenFromSkipNext((prev) => {
            return prev + 1
        })
    }

    const isRightPanelOpen = rightPanel.mode !== "closed";
    const openEditRulePanel = (controllerId: string) => {
        setRightPanel({mode: "edit_rule", controllerId});
    };
    const openCreateControllerPanel = (zoneId: ZoneKey, zoneLabel: string) => {
        setRightPanel({mode: "create_controller", zoneId, zoneLabel});
    };
    const openEditControllerPanel = (controllerId: string, zoneId: ZoneKey, zoneLabel: string) => {
        setRightPanel({mode: "edit_controller", controllerId, zoneId, zoneLabel});
    };
    const closeRightPanel = () => {
        setRightPanel({mode: "closed"});
    };
    const refreshPadSemantics = () => {
        setPadsRefreshToken((currentToken) => currentToken + 1)
    };

    const handleZoneChange = (zoneKey: ZoneKey) => {
        setActiveZone(zoneKey);
        closeSidebar();
    };


    return (
        <div className={`${styles.main} ${isRightPanelOpen ? styles.withRightPanel : ""} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
            {isSidebarOpen && (
                <button
                    type="button"
                    className={styles.sidebarBackdrop}
                    onClick={closeSidebar}
                    aria-label="Close sidebar"
                />
            )}
            < ZonesMenu
                activeDomain={activeDomain}
                activeZone={activeZone}
                zones={zones}
                onChange={handleZoneChange}
                isOpen={isSidebarOpen}
            />
            < ZonesContent
                activeDomain={activeDomain}
                activeZone={activeZone}
                zones={zones}
                isRightPanelOpen={isRightPanelOpen}
                onEditRules={openEditRulePanel}
                onCreateController={openCreateControllerPanel}
                onEditController={openEditControllerPanel}
                refreshToken={padsRefreshToken}
                rightPanel={rightPanel}
                closeRightPanel={closeRightPanel}
                refreshSkipNextToken={refreshSkipNextToken}
            />
            < RightPanel
                isRightPanelOpen={isRightPanelOpen}
                closeRightPanel={closeRightPanel}
                rightPanel={rightPanel}
                onRuleSaved={refreshPadSemantics}
                onControllerCreated={refreshPadSemantics}
                refreshTokenFromSkipNext={refreshTokenFromSkipNext}
            />

        </div>
    )
}
