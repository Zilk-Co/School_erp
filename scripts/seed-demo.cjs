const { Pool } = require('C:/Users/Dell/Desktop/SchoolERP/node_modules/.pnpm/pg@8.22.0/node_modules/pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const S = 1;

async function q(text, params) {
  const r = await pool.query(text, params);
  return r.rows;
}

async function run() {
  await q(`INSERT INTO schools (id, name, academic_year) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`, [S, 'Alder Finch Academy', '2024-25']);
  console.log('1. School');

  const cls = ['Early Years','Primary','Middle School','Secondary'];
  const cid = [];
  for (const n of cls) { const r = await q(`INSERT INTO school_classes (school_id,name) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id`,[S,n]); if(r.length) cid.push(r[0].id); else { const e = await q(`SELECT id FROM school_classes WHERE school_id=$1 AND name=$2`,[S,n]); cid.push(e[0].id); } }
  console.log('2. Classes:', cid);

  const sid = [];
  for (const c of cid) { for (const s of ['A','B']) { const r = await q(`INSERT INTO school_sections (class_id,name) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id`,[c,s]); if(r.length) sid.push(r[0].id); else { const e = await q(`SELECT id FROM school_sections WHERE class_id=$1 AND name=$2`,[c,s]); sid.push(e[0].id); } } }
  console.log('3. Sections:', sid);

  const sess = [{n:'2023-24',s:'2023-08-01',e:'2024-06-30',a:false},{n:'2024-25',s:'2024-08-01',e:'2025-06-30',a:true}];
  const sessid = [];
  for (const x of sess) { const r = await q(`INSERT INTO academic_sessions (school_id,name,start_date,end_date,is_active) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,[S,x.n,x.s,x.e,x.a]); if(r.length) sessid.push(r[0].id); else { const e = await q(`SELECT id FROM academic_sessions WHERE school_id=$1 AND name=$2`,[S,x.n]); sessid.push(e[0].id); } }
  console.log('4. Sessions:', sessid);

  const fh = [{n:'Tuition Fee',a:25000},{n:'Transport Fee',a:5000},{n:'Library Fee',a:1500},{n:'Lab Fee',a:3000},{n:'Sports Fee',a:2000}];
  const fhid = [];
  for (const x of fh) { const r = await q(`INSERT INTO fee_heads (school_id,name,amount,is_active) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING RETURNING id`,[S,x.n,x.a]); if(r.length) fhid.push(r[0].id); else { const e = await q(`SELECT id FROM fee_heads WHERE school_id=$1 AND name=$2`,[S,x.n]); fhid.push(e[0].id); } }
  console.log('5. Fee heads:', fhid);

  for (const c of cid) for (const s of sessid) for (let i=0;i<fhid.length;i++) await q(`INSERT INTO fee_structure_items (school_id,class_id,session_id,fee_head_id,amount,is_active) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT DO NOTHING`,[S,c,s,fhid[i],fh[i].a]);
  console.log('6. Fee structures');

  const des = [{n:'Principal',sys:true},{n:'Vice Principal',sys:false},{n:'Teacher',sys:true},{n:'Lab Assistant',sys:false},{n:'Admin Officer',sys:false},{n:'Accountant',sys:false},{n:'Librarian',sys:false},{n:'Driver',sys:false}];
  const desid = [];
  for (const x of des) { const r = await q(`INSERT INTO designations (school_id,name,is_system) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,[S,x.n,x.sys]); if(r.length) desid.push(r[0].id); else { const e = await q(`SELECT id FROM designations WHERE school_id=$1 AND name=$2`,[S,x.n]); desid.push(e[0].id); } }
  console.log('7. Designations:', desid);

  const emps = [
    ['Dr. Ayesha Khan','Principal','Administration','0301-1234567',98,'Present'],
    ['Mr. Tariq Hussain','Vice Principal','Administration','0302-2345678',96,'Present'],
    ['Ms. Fatima Noor','Teacher','Academics','0303-3456789',100,'Present'],
    ['Mr. Imran Ali','Teacher','Academics','0304-4567890',92,'Present'],
    ['Ms. Sara Malik','Teacher','Academics','0305-5678901',100,'Present'],
    ['Mr. Hamza Shah','Teacher','Academics','0306-6789012',85,'Absent'],
    ['Ms. Zainab Raza','Lab Assistant','Science','0307-7890123',100,'Present'],
    ['Mr. Bilal Ahmad','Admin Officer','Administration','0308-8901234',94,'Present'],
    ['Ms. Nadia Parveen','Accountant','Finance','0309-9012345',97,'Present'],
    ['Mr. Rizwan Haider','Librarian','Library','0310-0123456',100,'Present'],
  ];
  for (const e of emps) { const d = await q(`SELECT id FROM designations WHERE school_id=$1 AND name=$2`,[S,e[1]]); if(d.length) await q(`INSERT INTO employees (school_id,name,designation_id,department,phone,attendance,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,[S,e[0],d[0].id,e[2],e[3],e[4],e[5]]); }
  console.log('8. Employees');

  const studs = [
    ['Ahmed Raza','Early Years','A','Muhammad Raza','0311-1111111','35202-1234567-1','35202-7654321-2','Engineer','Teacher','Sana Raza'],
    ['Ayesha Siddiqui','Early Years','B','Omar Siddiqui','0312-2222222','35202-2345678-1','35202-8765432-3','Doctor','Nurse','Zara Siddiqui'],
    ['Hassan Javed','Primary','A','Javed Iqbal','0313-3333333','35202-3456789-1','35202-9876543-4','Businessman','Homemaker','Nasreen Javed'],
    ['Fatima Zahra','Primary','A','Ali Zahra','0314-4444444','35202-4567890-1','35202-1098765-5','Accountant','Lawyer','Maham Zahra'],
    ['Usman Ghani','Primary','B','Ghani Khan','0315-5555555','35202-5678901-1','35202-2109876-6','Banker','Teacher','Rabia Ghani'],
    ['Hira Noor','Middle School','A','Asif Noor','0316-6666666','35202-6789012-1','35202-3210987-7','Professor','Doctor','Iram Noor'],
    ['Danish Sheikh','Middle School','A','Farooq Sheikh','0317-7777777','35202-7890123-1','35202-4321098-8','Manager','Engineer','Nida Sheikh'],
    ['Mehwish Alvi','Middle School','B','Kamran Alvi','0318-8888888','35202-8901234-1','35202-5432109-9','Architect','Designer','Bushra Alvi'],
    ['Saad Mirza','Secondary','A','Naeem Mirza','0319-9999999','35202-9012345-1','35202-6543210-0','Lawyer','Professor','Amina Mirza'],
    ['Kinza Tariq','Secondary','A','Tariq Mehmood','0320-1010101','35202-0123456-1','35202-7654321-0','Developer','HR Manager','Sobia Mehmood'],
    ['Bilal Syed','Secondary','B','Waqas Syed','0321-2020202','35202-1234568-1','35202-8765432-0','Pharmacist','Nurse','Aisha Syed'],
    ['Zainab Fatima','Secondary','B','Yasir Fatima','0322-3030303','35202-2345679-1','35202-9876543-0','Civil Engineer','Teacher','Kainat Fatima'],
  ];
  const activeSess = sessid[1];
  for (let i=0;i<studs.length;i++) {
    const s = studs[i];
    const c = await q(`SELECT id FROM school_classes WHERE school_id=$1 AND name=$2`,[S,s[1]]);
    const sec = await q(`SELECT id FROM school_sections WHERE class_id=$1 AND name=$2`,[c[0].id,s[2]]);
    const an = 'ADM-2024-'+String(i+1).padStart(4,'0');
    await q(`INSERT INTO students (school_id,admission_no,name,class_id,section_id,guardian,phone,father_cnic,father_designation,mother_full_name,mother_cnic,mother_designation,mother_phone,session_id,status,joined) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Active','2024-08-15') ON CONFLICT DO NOTHING`,
      [S,an,s[0],c[0].id,sec[0].id,s[3],s[4],s[5],s[7],s[9],s[6],s[8],s[4],activeSess]);
  }
  console.log('9. Students:', studs.length);

  const inqs = [
    ['Noor Fatima',0,activeSess,'Tariq Fatima','35202-1111111-1','Engineer','0323-4040404','Amina Fatima','35202-2222222-2','Doctor'],
    ['Saifullah Khan',1,activeSess,'Ibrahim Khan','35202-3333333-3','Banker','0324-5050505','Saima Khan','35202-4444444-4','Teacher'],
    ['Areeba Shah',2,activeSess,'Noman Shah','35202-5555555-5','Manager','0325-6060606','Hira Shah','35202-6666666-6','Accountant'],
    ['Omar Farooq',3,activeSess,'Hafeez Farooq','35202-7777777-7','Professor','0326-7070707','Samina Farooq','35202-8888888-8','Principal'],
    ['Mariam Bibi',1,activeSess,'Salman Bibi','35202-9999999-9','Developer','0327-8080808','Rukhsana Bibi','35202-0000000-0','Homemaker'],
  ];
  const inqids = [];
  for (let i=0;i<inqs.length;i++) {
    const x = inqs[i];
    const no = 'INQ-2024-'+String(i+1).padStart(4,'0');
    const r = await q(`INSERT INTO admission_inquiries (school_id,inquiry_no,student_name,class_id,session_id,father_full_name,father_cnic,father_designation,father_phone,mother_full_name,mother_cnic,mother_designation,mother_phone,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Inquiry') ON CONFLICT DO NOTHING RETURNING id`,
      [S,no,x[0],cid[x[1]],x[2],x[3],x[4],x[5],x[6],x[7],x[8],x[9],x[6]]);
    if(r.length) { inqids.push(r[0].id); for(let j=0;j<fhid.length;j++) await q(`INSERT INTO inquiry_fee_items (inquiry_id,fee_head_id,amount) VALUES($1,$2,$3)`,[r[0].id,fhid[j],fh[j].a]); }
  }
  console.log('10. Inquiries:', inqids.length);

  for(let i=0;i<Math.min(2,inqids.length);i++){
    const no = 'INV-2024-'+String(i+1).padStart(4,'0');
    const tot = await q(`SELECT SUM(amount) as t FROM inquiry_fee_items WHERE inquiry_id=$1`,[inqids[i]]);
    const t = Number(tot[0]?.t||0);
    const r = await q(`INSERT INTO invoices (school_id,inquiry_id,invoice_no,category,amount,due_date,status) VALUES($1,$2,$3,'Admission fees',$4,'2024-08-20','Pending') ON CONFLICT DO NOTHING RETURNING id`,[S,inqids[i],no,t]);
    if(r.length){ const fis = await q(`SELECT i.fee_head_id,i.amount,f.name FROM inquiry_fee_items i JOIN fee_heads f ON f.id=i.fee_head_id WHERE i.inquiry_id=$1`,[inqids[i]]); for(const fi of fis) await q(`INSERT INTO invoice_items (invoice_id,fee_head_id,description,amount) VALUES($1,$2,$3,$4)`,[r[0].id,fi.fee_head_id,fi.name,fi.amount]); }
  }
  console.log('11. Invoices');

  const inv = await q(`SELECT id,amount FROM invoices WHERE school_id=$1 ORDER BY id LIMIT 1`,[S]);
  if(inv.length) { await q(`INSERT INTO payments (school_id,invoice_id,amount,method,paid_at) VALUES($1,$2,$3,'bank transfer','2024-08-22T10:00:00Z') ON CONFLICT DO NOTHING`,[S,inv[0].id,Math.round(Number(inv[0].amount)*0.5)]); await q(`UPDATE invoices SET status='Pending' WHERE id=$1`,[inv[0].id]); }
  console.log('12. Payments');

  for (const a of [{n:'School Fee Collection',t:'Revenue'},{n:'Salary Expense',t:'Expense'},{n:'Transport Revenue',t:'Revenue'},{n:'Utility Expense',t:'Expense'},{n:'Miscellaneous',t:'Other'}]) await q(`INSERT INTO accounts (school_id,name,account_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[S,a.n,a.t]);
  console.log('13. Accounts');

  const accts = await q(`SELECT id FROM accounts WHERE school_id=$1 ORDER BY id LIMIT 2`,[S]);
  if(accts.length>=2){ const r = await q(`INSERT INTO journal_entries (school_id,entry_date,description) VALUES($1,'2024-08-20','Opening balance transfer') RETURNING id`,[S]); if(r.length){ await q(`INSERT INTO journal_lines (journal_entry_id,account_id,debit,credit) VALUES($1,$2,50000,0)`,[r[0].id,accts[0].id]); await q(`INSERT INTO journal_lines (journal_entry_id,account_id,debit,credit) VALUES($1,$2,0,50000)`,[r[0].id,accts[1].id]); } }
  console.log('14. Journal entries');

  const acts = [
    ['New student enrolled','Ahmed Raza enrolled in Early Years - Section A','admission',10],
    ['New student enrolled','Ayesha Siddiqui enrolled in Early Years - Section B','admission',9],
    ['Payment received','Rs. 18,250 received from Muhammad Raza for INV-2024-0001','finance',8],
    ['Employee added','Dr. Ayesha Khan joined as Principal','hr',7],
    ['Employee added','Ms. Fatima Noor joined as Teacher','hr',6],
    ['Inquiry created','Noor Fatima - Early Years - from Tariq Fatima','admission',5],
    ['Inquiry created','Saifullah Khan - Primary - from Ibrahim Khan','admission',4],
    ['Fee structure updated','Fee structure set for Primary - 2024-25','setup',3],
    ['Invoice generated','INV-2024-0002 created for Areeba Shah','finance',2],
    ['School settings updated','Academic year updated to 2024-25','setup',1],
  ];
  for (const a of acts) await q(`INSERT INTO activity (school_id,title,description,activity_time,type) VALUES($1,$2,$3,NOW()-interval '1 hour'*$4,$5)`,[S,a[0],a[1],a[3],a[2]]);
  console.log('15. Activity');

  for (const m of ['admissions','people','finance','attendance']) await q(`INSERT INTO module_toggles (school_id,module_key,enabled) VALUES($1,$2,true) ON CONFLICT DO NOTHING`,[S,m]);
  console.log('16. Module toggles');

  console.log('\n=== SEED DONE ===');
  await pool.end();
}

run().catch(e => { console.error('FAIL:', e.message); pool.end(); process.exit(1); });
