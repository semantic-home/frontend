import styles from "./HeaderView.module.css"
import logoStyles from "../styles/Logo.module.css"
import buttonStyles from "../styles/Button.module.css"
import logo from "../assets/logo_grau.png";
import {joinClassNames} from "../utils/classNames.ts";
import {DOMAINS, type DomainKey} from "./domains.ts";
import {Menu} from "lucide-react";

export function HeaderView(
    {
        active,
        onSelect,
        isSidebarOpen,
        onToggleSidebar
    }: {
        active: DomainKey,
        onSelect: (k: DomainKey) => void
        isSidebarOpen: boolean
        onToggleSidebar: () => void
    }
) {
    return (
        <header className={styles.header}>
            <div className={styles.logoContainer}>
                <div className={logoStyles.logo}>
                    <img src={logo} className={logoStyles.logoImage} alt="Semantic Home"/>
                </div>
            </div>
            <button
                type="button"
                className={joinClassNames(buttonStyles.button, styles.sidebarToggle)}
                onClick={onToggleSidebar}
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-controls="dashboard-zones-menu"
                aria-expanded={isSidebarOpen}
            >
                <Menu className={styles.sidebarToggleIcon} aria-hidden="true"/>
            </button>

            <div className={styles.domainMenu}>
                <nav className={styles.headerNav}>
                    {DOMAINS.map((item) => (

                            <button
                                key={item.key}
                                onClick={() => (onSelect(item.key))}
                                className={joinClassNames(
                                    buttonStyles.button,
                                    buttonStyles.menuButton,
                                    buttonStyles.domainMenuButton,
                                    active === item.key ? buttonStyles.isActive : "",
                                )}

                            >
                                {item.value}
                            </button>

                    ))}
                </nav>
            </div>
        </header>
    )
}
