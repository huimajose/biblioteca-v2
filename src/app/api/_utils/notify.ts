import webpush from "web-push";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { canAccessAdminSection } from "@/utils/roles";

type ClientSet = Set<ReadableStreamDefaultController<Uint8Array>>;

const clientsByUser = new Map<string, ClientSet>();
const encoder = new TextEncoder();

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@biblioteca.local";

if (vapidPublic && vapidPrivate) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch {
    // ignore repeated setup
  }
}

export const registerSseClient = (
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) => {
  const current = clientsByUser.get(userId) || new Set();
  current.add(controller);
  clientsByUser.set(userId, current);
};

export const unregisterSseClient = (
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) => {
  const current = clientsByUser.get(userId);
  if (!current) return;
  current.delete(controller);
  if (current.size === 0) clientsByUser.delete(userId);
};

export const pushSseNotification = (
  userId: string,
  payload: { title: string; message: string }
) => {
  const clients = clientsByUser.get(userId);
  if (!clients?.size) return;
  clients.forEach((controller) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
    } catch {
      unregisterSseClient(userId, controller);
    }
  });
};

export async function notifyUser(db: any, userId: string, title: string, message: string) {
  const inserted = await db
    .insert(schema.notifications)
    .values({
      userId,
      title,
      message,
      read: false,
    })
    .returning();

  pushSseNotification(userId, { title, message });

  if (vapidPublic && vapidPrivate) {
    const settings = await db
      .select()
      .from(schema.notificationSettings)
      .where(eq(schema.notificationSettings.userId, userId))
      .limit(1);

    if (settings[0]?.pushEnabled !== false) {
      const subscriptions = await db
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.userId, userId));

      await Promise.allSettled(
        subscriptions.map((sub: any) =>
          webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            } as any,
            JSON.stringify({ title, message })
          )
        )
      );
    }
  }

  return inserted[0];
}

export async function notifyAdmins(db: any, title: string, message: string) {
  const [admins, users] = await Promise.all([
    db.select().from(schema.admin),
    db.select().from(schema.users),
  ]);

  const recipientIds = new Set<string>();

  admins.forEach((admin: any) => {
    if (admin?.clerkId) recipientIds.add(String(admin.clerkId));
  });

  users.forEach((user: any) => {
    if (user?.clerkId && canAccessAdminSection(user?.role, "transactions")) {
      recipientIds.add(String(user.clerkId));
    }
  });

  await Promise.allSettled(
    Array.from(recipientIds).map((userId) => notifyUser(db, userId, title, message))
  );
}
