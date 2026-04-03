import type { NextApiRequest, NextApiResponse } from "next";

type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ url: string } | ErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const isbn = Array.isArray(req.query.isbn) ? req.query.isbn[0] : req.query.isbn;
  if (!isbn) {
    return res.status(400).json({ error: "ISBN obrigatorio" });
  }

  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  return res.status(200).json({ url });
}
