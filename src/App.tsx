import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import EvalPage from "./pages/eval/EvalPage";
import TransferPage from "./pages/transfer/TransferPage";
import TrainingPage from "./pages/training/TrainingPage";
import ComingSoon from "./pages/ComingSoon";

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
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/eval" element={<RequireAuth><EvalPage /></RequireAuth>} />
          <Route path="/recruit" element={<RequireAuth><ComingSoon title="ระบบสรรหาบุคลากร" accent="#0038C6" /></RequireAuth>} />
          <Route path="/training" element={<RequireAuth><TrainingPage /></RequireAuth>} />
          <Route path="/transfer" element={<RequireAuth><TransferPage /></RequireAuth>} />
          <Route path="/exec" element={<RequireAuth><ComingSoon title="Executive Dashboard" accent="#0891B2" /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
