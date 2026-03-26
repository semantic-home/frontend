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
    {activeDomain, activeZone, zones, onChange, isOpen}:
    {
        activeDomain: DomainKey,
        activeZone: ZoneKey,
        zones: ZoneMenuEntry[],
        onChange: (k: ZoneKey) => void,
        isOpen: boolean
    }
) {


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
                        const Icon: LucideIcon = ZONE_ICON[item.key]
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
        </aside>
    )
}
