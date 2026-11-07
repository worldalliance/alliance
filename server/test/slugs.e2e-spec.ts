import request from "supertest";
import type { Repository } from "typeorm";
import { Action } from "../src/actions/entities/action.entity";
import { Project } from "../src/actions/entities/project.entity";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("Action and project slugs (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let projectRepo: Repository<Project>;

  const server = () => ctx.app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    projectRepo = ctx.dataSource.getRepository(Project);
  });

  afterEach(async () => {
    await actionRepo.query(`UPDATE action SET "projectId" = NULL`);
    await projectRepo.query("DELETE FROM project");
    await actionRepo.query(`DELETE FROM action WHERE name LIKE 'Slug %'`);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("actions", () => {
    it("generates a slug from the name, suffixing a taken one", async () => {
      const first = await createActionAsAdmin(ctx, {
        name: "Slug Café run",
      }).expect(201);
      expect(first.body.slug).toBe("slug-cafe-run");

      const second = await createActionAsAdmin(ctx, {
        name: "Slug Café run",
      }).expect(201);
      expect(second.body.slug).toBe("slug-cafe-run-2");
    });

    it("gives concurrent same-named actions distinct slugs", async () => {
      const created = await Promise.all(
        [0, 1, 2].map(() =>
          createActionAsAdmin(ctx, { name: "Slug race" }).expect(201),
        ),
      );
      expect(created.map((res) => res.body.slug).sort()).toEqual([
        "slug-race",
        "slug-race-2",
        "slug-race-3",
      ]);
    });

    it("falls back to action-<id> when the name has nothing to keep", async () => {
      const emoji = await actionRepo.save({
        name: "🎉🎉",
        category: [],
        body: "Body",
      });
      expect(emoji.slug).toBe(`action-${emoji.id}`);
      await actionRepo.delete(emoji.id);
    });

    it("takes an explicit slug, refusing a taken or malformed one", async () => {
      await createActionAsAdmin(ctx, {
        name: "Slug one",
        slug: "slug-custom",
      }).expect(201);
      await createActionAsAdmin(ctx, {
        name: "Slug two",
        slug: "slug-custom",
      }).expect(409);
      await createActionAsAdmin(ctx, {
        name: "Slug three",
        slug: "Not A Slug",
      }).expect(400);
      await createActionAsAdmin(ctx, {
        name: "Slug four",
        slug: "a".repeat(81),
      }).expect(400);
    });

    it("keeps the slug on rename and changes it on request", async () => {
      const { body: created } = await createActionAsAdmin(ctx, {
        name: "Slug original",
      }).expect(201);
      await createActionAsAdmin(ctx, { name: "Slug other" }).expect(201);

      await patchActionAsAdmin(ctx, created.id, {
        name: "Slug renamed",
      }).expect(200);
      expect((await getActionAsAdmin(ctx, created.id)).body.slug).toBe(
        "slug-original",
      );

      await patchActionAsAdmin(ctx, created.id, {
        slug: "slug-other",
      }).expect(409);
      await patchActionAsAdmin(ctx, created.id, { slug: null }).expect(400);
      const updated = await patchActionAsAdmin(ctx, created.id, {
        slug: "slug-edited",
      }).expect(200);
      expect(updated.body.slug).toBe("slug-edited");
    });

    it("looks an action up by slug for admins only", async () => {
      const { body: created } = await createActionAsAdmin(ctx, {
        name: "Slug lookup",
      }).expect(201);

      const found = await asAdmin(
        request(server()).get("/actions/admin/by-slug/slug-lookup"),
      ).expect(200);
      expect(found.body.id).toBe(created.id);

      await asAdmin(
        request(server()).get("/actions/admin/by-slug/slug-missing"),
      ).expect(404);
      await request(server())
        .get("/actions/admin/by-slug/slug-lookup")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it("leaves the slug off the member-facing action", async () => {
      const { body: created } = await createActionAsAdmin(ctx, {
        name: "Slug hidden",
      }).expect(201);
      const member = await asAdmin(
        request(server()).get(`/actions/slug/${created.id}`),
      ).expect(200);
      expect(member.body).not.toHaveProperty("slug");
    });

    it("frees a soft-deleted action's slug", async () => {
      const { body: created } = await createActionAsAdmin(ctx, {
        name: "Slug deleted",
      }).expect(201);
      await asAdmin(request(server()).delete(`/actions/${created.id}`)).expect(
        200,
      );

      await asAdmin(
        request(server()).get("/actions/admin/by-slug/slug-deleted"),
      ).expect(404);
      const again = await createActionAsAdmin(ctx, {
        name: "Slug deleted",
      }).expect(201);
      expect(again.body.slug).toBe("slug-deleted");
    });

    it("regenerates the slug of a pasted action", async () => {
      const { body: original } = await createActionAsAdmin(ctx, {
        name: "Slug pasted",
        slug: "slug-hand-picked",
      }).expect(201);
      const exported = await asAdmin(
        request(server()).get(`/actions/export/${original.id}`),
      ).expect(200);

      const pasted = await asAdmin(request(server()).post("/actions/pasteJson"))
        .send({ body: JSON.stringify(exported.body) })
        .expect(201);
      expect(pasted.body.slug).toBe("slug-pasted");
    });
  });

  describe("projects", () => {
    it("generates, suffixes and falls back", async () => {
      await asAdmin(request(server()).post("/projects"))
        .send({ name: "Elsewhere", slug: "water" })
        .expect(201);
      const water = await asAdmin(request(server()).post("/projects"))
        .send({ name: "Water" })
        .expect(201);
      expect(water.body.slug).toBe("water-2");

      const emoji = await asAdmin(request(server()).post("/projects"))
        .send({ name: "🌊" })
        .expect(201);
      expect(emoji.body.slug).toBe(`project-${emoji.body.id}`);
    });

    it("refuses a taken slug with 409 and a malformed one with 400", async () => {
      const a = await projectRepo.save({ name: "A" });
      await projectRepo.save({ name: "B" });

      const conflict = await asAdmin(request(server()).post("/projects"))
        .send({ name: "C", slug: "a" })
        .expect(409);
      expect(conflict.body.message).toBe('The slug "a" is already taken');
      await asAdmin(request(server()).patch(`/projects/${a.id}`))
        .send({ slug: "b" })
        .expect(409);
      await asAdmin(request(server()).patch(`/projects/${a.id}`))
        .send({ slug: "-a" })
        .expect(400);

      const renamed = await asAdmin(
        request(server()).patch(`/projects/${a.id}`),
      )
        .send({ name: "A2" })
        .expect(200);
      expect(renamed.body.slug).toBe("a");
    });

    it("looks a project up by slug", async () => {
      const project = await projectRepo.save({ name: "Found" });
      const found = await asAdmin(
        request(server()).get("/projects/by-slug/found"),
      ).expect(200);
      expect(found.body).toEqual({
        id: project.id,
        name: "Found",
        slug: "found",
        category: [],
      });

      await asAdmin(request(server()).delete(`/projects/${project.id}`)).expect(
        200,
      );
      await asAdmin(request(server()).get("/projects/by-slug/found")).expect(
        404,
      );
    });
  });
});
