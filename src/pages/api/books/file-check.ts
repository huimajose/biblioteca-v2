import type { NextApiRequest, NextApiResponse } from "next";

type ResponseBody = { ok: boolean; status?: number; error?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Metodo nao permitido" });
  }

  const url = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!url) {
    return res.status(400).json({ ok: false, error: "URL obrigatoria" });
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    return res.status(200).json({ ok: response.ok, status: response.status });
  } catch (error: any) {
    return res
      .status(200)
      .json({ ok: false, error: error?.message || "Falha ao validar" });
  }
}
