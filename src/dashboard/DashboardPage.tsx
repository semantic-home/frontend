import {HeaderView} from "../header/HeaderView.tsx";
import {DOMAINS, type DomainKey} from "../header/domains.ts";
import {MainView} from "../main/MainView.tsx";
import {FooterView} from "../main/footer/FooterView.tsx";
import {useEffect, useState} from "react";
import styles from "./DashboardPage.module.css";


export function DashboardPage() {
    const [activeDomain, setActiveDomain] = useState<DomainKey>(DOMAINS[0].key);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 961px)");
        const handleViewportChange = (event: MediaQueryListEvent) => {
            if (event.matches) {
                setIsSidebarOpen(false);
            }
        };

        mediaQuery.addEventListener("change", handleViewportChange);
        return () => {
            mediaQuery.removeEventListener("change", handleViewportChange);
        };
    }, []);

    useEffect(() => {
        if (!isSidebarOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isSidebarOpen]);

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };

    const toggleSidebar = () => {
        setIsSidebarOpen((currentValue) => !currentValue);
    };

    const handleDomainSelect = (domain: DomainKey) => {
        setActiveDomain(domain);
        closeSidebar();
    };

    return (
        <div
            className={styles.page}
            data-sidebar-open={isSidebarOpen ? "true" : "false"}
        >
            <HeaderView
                active={activeDomain}
                onSelect={handleDomainSelect}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={toggleSidebar}
            />
            <MainView
                key={activeDomain}
                activeDomain={activeDomain}
                isSidebarOpen={isSidebarOpen}
                closeSidebar={closeSidebar}
            />
            <FooterView/>
        </div>
    )
}

