import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  accountsTable,
  activityTable,
  classesTable,
  employeesTable,
  invoicesTable,
  invoiceItemsTable,
  journalEntriesTable,
  journalLinesTable,
  paymentsTable,
  schoolsTable,
  sectionsTable,
  studentsTable,
  designationsTable,
  academicSessionsTable,
  admissionInquiriesTable,
  feeHeadsTable,
  feeStructureItemsTable,
  inquiryFeeItemsTable,
  moduleTogglesTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

const DEMO_SCHOOL_ID = 1;
const router: IRouter = Router();
const money = (value: string | number | null) => Number(value ?? 0);
const displayDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
const today = () => new Date().toISOString().slice(0, 10);
const cnicPattern = /^\d{5}-\d{7}-\d$/;
const validCnic = (value: unknown) => value === undefined || value === null || value === "" || cnicPattern.test(String(value));
async function cnicInUse(cnic: string, excludeInquiryId?: number, excludeStudentId?: number) {
  const [inquiry] = await db.select({ id: admissionInquiriesTable.id }).from(admissionInquiriesTable)
    .where(and(or(eq(admissionInquiriesTable.fatherCnic, cnic), eq(admissionInquiriesTable.motherCnic, cnic)), excludeInquiryId ? sql`${admissionInquiriesTable.id} <> ${excludeInquiryId}` : sql`true`)).limit(1);
  const [student] = await db.select({ id: studentsTable.id }).from(studentsTable)
    .where(and(or(eq(studentsTable.fatherCnic, cnic), eq(studentsTable.motherCnic, cnic)), excludeStudentId ? sql`${studentsTable.id} <> ${excludeStudentId}` : sql`true`)).limit(1);
  return Boolean(inquiry || student);
}
const inquirySelect = {
  id: admissionInquiriesTable.id, inquiryNo: admissionInquiriesTable.inquiryNo,
  studentName: admissionInquiriesTable.studentName, dateOfBirth: admissionInquiriesTable.dateOfBirth,
  gender: admissionInquiriesTable.gender, previousSchool: admissionInquiriesTable.previousSchool,
  classId: admissionInquiriesTable.classId, sessionId: admissionInquiriesTable.sessionId,
  fatherFullName: admissionInquiriesTable.fatherFullName, fatherCnic: admissionInquiriesTable.fatherCnic,
  fatherDesignation: admissionInquiriesTable.fatherDesignation, fatherPhone: admissionInquiriesTable.fatherPhone,
  motherFullName: admissionInquiriesTable.motherFullName, motherCnic: admissionInquiriesTable.motherCnic,
  motherDesignation: admissionInquiriesTable.motherDesignation, motherPhone: admissionInquiriesTable.motherPhone,
  address: admissionInquiriesTable.address, notes: admissionInquiriesTable.notes,
  status: admissionInquiriesTable.status, enrolledStudentId: admissionInquiriesTable.enrolledStudentId,
  createdAt: admissionInquiriesTable.createdAt,
};

async function getInquiry(id: number) {
  const [inquiry] = await db.select(inquirySelect).from(admissionInquiriesTable)
    .where(and(eq(admissionInquiriesTable.id, id), eq(admissionInquiriesTable.schoolId, DEMO_SCHOOL_ID)));
  if (!inquiry) return null;
  const fees = await db.select({ id: inquiryFeeItemsTable.id, feeHeadId: inquiryFeeItemsTable.feeHeadId, feeHead: feeHeadsTable.name, amount: inquiryFeeItemsTable.amount })
    .from(inquiryFeeItemsTable).innerJoin(feeHeadsTable, eq(inquiryFeeItemsTable.feeHeadId, feeHeadsTable.id))
    .where(eq(inquiryFeeItemsTable.inquiryId, id));
  const invoices = await db.select({ id: invoicesTable.id, invoiceNo: invoicesTable.invoiceNo, category: invoicesTable.category, amount: invoicesTable.amount, status: invoicesTable.status })
    .from(invoicesTable).where(eq(invoicesTable.inquiryId, id)).orderBy(desc(invoicesTable.id));
  const invoiceItems = invoices.length ? await db.select({ invoiceId: invoiceItemsTable.invoiceId, feeHeadId: invoiceItemsTable.feeHeadId, description: invoiceItemsTable.description, amount: invoiceItemsTable.amount })
    .from(invoiceItemsTable).where(inArray(invoiceItemsTable.invoiceId, invoices.map((invoice) => invoice.id))) : [];
  const paid = invoices.length ? await db.select({ total: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(inArray(paymentsTable.invoiceId, invoices.map((invoice) => invoice.id))) : [{ total: "0" }];
  const total = fees.reduce((sum, fee) => sum + money(fee.amount), 0);
  return { ...inquiry, createdAt: inquiry.createdAt.toISOString(), fees: fees.map((fee) => ({ ...fee, amount: money(fee.amount) })), invoices: invoices.map((invoice) => ({ ...invoice, amount: money(invoice.amount), items: invoiceItems.filter((item) => item.invoiceId === invoice.id).map((item) => ({ ...item, amount: money(item.amount) })) })), total, paid: money(paid[0]?.total), balance: Math.max(total - money(paid[0]?.total), 0) };
}

router.get("/admissions/context", async (_req, res, next) => {
  try {
    const [classes, sections, sessions, feeHeads] = await Promise.all([
      db.select({ id: classesTable.id, name: classesTable.name }).from(classesTable).where(eq(classesTable.schoolId, DEMO_SCHOOL_ID)).orderBy(asc(classesTable.id)),
      db.select({ id: sectionsTable.id, classId: sectionsTable.classId, name: sectionsTable.name }).from(sectionsTable).orderBy(asc(sectionsTable.id)),
      db.select({ id: academicSessionsTable.id, name: academicSessionsTable.name, startDate: academicSessionsTable.startDate, endDate: academicSessionsTable.endDate, isActive: academicSessionsTable.isActive }).from(academicSessionsTable).where(eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID)).orderBy(desc(academicSessionsTable.id)),
      db.select({ id: feeHeadsTable.id, name: feeHeadsTable.name, amount: feeHeadsTable.amount }).from(feeHeadsTable).where(and(eq(feeHeadsTable.schoolId, DEMO_SCHOOL_ID), eq(feeHeadsTable.isActive, true))).orderBy(asc(feeHeadsTable.id)),
    ]);
    res.json({ classes, sections, sessions, feeHeads: feeHeads.map((fee) => ({ ...fee, amount: money(fee.amount) })) });
  } catch (error) { next(error); }
});

router.get("/setup", async (_req, res, next) => {
  try {
    const [school] = await db.select({ id: schoolsTable.id, name: schoolsTable.name, academicYear: schoolsTable.academicYear }).from(schoolsTable).where(eq(schoolsTable.id, DEMO_SCHOOL_ID));
    const [allClasses, sessions, feeHeads, structures] = await Promise.all([
      db.select({ id: classesTable.id, name: classesTable.name }).from(classesTable).where(eq(classesTable.schoolId, DEMO_SCHOOL_ID)).orderBy(asc(classesTable.id)),
      db.select().from(academicSessionsTable).where(eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID)).orderBy(desc(academicSessionsTable.id)),
      db.select({ id: feeHeadsTable.id, name: feeHeadsTable.name, amount: feeHeadsTable.amount, isActive: feeHeadsTable.isActive }).from(feeHeadsTable).where(eq(feeHeadsTable.schoolId, DEMO_SCHOOL_ID)).orderBy(asc(feeHeadsTable.id)),
      db.select({ id: feeStructureItemsTable.id, classId: feeStructureItemsTable.classId, sessionId: feeStructureItemsTable.sessionId, feeHeadId: feeStructureItemsTable.feeHeadId, amount: feeStructureItemsTable.amount }).from(feeStructureItemsTable).where(and(eq(feeStructureItemsTable.schoolId, DEMO_SCHOOL_ID), eq(feeStructureItemsTable.isActive, true))),
    ]);
    const allSections = await db.select({ id: sectionsTable.id, name: sectionsTable.name, classId: sectionsTable.classId }).from(sectionsTable).innerJoin(classesTable, eq(sectionsTable.classId, classesTable.id)).where(eq(classesTable.schoolId, DEMO_SCHOOL_ID));
    const classes = allClasses.map((c) => ({ ...c, sections: allSections.filter((s) => s.classId === c.id) }));
    return res.json({ school, classes, sessions, feeHeads: feeHeads.map((fee) => ({ ...fee, amount: money(fee.amount) })), structures: structures.map((item) => ({ ...item, amount: money(item.amount) })) });
  } catch (error) { return next(error); }
});

