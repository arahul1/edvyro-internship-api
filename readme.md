
# Internship Board REST API

A REST API built with Node.js, Express, and SQLite to manage internship records with validation, pagination, and persistent storage.

## Features

- List and retrieve internship records
- Create, update, and delete records
- SQLite database persistence
- Search and domain filtering
- Pagination with configurable page size
- Request validation and consistent JSON errors
- Parameterized SQL queries
- Database schema and seed data

## Technologies

- Node.js 20+
- Express 5
- SQLite
- better-sqlite3

## Project Structure

```text
internship-api/
├── data/
├── package.json
├── package-lock.json
├── server.js
├── schema.sql
├── seed.js
├── internship-records-sample.json
├── .gitignore
└── README.md
```

## Installation

Install Node.js 20 or newer, then run:

```bash
npm install
npm run seed
npm start
```

The API runs at:

`http://localhost:3000`

The SQLite database is created at `data/internships.db`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/internships` | List and filter internships |
| GET | `/api/internships/:id` | Get one internship |
| POST | `/api/internships` | Create an internship |
| PUT | `/api/internships/:id` | Replace an internship |
| DELETE | `/api/internships/:id` | Delete an internship |

## Pagination and Search

Example:

`GET /api/internships?page=1&limit=5`

Filter by domain:

`GET /api/internships?domain=AI%2FML`

Search by keyword:

`GET /api/internships?search=developer`

Combine filters:

`GET /api/internships?domain=Web%20Development&search=frontend&page=1&limit=5`

A list response includes `data` and `pagination`, containing the current page, limit, total records, and total pages.

## Create an Internship

Send a POST request to `/api/internships` with a JSON body:

```json
{
  "role": "Backend Developer Intern",
  "company": "Example Labs",
  "domain": "Web Development",
  "location": "Remote",
  "stipend": "10000 INR/month",
  "duration": "3 months",
  "description": "Build backend services and learn API development.",
  "applyUrl": "https://example.com/apply"
}
```

Successful creation returns HTTP `201 Created`.

## Response Format

Successful responses:

```json
{
  "data": {
    "id": 1,
    "role": "Frontend Developer Intern"
  }
}
```

This is a shortened example; actual responses contain the full record.

Error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": {
      "role": "Must contain between 2 and 120 characters."
    }
  }
}
```

## HTTP Status Codes

- `200` — Successful read, update, or delete
- `201` — Record created
- `400` — Invalid input or query
- `404` — Record or route not found
- `500` — Unexpected server error

## Data Validation

The API validates required fields, string lengths, approved domains, HTTPS application URLs, pagination parameters, and unknown request fields.

SQL queries use parameters instead of concatenating user input into SQL statements.

## Seed Data

The JSON seed file contains fictional internship records. Run `npm run seed` to populate a new database.

The seed script does not insert duplicates when records already exist.

## Limitations

This is an educational API milestone. Authentication, rate limiting, production deployment configuration, and automated tests will be addressed in later development.

The included internship records and application URLs are fictional examples.

## Author

Rahul Arnipalli

GitHub: http://github.com/arahul1/edvyro-internship-api
