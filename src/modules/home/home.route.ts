import { Router } from "express";
import { getEnv } from "../../shared/lib/env.ts";
import { sendPage } from "../../shared/utils/html.ts";
import { renderHomePage } from "./home.page.ts";

export const MCP_PATH = "/mcp";

export const homeRouter = Router();

homeRouter.get("/", (_req, res) => {
  sendPage(res, renderHomePage(`${getEnv().BASE_URL}${MCP_PATH}`));
});