router.patch("/setup/school", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim(); const academicYear = String(req.body.academicYear ?? "").trim();
    if (!name || !academicYear) return res.status(400).json({ error: "School name and academic year are required" });
    const [updated] = await db.update(schoolsTable).set({ name, academicYear }).where(eq(schoolsTable.id, DEMO_SCHOOL_ID)).returning({ id: schoolsTable.id, name: schoolsTable.name, academicYear: schoolsTable.academicYear });
    return res.json(updated);
  } catch (error) { return next(error); }
});

router.post("/setup/classes", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Class name is required" });
    const [duplicate] = await db.select({ id: classesTable.id }).from(classesTable).where(and(eq(classesTable.schoolId, DEMO_SCHOOL_ID), eq(classesTable.name, name))).limit(1);
    if (duplicate) return res.status(409).json({ error: "That class already exists" });
    const [created] = await db.insert(classesTable).values({ schoolId: DEMO_SCHOOL_ID, name }).returning({ id: classesTable.id, name: classesTable.name });
    await db.insert(sectionsTable).values([{ classId: created.id, name: "A" }, { classId: created.id, name: "B" }]);
    return res.status(201).json(created);
  } catch (error) { return next(error); }
});

router.patch("/setup/classes/:classId", async (req, res, next) => {
  try {
    const id = Number(req.params.classId); const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Class name is required" });
    const [duplicate] = await db.select({ id: classesTable.id }).from(classesTable).where(and(eq(classesTable.schoolId, DEMO_SCHOOL_ID), eq(classesTable.name, name), sql`${classesTable.id} <> ${id}`)).limit(1);
    if (duplicate) return res.status(409).json({ error: "That class already exists" });
    const [updated] = await db.update(classesTable).set({ name }).where(and(eq(classesTable.id, id), eq(classesTable.schoolId, DEMO_SCHOOL_ID))).returning({ id: classesTable.id, name: classesTable.name });
    if (!updated) return res.status(404).json({ error: "Class not found" });
    return res.json(updated);
  } catch (error) { return next(error); }
});

router.post("/setup/sessions", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim(); const startDate = String(req.body.startDate ?? ""); const endDate = String(req.body.endDate ?? "");
    if (!name || !startDate || !endDate) return res.status(400).json({ error: "Session name, start date, and end date are required" });
    if (endDate < startDate) return res.status(400).json({ error: "Session end date must be after its start date" });
    const [duplicate] = await db.select({ id: academicSessionsTable.id }).from(academicSessionsTable).where(and(eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID), eq(academicSessionsTable.name, name))).limit(1);
    if (duplicate) return res.status(409).json({ error: "That academic session already exists" });
    const isActive = Boolean(req.body.isActive);
    const created = await db.transaction(async (tx) => {
      if (isActive) await tx.update(academicSessionsTable).set({ isActive: false }).where(eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID));
      const [row] = await tx.insert(academicSessionsTable).values({ schoolId: DEMO_SCHOOL_ID, name, startDate, endDate, isActive }).returning();
      return row;
    });
    return res.status(201).json(created);
  } catch (error) { return next(error); }
});

router.patch("/setup/sessions/:sessionId", async (req, res, next) => {
  try {
    const id = Number(req.params.sessionId); const name = String(req.body.name ?? "").trim(); const startDate = String(req.body.startDate ?? ""); const endDate = String(req.body.endDate ?? "");
    if (!name || !startDate || !endDate) return res.status(400).json({ error: "Session name, start date, and end date are required" });
    if (endDate < startDate) return res.status(400).json({ error: "Session end date must be after its start date" });
    const [duplicate] = await db.select({ id: academicSessionsTable.id }).from(academicSessionsTable).where(and(eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID), eq(academicSessionsTable.name, name), sql`${academicSessionsTable.id} <> ${id}`)).limit(1);
    if (duplicate) return res.status(409).json({ error: "That academic session already exists" });
    const updated = await db.transaction(async (tx) => {
      if (Boolean(req.body.isActive)) await tx.update(academicSessionsTable).set({ isActive: false }).where(eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID));
      const [row] = await tx.update(academicSessionsTable).set({ name, startDate, endDate, isActive: Boolean(req.body.isActive) }).where(and(eq(academicSessionsTable.id, id), eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID))).returning();
      return row;
    });
    if (!updated) return res.status(404).json({ error: "Session not found" });
    return res.json(updated);
  } catch (error) { return next(error); }
});

