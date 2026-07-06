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
  if (Number(count) >= 50) return;

  // Clear existing if count is low or out of date
  await db.delete(members);

  const seedData = [
    { id: 1, name: 'Munshi karam Das Sahab', relation: 'Patriarch', parentId: null, isAlive: false },
    { id: 2, name: 'Gurudas Mal', relation: 'Son', parentId: 1, isAlive: false },
    { id: 3, name: 'Chaj Mal', relation: 'Son', parentId: 1, isAlive: false },
    { id: 4, name: 'Gujjar Mal', relation: 'Son', parentId: 1, isAlive: false },
    { id: 5, name: 'Puram Mal', relation: 'Son', parentId: 1, isAlive: false },
    { id: 6, name: 'Todra Mal', relation: 'Son', parentId: 1, isAlive: false },
    { id: 7, name: 'Dev Chandra', relation: 'Son', parentId: 5, isAlive: false },
    { id: 8, name: 'Dev Rai', relation: 'Son', parentId: 5, isAlive: false },
    { id: 9, name: 'Kharag Rai', relation: 'Son', parentId: 8, isAlive: false },
    { id: 10, name: 'Tilak Ram', relation: 'Son', parentId: 8, isAlive: false },
    { id: 11, name: 'Dileep Ram', relation: 'Son', parentId: 8, isAlive: false },
    { id: 12, name: 'Hriday Ram', relation: 'Son', parentId: 8, isAlive: false },
    { id: 13, name: 'Chandra Sen', relation: 'Son', parentId: 8, isAlive: false },
    { id: 14, name: 'Deveki Nandan', relation: 'Son', parentId: 8, isAlive: false },
    { id: 15, name: 'Hansaman', relation: 'Son', parentId: 9, isAlive: false },
    { id: 17, name: 'Chitra Sen', relation: 'Son', parentId: 9, isAlive: false },
    { id: 18, name: 'Jogha Ram', relation: 'Son', parentId: 9, isAlive: false },
    { id: 19, name: 'Chhatrapat', relation: 'Son', parentId: 9, isAlive: false },
    { id: 20, name: 'Govind Ray', relation: 'Son', parentId: 9, isAlive: false },
    { id: 21, name: 'Nand Lal', relation: 'Son', parentId: 9, isAlive: false },
    { id: 22, name: 'Dheer Dhar', relation: 'Son', parentId: 20, isAlive: false },
    { id: 23, name: 'Meenth Ram', relation: 'Son', parentId: 20, isAlive: false },
    { id: 24, name: 'Dati Ram', relation: 'Son', parentId: 22, isAlive: false },
    { id: 25, name: 'Munna Lal', relation: 'Son', parentId: 22, isAlive: false },
    { id: 26, name: 'Bhola Nath', relation: 'Son', parentId: 24, isAlive: false },
    { id: 27, name: 'Munnu Lal', relation: 'Son', parentId: 24, isAlive: false },
    { id: 28, name: 'Doodh Ram', relation: 'Son', parentId: 26, isAlive: false },
    { id: 29, name: 'Madari Lal', relation: 'Son', parentId: 28, isAlive: false },
    { id: 30, name: 'Lalta Parsad', relation: 'Son', parentId: 29, isAlive: false },
    { id: 31, name: 'Gaya Parsad', relation: 'Son', parentId: 30, isAlive: false },
    { id: 32, name: 'Baijnath', relation: 'Son', parentId: 30, isAlive: false },
    { id: 33, name: 'Chandrika Sahay', relation: 'Son', parentId: 30, isAlive: false },
    { id: 34, name: 'Shitla Sahay', relation: 'Son', parentId: 30, isAlive: false },
    { id: 35, name: 'Majlis Ray', relation: 'Son', parentId: 34, isAlive: false },
    { id: 36, name: 'Bachan Lal', relation: 'Son', parentId: 35, isAlive: false },
    { id: 37, name: 'Sukhnandan Lal', relation: 'Son', parentId: 35, isAlive: false },
    { id: 38, name: 'Sohan Lal', relation: 'Son', parentId: 35, isAlive: false },
    { id: 39, name: 'Pramod Kumar', relation: 'Son', parentId: 36, isAlive: false },
    { id: 40, name: 'Shiv Sahay', relation: 'Son', parentId: 37, isAlive: false },
    { id: 41, name: 'Dinesh Kumar', relation: 'Son', parentId: 38, isAlive: true },
    { id: 42, name: 'Suresh Kumar', relation: 'Son', parentId: 38, isAlive: true },
    { id: 43, name: 'Ramesh Kumar', relation: 'Son', parentId: 38, isAlive: true },
    { id: 44, name: 'Rajesh Kumar', relation: 'Son', parentId: 38, isAlive: true },
    { id: 45, name: 'Sanjay Kumar', relation: 'Son', parentId: 40, isAlive: true },
    { id: 46, name: 'Atul Kumar', relation: 'Son', parentId: 44, isAlive: true },
    { id: 47, name: 'Anil Kumar', relation: 'Son', parentId: 44, isAlive: true },
    { id: 48, name: 'Aditya Sri.', relation: 'Son', parentId: 46, isAlive: true },
    { id: 49, name: 'Sujal Sri.', relation: 'Son', parentId: 46, isAlive: true },
    { id: 50, name: 'Devarishi Sri.', relation: 'Son', parentId: 47, isAlive: true }
  ];

  await db.insert(members).values(seedData);
  await db.execute(sql`SELECT setval('members_id_seq', (SELECT MAX(id) FROM members))`);
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
