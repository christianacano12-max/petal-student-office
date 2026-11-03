# Petal — Student Office Management System

Pink-themed responsive student-office dashboard. Stack: Express.js, PostgreSQL, HTML, CSS and vanilla JavaScript.

## Features
- Admin-only login; no public registration or student login.
- First admin created locally from terminal; existing admin can add other admins in the dashboard.
- Student profiles: add, edit, search and delete.
- Attendance: Present, Late, Absent, Excused; one entry per student per date.
- Sanctions: violation, severity, action, status; status updates and delete.
- Activity log for administrative actions.
- Dashboard overview and responsive UI.
- bcrypt password hashes and PostgreSQL-backed sessions.

## Setup
1. Install Node.js and PostgreSQL.
2. Create database `student_office` in PostgreSQL.
3. Run `database/schema.sql` against that database (pgAdmin Query Tool or psql).
4. Copy `.env.example` to `.env` in the project root. Fill in your PostgreSQL password and set a random `SESSION_SECRET` of at least 32 characters. Never upload `.env`.
5. In the project root, run:
   ```bash
   npm install
   npm run create-admin
   npm run dev
   ```
6. Enter the first admin name, email and password in the terminal. Password input is hidden; use at least 10 characters.
7. Visit http://localhost:3000 and sign in. Add any additional administrators from Administrators → Add administrator.

## Database
Default local configuration uses DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME. Change DB_NAME to `student_office`. The schema creates admins, students, attendance, sanctions and activity_logs. Session storage table is created automatically.

## Important
- Student, attendance, sanctions, activity and administrator APIs are protected by an authenticated administrator session.
- Passwords are bcrypt-hashed (12 rounds); session cookies are HttpOnly and SameSite=Lax.
- In production, use HTTPS and set NODE_ENV=production. Before public deployment, add rate limiting, CSRF protection, secure deployment configuration, backups and institutional privacy/security review.
- Deleting a student deletes linked attendance and sanction rows through database cascade rules.
