import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./dashboard/DashboardPage.tsx";
import { OnboardingPage } from "./onboarding/OnboardingPage.tsx";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/dashboard/*" element={<DashboardPage />} />
        </Routes>
    );
}

export default App;
