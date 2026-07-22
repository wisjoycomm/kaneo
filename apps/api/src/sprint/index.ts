import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  assignTasksToSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  listSprints,
  startSprint,
  updateSprint,
} from "./controllers/sprint-crud";

const sprintBodySchema = v.object({
  name: v.string(),
  goal: v.optional(v.string()),
  duration: v.optional(v.string()),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
});

const sprint = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "listSprints",
      tags: ["Sprints"],
      description: "List sprints for a project (soft-deleted excluded)",
      responses: {
        200: {
          description: "Sprints",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await listSprints(projectId));
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createSprint",
      tags: ["Sprints"],
      description: "Create a sprint in a project",
      responses: {
        200: {
          description: "Sprint created",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator("json", sprintBodySchema),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const body = c.req.valid("json");
      const created = await createSprint({
        projectId,
        name: body.name,
        goal: body.goal,
        duration: body.duration,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      });
      return c.json(created);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateSprint",
      tags: ["Sprints"],
      description: "Update sprint fields",
      responses: {
        200: {
          description: "Sprint updated",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.partial(sprintBodySchema)),
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const updated = await updateSprint(id, {
        name: body.name,
        goal: body.goal,
        duration: body.duration,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      });
      return c.json(updated);
    },
  )
  .put(
    "/:id/start",
    describeRoute({
      operationId: "startSprint",
      tags: ["Sprints"],
      description: "Start a planned sprint (one active sprint per project)",
      responses: {
        200: {
          description: "Sprint started",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await startSprint(id));
    },
  )
  .put(
    "/:id/complete",
    describeRoute({
      operationId: "completeSprint",
      tags: ["Sprints"],
      description:
        "Complete an active sprint; unfinished tasks are released from the sprint",
      responses: {
        200: {
          description: "Sprint completed",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await completeSprint(id));
    },
  )
  .put(
    "/:id/tasks",
    describeRoute({
      operationId: "assignSprintTasks",
      tags: ["Sprints"],
      description: "Add/remove tasks to/from a sprint",
      responses: {
        200: {
          description: "Tasks now in the sprint",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        add: v.optional(v.array(v.string()), []),
        remove: v.optional(v.array(v.string()), []),
      }),
    ),
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { add, remove } = c.req.valid("json");
      return c.json(await assignTasksToSprint(id, add, remove));
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteSprint",
      tags: ["Sprints"],
      description: "Soft-delete a sprint (tasks are released)",
      responses: {
        200: {
          description: "Sprint deleted",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromSprint(),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json(await deleteSprint(id));
    },
  );

export default sprint;
