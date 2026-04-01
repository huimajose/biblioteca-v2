import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function readUsers() {
  return db.select().from(schema.users).all();
}

export async function updateUserRole(userId: string, newRole: string) {
  db.update(schema.users)
    .set({ role: newRole })
    .where(eq(schema.users.clerkId, userId))
    .run();
}

export async function verifyAdmin(userId: string) {
  const admin = db.select().from(schema.admin).where(eq(schema.admin.clerkId, userId)).get();
  if (admin) return true;
  const user = db.select().from(schema.users).where(eq(schema.users.clerkId, userId)).get();
  return user?.role === 'admin';
}

export async function getUserCount() {
  const students = db.select().from(schema.users).where(eq(schema.users.role, 'student')).all();
  return students.length;
}

export async function getCountAllUsers() {
  const all = db.select({ id: schema.users.clerkId }).from(schema.users).all();
  return all.length;
}
