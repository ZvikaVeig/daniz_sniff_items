import { NextFunction, Request, Response } from "express";
import { config } from "../../config";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length);
  if (token !== config.apiKey) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  next();
}
