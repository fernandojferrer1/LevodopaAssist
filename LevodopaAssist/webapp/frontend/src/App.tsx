import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ComparisonDetail } from "./pages/ComparisonDetail";
import { CompareMeasurements } from "./pages/CompareMeasurements";
import { MeasurementDetail } from "./pages/MeasurementDetail";
import { NewMeasurement } from "./pages/NewMeasurement";
import { PatientDetail } from "./pages/PatientDetail";
import { PatientList } from "./pages/PatientList";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PatientList />} />
        <Route path="/patients/:patientId" element={<PatientDetail />} />
        <Route path="/patients/:patientId/measurements/new" element={<NewMeasurement />} />
        <Route path="/patients/:patientId/measurements/:measurementId" element={<MeasurementDetail />} />
        <Route path="/patients/:patientId/compare" element={<CompareMeasurements />} />
        <Route path="/patients/:patientId/comparisons/:comparisonId" element={<ComparisonDetail />} />
      </Routes>
    </Layout>
  );
}
