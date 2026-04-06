import { NextRequest } from "next/server";
import { registerSseClient, unregisterSseClient } from "@/app/api/_utils/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

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
      registerSseClient(userId, controller);

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
        unregisterSseClient(userId, controller);
      });
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (!controllerRef) return;
      unregisterSseClient(userId, controllerRef);
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
