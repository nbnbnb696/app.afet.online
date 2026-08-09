-- Expense Tracker API - Seed data (SQL Server)
-- Inserts a test user that can be used to log in via POST /api/auth/login.
--
-- IMPORTANT: the "password" column stores a BCrypt hash (see
-- com.expense.tracker.config.SecurityConfig -> BCryptPasswordEncoder), not
-- plain text. Login compares the raw password against this hash, so it
-- cannot be a plain string.
--
-- The hash below is a known BCrypt encoding of the password: password
-- Login with:
--   username: testuser
--   password: password
--
-- This hash was not generated fresh from this project's dependencies, so
-- verify it works before relying on it. The reliable alternative is to
-- seed the user via the app's own register endpoint instead, which always
-- produces a hash the app can verify:
--   POST /api/auth/register  { "username": "testuser", "email": "testuser@example.com", "password": "password" }

INSERT INTO users (username, email, password)
VALUES ('testuser', 'testuser@example.com', '$2a$10$GRLdNijSQMUvl/au9ofL.eDwmoohzzS7.rmNSJZ.0FxO/BTk76klW');
