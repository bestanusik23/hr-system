-- Rename departments in ฝ่ายการพยาบาลส่วนหน้า to match ManpowerTable section headers
UPDATE departments SET name = 'ผู้ป่วยนอก'
  WHERE name = 'OPD'
    AND division_id = (SELECT id FROM divisions WHERE name = 'ฝ่ายการพยาบาลส่วนหน้า');

UPDATE departments SET name = 'ฉุกเฉินและอุบัติเหตุ'
  WHERE name = 'ER'
    AND division_id = (SELECT id FROM divisions WHERE name = 'ฝ่ายการพยาบาลส่วนหน้า');

UPDATE departments SET name = 'การแพทย์ฉุกเฉิน'
  WHERE name = 'Ambulance'
    AND division_id = (SELECT id FROM divisions WHERE name = 'ฝ่ายการพยาบาลส่วนหน้า');

UPDATE departments SET name = 'ศูนย์สุขภาพ'
  WHERE name = 'Check up'
    AND division_id = (SELECT id FROM divisions WHERE name = 'ฝ่ายการพยาบาลส่วนหน้า');
