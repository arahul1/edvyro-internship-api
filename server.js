
"use strict";

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "internships.db"));

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(
  fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8")
);

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

const DOMAINS = [
  "Web Development",
  "AI/ML",
  "Data Science",
  "Cybersecurity",
  "UI/UX Design",
  "Other"
];

const FIELDS = [
  "role",
  "company",
  "domain",
  "location",
  "stipend",
  "duration",
  "description",
  "applyUrl"
];

const SELECT_FIELDS = `
  id, role, company, domain, location,
  stipend, duration, description,
  apply_url AS applyUrl,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function sendError(res, status, code, message, details) {
  const error = { code, message };

  if (details) {
    error.details = details;
  }

  return res.status(status).json({ error });
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) ? id : null;
}

function getInternship(id) {
  return db.prepare(`
    SELECT ${SELECT_FIELDS}
    FROM internships
    WHERE id = ?
  `).get(id);
}

function validateInternship(body, partial = false) {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      error: "Request body must be a JSON object."
    };
  }

  const allowed = new Set(FIELDS);
  const unknown = Object.keys(body).filter(
    (key) => !allowed.has(key)
  );

  if (unknown.length > 0) {
    return {
      error: "Request contains unknown fields.",
      details: unknown
    };
  }

  if (partial) {
    const supplied = Object.keys(body);

    if (supplied.length === 0) {
      return { error: "Provide fields to update." };
    }
  }

  const result = {};
  const errors = {};

  const rules = {
    role: { min: 2, max: 120 },
    company: { min: 2, max: 120 },
    location: { min: 2, max: 120 },
    stipend: { min: 1, max: 80 },
    duration: { min: 1, max: 80 },
    description: { min: 10, max: 2000 },
    applyUrl: { min: 1, max: 2048 }
  };

  for (const field of FIELDS) {
    if (partial && !Object.hasOwn(body, field)) {
      continue;
    }

    const value = body[field];

    if (typeof value !== "string") {
      errors[field] = "Must be a string.";
      continue;
    }

    const trimmed = value.trim();

    if (field === "domain") {
      if (!DOMAINS.includes(trimmed)) {
        errors[field] = `Must be one of: ${DOMAINS.join(", ")}.`;
      } else {
        result[field] = trimmed;
      }

      continue;
    }

    const rule = rules[field];

    if (
      trimmed.length < rule.min ||
      trimmed.length > rule.max
    ) {
      errors[field] =
        `Must contain between ${rule.min} and ${rule.max} characters.`;
      continue;
    }

    if (field === "applyUrl") {
      try {
        const url = new URL(trimmed);

        if (url.protocol !== "https:") {
          errors[field] = "Must be a valid HTTPS URL.";
          continue;
        }
      } catch {
        errors[field] = "Must be a valid HTTPS URL.";
        continue;
      }
    }

    result[field] = trimmed;
  }

  if (Object.keys(errors).length > 0) {
    return {
      error: "Validation failed.",
      details: errors
    };
  }

  return { value: result };
}

// List internships, with optional search, domain filtering and pagination.
app.get("/api/internships", (req, res) => {
  const allowedQuery = new Set(["page", "limit", "domain", "search"]);

  const unknown = Object.keys(req.query).filter(
    (key) => !allowedQuery.has(key)
  );

  if (unknown.length > 0) {
    return sendError(
      res, 400, "INVALID_QUERY",
      "Unsupported query parameters.", unknown
    );
  }

  // Reject duplicate query parameters such as ?page=1&page=2.
  for (const value of Object.values(req.query)) {
    if (typeof value !== "string") {
      return sendError(
        res, 400, "INVALID_QUERY",
        "Each query parameter must appear only once."
      );
    }
  }

  const pageText = req.query.page ?? "1";
  const limitText = req.query.limit ?? "10";

  if (!/^[1-9]\d*$/.test(pageText) ||
      !/^[1-9]\d*$/.test(limitText)) {
    return sendError(
      res, 400, "INVALID_PAGINATION",
      "Page and limit must be positive integers."
    );
  }

  const page = Number(pageText);
  const limit = Number(limitText);

  if (
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(limit) ||
    limit > 100 ||
    (page - 1) * limit > Number.MAX_SAFE_INTEGER
  ) {
    return sendError(
      res, 400, "INVALID_PAGINATION",
      "Page is too large or limit must be between 1 and 100."
    );
  }

  const domain = req.query.domain;
  const search = req.query.search ?? "";

  if (domain && !DOMAINS.includes(domain)) {
    return sendError(
      res, 400, "INVALID_DOMAIN",
      "The requested domain is not supported."
    );
  }

  if (search.length > 100) {
    return sendError(
      res, 400, "INVALID_SEARCH",
      "Search must not exceed 100 characters."
    );
  }

  const conditions = [];
  const params = [];

  if (domain) {
    conditions.push("domain = ?");
    params.push(domain);
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;

    conditions.push(`
      (
        role LIKE ? OR
        company LIKE ? OR
        description LIKE ? OR
        location LIKE ?
      )
    `);

    params.push(term, term, term, term);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const total = db.prepare(`
    SELECT COUNT(*) AS total
    FROM internships ${where}
  `).get(...params).total;

  const data = db.prepare(`
    SELECT ${SELECT_FIELDS}
    FROM internships
    ${where}
    ORDER BY id ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit);

  return res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// Retrieve one internship.
