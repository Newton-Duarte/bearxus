import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

const DEMO_EMAIL = "demo@bearxus.io";
const DEVELOPMENT_HOST = /^ep-silent-bird-b59kwhec(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/;
class CleanupRefusedError extends Error {}
const OWNED_TABLES = [
  ["users", "id"],
  ["accounts", "user_id"],
  ["sessions", "user_id"],
  ["email_verifications", "user_id"],
  ["projects", "user_id"],
  ["project_stages", "user_id"],
  ["tasks", "user_id"],
  ["notes", "user_id"],
  ["note_links", "user_id"],
  ["activities", "owner_id"],
  ["learning_resources", "user_id"],
  ["transactions", "user_id"],
];

const table = (name) => sql`${sql.identifier("public")}.${sql.identifier(name)}`;
const removableUsers = sql`select id from public.users where lower(email) <> ${DEMO_EMAIL}`;

function databaseUrl() {
  config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new CleanupRefusedError("Set DATABASE_URL to the development database in .env.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !DEVELOPMENT_HOST.test(url.hostname)) {
    throw new CleanupRefusedError("Refusing cleanup: DATABASE_URL must target development endpoint ep-silent-bird-b59kwhec.");
  }
  if ([...url.searchParams.keys()].some(key => !["sslmode", "channel_binding"].includes(key))) {
    throw new CleanupRefusedError("Refusing cleanup: unsupported connection options could override the database target.");
  }
  return url.href;
}

function previewQuery() {
  const counts = OWNED_TABLES.map(([name, owner]) => {
    const removed = name === "users"
      ? sql`lower(email) <> ${DEMO_EMAIL}`
      : sql`${sql.identifier(owner)} in (${removableUsers})`;
    return sql`select ${name} as table_name,
      count(*) filter (where ${removed})::int as to_delete,
      count(*) filter (where not (${removed}))::int as preserved
      from ${table(name)}`;
  });
  counts.push(sql`select 'verification_tokens' as table_name,
    count(*) filter (where lower(identifier) <> ${DEMO_EMAIL})::int as to_delete,
    count(*) filter (where lower(identifier) = ${DEMO_EMAIL})::int as preserved
    from public.verification_tokens`);
  return sql.join(counts, sql` union all `);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--help", "--dry-run", "--execute"].includes(arg))
    || new Set(args).size !== args.length || (args.includes("--execute") && args.includes("--dry-run"))) {
    throw new CleanupRefusedError("Use --dry-run (default), --execute, or --help. Do not combine --dry-run and --execute.");
  }
  if (args.includes("--help")) {
    console.log(`Development-only user cleanup; preserves ${DEMO_EMAIL} and its content if present.
Usage: pnpm db:cleanup-users [--dry-run | --execute]
Default: --dry-run previews counts without deleting anything.
--execute permanently deletes all other users, their content, and authentication records.
If the demo account is absent, cleanup removes all users and their content.
Stop the app first and take a backup if any test data matters.`);
    return;
  }

  const db = drizzle(neon(databaseUrl()));
  console.log(`Development database only. Excluding ${DEMO_EMAIL} and its content if present.`);
  const preview = (await db.execute(previewQuery())).rows;
  console.table(preview);
  if (Number(preview.find(row => row.table_name === "users")?.preserved) === 0) {
    console.log(`No ${DEMO_EMAIL} account exists. Cleanup will remove all users and their content.`);
  }
  if (!args.includes("--execute")) {
    console.log("Dry run: nothing deleted. Use --execute only when you intend to permanently remove these records.");
    return;
  }

  // Neon HTTP batches run as one transaction. Locks prevent concurrent writes
  // during cleanup; every delete excludes the demo email regardless of existence.
  const tables = [...OWNED_TABLES.map(([name]) => table(name)), table("verification_tokens")];
  const result = await db.batch([
    db.execute(sql`set local lock_timeout = '5s'`),
    db.execute(sql`set local statement_timeout = '30s'`),
    db.execute(sql`lock table ${sql.join(tables, sql`, `)} in share row exclusive mode`),
    // Tasks must go first: their stage FK uses RESTRICT, not CASCADE.
    db.execute(sql`delete from ${table("tasks")} where user_id in (${removableUsers})`),
    // Auth.js verification tokens have no user FK and must be cleaned explicitly.
    db.execute(sql`delete from ${table("verification_tokens")} where lower(identifier) <> ${DEMO_EMAIL}`),
    db.execute(sql`delete from ${table("users")} where lower(email) <> ${DEMO_EMAIL} returning id`),
  ]);
  console.log(`Deleted ${result.at(-1).rowCount} users and their content. Excluded ${DEMO_EMAIL} if present.`);
  console.log("Existing stateless JWT cookies are not revoked; clear browser cookies before retesting registration.");
}

main().catch((error) => {
  // Driver exceptions can contain connection details; do not print raw errors.
  console.error(error instanceof CleanupRefusedError ? error.message
    : "Cleanup failed. No partial cleanup is committed if the transaction fails. Check database connectivity, applied migrations, and concurrent writes.");
  process.exitCode = 1;
});
