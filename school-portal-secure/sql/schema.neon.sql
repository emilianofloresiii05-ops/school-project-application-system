
-- Neon PostgreSQL schema. Run this in the Neon SQL Editor.
CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY,
 full_name VARCHAR(150) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 lrn CHAR(12) UNIQUE,
 grade_level VARCHAR(20) CHECK (grade_level IN ('Grade 11','Grade 12')),
 section VARCHAR(80),
 strand VARCHAR(80),
 password_hash VARCHAR(255) NOT NULL,
 role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin','superadmin')),
 account_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (account_status IN ('pending','approved','rejected','disabled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role,account_status);

CREATE TABLE IF NOT EXISTS projects (
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(150) NOT NULL,
 category VARCHAR(100),
 description TEXT NOT NULL,
 eligibility_requirements TEXT NOT NULL,
 required_documents TEXT,
 total_slots INTEGER NOT NULL DEFAULT 0 CHECK(total_slots>=0),
 deadline DATE,
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed')),
 created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS applications (
 id BIGSERIAL PRIMARY KEY,
 student_id BIGINT NOT NULL REFERENCES users(id),
 project_id BIGINT NOT NULL REFERENCES projects(id),
 reason TEXT NOT NULL,
 additional_notes TEXT,
 status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Needs information')),
 review_note TEXT,
 reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_project_status ON applications(project_id,status);
CREATE INDEX IF NOT EXISTS idx_app_student_status ON applications(student_id,status);

CREATE TABLE IF NOT EXISTS application_documents (
 id BIGSERIAL PRIMARY KEY,
 application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 original_name VARCHAR(255) NOT NULL,
 stored_name CHAR(64) NOT NULL UNIQUE,
 mime_type VARCHAR(100) NOT NULL,
 file_size INTEGER NOT NULL CHECK(file_size>0),
 uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_application ON application_documents(application_id);

CREATE TABLE IF NOT EXISTS notifications (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL,
 message TEXT NOT NULL,
 is_read BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id,is_read,created_at);

CREATE TABLE IF NOT EXISTS activity_logs (
 id BIGSERIAL PRIMARY KEY,
 actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 action VARCHAR(255) NOT NULL,
 target_type VARCHAR(60),
 target_id BIGINT,
 ip_address INET,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS login_attempts (
 id BIGSERIAL PRIMARY KEY,
 email VARCHAR(190) NOT NULL,
 ip_address INET,
 attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(email,attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts(ip_address,attempted_at);

CREATE TABLE IF NOT EXISTS password_resets (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_resets(expires_at);

CREATE TABLE IF NOT EXISTS archived_activity_logs (
 id BIGINT PRIMARY KEY,
 actor_id BIGINT,
 action VARCHAR(255) NOT NULL,
 target_type VARCHAR(60),
 target_id BIGINT,
 ip_address INET,
 created_at TIMESTAMPTZ NOT NULL,
 archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO projects(name,category,description,eligibility_requirements,required_documents,total_slots,deadline,status)
SELECT v.name,v.category,v.description,v.requirements,v.documents,v.slots,v.deadline::date,'published'
FROM (VALUES
 ('Project Pedal','Student Assistance','A bicycle assistance program to help eligible students with transportation to and from school.','Currently enrolled student; demonstrate transportation need; submit the required supporting documents.','Proof of enrollment; application form',12,'2026-12-15'),
 ('Project Linaw','Health & Wellness','Vision and eyeglasses assistance for students who meet the program criteria.','Currently enrolled student; vision concern confirmed through screening; meet program eligibility criteria.','Proof of enrollment; vision screening result',20,'2026-12-20'),
 ('Project Finance','Financial Assistance','Financial assistance for eligible students based on the school assessment criteria.','Currently enrolled student; meet the published household-income and assessment requirements.','Proof of enrollment; household income documents',8,'2026-12-10'),
 ('Project Uniform','Student Assistance','Uniform assistance for eligible students.','Currently enrolled student; demonstrate need and meet school criteria.','Proof of enrollment; application form',15,NULL)
) AS v(name,category,description,requirements,documents,slots,deadline)
WHERE NOT EXISTS (SELECT 1 FROM projects);