router.post("/setup/fee-heads", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim(); const amount = Number(req.body.amount ?? 0);
    if (!name || !Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Fee head name and a non-negative amount are required" });
    const [duplicate] = await db.select({ id: feeHeadsTable.id }).from(feeHeadsTable).where(and(eq(feeHeadsTable.schoolId, DEMO_SCHOOL_ID), eq(feeHeadsTable.name, name))).limit(1);
    if (duplicate) return res.status(409).json({ error: "That fee head already exists" });
    const [created] = await db.insert(feeHeadsTable).values({ schoolId: DEMO_SCHOOL_ID, name, amount: amount.toFixed(2), isActive: true }).returning();
    return res.status(201).json({ ...created, amount });
  } catch (error) { return next(error); }
});

router.put("/setup/fee-structures", async (req, res, next) => {
  try {
    const classId = Number(req.body.classId); const sessionId = Number(req.body.sessionId); const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!Number.isInteger(classId) || !Number.isInteger(sessionId)) return res.status(400).json({ error: "Class and session are required" });
    if (items.some((item: { feeHeadId?: unknown; amount?: unknown }) => !Number.isInteger(Number(item.feeHeadId)) || !Number.isFinite(Number(item.amount)) || Number(item.amount) < 0)) return res.status(400).json({ error: "Fee structure amounts must be non-negative values" });
    await db.transaction(async (tx) => {
      await tx.delete(feeStructureItemsTable).where(and(eq(feeStructureItemsTable.schoolId, DEMO_SCHOOL_ID), eq(feeStructureItemsTable.classId, classId), eq(feeStructureItemsTable.sessionId, sessionId)));
      if (items.length) await tx.insert(feeStructureItemsTable).values(items.map((item: { feeHeadId: number; amount: number }) => ({ schoolId: DEMO_SCHOOL_ID, classId, sessionId, feeHeadId: Number(item.feeHeadId), amount: Number(item.amount).toFixed(2), isActive: true })));
    });
    return res.json({ classId, sessionId, items });
  } catch (error) { return next(error); }
});

router.get("/inquiries", async (req, res, next) => {
  try {
    const filters = [eq(admissionInquiriesTable.schoolId, DEMO_SCHOOL_ID)];
    if (req.query.status) filters.push(eq(admissionInquiriesTable.status, String(req.query.status)));
    const rows = await db.select({ ...inquirySelect, className: classesTable.name, sessionName: academicSessionsTable.name })
      .from(admissionInquiriesTable).innerJoin(classesTable, eq(admissionInquiriesTable.classId, classesTable.id)).innerJoin(academicSessionsTable, eq(admissionInquiriesTable.sessionId, academicSessionsTable.id))
      .where(and(...filters)).orderBy(desc(admissionInquiriesTable.id));
    res.json(await Promise.all(rows.map(async (row) => { const detail = await getInquiry(row.id); return { ...detail, className: row.className, sessionName: row.sessionName }; })));
  } catch (error) { next(error); }
});

router.post("/inquiries", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (!body.studentName || !body.fatherFullName || !body.classId || !body.sessionId) return res.status(400).json({ error: "Student, father, class, and session are required" });
    if (!validCnic(body.fatherCnic) || !validCnic(body.motherCnic)) return res.status(400).json({ error: "CNIC must use the format 12345-1234567-1" });
    if (body.fatherCnic && body.motherCnic && body.fatherCnic === body.motherCnic) return res.status(409).json({ error: "Father and mother CNICs must be different" });
    for (const cnic of [body.fatherCnic, body.motherCnic].filter(Boolean).map(String)) {
      if (await cnicInUse(cnic)) return res.status(409).json({ error: "That CNIC is already linked to another record" });
    }
    const count = await db.select({ count: sql<number>`count(*)` }).from(admissionInquiriesTable).where(eq(admissionInquiriesTable.schoolId, DEMO_SCHOOL_ID));
    const [inquiry] = await db.insert(admissionInquiriesTable).values({
      schoolId: DEMO_SCHOOL_ID, inquiryNo: `INQ-${new Date().getFullYear()}-${String(Number(count[0].count) + 1).padStart(4, "0")}`,
      studentName: String(body.studentName), dateOfBirth: body.dateOfBirth || null, gender: body.gender || null, previousSchool: body.previousSchool || null,
      classId: Number(body.classId), sessionId: Number(body.sessionId), fatherFullName: String(body.fatherFullName), fatherCnic: body.fatherCnic || null, fatherDesignation: body.fatherDesignation || null, fatherPhone: body.fatherPhone || null,
      motherFullName: body.motherFullName || null, motherCnic: body.motherCnic || null, motherDesignation: body.motherDesignation || null, motherPhone: body.motherPhone || null, address: body.address || null, notes: body.notes || null,
    }).returning();
    const structure = await db.select({ feeHeadId: feeStructureItemsTable.feeHeadId, amount: feeStructureItemsTable.amount }).from(feeStructureItemsTable)
      .where(and(eq(feeStructureItemsTable.schoolId, DEMO_SCHOOL_ID), eq(feeStructureItemsTable.classId, inquiry.classId), eq(feeStructureItemsTable.sessionId, inquiry.sessionId), eq(feeStructureItemsTable.isActive, true)));
    const fallback = structure.length ? structure : (await db.select({ feeHeadId: feeHeadsTable.id, amount: feeHeadsTable.amount }).from(feeHeadsTable).where(eq(feeHeadsTable.schoolId, DEMO_SCHOOL_ID))).map((fee) => ({ ...fee, amount: fee.amount }));
    if (fallback.length) await db.insert(inquiryFeeItemsTable).values(fallback.map((fee) => ({ inquiryId: inquiry.id, feeHeadId: fee.feeHeadId, amount: String(fee.amount) })));
    return res.status(201).json(await getInquiry(inquiry.id));
  } catch (error) { return next(error); }
});

