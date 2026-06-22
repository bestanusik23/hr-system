import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import EvalPage from "./pages/eval/EvalPage";
import TransferPage from "./pages/transfer/TransferPage";
import TrainingPage from "./pages/training/TrainingPage";
import ExecPage from "./pages/exec/ExecPage";
import RecruitPage from "./pages/recruit/RecruitPage";
import AdminPage from "./pages/admin/AdminPage";
import OrgPage from "./pages/admin/OrgPage";
import CheckinPage from "./pages/CheckinPage";
import CertVerifyPage from "./pages/CertVerifyPage";
import SurveyPage from "./pages/SurveyPage";
import WorkflowPage from "./pages/WorkflowPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#001D66" }}>
      <div style={{ color: "#fff", fontSize: 15, opacity: 0.7 }}>กำลังโหลด…</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public routes — no auth required */}
          <Route path="/checkin"     element={<CheckinPage />} />
          <Route path="/survey"      element={<SurveyPage />} />
          <Route path="/cert/verify" element={<CertVerifyPage />} />
          {/* Protected routes */}
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/eval" element={<RequireAuth><EvalPage /></RequireAuth>} />
          <Route path="/recruit" element={<RequireAuth><RecruitPage /></RequireAuth>} />
          <Route path="/training" element={<RequireAuth><TrainingPage /></RequireAuth>} />
          <Route path="/transfer" element={<RequireAuth><TransferPage /></RequireAuth>} />
          <Route path="/exec" element={<RequireAuth><ExecPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="/admin/org" element={<RequireAuth><OrgPage /></RequireAuth>} />
          <Route path="/workflow" element={<RequireAuth><WorkflowPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
