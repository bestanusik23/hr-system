// ใบรับรองการฝึกงาน (intern completion) — thin adapter over the shared certificate template.
import CertificateTemplate from "../../components/certificate/CertificateTemplate";

interface CertData {
  cert_id: string; full_name: string; institution_name: string | null;
  faculty: string | null; major: string | null; department_name: string | null;
  start_date: string | null; end_date: string | null;
  issued_at: string; status: string; qr_token: string;
}
interface Props { cert: CertData; onClose?: () => void; }

function thDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const M = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
             "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function InternCertificateView({ cert, onClose }: Props) {
  const qrUrl = `${window.location.origin}/intern/cert/verify?token=${cert.qr_token}`;

  const bodyText = [
    `ขอรับรองว่า **${cert.full_name}** นักศึกษาจาก **${cert.institution_name ?? "—"}**`
      + ` ได้เข้ารับการฝึกประสบการณ์วิชาชีพ ณ โรงพยาบาลเชียงราย ราม${cert.department_name ? ` แผนก${cert.department_name}` : ""}`,
    `ตั้งแต่วันที่ **${thDate(cert.start_date)}** ถึงวันที่ **${thDate(cert.end_date)}**`
      + ` และได้ปฏิบัติหน้าที่ตามระยะเวลาที่กำหนดเรียบร้อยแล้ว`,
  ].join("\n");

  return (
    <CertificateTemplate
      domId="intern-cert-print-area"
      printDocTitle={`ใบรับรองการฝึกงาน — ${cert.full_name}`}
      certId={cert.cert_id}
      qrVerifyUrl={qrUrl}
      recipientName={cert.full_name}
      eyebrow="ใบรับรองการฝึกประสบการณ์วิชาชีพ / ฝึกงาน"
      nameMaxSize={70}
      nameMinSize={28}
      bodyText={bodyText}
      issuedOnText={`ให้ไว้ ณ วันที่ ${thDate(cert.issued_at.slice(0, 10))}`}
      onClose={onClose}
    />
  );
}
