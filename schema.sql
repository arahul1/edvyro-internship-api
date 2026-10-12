
CREATE TABLE IF NOT EXISTS internships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(length(trim(role)) BETWEEN 2 AND 120),
    company TEXT NOT NULL CHECK(length(trim(company)) BETWEEN 2 AND 120),
    domain TEXT NOT NULL CHECK(domain IN (
        'Web Development',
        'AI/ML',
        'Data Science',
        'Cybersecurity',
        'UI/UX Design',
        'Other'
    )),
    location TEXT NOT NULL CHECK(length(trim(location)) BETWEEN 2 AND 120),
    stipend TEXT NOT NULL CHECK(length(trim(stipend)) BETWEEN 1 AND 80),
    duration TEXT NOT NULL CHECK(length(trim(duration)) BETWEEN 1 AND 80),
    description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2000),
    apply_url TEXT NOT NULL CHECK(length(apply_url) BETWEEN 1 AND 2048),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_internships_domain
ON internships(domain);

CREATE INDEX IF NOT EXISTS idx_internships_role
ON internships(role);
