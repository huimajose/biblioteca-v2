/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from "next";
import { initSocket } from "@/app/realtime/socket";

// Extendendo os tipos para incluir .io
interface SocketServerWithIO extends NextApiResponse {
  socket: any & { server: any & { io?: any } };
}

export default function handler(
  req: NextApiRequest,
  res: SocketServerWithIO
) {
  if (!res.socket.server.io) {
    //console.log("🚀 Criando Socket.IO server...");
    const io = initSocket(res.socket.server); // já passamos server real
    res.socket.server.io = io;
  }
  res.end();
}
