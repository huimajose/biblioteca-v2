import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientSet = Set<ReadableStreamDefaultController<Uint8Array>>;

const clientsByUser = new Map<string, ClientSet>();
const encoder = new TextEncoder();

const ensureClientSet = (userId: string) => {
  const existing = clientsByUser.get(userId);
  if (existing) return existing;
  const created: ClientSet = new Set();
  clientsByUser.set(userId, created);
  return created;
};

const write = (controller: ReadableStreamDefaultController<Uint8Array>, text: string) => {
  controller.enqueue(encoder.encode(text));
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return new Response("User ID missing", { status: 400 });

  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      const clients = ensureClientSet(userId);
      clients.add(controller);

      write(controller, "event: ready\n");
      write(controller, "data: {}\n\n");

      keepAliveTimer = setInterval(() => {
        try {
          write(controller, ": keep-alive\n\n");
        } catch {
          // Ignore write errors; cleanup happens on abort/cancel.
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        const set = clientsByUser.get(userId);
        if (set) {
          set.delete(controller);
          if (set.size === 0) clientsByUser.delete(userId);
        }
      });
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (!controllerRef) return;
      const set = clientsByUser.get(userId);
      if (set) {
        set.delete(controllerRef);
        if (set.size === 0) clientsByUser.delete(userId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