router.get("/inquiries/:inquiryId", async (req, res, next) => { try { const row = await getInquiry(Number(req.params.inquiryId)); if (!row) return res.status(404).json({ error: "Inquiry not found" }); return res.json(row); } catch (error) { return next(error); } });

router.patch("/inquiries/:inquiryId/fees", async (req, res, next) => {
  try {
    const id = Number(req.params.inquiryId); const inquiry = await getInquiry(id);
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    const fees = Array.isArray(req.body.fees) ? req.body.fees : [];
    if (fees.some((fee: { feeHeadId?: unknown; amount?: unknown }) => !Number.isInteger(Number(fee.feeHeadId)) || !Number.isFinite(Number(fee.amount)) || Number(fee.amount) < 0)) {
      return res.status(400).json({ error: "Fee heads and amounts must be valid, non-negative values" });
    }
    await db.transaction(async (tx) => { await tx.delete(inquiryFeeItemsTable).where(eq(inquiryFeeItemsTable.inquiryId, id)); if (fees.length) await tx.insert(inquiryFeeItemsTable).values(fees.map((fee: { feeHeadId: number; amount: number }) => ({ inquiryId: id, feeHeadId: Number(fee.feeHeadId), amount: Number(fee.amount).toFixed(2) }))); });
    return res.json(await getInquiry(id));
  } catch (error) { return next(error); }
});

router.delete("/inquiries/:inquiryId", async (req, res, next) => { try { const id = Number(req.params.inquiryId); const [invoice] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.inquiryId, id)).limit(1); if (invoice) return res.status(409).json({ error: "Delete the inquiry's invoices first" }); const deleted = await db.delete(admissionInquiriesTable).where(and(eq(admissionInquiriesTable.id, id), eq(admissionInquiriesTable.schoolId, DEMO_SCHOOL_ID))).returning({ id: admissionInquiriesTable.id }); if (!deleted.length) return res.status(404).json({ error: "Inquiry not found" }); return res.status(204).send(); } catch (error) { return next(error); } });

router.post("/inquiries/:inquiryId/invoice", async (req, res, next) => {
  try {
    const id = Number(req.params.inquiryId); const inquiry = await getInquiry(id); if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    if (!inquiry.fees.length) return res.status(400).json({ error: "Select at least one fee before generating an invoice" });
    const count = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.schoolId, DEMO_SCHOOL_ID));
    const invoice = await db.transaction(async (tx) => {
      const [created] = await tx.insert(invoicesTable).values({ schoolId: DEMO_SCHOOL_ID, studentId: null, inquiryId: id, invoiceNo: `INV-${new Date().getFullYear()}-${String(Number(count[0].count) + 1).padStart(4, "0")}`, category: "Admission fees", amount: inquiry.total.toFixed(2), dueDate: today(), status: "Pending" }).returning();
      await tx.insert(invoiceItemsTable).values(inquiry.fees.map((fee) => ({ invoiceId: created.id, feeHeadId: fee.feeHeadId, description: fee.feeHead, amount: fee.amount.toFixed(2) })));
      await tx.update(admissionInquiriesTable).set({ status: "Invoiced" }).where(eq(admissionInquiriesTable.id, id));
      return created;
    });
    return res.status(201).json({ ...invoice, amount: money(invoice.amount), balance: inquiry.total });
  } catch (error) { return next(error); }
});

router.post("/inquiries/:inquiryId/enroll", async (req, res, next) => {
  try {
    const id = Number(req.params.inquiryId); const inquiry = await getInquiry(id); if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    if (inquiry.status === "Enrolled" || inquiry.enrolledStudentId) return res.status(409).json({ error: "This inquiry has already been enrolled" });
    if (inquiry.invoices.length === 0 || inquiry.balance > 0) return res.status(409).json({ error: `Admission fees must be fully paid before enrollment. Outstanding balance: ${inquiry.balance.toFixed(2)}` });
    const [section] = await db.select().from(sectionsTable).where(eq(sectionsTable.classId, inquiry.classId)).orderBy(asc(sectionsTable.id)).limit(1); if (!section) return res.status(400).json({ error: "Create a section for this class before enrollment" });
    const student = await db.transaction(async (tx) => {
      const count = await tx.select({ count: sql<number>`count(*)` }).from(studentsTable).where(eq(studentsTable.schoolId, DEMO_SCHOOL_ID));
      const [created] = await tx.insert(studentsTable).values({ schoolId: DEMO_SCHOOL_ID, admissionNo: `ADM-${new Date().getFullYear()}-${String(Number(count[0].count) + 1).padStart(4, "0")}`, name: inquiry.studentName, classId: inquiry.classId, sectionId: section.id, guardian: inquiry.fatherFullName, phone: inquiry.fatherPhone ?? "", fatherCnic: inquiry.fatherCnic, fatherDesignation: inquiry.fatherDesignation, motherFullName: inquiry.motherFullName, motherCnic: inquiry.motherCnic, motherDesignation: inquiry.motherDesignation, motherPhone: inquiry.motherPhone, sessionId: inquiry.sessionId, status: "Active", joined: today() }).returning();
      await tx.update(invoicesTable).set({ studentId: created.id, status: "Paid" }).where(eq(invoicesTable.inquiryId, id));
      await tx.update(admissionInquiriesTable).set({ status: "Enrolled", enrolledStudentId: created.id }).where(eq(admissionInquiriesTable.id, id));
      return created;
    });
    return res.status(201).json({ id: student.id, admissionNo: student.admissionNo, studentName: student.name, status: "Enrolled" });
  } catch (error) { return next(error); }
});

