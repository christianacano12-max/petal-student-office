CREATE TABLE IF NOT EXISTS admins (
 id SERIAL PRIMARY KEY, full_name VARCHAR(150) NOT NULL,
 email VARCHAR(150) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS students (
 id SERIAL PRIMARY KEY, student_number VARCHAR(50) UNIQUE NOT NULL,
 full_name VARCHAR(150) NOT NULL, course VARCHAR(100) NOT NULL,
 year_level VARCHAR(30) NOT NULL, email VARCHAR(150), phone VARCHAR(40),
 created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS attendance (
 id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 attendance_date DATE NOT NULL, status VARCHAR(20) NOT NULL CHECK(status IN ('Present','Late','Absent','Excused')),
 remarks TEXT, recorded_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(student_id,attendance_date)
);
CREATE TABLE IF NOT EXISTS sanctions (
 id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 violation VARCHAR(200) NOT NULL, description TEXT,
 severity VARCHAR(20) NOT NULL CHECK(severity IN ('Minor','Major','Grave')),
 sanction_action TEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'Pending'
 CHECK(status IN ('Pending','Under Review','Resolved')),
 sanction_date DATE NOT NULL DEFAULT CURRENT_DATE, issued_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS activity_logs (
 id SERIAL PRIMARY KEY, admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
 student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
 action VARCHAR(100) NOT NULL, description TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_sanctions_status ON sanctions(status);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
