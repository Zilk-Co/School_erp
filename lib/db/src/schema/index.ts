import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schoolsTable = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  academicYear: text("academic_year").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const classesTable = pgTable("school_classes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sectionsTable = pgTable("school_sections", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  name: text("name").notNull(),
});

export const designationsTable = pgTable("designations", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  name: text("name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
});

export const feeHeadsTable = pgTable("fee_heads", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
});

export const moduleTogglesTable = pgTable("module_toggles", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  moduleKey: text("module_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const academicSessionsTable = pgTable("academic_sessions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  isActive: boolean("is_active").notNull().default(false),
});

export const admissionInquiriesTable = pgTable("admission_inquiries", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  inquiryNo: text("inquiry_no").notNull(),
  studentName: text("student_name").notNull(),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  gender: text("gender"),
  previousSchool: text("previous_school"),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  sessionId: integer("session_id").notNull().references(() => academicSessionsTable.id),
  fatherFullName: text("father_full_name").notNull(),
  fatherCnic: text("father_cnic"),
  fatherDesignation: text("father_designation"),
  fatherPhone: text("father_phone"),
  motherFullName: text("mother_full_name"),
  motherCnic: text("mother_cnic"),
  motherDesignation: text("mother_designation"),
  motherPhone: text("mother_phone"),
  address: text("address"),
  notes: text("notes"),
  status: text("status").notNull().default("Inquiry"),
  enrolledStudentId: integer("enrolled_student_id").references(() => studentsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feeStructureItemsTable = pgTable("fee_structure_items", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  sessionId: integer("session_id").notNull().references(() => academicSessionsTable.id),
  feeHeadId: integer("fee_head_id").notNull().references(() => feeHeadsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const inquiryFeeItemsTable = pgTable("inquiry_fee_items", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id").notNull().references(() => admissionInquiriesTable.id),
  feeHeadId: integer("fee_head_id").notNull().references(() => feeHeadsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  admissionNo: text("admission_no").notNull(),
  name: text("name").notNull(),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  sectionId: integer("section_id").notNull().references(() => sectionsTable.id),
  guardian: text("guardian").notNull(),
  phone: text("phone").notNull(),
  fatherCnic: text("father_cnic"),
  fatherDesignation: text("father_designation"),
  motherFullName: text("mother_full_name"),
  motherCnic: text("mother_cnic"),
  motherDesignation: text("mother_designation"),
  motherPhone: text("mother_phone"),
  sessionId: integer("session_id").references(() => academicSessionsTable.id),
  status: text("status").notNull().default("Active"),
  joined: date("joined", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  name: text("name").notNull(),
  designationId: integer("designation_id").notNull().references(() => designationsTable.id),
  department: text("department").notNull(),
  phone: text("phone").notNull(),
  attendance: numeric("attendance", { precision: 5, scale: 2 }).notNull().default("100"),
  status: text("status").notNull().default("Present"),
});

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  studentId: integer("student_id").references(() => studentsTable.id),
  inquiryId: integer("inquiry_id").references(() => admissionInquiriesTable.id),
  feeHeadId: integer("fee_head_id").references(() => feeHeadsTable.id),
  invoiceNo: text("invoice_no").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("Pending"),
});

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id),
  feeHeadId: integer("fee_head_id").notNull().references(() => feeHeadsTable.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  name: text("name").notNull(),
  accountType: text("account_type").notNull(),
});

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalLinesTable = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull().references(() => journalEntriesTable.id),
  accountId: integer("account_id").notNull().references(() => accountsTable.id),
  debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schoolsTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  activityTime: timestamp("activity_time", { withTimezone: true }).notNull().defaultNow(),
  type: text("type").notNull(),
});

export const insertSchoolSchema = createInsertSchema(schoolsTable).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true });
export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, paidAt: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true });
export const insertJournalLineSchema = createInsertSchema(journalLinesTable).omit({ id: true });
export const insertAcademicSessionSchema = createInsertSchema(academicSessionsTable).omit({ id: true });
export const insertInquirySchema = createInsertSchema(admissionInquiriesTable).omit({ id: true, createdAt: true });
export const insertFeeStructureItemSchema = createInsertSchema(feeStructureItemsTable).omit({ id: true });
export type School = typeof schoolsTable.$inferSelect;
export type Student = z.infer<typeof insertStudentSchema>;