async function getStudentRows(search = "", status = "") {
  const filters = [eq(studentsTable.schoolId, DEMO_SCHOOL_ID)];
  if (search) filters.push(ilike(studentsTable.name, `%${search}%`));
  if (status) filters.push(eq(studentsTable.status, status));
  const rows = await db.select({
    id: studentsTable.id, admissionNo: studentsTable.admissionNo, name: studentsTable.name,
    classId: studentsTable.classId, sectionId: studentsTable.sectionId,
    className: classesTable.name, section: sectionsTable.name, guardian: studentsTable.guardian,
    phone: studentsTable.phone, fatherCnic: studentsTable.fatherCnic, fatherDesignation: studentsTable.fatherDesignation,
    motherFullName: studentsTable.motherFullName, motherCnic: studentsTable.motherCnic,
    motherDesignation: studentsTable.motherDesignation, motherPhone: studentsTable.motherPhone,
    sessionId: studentsTable.sessionId, status: studentsTable.status, joined: studentsTable.joined,
  }).from(studentsTable)
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .innerJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .where(and(...filters)).orderBy(desc(studentsTable.id));
  return rows.map((row) => ({ ...row, joined: displayDate(row.joined) }));
}

router.get("/dashboard/summary", async (_req, res, next) => {
  try {
    const [[studentsRow], [employeesRow], [receivables], [collected], trend] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(studentsTable).where(eq(studentsTable.schoolId, DEMO_SCHOOL_ID)),
      db.select({ count: sql<number>`count(*)` }).from(employeesTable).where(eq(employeesTable.schoolId, DEMO_SCHOOL_ID)),
      db.select({ total: sql<string>`coalesce(sum(${invoicesTable.amount}) filter (where ${invoicesTable.status} <> 'Paid'), 0)` }).from(invoicesTable).where(eq(invoicesTable.schoolId, DEMO_SCHOOL_ID)),
      db.select({ total: sql<string>`coalesce(sum(${paymentsTable.amount}) filter (where date_trunc('month', ${paymentsTable.paidAt}) = date_trunc('month', now())), 0)` }).from(paymentsTable).where(eq(paymentsTable.schoolId, DEMO_SCHOOL_ID)),
      db.select({ label: sql<string>`to_char(${studentsTable.joined}, 'Mon')`, value: sql<number>`count(*)` })
        .from(studentsTable).where(eq(studentsTable.schoolId, DEMO_SCHOOL_ID)).groupBy(sql`to_char(${studentsTable.joined}, 'Mon')`).orderBy(asc(sql`min(${studentsTable.joined})`)),
    ]);
    res.json({
      students: Number(studentsRow?.count ?? 0), employees: Number(employeesRow?.count ?? 0), outstanding: money(receivables?.total),
      collectedThisMonth: money(collected?.total), attendanceRate: 94.2,
      enrollmentTrend: trend.length ? trend.map((item) => ({ label: item.label, value: Number(item.value) })) : [{ label: "Aug", value: 0 }],
    });
  } catch (error) { return next(error); }
});

router.get("/activity", async (_req, res, next) => {
  try {
    const rows = await db.select().from(activityTable).where(eq(activityTable.schoolId, DEMO_SCHOOL_ID)).orderBy(desc(activityTable.activityTime)).limit(10);
    res.json(rows.map((row) => ({ id: row.id, title: row.title, description: row.description, time: row.activityTime.toISOString(), type: row.type })));
  } catch (error) { next(error); }
});

router.get("/students", async (req, res, next) => {
  try { res.json(await getStudentRows(String(req.query.search ?? ""), String(req.query.status ?? ""))); } catch (error) { next(error); }
});

router.post("/students", async (req, res, next) => {
  try {
    if (!validCnic(req.body.fatherCnic) || !validCnic(req.body.motherCnic)) return res.status(400).json({ error: "CNIC must use the format 12345-1234567-1" });
    if (req.body.fatherCnic && req.body.motherCnic && req.body.fatherCnic === req.body.motherCnic) return res.status(409).json({ error: "Father and mother CNICs must be different" });
    for (const cnic of [req.body.fatherCnic, req.body.motherCnic].filter(Boolean).map(String)) {
      if (await cnicInUse(cnic)) return res.status(409).json({ error: "That CNIC is already linked to another record" });
    }
    const className = String(req.body.className ?? "").trim();
    const sectionName = String(req.body.section ?? "").trim();
    const classFilters = [eq(classesTable.schoolId, DEMO_SCHOOL_ID)];
    if (className) classFilters.push(eq(classesTable.name, className));
    const [classRow] = await db.select().from(classesTable).where(and(...classFilters)).orderBy(asc(classesTable.id)).limit(1);
    const sectionFilters = classRow ? [eq(sectionsTable.classId, classRow.id)] : [];
    if (sectionName && classRow) sectionFilters.push(eq(sectionsTable.name, sectionName));
    const [sectionRow] = classRow ? await db.select().from(sectionsTable).where(and(...sectionFilters)).orderBy(asc(sectionsTable.id)).limit(1) : [];
    if (!classRow || !sectionRow) return res.status(400).json({ error: "Create a class and section before adding students" });
    const next = await db.select({ count: sql<number>`count(*)` }).from(studentsTable).where(eq(studentsTable.schoolId, DEMO_SCHOOL_ID));
    const [student] = await db.insert(studentsTable).values({
      schoolId: DEMO_SCHOOL_ID, admissionNo: `ADM-2025-${String(Number(next[0].count) + 1).padStart(4, "0")}`,
      name: String(req.body.name ?? "Unnamed student"), classId, sectionId,
      guardian: String(req.body.guardian ?? ""), phone: String(req.body.phone ?? ""), status: "Active",
      fatherCnic: req.body.fatherCnic || null, fatherDesignation: req.body.fatherDesignation || null,
      motherFullName: req.body.motherFullName || null, motherCnic: req.body.motherCnic || null,
      motherDesignation: req.body.motherDesignation || null, motherPhone: req.body.motherPhone || null,
      sessionId: req.body.sessionId ? Number(req.body.sessionId) : null,
      joined: new Date().toISOString().slice(0, 10),
    }).returning();
    return res.status(201).json((await getStudentRows()).find((row) => row.id === student.id));
  } catch (error) { return next(error); }
});

router.get("/students/:studentId", async (req, res, next) => {
  try {
    const row = (await getStudentRows()).find((student) => student.id === Number(req.params.studentId));
    if (!row) return res.status(404).json({ error: "Student not found" });
    return res.json(row);
  } catch (error) { return next(error); }
});

