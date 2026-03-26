import styles from "./OnboardingPage.module.css";
import {OnboardingTutorial} from "./onboardingTutorial.tsx";


export function OnboardingPage() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h2>Semantic Home</h2>
                    <span className={styles.version}>v0.1.0-alpha.2</span>
                </div>

                <h1 className={styles.title}>Welcome to Semantic Home</h1>
                <p className={styles.intro}>
                    Follow these steps to connect your devices, create controllers, and save your first automation rule.
                </p>

                <OnboardingTutorial />



            </div>


        </div>
    )
}
