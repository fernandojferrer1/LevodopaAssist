import { useCallback } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { ComparisonDetail } from "./pages/ComparisonDetail";
import { CompareMeasurements } from "./pages/CompareMeasurements";
import { Login } from "./pages/Login";
import { MeasurementDetail } from "./pages/MeasurementDetail";
import { NewMeasurement } from "./pages/NewMeasurement";
import { PatientDetail } from "./pages/PatientDetail";
import { PatientList } from "./pages/PatientList";

function AuthenticatedApp() {
  return (
    <Layout>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<PatientList />} />
          <Route path="/patients/:patientId" element={<PatientDetail />} />
          <Route path="/patients/:patientId/measurements/new" element={<NewMeasurement />} />
          <Route path="/patients/:patientId/measurements/:measurementId" element={<MeasurementDetail />} />
          <Route path="/patients/:patientId/compare" element={<CompareMeasurements />} />
          <Route path="/patients/:patientId/comparisons/:comparisonId" element={<ComparisonDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const navigate = useNavigate();

  const onUnauthorized = useCallback(() => {
    navigate("/login", {
      replace: true,
      state: { message: "Tu sesión expiró, ingresá de nuevo" },
    });
  }, [navigate]);

  const onInactivity = useCallback(() => {
    navigate("/login", {
      replace: true,
      state: { message: "Se cerró la sesión por inactividad" },
    });
  }, [navigate]);

  return (
    <AuthProvider onUnauthorized={onUnauthorized} onInactivity={onInactivity}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </AuthProvider>
  );
}
