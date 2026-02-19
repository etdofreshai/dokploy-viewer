import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { dokploy } from "./dokploy.js";
import { html } from "./ui.js";

const app = new Hono();

const VIEWER_TOKEN = process.env.VIEWER_TOKEN || "";

// Auth middleware for /api routes
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health") return next();
  const auth = c.req.header("Authorization");
  if (!VIEWER_TOKEN) return next(); // no token configured = open
  if (!auth || auth !== `Bearer ${VIEWER_TOKEN}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/*", cors());

// Health
app.get("/api/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// Projects
app.get("/api/projects", async (c) => {
  try {
    const data = await dokploy("project.all", {});
    return c.json(data);
  } catch (e: any) {
    console.error("project.all error:", e.message);
    return c.json({ error: e.message }, 500);
  }
});

// Applications - list all (we get them from projects)
app.get("/api/applications", async (c) => {
  const projects = await dokploy("project.all", {});
  const apps: any[] = [];
  if (Array.isArray(projects)) {
    for (const p of projects) {
      if (p.environments) {
        for (const env of p.environments) {
          if (env.applications) {
            apps.push(...env.applications);
          }
        }
      }
      if (p.applications) {
        apps.push(...p.applications);
      }
    }
  }
  return c.json(apps);
});

// Application detail
app.get("/api/applications/:id", async (c) => {
  const id = c.req.param("id");
  const data = await dokploy("application.one", { applicationId: id });
  return c.json(data);
});

// Deployments
app.get("/api/applications/:id/deployments", async (c) => {
  const id = c.req.param("id");
  const data = await dokploy("deployment.all", { applicationId: id });
  return c.json(data);
});

// Logs (get deployment logs from most recent deployment)
app.get("/api/applications/:id/logs", async (c) => {
  const id = c.req.param("id");
  try {
    // Get deployments, then fetch the log from the latest one
    const deployments = await dokploy("deployment.all", { applicationId: id });
    const list = Array.isArray(deployments) ? deployments : [];
    if (!list.length) return c.json({ logs: "No deployments found" });
    const latest = list[0];
    if (latest.logPath) {
      return c.json({ deploymentId: latest.deploymentId, status: latest.status, logPath: latest.logPath, createdAt: latest.createdAt });
    }
    return c.json({ deploymentId: latest.deploymentId, status: latest.status, description: latest.description || latest.title || "No log content available" });
  } catch (e: any) {
    return c.json({ error: "Could not fetch logs", detail: e.message }, 500);
  }
});

// Environment variables
app.get("/api/applications/:id/env", async (c) => {
  const id = c.req.param("id");
  const data = await dokploy("application.one", { applicationId: id });
  return c.json({ env: data?.env || null });
});

// Web UI
app.get("/", (c) => {
  return c.html(html());
});

const port = parseInt(process.env.PORT || "3000");
console.log(`Dokploy Viewer starting on port ${port}`);
serve({ fetch: app.fetch, port });
