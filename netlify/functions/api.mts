import type { Config } from "@netlify/functions";
import jwt from "jsonwebtoken";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { members } from "../../db/schema.js";

type MemberRow = typeof members.$inferSelect;

class FamilyNode {
  id: number;
  name: string;
  relation: string;
  isAlive: boolean;
  parent: FamilyNode | null;
  children: FamilyNode[];

  constructor(row: MemberRow) {
    this.id = row.id;
    this.name = row.name;
    this.relation = row.relation;
    this.isAlive = row.isAlive;
    this.parent = null;
    this.children = [];
  }
}

class FamilyTree {
  root: FamilyNode | null = null;
  map = new Map<number, FamilyNode>();

  buildFromRows(rows: MemberRow[]) {
    this.root = null;
    this.map.clear();

    rows.forEach((row) => {
      this.map.set(row.id, new FamilyNode(row));
    });

    rows.forEach((row) => {
      const node = this.map.get(row.id);
      if (!node) return;

      if (row.parentId === null || row.parentId === undefined) {
        this.root = node;
        return;
      }

      const parent = this.map.get(row.parentId);
      if (parent) {
        node.parent = parent;
        parent.children.push(node);
      }
    });

    return this.root;
  }

  findById(id: number, node = this.root): FamilyNode | null {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = this.findById(id, child);
      if (found) return found;
    }
    return null;
  }

  toJSON(node = this.root): unknown {
    if (!node) return null;
    return {
      id: node.id,
      name: node.name,
      relation: node.relation,
      isAlive: node.isAlive,
      parentId: node.parent ? node.parent.id : null,
      children: node.children.map((child) => this.toJSON(child)),
    };
  }

  collectSubtreeIds(node: FamilyNode, ids: number[] = []) {
    ids.push(node.id);
    node.children.forEach((child) => this.collectSubtreeIds(child, ids));
    return ids;
  }
}

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

function getApiPath(req: Request) {
  const url = new URL(req.url);
  return url.pathname.replace(/^\/api\/?/, "");
}

async function getRows() {
  await seedRootMember();
  return db.select().from(members).orderBy(members.id);
}

async function rebuildTree() {
  const rows = await getRows();
  const tree = new FamilyTree();
  tree.buildFromRows(rows);
  return tree;
}

async function seedRootMember() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(members);
  if (Number(count) > 0) return;

  await db.insert(members).values({
    name: "Munshi karam Das Sahab",
    relation: "Patriarch",
    parentId: null,
    isAlive: true,
  });
}

function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "No token provided. Admin login required." }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return json({ error: "Admin authentication is not configured." }, { status: 500 });
  }

  try {
    jwt.verify(authHeader.slice("Bearer ".length), secret);
    return null;
  } catch {
    return json({ error: "Invalid or expired token." }, { status: 401 });
  }
}

export default async (req: Request) => {
  const path = getApiPath(req);

  if (req.method === "GET" && path === "members") {
    const tree = await rebuildTree();
    return json(tree.toJSON());
  }

  if (req.method === "POST" && path === "login") {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminPassword || !jwtSecret) {
      return json({ error: "Admin authentication is not configured." }, { status: 500 });
    }

    if (password !== adminPassword) {
      return json({ error: "Incorrect password." }, { status: 401 });
    }

    const token = jwt.sign({ role: "admin" }, jwtSecret, { expiresIn: "12h" });
    return json({ token });
  }

  if (req.method === "POST" && path === "members") {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const { name, relation, parentId, isAlive } = await req.json();
    if (!name || !relation) {
      return json({ error: "Name and relation are required." }, { status: 400 });
    }

    const normalizedParentId = parentId ? Number(parentId) : null;
    if (normalizedParentId) {
      const [parent] = await db.select({ id: members.id }).from(members).where(eq(members.id, normalizedParentId));
      if (!parent) {
        return json({ error: "Parent member not found." }, { status: 400 });
      }
    }

    const [created] = await db
      .insert(members)
      .values({
        name,
        relation,
        parentId: normalizedParentId,
        isAlive: Boolean(isAlive),
      })
      .returning({ id: members.id });

    const tree = await rebuildTree();
    return json({ id: created.id, tree: tree.toJSON() }, { status: 201 });
  }

  const memberMatch = path.match(/^members\/(\d+)$/);
  if (memberMatch && req.method === "PATCH") {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const id = Number(memberMatch[1]);
    const { isAlive } = await req.json();
    const [member] = await db.select().from(members).where(eq(members.id, id));
    if (!member) {
      return json({ error: "Member not found." }, { status: 404 });
    }

    await db.update(members).set({ isAlive: Boolean(isAlive) }).where(eq(members.id, id));
    const tree = await rebuildTree();
    return json({ success: true, tree: tree.toJSON() });
  }

  if (memberMatch && req.method === "DELETE") {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const id = Number(memberMatch[1]);
    const tree = await rebuildTree();
    const node = tree.findById(id);
    if (!node) {
      return json({ error: "Member not found." }, { status: 404 });
    }

    const deletedIds = tree.collectSubtreeIds(node);
    await db.delete(members).where(inArray(members.id, deletedIds));
    const nextTree = await rebuildTree();
    return json({ success: true, deletedIds, tree: nextTree.toJSON() });
  }

  return json({ error: "Not found." }, { status: 404 });
};

export const config: Config = {
  path: "/api/*",
};
