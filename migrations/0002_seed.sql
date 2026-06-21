-- =====================================================================
--  HR System — Seed / reference data  (DRAFT for review)
--  รันหลัง schema.sql  (idempotent-ish; ใช้กับ D1 instance เปล่า)
-- =====================================================================

-- ---------- RBAC matrix (5 บทบาท ตรงกับ design) ----------
-- access: full | scope | approve | view | submit | none
INSERT INTO role_module_access (role, module, access) VALUES
  ('hr','recruit','full'),    ('hr','eval','full'),    ('hr','training','full'),    ('hr','transfer','full'),    ('hr','exec','full'),    ('hr','permissions','none'),
  ('head','recruit','scope'), ('head','eval','scope'), ('head','training','view'),  ('head','transfer','submit'),('head','exec','none'),  ('head','permissions','none'),
  ('deputy','recruit','scope'),('deputy','eval','approve'),('deputy','training','view'),('deputy','transfer','approve'),('deputy','exec','full'),('deputy','permissions','none'),
  -- deputyHR = ผู้อนุมัติขั้นสุดท้าย (HR final): เหมือน deputy แต่ถือสิทธิ์ปิด workflow ขั้นสุดท้าย (ตรรกะอยู่ใน API)
  ('deputyHR','recruit','view'),('deputyHR','eval','approve'),('deputyHR','training','view'),('deputyHR','transfer','approve'),('deputyHR','exec','full'),('deputyHR','permissions','none'),
  ('admin','recruit','full'), ('admin','eval','full'), ('admin','training','full'), ('admin','transfer','full'), ('admin','exec','full'), ('admin','permissions','full');

-- ---------- หัวข้อประเมิน 10 ข้อ (owner: hr=1-3, head=4-10) ----------
INSERT INTO eval_topics (id, owner, text, sort_order) VALUES
  (1,'hr','การมาปฏิบัติงานตรงเวลา และสถิติการลา / ขาด / สาย',1),
  (2,'hr','การปฏิบัติตามระเบียบ ข้อบังคับ และวินัยขององค์กร',2),
  (3,'hr','การแต่งกาย บุคลิกภาพ และการวางตัว',3),
  (4,'head','ความรู้ความสามารถในงานที่รับผิดชอบ',4),
  (5,'head','คุณภาพและความถูกต้องของผลงาน',5),
  (6,'head','ปริมาณงานที่ทำได้สำเร็จตามเป้าหมาย',6),
  (7,'head','ความรับผิดชอบและความตั้งใจในการทำงาน',7),
  (8,'head','การทำงานเป็นทีมและมนุษยสัมพันธ์',8),
  (9,'head','การแก้ปัญหาเฉพาะหน้าและการตัดสินใจ',9),
  (10,'head','ความคิดริเริ่มและการพัฒนาตนเอง',10);

-- ---------- โครงสร้างองค์กร 12 ฝ่าย (จาก orgStructure ใน design) ----------
INSERT INTO divisions (name, approver_name, approver_role, sort_order) VALUES
  ('ฝ่ายการแพทย์','ทพ.ธรรพวัธร์ สนชิชัย','ผู้อำนวยการฝ่ายการแพทย์',1),
  ('ฝ่ายเทคนิคบริการ','น.ส.พรรณพินันท์ ไชยอนุ','รองผู้อำนวยการฝ่ายเทคนิคบริการ (สหสาขา)',2),
  ('ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ','นายนพลักษณ์ ทองแผ่น','รองผู้อำนวยการฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ',3),
  ('ฝ่ายการเงิน','น.ส.กุลธมาส เตชะธีรวัฒน์','รองผู้อำนวยการฝ่ายการเงิน',4),
  ('ฝ่ายบัญชี','น.ส.กุลธมาส เตชะธีรวัฒน์','รองผู้อำนวยการฝ่ายบัญชี',5),
  ('ฝ่ายสนับสนุน','นางพิมพ์พิชา วงค์เทพเตียน','รองผู้อำนวยการฝ่ายสนับสนุน',6),
  ('ฝ่ายพัฒนาองค์กร','น.ส.ศักดิ์คณา เตชะธีรวัฒน์','รองผู้อำนวยการฝ่ายพัฒนาองค์กร',7),
  ('ฝ่ายการพยาบาลส่วนใน','นายจักรินทร์ ยะนา','รองผู้อำนวยการฝ่ายการพยาบาลส่วนใน',8),
  ('ฝ่ายการพยาบาลส่วนหน้า','น.ส.มนชยา เผ่งปริง','รองผู้อำนวยการฝ่ายการพยาบาลส่วนหน้า',9),
  ('สำนักงานผู้อำนวยการ','น.ส.กมลชนก สามิตร','รองผู้อำนวยการประจำสำนักงานผู้อำนวยการ',10),
  ('ศูนย์มะเร็ง','น.ส.กมลชนก สามิตร','รองผู้อำนวยการประจำศูนย์มะเร็ง',11);

