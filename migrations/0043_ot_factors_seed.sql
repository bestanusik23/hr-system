-- Seeds the "หมายเหตุ" / ปัจจัยที่มีผลต่อค่าล่วงเวลา notes from docs/ot-2569.xlsx sheet "69"
-- rows 48-53 — this data existed in the source file but was missed by the original
-- import script (which only pulled the Budget/Actual number grid), so the factors
-- box has been showing empty in the app despite HR having already written these.
INSERT INTO ot_factors (year_month, factor_text, sort_order, created_by) VALUES
  ('2569-05', 'ลดเวรบ่าย - ดึก พยาบาลและผู้ช่วย IPD', 1, 'import-script'),
  ('2569-05', 'พยาบาล ER ลาออก ไม่รับเพิ่ม', 2, 'import-script'),
  ('2569-05', 'พยาบาล OPD ลาออก 1 / PN ลาออก 1 ไม่รับเพิ่ม', 3, 'import-script'),
  ('2569-05', 'ปรับลดเวรผู้ช่วยนักเทคนิคการแพทย์', 4, 'import-script'),
  ('2569-05', 'อังคาร-พุธ เภสัชกร / ผู้ช่วยไปทำเคมีบำบัด', 5, 'import-script'),
  ('2569-07', 'อนุมัติจ่ายเงินค่าล่วงเวลา แผนก บัญชี / IT เพื่อแก้ไขปัญหา และ ลงข้อมูล โปรแกรม BIT', 1, 'import-script'),
  ('2569-09', 'ออกหน่วยสนับสนุนการแข่งฟุตบอลไทยลีก 3', 1, 'import-script'),
  ('2569-10', 'พนักงานขับรถฉุกเฉินไปทำโอทีตึกรังสีรักษา', 1, 'import-script');
