// Positions required to hold a professional license: nurses, pharmacists,
// medical technologists, radiologic technologists, medical physicists, and
// doctors of any specialty.
//
// Two classes of false match this filter has to avoid, both verified against
// real position titles in this hospital's data:
//   - assistant roles, written either "ผู้ช่วย..." or abbreviated "ผช."
//   - non-clinical job titles that merely contain the word "แพทย์"
//     (เครื่องมือแพทย์ = medical equipment, องค์กรแพทย์ = medical staff org,
//      ประสานงานแพทย์ = doctor liaison) — these are not doctors.
//
// Shared by /api/exec/kpi.ts and /api/iso-kpi/monthly.ts so the license KPI
// always means the same thing everywhere it's shown.
export const LICENSED_POSITION_FILTER = `(
  position NOT LIKE '%ผู้ช่วย%' AND position NOT LIKE '%ผช.%'
  AND (
    position LIKE '%พยาบาล%'
    OR position LIKE '%เภสัชกร%'
    OR position LIKE '%เทคนิคการแพทย์%'
    OR position LIKE '%รังสีเทคนิค%'
    OR position LIKE '%ฟิสิกส์%'
    OR (
      position LIKE '%แพทย์%'
      AND position NOT LIKE '%เทคนิคการแพทย์%'
      AND position NOT LIKE '%เครื่องมือแพทย์%'
      AND position NOT LIKE '%องค์กรแพทย์%'
      AND position NOT LIKE '%ประสานงานแพทย์%'
    )
  )
)`;