router.patch("/students/:studentId", async (req, res, next) => {
  try {
    const id = Number(req.params.studentId);
    if (!validCnic(req.body.fatherCnic) || !validCnic(req.body.motherCnic)) return res.status(400).json({ error: "CNIC must use the format 12345-1234567-1" });
    for (const cnic of [req.body.fatherCnic, req.body.motherCnic].filter(Boolean).map(String)) {
      if (await cnicInUse(cnic, undefined, id)) return res.status(409).json({ error: "That CNIC is already linked to another record" });
    }
    const [student] = await db.update(studentsTable).set({
      name: req.body.name, guardian: req.body.guardian, phone: req.body.phone, status: req.body.status,
      classId: req.body.classId ? Number(req.body.classId) : undefined,
      sectionId: req.body.sectionId ? Number(req.body.sectionId) : undefined,
      fatherCnic: req.body.fatherCnic, fatherDesignation: req.body.fatherDesignation,
      motherFullName: req.body.motherFullName, motherCnic: req.body.motherCnic,
      motherDesignation: req.body.motherDesignation, motherPhone: req.body.motherPhone,
    }).where(and(eq(studentsTable.id, id), eq(studentsTable.schoolId, DEMO_SCHOOL_ID))).returning();
    if (!student) return res.status(404).json({ error: "Student not found" });
    return res.json((await getStudentRows()).find((row) => row.id === id));
  } catch (error) { return next(error); }
});

