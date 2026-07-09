// ใบประกาศนียบัตร (training completion) — thin adapter over the shared certificate template.
import CertificateTemplate, { CERT_COLORS } from "../../components/certificate/CertificateTemplate";

interface CertData {
  cert_id: string; full_name: string; position: string | null;
  department: string | null; hours: number | null;
  course_name: string; course_date: string | null;
  issued_at: string; status: string; qr_token: string;
  trainer: string | null;
}
interface Props { cert: CertData; onClose?: () => void; }

function thDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const M = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
             "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function CertificateView({ cert, onClose }: Props) {
  const qrUrl = `${window.location.origin}/cert/verify?token=${cert.qr_token}`;

  return (
    <CertificateTemplate
      domId="cert-print-area"
      printDocTitle={`ใบประกาศนียบัตร — ${cert.full_name}`}
      certId={cert.cert_id}
      qrVerifyUrl={qrUrl}
      recipientName={cert.full_name}
      eyebrow="ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า"
      nameMaxSize={85}
      nameMinSize={32}
      bodyText={
        <>
          ได้เข้าร่วมการอบรม <span style={{ fontWeight: 700 }}>{cert.course_name}</span>
          {cert.course_date && <><br />วันที่ {thDate(cert.course_date)}</>}
          <br />
          <span style={{ color: CERT_COLORS.blue }}>
            ณ โรงพยาบาลเชียงราย ราม<br />โดยบรรลุวัตถุประสงค์ของโครงการทุกประการ
          </span>
        </>
      }
      issuedOnText={`ให้ ณ วันที่ ${thDate(cert.course_date)}`}
      onClose={onClose}
    />
  );
}
