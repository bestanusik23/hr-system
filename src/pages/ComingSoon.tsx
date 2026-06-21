import PageLayout from "../components/PageLayout";

interface Props { title: string; accent?: string; }

export default function ComingSoon({ title, accent }: Props) {
  return (
    <PageLayout title={title} accent={accent}>
      <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#475569" }}>อยู่ระหว่างพัฒนา</div>
        <div style={{ marginTop: 8, fontSize: 14 }}>ระบบนี้จะพร้อมใช้งานเร็ว ๆ นี้</div>
      </div>
    </PageLayout>
  );
}
