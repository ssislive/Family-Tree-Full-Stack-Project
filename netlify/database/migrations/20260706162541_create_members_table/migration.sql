CREATE TABLE "members" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"relation" text NOT NULL,
	"parent_id" integer,
	"is_alive" boolean DEFAULT true NOT NULL
);
