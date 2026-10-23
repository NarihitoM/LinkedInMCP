import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger.ts";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  logger.error("Unhandled request error", { path: req.path, error });
  if (res.headersSent) return;
  res.status(500).json({ error: "internal_error", message: "Something went wrong." });
};
