import type {ReactNode} from "react"
import {Link} from "react-router-dom"
import styles from "./HeaderView.module.css"
import logoStyles from "../styles/Logo.module.css"
import buttonStyles from "../styles/Button.module.css"
import logo from "../assets/logo_grau.png"
import {joinClassNames} from "../utils/classNames.ts"
import {DOMAINS, type DomainKey} from "./domains.ts"
import {Menu} from "lucide-react"

export function HeaderView({active, onSelect, isSidebarOpen = false, onToggleSidebar, tools}: {
    active: DomainKey | null; onSelect: (key: DomainKey) => void;
    isSidebarOpen?: boolean; onToggleSidebar?: () => void; tools?: ReactNode
}) {
    return <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label="Semantic Home — controllers and zones">
            <img src={logo} className={logoStyles.logoImage} alt=""/><span>Semantic Home</span>
        </Link>
        {onToggleSidebar && <button type="button" className={joinClassNames(buttonStyles.button, styles.sidebarToggle)}
            onClick={onToggleSidebar} aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-controls="dashboard-zones-menu" aria-expanded={isSidebarOpen}>
            <Menu size={18} aria-hidden="true"/>
        </button>}
        <nav className={styles.domainMenu} aria-label="Domains">
            <div className={styles.headerNav}>{DOMAINS.map(item => <button key={item.key} onClick={() => onSelect(item.key)} aria-pressed={active === item.key}
                className={joinClassNames(buttonStyles.button, buttonStyles.menuButton, buttonStyles.domainMenuButton, active === item.key ? buttonStyles.isActive : "")}>
                {item.value}
            </button>)}</div>
        </nav>
        <div className={styles.tools}>{tools}</div>
    </header>
}