router.delete("/students/:studentId", async (req, res, next) => {
  try {
    const id = Number(req.params.studentId);
    const [student] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.status === "Active") return res.status(400).json({ error: "Set the student to inactive before deleting" });
    const [invoice] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.studentId, id)).limit(1);
    if (invoice) return res.status(409).json({ error: "Cannot delete student with existing invoices" });
    await db.delete(studentsTable).where(eq(studentsTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

router.get("/employees", async (_req, res, next) => {
  try {
    const rows = await db.select({
      id: employeesTable.id, name: employeesTable.name, designation: designationsTable.name,
      department: employeesTable.department, phone: employeesTable.phone, attendance: employeesTable.attendance,
      status: employeesTable.status,
    }).from(employeesTable).innerJoin(designationsTable, eq(employeesTable.designationId, designationsTable.id))
      .where(eq(employeesTable.schoolId, DEMO_SCHOOL_ID)).orderBy(desc(employeesTable.id));
    res.json(rows.map((row) => ({ ...row, attendance: money(row.attendance) })));
  } catch (error) { next(error); }
});

router.post("/employees", async (req, res, next) => {
  try {
    const [designation] = await db.select().from(designationsTable).where(eq(designationsTable.schoolId, DEMO_SCHOOL_ID)).orderBy(asc(designationsTable.id)).limit(1);
    if (!designation) return res.status(400).json({ error: "Create a designation before adding employees" });
    const [employee] = await db.insert(employeesTable).values({
      schoolId: DEMO_SCHOOL_ID, name: String(req.body.name ?? "Unnamed employee"), designationId: designation.id,
      department: String(req.body.department ?? "General"), phone: String(req.body.phone ?? ""),
      attendance: "100", status: "Present",
    }).returning();
    return res.status(201).json({ id: employee.id, name: employee.name, designation: designation.name, department: employee.department, phone: employee.phone, attendance: 100, status: employee.status });
  } catch (error) { return next(error); }
});

router.delete("/employees/:employeeId", async (req, res, next) => {
  try {
    const id = Number(req.params.employeeId);
    const [employee] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, id), eq(employeesTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (employee.status === "Present") return res.status(400).json({ error: "Set the employee to absent before deleting" });
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

router.get("/invoices", async (req, res, next) => {
  try {
    const filters = [eq(invoicesTable.schoolId, DEMO_SCHOOL_ID)];
    if (req.query.status) filters.push(eq(invoicesTable.status, String(req.query.status)));
    const rows = await db.select({
      id: invoicesTable.id, invoiceNo: invoicesTable.invoiceNo, student: studentsTable.name,
      inquiryStudent: admissionInquiriesTable.studentName,
      category: invoicesTable.category, amount: invoicesTable.amount, dueDate: invoicesTable.dueDate, status: invoicesTable.status,
    }).from(invoicesTable)
      .leftJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id))
      .leftJoin(admissionInquiriesTable, eq(invoicesTable.inquiryId, admissionInquiriesTable.id))
      .where(and(...filters)).orderBy(desc(invoicesTable.id));
    res.json(rows.map((row) => ({
      id: row.id, invoiceNo: row.invoiceNo, student: row.student ?? row.inquiryStudent ?? "Admission inquiry",
      category: row.category, amount: money(row.amount), dueDate: displayDate(row.dueDate), status: row.status,
    })));
  } catch (error) { next(error); }
});

router.post("/payments", async (req, res, next) => {
  try {
    const invoiceId = Number(req.body.invoiceId);
    const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.schoolId, DEMO_SCHOOL_ID)));
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const [paidRow] = await db.select({ total: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)` }).from(paymentsTable).where(eq(paymentsTable.invoiceId, invoiceId));
    const amount = Number(req.body.amount ?? invoice.amount);
    const outstanding = Number(invoice.amount) - money(paidRow?.total);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Payment amount must be greater than zero" });
    if (amount > outstanding) return res.status(400).json({ error: `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}` });
    const paidAt = req.body.paidAt ? new Date(`${String(req.body.paidAt)}T00:00:00Z`) : new Date();
    if (Number.isNaN(paidAt.getTime())) return res.status(400).json({ error: "Payment date is invalid" });
    const [payment] = await db.insert(paymentsTable).values({
      schoolId: DEMO_SCHOOL_ID, invoiceId, amount: amount.toFixed(2), method: String(req.body.method ?? "Cash"), paidAt,
    }).returning();
    await db.update(invoicesTable).set({ status: amount === outstanding ? "Paid" : "Pending" }).where(eq(invoicesTable.id, invoiceId));
    return res.status(201).json({ id: payment.id, invoiceId, amount, method: payment.method, paidAt: payment.paidAt.toISOString() });
  } catch (error) { return next(error); }
});

router.post("/journal-entries", async (req, res, next) => {
  try {
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    const totalDebit = lines.reduce((sum: number, line: { debit?: number }) => sum + Number(line.debit ?? 0), 0);
    const totalCredit = lines.reduce((sum: number, line: { credit?: number }) => sum + Number(line.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) return res.status(400).json({ error: "Journal entry must be balanced" });
    const accounts = await db.select().from(accountsTable).where(eq(accountsTable.schoolId, DEMO_SCHOOL_ID));
    if (accounts.length < lines.length) return res.status(400).json({ error: "Not enough accounts configured" });
    const [entry] = await db.insert(journalEntriesTable).values({
      schoolId: DEMO_SCHOOL_ID, entryDate: String(req.body.date ?? new Date().toISOString().slice(0, 10)),
      description: String(req.body.description ?? ""),
    }).returning();
    await db.insert(journalLinesTable).values(lines.map((line: { debit?: number; credit?: number }, index: number) => ({
      journalEntryId: entry.id, accountId: accounts[index].id, debit: Number(line.debit ?? 0).toFixed(2), credit: Number(line.credit ?? 0).toFixed(2),
    })));
    return res.status(201).json({ id: entry.id, date: entry.entryDate, description: entry.description, totalDebit, totalCredit });
  } catch (error) { return next(error); }
});


// --- Module toggles ---
router.get("/setup/modules", async (_req, res, next) => {
  try {
    const rows = await db.select().from(moduleTogglesTable).where(eq(moduleTogglesTable.schoolId, DEMO_SCHOOL_ID));
    const toggles: Record<string, boolean> = { admissions: true, people: true, finance: true, attendance: true };
    rows.forEach((row) => { toggles[row.moduleKey] = row.enabled; });
    return res.json(toggles);
  } catch (error) { return next(error); }
});

router.put("/setup/modules", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    await db.transaction(async (tx) => {
      for (const [key, enabled] of Object.entries(body)) {
        const [existing] = await tx.select().from(moduleTogglesTable).where(and(eq(moduleTogglesTable.schoolId, DEMO_SCHOOL_ID), eq(moduleTogglesTable.moduleKey, key))).limit(1);
        if (existing) {
          await tx.update(moduleTogglesTable).set({ enabled: Boolean(enabled) }).where(eq(moduleTogglesTable.id, existing.id));
        } else {
          await tx.insert(moduleTogglesTable).values({ schoolId: DEMO_SCHOOL_ID, moduleKey: key, enabled: Boolean(enabled) });
        }
      }
    });
    return res.json(body);
  } catch (error) { return next(error); }
});

// --- Designations CRUD ---
router.get("/setup/designations", async (_req, res, next) => {
  try {
    const rows = await db.select().from(designationsTable).where(eq(designationsTable.schoolId, DEMO_SCHOOL_ID)).orderBy(asc(designationsTable.id));
    res.json(rows.map((row) => ({ id: row.id, name: row.name, isSystem: row.isSystem })));
  } catch (error) { next(error); }
});

router.post("/setup/designations", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Designation name is required" });
    const [duplicate] = await db.select({ id: designationsTable.id }).from(designationsTable).where(and(eq(designationsTable.schoolId, DEMO_SCHOOL_ID), eq(designationsTable.name, name))).limit(1);
    if (duplicate) return res.status(409).json({ error: "That designation already exists" });
    const [created] = await db.insert(designationsTable).values({ schoolId: DEMO_SCHOOL_ID, name, isSystem: false }).returning();
    return res.status(201).json({ id: created.id, name: created.name, isSystem: created.isSystem });
  } catch (error) { return next(error); }
});

router.patch("/setup/designations/:designationId", async (req, res, next) => {
  try {
    const id = Number(req.params.designationId);
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Designation name is required" });
    const [duplicate] = await db.select({ id: designationsTable.id }).from(designationsTable).where(and(eq(designationsTable.schoolId, DEMO_SCHOOL_ID), eq(designationsTable.name, name), sql`${designationsTable.id} <> ${id}`)).limit(1);
    if (duplicate) return res.status(409).json({ error: "That designation already exists" });
    const [updated] = await db.update(designationsTable).set({ name }).where(and(eq(designationsTable.id, id), eq(designationsTable.schoolId, DEMO_SCHOOL_ID))).returning();
    if (!updated) return res.status(404).json({ error: "Designation not found" });
    return res.json({ id: updated.id, name: updated.name, isSystem: updated.isSystem });
  } catch (error) { return next(error); }
});

router.delete("/setup/designations/:designationId", async (req, res, next) => {
  try {
    const id = Number(req.params.designationId);
    const [designation] = await db.select().from(designationsTable).where(and(eq(designationsTable.id, id), eq(designationsTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!designation) return res.status(404).json({ error: "Designation not found" });
    if (designation.isSystem) return res.status(400).json({ error: "System designations cannot be deleted" });
    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.designationId, id)).limit(1);
    if (employee) return res.status(409).json({ error: "Cannot delete designation that is assigned to employees" });
    await db.delete(designationsTable).where(eq(designationsTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

// --- Fee head update/delete ---
router.patch("/setup/fee-heads/:feeHeadId", async (req, res, next) => {
  try {
    const id = Number(req.params.feeHeadId);
    const name = String(req.body.name ?? "").trim();
    const amount = Number(req.body.amount ?? 0);
    if (!name || !Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Fee head name and a non-negative amount are required" });
    const [duplicate] = await db.select({ id: feeHeadsTable.id }).from(feeHeadsTable).where(and(eq(feeHeadsTable.schoolId, DEMO_SCHOOL_ID), eq(feeHeadsTable.name, name), sql`${feeHeadsTable.id} <> ${id}`)).limit(1);
    if (duplicate) return res.status(409).json({ error: "That fee head already exists" });
    const [updated] = await db.update(feeHeadsTable).set({ name, amount: amount.toFixed(2) }).where(and(eq(feeHeadsTable.id, id), eq(feeHeadsTable.schoolId, DEMO_SCHOOL_ID))).returning();
    if (!updated) return res.status(404).json({ error: "Fee head not found" });
    return res.json({ id: updated.id, name: updated.name, amount, isActive: updated.isActive });
  } catch (error) { return next(error); }
});

router.delete("/setup/fee-heads/:feeHeadId", async (req, res, next) => {
  try {
    const id = Number(req.params.feeHeadId);
    const [feeHead] = await db.select().from(feeHeadsTable).where(and(eq(feeHeadsTable.id, id), eq(feeHeadsTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!feeHead) return res.status(404).json({ error: "Fee head not found" });
    const [inUse] = await db.select({ id: inquiryFeeItemsTable.id }).from(inquiryFeeItemsTable).where(eq(inquiryFeeItemsTable.feeHeadId, id)).limit(1);
    if (inUse) {
      await db.update(feeHeadsTable).set({ isActive: false }).where(eq(feeHeadsTable.id, id));
      return res.json({ id, name: feeHead.name, amount: Number(feeHead.amount), isActive: false });
    }
    await db.delete(feeHeadsTable).where(eq(feeHeadsTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

// --- Session delete ---
router.delete("/setup/sessions/:sessionId", async (req, res, next) => {
  try {
    const id = Number(req.params.sessionId);
    const [session] = await db.select().from(academicSessionsTable).where(and(eq(academicSessionsTable.id, id), eq(academicSessionsTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.isActive) return res.status(400).json({ error: "Cannot delete the active session" });
    const [inUse] = await db.select({ id: admissionInquiriesTable.id }).from(admissionInquiriesTable).where(eq(admissionInquiriesTable.sessionId, id)).limit(1);
    if (inUse) return res.status(409).json({ error: "Cannot delete session that has inquiries" });
    await db.delete(feeStructureItemsTable).where(eq(feeStructureItemsTable.sessionId, id));
    await db.delete(academicSessionsTable).where(eq(academicSessionsTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

// --- Class delete ---
router.delete("/setup/classes/:classId", async (req, res, next) => {
  try {
    const id = Number(req.params.classId);
    const [cls] = await db.select().from(classesTable).where(and(eq(classesTable.id, id), eq(classesTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!cls) return res.status(404).json({ error: "Class not found" });
    const [inUse] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.classId, id)).limit(1);
    if (inUse) return res.status(409).json({ error: "Cannot delete class that has students" });
    const [inq] = await db.select({ id: admissionInquiriesTable.id }).from(admissionInquiriesTable).where(eq(admissionInquiriesTable.classId, id)).limit(1);
    if (inq) return res.status(409).json({ error: "Cannot delete class that has inquiries" });
    await db.delete(feeStructureItemsTable).where(eq(feeStructureItemsTable.classId, id));
    await db.delete(sectionsTable).where(eq(sectionsTable.classId, id));
    await db.delete(classesTable).where(eq(classesTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

// --- Activity log helper (used by other endpoints) ---
async function logActivity(title: string, description: string, type: string) {
  try {
    await db.insert(activityTable).values({ schoolId: DEMO_SCHOOL_ID, title, description, type });
  } catch { /* ignore activity logging errors */ }
}

// --- Grades (classes) with Sections ---
router.get("/setup/grades", async (_req, res, next) => {
  try {
    const grades = await db.select().from(classesTable).where(eq(classesTable.schoolId, DEMO_SCHOOL_ID)).orderBy(asc(classesTable.id));
    const sections = await db.select().from(sectionsTable).innerJoin(classesTable, eq(sectionsTable.classId, classesTable.id)).where(eq(classesTable.schoolId, DEMO_SCHOOL_ID)).orderBy(asc(sectionsTable.id));
    const gradeMap = grades.map((g) => ({ id: g.id, name: g.name, sections: sections.filter((s) => s.school_classes.id === g.id).map((s) => ({ id: s.school_sections.id, name: s.school_sections.name })) }));
    return res.json(gradeMap);
  } catch (error) { return next(error); }
});

router.post("/setup/grades", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Grade name is required" });
    const [grade] = await db.insert(classesTable).values({ schoolId: DEMO_SCHOOL_ID, name }).returning();
    return res.status(201).json({ id: grade.id, name: grade.name, sections: [] });
  } catch (error) { return next(error); }
});

router.patch("/setup/grades/:gradeId", async (req, res, next) => {
  try {
    const id = Number(req.params.gradeId);
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Grade name is required" });
    const [updated] = await db.update(classesTable).set({ name }).where(and(eq(classesTable.id, id), eq(classesTable.schoolId, DEMO_SCHOOL_ID))).returning();
    if (!updated) return res.status(404).json({ error: "Grade not found" });
    return res.json({ id: updated.id, name: updated.name });
  } catch (error) { return next(error); }
});

router.delete("/setup/grades/:gradeId", async (req, res, next) => {
  try {
    const id = Number(req.params.gradeId);
    const [grade] = await db.select().from(classesTable).where(and(eq(classesTable.id, id), eq(classesTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.classId, id)).limit(1);
    if (student) return res.status(409).json({ error: "Cannot delete grade with enrolled students" });
    await db.delete(sectionsTable).where(eq(sectionsTable.classId, id));
    await db.delete(classesTable).where(eq(classesTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

router.post("/setup/grades/:gradeId/sections", async (req, res, next) => {
  try {
    const gradeId = Number(req.params.gradeId);
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Section name is required" });
    const [grade] = await db.select().from(classesTable).where(and(eq(classesTable.id, gradeId), eq(classesTable.schoolId, DEMO_SCHOOL_ID))).limit(1);
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    const [section] = await db.insert(sectionsTable).values({ classId: gradeId, name }).returning();
    return res.status(201).json({ id: section.id, name: section.name });
  } catch (error) { return next(error); }
});

router.patch("/setup/sections/:sectionId", async (req, res, next) => {
  try {
    const id = Number(req.params.sectionId);
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Section name is required" });
    const [updated] = await db.update(sectionsTable).set({ name }).where(eq(sectionsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Section not found" });
    return res.json({ id: updated.id, name: updated.name });
  } catch (error) { return next(error); }
});

router.delete("/setup/sections/:sectionId", async (req, res, next) => {
  try {
    const id = Number(req.params.sectionId);
    const [section] = await db.select().from(sectionsTable).where(eq(sectionsTable.id, id)).limit(1);
    if (!section) return res.status(404).json({ error: "Section not found" });
    const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.sectionId, id)).limit(1);
    if (student) return res.status(409).json({ error: "Cannot delete section with enrolled students" });
    await db.delete(sectionsTable).where(eq(sectionsTable.id, id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});export default router;