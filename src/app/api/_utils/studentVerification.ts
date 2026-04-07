import { sql } from "drizzle-orm";

export const ensureStudentVerificationCourseColumn = async (db: { execute: (query: any) => Promise<unknown> }) => {
  await db.execute(sql`
    ALTER TABLE student_verifications
    ADD COLUMN IF NOT EXISTS course varchar(100)
  `);
};