app.get("/api/internships/:id", (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return sendError(
      res, 400, "INVALID_ID",
      "Internship ID must be a positive integer."
    );
  }

  const internship = getInternship(id);

  if (!internship) {
    return sendError(
      res, 404, "NOT_FOUND",
      "Internship was not found."
    );
  }

  return res.json({ data: internship });
});

// Create an internship.
app.post("/api/internships", (req, res) => {
  const validation = validateInternship(req.body);

  if (validation.error) {
    return sendError(
      res, 400, "VALIDATION_ERROR",
      validation.error, validation.details
    );
  }

  const item = validation.value;

  const result = db.prepare(`
    INSERT INTO internships (
      role, company, domain, location, stipend,
      duration, description, apply_url
    ) VALUES (
      @role, @company, @domain, @location, @stipend,
      @duration, @description, @applyUrl
    )
  `).run(item);

  const created = getInternship(Number(result.lastInsertRowid));

  return res
    .location(`/api/internships/${created.id}`)
    .status(201)
    .json({ data: created });
});

// Replace an entire record. All fields are required.
app.put("/api/internships/:id", (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return sendError(
      res, 400, "INVALID_ID",
      "Internship ID must be a positive integer."
    );
  }

  if (!getInternship(id)) {
    return sendError(
      res, 404, "NOT_FOUND",
      "Internship was not found."
    );
  }

  const validation = validateInternship(req.body);

  if (validation.error) {
    return sendError(
      res, 400, "VALIDATION_ERROR",
      validation.error, validation.details
    );
  }

  const item = validation.value;

  db.prepare(`
    UPDATE internships SET
      role = @role,
      company = @company,
      domain = @domain,
      location = @location,
      stipend = @stipend,
      duration = @duration,
      description = @description,
      apply_url = @applyUrl,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });

  return res.json({ data: getInternship(id) });
});

// Delete an internship.
app.delete("/api/internships/:id", (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return sendError(
      res, 400, "INVALID_ID",
      "Internship ID must be a positive integer."
    );
  }

  const result = db.prepare(
    "DELETE FROM internships WHERE id = ?"
  ).run(id);

  if (result.changes === 0) {
    return sendError(
      res, 404, "NOT_FOUND",
      "Internship was not found."
    );
  }

  return res.json({
    data: { id, deleted: true }
  });
});

// Return JSON for unknown routes.
app.use((req, res) => {
  return sendError(
    res, 404, "ROUTE_NOT_FOUND",
    "The requested API route does not exist."
  );
});

// Handle malformed JSON and unexpected errors consistently.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    Object.hasOwn(err, "body")
  ) {
    return sendError(
      res, 400, "INVALID_JSON",
      "Request body contains invalid JSON."
    );
  }

  console.error(err);

  return sendError(
    res, 500, "INTERNAL_ERROR",
    "An unexpected server error occurred."
  );
});

const server = app.listen(PORT, () => {
  console.log(`Internship API running at http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
