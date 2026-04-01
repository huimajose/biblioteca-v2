import { NextRequest } from "next/server";
import { readNotificationsByUserId, markNotificationsAsReadByUserId } from "@/db/crud/notifications.crud";
type Params = Promise<{ userId: string }>;

export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  const { userId } = await Promise.resolve(params);
  if (!userId) return new Response("User ID missing", { status: 400 });

  try {
    const notifications = await readNotificationsByUserId(userId);
    return new Response(JSON.stringify(notifications), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Error fetching notifications", { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
   const { userId } = await Promise.resolve(params);
  if (!userId) return new Response("User ID missing", { status: 400 });

  try {
    await markNotificationsAsReadByUserId(userId);
    return new Response("Marked as read", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Error marking notifications as read", { status: 500 });
  }
}
