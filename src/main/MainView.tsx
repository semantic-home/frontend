import styles from "./MainView.module.css"
import {ZonesMenu} from "./menu/ZonesMenu";
import {ZonesContent} from "./content/ZonesContent";
import type {DomainKey} from "../header/domains.ts";
import {useEffect, useState} from "react";
import {httpGet} from "../api/http.ts";
import {useSearchParams} from "react-router-dom";
import {ControllerZone} from "../workspace/Controllers.tsx";
import {RightPanel} from "./content/right_panel/RightPanel.tsx";
import {displayZone} from "../workspace/shared.ts";

export type ZoneKey = string;

export type ZoneMenuEntry = {
    key: ZoneKey,
    value: string
}

export type RightPanelState =
    | { mode: "closed" }
    | { mode: "edit_rule"; controllerId: string }
    | { mode: "create_controller"; zoneId: ZoneKey; zoneLabel: string }
    | { mode: "edit_controller"; controllerId: string; zoneId: ZoneKey; zoneLabel: string };

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
    const [params, setParams] = useSearchParams();
    const [zones, setZones] = useState<ZoneMenuEntry[]>([])
    const activeZone = zones.some(zone => zone.key === params.get("zone")) ? params.get("zone")! : zones[0]?.key || "unassigned";
    const [creating, setCreating] = useState<Extract<RightPanelState, {mode: "create_controller"}> | null>(null);
    const rightPanel: RightPanelState = creating || (params.get("controller") ? params.get("panel") === "rules"
        ? {mode: "edit_rule", controllerId: params.get("controller")!}
        : {mode: "edit_controller", controllerId: params.get("controller")!, zoneId: activeZone, zoneLabel: zones.find(zone => zone.key === activeZone)?.value || activeZone}
        : {mode: "closed"});
    const [zoneError, setZoneError] = useState("");
    const [padsRefreshToken, setPadsRefreshToken] = useState(0)

    const [refreshTokenFromSkipNext, setRefreshTokenFromSkipNext] = useState<number>(0);

    useEffect(() => {
        let alive = true
        void httpGet<{id: string; name: string}[]>("/rooms").then(rooms => {
            if (!alive) return
            const entries = rooms.map(room => ({key: room.id, value: displayZone(room.id, room.name)}))
            setZones(entries)
            setZoneError("")
        }).catch(() => {if (alive) setZoneError("Could not load zones.")})
        return () => {alive = false}
    }, [activeDomain, padsRefreshToken])


    const refreshSkipNextToken = () => {
        setRefreshTokenFromSkipNext((prev) => {
            return prev + 1
        })
    }

    const isRightPanelOpen = rightPanel.mode !== "closed";
    const rememberPanel = (controllerId?: string, panel?: string) => {
        const next = new URLSearchParams(params);
        next.set("zone", activeZone);
        if (controllerId) {next.set("controller", controllerId); next.set("panel", panel || "entities")}
        else {next.delete("controller"); next.delete("panel")}
        setParams(next, {replace: true});
    };
    const openEditRulePanel = (controllerId: string) => {
        setCreating(null);
        rememberPanel(controllerId, "rules");
    };
    const openCreateControllerPanel = (zoneId: ZoneKey, zoneLabel: string) => {
        setCreating({mode: "create_controller", zoneId, zoneLabel});
    };
    const openEditControllerPanel = (controllerId: string) => {
        setCreating(null);
        rememberPanel(controllerId);
    };
    const closeRightPanel = () => {
        setCreating(null);
        rememberPanel();
    };
    const refreshPadSemantics = () => {
        setPadsRefreshToken((currentToken) => currentToken + 1)
    };

    const handleZoneChange = (zoneKey: ZoneKey) => {
        setCreating(null);
        const next = new URLSearchParams(params); next.set("zone", zoneKey); next.delete("controller"); next.delete("panel"); setParams(next);
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
                onZoneCreated={(id) => {setPadsRefreshToken(n => n + 1); handleZoneChange(id)}}
            />
            {zoneError && <p role="alert">{zoneError}</p>}
            {activeDomain !== "watering" ? <ControllerZone domain={activeDomain} zoneId={activeZone} zoneName={zones.find(z => z.key === activeZone)?.value || activeZone} revision={padsRefreshToken}
                create={() => openCreateControllerPanel(activeZone, zones.find(z => z.key === activeZone)?.value || activeZone)}
                open={(id, rules) => rules ? openEditRulePanel(id) : openEditControllerPanel(id)}/>
            : < ZonesContent
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
            />}
            < RightPanel
                activeDomain={activeDomain}
                activeZone={activeZone}
                zones={zones}
                revision={padsRefreshToken}
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
