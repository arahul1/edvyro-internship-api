
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const root = __dirname;
const dataDir = path.join(root, "data");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "internships.db"));
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

try {
  const schema = fs.readFileSync(
    path.join(root, "schema.sql"),
    "utf8"
  );

  db.exec(schema);

  const count = db
    .prepare("SELECT COUNT(*) AS total FROM internships")
    .get().total;

  if (count > 0) {
    console.log(`Database already contains ${count} internships. No records added.`);
  } else {
    const records = JSON.parse(
      fs.readFileSync(
        path.join(root, "internship-records-sample.json"),
        "utf8"
      )
    );

    if (!Array.isArray(records)) {
      throw new Error("Seed data must be a JSON array.");
    }

    const insert = db.prepare(`
      INSERT INTO internships (
        role, company, domain, location,
        stipend, duration, description, apply_url
      ) VALUES (
        @role, @company, @domain, @location,
        @stipend, @duration, @description, @applyUrl
      )
    `);

    const seedTransaction = db.transaction((items) => {
      for (const item of items) {
        insert.run(item);
      }
    });

    seedTransaction(records);
    console.log(`Successfully seeded ${records.length} internships.`);
  }
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
