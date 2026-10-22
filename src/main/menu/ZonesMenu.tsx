import {useState} from "react";
import {httpPost} from "../../api/http.ts";
import {errorText} from "../../workspace/shared.ts";
import {useHousehold} from "../../workspace/household.ts";
import styles from "./ZonesMenu.module.css"
import iconStyles from "./../../styles/Icon.module.css"
import buttonStyles from "../../styles/Button.module.css"
import type {DomainKey} from "../../header/domains.ts";
import type {LucideIcon} from "lucide-react";
import {
  Home,
  BedDouble,
  CookingPot,
  Bath,
  Sun,
  Sunrise,
  Sunset,
  Lamp,
  BriefcaseBusiness
} from "lucide-react";
import type {ZoneKey, ZoneMenuEntry} from "../MainView.tsx";
import {joinClassNames} from "../../utils/classNames.ts";



const ZONE_ICON: Record<ZoneKey, LucideIcon> = {
  living_room: Home,
  bedroom: BedDouble,
  kitchen_watering: CookingPot,
  kitchen_power: CookingPot,
  kitchen_surveillance: CookingPot,
  bathroom: Bath,
  relax: Lamp,
  bright: Sun,
  sunset: Sunset,
  sunrise: Sunrise,
  home_office: BriefcaseBusiness
};


export function ZonesMenu(
    {activeDomain, activeZone, zones, onChange, isOpen, onZoneCreated}:
    {
        activeDomain: DomainKey,
        activeZone: ZoneKey,
        zones: ZoneMenuEntry[],
        onChange: (k: ZoneKey) => void,
        isOpen: boolean
        onZoneCreated: (id: string) => void
    }
) {


    const home = useHousehold();
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return (
        <aside
            id="dashboard-zones-menu"
            className={joinClassNames(styles.zonesMenu, isOpen ? styles.isOpen : "")}
            data-domain={activeDomain}
            aria-label="Zones"
        >
            <div className={styles.zonesMenuHeader}>
                <p className={styles.zonesMenuTitle}>Zones</p>
            </div>
            <nav className={styles.zonesNav}>
                {
                    zones.map((item) => {
                        const Icon: LucideIcon = ZONE_ICON[item.key] || Home
                        return (
                            <button
                                key={item.key}
                                className={joinClassNames(
                                    buttonStyles.button,
                                    buttonStyles.menuButton,
                                    buttonStyles.zoneMenuButton,
                                    item.key === activeZone ? buttonStyles.isActive : "",
                                )}
                                onClick={() => onChange(item.key)}
                            >
                                <Icon className={iconStyles.icon} aria-hidden="true"/>
                                {item.value}
                            </button>
                        )
                    })

                }

            </nav>
            {home.role !== "viewer" && <div className={styles.zoneCreate}>
                <button className={buttonStyles.button} onClick={() => setAdding(!adding)}>+ Add Zone</button>
                {adding && <form onSubmit={e => {e.preventDefault(); setBusy(true); void httpPost<{id: string}>("/zones", {name}).then(zone => {setAdding(false); setName(""); setError(""); onZoneCreated(zone.id)}).catch(e => setError(errorText(e))).finally(() => setBusy(false))}}>
                    <label>Zone name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label><button className={buttonStyles.button} disabled={busy}>Create Zone</button>
                </form>}{error && <p role="alert">{error}</p>}
            </div>}

        </aside>
    )
}