-- แผนกในแต่ละฝ่าย (department) — อ้าง division ด้วย subquery ตามชื่อ
INSERT INTO departments (division_id, name)
SELECT id, dept FROM divisions, (
  SELECT 'ฝ่ายการแพทย์' AS dv, 'แพทย์ประจำ' AS dept UNION ALL
  SELECT 'ฝ่ายการแพทย์','แพทย์ Part Time' UNION ALL
  SELECT 'ฝ่ายการแพทย์','แพทย์ที่ปรึกษา' UNION ALL
  SELECT 'ฝ่ายเทคนิคบริการ','เภสัชกรรม' UNION ALL
  SELECT 'ฝ่ายเทคนิคบริการ','รังสีวินิจฉัย' UNION ALL
  SELECT 'ฝ่ายเทคนิคบริการ','เทคนิคการแพทย์' UNION ALL
  SELECT 'ฝ่ายเทคนิคบริการ','กายภาพบำบัด' UNION ALL
  SELECT 'ฝ่ายเทคนิคบริการ','ไตเทียม' UNION ALL
  SELECT 'ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ','ทรัพยากรบุคคล' UNION ALL
  SELECT 'ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ','พัฒนาคุณภาพ' UNION ALL
  SELECT 'ฝ่ายการเงิน','การเงิน' UNION ALL
  SELECT 'ฝ่ายการเงิน','จัดซื้อ' UNION ALL
  SELECT 'ฝ่ายบัญชี','บัญชี' UNION ALL
  SELECT 'ฝ่ายบัญชี','สินทรัพย์' UNION ALL
  SELECT 'ฝ่ายบัญชี','สโตร์' UNION ALL
  SELECT 'ฝ่ายสนับสนุน','ซ่อมบำรุง' UNION ALL
  SELECT 'ฝ่ายสนับสนุน','อาคารสถานที่/จป.' UNION ALL
  SELECT 'ฝ่ายสนับสนุน','แม่บ้าน' UNION ALL
  SELECT 'ฝ่ายสนับสนุน','ซักฟอก' UNION ALL
  SELECT 'ฝ่ายสนับสนุน','โภชนาการ' UNION ALL
  SELECT 'ฝ่ายสนับสนุน','ยานยนต์' UNION ALL
  SELECT 'ฝ่ายพัฒนาองค์กร','ขายและการตลาด' UNION ALL
  SELECT 'ฝ่ายพัฒนาองค์กร','ต้อนรับและบริการ' UNION ALL
  SELECT 'ฝ่ายพัฒนาองค์กร','เวรเปล' UNION ALL
  SELECT 'ฝ่ายพัฒนาองค์กร','ประชาสัมพันธ์' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนใน','IPD' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนใน','OR' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนใน','LR' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนใน','NS/NICU' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนใน','ICU' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนใน','หน่วยจ่ายกลาง' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนใน','เครื่องมือแพทย์' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนหน้า','OPD' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนหน้า','ER' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนหน้า','Ambulance' UNION ALL
  SELECT 'ฝ่ายการพยาบาลส่วนหน้า','Check up' UNION ALL
  SELECT 'สำนักงานผู้อำนวยการ','ทบทวนทรัพยากรการเบิกค่ารักษา' UNION ALL
  SELECT 'สำนักงานผู้อำนวยการ','เลขานุการและธุรการ' UNION ALL
  SELECT 'สำนักงานผู้อำนวยการ','เทคโนโลยีสารสนเทศ' UNION ALL
  SELECT 'สำนักงานผู้อำนวยการ','ประสานงานแพทย์' UNION ALL
  SELECT 'ศูนย์มะเร็ง','รังสีรักษา' UNION ALL
  SELECT 'ศูนย์มะเร็ง','เคมีบำบัด'
) map
WHERE divisions.name = map.dv;

-- ---------- ผู้ใช้ตั้งต้น ----------
-- หมายเหตุ: password_hash/salt จะ generate ตอน implement (PBKDF2) ไม่ hard-code ที่นี่
-- บัญชีอ้างอิงจาก design (เปลี่ยนรหัสผ่านตอน go-live):
--   hr (เจ้าหน้าที่ HR) · head (หัวหน้าแผนกเภสัชกรรม, scope=เภสัชกรรม)
--   deputy (รองผอ.ฝ่ายเทคนิคบริการ, scope=ฝ่ายเทคนิคบริการ)
--   deputyHR (รองผอ.ฝ่ายบริหารค่าตอบแทนฯ — final approver)
--   admin (ผู้ดูแลระบบ)
