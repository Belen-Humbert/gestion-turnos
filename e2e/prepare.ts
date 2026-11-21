// Prepara todo lo que necesitan las pruebas: crea la base e2e si no existe, aplica las migraciones,
// crea a Ana y compila la app en una carpeta aparte. Se ejecuta solo con `npm run e2e`.
import { execSync } from "node:child_process";
import pg from "pg";
import { appEnv, e2eDatabaseUrl } from "./env";

async function ensureDatabase() {
  const url = new URL(e2eDatabaseUrl());
  const name = url.pathname.replace(/^\//, "");
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );
    // Cada corrida arranca con una base nueva: así las pruebas no dependen de lo que dejó la anterior.
    const quoted = `"${name.replace(/"/g, '""')}"`;
    if (rowCount) await client.query(`drop database ${quoted} with (force)`);
    await client.query(`create database ${quoted}`);
    console.log(`Base de pruebas lista: ${name}`);
  } finally {
    await client.end();
  }
}

function run(cmd: string) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: appEnv() as NodeJS.ProcessEnv });
}

async function main() {
  await ensureDatabase();
  run("npm run db:migrate");
  run("npm run seed:admin");
  if (!process.env.E2E_SKIP_BUILD) run("npx next build");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
